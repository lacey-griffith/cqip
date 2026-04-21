'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, ChevronRight, FileDown, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/components/layout/theme-provider';
import {
  type DateRange,
  type QualityLog,
  SEVERITY_COLORS,
  SEVERITY_ORDER,
  avgSeverity,
  downloadCsv,
  formatDateRange,
  printReport,
  priorRange,
  tallyArrayField,
} from '@/components/reports/common';
import { useLoadingMessage } from '@/lib/easter-eggs/use-loading-message';

const SELECT = 'id, triggered_at, jira_ticket_id, jira_ticket_url, client_brand, severity, log_status, issue_category, root_cause_final, root_cause_initial, who_owns_fix, preventable, resolved_at, log_number, notes, jira_summary, project_key';

interface Props {
  range: DateRange;
}

type Health = 'healthy' | 'watch' | 'attention';

interface ClientRow {
  client: string;
  logs: QualityLog[];
  priorLogs: QualityLog[];
  count: number;
  avgSev: string;
  topCategory: string;
  uniqueTickets: number;
  sendbackRate: number; // events per ticket
  status: Health;
  hasCritical: boolean;
}

function classify(count: number, hasCritical: boolean): Health {
  if (hasCritical || count >= 6) return 'attention';
  if (count >= 3) return 'watch';
  return 'healthy';
}

function healthLabel(h: Health): string {
  return h === 'healthy' ? '🟢 Healthy' : h === 'watch' ? '🟡 Watch' : '🔴 Needs Attention';
}

