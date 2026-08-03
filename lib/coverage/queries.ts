// Pure client-side helpers for the Client Coverage page. No Supabase
// dependencies — callers fetch once and hand the raw arrays in. Keeping
// these as plain functions makes them trivially unit-testable and lets
// the page control its single-query fetch pattern.

export interface Brand {
  id: string;
  project_key: string;
  brand_code: string;
  jira_value: string;
  display_name: string;
  is_active: boolean;
  is_paused: boolean;
  paused_reason: string | null;
}

export interface Milestone {
  id: string;
  jira_ticket_id: string;
  jira_ticket_url: string | null;
  jira_summary: string | null;
  brand_id: string | null;
  brand_jira_value: string | null;
  milestone_type: string;
  reached_at: string;
  source: 'webhook' | 'manual' | 'backfill';
  created_by: string;
  notes: string | null;
  is_deleted: boolean;
}

export interface QualityLog {
  id: string;
  jira_ticket_id: string;
  client_brand: string | null;
  triggered_at: string;
  is_deleted: boolean;
}

export interface CoverageRow {
  brand: Brand;
  testsCurrentWeek: number;
  testsLastWeek: number;
  testsRolling28: number;
  testsCurrentMonth: number;
  reworkRolling28: number;
  droughtFlag: boolean;
  // 6-month per-month series — feeds the Reggie drawer's bar chart. Kept
  // exactly as-is (do NOT repoint to 12mo).
  monthly: Array<{ monthIso: string; count: number }>;
  // 12-month per-month series — feeds the Coverage Ledger sparkline (Batch
  // 005.4 #2, the growth read). A reusable field so the coming 005.5 drawer
  // 6/12 toggle can read both `monthly` and `monthly12`.
  monthly12: Array<{ monthIso: string; count: number }>;
  // 7 per-day milestone counts, oldest→newest, ending today (Batch 005.2).
  // No longer fed to the ledger sparkline (005.4 #2 moved that to monthly12);
  // KEPT — parked for a possible future daily surface. Length is always `days`.
  daily7: number[];
}

// -----------------------------------------------------------------------
// Time-window helpers. All Date objects are in local TZ (matches how the
// existing logs page parses triggered_at for the filter pills).
// -----------------------------------------------------------------------

// Every time-window helper takes an optional `now` (default `new Date()`)
// so callers can pin the clock for deterministic tests. Defaults preserve
// the original wall-clock behavior exactly — no call site needs to change.

export function startOfCurrentWeek(now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  return d;
}

export function startOfLastWeek(now: Date = new Date()): Date {
  const d = startOfCurrentWeek(now);
  d.setDate(d.getDate() - 7);
  return d;
}

export function endOfLastWeek(now: Date = new Date()): Date {
  const d = startOfCurrentWeek(now);
  d.setMilliseconds(d.getMilliseconds() - 1);
  return d;
}

export function startOfRolling28(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - 28);
  return d;
}

