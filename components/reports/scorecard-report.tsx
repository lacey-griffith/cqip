'use client';

import { useEffect, useMemo, useState } from 'react';
import { Printer, FileDown } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  type DateRange,
  type QualityLog,
  KpiTile,
  DeltaBadge,
  SEVERITY_ORDER,
  SEVERITY_COLORS,
  avgResolveDays,
  downloadCsv,
  formatDateRange,
  printReport,
  priorRange,
  tallyArrayField,
  tallyScalarField,
  uniqueTickets,
} from '@/components/reports/common';
import { useLoadingMessage } from '@/lib/easter-eggs/use-loading-message';

const SELECT = 'id, triggered_at, jira_ticket_id, jira_ticket_url, client_brand, severity, log_status, issue_category, root_cause_final, root_cause_initial, who_owns_fix, preventable, resolved_at, log_number, notes, jira_summary, project_key';

interface Props {
  range: DateRange;
}

export function ScorecardReport({ range }: Props) {
  const [loading, setLoading] = useState(true);
  const [currentLogs, setCurrentLogs] = useState<QualityLog[]>([]);
  const [priorLogs, setPriorLogs] = useState<QualityLog[]>([]);
  const [generatedAt] = useState(() => new Date());
  const loadingMessage = useLoadingMessage();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const prior = priorRange(range);
      const [curr, prev] = await Promise.all([
        supabase
          .from('quality_logs')
          .select(SELECT)
          .eq('is_deleted', false)
          .gte('triggered_at', range.startISO)
          .lte('triggered_at', range.endISO),
        supabase
          .from('quality_logs')
          .select(SELECT)
          .eq('is_deleted', false)
          .gte('triggered_at', prior.startISO)
          .lte('triggered_at', prior.endISO),
      ]);
      if (cancelled) return;
      setCurrentLogs((curr.data ?? []) as QualityLog[]);
      setPriorLogs((prev.data ?? []) as QualityLog[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [range.startISO, range.endISO]);

  const stats = useMemo(() => {
    const total = currentLogs.length;
    const priorTotal = priorLogs.length;
    const tickets = uniqueTickets(currentLogs);
    const avgPerTicket = tickets > 0 ? Math.round((total / tickets) * 10) / 10 : 0;
    const priorTickets = uniqueTickets(priorLogs);
    const priorAvgPerTicket = priorTickets > 0 ? Math.round((priorLogs.length / priorTickets) * 10) / 10 : 0;
    const resolveDays = avgResolveDays(currentLogs);
    const priorResolveDays = avgResolveDays(priorLogs);
    const critical = currentLogs.filter(l => l.severity === 'Critical').length;
    const priorCritical = priorLogs.filter(l => l.severity === 'Critical').length;

    const topRootCauses = tallyArrayField(currentLogs, 'root_cause_final').slice(0, 3);
    const topClients = tallyScalarField(currentLogs, 'client_brand').slice(0, 3);

    const severityCounts = SEVERITY_ORDER.map(sev => ({
      severity: sev,
      count: currentLogs.filter(l => l.severity === sev).length,
    }));

    return {
      total,
      priorTotal,
      tickets,
      avgPerTicket,
      priorAvgPerTicket,
      resolveDays,
      priorResolveDays,
      critical,
      priorCritical,
      topRootCauses,
      topClients,
      severityCounts,
    };
  }, [currentLogs, priorLogs]);

  const summaryLines = useMemo(() => {
    const lines: string[] = [];
    if (stats.total === 0) {
      lines.push('✅ Clean period. No rework events logged. The team is crushing it. 🌟');
      return lines;
    }
    if (stats.priorTotal > 0 && stats.total < stats.priorTotal) {
      const pct = Math.round(((stats.priorTotal - stats.total) / stats.priorTotal) * 100);
      lines.push(`✅ Quality is trending in the right direction. Rework events are down ${pct}% from last period.`);
    }
    if (stats.critical > 0) {
      const avg = stats.resolveDays ?? null;
      lines.push(
        `🔴 ${stats.critical} Critical severity ${stats.critical === 1 ? 'issue was' : 'issues were'} logged${
          avg != null ? `. Average resolution time was ${avg} days` : ''
        }.`,
      );
    }
    const topClient = stats.topClients[0];
    if (topClient && stats.total > 0) {
      const share = (topClient.count / stats.total) * 100;
      if (share > 40) {
        lines.push(`📊 ${topClient.name} accounts for ${share.toFixed(0)}% of all rework events this period — worth a closer look.`);
      }
    }
    return lines;
  }, [stats]);

  if (loading) {
    return (
      <Card className="border-[color:var(--f92-border)] bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-[color:var(--f92-gray)]">{loadingMessage}</p>
      </Card>
    );
  }

  if (stats.total === 0 && stats.priorTotal === 0) {
    return (
      <Card className="border-[color:var(--f92-border)] bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-[color:var(--f92-gray)]">No data for this period. Try a different date range.</p>
      </Card>
    );
  }

  function exportCsv() {
    const rows = currentLogs.map(l => ({
      triggered_at: l.triggered_at,
      jira_ticket_id: l.jira_ticket_id,
      client_brand: l.client_brand ?? '',
      severity: l.severity ?? '',
      log_status: l.log_status,
      issue_category: l.issue_category ?? [],
      root_cause_final: l.root_cause_final ?? [],
      who_owns_fix: l.who_owns_fix ?? '',
      preventable: l.preventable ?? '',
      resolved_at: l.resolved_at ?? '',
      log_number: l.log_number,
    }));
    downloadCsv(`scorecard-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  const totalForPercent = Math.max(1, stats.total);

  return (
    <Card className="cqip-report-print-root border-[color:var(--f92-border)] bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Report</p>
          <h2 className="mt-1 text-2xl font-semibold text-[color:var(--f92-dark)]">Quality Health Scorecard</h2>
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

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Total Rework Events"
          value={stats.total}
          delta={<DeltaBadge current={stats.total} prior={stats.priorTotal} higherIsWorse />}
        />
        <KpiTile
          label="Avg Reworks / Ticket"
          value={stats.avgPerTicket.toFixed(1)}
          sublabel={`${stats.tickets} unique ticket${stats.tickets === 1 ? '' : 's'}`}
          delta={<DeltaBadge current={stats.avgPerTicket} prior={stats.priorAvgPerTicket} higherIsWorse />}
        />
        <KpiTile
          label="Avg Time to Resolve"
          value={stats.resolveDays == null ? '—' : `${stats.resolveDays}d`}
          delta={
            stats.resolveDays != null && stats.priorResolveDays != null ? (
              <DeltaBadge current={stats.resolveDays} prior={stats.priorResolveDays} higherIsWorse />
            ) : null
          }
        />
        <KpiTile
          label="Critical Issues"
          value={stats.critical}
          delta={<DeltaBadge current={stats.critical} prior={stats.priorCritical} higherIsWorse />}
        />
      </div>

      {/* Top lists + severity */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--f92-border)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-navy)]">Top root causes</h3>
          <ol className="mt-3 space-y-2">
            {stats.topRootCauses.length === 0 ? (
              <p className="text-xs text-[color:var(--f92-gray)]">None recorded.</p>
            ) : (
              stats.topRootCauses.map((cause, i) => {
                const pct = (cause.count / totalForPercent) * 100;
                return (
                  <li key={cause.name}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">
                        <span className="mr-2 inline-block w-4 text-[color:var(--f92-gray)]">{i + 1}.</span>
                        {cause.name}
                      </span>
                      <span className="text-xs text-[color:var(--f92-gray)]">{cause.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--f92-tint)]">
                      <div className="h-full rounded-full bg-[color:var(--f92-orange)]" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })
            )}
          </ol>
        </div>

        <div className="rounded-2xl border border-[color:var(--f92-border)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-navy)]">Top clients by rework</h3>
          <ol className="mt-3 space-y-2 text-sm">
            {stats.topClients.length === 0 ? (
              <p className="text-xs text-[color:var(--f92-gray)]">None recorded.</p>
            ) : (
              stats.topClients.map((client, i) => (
                <li key={client.name} className="flex items-baseline justify-between gap-2">
                  <span className="truncate">
                    <span className="mr-2 inline-block w-4 text-[color:var(--f92-gray)]">{i + 1}.</span>
                    {client.name}
                  </span>
                  <span className="text-xs text-[color:var(--f92-gray)]">{client.count}</span>
                </li>
              ))
            )}
          </ol>
        </div>

        <div className="rounded-2xl border border-[color:var(--f92-border)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-navy)]">Severity</h3>
          <div className="mt-3 space-y-2">
            {stats.severityCounts.map(({ severity, count }) => {
              const pct = (count / totalForPercent) * 100;
              return (
                <div key={severity}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span>{severity}</span>
                    <span className="text-[color:var(--f92-gray)]">{count}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[color:var(--f92-tint)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: SEVERITY_COLORS[severity] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic summary */}
      <div className="mt-6 rounded-2xl border border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--f92-navy)]">Summary</h3>
        {summaryLines.length === 0 ? (
          <p className="mt-2 text-sm text-[color:var(--f92-dark)]">
            {stats.total} rework event{stats.total === 1 ? '' : 's'} this period.
          </p>
        ) : (
          <div className="mt-2 space-y-1.5 text-sm text-[color:var(--f92-dark)]">
            {summaryLines.map((line, i) => <p key={i}>{line}</p>)}
          </div>
        )}
      </div>
    </Card>
  );
}
