# CROSS_CLAUDE.md — Joint coordination doc for DC & AC

Shared cross-project state for the two Claude sessions working
across the CQIP program: DC (Dashboard, this repo) and AC
(Forge consumer, cqip-qa-automation repo).

**Source of truth for:** roster, cross-Claude rules, contract
surfaces, active cross-project rotations, cross-project priority,
append-only event log.

**NOT source of truth for:** project-specific state (lives in
each project's CLAUDE.md), behavior rules specific to one
project (live in that project's CLAUDE_RULES.md).

**Read at:** session start, by both DC and AC. Fetch from
`https://github.com/lacey-griffith/cqip/blob/main/docs/CROSS_CLAUDE.md`.

**Updated by:** Lacey, DC, or AC via standard docs commits.
Append-only for the event log; everything else can be updated
in place.

---

## 1. Roster

Currently active Claude sessions in the CQIP program:

| Handle | Surface | Environment | Repo |
| --- | --- | --- | --- |
| **DC** | Dashboard backend, schema, edge functions, brands API | claude.ai web/desktop | lacey-griffith/cqip |
| **AC** | Forge consumer app, Jira-side automations | claude.ai web/desktop | cqip-qa-automation |
| **Claudette** | DC's terminal partner, Dashboard repo command-line execution | Claude Code in terminal | lacey-griffith/cqip |
| **Claudia** | AC's terminal partner, Forge repo command-line execution | Claude Code in terminal | cqip-qa-automation |
| **Karen, Jenny, Radara** | Agent personas invoked by Claude Code for specific roles (reality check, spec verification, triage) | Invoked via Claude Code | both repos |

**Disambiguation rules:**
- "DC" and "AC" are the canonical handles. Don't call either
  one "CQIP Claude" — both projects share the CQIP name.
- Rule numbering is project-local. "DC §13 rule 27" ≠ "AC §13 rule 9"
  even though they cover the same concept.
- When a Claude relays a question/observation to the other Claude,
  scope context goes WITH the question.

---

## 2. Cross-Claude Rules (CC-namespace)

Behavioral rules that apply to cross-project coordination. Separate
from each project's CLAUDE_RULES.md, which governs project-local
behavior. Both DC and AC follow these.

The CC-namespace is intentionally small. Rules with asymmetric
load-bearing (one Claude's failure mode, not both) live in that
Claude's local CLAUDE_RULES.md, not here.

### 2.1 The rules

**CC1. Project name disambiguation.** AC = Forge-side, DC =
Dashboard-side. "CQIP Claude" is too ambiguous — both projects
share the CQIP name.

**CC2. Scope context with relays.** Relay questions with enough
scope context for the receiving Claude to verify the question
was addressed to the right surface. Don't assume the receiver
remembers what last week's context was.

**CC3. Persistent state lives in docs, not chat memory.** If a
cross-project agreement emerges mid-session, flag it for
commit to the appropriate doc (CLAUDE.md, CLAUDE_RULES.md,
or CROSS_CLAUDE.md depending on scope) before the session ends.

**CC4. Advisor credit.** When one Claude advises the other on
a shipped batch, the shipping Claude names the advisor in
batch notes.

**CC5. Contract-surface changes get 1-3 line relay on ship day.**
Covers: API shape, webhook payload, auth token rotation,
schema column additions visible to the consumer. Internal
refactors that don't cross the contract surface do NOT
require a relay.

**CC6. Rule numbering is project-local.** Always qualify in
cross-project relays ("DC §13 rule 27" not "rule 27"). CC-
namespace rules (this section) are the only globally-shared
numbered rules.

**CC7. Mirror requests are evaluated for fit, not auto-applied.**
If one Claude asks the other to mirror a structure that
doesn't map cleanly to the receiver's doc shape, push back
and propose a smaller / different mirror. Source-of-truth
lives where it natively belongs.

**CC8. §6 entries on status flips.** When a §3 contract
surface flips PLANNED → LIVE, or a §4 rotation goes from
pending → executed, a §6 entry is required, not optional.
The flip itself is a cross-project event. Per R18-equivalent
rules on both sides, this trigger is already mirrored —
CC8 codifies it at the CC-namespace level for new Claudes
joining the project.

**CC9. Relay repo state at an immutable ref.** Link files at a
commit SHA (`/blob/<sha>/`), not `/blob/main/` — branch-tip URLs
can serve stale CDN copies. For load-bearing state, paste
`git show` / `git log` output; the commit is primary evidence, a
fetched blob is a cache.

---

## 3. Contract Surfaces

Active and planned API contracts between the two projects.

### `/api/brands/[projectKey]/[brandCode]` — LIVE
- **Owner:** DC
- **Consumer:** AC (Forge consumer integration)
- **Shape:** brand_code, project_key, display_name, live_url_base,
  default_local_sub_areas[], client_contact_name,
  client_contact_jira_account_id, url_pattern, notes
- **Auth:** Bearer `CQIP_BRANDS_API_TOKEN`, timing-safe compare
- **Gate:** 404 returned for rows where `qa_automation_enabled = FALSE`
- **List variant:** `/api/brands?projectKey=X` returns array,
  filtered to `qa_automation_enabled = TRUE`
- **Status:** shipped, no production traffic yet. AC Phase 1.5
  deliberately dropped brand dependency (2026-05-12 scope
  revision); brands API consumption begins with AC Phase 2.
- **Last verified:** 2026-05-12 (shipped + auth verified;
  CQIP_BRANDS_API_TOKEN installed on Forge dev + prod, never
  exercised in production)

### `/api/sharepoint/*` — LIVE (Batch 009, SHIPPED 2026-05-29)
- **Owner:** DC
- **Consumer:** AC (Phase 2 of Forge consumer) — **unblocked
  as of 2026-05-29**
- **Shape:** Three read-only GET routes (all Bearer-gated):
  - `GET /api/sharepoint/folder?url=<folder-url>` → enumerate
    folder. Returns `{folder:{url,name}, xlsx:{ref,name},
    screenshots:[{ref,name,size}], warnings:[]}`. Identifies
    the single xlsx at root + `Shareable Screenshots/` images;
    ignores `assets/` and `bugs/`. `ref` is opaque
    (`<drive-id>:<item-id>`); AC passes it back verbatim.
  - `GET /api/sharepoint/xlsx?ref=<file-ref>` → parse
    `Preview Links` sheet rows 4+ (Col A→label, B→variation,
    C→national_url, D→local_url nullable). Returns
    `{filename, rows:[...]}`; does NOT return raw bytes.
  - `GET /api/sharepoint/image?ref=<file-ref>` → stream image
    bytes (25 MB cap, pass-through `Content-Type`, no cache).
  - Full shape + error matrix at
    `docs/batch-009-sharepoint-spec.md` (status header now
    SHIPPED).
- **Auth:** Bearer `CQIP_SHAREPOINT_API_TOKEN` (separate from
  brands token per DC §13 rule 27 / AC §13 rule 9 — blast
  radius separation). No query-param fallback.
- **Caching:** 60s in-memory per-Worker-instance for `/folder`
  + `/xlsx`; `?nocache=1` bypass. `/image` not cached.
- **Graph:** `Sites.Selected` scope, client-credentials flow,
  share-id folder resolution (`u!base64url` → driveItem),
  fresh token per logical request.
- **SHIP-day deviations from DESIGN:** D1 share-id resolution
  (over path-lookup; alias-drift robustness), D2
  `xlsx_not_found`→422 hard-fail (was soft-fail), D3
  `xlsx-js-style` not `xlsx` (CVE-removed 2026-04-26), D4 token
  per logical request. See spec footer + DC §16 Batch 009.
- **Smoke:** live-Azure green against Test Task 001 / WDG 07
  (12 screenshots, 6 Preview Links rows), 2026-05-29.
- **Last verified:** 2026-05-29 (SHIP smoke from DC; routes
  live on Worker)

---

## 4. Pending Rotations (live, both sides)

Mirrored from DC §15 + AC §15. Status here is authoritative for
both sides.

- [ ] **Rotate Azure client secret** —
      **Status (2026-06-01):** rotated by Carl 2026-06-01. The
      rotated-to value was saved to `.env.local`, deployed to
      the Worker via `wrangler secret put`, then accidentally
      exposed in a chat paste — so the value now live in prod is
      itself compromised. Prod verified healthy 2026-06-01 (live
      curl on `/api/sharepoint/folder`, Test Task 001 → HTTP 200,
      full enumeration: xlsx + 12 WDG 07 screenshots, warnings
      empty). NOT closed — exposure stays open until a clean
      re-rotation lands.
      **Blocked on:** Carl granting Lacey app access on the Azure
      app (client_id `6aa464c1-4eb9-4d94-b087-6eebe4fa8cb6`) for
      self-service rotation. Requested 2026-06-01; ETA
      days-to-weeks.
      **Owner:** Lacey. **Trigger:** access granted → rotate +
      `wrangler secret put` + re-verify 200 on
      `/api/sharepoint/folder`.
      **Interim blast radius:** bounded — `Sites.Selected` /
      CRO site only / read-only; the gate token
      `CQIP_SHAREPOINT_API_TOKEN` is NOT exposed.
      Surfaces: Worker secret (single surface).
      **Last verified:** 2026-06-01 (prod 200 on
      `/api/sharepoint/folder`)
- [ ] **Rotate CQIP_BRANDS_API_TOKEN** —
      Hygiene rotation. Not known compromised. In circulation
      since brands API initial setup (Batch 005.13-005.14
      timeframe). Untouched since pre-positioning on Forge
      dev + prod 2026-05-12.
      Surfaces: Worker secret, DC local .env, Forge dev
      variable, Forge prod variable. Atomic rotation across
      all four required.
      **Last verified:** 2026-05-12 (installed on Forge dev
      + prod, never exercised)
- [ ] **CQIP_SHAREPOINT_API_TOKEN rotation drill** (planned) —
      Post-Batch-009-ship no-op rotation drill across all
      four surfaces (Worker · Forge dev · Forge prod · DC
      `.env.local`). Validates the §13 r27 / r9 rotation
      atomicity pattern end-to-end before production
      pressure exists. ~30-min synchronized window with DC,
      AC, and Lacey. Schedule pre-Batch-009-ship per AC Q3
      response (2026-05-26).
      Drill shape: DC ships v1 with token A → both sides
      verify token A works (curl + Forge dev panel load) →
      rotate to token B atomically within window → verify
      token B works → done.

Rotation execution: Lacey kicks off; DC + AC walk their respective
sides within a single deploy window per DC §13 rule 27 / AC §13
rule 9.

**Removed from this section (2026-05-26):** "Reclaim Owner access
on Azure app" — never the right framing. Lacey has always been
Owner; the historical block was edit access by F92 IT policy.
The actual technical prereqs (Sites.Selected admin consent +
per-site CRO grant) were verified already in place on 2026-05-26.
See §6 entry for full context.

---

## 5. Cross-Project Priority Order

Spans both projects. Last locked 2026-06-04.

| # | Owner | Item | Status |
| --- | --- | --- | --- |
| 1 | DC | 5.19 SPL multi-page presence sweep | ✅ done |
| 2 | DC | Batch 005.25 brand dropdown fix | ✅ done |
| 3 | DC | Batch 009 SharePoint integration | ✅ SHIPPED 2026-05-29 |
| 4 | AC | Phase 1.5 implementation | parallel with DC 009 |
| 5 | DC | Batch 011 Node 24 + public /api/health probe | ✅ SHIPPED 2026-05-27 |
| 6 | DC | Batch 010 Coverage pipeline visibility | ✅ SHIPPED + DEPLOYED 2026-06-04 |
| 7 | AC | Phase 2 (after DC 009 ships) | ✅ unblocked 2026-05-29 |
| 8 | DC | Batch 006 Teams dispatch | next open DC batch |
| 9 | DC | Batch 007 Custom Jira Boards | post-Phase-2 |
| 10 | DC | Batch 008 Convert.com automation | last |

**Scope corrections logged 2026-06-04** (the prior table was locked
2026-05-13, before two batches were re-scoped):
- **Batch 011** is the Node 24 CI bump + public dependency-free
  `/api/health` probe — NOT the "Coverage redesign" the old table
  named. Shipped 2026-05-27.
- **Batch 010** is Coverage **pipeline visibility** (live-JQL Output +
  Pipeline split tables, overlay toggles, per-count drawer) — NOT the
  "UI polish" the old table named. Shipped + deployed 2026-06-04,
  reprioritized ahead of Batch 006. DC-internal: the new
  `/api/coverage/pipeline` route is cookie-bound session auth and is
  NOT consumed by AC, so no §3 contract-surface or §6 event-log entry
  is warranted — full detail lives in the DC CLAUDE.md §16 per this
  doc's project-internal scoping rule.
- **Batch 006** (Teams dispatch) is now the next open DC batch.

---

## 6. Append-Only Event Log

Cross-project events worth durable record. Newest at top.
Covers events from 2026-04-23 forward (start of the drift-
prevention era). Project-internal events stay in each
project's CLAUDE.md §16.

### 2026-06-01 — AZURE_CLIENT_SECRET rotated; rotated-to value exposed, prod verified healthy, clean re-rotation blocked on app access

Precise sequence:
1. Original Azure client secret (compromised since the
   2026-05-02/03 verification screenshots) rotated by Carl
   2026-06-01.
2. New secret saved to `.env.local`, deployed to the Worker via
   `wrangler secret put` — then accidentally exposed in a chat
   paste. So the value now live in prod is itself compromised.
3. Prod VERIFIED HEALTHY 2026-06-01: live curl on
   `/api/sharepoint/folder` (Test Task 001) → HTTP 200, full
   enumeration (xlsx + 12 WDG 07 screenshots, warnings empty).
   Both the gate token path and the Azure-secret → Graph path
   are working.
4. Clean re-rotation BLOCKED: needs Carl to grant Lacey app
   access on the Azure app (client_id
   `6aa464c1-4eb9-4d94-b087-6eebe4fa8cb6`). Requested
   2026-06-01; ETA days-to-weeks.

Tracked **open** (exposure live until clean re-rotation), not
closed — see §4. Prod confirmed up (200). Interim blast radius
bounded: `Sites.Selected` / CRO site only / read-only; the gate
token `CQIP_SHAREPOINT_API_TOKEN` is NOT exposed. Logged for
cross-Claude visibility because AC Phase 2 is the first
production traffic on these routes.

### 2026-06-01 — AC: test mode fully ended (relayed)

AC/Forge test mode ended in v2.15.0 (dev): the `TEST_MODE`
eligibility gate was dropped (commit b5726f6), and the panel is
hidden from non-CRO accounts via `displayConditions` (commit
8c78d19). AC retired the `ALLOWED_TEST_TICKETS` recon and the
forge-vars overwrite caution. DC confirms no live DC/CC reference
assumes test mode is still active.

### 2026-06-01 — CC9 added: relay repo state at immutable ref

Trigger: a 2026-06-01 fetch of a `/blob/main/` URL served a
2026-05-12 cached copy (stale CDN at branch tip). CC9 now
requires immutable-ref links (`/blob/<sha>/`) and pasted
`git show` / `git log` output for load-bearing state.

### 2026-05-29 — Batch 009 SharePoint integration SHIPPED (§3 PLANNED → LIVE)

**Per CC8: contract surface `/api/sharepoint/*` flipped
PLANNED → LIVE — this entry is mandatory.**

DC shipped the read-only Microsoft Graph proxy. Three GET
routes live under `/api/sharepoint/*` (`/folder` enumerate,
`/xlsx` parse Preview Links, `/image` stream bytes),
`Sites.Selected` scope, 60s in-memory cache, share-id folder
resolution, Bearer-gated on `CQIP_SHAREPOINT_API_TOKEN`,
middleware carveout for /api/sharepoint + /api/brands. No DB
migration (stateless). Live-Azure smoke green against Test
Task 001 / WDG 07 (12 screenshots, 6 Preview Links rows).

**Four SHIP-day deviations from the 2026-05-13 DESIGN**
(folded into the spec doc):
- **D1** — share-id folder resolution
  (`/shares/{u!base64url}/driveItem`) replaced the spec's
  path-lookup (`/drive/root:/{path}:/children`). Path-lookup
  silently 404s on the `Shared Documents` vs `Documents`
  library-alias drift; share-id is robust to URL shape.
- **D2** — `xlsx_not_found` flipped from soft-fail (warning,
  200) to hard-fail (422, context `url`) per Lacey, so AC
  gates Phase 2 on a real status code.
- **D3** — parser uses `xlsx-js-style` (already in deps,
  read-compatible superset), not the `xlsx` package the spec
  named — `xlsx` was removed 2026-04-26 (DC Batch 004.2) over
  unpatched CVEs. No new build-time dependency.
- **D4** — "fresh token per call" clarified to "fresh token
  per logical request, reused across the 2-3 Graph sub-calls,
  discarded at request end." No cross-request caching.

**Cross-project impact:** AC Phase 2 is now unblocked (§5 row
8). AC Q1 flagged that Phase 2 will exercise BOTH the brands
API and the sharepoint API in production for the first time
in a single ship — the curl-examples mitigation and the
no-op rotation drill on `CQIP_SHAREPOINT_API_TOKEN` (AC Q2/Q3)
remain the agreed risk controls. `AZURE_CLIENT_SECRET` hygiene
rotation stays queued (Worker-only, Carl-executable, Fri/Mon
target — §4 unchanged).

Commits: c7afede + 98a6133 (Step 2) + the SHIP docs commit.
Advisor credit: AC (day-one needs clarification), Jenny +
Karen (five-finding pre-ship review).

### 2026-05-26 — Batch 009 Azure prereqs verified + CC-namespace established

**Verification.** DC + Lacey ran end-to-end Microsoft Graph
verification against the CRO SharePoint site:

  1. Token endpoint            POST /oauth2/v2.0/token  → 200
  2. Site metadata             GET /sites/...:/sites/CRO → 200
  3. Drive enumeration         GET /sites/{id}/drive/root/children → 200

Full folder + file listing returned. JSON confirmed
app_displayname = "CQIP Dashboard - SharePoint Integration"
and selectedsites = 1 (CRO only, matching Sites.Selected
design).

**Translation:** Both consent layers (Sites.Selected admin
consent + per-site CRO grant) were already in place,
configured in or before the 2026-05-02 / 2026-05-03 Postman
verification window. The 23-day "Azure prereqs gate Batch 009"
status was doc-vs-reality drift, not a real block.

**CC-namespace established.** CC1-CC8 added to §2 of this
doc. CC1-CC7 promote the original 2026-05-11/12 handoff
conventions to a numbered namespace. CC8 (formerly CC11
in DC's initial draft) covers §6 entries on status flips.

Three rules originally proposed for the CC-namespace
(stale-status re-verification, last-verified timestamps,
blocker reality-check) moved to DC CLAUDE_RULES.md local
per AC's namespace-fit review: the failure modes are
DC-asymmetric, and codifying habits that already work
risks turning judgment into checklist (AC framing,
2026-05-26).

**Doc updates landed in same commit (Claudette executing):**
- §2 (this doc) — new CC1-CC8 rules section
- §3 (this doc) — `/api/sharepoint/*` updated to reflect
  verified Azure setup + Last verified field added +
  first-ever ship risk note
- §3 (this doc) — `/api/brands/*` Last verified field added
  + Phase 1.5 brand-dependency-drop context
- §4 (this doc) — "Reclaim Owner access" bullet removed
  (wrong framing from inception); Azure secret rotation
  reframed as hygiene-only Worker-only; CQIP_SHAREPOINT_
  API_TOKEN rotation drill item added per AC Q3
- DC CLAUDE.md §15 Batch 009 prereqs block — rewritten
- DC CLAUDE.md §15 "Pending rotations" — Owner-reclaim
  bullet removed; secret rotation reframed
- DC CLAUDE.md §13 rule 30 — secrets list patched
- DC CLAUDE_RULES.md — three new rules added covering
  stale-status re-verification, last-verified timestamps,
  blocker reality-check (next-available R-numbers per
  Claudette)
- docs/batch-009-sharepoint-spec.md §9 — replaced with
  2026-05-26 verification evidence
- AC §15 mirror update will follow as a separate AC-side
  commit, citing this CROSS_CLAUDE state verbatim

**Status flip:** Batch 009 moves from "DESIGN locked, SHIP
gated on Azure prereqs" → "DESIGN locked, build can start
anytime, hygiene rotation deferred to 2026-06-01."

**Lesson encoded:** A 5-minute curl on 2026-05-13 (the
DESIGN-lock date) would have caught the drift before it
became a 23-day phantom block. The three new DC-local
rules formalize the preventive pattern without exporting
it as cross-project ceremony.

**Action implications for AC:** Phase 2 unblocking is now
imminent — DC build start gates AC Phase 2, not Azure
prereqs. CQIP_SHAREPOINT_API_TOKEN issuance moves from
"future" to "imminent." AC §15 patch pending (see above).
Separate AC prompt sent 2026-05-26 with Phase 1 readiness
questions; AC responses incorporated into §3 and §4 of
this doc (curl-examples-doc mitigation, no-op rotation
drill).

### 2026-05-19 — Azure secret rotation: API path also walled

Tried Graph addPassword per Carl's recommendation. 403
Authorization_RequestDenied. Carl hits same wall. Likely
cause: servicePrincipalLockConfiguration on the app
(visible in GET response, credentialsWithUsageSign: true).
Carl working on PIM-elevated access.

Don't re-try the API path expecting different results.
Rotation stays blocked until F92 institutional unlock.

**Status update 2026-05-26:** F92 institutional unlock has
progressed; Carl can rotate via available path during the
week of 2026-06-01. §4 entry carries the live status; this
log preserves the historical incident.

### 2026-05-15 — AC: R18 mirror + Phase 1.5 deploy to development

AC mirrored DC's R18 in commit bbfaeee (cqip-qa-automation repo).
R16 fit-adjustment: dropped "Radara" from the agent-exclusion
bullet since AC has no Radara agent. All other R18 phrasing kept
verbatim. Triggers this §6 entry per R18 itself.

Same-day, AC also deployed Phase 1.5 (paste-and-format QA comment
generation) to fusion92.atlassian.net development at v2.3.0. Ship
chain: implementation fe67c74, @forge/react TextArea casing fix
8bf699f (Karen pre-deploy smoke check caught a silent-failure bug),
nodejs20.x → nodejs22.x runtime bump f42e047 (Atlassian
deploy-blocked nodejs20.x as of 2026-05-06; clean bump confirmed
via reconnaissance research). Manual verification passed on
NBLYCRO-1473 with real client workflow — paste, generate, [TEST]
prefix, onFocus auto-select, Jira-paste end-to-end. Karen audit:
pass-with-conditions (regex deviation + failure-shape kind
extension accepted as-shipped). Production untouched (still
Phase 0 from 2026-04-27); promotion deferred until Phase 1.5 has
soak time on dev with real workflow.

Pointer: AC commit bbfaeee (R18 mirror + docs), SPEC_phase1.md v0.3,
AC CLAUDE.md §16 entries "Phase 1.5 implementation — 2026-05-15" +
"Phase 1.5 implementation + deploy — 2026-05-15."

### 2026-05-15 — DC R18 added: §6 update triggers codified

DC added R18 to CLAUDE_RULES.md. Rule specifies when this §6 log
gets an entry (contract-surface changes, cross-Claude decisions,
ship of work the other side consumes) and when it doesn't (internal
refactors, docs hygiene, agent-only work).

Mirror request pending to AC/Claudia. Verbatim text recommended;
DC + Lacey didn't know AC-side terminology well enough to fit-adjust.

Trigger for the rule: DC missed a §6 entry for Batch 009 DESIGN
lock on 2026-05-13. Retroactive entry below.

### 2026-05-13 — Batch 009 SharePoint integration DESIGN locked

DC + Lacey + AC (consulted via Lacey-relay) ran a design session
for Batch 009. Five architecture decisions locked:

  1. v1 scope        read-only (write deferred)
  2. Graph scope     Sites.Selected
  3. Endpoint shape  3 routes — /api/sharepoint/folder, /xlsx, /image
  4. Sync semantics  structured response + 60s per-call cache
  5. Failure         fresh Graph token per call · 401→502 with
                     sharepoint_auth envelope · 1 retry on 5xx ·
                     CQIP_SHAREPOINT_API_TOKEN rotates atomically
                     per DC §13 r27

Full spec at docs/batch-009-sharepoint-spec.md (commit ce397fa).
CLAUDE.md §14 + §15 updated atomically in same commit.

SHIP still gated on Azure Owner reclaim + client secret rotation
(Lacey-side, unchanged). §3 of this doc remains PLANNED for
/api/sharepoint/* — flips to LIVE at SHIP, not at DESIGN, per
spec §11.

**Historical note added 2026-05-26:** The "SHIP gated on Azure
Owner reclaim" framing in this entry was wrong even at the time
of writing. Per 2026-05-26 verification, prereqs were already
met. Preserving the entry as-written per append-only rule; see
2026-05-26 entry for correction.

AC's day-one Phase 2 needs surfaced via Lacey-relay are folded
into the spec: folder enumeration with filtering rules, xlsx
Preview Links parsing, image bytes with 25MB cap, error codes
distinguishing auth vs not-found, soft-fail on empty/missing
Shareable Screenshots/ folder.

### 2026-05-13

- **DC** shipped Batch 005.25: brand dropdown fix + historical
  client_brand normalization. Closes 5.19 sweep findings F1
  (dropdowns sourced from DISTINCT quality_logs.client_brand,
  excluding SPL) + F2 (raw-code historical strings duplicating
  canonical jira_value entries). New shared `<BrandSelector>`
  component at `components/filters/brand-selector.tsx`; one-shot
  `scripts/normalize-client-brand.ts` ran successfully (32
  rows updated, 14 already canonical, zero unmatched). No
  migration, no schema change. Commits: c6cb40c7
  (Commit 1, normalize script), 35f0dfc (Commit 2,
  refactor + atomic docs).
- **DC** noted three env-loading patterns across
  cqip/scripts/ (Node --env-file, manual fs reads, dotenv
  package). Filed as backlog hygiene; not addressed in 005.25.
- **DC** noted backfill-brands.ts and backfill-milestones.ts
  do not write audit_log rows (latent §13 rule 2 gap). Not
  propagated by the new normalize script. Filed as backlog
  hygiene; not addressed in 005.25.

### 2026-05-12
- **AC** scope shift: Phase 1 (template-with-placeholders) →
  Phase 1.5 (paste-and-format). SPEC_phase1.md drafted at AC
  repo root, 424 lines, locked from three real raw xlsx
  pastes. Jenny review pending. No contract-surface impact.
  Source-of-truth for Forge phasing remains AC repo.
- **AC** clarification: xlsx Col D (local URLs) is USED
  verbatim in output, not ignored. Brand-config-driven
  sub-area curation moved to Phase 3+ backlog on AC side.
  No DC-side change needed (DC does not document Col D
  handling).
- **AC** noted overgeneralization of AC §12 rule 5
  ("contract-surface changes get explicit relay") into
  "all scope changes get mirrored." Corrected: scope
  changes that don't cross the contract surface go in
  joint doc, not in DC CLAUDE.md.
- **DC** shipped Batch 005.23: §15 restructure into named
  subsections (Forge / SharePoint / Pending rotations),
  new CLAUDE_RULES.md companion file at repo root.
  15 behavior rules covering session opening, comms,
  state, ship discipline, drift prevention. Commits
  6d28753 + a40cc13.
- **DC + AC** added §13 rules / §12 rules mirroring across
  both repos: secret rotation atomicity, verbatim brand
  strings. CQIP_BRANDS_API_TOKEN installed on Forge dev +
  prod variables.
- **DC** shipped Batch 005.24: this joint doc at
  /docs/CROSS_CLAUDE.md + R16/R17 addition to CLAUDE_RULES.md
  (mirror requests evaluated for fit; fetch joint doc at
  session start). AC endorses; AC CLAUDE_RULES.md draft
  (pending) will mirror R16.
- **DC** ran 5.19 SPL multi-page presence sweep. Six surfaces
  swept; four PASS (coverage, alerts panel, chart drilldowns,
  audit page) and two FAIL (/logs + /reports brand dropdowns
  exclude newly-onboarded brands without active quality_logs).
  Two findings captured: F1 (data-driven dropdown excludes
  SPL) and F2 (pre-Phase-1 brand-code duplicates).
- **DC** noted that SPL's audit log contains soft-deleted
  historical quality_logs entries (SPLCRO-107, SPLCRO-108).
  Confirmed with Lacey 2026-05-12: these were intentional
  test-cleanup deletions during Phase 1 verification, not
  real CRO work. Logging for future-DC clarity so any future
  sweep doesn't surface them as anomalies.
- **DC** shipped Batch 005.25 scoping (this commit): 5.19
  closed in §15, Batch 005.25 entry added covering brand
  dropdown source-of-truth refactor + idempotent
  client_brand backfill script + code-grep verifications.
  Priority order updated; 005.25 slots between 5.19 and 009.
- **AC** shipped CLAUDE_RULES.md at repo root
  (cqip-qa-automation), 17 rules mirroring DC's
  CLAUDE_RULES.md from Batch 005.24. R1/R3/R7/R11/R12
  adjusted for AC scope per R16 (mirror-with-fit-check).
  Closes the "AC CLAUDE_RULES.md draft (pending)" item
  above. AC commit: 55753aa.

### 2026-05-11 — cross-Claude coordination day
- **DC** shipped Batch 005.21: SharePoint integration
  groundwork docs. SharePoint state recorded in §15
  (Azure app provisioned, Postman-verified 2026-05-02/03,
  Owner reclaim + secret rotation pending). Batch 009
  entry placeholder in §15 with locked auth decisions
  + deferred architecture list. Commit 68fe6c0.
- **AC** shipped 8eac0f9: Forge-side CLAUDE.md created
  (716 lines). AC §13 rule 9 mirrors DC §13 rule 27
  (secret rotation atomicity); AC §13 rule 10 mirrors
  DC §13 rule 28 (verbatim brand strings); AC §13
  rule 11 captures DC Batch 005.22 single-brand model.
  ALLOWED_TEST_TICKETS updated to ['NBLYCRO-1380',
  'NBLYCRO-200']. AC Phase 1 scope revised to drop URL
  transformation, Live QA section, QA Link Types field,
  QA param derivation. Preview-links-only output.
- **DC** drift incident: stale CLAUDE.md context (3
  commits behind). AC unaware. Caught via schema-column
  references DC didn't recognize. Resolved by re-attaching
  current CLAUDE.md. Handoff conventions 1-6 emerged
  from the resolution.
- **DC** confabulation incident: invented "Sweep Claude"
  doing 5.19 based on misread of an earlier sync message.
  No real Sweep Claude existed. Resolved by Lacey naming
  the confusion directly. Led to DC R10 in CLAUDE_RULES.md
  (no confabulation about other Claudes).
- **Priority order locked across both projects:** 5.19
  → DC 009 → DC 006 → DC 010 → DC 011 → DC 007 → DC 008,
  with AC Phase 1.5 parallel to DC 009 design and AC
  Phase 2 gated on DC 009 ship.

### 2026-05-07
- **DC** shipped Batch 005.22 Phase 1: project-aware brand
  resolution refactor. Migration 019 added projects
  columns (brand_model enum, brand_jira_field_id,
  default_brand_id). JIRA_FIELD_MAP.nbly_brand removed
  (closes audit Q2). Single-brand projects skip Jira-field
  extraction and use projects.default_brand_id directly.
  SPL brand jira_value normalized from 'SPL' → 'SPL -
  Spotloan' (CODE - Display Name format). DC §13 rule 28
  added (brand resolution contract + Option γ writeback
  rationale). Closes SPL ingestion gap. Commit bc9ee66.
- **DC** drought-evaluator hotfix: CQIP_DROUGHT_AUTH_KEY
  drift between Supabase secrets and pg_cron command
  persisted May 1-7 (7 days silent failure). Caught
  during unrelated sweep. DC §13 rule 27 added (secret
  rotation atomicity) — formalized that any custom shared
  secret must rotate atomically across both sides.
  Backlog item DC 5.21 (cron-silence monitor) created
  to surface silent failures faster. Commits 11f4ab2
  + 600b74c.
- **DC** shipped Batch 005.20: brand-create admin UI
  on /dashboard/settings/coverage. Closes audit Q1
  (brand seeding no longer SQL-only). Third call site
  of getChangedBy() helper per DC §13 rule 19.

### 2026-05-06
- **DC** shipped Batch 004.99: multi-client readiness
  audit at docs/multi-client-readiness.md. ~1100 lines.
  Identified all NBLY-hardcoded assumptions across CQIP.
  Findings: 5 Medium UI copy strings (NBLYCRO-coded
  placeholders), JIRA_FIELD_MAP.nbly_brand cosmetic
  hardcode (deferred to Phase 1), jira-webhook JQL
  filter (Critical, Lacey-side). Onboarding + offboarding
  playbooks at §8/§9. Hard prereq for Batch 007 (Boards).
- **DC** SPL onboarded: projects row + brands row
  created via SQL for SPLCRO / SPL. Ingestion did NOT
  yet work — customfield_12220 was still hardcoded
  everywhere and SPL is single-brand with no brand
  field. Ingestion gap closed the next day by Batch
  005.22 Phase 1.
- **Jira-side** automations configured by Lacey: "Clear
  QA Fields On Transition" + "Manually Clear QA Fields"
  in the Neighborly CRO space. Cross-project surface
  because AC's Forge app interacts with the same Jira
  custom fields these flows manage. Owner: Lacey.
  Actor: Automation for Jira.

### 2026-05-02 / 2026-05-03
- **DC + Lacey** SharePoint integration Postman
  verification. Azure app "CQIP Dashboard - SharePoint
  Integration" (client_id 6aa464c1-4eb9-4d94-b087-
  6eebe4fa8cb6) provisioned. Microsoft Graph
  reachability confirmed end-to-end against CRO
  SharePoint site. Azure client secret visible in
  verification screenshots (compromised-by-default
  until rotated — tracked in §4 above).

### 2026-04-23 — JIRA_API_TOKEN expiry incident
- **DC** Jira API token silently expired. Sync edge
  function returned 401s. No alert fired (no
  token-expiry monitoring existed). Caught by Lacey
  noticing missing data in dashboard. Resolution:
  manually rotated token, redeployed.
- **Why this matters for cross-project:** Established
  the "silent breakage" pattern that drove every
  drift-prevention rule that followed:
  - Created backlog item 5.2 (Jira token-expiry
    monitoring)
  - Foreshadowed DC §13 rule 27 (secret rotation
    atomicity) — same pattern of silent failure
  - Foreshadowed DC R10 / AC equivalent (no
    confabulation) — silent failures hide behind
    confident assumptions
- **Cross-project takeaway:** any shared secret or
  contract surface that can silently break must have
  monitoring or be rotated atomically. The 7-day
  drought drift on 2026-05-07 and the 3-commits-stale
  drift on 2026-05-11 are both echoes of this
  original incident.

---

*Last updated: 2026-06-01 | CC9 added (relay repo state at an
immutable ref — triggered by a stale `/blob/main/` CDN fetch).
AC test mode fully ended (v2.15.0 dev) logged to §6.
AZURE_CLIENT_SECRET incident tracked in §4 + §6: rotated
2026-06-01, rotated-to value exposed in chat and now live in
prod, prod verified healthy (200 on `/api/sharepoint/folder`),
clean re-rotation OPEN — blocked on Carl granting Lacey Azure
app access. Prior (2026-05-29): Batch 009 SharePoint SHIPPED, §3
flipped PLANNED → LIVE. Prior (2026-05-26): CC-namespace
established (CC1-CC8); Batch 009 Azure prereqs verified
end-to-end; CQIP_SHAREPOINT_API_TOKEN rotation drill added to §4
per AC Q3.*
