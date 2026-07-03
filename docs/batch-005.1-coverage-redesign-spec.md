# Batch 005.1 — Coverage Page Redesign + BrandAdminDrawer Consolidation

**Author:** DC + Lacey
**Date:** 2026-06-05
**Status:** Jenny pre-flight COMPLETE 2026-06-05 (PASS-WITH-FINDINGS — all
findings folded into this revision; see §9). Ready for Claudette implementation.
**Repo:** `lacey-griffith/cqip`
**Pairs with:** `batch-010-scope.md` (010.2 contract-count dependency noted inline)

---

## Purpose

Two bundled changes to `/dashboard/coverage`:

1. **Coverage KPI reorg + 3 new KPI cards** — promote the teal
   long-range cards to the front of the row, add Overall Health,
   Brands Covered, and Quality Score.
2. **BrandAdminDrawer consolidation (the §15 5.1 item)** — replace the
   standalone `/dashboard/settings/coverage` admin page with a unified
   per-brand drawer (tabs: Details / QA Config / Milestones / Pause)
   opened from the Coverage page itself, then delete the settings page.

Plus a folded-in docs-hygiene fix (see §8).

**Done for today (committed deliverable):** Phases 0–3 — this spec,
the KPI calculations with tests, and the layout reorg. Phases 4–6
(the drawer, the settings-page deletion, Karen, deploy) span past
today and are explicitly NOT rushed.

---

## 1. Locked decisions (Phase 0 — do not relitigate)

| Decision | Locked value |
|---|---|
| Quality Score numerator | **distinct tickets** with zero rework (not rework events) |
| Quality Score window | **rolling 28 days**, single window, **no toggle** |
| Quality Score direction | **high % = good** (clean delivery rate, not error rate) |
| Overall Health denominator | **flat threshold** (covered = not-in-drought = **more than 2** milestones / 28d — the drought predicate in code is `count <= 2`, so "covered" is its strict complement `count > 2`; see §3.1 ⚠) → swaps to per-brand target when 010.2 lands |
| Brands Covered | **count form of the same calc** as Overall Health (e.g. `4/17`) |
| Brands Covered window | **rolling 28 days** (subtitle reads "LAST 28 DAYS", NOT "THIS WEEK") |
| Project pills + Show-paused + Export | **all kept**; tables stay filter-scoped |
| Drought subtitle copy | **"≤2"** stays (the ">2" in the mockup is backwards — drought is *fewer than* threshold) |
| "Slow paused brands" | typo → **"Show paused brands"** |

---

## 2. Layout reorg

### KPI row — final order (9 cards, single row, wraps responsively)

```
[Tests This Year] [Tests All Time]          ← teal long-range, MOVED to front
[This Week] [Last Week] [Rolling 28 Days] [This Month]   ← existing four, unchanged
[Overall Health] [Brands Covered] [Quality Score]        ← NEW
```

- The two teal long-range cards keep their existing
  `--kpi-longrange-{bg,border,fg}` token treatment (Batch 010, §13 r25).
  Only their **position** changes (front of row).
- The three new cards use the **standard** (non-teal) KPI card styling —
  they are current-state operational metrics, not long-range. Do NOT
  give them the teal accent.
- Existing four middle cards: unchanged in styling and calc.

### Control bar — UNCHANGED from current

`PROJECT [NBLY] [SPL]  ·  ☐ Show paused brands  ·  [Export to Excel]`

- All three controls retained. The earlier KPI-only mockup omitted this
  bar; the fuller mockup confirms it stays.
- Tables below remain scoped to the project/brand filter
  (Batch 005.22 Phase 2 behavior — no change).
- Fix the "Slow paused brands" → "Show paused brands" label typo.

### Header copy fix

Drought-flag subtitle currently/correctly reads:
`Tests (Dev Client Review first-entries) by brand. Brands with ≤2 tests
in the last 28 days are flagged.`

