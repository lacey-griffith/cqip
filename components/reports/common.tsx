'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QualityLog {
  id: string;
  triggered_at: string;
  jira_ticket_id: string;
  jira_ticket_url: string | null;
  client_brand: string | null;
  severity: string | null;
  log_status: string;
  issue_category: string[] | null;
  root_cause_final: string[] | null;
  root_cause_initial: string[] | null;
  who_owns_fix: string | null;
  preventable: boolean | null;
  resolved_at: string | null;
  log_number: number;
  notes: string | null;
  jira_summary: string | null;
  project_key: string;
}

export interface DateRange {
  startISO: string; // inclusive start (UTC ISO)
  endISO: string; // inclusive end (UTC ISO)
}

export function formatDateRange(range: DateRange): string {
  const a = new Date(range.startISO);
  const b = new Date(range.endISO);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  return `${fmt(a)} → ${fmt(b)}`;
}

export function rangeDays(range: DateRange): number {
  const ms = new Date(range.endISO).getTime() - new Date(range.startISO).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** Compute the equivalent prior period (same length, ending the day before start). */
export function priorRange(range: DateRange): DateRange {
  const days = rangeDays(range);
  const start = new Date(range.startISO);
  const end = new Date(start.getTime() - 86_400_000);
  const priorStart = new Date(end.getTime() - (days - 1) * 86_400_000);
  return {
    startISO: priorStart.toISOString().slice(0, 10) + 'T00:00:00Z',
    endISO: end.toISOString().slice(0, 10) + 'T23:59:59Z',
  };
}

export function toStartISO(dateStr: string): string {
  return `${dateStr}T00:00:00Z`;
}

export function toEndISO(dateStr: string): string {
  return `${dateStr}T23:59:59Z`;
}

/** Count unique tickets in a log set. */
export function uniqueTickets(logs: QualityLog[]): number {
  return new Set(logs.map(l => l.jira_ticket_id)).size;
}

/** Average days between triggered_at and resolved_at for resolved logs. */
export function avgResolveDays(logs: QualityLog[]): number | null {
  const resolved = logs.filter(l => l.resolved_at && l.triggered_at);
  if (resolved.length === 0) return null;
  const totalMs = resolved.reduce(
    (acc, l) => acc + (new Date(l.resolved_at!).getTime() - new Date(l.triggered_at).getTime()),
    0,
  );
  return Math.round((totalMs / resolved.length / 86_400_000) * 10) / 10;
}

/** Count occurrences of each value across an array-valued field. */
export function tallyArrayField<K extends keyof QualityLog>(
  logs: QualityLog[],
  field: K,
): Array<{ name: string; count: number }> {
  const tally: Record<string, number> = {};
  for (const log of logs) {
    const raw = log[field] as unknown;
    if (!Array.isArray(raw)) continue;
    for (const value of raw as string[]) {
      if (typeof value !== 'string' || !value.trim()) continue;
      tally[value] = (tally[value] || 0) + 1;
    }
  }
  return Object.entries(tally)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Count occurrences of a scalar field. */
export function tallyScalarField<K extends keyof QualityLog>(
  logs: QualityLog[],
  field: K,
): Array<{ name: string; count: number }> {
  const tally: Record<string, number> = {};
  for (const log of logs) {
    const raw = log[field];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    tally[raw] = (tally[raw] || 0) + 1;
  }
  return Object.entries(tally)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function percentChange(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null;
  return ((current - prior) / prior) * 100;
}

interface DeltaProps {
  current: number;
  prior: number;
  /** When true, an increase is "bad" (e.g. rework events going up). */
  higherIsWorse?: boolean;
}

export function DeltaBadge({ current, prior, higherIsWorse = true }: DeltaProps) {
  const change = percentChange(current, prior);
  if (change === null) {
    return <span className="text-xs text-[color:var(--f92-gray)]">no prior data</span>;
  }
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[color:var(--f92-gray)]">
        <Minus className="h-3 w-3" aria-hidden="true" />
        0%
      </span>
    );
  }
  const up = change > 0;
  const good = up ? !higherIsWorse : higherIsWorse;
  const color = good ? 'text-green-600' : 'text-red-600';
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', color)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

interface KpiTileProps {
  label: string;
  value: string | number;
  sublabel?: string;
  delta?: React.ReactNode;
}

export function KpiTile({ label, value, sublabel, delta }: KpiTileProps) {
  return (
    <div className="rounded-2xl border border-[color:var(--f92-border)] bg-white p-4 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-widest text-[color:var(--f92-gray)]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[color:var(--f92-navy)]">{value}</p>
      {sublabel ? <p className="mt-1 text-xs text-[color:var(--f92-gray)]">{sublabel}</p> : null}
      {delta ? <div className="mt-2">{delta}</div> : null}
    </div>
  );
}

/** Download arbitrary rows as a CSV blob. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    // Still produce a header-only CSV is useless — emit a tiny placeholder.
    const blob = new Blob(['(no data)'], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, filename);
    return;
  }
  const headers = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach(k => set.add(k));
      return set;
    }, new Set()),
  );
  const escape = (value: unknown): string => {
    if (value == null) return '';
    const stringified = Array.isArray(value) ? value.join('; ') : String(value);
    return `"${stringified.replace(/"/g, '""')}"`;
  };
  const header = headers.map(escape).join(',');
  const body = rows.map(row => headers.map(h => escape(row[h])).join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function printReport(): void {
  if (typeof window === 'undefined') return;
  window.print();
}

export const SEVERITY_ORDER = ['Low', 'Medium', 'High', 'Critical'] as const;
export const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#DC2626',
  High: '#F97316',
  Medium: '#EAB308',
  Low: '#9CA3AF',
};
export const SEVERITY_WEIGHT: Record<string, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };

export function avgSeverity(logs: QualityLog[]): string {
  const severities = logs.map(l => l.severity).filter((s): s is string => !!s);
  if (severities.length === 0) return '—';
  const total = severities.reduce((acc, s) => acc + (SEVERITY_WEIGHT[s] ?? 0), 0);
  const avg = total / severities.length;
  if (avg >= 3.5) return 'Critical';
  if (avg >= 2.5) return 'High';
  if (avg >= 1.5) return 'Medium';
  return 'Low';
}
