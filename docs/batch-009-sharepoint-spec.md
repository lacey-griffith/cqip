# SPEC: Batch 009 — SharePoint Integration

**Status:** SHIPPED 2026-05-29. Build path was clear — Azure setup re-verified 2026-05-26 (admin consent + per-site CRO grant already in place).
**Owner:** DC (Dashboard backend).
**Consumer:** AC (Forge consumer, Phase 2).
**Companion docs:** CLAUDE.md §14 + §15 (Batch 009 entry), CROSS_CLAUDE.md §3 (`/api/sharepoint/*` contract surface), DC §13 rules 21 + 27.

---

## 1. What this is

A server-side proxy from the Worker to Microsoft Graph that lets AC (and any future consumer) read CRO-tenant SharePoint content without holding Graph credentials. Three read-only endpoints. Single Fusion92 tenant. No write paths in v1.

Day-one consumer is AC's Phase 2 workflow: given a Jira ticket's QA Doc URL (SharePoint folder root), enumerate the folder, parse the xlsx Preview Links sheet, and fetch the screenshot bytes.

---

## 2. Locked decisions

| # | Decision | Locked value | Rationale |
|---|----------|--------------|-----------|
| 1 | v1 write scope | Read-only | Matches §13 rule 5 (read-only against Jira) and Batch 007 (read-only Boards). Smaller surface, smaller blast radius, validates Graph integration before write paths. |
| 2 | Microsoft Graph scope set | `Sites.Selected` | Tightest scope that supports the three operations. Per-site grant, no tenant-wide read. |
| 3 | Endpoint shape | Three routes, one per resource type | Distinct return shapes; matches brands-API precedent (route-per-resource, not mode-param). |
| 4 | Sync semantics | Structured response + 60s per-call cache | Proxy owns folder-filtering and xlsx-parsing rules. AC doesn't reimplement them. 60s TTL kills double-clicks without masking operator edits. |
| 5 | Failure / rotation | Fresh Graph token per call · 401→502 with auth-error envelope · 1 retry on 5xx, 500ms backoff · `CQIP_SHAREPOINT_API_TOKEN` rotates atomically per §13 rule 27 | Token caching adds expiry-tracking complexity for negligible latency gain. Operator-triggered single-ticket calls don't need it. |

---

## 3. Endpoints

All three are `GET`, all three require `Authorization: Bearer <CQIP_SHAREPOINT_API_TOKEN>` (timing-safe compare, same pattern as `/api/brands/*`). Wrong/missing token returns 401 with `{error: "unauthorized"}`. Auth header is the only auth path — no query-param fallback.

### 3.1 `GET /api/sharepoint/folder?url=<folder-url>`

Enumerates a SharePoint folder identified by its web URL. Returns the structured shape AC expects.

**Request**
```
GET /api/sharepoint/folder?url=https%3A%2F%2Ffusion92.sharepoint.com%2Fsites%2FCRO%2F...
Authorization: Bearer <CQIP_SHAREPOINT_API_TOKEN>
```

**Response (200)**
```json
{
  "folder": {
    "url": "https://fusion92.sharepoint.com/sites/CRO/...",
    "name": "NBLYCRO-1452 QA Doc"
  },
  "xlsx": {
    "ref": "drive-id:item-id",
    "name": "NBLY_MRA_Hero_PreviewLinks.xlsx"
  },
  "screenshots": [
    { "ref": "drive-id:item-id", "name": "variation-1.png", "size": 184320 },
    { "ref": "drive-id:item-id", "name": "variation-2.png", "size": 192104 }
  ],
  "warnings": []
}
```

