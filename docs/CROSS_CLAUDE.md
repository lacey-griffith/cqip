# CROSS_CLAUDE.md — Joint coordination doc for DC & AC

Shared cross-project state for the two Claude sessions working
across the CQIP program: DC (Dashboard, this repo) and AC
(Forge consumer, cqip-qa-automation repo).

**Source of truth for:** roster, handoff conventions, cross-Claude
rules, contract surfaces, active cross-project rotations,
cross-project decisions, append-only event log.

**NOT source of truth for:** project-specific state (lives in
each project's CLAUDE.md), behavior rules (live in each project's
CLAUDE_RULES.md).

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

**CC1. Project name disambiguation.** AC = Forge-side, DC =
Dashboard-side. "CQIP Claude" is too ambiguous — both projects share
the CQIP name.

**CC2. Scope context with relays.** Relay questions with enough
scope context for the receiving Claude to verify the question
was addressed to the right surface. Don't assume the receiver
remembers what was last week's context.

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

**CC8. Stale-status re-verification.** Any §3 contract surface
or §4 pending rotation in a non-terminal state for more than
14 days must be re-verified before the next planning decision
that depends on its status. "Re-verification" means a real
end-to-end check (curl, smoke test, API call) — not a re-read
of the doc. Add results to "Last verified" field on the entry.
*Rationale: established 2026-05-26 after Batch 009 was treated
as Azure-blocked for 23 days when the prereqs had actually
been met before 2026-05-02.*

**CC9. Last-verified timestamps on status-bearing entries.**
Every §3 and §4 entry carries a "Last verified" date and a
"Re-verify if" trigger (time-elapsed OR external event).
Status without a timestamp is presumed stale. When a Claude
reads a status entry and acts on it, that Claude is
responsible for confirming the timestamp is fresh enough
for the decision being made.

**CC10. Blocker reality-check before planning around it.**
When a §15 / §4 / §6 item has been "blocked on external
action" for more than 7 days, run a 5-minute reality check
before treating the block as still real. The check goes in
the §6 log regardless of outcome (block confirmed OR block
dissolved). *Companion rule to CC8 — CC8 governs status
entries, CC10 governs blocker entries specifically.*

**CC11. §6 entries on status flips.** When a §3 contract
surface flips PLANNED → LIVE, or a §4 rotation goes from
pending → executed, a §6 entry is required, not optional.
The flip itself is a cross-project event. Per R18-equivalent
rules on both sides, this trigger is already mirrored —
CC11 codifies it at the CC-namespace level for new Claudes
joining the project.

---

## 3. Handoff Conventions (legacy, now promoted)

The seven conventions originally locked Monday 2026-05-11 through
Tuesday 2026-05-12 have been promoted to CC1-CC7 above. This
section is retained as a pointer for the historical context and
the locking dates; see the 2026-05-11 / 2026-05-12 §6 entries
for the original conversation. Future additions go in §2.

---

## 4. Contract Surfaces

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
- **Status:** shipped, no production traffic yet (AC not live)
- **Last verified:** 2026-05-12 (shipped + auth verified;
  CQIP_BRANDS_API_TOKEN installed on Forge dev + prod)
- **Re-verify if:** AC reports going live OR >30 days elapsed
  AND AC still pre-launch

### `/api/sharepoint/*` — PLANNED (Batch 009)
- **Owner:** DC
- **Consumer:** AC (Phase 2 of Forge consumer)
- **Shape:** Three GET routes per spec —
  `/api/sharepoint/folder`, `/xlsx`, `/image`. Full shape at
  `docs/batch-009-sharepoint-spec.md` (commit ce397fa).
- **Auth:** Bearer `CQIP_SHAREPOINT_API_TOKEN` (separate from brands
  token per DC §13 rule 27 / AC §13 rule 9 — blast radius separation)
- **Azure setup:** Verified end-to-end 2026-05-26 (see §6 entry).
  Sites.Selected admin consent + per-site CRO grant both already
  in place. Token, site metadata, and drive enumeration all 200.
- **Status:** PLANNED. DC build can start anytime (no Azure
  prereq blocks remaining). Flips to LIVE at SHIP, not at DESIGN,
  per spec §11.