export function startOfCurrentMonth(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

// -----------------------------------------------------------------------
// Coverage TARGET — SINGLE SOURCE OF TRUTH.
//
// The Output-table DROUGHT pill (via buildCoverageRows) and the Overall
// Health / Brands Covered KPIs (computeCoverageHealth) BOTH route their
// comparison through isInDrought() so the two surfaces are physically
// incapable of diverging (Batch 005.1 hard constraints #1 + #3). Never
// re-spell the `< target` / `>= target` inequality at a call site.
//
// WHY "TARGET" AND STRICT-LESS-THAN, not "THRESHOLD" and <=. The rule is
// "drought is 3, covered is 4". Expressed as a THRESHOLD that must be
// exceeded, 4 would have to be written as `threshold = 3` — and the
// obvious-looking edit, setting the old constant to 4, silently makes 4
// tests read as DROUGHT because `4 <= 4`. The threshold name invites that
// off-by-one every time the number moves. A TARGET with `count < target`
// states the rule directly, and it is also how a contract is worded ("4
// tests a month"), which matters because per-brand contracted targets are
// the next step (010.1) — the config value will arrive already shaped like
// a target, not like a threshold needing a mental -1.
//
// TARGET is a constant, NOT a live alert_rules.config fetch. Note the
// original reason for that has now INVERTED: it was parity with a pill
// hardcoded to <=2, and as of the 2026-08-03 change the constant moved to
// 4 while `alert_rules.config.threshold` is still 2 (prod-verified) — so
// the render layer and the drought-evaluator cron now genuinely disagree,
// and a brand with 3 tests shows a DROUGHT pill with no alert_events row.
// That is Lacey's call and Batch 010.1's scope ("define the comparison
// against the configured target once, correctly"); it is recorded in §15,
// deliberately NOT patched here, because editing alert_rules is a data
// mutation on a live cron's input and the evaluator's own `<=` would need
// the same treatment to stay consistent.
// -----------------------------------------------------------------------

/**
 * Milestones a non-paused brand must reach in the rolling-28d window to be
 * COVERED. Below this is drought. **Effective 2026-08-03**; the previous rule
 * was a `<= 2` threshold. Overall Health % and Brands Covered are NOT
 * comparable across that date — raising the bar lowers both by construction,
 * so a drop afterwards is not evidence that delivery regressed. Recorded in
 * CLAUDE.md §15.5 while this is in flight, and it moves to §16 on ship; the
 * user-facing statement of the break lives in the docs hub, which renders
 * COVERAGE_TARGET_EFFECTIVE below.
 */
export const COVERAGE_TARGET = 4;

/**
 * The date COVERAGE_TARGET last changed, as a display string.
 *
 * Exported so the docs hub renders the discontinuity from the SAME source as
 * the number itself — a hardcoded date next to a derived number is how the
 * two drift, and the whole point of item 4 is that the break in the Health %
 * series has to be legible later. Bump this whenever the target moves.
 */
export const COVERAGE_TARGET_EFFECTIVE = '2026-08-03';

/**
 * A brand is in DROUGHT when it is not paused and reached FEWER than
 * `target` milestones in the rolling-28d window. "Covered" is the strict
 * complement among non-paused brands (count >= target). A brand sitting
 * exactly ON the target is COVERED — that is the whole point of the
 * target-plus-strict-less-than spelling.
 */
export function isInDrought(
  testsRolling28: number,
  isPaused: boolean,
  target: number = COVERAGE_TARGET,
): boolean {
  return !isPaused && testsRolling28 < target;
}

// -----------------------------------------------------------------------
// Aggregators.
// -----------------------------------------------------------------------

/**
 * Rework ratio display string: rework events per delivered test in a window,
 * or '—' when there were no tests (division base is zero). Single source of
 * truth — used by the Coverage page's XLSX export and the ledger's delivery
 * stats (Batch 005.2 dedupe; was duplicated in both).
 */
export function formatReworkRatio(tests: number, rework: number): string {
  if (tests === 0) return '—';
  return (rework / tests).toFixed(2);
}

export function countInWindow(
  milestones: Milestone[],
  brandId: string | null,
  start: Date,
  end: Date,
): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  let count = 0;
  for (const m of milestones) {
    if (m.is_deleted) continue;
    if (brandId !== null && m.brand_id !== brandId) continue;
    const t = new Date(m.reached_at).getTime();
    if (t >= startMs && t < endMs) count += 1;
  }
  return count;
}

export function countsByBrand(
  milestones: Milestone[],
  start: Date,
  end: Date,
): Map<string, number> {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const map = new Map<string, number>();
  for (const m of milestones) {
    if (m.is_deleted) continue;
    if (!m.brand_id) continue;
    const t = new Date(m.reached_at).getTime();
    if (t < startMs || t >= endMs) continue;
    map.set(m.brand_id, (map.get(m.brand_id) ?? 0) + 1);
  }
  return map;
}

export function monthlyCounts(
  milestones: Milestone[],
  brandId: string,
  monthsBack = 6,
  now: Date = new Date(),
): Array<{ monthIso: string; count: number }> {
  const buckets: Array<{ monthIso: string; start: Date; end: Date; count: number }> = [];
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const iso = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ monthIso: iso, start: monthStart, end: nextMonth, count: 0 });
  }

  for (const m of milestones) {
    if (m.is_deleted) continue;
    if (m.brand_id !== brandId) continue;
    const t = new Date(m.reached_at).getTime();
    for (const bucket of buckets) {
      if (t >= bucket.start.getTime() && t < bucket.end.getTime()) {
        bucket.count += 1;
        break;
      }
    }
  }

  return buckets.map(b => ({ monthIso: b.monthIso, count: b.count }));
}