**Filtering rules (proxy-side, not AC's concern):**

- Identify the **single xlsx file at folder root**. Filename varies per ticket.
- Identify the **`Shareable Screenshots/` subfolder** and enumerate its image files (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`).
- **Ignore `assets/` and `bugs/`** subfolders entirely (do not recurse, do not enumerate).
- Sort screenshots by filename ascending (stable order for AC).

**`ref` format:** `<drive-id>:<item-id>` opaque to AC; AC passes verbatim back to `/xlsx` and `/image`. DC owns the format internally.

### 3.2 `GET /api/sharepoint/xlsx?ref=<file-ref>`

Parses the xlsx `Preview Links` sheet and returns structured rows. Does NOT return raw file bytes.

**Response (200)**
```json
{
  "filename": "NBLY_MRA_Hero_PreviewLinks.xlsx",
  "rows": [
    {
      "label": "Control",
      "variation": "Control",
      "national_url": "https://mrappliance.com/...",
      "local_url": "https://mrappliance.com/atlanta-ga/..."
    },
    {
      "label": "V1",
      "variation": "Hero Image Swap",
      "national_url": "https://mrappliance.com/...",
      "local_url": null
    }
  ]
}
```

**Parsing rules (proxy-side):**

- Read sheet named `Preview Links`. Case-insensitive match; trim whitespace.
- Row 1: title (ignore).
- Row 2: blank (skip).
- Header depth is variable (1–2 rows). Data begins at the first row whose
  Col A is a variation label (Control/V1/V2/…), read contiguously; stop at
  the first row where Col A is empty.
- Map: Col A → `label`, Col B → `variation`, Col C → `national_url`, Col D → `local_url` (nullable).

If no `Preview Links` sheet exists → 422 with `{error: "sheet_not_found", expected: "Preview Links"}`.

### 3.3 `GET /api/sharepoint/image?ref=<file-ref>`

Returns image bytes for one screenshot. Format determined by Graph response; proxy passes through `Content-Type`.

**Response (200)**
```
Content-Type: image/png
Content-Length: 184320
Content-Disposition: inline; filename="variation-1.png"

<raw bytes>
```

Base64 wrapping not used — direct binary. AC base64-encodes only at the Forge boundary where required.

**Size cap:** 25 MB. Above that → 413 with `{error: "image_too_large", max_bytes: 26214400, actual_bytes: <n>}`. (Graph itself returns full bytes; the cap is proxy-side to protect Worker memory.)

---

## 4. Error envelope

All non-2xx responses (except `/image` 200) return JSON:

```json
{ "error": "<error_code>", "message": "<human-readable>", "...": "context fields" }
```

**Error code matrix:**

| Code | HTTP | When | Context fields |
|------|------|------|----------------|
| `unauthorized` | 401 | Bearer missing/wrong | — |
| `folder_not_found` | 404 | URL doesn't resolve in Graph | `url` |
| `file_not_found` | 404 | `ref` doesn't resolve | `ref` |
| `multiple_xlsx_at_root` | 422 | Folder root has >1 xlsx | `filenames: [...]` |
| `xlsx_not_found` | 422 | Folder root has 0 xlsx | `url` |
| `sheet_not_found` | 422 | xlsx missing `Preview Links` | `expected: "Preview Links"` |
| `image_too_large` | 413 | Image exceeds 25 MB | `max_bytes`, `actual_bytes` |
| `sharepoint_auth` | 502 | Graph returned 401/403 | — |
| `sharepoint_upstream` | 502 | Graph returned other 5xx after retry | `graph_status: <n>` |
| `internal` | 500 | Anything else | — |

**Soft-fail (not an error, per AC's §13-rule-12-analog):** empty `Shareable Screenshots/` returns 200 with `screenshots: []` and a warning entry. AC distinguishes "no screenshots yet" from "folder broken."

```json
{
  "folder": { ... },
  "xlsx": { ... },
  "screenshots": [],
  "warnings": [{ "code": "empty_screenshots_folder", "message": "Shareable Screenshots/ exists but is empty" }]
}
```

If `Shareable Screenshots/` is **missing** (not just empty), also soft-fail with warning code `screenshots_folder_missing`. AC may surface differently but proxy doesn't gate on it.

---

## 5. Caching

- **Folder enumeration** (`/folder`): 60s TTL keyed on normalized URL.
- **xlsx parse** (`/xlsx`): 60s TTL keyed on `ref`.
- **Image bytes** (`/image`): **no cache** — pass through. Cloudflare's edge cache handles repeat fetches; Worker doesn't store bytes.

Cache layer: in-memory per-Worker-instance using a simple Map + timestamp. No KV, no Durable Object. Acceptable to have multiple cache copies across instances; 60s TTL bounds drift.

Cache bypass: `?nocache=1` query param skips cache read AND write. Useful for the operator after editing the SharePoint folder.

Cache write only on 2xx responses. Errors are not cached.

---

## 6. Microsoft Graph auth

**Flow:** Client credentials (application permissions, no user context).

**Per-call sequence:**

1. Worker requests a fresh access token per logical request (one user-facing call to `/api/sharepoint/*`) from the Azure AD token endpoint with `client_id`, `client_secret`, `scope=https://graph.microsoft.com/.default`.
2. Worker calls Graph API with `Authorization: Bearer <access_token>`. The token is reused across the 2-3 Graph sub-calls within that request (e.g. share-resolve → enumerate children → fetch bytes).
3. Token is discarded at request end. No cross-request caching.

**Why no token cache:** Microsoft tokens are ~1 hour. Caching saves ~200ms per call but adds (a) expiry tracking, (b) refresh-on-401 retry logic, (c) per-instance state. Operator-triggered single-ticket calls don't warrant the complexity. Revisit if Phase 2 generates bulk traffic.

**Graph endpoints used:**

- Folder resolution from URL: `GET /shares/{u!<base64url>}/driveItem` — translate the user-supplied SharePoint web URL into a Graph `driveItem` (carries `id` + `parentReference.driveId`). **Share-id approach, not path-lookup** — see rationale below.
- `GET /drives/{drive-id}/items/{item-id}/children?$top=200` — folder enumeration from the resolved driveItem.
- `GET /drives/{drive-id}/items/{item-id}/content` — file bytes (xlsx + images).
- Site/drive resolution (config-driven, for tenant-guard): `GET /sites/{hostname}:/{server-relative-path}` then `GET /sites/{site-id}/drive`.

**Rationale (D1 — share-id over path-lookup):** the original design listed `GET /sites/{site-id}/drive/root:/{path}:/children`. That path-rooted lookup is brittle: SharePoint silently exposes the same document library under both the `Shared Documents` and `Documents` server-relative aliases, and which one a user-supplied URL carries drifts unpredictably — a path-lookup against the wrong alias 404s with no useful signal. The share-id form (`u!` + unpadded base64url of the full URL, per Graph's shares API) is robust to URL shape (UI browser URLs, share URLs, encoded paths, library-alias variants) because Graph resolves the share token to the canonical driveItem itself.

---

## 7. Auth + secrets

Two distinct secrets, **not shared**:

| Secret | Used between | Stored at |
|--------|--------------|-----------|
| `CQIP_SHAREPOINT_API_TOKEN` | AC (Forge) ↔ Worker | Forge dev + Forge prod encrypted vars · Worker `wrangler secret put` · DC local `.env.local` |
| `AZURE_CLIENT_ID` + `AZURE_CLIENT_SECRET` + `AZURE_TENANT_ID` | Worker ↔ Azure AD | Worker `wrangler secret put` only |

**Rotation (DC §13 rule 27 atomicity):**

- `CQIP_SHAREPOINT_API_TOKEN` rotation: four surfaces atomic (Worker · Forge dev · Forge prod · DC `.env.local`). Coordinate with AC per CROSS_CLAUDE.md §2 convention 5.
- `AZURE_CLIENT_SECRET` rotation: Worker only. No AC coordination needed. Verify with one curl after rotation.

**Per DC §13 rule 21:** if the proxy is implemented as a Supabase Edge Function (it won't be — see §10), it would require `verify_jwt = false` in `supabase/config.toml`. As a Worker route this doesn't apply.

---

## 8. Out of scope for v1

- Write operations (upload, delete, rename) — Phase 2-side deferral; AC explicitly confirmed not needed day-one.
- Bulk / batch endpoints.
- Real-time sync / SharePoint webhooks / change-notification subscriptions.
- Multi-tenant SharePoint (single Fusion92 tenant only).
- Caching beyond per-Worker-instance Map (no KV, no Durable Objects).
- Token caching across calls.
- Recursion into `assets/` or `bugs/` subfolders.
- Sheets other than `Preview Links` in the xlsx.

---

## 9. Prerequisites

**Verified 2026-05-26.** Lacey ran end-to-end Microsoft Graph curl against the CRO SharePoint site:

| Operation | Endpoint | Result |
|---|---|---|
| Token | `POST /{tenant}/oauth2/v2.0/token` | 200 |
| Site metadata | `GET /sites/fusion92.sharepoint.com:/sites/CRO` | 200 with full site object |
| Drive enumeration | `GET /sites/{site-id}/drive/root/children` | 200 with full folder + file listing |

Admin consent on `Sites.Selected` and the per-site CRO grant are both already in place (the app's `selectedsites` count returned 1, matching the design). No outstanding Azure access work; the current `AZURE_CLIENT_SECRET` is functional for all three operations this batch needs.

**Hygiene follow-up (non-blocking):** the Azure client secret was visible in 2026-05-02/03 verification screenshots and in the 2026-05-26 verification curl. Rotation is Carl-executable (Worker-only per §7) and tracked in CLAUDE.md §15 / CROSS_CLAUDE.md §5 as hygiene-deferred, not as a SHIP gate.

---

## 10. Implementation sketch

**Surface:** Worker routes under `app/api/sharepoint/`, **not** Supabase Edge Functions. Reasoning: the Worker already terminates external API calls (Jira, the brands API), the secret store is already there, no cross-function latency penalty.

**New files:**

```
app/api/sharepoint/
  folder/route.ts           # GET enumerate folder
  xlsx/route.ts             # GET parse Preview Links sheet
  image/route.ts            # GET stream image bytes

lib/sharepoint/
  graph-client.ts           # Token acquisition + Graph fetch wrapper
  site-resolver.ts          # SharePoint web URL → site-id / drive-id
  folder-filter.ts          # xlsx-at-root + Shareable Screenshots/ logic
  xlsx-parser.ts            # Preview Links sheet → structured rows
  cache.ts                  # Per-instance Map + TTL
  errors.ts                 # Error envelope builders

lib/api/
  sharepoint-bearer-auth.ts # Mirrors lib/api/bearer-auth.ts but for the SHAREPOINT token
```

**Reuse:** xlsx parsing uses `xlsx-js-style` (already in deps from Batch 004.2; the plain `xlsx` package was removed 2026-04-26 over unpatched high-CVEs). `xlsx-js-style` is a read-compatible superset, so the read-only `Preview Links` parse works against it unchanged — no new build-time dependency added. (Rationale: D3.)

**New env vars (all set via `wrangler secret put`):**

```
CQIP_SHAREPOINT_API_TOKEN   # AC ↔ Worker bearer
AZURE_CLIENT_ID             # From Azure app registration
AZURE_CLIENT_SECRET         # Current secret functional (verified 2026-05-26); hygiene rotation target week of 2026-06-01
AZURE_TENANT_ID             # Fusion92 tenant
SHAREPOINT_SITE_HOSTNAME    # e.g. "fusion92.sharepoint.com"
SHAREPOINT_SITE_PATH        # e.g. "/sites/CRO"
```

`.env.example` updated to declare them with empty values per §4 conventions.

**No DB migration.** This batch is stateless: no audit rows, no cache table, no Graph token persistence.

**Tests:**

- Unit: folder filter (ignores assets/, ignores bugs/, identifies single xlsx, handles 0/2+ xlsx).
- Unit: xlsx parser (skip rows 1-3, stop at empty Col A, null local_url handling).
- Unit: error envelope shape for each error code.
- Integration: live-Azure smoke test against one known good NBLYCRO ticket folder. NOT in CI — manual step on the SHIP commit.

---

## 11. CLAUDE.md updates required at SHIP (per §13 rule 23)

- **Header "Current deployed state"** — append "Batch 009 (SharePoint proxy)".
- **§3 Repository Structure** — add `app/api/sharepoint/` and `lib/sharepoint/`.
- **§4 Environment Variables** — add the 5 new env vars with descriptions.
- **§13** — likely no new rule unless a surprise surfaces during build. The relevant rules (5, 21, 27) already cover the patterns this batch uses.
- **§14 "Planned but not yet shipped"** — remove the SharePoint entry from "Planned" (it's now shipped).
- **§15** — remove the Batch 009 section from pending; remove or update the two Azure prereqs depending on whether they cleared.
- **§16** — new "Batch 009" entry with date, what shipped, links to commits, advisor credit (AC for the day-one needs clarification).

CROSS_CLAUDE.md §3 also gets updated: `/api/sharepoint/*` moves from PLANNED to LIVE with the locked endpoint shapes.

---

## 12. Open questions for SHIP-day (not blocking design)

- Site URL hardcoded as env var (`SHAREPOINT_SITE_HOSTNAME` + `SHAREPOINT_SITE_PATH`) for v1. Multi-site support would mean accepting the host+path in the request URL and resolving site-id dynamically per call. Not needed day-one; flag if AC's Phase 2 spec ever lands a second site.
- Worker memory ceiling for the 25 MB image cap — verify against Cloudflare Workers limits when implementation starts. If the actual ceiling is lower, reduce cap.

(Resolved 2026-05-26: SharePoint admin consent + Azure admin consent on `Sites.Selected` both already granted; per-site CRO grant in place. No follow-up needed.)

---

*Draft 2026-05-13 | Updated 2026-05-26 (§9 Prerequisites + status header reflect Azure re-verification — admin consent already granted; SHIP gate dissolved) | SHIPPED 2026-05-29 (4 SHIP-day deviations folded in: D1 share-id resolution, D2 `xlsx_not_found` 422 hard-fail, D3 `xlsx-js-style` dep, D4 token per logical request) | Design session DC + AC + Lacey | Locked: scope (read-only), Graph scope (Sites.Selected), endpoint shape (3 routes), sync semantics (structured + 60s cache), failure (fresh token, 401→502, atomic rotation)*
