// Pure client-side helpers for the Client Coverage page. No Supabase
// dependencies — callers fetch once and hand the raw arrays in. Keeping
// these as plain functions makes them trivially unit-testable and lets
// the page control its single-query fetch pattern.

export interface Brand {
  id: string;
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
    const droughtFlag = !brand.is_paused && testsRolling28 <= 2;
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