/**
 * Per-day milestone counts for a brand over the trailing `days` days,
 * oldest→newest, the last bucket ending "now". Batch 005.2 Coverage Ledger
 * sparkline (mirror of monthlyCounts but at day granularity). Buckets are
 * local-TZ calendar days. Returns exactly `days` numbers; an all-zero array
 * is a legitimate "no deliveries" week, not a missing series.
 */
export function dailyCounts(
  milestones: Milestone[],
  brandId: string,
  days = 7,
  now: Date = new Date(),
): number[] {
  // Bucket boundaries: [dayStart(now - (days-1)) … dayStart(now)+1d).
  const buckets: Array<{ start: number; end: number; count: number }> = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
    buckets.push({ start: dayStart.getTime(), end: dayEnd.getTime(), count: 0 });
  }

  for (const m of milestones) {
    if (m.is_deleted) continue;
    if (m.brand_id !== brandId) continue;
    const t = new Date(m.reached_at).getTime();
    for (const bucket of buckets) {
      if (t >= bucket.start && t < bucket.end) {
        bucket.count += 1;
        break;
      }
    }
  }

  return buckets.map(b => b.count);
}

export function reworkCountForBrand(
  logs: QualityLog[],
  brandJiraValue: string,
  start: Date,
  end: Date,
): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  let count = 0;
  for (const l of logs) {
    if (l.is_deleted) continue;
    if (l.client_brand !== brandJiraValue) continue;
    const t = new Date(l.triggered_at).getTime();
    if (t >= startMs && t < endMs) count += 1;
  }
  return count;
}

export function buildCoverageRows(
  brands: Brand[],
  milestones: Milestone[],
  logs: QualityLog[],
  now: Date = new Date(),
): CoverageRow[] {
  const currentWeekStart = startOfCurrentWeek(now);
  const lastWeekStart = startOfLastWeek(now);
  const lastWeekEnd = endOfLastWeek(now);
  const rolling28Start = startOfRolling28(now);
  const currentMonthStart = startOfCurrentMonth(now);

  return brands.map(brand => {
    const testsCurrentWeek = countInWindow(milestones, brand.id, currentWeekStart, now);
    const testsLastWeek = countInWindow(milestones, brand.id, lastWeekStart, lastWeekEnd);
    const testsRolling28 = countInWindow(milestones, brand.id, rolling28Start, now);
    const testsCurrentMonth = countInWindow(milestones, brand.id, currentMonthStart, now);
    const reworkRolling28 = reworkCountForBrand(logs, brand.jira_value, rolling28Start, now);
    const droughtFlag = isInDrought(testsRolling28, brand.is_paused);
    const monthly = monthlyCounts(milestones, brand.id, 6, now);
    const monthly12 = monthlyCounts(milestones, brand.id, 12, now);
    const daily7 = dailyCounts(milestones, brand.id, 7, now);

    return {
      brand,
      testsCurrentWeek,
      testsLastWeek,
      testsRolling28,
      testsCurrentMonth,
      reworkRolling28,
      droughtFlag,
      monthly,
      monthly12,
      daily7,
    };
  });
}

// -----------------------------------------------------------------------
// Coverage KPIs (Batch 005.1). All full-scope program-health metrics:
// compute from the FULL brands / milestones arrays, NEVER `visibleRows`
// (which is filter- AND paused-scoped). The page wires these into the
// non-teal KPI cards in Phase 3.
// -----------------------------------------------------------------------

export interface CoverageHealth {
  /** active, non-paused brands NOT in drought (count > threshold in 28d). */
  coveredCount: number;
  /** active, non-paused brands (the denominator). */
  totalCount: number;
  /** round(coveredCount / totalCount * 100); null when totalCount === 0 → render '—'. */
  healthPct: number | null;
}

/**
 * Overall Health % AND Brands Covered (N/M) in a SINGLE pass over brands —
 * they are literally the same numerator/denominator (hard constraint #4).
 * "Covered" derives from the shared `isInDrought` predicate so it can never
 * diverge from the Output-table DROUGHT pill (hard constraint #1).
 *
 * Brands Covered display = `${coveredCount}/${totalCount}` (render '—' when
 * totalCount === 0). Overall Health = healthPct (already '—'-guarded).
 *
 * Paused and inactive brands are excluded from the denominator per spec §3.1.
 */
