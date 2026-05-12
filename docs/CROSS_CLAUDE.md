# CROSS_CLAUDE.md — Joint coordination doc for DC & AC

Shared cross-project state for the two Claude sessions working
across the CQIP program: DC (Dashboard, this repo) and AC
(Forge consumer, cqip-qa-automation repo).

**Source of truth for:** roster, handoff conventions, contract
surfaces, active cross-project rotations, cross-project decisions,
append-only event log.

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
|--------|---------|-------------|------|
| **DC** | Dashboard backend, schema, edge functions, brands API | claude.ai web/desktop | lacey-griffith/cqip |
| **AC** | Forge consumer app, Jira-side automations | claude.ai web/desktop | cqip-qa-automation |
| **Claudette** | Dashboard repo command-line execution | Claude Code in terminal | lacey-griffith/cqip |
| **Karen, Jenny, Radara** | Agent personas invoked by Claude Code for specific roles (reality check, spec verification, triage) | Invoked via Claude Code | both repos |

**Disambiguation rules:**
- "DC" and "AC" are the canonical handles. Don't call either
  one "CQIP Claude" — both projects share the CQIP name.
- Rule numbering is project-local. "DC §13 rule 27" ≠ "AC §13 rule 9"
  even though they cover the same concept.
- When a Claude relays a question/observation to the other Claude,
  scope context goes WITH the question.

---

## 2. Handoff Conventions

Locked Monday 2026-05-11 through Tuesday 2026-05-12 as
cross-Claude work patterns emerged:

1. **Project name disambiguation.** AC = Forge-side, DC =
   Dashboard-side. "CQIP Claude" is too ambiguous.

2. **Scope context with relays.** Relay questions with enough
   scope context for the receiving Claude to verify the question
   was addressed to the right surface.

3. **Persistent state lives in docs, not chat memory.** If a
   cross-project agreement emerges mid-session, flag it for
   commit to the appropriate doc (CLAUDE.md, CLAUDE_RULES.md,
   or CROSS_CLAUDE.md depending on scope).

4. **Advisor credit.** When one Claude advises the other on
   a shipped batch, the shipping Claude names the advisor in
   batch notes.

5. **Contract-surface changes get 1-3 line relay on ship day.**
   Covers: API shape, webhook payload, auth token rotation,
   schema column additions visible to the consumer.

6. **Rule numbering is project-local.** Always qualify in
   cross-project relays ("DC rule 27" not "rule 27").

7. **Mirror requests are evaluated for fit, not auto-applied.**
   If one Claude asks the other to mirror a structure that
   doesn't map cleanly to the receiver's doc shape, push back
   and propose a smaller / different mirror. Source-of-truth
   lives where it natively belongs.

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
- **Status:** shipped, no production traffic yet (AC not live)

### `/api/sharepoint/*` — PLANNED (Batch 009)
- **Owner:** DC
- **Consumer:** AC (Phase 2 of Forge consumer)
- **Shape:** TBD at Batch 009 design session
- **Auth:** Bearer `CQIP_SHAREPOINT_API_TOKEN` (separate from brands
  token per DC §13 rule 27 / AC §13 rule 9 — blast radius separation)
- **Status:** groundwork only. Azure app Postman-verified
  2026-05-02 / 2026-05-03. Architecture decisions pending Batch 009
  design.

---

## 4. Pending Rotations (live, both sides)

Mirrored from DC §15 + AC §15. Status here is authoritative for
both sides.

- [ ] **Reclaim Owner access on Azure app** —
      "CQIP Dashboard - SharePoint Integration"
      (client_id 6aa464c1-4eb9-4d94-b087-6eebe4fa8cb6).
      Gates Azure secret rotation below.
      Surfaces: Azure portal.
- [ ] **Rotate Azure client secret** —
      Compromised-by-default per 2026-05-02/03 verification screenshots.
      Sequenced behind Owner reclaim.
      Surfaces: Azure portal.
- [ ] **Rotate CQIP_BRANDS_API_TOKEN** —
      Hygiene rotation. Not known compromised. In circulation since
      brands API initial setup (Batch 005.13-005.14 timeframe).
      Surfaces: Worker secret, DC local .env, Forge dev variable,
      Forge prod variable. Atomic rotation across all four required.

Rotation execution: Lacey kicks off; DC + AC walk their respective
sides within a single deploy window per DC §13 rule 27 / AC §13 rule 9.

---

## 5. Cross-Project Priority Order

Spans both projects. Last locked 2026-05-12.

| # | Owner | Item | Status |
|---|-------|------|--------|
| 1 | DC | 5.19 SPL multi-page presence sweep | next |
| 2 | DC | Batch 009 SharePoint integration | post-5.19 |
| 3 | AC | Phase 1.5 implementation | parallel with DC 009 design |
| 4 | DC | Batch 006 Teams dispatch | post-009 |
| 5 | DC | Batch 010 UI polish | post-006 |
| 6 | DC | Batch 011 Coverage redesign | post-010 |
| 7 | AC | Phase 2 (after DC 009 ships) | gated on DC 009 |
| 8 | DC | Batch 007 Custom Jira Boards | post-Phase-2 |
| 9 | DC | Batch 008 Convert.com automation | last |

---

## 6. Append-Only Event Log

Cross-project events worth durable record. Newest at top.
Covers events from 2026-04-23 forward (start of the drift-
prevention era). Project-internal events stay in each
project's CLAUDE.md §16.

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

*Last updated: 2026-05-12 | Initial version, shipped as part of
Batch 005.24*
