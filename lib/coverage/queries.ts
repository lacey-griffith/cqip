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
  monthly: Array<{ monthIso: string; count: number }>;
}

// -----------------------------------------------------------------------
// Time-window helpers. All Date objects are in local TZ (matches how the
// existing logs page parses triggered_at for the filter pills).
// -----------------------------------------------------------------------

export function startOfCurrentWeek(): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  return d;
}

export function startOfLastWeek(): Date {
  const d = startOfCurrentWeek();
  d.setDate(d.getDate() - 7);
  return d;
}

export function endOfLastWeek(): Date {
  const d = startOfCurrentWeek();
  d.setMilliseconds(d.getMilliseconds() - 1);
  return d;
}

export function startOfRolling28(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 28);
  return d;
}

export function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

// -----------------------------------------------------------------------
// Drought / coverage threshold — SINGLE SOURCE OF TRUTH.
//
// The Output-table DROUGHT pill (via buildCoverageRows) and the Overall
// Health / Brands Covered KPIs (computeCoverageHealth) BOTH route their
// comparison through isInDrought() so the two surfaces are physically
// incapable of diverging (Batch 005.1 hard constraints #1 + #3). Never
// re-spell the `<= threshold` / `> threshold` inequality at a call site.
//
// THRESHOLD is a constant, NOT a live alert_rules.config fetch: the pill
// has always been hardcoded to <= 2, so reading live config for Health
// while the pill stays hardcoded would let them drift the moment an admin
// edits the rule. Parity with the pill wins this batch.
// -----------------------------------------------------------------------

export const COVERAGE_THRESHOLD = 2;

/**
 * A brand is in DROUGHT when it is not paused and reached `threshold` or
 * fewer milestones in the rolling-28d window. "Covered" is the strict
 * complement among non-paused brands (count > threshold). A brand sitting
 * exactly ON the threshold is in drought / uncovered.
 */
export function isInDrought(
  testsRolling28: number,
  isPaused: boolean,
  threshold: number = COVERAGE_THRESHOLD,
): boolean {
  return !isPaused && testsRolling28 <= threshold;
}

// -----------------------------------------------------------------------
// Aggregators.
// -----------------------------------------------------------------------

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
): Array<{ monthIso: string; count: number }> {
  const now = new Date();
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
): CoverageRow[] {
  const now = new Date();
  const currentWeekStart = startOfCurrentWeek();
  const lastWeekStart = startOfLastWeek();
  const lastWeekEnd = endOfLastWeek();
  const rolling28Start = startOfRolling28();
  const currentMonthStart = startOfCurrentMonth();

  return brands.map(brand => {
    const testsCurrentWeek = countInWindow(milestones, brand.id, currentWeekStart, now);
    const testsLastWeek = countInWindow(milestones, brand.id, lastWeekStart, lastWeekEnd);
    const testsRolling28 = countInWindow(milestones, brand.id, rolling28Start, now);
    const testsCurrentMonth = countInWindow(milestones, brand.id, currentMonthStart, now);
    const reworkRolling28 = reworkCountForBrand(logs, brand.jira_value, rolling28Start, now);
    const droughtFlag = isInDrought(testsRolling28, brand.is_paused);
    const monthly = monthlyCounts(milestones, brand.id, 6);

    return {
      brand,
      testsCurrentWeek,
      testsLastWeek,
      testsRolling28,
      testsCurrentMonth,
      reworkRolling28,
      droughtFlag,
      monthly,
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
    const target = COVERAGE_THRESHOLD;
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
 * Quality Score % — clean-delivery rate. Of the distinct tickets delivered
 * (reached Dev Client Review) in the last 28 days, what % had zero rework
 * in that same window. HIGH % = GOOD.
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
