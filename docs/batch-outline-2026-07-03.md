# CQIP Batch Outline — Sequencing & Scope Decisions

**Date:** 2026-07-03
**Author:** DC + Lacey
**Status:** ENCODED in CLAUDE.md as of the Batch 005.1 Phase 6 close-out
docs commit (§15 rewrite + §15.5→§16 move + CROSS_CLAUDE §5 mirror) —
**CLAUDE.md is now canonical** for the decisions below. This doc is retained
as the point-in-time planning record that seeded that commit; if it and
CLAUDE.md ever disagree, CLAUDE.md wins (canonical-first).

---

## Priority Sequence (locked 2026-07-03)

| # | Batch | Description | Status | Effort |
|---|-------|-------------|--------|--------|
| 1 | 005.1 | Coverage redesign + BrandAdminDrawer — close-out | Phase 5 with Claudette; Phase 6 (Karen) next | XS remaining |
| 2 | auth.1/.2 | Identity migration + admin password reset | Own session, Jenny pre-flight | S–MED |
| 3 | 006 | Teams dispatch — EXPANDED scope | Off hold | MED–LG |
| 4 | 005.2 | Coverage visual redesign | Mockups ready (Lacey's machine); Jenny pre-flight | MED–LG |
| 5 | 010.1 | Pipeline alerts — MERGED scope (absorbs 010.2 + Path 2) | Sequenced | MED |
| 6 | 007 | Custom Jira Boards | Off hold | LG (3–5 wk) |
| 7 | — | Per-brand config pages | Prereq for 008 | MED–LG |
| 8 | 008 | Convert.com integration | Off hold; discovery-first | LG (2–4 wk + discovery) |

Sequencing rationale:
- auth.2 before everything sizable: only operational-risk item on the board
  (zero password-recovery path today).
- 006 before 005.2: highest scaffolding lift; doesn't touch coverage/page.tsx
  so no conflict with redesign prep. Mockup hashing can run parallel to the
  006 build.
- 005.2 before 010.1: both touch coverage/page.tsx; redesign settles the
  layout, then 010.1's pill lands on the settled page.
- 010.1 after 006: dispatcher exists by then, so pipeline alerts fire Teams
  pings from day one instead of shipping stubbed.
- 007 before config pages before 008: 007's cache layer is real scaffolding;
  config pages are 008's hard prereq; 008 is a leaf node.

---

## Batch 005.1 — Close-out (Phase 6)

- Karen post-flight reviews the FULL batch chain (Phases 2–5), not just 4–5.
  Precedent: Batch 009 whole-ship review.
- On Karen pass: close-out docs commit. §15.5 entry deleted, §16 shipped
  entry written, §15 backlog item 5.1 closed — atomic per r34/r23.
- The close-out commit ALSO carries every capture item in this doc
  (see "Close-out commit contents" at bottom).
- 📓 Batch close = composition notebook update (timeline page + On-deck
  rewrite — On-deck is now three decisions stale).

---

## auth.1 / auth.2 — Identity migration + admin reset

**auth.1 — migrate off @cqip.local:**
- Full identity migration to real fusion emails. Users prompted for their
  fusion email (prompt-on-next-login flow for the 7 existing accounts —
  a flow to build, not just a schema change).
- Session decision #1 (unresolved): login stays username-keyed with email
  mapped underneath, or login switches to email.
- Enables Supabase's native forgot-password flow (admin self-recovery).

**auth.2 — admin-initiated password reset:**
- Admins can reset READ-ONLY users only. Never other admins.
- Flow: temp password + forced change on first login.
- Admin self-recovery: email reset (post-auth.1) or the other admin.
- Likely shape: server route + service role, gated per r24/r6, audit-logged
  per r19 with reset-target as audit subject.
- Risk note: touches user_profiles / Supabase Auth / the r22
  trigger-protected column neighborhood → Jenny pre-flight despite small size.
- Build order within session: auth.2 first (self-contained), then auth.1.

---

## Batch 006 — Teams dispatch (EXPANDED)

Original scope (dispatcher, rate limiting, retry, message cards, test-mode
toggle, notification_sent flag, 401/403 rotation-grace detection) PLUS:

- **Dispatcher home: edge function** (locked). Follows the drought-evaluator
  template — sits next to its callers, established custom-auth pattern
  (r21, verify_jwt=false).
- **Single Teams channel** for all alert types (revisit per-client channels
  if/when volume demands).
- **Forward-only dispatch:** existing silent alert_events rows (open
  droughts etc.) do NOT fire retroactively. Dispatch starts clean from
  ship-time.
- **Global rate cap with self-announcing overflow:** when the cap trips,
  post one "Alert limit reached (N suppressed) — check dashboard" message.
  Never silently swallow.
- **Absorbs backlog 5.21 (cron-silence monitor):** evaluator-health
  alerting. A broken/failing evaluator produces an ALERT, not suppression.
  Philosophy: don't limit real alerts — surface when the thing producing
  them is broken.
- **NEW: daily morning status digest** — cron posting current statuses
  (open droughts, active alerts; pipeline health once 010.1 lands).

Effort: MED–LG (was MED). Absorbs 5.21 so net board shrinks.

---

## Batch 005.2 — Coverage visual redesign

- Scope emerges from mockup session (mockups on Lacey's local machine —
  **capture asset paths in the batch entry at creation**).
- Known shape: mild-to-moderate reorganizing, combining the Output +
  Pipeline tables. Differences to both tables.
- Structural questions for the mock session: preserve the 010 split-table
  structure or merge? Touch the 005.1 9-card KPI row or work around it?
- Jenny pre-flight locked (full visual redesign).
- Does NOT include the dashboard polish cluster — that's a standalone
  backlog entry (different page).

---

## Batch 010.1 — Pipeline alerts (MERGED: 010.1 + 010.2 + Path 2)

The three formerly-separate items collapse into one coherent build:

- **Per-brand targets on the brand record** — milestone targets AND
  pipeline-stage thresholds, replacing the flat 2/28d constant. Driven by
  the fact that contracts already vary per brand (the old "gated on a real
  contract" trigger for 010.2 is moot).
- **UI home: BrandAdminDrawer tab** — resolves the deleted-settings-page
  re-home question (old scope doc said /settings/coverage, deleted in
  005.1 Phase 5). This is what the drawer was built for.
- **Both evaluators (milestone-drought + pipeline-drought) read per-brand
  config.** The 005.1 aggregators were deliberately written so the
  flat→per-brand swap is a one-line change inside the per-brand loop.
- **Path 2 off-by-one settled INSIDE this build:** the current `<= 2`
  drought predicate question stops being "fix <= vs <" and becomes "define
  the comparison against the configured target once, correctly."
  Standalone Path 2 backlog item: KILLED. Standalone 010.2: DISSOLVED.
- **contract_status ≠ is_paused (locked):** separate fields.
  - is_paused = operational state (mid-contract hold) → drives
    alert-skipping (r20 precedent).
  - contract_status = commercial state → informational + future billing
    hooks. A brand can be contracted-but-paused; collapsing loses that.
- **Default thresholds:** placeholder until PM consult on per-contract
  numbers (Lacey action). Configurable per brand from day one.
- **Storage decision (open):** new table vs alert_rules.config reuse —
  consult the 005.2 redesign outcome before deciding.
- Daily 5am Central cron → alert_events, audit per §13 r20
  (changed_by = 'system:pipeline-drought-evaluator').
- Ships with Teams pings live (006 lands first in sequence).

Effort: MED (was S). PM consult on contract verbiage / monthly-vs-28d
window semantics still owed (Lacey).

---

## Batch 007 — Custom Jira Boards (decisions banked for wake-up)

Locked 2026-05-06 decisions stand (read-only v1, jira_tickets cache via
webhook 3rd branch, /dashboard/board, per-client + View All, ~50/column
pagination + virtual scroll). New decisions banked 2026-07-03:

- **Saved views: URL params + per-user saved views + default-view-on-login**
  (board_views table, anticipated in original sketch). Flow: Jira-like
  default layout → user customizes → saves to profile → their default
  loads on board entry.
- **Filter bar: Jira-parity** per Lacey's screenshot — quick filters
  (Exclude Paused Brands / Roadmap / In Progress / QA / With Client /
  Needs Attention / No holds / Assigned to me / Unassigned / Recently
  Updated), brand pills (ASV…WDG), grouping control.
- **Card density: compact default, comfortable as a user toggle.**
- **Cache freshness: "last synced" indicator + manual "sync now" CTA**
  showing success/failure (sync_runs pattern precedent from 005.10).

Still open at impl: /board vs /boards route path; View All layout
(combined columns vs per-client groups).

Note: 007's cache layer is the scaffolding piece — if 007 ever needs
partial pull-forward, the jira_tickets cache is the piece to extract.

---

## Per-brand config pages (prereq for 008)

Scoping unfinished. Sketch from prior sessions: per-brand page hosting URL
inventory, site areas, staging/prod URLs, notes, changelog, add-new
actions. Data model moves from individual URLs to targeting definitions
per site area (regex patterns, exclusion lists, element checks, audience
conditions) + derived examples layer. Resolution-mode field distinguishes
URL-pattern areas from element-checked/audience-gated areas.

Open: data-model lock; migration path for existing brand URL data.
Sleeps while 008 sleeps; wakes as its prereq.

---

## Batch 008 — Convert.com integration

Discovery-first, unchanged. Six discovery items open by design: auth
model, rate limits + pause/deploy state-machine atomicity, brand→Convert
project mapping, naming formula (Lacey to provide), UI placement,
failure/rollback semantics. Hard prereq: per-brand config pages.

---

## New §15 backlog entries (close-out commit)

1. Batch 005.2 entry (+ mockup asset paths)
2. auth.1/.2 entry (scope per this doc)
3. Per-brand config pages (annotated: prereq for Batch 008)
4. Dashboard polish cluster — KPI hover popovers, stacked issue-category
   chart, Recent Activity panel — PLUS sortable Pipeline table columns
   PLUS rework indicator distinguishing zero-delivery weeks from genuinely
   quiet weeks. Standalone entry; NOT part of 005.2.

## Backlog items closed/absorbed (close-out commit)

- 5.21 cron-silence monitor → absorbed into Batch 006
- Path 2 drought-predicate off-by-one → folded into Batch 010.1
- Batch 010.2 → merged into Batch 010.1

---

## Close-out commit contents (Phase 6, single docs commit)

- [ ] §15.5 Batch 005.1 entry deleted; full §16 shipped entry written (r34)
- [ ] §15 backlog item 5.1 closed
- [ ] §15 priority order rewritten to the sequence table above
- [ ] Four new backlog entries added (list above)
- [ ] Three backlog items closed/absorbed (list above)
- [ ] CROSS_CLAUDE.md §5 mirror: sequence updated; 006 no longer "next
      open DC batch"; 010.1 merged-scope note
- [ ] CROSS_CLAUDE.md header fix: remove GitHub blob-URL fetch
      instruction (contradicts CC9; local connector path is canonical)
- [ ] 📓 Lacey: composition notebook — timeline page + On-deck rewrite

## Lacey's open actions (not Claudette's)

- [ ] PM consult: pipeline-stage threshold numbers + contract verbiage
      (monthly vs rolling-28d semantics) — before 010.1 impl
- [ ] Mockup asset paths captured when 005.2 batch entry is written
- [ ] Naming formula for Convert deployments — before 008 discovery
- [ ] Azure re-rotation: **DELIBERATE HOLD — Lacey's call, not stale-rot;
      do NOT re-flag.** (This is an intentional pause, not an unverified
      stale blocker — R21's 7-day reality-check does not apply. Leave as-is
      until Lacey moves it.)