Keep **≤2**. The mockup's ">2" is inverted and must not be copied.

---

## 3. New KPI calculations (data layer — `lib/coverage/queries.ts`)

All three are pure aggregators, fully unit-tested before any UI wiring
(Phase 2 precedes Phase 3). These are decision-driving numbers;
correctness is the entire point.

**Test convention (per Jenny — the repo has no `npm test` script or
vitest/jest config):** new tests go in `tests/coverage-kpis.test.ts`
using `node:test` + `node:assert`, mirroring the existing
`tests/errors.test.ts` pattern; run via
`npx tsx --test tests/coverage-kpis.test.ts`. The aggregators must stay
pure functions over plain arrays (no Supabase import in the tested
unit), consistent with `lib/coverage/queries.ts`'s existing design.
Required cases: normal, 0-denominator, dirty-ticket-not-in-delivered-set
exclusion, single-pass Health+Covered, and the **boundary case: a brand
with exactly THRESHOLD milestones must classify as DROUGHT/uncovered**
(matching the table pill — see §3.1 ⚠).

### 3.1 Overall Health %

**Definition:** percentage of *active, non-paused* brands that are NOT in
drought in the rolling 28-day window. "Covered" is defined as the **strict
complement of the drought predicate** — never a re-expressed inequality.

```
// drought predicate (existing, lib/coverage/queries.ts:194 +
// drought-evaluator/index.ts:123): inDrought = count <= THRESHOLD
for each brand in active-non-paused brands:
    target  = THRESHOLD          // 010.2 swap point: brand.contract_milestones_per_month
    covered = count28(brand) > target      // STRICTLY GREATER — complement of <= target
    if (covered) numerator++
    denominator++
overall_health_pct = round(numerator / denominator * 100)
```

- **⚠ Jenny Critical fix (2026-06-05):** an earlier draft wrote the
  numerator as `>= THRESHOLD`, which disagrees with the code's drought
  predicate (`count <= 2` ⇒ a brand with exactly 2 milestones shows
  DROUGHT in the table). Covered must be `count > THRESHOLD` — ideally
  computed as `!droughtFlag` via the shared predicate so the two
  surfaces literally cannot diverge. A brand sitting exactly on the
  threshold is in drought / uncovered.
- **THRESHOLD = 2**, a constant passed into both the row builder and
  this aggregator. Do **NOT** add a live `alert_rules.config` fetch in
  this batch — the Coverage page's existing DROUGHT pill is hardcoded
  to `<= 2` (it never reads config), and reading live config for Health
  while the pill stays hardcoded would let them drift the moment an
  admin edits the rule. Parity with the pill wins; live-config for both
  surfaces is a future batch if ever needed.
- Window: rolling 28 days (`now - 28d`), matching the drought logic so
  Health and the table's DROUGHT pills never disagree.
- **Flat-denominator caveat (load-bearing):** every brand uses the same
  flat THRESHOLD as its "required" number today. This is correct under
  current reality — all brands are on the same implicit target. When
  Batch 010.2 adds `brands.contract_milestones_per_month`, swap the flat
  THRESHOLD for the per-brand value — the pseudocode above already reads
  `target` per-brand inside the loop, so the swap is the one marked line.
  (`countsByBrand` in queries.ts already yields per-brand counts in a
  single pass; the aggregator loops brands once against that map.)
