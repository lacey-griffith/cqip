'use client';

// Batch 005.10 — persistent pass/fail indicator for jira-sync runs.
// Reads the most recent sync_runs row, polls every 30s, and exposes
// 4 visual states: never synced / running / success / failed.
// Click opens a Dialog with the run's full detail.
//
// Per CLAUDE.md §13 rule 25, all colors come from per-theme CSS tokens
// (--pill-{color}-bg / -border / -fg) — no inline hex.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type SyncRunStatus = 'running' | 'success' | 'failed';

export interface SyncRun {
  id: string;
  triggered_by: string;
  started_at: string;
  completed_at: string | null;
  status: SyncRunStatus;
  logs_updated: number | null;
  logs_failed: number | null;
  error_category: string | null;
  error_message: string | null;
  duration_ms: number | null;
}

const POLL_INTERVAL_MS = 30_000;
// If a `running` row is older than this, treat it as orphaned (the edge
// function exited abnormally — uncaught throw, container timeout, OOM —
// without recording the end). Walk past it and surface the next-most-recent
// row instead so the pill doesn't sit on "Syncing…" forever.
const STALE_RUNNING_THRESHOLD_MS = 5 * 60_000;

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const diff = Date.now() - then.getTime();
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function absoluteTime(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function describeTrigger(triggeredBy: string): string {
  if (triggeredBy.startsWith('manual:')) return triggeredBy.slice('manual:'.length);
  if (triggeredBy.startsWith('cron:')) return `cron (${triggeredBy.slice('cron:'.length)})`;
  return triggeredBy;
}

function describeErrorCategory(category: string | null): string {
  switch (category) {
    case 'auth_mismatch': return 'CQIP_SYNC_AUTH_KEY mismatch';
    case 'jira_401':      return 'Jira authentication failed (token expired/invalid)';
    case 'jira_500':      return 'Jira returned a server error';
    case 'network':       return 'Network / connection failure';
    case 'unknown':       return 'Unknown error';
    default:              return category ?? '';
  }
}

interface PillVisual {
  label: string;
  tone: 'gray' | 'blue' | 'green' | 'red';
  spinner: boolean;
  iconKind: 'clock' | 'check' | 'x' | 'spinner';
}

function deriveVisual(latest: SyncRun | null): PillVisual {
  if (!latest) {
    return { label: 'Never synced', tone: 'gray', spinner: false, iconKind: 'clock' };
  }
  if (latest.status === 'running') {
    return { label: 'Syncing…', tone: 'blue', spinner: true, iconKind: 'spinner' };
  }
  const when = relativeTime(latest.completed_at ?? latest.started_at);
  if (latest.status === 'success') {
    const count = latest.logs_updated ?? 0;
    return {
      label: `${count} log${count === 1 ? '' : 's'} · ${when}`,
      tone: 'green',
      spinner: false,
      iconKind: 'check',
    };
  }
  return { label: `Sync failed · ${when}`, tone: 'red', spinner: false, iconKind: 'x' };
}

function PillIcon({ kind }: { kind: PillVisual['iconKind'] }) {
  const cls = 'h-3 w-3';
  switch (kind) {
    case 'clock':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'check':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'x':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case 'spinner':
      return (
        <svg className={cn(cls, 'animate-spin')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      );
  }
}

interface SyncStatusPillProps {
  refreshKey?: number;
  className?: string;
}

export function SyncStatusPill({ refreshKey = 0, className }: SyncStatusPillProps) {
  const [latest, setLatest] = useState<SyncRun | null>(null);
  const [, forceTick] = useState(0); // re-render so relative-time labels stay fresh between fetches

  const fetchLatest = useCallback(async () => {
    // Fetch top 2 rows so we can step past an orphaned `running` row.
    const { data, error } = await supabase
      .from('sync_runs')
      .select('id, triggered_by, started_at, completed_at, status, logs_updated, logs_failed, error_category, error_message, duration_ms')
      .order('started_at', { ascending: false })
      .limit(2);
    if (error) {
      // Don't toast — pill just goes blank on transient read failure.
      console.warn('[sync-status-pill] fetch failed', error.message);
      return;
    }
    const rows = (data as SyncRun[] | null) ?? [];
    const top = rows[0];
    if (!top) {
      setLatest(null);
      return;
    }
    if (top.status === 'running') {
      const ageMs = Date.now() - new Date(top.started_at).getTime();
      if (ageMs > STALE_RUNNING_THRESHOLD_MS) {
        // Orphaned. Show the prior run if we have one; otherwise fall
        // back to the stale row so the pill at least reflects something.
        setLatest(rows[1] ?? top);
        return;
      }
    }
    setLatest(top);
  }, []);

  useEffect(() => {
    fetchLatest();
    const id = window.setInterval(fetchLatest, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fetchLatest, refreshKey]);

  // Tick relative-time labels every 30s independent of the data fetch.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const visual = deriveVisual(latest);

  const toneStyle = {
    backgroundColor: `var(--pill-${visual.tone}-bg)`,
    borderColor: `var(--pill-${visual.tone}-border)`,
    color: `var(--pill-${visual.tone}-fg)`,
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Sync status: ${visual.label}`}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)] focus-visible:ring-offset-2',
            className,
          )}
          style={toneStyle}
        >
          <PillIcon kind={visual.iconKind} />
          <span>{visual.label}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sync details</DialogTitle>
        </DialogHeader>
        {/*
          TODO (deferred): "View sync history" link pointing at a sync
          history view on /dashboard/settings/system. Defer until that
          page exists. When building, pull the last 50 rows from
          sync_runs ORDER BY started_at DESC and render as a table with
          columns: Time, Trigger, Status, Logs Updated/Failed,
          Duration, Error (if any). Decide admin-only vs all-users at
          build time — pill itself is universal, but the full historical
          trail might leak more than read-only users need.
        */}
        {latest ? (
          <div className="space-y-3 text-sm">
            <DetailRow label="Status" value={statusLabel(latest.status)} />
            <DetailRow label="Triggered by" value={describeTrigger(latest.triggered_by)} />
            <DetailRow label="Started" value={absoluteTime(latest.started_at)} />
            <DetailRow label="Completed" value={absoluteTime(latest.completed_at)} />
            <DetailRow label="Duration" value={formatDuration(latest.duration_ms)} />
            <DetailRow label="Logs updated" value={latest.logs_updated == null ? '—' : String(latest.logs_updated)} />
            <DetailRow label="Logs failed" value={latest.logs_failed == null ? '—' : String(latest.logs_failed)} />
            {latest.status === 'failed' && (
              <>
                <DetailRow label="Error category" value={describeErrorCategory(latest.error_category)} />
                {latest.error_message && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-[color:var(--f92-gray)]">Error message</p>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] p-2 text-xs">
                      {latest.error_message}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-[color:var(--f92-gray)]">No sync runs recorded yet.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function statusLabel(status: SyncRunStatus): string {
  switch (status) {
    case 'running': return 'Running';
    case 'success': return 'Success';
    case 'failed':  return 'Failed';
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs uppercase tracking-widest text-[color:var(--f92-gray)]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
