'use client';

import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  getSeverityVariant,
  getStatusVariant,
} from '@/components/logs/badge-variants';

// Minimal shape LogDrawer needs to render a row. Any consumer passing logs in
// must guarantee at least these fields; extra fields are ignored.
export interface LogDrawerQualityLog {
  id: string;
  jira_ticket_id: string;
  jira_ticket_url: string | null;
  jira_summary: string | null;
  client_brand: string | null;
  severity: string | null;
  log_status: string;
  triggered_at: string;
  log_number?: number;
}

export type LogDrawerMode = 'default' | 'rework-volume';

interface LogDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  chartName?: string;
  logs: LogDrawerQualityLog[];
  mode?: LogDrawerMode;
  onLogClick?: (logId: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function LogDrawerRow({
  log,
  mode,
  onLogClick,
}: {
  log: LogDrawerQualityLog;
  mode: LogDrawerMode;
  onLogClick?: (logId: string) => void;
}) {
  const showReworkBadge = mode === 'rework-volume' && typeof log.log_number === 'number';

  return (
    <div className="relative flex items-start gap-3 rounded-xl border border-[color:var(--f92-border)] bg-white p-3 transition hover:bg-[color:var(--f92-tint)]">
      {/* Row-wide activator. Absolute-positioned so the ticket chip below
          can keep its own external-link target without nesting interactive
          elements (WCAG 4.1.2 — no <a> inside role=button). The chip and
          the badge column sit in the relative z-10 lane on top. */}
      <button
        type="button"
        onClick={() => onLogClick?.(log.id)}
        aria-label={`Open ${log.jira_ticket_id} details`}
        className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[color:var(--f92-dark)]">
          {log.jira_summary ?? log.jira_ticket_id}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {log.jira_ticket_url ? (
            <a
              href={log.jira_ticket_url}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="relative z-10 inline-flex items-center gap-1 rounded-full bg-[color:var(--f92-orange)] px-2 py-0.5 font-semibold text-white hover:opacity-90"
            >
              {log.jira_ticket_id}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : (
            <span className="rounded-full bg-[color:var(--f92-tint)] px-2 py-0.5 font-semibold text-[color:var(--f92-dark)]">
              {log.jira_ticket_id}
            </span>
          )}
          {log.client_brand ? (
            <span className="text-[color:var(--f92-gray)]">{log.client_brand}</span>
          ) : null}
          <span className="text-[color:var(--f92-gray)]">{formatDate(log.triggered_at)}</span>
        </div>
      </div>
      <div className="relative z-10 flex shrink-0 flex-col items-end gap-1">
        {showReworkBadge ? (
          <Badge variant="default">Sendback #{log.log_number}</Badge>
        ) : log.severity ? (
          <Badge variant={getSeverityVariant(log.severity)}>{log.severity}</Badge>
        ) : null}
        <Badge variant={getStatusVariant(log.log_status)}>{log.log_status}</Badge>
      </div>
    </div>
  );
}

export function LogDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  chartName,
  logs,
  mode = 'default',
  onLogClick,
}: LogDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-xl">
        <SheetHeader className="shrink-0">
          {chartName ? (
            <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              From: {chartName}
            </p>
          ) : null}
          <SheetTitle>{title}</SheetTitle>
          {subtitle ? <SheetDescription>{subtitle}</SheetDescription> : null}
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto pr-2">
          {logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-[color:var(--f92-gray)]">
              No logs found for this filter.
            </p>
          ) : (
            <ul className="space-y-3">
              {logs.map(log => (
                <li key={log.id}>
                  <LogDrawerRow log={log} mode={mode} onLogClick={onLogClick} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
