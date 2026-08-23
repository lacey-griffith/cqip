# Batch 010.1 pipeline alerts · full scope

**Relocated from `CLAUDE.md` §15 on 2026-08-23** by the second extraction pass
(§13 r41 remedy 3 / r42). **This file is live scope authority — it is NOT the
archive, and r40 does not apply to it.** Current sequencing, mode and open
actions stay in CLAUDE.md §15; read those there, not here.

Board rev 8.1: the 010.1 remainder is sequence **#6**, behind **#5 006 Teams
dispatch**. QMS Rec 3 (splitting the per-brand contracted-target half off) is
BACKLOG, so it no longer gates this.

---

### Batch 010.1 — Pipeline alerts (MERGED: 010.1 + 010.2 + Path 2)
Sequenced after Batch 006. Collapses the three formerly-separate items
(pipeline drought alerting, brand contract management, and the Path 2
off-by-one) into one coherent build.

- **Per-brand targets on the brand record** — milestone targets AND
  pipeline-stage thresholds, replacing the flat **4/28d** constant
  (`COVERAGE_TARGET`; it was 2/28d until the 2026-08-03 coverage-honesty
  batch — do NOT go looking for a `2`). Driven by the fact that contracts
  already vary per brand (the old "gated on a real contract" trigger for
  010.2 is moot).
- **UI home: BrandAdminDrawer tab** — resolves the deleted-settings-page
  re-home question (the old 010.2 sketch said `/settings/coverage`, deleted
  in Batch 005.1 Phase 5). This is what the drawer was built for.
- **NEW — scheduled orphan-milestone alert (from Brand Wellness follow-up,
  2026-07-07):** add a null-`brand_id` `test_milestones` check to the 5am
  cron so orphaned milestones (unresolved brand at ingest, §13 r18) are
  actively surfaced, not just visible on the Coverage Output footer (Batch
  Brand Wellness commit 4) and the pipeline `unresolved_count`. Pairs with
  the OPS backfill-cadence check (Ops/deferred) — an alert makes a lagging
  backfill loud instead of silent.
- **Both evaluators (milestone-drought + pipeline-drought) read per-brand
  config.** Batch 005.1's aggregators were deliberately written so the
  flat→per-brand swap is a one-line change inside the per-brand loop.
- **Path 2 off-by-one — SETTLED 2026-08-03 on both sides; the parity narrative is
  relocated** to `docs/claude-archive/CLAUDE-16-2026-08.md` (r42). **No parity work
  is owed.** What 010.1 still owns is STRUCTURAL, and it is an action:
  - [ ] **Collapse the drought threshold to ONE per-brand target compared with
        strict-less-than, in one place.** It is currently two spellings that happen
        to coincide — `COVERAGE_TARGET = 4` with `count < target` in
        `lib/coverage/queries.ts`, and `alert_rules.config.threshold = 3` with
        `count <= threshold` in the cron — **plus a third value**, the evaluator's
        unused `DEFAULT_THRESHOLD = 2` fallback, which would **silently** reopen the
        divergence if that config row were ever deleted, deactivated or stripped of
        its `threshold` key. Removing that fallback is the load-bearing half.
        **Do not reintroduce a threshold-and-`<=` shape** in `queries.ts`: writing 4
        into the old spelling makes 4 read as DROUGHT.
- **`contract_status` ≠ `is_paused` (locked):** separate fields.
  `is_paused` = operational state (mid-contract hold) → drives
  alert-skipping (r20 precedent). `contract_status` = commercial state →
  informational + future billing hooks. A brand can be contracted-but-
  paused; collapsing the two loses that.
- **Default thresholds:** placeholder until PM consult on per-contract
  numbers (Lacey action); configurable per brand from day one.
- **Storage decision (open):** new table vs `alert_rules.config` reuse —
  consult the Batch 005.2 redesign outcome before deciding.
- Daily 5am Central cron → `alert_events`, audit per §13 r20
  (`changed_by = 'system:pipeline-drought-evaluator'`).
- Ships with Teams pings live (Batch 006 lands first in sequence).
- Effort: MED. PM consult on contract verbiage / monthly-vs-28d window
  semantics still owed (Lacey).

