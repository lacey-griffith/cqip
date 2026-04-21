'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { ChevronDown, ChevronRight, FileDown, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/components/layout/theme-provider';
import {
  type DateRange,
  type QualityLog,
  downloadCsv,
  formatDateRange,
  printReport,
  priorRange,
} from '@/components/reports/common';
import { useLoadingMessage } from '@/lib/easter-eggs/use-loading-message';
import { cn } from '@/lib/utils';

const SELECT = 'id, triggered_at, jira_ticket_id, jira_ticket_url, client_brand, severity, log_status, issue_category, root_cause_final, root_cause_initial, who_owns_fix, preventable, resolved_at, log_number, notes, jira_summary, project_key';

interface Props {
  range: DateRange;
}

interface RootCauseRow {
  cause: string;
  count: number;
  pct: number;
  clients: string[];
  topOwner: string | null;
  priorCount: number;
  trendPct: number | null;
  preventable: boolean;
  topCategories: Array<{ name: string; count: number }>;
  avgSeverity: string;
}

function modeOf(values: string[]): string | null {
  if (values.length === 0) return null;
  const tally: Record<string, number> = {};
  for (const v of values) tally[v] = (tally[v] || 0) + 1;
  return Object.entries(tally).sort(([, a], [, b]) => b - a)[0][0];
}

function explodeByRootCause(logs: QualityLog[]): Array<{ cause: string; log: QualityLog }> {
  const out: Array<{ cause: string; log: QualityLog }> = [];
  for (const log of logs) {
    if (!Array.isArray(log.root_cause_final)) continue;
    for (const cause of log.root_cause_final) {
      if (typeof cause === 'string' && cause.trim()) out.push({ cause, log });
    }
  }
  return out;
}

function weekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const sunday = new Date(d.getTime() - day * 86_400_000);
  return sunday.toISOString().slice(0, 10);
}