export function ClientReport({ range }: Props) {
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

  const rows = useMemo<ClientRow[]>(() => {
    const byClient = new Map<string, QualityLog[]>();
    for (const log of currentLogs) {
      const key = log.client_brand || 'Unknown';
      const arr = byClient.get(key) ?? [];
      arr.push(log);
      byClient.set(key, arr);
    }
    const priorByClient = new Map<string, QualityLog[]>();
    for (const log of priorLogs) {
      const key = log.client_brand || 'Unknown';
      const arr = priorByClient.get(key) ?? [];
      arr.push(log);
      priorByClient.set(key, arr);
    }
    const out: ClientRow[] = [];
    for (const [client, logs] of byClient) {
      const hasCritical = logs.some(l => l.severity === 'Critical');
      const topCats = tallyArrayField(logs, 'issue_category');
      const topCategory = topCats[0]?.name ?? '—';
      const uniqueTickets = new Set(logs.map(l => l.jira_ticket_id)).size;
      const sendbackRate = uniqueTickets === 0 ? 0 : logs.length / uniqueTickets;
      const status = classify(logs.length, hasCritical);
      out.push({
        client,
        logs,
        priorLogs: priorByClient.get(client) ?? [],
        count: logs.length,
        avgSev: avgSeverity(logs),
        topCategory,
        uniqueTickets,
        sendbackRate,
        status,
        hasCritical,
      });
    }
    return out.sort((a, b) => b.count - a.count);
  }, [currentLogs, priorLogs]);

  const severityGrouped = useMemo(() => {
    return rows.slice(0, 8).map(row => {
      const entry: Record<string, string | number> = { client: row.client };
      for (const sev of SEVERITY_ORDER) {
        entry[sev] = row.logs.filter(l => l.severity === sev).length;
      }
      return entry;
    });
  }, [rows]);

  const summaryLines = useMemo(() => {
    const lines: string[] = [];
    const healthy = rows.filter(r => r.status === 'healthy').length;
    const attention = rows.filter(r => r.status === 'attention').length;
    lines.push(`${healthy} client${healthy === 1 ? '' : 's'} ${healthy === 1 ? 'is' : 'are'} currently healthy. ${attention} ${attention === 1 ? 'needs' : 'need'} attention.`);
    const total = rows.reduce((acc, r) => acc + r.count, 0);
    if (total > 0 && rows.length > 0) {
      const top = rows[0];
      const share = (top.count / total) * 100;
      if (share > 40) {
        lines.push(`🔴 ${top.client} accounts for ${share.toFixed(0)}% of all rework this period.`);
      }
    }
    const zeros = rows.filter(r => r.count === 0); // unlikely via current aggregation, but respect the rule
    for (const z of zeros) {
      lines.push(`✅ ${z.client} had zero rework events this period.`);
    }
    const criticalClients = rows.filter(r => r.hasCritical).length;
    if (criticalClients > 1) {
      lines.push(`⚠️ ${criticalClients} clients have open Critical severity issues requiring immediate attention.`);
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
      client: r.client,
      rework_events: r.count,
      unique_tickets: r.uniqueTickets,
      avg_severity: r.avgSev,
      top_issue_category: r.topCategory,
      sendback_rate: r.sendbackRate.toFixed(2),
      status: r.status,
      prior_period_events: r.priorLogs.length,
    }));
    downloadCsv(`clients-${new Date().toISOString().slice(0, 10)}.csv`, csvRows);
  }

  return (
    <Card className="cqip-report-print-root border-[color:var(--f92-border)] bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Report</p>
          <h2 className="mt-1 text-2xl font-semibold text-[color:var(--f92-dark)]">Client Quality Report</h2>
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

      {/* Client comparison table */}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-widest text-[color:var(--f92-gray)]">
              <th className="px-2 py-2 font-semibold">Client</th>
              <th className="px-2 py-2 font-semibold">Events</th>
              <th className="px-2 py-2 font-semibold">Avg severity</th>
              <th className="px-2 py-2 font-semibold">Top issue</th>
              <th className="px-2 py-2 font-semibold">Sendback rate</th>
              <th className="px-2 py-2 font-semibold">Status</th>
              <th className="px-2 py-2 font-semibold" aria-label="expand">{' '}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isOpen = !!expanded[r.client];
              const trend = r.priorLogs.length === 0
                ? null
                : ((r.count - r.priorLogs.length) / r.priorLogs.length) * 100;
              const latestOpen = r.logs
                .filter(l => l.log_status !== 'Resolved')
                .sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime())[0];
              return (
                <>
                  <tr key={r.client} className="border-t border-[color:var(--f92-border)]">
                    <td className="px-2 py-2 font-medium text-[color:var(--f92-dark)]">{r.client}</td>
                    <td className="px-2 py-2">{r.count}</td>
                    <td className="px-2 py-2">{r.avgSev}</td>
                    <td className="px-2 py-2">{r.topCategory}</td>
                    <td className="px-2 py-2">{r.sendbackRate.toFixed(2)} / ticket</td>
                    <td className="px-2 py-2">{healthLabel(r.status)}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setExpanded(prev => ({ ...prev, [r.client]: !prev[r.client] }))}
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Collapse ${r.client}` : `Expand ${r.client}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--f92-gray)] hover:bg-[color:var(--f92-tint)] hover:text-[color:var(--f92-orange)]"
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={7} className="bg-[color:var(--f92-tint)] px-4 py-3">
                        <div className="grid gap-3 text-xs md:grid-cols-3">
                          <div>
                            <p className="font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">Issue categories</p>
                            <p className="mt-1 text-[color:var(--f92-dark)]">
                              {tallyArrayField(r.logs, 'issue_category').slice(0, 4).map(c => `${c.name} (${c.count})`).join(', ') || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">Root causes</p>
                            <p className="mt-1 text-[color:var(--f92-dark)]">
                              {tallyArrayField(r.logs, 'root_cause_final').slice(0, 4).map(c => `${c.name} (${c.count})`).join(', ') || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">Trend vs prior</p>
                            <p className="mt-1 text-[color:var(--f92-dark)]">
                              {trend == null
                                ? 'No prior data'
                                : trend > 0
                                  ? `↑ ${trend.toFixed(0)}% — increasing`
                                  : trend < 0
                                    ? `↓ ${Math.abs(trend).toFixed(0)}% — decreasing`
                                    : 'Flat'}
                            </p>
                          </div>
                          <div className="md:col-span-3">
                            <p className="font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">Most recent open issue</p>
                            <p className="mt-1 text-[color:var(--f92-dark)]">
                              {latestOpen
                                ? `${latestOpen.jira_ticket_id} · ${latestOpen.log_status} · ${new Date(latestOpen.triggered_at).toLocaleDateString()}${latestOpen.jira_summary ? ` — ${latestOpen.jira_summary}` : ''}`
                                : 'All resolved.'}
                            </p>
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

      {/* Severity grouped bars */}
      <div className="mt-6 rounded-2xl border border-[color:var(--f92-border)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-navy)]">
          Severity by client (top 8)
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(240, severityGrouped.length * 40)}>
          <BarChart data={severityGrouped} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="client" fontSize={11} stroke={axisColor} tick={{ fill: axisColor }} />
            <YAxis fontSize={11} stroke={axisColor} tick={{ fill: axisColor }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {SEVERITY_ORDER.map(sev => (
              <Bar key={sev} dataKey={sev} stackId="severity" fill={SEVERITY_COLORS[sev]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
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