export function computeCoverageHealth(
  brands: Brand[],
  milestones: Milestone[],
  now: Date = new Date(),
): CoverageHealth {
  const rolling28Start = new Date(now);
  rolling28Start.setDate(rolling28Start.getDate() - 28);
  const counts = countsByBrand(milestones, rolling28Start, now);

  let coveredCount = 0;
  let totalCount = 0;
  for (const brand of brands) {
    if (!brand.is_active) continue; // spec §3.1: "active brands"
    if (brand.is_paused) continue; // excluded from the denominator
    // 010.2 swap point: read the per-brand contracted target here
    // (e.g. brand.contract_milestones_per_month) instead of the flat
    // constant. The loop already reads `target` per brand, so the swap
    // is THIS ONE LINE.
    //
    // And it is now a genuinely better-shaped swap than it was: the local
    // was already named `target`, and as of 2026-08-03 the constant it
    // reads is a TARGET compared with strict-less-than, so a contracted
    // "4 tests a month" drops in verbatim with no mental -1.
    const target = COVERAGE_TARGET;
    const count = counts.get(brand.id) ?? 0;
    if (!isInDrought(count, brand.is_paused, target)) coveredCount += 1;
    totalCount += 1;
  }

  return {
    coveredCount,
    totalCount,
    healthPct: totalCount === 0 ? null : Math.round((coveredCount / totalCount) * 100),
  };
}

export interface QualityScore {
  /** distinct tickets that reached Dev Client Review in the 28d window. */
  deliveredCount: number;
  /** distinct delivered tickets with ≥1 in-window rework. */
  dirtyCount: number;
  /** deliveredCount - dirtyCount. */
  cleanCount: number;
  /** round(cleanCount / deliveredCount * 100); null when deliveredCount === 0 → render '—'. */
  scorePct: number | null;
}

const DELIVERED_MILESTONE_TYPE = 'dev_client_review';

/**
 * CLEAN DELIVERY RATE % — of the distinct tickets delivered (reached Dev
 * Client Review) in the last 28 days, what % had zero rework in that same
 * window. HIGH % = GOOD.
 *
 * Renamed from "Quality Score" on 2026-08-03. The measure never changed;
 * the old label overclaimed. This is one narrow ratio — clean vs reworked
 * among recently delivered tickets — and calling it "quality" implied a
 * composite judgement it does not make (it says nothing about severity,
 * root cause, or anything not delivered in-window). This docblock already
 * said "clean-delivery rate" before the rename; the label just caught up.
 * The FUNCTION and TYPE names are deliberately left as computeQualityScore
 * / QualityScore — renaming exported identifiers is churn across call
 * sites and tests for no user-visible gain, and this batch is about what
 * the UI claims.
 *
 * - Distinct TICKETS, not rework events: a ticket bounced 3× counts once.
 * - The dirty set is INTERSECTED with the delivered set (load-bearing) so a
 *   rework on a ticket NOT delivered in-window can't poison the score.
 * - Window semantics are intentional: a ticket delivered in-window whose
 *   only rework predates the window reads CLEAN (rolling recent-quality,
 *   not lifetime-clean).
 * - milestone_type filter is stricter than the type-agnostic shared count
 *   helpers; harmless today (only dev_client_review is ever written) —
 *   reconcile when a second milestone_type lands (spec §3.3).
 */
export function computeQualityScore(
  milestones: Milestone[],
  logs: QualityLog[],
  now: Date = new Date(),
): QualityScore {
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 28);
  const startMs = windowStart.getTime();
  const endMs = now.getTime();

  const delivered = new Set<string>();
  for (const m of milestones) {
    if (m.is_deleted) continue;
    if (m.milestone_type !== DELIVERED_MILESTONE_TYPE) continue;
    const t = new Date(m.reached_at).getTime();
    if (t < startMs || t >= endMs) continue;
    delivered.add(m.jira_ticket_id);
  }

  const dirty = new Set<string>();
  for (const l of logs) {
    if (l.is_deleted) continue;
    const t = new Date(l.triggered_at).getTime();
    if (t < startMs || t >= endMs) continue;
    if (!delivered.has(l.jira_ticket_id)) continue; // intersection — load-bearing
    dirty.add(l.jira_ticket_id);
  }

  const deliveredCount = delivered.size;
  const dirtyCount = dirty.size;
  const cleanCount = deliveredCount - dirtyCount;

  return {
    deliveredCount,
    dirtyCount,
    cleanCount,
    scorePct: deliveredCount === 0 ? null : Math.round((cleanCount / deliveredCount) * 100),
  };
}
