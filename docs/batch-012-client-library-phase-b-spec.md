# Batch 012 — Client Library, Phase B (Monitoring Ingest) — SPEC

**Author:** DC · **Date:** 2026-07-15 · **Repo:** `lacey-griffith/cqip`
**Status:** DRAFT for Jenny pre-flight → Claudette build (build AFTER Phase A ships)
**Canonical on ship:** CLAUDE.md §15/§16. This doc is the build spec.

---

## 0. Done definition (do not expand mid-build)

- An external tool POSTs findings to a Bearer-authed route; unauthed = 401.
- Findings land in a new `monitoring_findings` table and **dedupe** on re-post
  (same source + external ref updates in place, never duplicates).
- Each finding resolves to a `brand_id` where possible (nullable if not).
- Findings surface on the Client Library page as a "Needs action" panel
  (status = `new`), newest/most-severe first.
- Admins can dismiss or action a finding; a dismissed finding stays dismissed
  even if the tool re-reports it.
- Reads/writes ONLY the new table. The route is generic enough that Convert
  (008) posts through the same surface (distinguished by `source`).

**Out of scope (C/D — TODOs only):** Jira ticketing from a finding, the public
bug form, per-finding ticket links.

---

## 1. Data model — migration `025_monitoring_findings.sql`

Idempotent; RLS mirrors migration 009 (authenticated SELECT, admin `FOR ALL`
via `public.is_admin()`).