- **Last verified:** 2026-05-26 (three-operation Graph curl from
  Lacey's terminal; full results in §6)
- **Re-verify if:** DC starts Batch 009 build (re-curl as smoke
  test) OR AZURE_CLIENT_SECRET rotates OR >30 days elapsed

---

## 5. Pending Rotations (live, both sides)

Mirrored from DC §15 + AC §15. Status here is authoritative for
both sides.

- [ ] **Rotate Azure client secret** —
      Compromised-by-default per 2026-05-02/03 verification
      screenshots and the 2026-05-26 verification curl. Worker-only
      rotation per Batch 009 spec §7 (no AC coordination needed).
      Carl-executable; institutional API-path block persists per
      2026-05-19 §6 entry (servicePrincipalLockConfiguration).
      Target rotation window: week of 2026-06-01 (Lacey returns
      from travel; Carl available).
      Surfaces: Worker secret (single surface).
      **Last verified:** 2026-05-26 (secret still functional;
      Graph calls succeeding)
      **Re-verify if:** rotation executed (flip to terminal +
      §6 entry) OR >14 days elapsed without rotation
- [ ] **Rotate CQIP_BRANDS_API_TOKEN** —
      Hygiene rotation. Not known compromised. In circulation since
      brands API initial setup (Batch 005.13-005.14 timeframe).
      Surfaces: Worker secret, DC local .env, Forge dev variable,
      Forge prod variable. Atomic rotation across all four required.
      **Last verified:** 2026-05-12 (installed on Forge dev + prod)
      **Re-verify if:** rotation executed OR brands API goes live
      with production traffic OR >60 days elapsed

Rotation execution: Lacey kicks off; DC + AC walk their respective
sides within a single deploy window per DC §13 rule 27 / AC §13 rule 9
(also see CC-namespace: §13 rules cross-reference).

**Removed from this section (2026-05-26):** "Reclaim Owner access
on Azure app" — never the right framing. Lacey has always been
Owner; the historical block was edit access by F92 IT policy.
The actual technical prereqs (Sites.Selected admin consent +
per-site CRO grant) were verified already in place on 2026-05-26.
See §6 entry for full context.

---

## 6. Cross-Project Priority Order

Spans both projects. Last locked 2026-05-13.

| # | Owner | Item | Status |
| --- | --- | --- | --- |
| 1 | DC | 5.19 SPL multi-page presence sweep | ✅ done |
| 2 | DC | Batch 005.25 brand dropdown fix | ✅ done |
| 3 | DC | Batch 009 SharePoint integration | next (unblocked 2026-05-26) |
| 4 | AC | Phase 1.5 implementation | parallel with DC 009 |
| 5 | DC | Batch 006 Teams dispatch | post-009 |
| 6 | DC | Batch 010 UI polish | post-006 |
| 7 | DC | Batch 011 Coverage redesign | post-010 |
| 8 | AC | Phase 2 (after DC 009 ships) | gated on DC 009 |
| 9 | DC | Batch 007 Custom Jira Boards | post-Phase-2 |
| 10 | DC | Batch 008 Convert.com automation | last |

---

## 7. Append-Only Event Log

Cross-project events worth durable record. Newest at top.
Covers events from 2026-04-23 forward (start of the drift-
prevention era). Project-internal events stay in each
project's CLAUDE.md §16.

### 2026-05-26 — Batch 009 Azure prereqs verified + doc cleanup

DC + Lacey ran end-to-end Microsoft Graph verification against
the CRO SharePoint site:

  1. Token endpoint            POST /oauth2/v2.0/token  → 200
  2. Site metadata             GET /sites/...:/sites/CRO → 200
  3. Drive enumeration         GET /sites/{id}/drive/root/children → 200

Full folder + file listing returned (`ADM Comms`, `CRO Client
Comms`, `Strategy`, etc., plus xlsx/docx files with download
URLs). JSON confirmed app_displayname = "CQIP Dashboard -
SharePoint Integration" and selectedsites = 1 (CRO only,
matching Sites.Selected design).

**Translation:** Both consent layers (Sites.Selected admin
consent + per-site CRO grant) were already in place, configured
in or before the 2026-05-02 / 2026-05-03 Postman verification
window. The 23-day "Azure prereqs gate Batch 009" status was
doc-vs-reality drift, not a real block. Whoever did the setup
in early May — likely Carl — did the full configuration.

**Doc updates landed in same commit (Claudette executing):**
- §4 (this doc) — "Reclaim Owner access" bullet removed.
  Framing was wrong from the start: Lacey has always been
  Owner; the historical block was edit access by F92 IT
  policy, not Owner status.
- §4 (this doc) — Azure client secret rotation rewritten:
  no longer prereq for Batch 009, hygiene-only, Worker-only
  rotation, Carl-executable, target window of 2026-06-01.
- §3 (this doc) — `/api/sharepoint/*` entry updated to
  reflect verified Azure setup + Last verified field added.
- §2 / CC-namespace — Cross-Claude rules CC1-CC11 added,
  including CC8 (stale-status re-verification), CC9
  (last-verified timestamps), and CC10 (blocker reality-
  check) — direct lessons from today's finding.
- DC CLAUDE.md §15 Batch 009 prereqs block — rewritten.
- DC CLAUDE.md §15 "Pending rotations" — Owner-reclaim
  bullet removed; secret rotation reframed.
- DC CLAUDE.md §13 rule 30 — secrets list patched for
  005.31a + this update.
- docs/batch-009-sharepoint-spec.md §9 — replaced with
  2026-05-26 verification evidence.

**Status flip:** Batch 009 moves from "DESIGN locked, SHIP
gated on Azure prereqs" → "DESIGN locked, build can start
anytime, hygiene rotation deferred to 2026-06-01."

**Lesson encoded:** A 5-minute curl on 2026-05-13 (the
DESIGN-lock date) would have caught the drift before it
became a 23-day phantom block. CC8 + CC10 are the
preventive rules.

**Action implications for AC:** Phase 2 unblocking is now
imminent — DC build start gates AC Phase 2, not Azure
prereqs. CQIP_SHAREPOINT_API_TOKEN issuance moves from
"future" to "imminent." See separate AC prompt sent
2026-05-26 with Phase 1 readiness questions.

### 2026-05-19 — Azure secret rotation: API path also walled

Tried Graph addPassword per Carl's recommendation. 403
Authorization_RequestDenied. Carl hits same wall. Likely
cause: servicePrincipalLockConfiguration on the app
(visible in GET response, credentialsWithUsageSign: true).
Carl working on PIM-elevated access.

Don't re-try the API path expecting different results.
Rotation stays blocked until F92 institutional unlock.

**Status update 2026-05-26:** Per Lacey, F92 institutional
unlock has progressed; Carl can rotate via available path
during the week of 2026-06-01. Adding this as a follow-up
note rather than a separate §6 entry per CC11 (the §4 entry
carries the live status; this log preserves the historical
incident).

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

*Last updated: 2026-05-26 | CC-namespace added (CC1-CC11) +
Batch 009 Azure prereqs verified end-to-end + Owner-reclaim
bullet removed from §5 as factually incorrect framing.
Lessons from today encoded as CC8 (stale-status re-verification),
CC9 (last-verified timestamps), CC10 (blocker reality-check).*