- Edge case: denominator = 0 (no active unpaused brands) → render `—`,
  not `0%` or a divide-by-zero. (Won't happen in prod today; defend anyway.)
- Respects the project/brand filter? **NO — full-scope, program-health.**
  Per the Batch 005.22 KPI boundary: KPI row = program-health (full
  scope); tables = filter-scoped. Overall Health is a program metric.
  **Implementation guard:** compute from the full `brands` / `milestones`
  state arrays (or the full `rows` built from them), **never** from
  `visibleRows` — that memo is filter- AND paused-scoped and would
  silently violate full-scope.

### 3.2 Brands Covered (N/M)

**Definition:** the count form of Overall Health. Same numerator and
denominator, rendered as a fraction.

```
covered_count = numerator from 3.1   (brands with count > THRESHOLD — not in drought)
total_count   = denominator from 3.1 (active non-paused brands)
display       = "{covered_count}/{total_count}"   e.g. "4/17"
```

- Subtitle: **"LAST 28 DAYS"** (NOT "THIS WEEK" — the mockup label is
  wrong; the calc is inherently 28d because "covered" == "met drought
  threshold").
- Same flat-denominator caveat and same 010.2 swap path as 3.1.
- Same full-scope boundary as 3.1.
- Implementation note: compute 3.1 and 3.2 from a **single** pass over
  brands — they are literally the same numerator/denominator. Don't
  double-query.

### 3.3 Quality Score %

**Definition:** clean-delivery rate — of the distinct tickets delivered
(reached Dev Client Review) in the last 28 days, what % had zero rework.

```
delivered_tickets = distinct jira_ticket_id in test_milestones
                    where milestone_type = 'dev_client_review'
                      and reached_at >= now - 28d
                      and is_deleted = FALSE

dirty_tickets     = distinct jira_ticket_id in quality_logs
                    where is_deleted = FALSE
                      and triggered_at >= now - 28d
                      and jira_ticket_id IN delivered_tickets

clean_tickets     = delivered_tickets - dirty_tickets
quality_score_pct = round(clean_tickets / count(delivered_tickets) * 100)
```

- **Distinct tickets, not rework events** — a ticket sent back 3 times
  counts once as dirty. Multiplicity is severity, not count.
- **High % = good.** A clean delivery (no rework) is the good outcome.
- Window: rolling 28 days (consistent with the other two new cards).
- **Numerator/denominator alignment is critical:** `dirty_tickets` must
  be intersected with `delivered_tickets` so a rework event on a ticket
  that was NOT delivered in the window doesn't poison the score. Only
  tickets in the delivered set can be clean-or-dirty.
- **Window semantics (explicit, per Jenny):** rework only counts as
  dirty if it occurred within the same 28-day window. A ticket delivered
  this window whose rework predates the window reads as **clean**. This
  is intentional — Quality Score is a rolling recent-quality metric, not
  a lifetime-clean metric. (Dropping the `triggered_at >= now-28d`
  filter would make any historically-reworked ticket dirty forever.)
- The `is_deleted = FALSE` filter on `test_milestones` is **mandatory** —
  it's what makes the partial unique index
  `idx_test_milestones_unique (jira_ticket_id, milestone_type) WHERE
  is_deleted = FALSE` guarantee distinctness (the spec's DISTINCT is
  belt-and-suspenders on top of that, not load-bearing).
- **Known definitional divergence (intentional, currently harmless):**
  Quality Score filters `milestone_type = 'dev_client_review'`; the
  Output table / Health / drought-evaluator count helpers are
  type-agnostic. Today only `dev_client_review` is ever written, so all
  surfaces agree by data, not by code. Reconcile (add the type filter to
  the shared helpers) the day a second milestone_type lands.
- Edge case: `delivered_tickets = 0` → render `—`, not `100%` or `0%`.
  (A 0-denominator quality score is meaningless, not perfect.)
- Full-scope (program metric), same boundary as 3.1/3.2. Same
  implementation guard: full state arrays, never `visibleRows`.
- **Jenny verification (resolved 2026-06-05):** `test_milestones`
  dev_client_review first-entries confirmed as the right "delivered"
  denominator — same definition as the page subtitle and the Output
  table's counting. No double-count: the partial unique index makes
  `(jira_ticket_id)` unique among live DCR rows, so DISTINCT == COUNT(*).
  Soft-delete/restore and backfill rows are constrained by the same
  index; no duplicate path.

### 3.4 Tests + tests + tests

No change to the existing four middle KPIs or the two teal cards' calcs.
Only the new three are added.

---

## 4. BrandAdminDrawer (Phase 4 — the big lift, likely spans past today)

Replace the standalone `/dashboard/settings/coverage` admin page with a
unified per-brand drawer opened from the Coverage page. Decision locked
in §15 5.1: **tabs in one drawer, not multi-drawer.**

### Tabs

| Tab | Source today | Notes |
|---|---|---|
| **Details** | brand row core fields | brand_code, jira_value, display_name, is_active |
| **QA Config** | `EditBrandQaConfigDrawer` (Batch 004.5) | live_url_base, default_local_sub_areas, contacts, url_pattern, qa_automation_enabled |
| **Milestones** | `ManageMilestonesDialog` (Batch 002) | add/edit/soft-delete + restore |
| **Pause** | pause/unpause flow (Batch 004.3 route) | is_paused, paused_reason |

- Opens from a per-brand affordance on the Coverage table (e.g. a
  three-dot menu or row action), consistent with existing drawer-open
  patterns.
- Reuses existing server routes: `/api/admin/brands/qa-config`,
  `/api/admin/brands/pause`, `/api/admin/milestones/*`,
  `/api/admin/brands` (create). **No new mutation routes** — this is a
  UI consolidation, not a backend change. Audit writes already go
  through `getChangedBy()` (§13 r19) on all four routes; that contract
  is preserved untouched.
- Drawer-on-drawer is supported (§13 r26) if a tab needs a nested
  confirm.
- CSS tokens per §13 r25 — no inline hex.
- **Admin-gate:** the drawer's mutation affordances render only for
  admins. The Coverage page is visible to all authed users; the drawer's
  write actions must check role (same belt-and-suspenders the settings
  page used). Server routes already enforce admin server-side — the UI
  check is UX, not the security boundary.

### What this does NOT change

- No schema change. No migration.
- No change to the four mutation routes' behavior or audit shape.
- The brand-create flow (`AddBrandDrawer`, Batch 005.20) — decide at
  impl whether it folds into this drawer or stays a separate "Add brand"
  button. **Recommendation: keep AddBrandDrawer separate** (it's a
  create-new flow, not a per-brand-edit flow; cramming it into a
  per-brand tabbed drawer is awkward). Flag for Lacey at Phase 4.

---

## 5. Settings-page deletion (Phase 5 — only after Phase 4 verified)

Delete `/dashboard/settings/coverage` **only after** the
BrandAdminDrawer is verified working end-to-end against the live app
(not build-green — clicked through per the "verification = the running
app" rule).

- Remove the route/page file.
- Remove its nav entry if present.
- **Known hardcoded references (enumerated by Jenny — all must be fixed):**
  - `app/dashboard/settings/page.tsx:40` — settings-home tile
    `href: '/dashboard/settings/coverage'` → remove the tile.
  - `app/dashboard/coverage/page.tsx:730` + `:732` —
    `BrandDetailDrawer`'s `onManageMilestones` does
    `window.location.href = '/dashboard/settings/coverage...'` →
    Phase 4 should already replace these with opening the in-page
    BrandAdminDrawer; confirm no 404 path remains.
  - Main nav (`components/layout/nav.tsx`) has no settings/coverage
    entry — nothing to do there.
- Verify middleware admin-gate (§13 r24) doesn't break on the removed
  path (the gate matches `/dashboard/settings/*` — removing a child
  page is fine).
- **Component disposition (verified by Jenny):**
  `manage-milestones-dialog`, `edit-brand-qa-config-drawer`, and
  `add-brand-drawer` are imported ONLY by the settings page today —
  after Phase 4 they get re-pointed into / alongside BrandAdminDrawer
  (kept), or deleted if fully reimplemented inside the drawer.
  `back-to-settings` is used by 5 other settings pages — **must not**
  be deleted. `brand-detail-drawer` stays (Coverage page uses it).

**Do not delete the settings page in the same commit as the drawer
build.** Drawer lands and is verified first; deletion is its own commit.
Deleting the old surface before the new one is proven is how you strand
yourself.

---

## 6. Execution phases

| Phase | Content | Today? |
|---|---|---|
| 0 | Decisions locked (this spec §1) | ✅ done |
| 1 | This spec committed; Jenny pre-flight | today |
| 2 | KPI calcs in `lib/coverage/queries.ts` + tests | today |
| 3 | Layout reorg + 3 card shells wired to Phase 2 | today |
| 4 | BrandAdminDrawer (4 tabs, pull admin actions onto Coverage) | spans |
| 5 | Delete settings page (after 4 verified live) | spans |
| 6 | Karen post-flight → Lacey smoke-test + manual deploy | spans |

**Commit structure:**
- Commit 1: docs — this spec + the §8 Batch 011 hygiene strike (docs-only,
  paths-ignore skips redeploy).
- Commit 2: Phase 2 KPI calcs + tests.
- Commit 3: Phase 3 reorg + card wiring + atomic CLAUDE.md update.
- Commit 4: Phase 4 drawer (separate, after).
- Commit 5: Phase 5 deletion (separate, after 4 verified).

DO NOT PUSH — Lacey smoke-tests + deploys manually per standing pattern.

---

## 7. Acceptance criteria

### Phases 0–3 (today's deliverable)
- [ ] KPI row renders 9 cards in the locked order; teal cards at front
- [ ] 3 new cards use standard (non-teal) styling
- [ ] Overall Health = % active-non-paused brands with **more than 2**
      milestones in 28d (strict complement of the drought predicate
      `count <= 2`); `—` when denominator is 0
- [ ] Brands Covered = `N/M` form of same calc; subtitle "LAST 28 DAYS"
- [ ] Quality Score = distinct clean tickets ÷ distinct delivered tickets
      (rolling 28d); high=good; `—` when 0 delivered
- [ ] All three KPIs are full-scope (ignore project/brand filter; computed
      from full state arrays, never `visibleRows`)
- [ ] Control bar unchanged: PROJECT pills + Show-paused + Export all present
- [ ] "Show paused brands" label (typo fixed)
- [ ] Drought subtitle reads "≤2"
- [ ] KPI calc functions have unit tests covering: normal case, 0-denominator,
      dirty-ticket-not-in-delivered-set exclusion, single-pass Health+Covered,
      and exactly-THRESHOLD boundary (= drought/uncovered) — via `node:test`
      in `tests/coverage-kpis.test.ts` per §3 test convention
- [ ] `npm run build` green, `tsc --noEmit` clean
- [ ] No regression on existing Output table or the four middle KPIs

### Phases 4–5 (spans)
- [ ] BrandAdminDrawer opens per-brand from Coverage with 4 working tabs
- [ ] All four mutation flows work through the drawer (Details/QA/Milestones/Pause)
- [ ] Audit writes preserved (§13 r19, server-derived changed_by)
- [ ] Admin-only write affordances; read-only users see read view
- [x] Settings page deleted in a SEPARATE commit, after drawer verified live
      (Phase 5, Commit 5 — gated on Phase 4 verified live in prod)
- [x] Middleware admin-gate intact post-deletion (wildcard `/dashboard/settings/*`
      gate needs no edit; zero literal `settings/coverage` refs remain)

---

## 8. Folded-in docs hygiene (Commit 1) — DOWNGRADED per Jenny

Jenny verified the premise was partly stale: CLAUDE.md §15 already
annotates Batch 011 as `SHIPPED 2026-05-27` in the priority-order line
AND the Ops/deferred occurrence is already `[x]` checked off. **There
are no references presenting Batch 011 as upcoming** — the original
"two stale spots" claim overstated it.

Remaining (optional, cosmetic): the §15 priority chain still physically
lists shipped batches (005.25 / 011 / 009 / 010, all annotated SHIPPED)
inline in the arrow chain. If Lacey wants the chain to read as
truly-upcoming-only (`Batch 006 → Batch 007 → Batch 008` with shipped
items moved to the parenthetical), trim it in Commit 1. Do not describe
this as fixing stale references — the annotations are accurate.

Docs-only; rides in Commit 1 with this spec. No redeploy (paths-ignore).

---

## 8b. Growth / future (NOT this batch — captured for context)

**Filter-aware KPIs + per-client Coverage view.** The Coverage KPI row
would re-scope to the active project/brand filter (or, more likely, a
dedicated client-scoped view mode where the whole page breaks out per
client). Considered during Batch 005.1 scoping and deliberately
deferred:

- All nine KPIs stay **full-scope** in 005.1. The Batch 005.22 boundary
  ("KPIs stay full-scope program-health") is **NOT reversed** here — it
  holds.
- The future shape is bigger than "make existing cards respond to a
  filter" — it's a per-client broken-out Coverage view. Building filter
  plumbing on the current cards now would likely be throwaway when that
  lands, so it's not pre-built.
- Ratio cards (Overall Health, Brands Covered) would need graceful
  degradation at single-brand scope (`1/1` / `100%` is honest but
  near-useless as a health read) — a design consideration for whenever
  this is scoped as its own batch.

Not a locked batch; the design isn't scoped. Surfaced here so the intent
isn't buried.

---

## 9. Jenny pre-flight — RESOLVED 2026-06-05 (PASS-WITH-FINDINGS)

All four open flags answered; one Critical + two Medium findings folded
into the body above. Summary:

1. **Quality Score "delivered" source** — ✅ CONFIRMED. `test_milestones`
   dev_client_review first-entries is the right denominator; no
   double-count (partial unique index guarantees distinctness among live
   DCR rows). Caveat folded into §3.3: the type filter is stricter than
   the type-agnostic shared count helpers — harmless today, reconcile
   when a second milestone_type lands.
2. **010.2 swap path** — ✅ CONFIRMED achievable as a one-line swap
   (`countsByBrand` already yields per-brand counts; the §3.1 pseudocode
   was rewritten to read `target` per-brand inside the loop so a literal
   implementer can't miss it).
3. **AddBrandDrawer placement** — ✅ KEEP SEPARATE (Jenny agrees with the
   spec's recommendation). It's a create-new flow, imported only by the
   settings page today; it becomes a standalone "Add brand" button on
   Coverage, not a tab in a per-brand-edit drawer.
4. **Component cleanup** — ✅ enumerated in §5 (three settings-only
   components re-pointed or deleted; `back-to-settings` must NOT be
   deleted — five other settings pages use it).

**Critical finding fixed in this revision (§3.1 ⚠):** the original
numerator (`>= THRESHOLD`) contradicted the code's drought predicate
(`<= THRESHOLD`) — a brand with exactly 2 milestones would have read
"covered" on the KPI while showing DROUGHT in the table. Covered is now
defined as the strict complement (`> THRESHOLD`, ideally `!droughtFlag`
via the shared predicate).

**Medium findings fixed in this revision:** test-runner convention
pinned (§3 intro — `node:test` in `tests/coverage-kpis.test.ts`);
threshold stays a constant with table-pill parity, NO live
`alert_rules.config` fetch this batch (§3.1); milestone_type
definitional divergence documented as intentional (§3.3).

**Low findings:** window semantics made explicit (§3.3);
§8 docs-hygiene downgraded (Batch 011 already marked SHIPPED in
CLAUDE.md — no stale "upcoming" references exist); §5 hardcoded
references enumerated.

---

*End of spec. Phases 0–3 are today; 4–6 span. Sequence per Lacey's call.*