### `monitoring_findings`
```
id            uuid PK default gen_random_uuid()
source        text NOT NULL CHECK (source IN ('convert','manual'))  -- extensible
external_ref  text            -- the tool's own id for this finding (dedupe key)
brand_id      uuid REFERENCES brands(id) ON DELETE SET NULL   -- nullable
convert_test_id text
issue_type    text NOT NULL CHECK (issue_type IN
                ('no_conversions','no_visitors','high_bounce',
                 'low_engagement','error','other'))
severity      text CHECK (severity IN ('critical','medium','low'))  -- nullable
summary       text NOT NULL   -- human line, e.g. "0 conversions in 7 days"
detail        jsonb           -- raw metrics/payload from the tool
status        text NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','actioned','dismissed'))
note          text            -- admin note on action/dismiss
detected_at   timestamptz NOT NULL DEFAULT now()   -- when the tool saw it
created_at    timestamptz NOT NULL DEFAULT now()
updated_at    timestamptz NOT NULL DEFAULT now()
updated_by    text
UNIQUE (source, external_ref)   -- dedupe; partial so NULL refs don't collide
```
Make the UNIQUE a partial index: `CREATE UNIQUE INDEX ... ON
monitoring_findings(source, external_ref) WHERE external_ref IS NOT NULL;`
(so findings without an external_ref don't all collide on NULL).

Indexes: `(brand_id)`; `(status) WHERE status='new'`; `(detected_at DESC)`.

### audit_log CHECK extension (bake in — Phase A lesson)
Phase B admin status-changes write audit rows with
`target_type='monitoring_finding'`. Extend `audit_log_target_shape_chk` with the
same DROP + re-ADD pattern migration 024 used, reproducing **024's full allowed
set plus `monitoring_finding`**:
```
(target_type = 'quality_log' AND log_entry_id IS NOT NULL) OR
(target_type IN ('test_milestone','brand','alert_event','user',
   'directive','directive_brand_status','monitoring_finding')
   AND target_id IS NOT NULL)
```
Do NOT drop any value 024 admitted — verify against 024 before re-ADD.

No seed data.

---

## 2. Ingest route — `POST /api/monitoring/findings`  (Bearer, external)

Mirror the **`/api/brands` Bearer pattern** (NOT the session pattern): validate
`Authorization: Bearer <token>` against a new env secret
**`CQIP_CONVERT_MONITORING_TOKEN`**; 401 on mismatch. Writes via `supabaseAdmin`
(service-role, bypasses RLS). This is a Next.js route handler like
`/api/sharepoint`, so **carve `/api/monitoring/*` out of the middleware matcher**
(mirror how `/api/brands` is excluded) — it must never hit the session cookie.

- Body: a single finding object OR an array (batch).
- Per finding validate `source`, `issue_type`, `summary`. Coerce/validate
  `severity`, `detected_at`.
- **Brand resolution:** the tool sends a brand string (code or jira value);
  resolve `brand_id` primary via `brand_code`, fallback `brand_jira_value`
  (mirror `buildCoverageRows`). Unresolved → `brand_id = NULL`, still ingested.
- **Upsert on `(source, external_ref)`:** new → insert with `status='new'`.
  Existing → update `summary`/`detail`/`severity`/`detected_at`/`updated_at`
  **but leave `status` untouched** if it's already `actioned`/`dismissed`
  (respect the human's decision; don't resurrect).
- **No per-ingest audit row** (external, fire-and-forget, high volume). Only
  human status-changes are audited (route §3).
- Returns `{ ok:true, ingested:N, updated:M, unresolved_brands:[...] }`.

Security note: the Bearer token is the only guard on this write endpoint —
acceptable for a token-gated machine feed (unlike the Phase D public form, which
needs Turnstile). Do not log the token; do not echo it in errors.

---

## 3. Admin status route — `PATCH /api/admin/monitoring/findings/status`

Session + admin gate, exactly like the Phase A routes. Body:
`{ finding_id, status, note? }` where `status IN ('actioned','dismissed')`.
`supabaseAdmin` write; `changed_by` server-derived; one `audit_log` row
(`target_type='monitoring_finding'`, `target_id=finding_id`, `action='UPDATE'`,
per-field). Returns `{ ok:true, changed:<n> }`.

---

## 4. UI — "Needs action" panel on the Client Library page

- Add below the directive matrix on `/dashboard/client-library`. Same
  single-fetch (add `status='new'` findings for the selected project to the
  page's data load).
- Cards: severity dot + `<brand> — <summary>` + `<source> · <convert_test_id> ·
  <detected_at ago>`. Sort by severity then `detected_at` desc.
- Admin-only controls per card: **Dismiss** / **Action** (calls §3, optimistic).
  Read-only users see the panel, no controls.
- Empty state: panel hidden (or a quiet "No open findings").
- Findings are project-scoped via `brand_id → brand.project_key`; unresolved-brand
  findings show under an "Unassigned" group so they're not lost.

---

## 5. Tests — `tests/monitoring-findings.test.ts`

`node:test` + `node:assert/strict` via `npx tsx --test`:
1. **Dedupe** — same `(source, external_ref)` posted twice → one row, fields
   updated, not duplicated.
2. **Dismissed stays dismissed** — re-ingest of a dismissed finding does not
   reset status to `new`.
3. **Brand resolution** — code and jira-value inputs resolve to `brand_id`;
   unknown → `null`, still ingested.
4. **new-count / status filter** feeding the panel is correct.

Verification bar = clicking through the running app (POST a finding via curl with
the Bearer token → it appears in the panel → dismiss → re-POST → stays
dismissed), not build-green alone.

---

## 6. Process / gates / commits

- **Jenny pre-flight REQUIRED** — migration + mutation routes + new route (the
  Bearer ingest is external-facing, so treat with the new-surface care Jenny
  applies, though it is token-gated, not public).
- Two-commit flow: **Commit 1** = this spec, docs-only. **Commit 2** = migration
  025 + the two routes + middleware carveout + panel UI + tests + atomic
  CLAUDE.md §15.5 in-flight update (§16 on ship).
- **Karen post-flight.**
- **DO NOT PUSH** — Lacey sets `CQIP_CONVERT_MONITORING_TOKEN` (Worker env + wherever
  the monitoring tool runs; never over chat relay), applies migration 025,
  smoke-tests, deploys.

**008 coupling:** this route is the surface Convert (008) consumes. Build it
source-agnostic; 008 either POSTs here with `source='convert'` or adds a thin
adapter that does. Don't build a second ingest path in 008.

---

## 7. Claudette prompt (ready to send after Jenny passes)

```
Batch 012 Client Library — Phase B (monitoring ingest). Build from
docs/batch-012-client-library-phase-b-spec.md (canonical). Two commits, no push.
Phase A must already be on main.

COMMIT 1 — docs only: land the spec doc (paths-ignore).

COMMIT 2 — code:
- Migration 025_monitoring_findings.sql: monitoring_findings table per §1,
  idempotent, RLS mirroring 009, partial-unique (source, external_ref) WHERE
  external_ref IS NOT NULL. Extend audit_log_target_shape_chk to add
  'monitoring_finding' — reproduce migration 024's FULL allowed set + the new
  value (verify against 024, drop nothing).
- POST /api/monitoring/findings: Bearer auth vs CQIP_CONVERT_MONITORING_TOKEN
  (mirror /api/brands), supabaseAdmin write, batch-capable, brand resolution
  (brand_code primary / brand_jira_value fallback), upsert on (source,
  external_ref) leaving status untouched if actioned/dismissed, no per-ingest
  audit. Carve /api/monitoring/* out of the middleware matcher like /api/brands.
- PATCH /api/admin/monitoring/findings/status: session+admin gate, one audit row
  target_type='monitoring_finding'. Mirror the Phase A routes exactly.
- "Needs action" panel on /dashboard/client-library per §4: view-for-all,
  admin-only dismiss/action, single fetch, unresolved-brand findings under
  "Unassigned".
- tests/monitoring-findings.test.ts per §5.
- Atomic CLAUDE.md §15.5 in-flight (§16 on ship).

OUT OF SCOPE (TODOs only): Jira ticketing, public bug form, per-finding ticket
links.

Jenny already pre-flighted. DO NOT PUSH. Report back → Karen.
```