export function RootCauseReport({ range }: Props) {
  const [loading, setLoading] = useState(true);
  const [currentLogs, setCurrentLogs] = useState<QualityLog[]>([]);
  const [priorLogs, setPriorLogs] = useState<QualityLog[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [generatedAt] = useState(() => new Date());
  const loadingMessage = useLoadingMessage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridStroke = isDark ? '#2D3148' : '#E8D5C4';
  const axisColor = isDark ? '#94A3B8' : '#6B7280';
  const tooltipStyle = {
    background: isDark ? '#1E2235' : '#FFFFFF',
    border: `1px solid ${isDark ? '#2D3148' : '#E8D5C4'}`,
    borderRadius: 12,
    color: isDark ? '#E2E8F0' : '#1A1A2E',
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const prior = priorRange(range);
      const [curr, prev] = await Promise.all([
        supabase.from('quality_logs').select(SELECT).eq('is_deleted', false).gte('triggered_at', range.startISO).lte('triggered_at', range.endISO),
        supabase.from('quality_logs').select(SELECT).eq('is_deleted', false).gte('triggered_at', prior.startISO).lte('triggered_at', prior.endISO),
      ]);
      if (cancelled) return;
      setCurrentLogs((curr.data ?? []) as QualityLog[]);
      setPriorLogs((prev.data ?? []) as QualityLog[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [range.startISO, range.endISO]);

  const rows = useMemo<RootCauseRow[]>(() => {
    const currExploded = explodeByRootCause(currentLogs);
    const priorExploded = explodeByRootCause(priorLogs);
    const priorCounts: Record<string, number> = {};
    for (const { cause } of priorExploded) priorCounts[cause] = (priorCounts[cause] || 0) + 1;

    const grouped = new Map<string, QualityLog[]>();
    for (const { cause, log } of currExploded) {
      const arr = grouped.get(cause) ?? [];
      arr.push(log);
      grouped.set(cause, arr);
    }

    const total = currExploded.length || 1;
    const result: RootCauseRow[] = [];
    for (const [cause, logs] of grouped) {
      const clients = Array.from(new Set(logs.map(l => l.client_brand).filter((c): c is string => !!c)));
      const owners = logs.map(l => l.who_owns_fix).filter((o): o is string => !!o);
      const topOwner = modeOf(owners);
      const priorCount = priorCounts[cause] ?? 0;
      const trendPct = priorCount === 0 ? null : ((logs.length - priorCount) / priorCount) * 100;
      const preventable = logs.some(l => l.preventable === true);
      const categoryTally: Record<string, number> = {};
      for (const l of logs) {
        if (!Array.isArray(l.issue_category)) continue;
        for (const c of l.issue_category) categoryTally[c] = (categoryTally[c] || 0) + 1;
      }
      const topCategories = Object.entries(categoryTally)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      const sevWeights: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      const sevs = logs.map(l => l.severity).filter((s): s is string => !!s);
      const avgWeight = sevs.length === 0 ? 0 : sevs.reduce((acc, s) => acc + (sevWeights[s] ?? 0), 0) / sevs.length;
      const avgSeverity = avgWeight >= 3.5 ? 'Critical' : avgWeight >= 2.5 ? 'High' : avgWeight >= 1.5 ? 'Medium' : avgWeight > 0 ? 'Low' : '—';
      result.push({
        cause,
        count: logs.length,
        pct: (logs.length / total) * 100,
        clients,
        topOwner,
        priorCount,
        trendPct,
        preventable,
        topCategories,
        avgSeverity,
      });
    }
    return result.sort((a, b) => b.count - a.count);
  }, [currentLogs, priorLogs]);

  const weeklyTrend = useMemo(() => {
    const top3 = rows.slice(0, 3).map(r => r.cause);
    if (top3.length === 0) return [];
    const byWeek: Record<string, Record<string, number>> = {};
    for (const { cause, log } of explodeByRootCause(currentLogs)) {
      if (!top3.includes(cause)) continue;
      const wk = weekKey(log.triggered_at);
      byWeek[wk] = byWeek[wk] || {};
      byWeek[wk][cause] = (byWeek[wk][cause] || 0) + 1;
    }
    const weeks = Object.keys(byWeek).sort();
    return weeks.map(week => {
      const row: Record<string, string | number> = { week };
      for (const cause of top3) row[cause] = byWeek[week]?.[cause] ?? 0;
      return row;
    });
  }, [rows, currentLogs]);

  const top3 = rows.slice(0, 3).map(r => r.cause);

  const summaryLines = useMemo(() => {
    if (rows.length === 0) return ['✅ No root causes recorded for this period.'];
    const lines: string[] = [];
    const top = rows[0];
    lines.push(`#1 root cause is ${top.cause} at ${top.pct.toFixed(0)}% of all issues.`);
    if (top.pct > 50) {
      lines.push(`⚠️ ${top.cause} dominates this period. Addressing this single issue could eliminate over half of all rework.`);
    }
    if (top.trendPct != null && top.trendPct > 25) {
      lines.push(`📈 ${top.cause} increased ${top.trendPct.toFixed(0)}% from last period — worth investigating.`);
    }
    if (top.preventable) {
      lines.push('💡 The #1 root cause is marked as preventable. A targeted process change could have significant impact.');
    }
    return lines;
  }, [rows]);

  if (loading) {
    return (
      <Card className="border-[color:var(--f92-border)] bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-[color:var(--f92-gray)]">{loadingMessage}</p>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="border-[color:var(--f92-border)] bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-[color:var(--f92-gray)]">No data for this period. Try a different date range.</p>
      </Card>
    );
  }

  function exportCsv() {
    const csvRows = rows.map(r => ({
      root_cause: r.cause,
      occurrences: r.count,
      percent_of_total: r.pct.toFixed(2),
      clients_affected: r.clients.join('; '),
      top_owner: r.topOwner ?? '',
      prior_period_count: r.priorCount,
      trend_pct: r.trendPct != null ? r.trendPct.toFixed(2) : '',
      preventable: r.preventable ? 'yes' : 'no',
      avg_severity: r.avgSeverity,
    }));
    downloadCsv(`root-causes-${new Date().toISOString().slice(0, 10)}.csv`, csvRows);
  }

  const lineColors = ['#F47920', '#1E2D6B', '#16A34A'];

  return (
    <Card className="cqip-report-print-root border-[color:var(--f92-border)] bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Report</p>
          <h2 className="mt-1 text-2xl font-semibold text-[color:var(--f92-dark)]">Root Cause Breakdown</h2>
          <p className="mt-1 text-sm text-[color:var(--f92-gray)]">
            {formatDateRange(range)} · generated {generatedAt.toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2" data-print="hide">
          <Button variant="outline" size="sm" onClick={printReport}>
            <Printer className="mr-1 h-4 w-4" aria-hidden="true" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <FileDown className="mr-1 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Ranked table */}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-widest text-[color:var(--f92-gray)]">
              <th className="px-2 py-2 font-semibold">#</th>
              <th className="px-2 py-2 font-semibold">Root cause</th>
              <th className="px-2 py-2 font-semibold">Count</th>
              <th className="px-2 py-2 font-semibold">% of total</th>
              <th className="px-2 py-2 font-semibold">Clients</th>
              <th className="px-2 py-2 font-semibold">Top owner</th>
              <th className="px-2 py-2 font-semibold">Trend</th>
              <th className="px-2 py-2 font-semibold" aria-label="expand">{' '}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const isOpen = !!expanded[r.cause];
              return (
                <>
                  <tr key={r.cause} className="border-t border-[color:var(--f92-border)]">
                    <td className="px-2 py-2">{idx + 1}</td>
                    <td className="px-2 py-2 font-medium text-[color:var(--f92-dark)]">
                      {r.cause}
                      {r.preventable ? (
                        <span className="ml-2 rounded-full bg-[color:var(--f92-tint)] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
                          preventable
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">{r.count}</td>
                    <td className="px-2 py-2">{r.pct.toFixed(1)}%</td>
                    <td className="px-2 py-2">{r.clients.length}</td>
                    <td className="px-2 py-2">{r.topOwner ?? '—'}</td>
                    <td className="px-2 py-2">
                      {r.trendPct == null ? (
                        <span className="text-xs text-[color:var(--f92-gray)]">—</span>
                      ) : (
                        <span className={cn('text-xs', r.trendPct > 0 ? 'text-red-600' : r.trendPct < 0 ? 'text-green-600' : 'text-[color:var(--f92-gray)]')}>
                          {r.trendPct > 0 ? '↑' : r.trendPct < 0 ? '↓' : '•'} {Math.abs(r.trendPct).toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setExpanded(prev => ({ ...prev, [r.cause]: !prev[r.cause] }))}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Collapse ${r.cause} detail` : `Expand ${r.cause} detail`}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--f92-gray)] hover:bg-[color:var(--f92-tint)] hover:text-[color:var(--f92-orange)]"
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={8} className="bg-[color:var(--f92-tint)] px-4 py-3">
                        <div className="grid gap-3 text-xs md:grid-cols-3">
                          <div>
                            <p className="font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">Clients affected</p>
                            <p className="mt-1 text-[color:var(--f92-dark)]">{r.clients.length === 0 ? '—' : r.clients.join(', ')}</p>
                          </div>
                          <div>
                            <p className="font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">Top issue categories</p>
                            <p className="mt-1 text-[color:var(--f92-dark)]">
                              {r.topCategories.length === 0 ? '—' : r.topCategories.map(c => `${c.name} (${c.count})`).join(', ')}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">Avg severity</p>
                            <p className="mt-1 text-[color:var(--f92-dark)]">{r.avgSeverity}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--f92-border)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-navy)]">Frequency</h3>
          <ResponsiveContainer width="100%" height={Math.max(240, rows.slice(0, 8).length * 32)}>
            <BarChart data={rows.slice(0, 8)} layout="vertical" margin={{ top: 10, right: 20, left: 120, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis type="number" fontSize={11} stroke={axisColor} tick={{ fill: axisColor }} />
              <YAxis dataKey="cause" type="category" fontSize={10} width={115} stroke={axisColor} tick={{ fill: axisColor }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#F47920" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-[color:var(--f92-border)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-navy)]">
            Top 3 over time (weekly)
          </h3>
          {weeklyTrend.length === 0 ? (
            <p className="mt-4 text-xs text-[color:var(--f92-gray)]">Not enough data to plot a trend.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={weeklyTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="week" fontSize={10} stroke={axisColor} tick={{ fill: axisColor }} />
                <YAxis fontSize={11} stroke={axisColor} tick={{ fill: axisColor }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {top3.map((cause, i) => (
                  <Line
                    key={cause}
                    type="monotone"
                    dataKey={cause}
                    stroke={lineColors[i]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 rounded-2xl border border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-navy)]">Summary</h3>
        <div className="mt-2 space-y-1.5 text-sm text-[color:var(--f92-dark)]">
          {summaryLines.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      </div>
    </Card>
  );
}
