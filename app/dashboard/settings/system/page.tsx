'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { BackToSettings } from '@/components/ui/back-to-settings';
import {
  AC_ERROR_EVENTS,
  AC_ERROR_WINDOW_DAYS,
  AC_LIVENESS_DAYS,
  isStale,
  versionsDisagree,
  windowCutoffIso,
} from '@/lib/telemetry/ac-telemetry';

// Version is STAMPED, not hardcoded. It used to be `const APP_VERSION = 'v1.2'`
// while the CLAUDE.md footer said v2.7 and package.json said 0.1.0 — a version
// display that had been wrong for five minor releases with nothing to catch it.
// scripts/gen-build-info.js now stamps it from package.json at prebuild.
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;
const GITHUB_COMMIT_URL = 'https://github.com/lacey-griffith/cqip/commit';

const BUILD_COMMIT = process.env.NEXT_PUBLIC_BUILD_COMMIT;
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME;

interface AcLatest {
  app_version: string;
  commit: string;
  received_at: string;
}
interface AcLastError {
  event: string;
  error_kind: string | null;
  error_detail: string | null;
  received_at: string;
}
interface AcPanel {
  latest: AcLatest | null;
  firstSeenAt: string | null;
  firstSeenVersion: string | null;
  errorCount: number;
  lastError: AcLastError | null;
  rejectCount: number;
}

function formatBuildTime(iso: string | undefined): string {
  if (!iso) return 'Build info unavailable';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Build info unavailable';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SystemInfoPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [ac, setAc] = useState<AcPanel | null>(null);
  const [acLoading, setAcLoading] = useState(true);
  const [acError, setAcError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      setIsAdmin(data?.role === 'admin');
    }
    init();
  }, []);

  useEffect(() => {
    if (isAdmin !== true) return;
    let cancelled = false;

    async function loadAc() {
      const now = new Date();
      const cutoff = windowCutoffIso(AC_ERROR_WINDOW_DAYS, now);
      // Everything below is env='prod'-scoped. Dev events exist in the same
      // table (the token is provisioned to Forge dev and prod), and without
      // this scoping dev traffic would keep the liveness line quiet — a dead
      // prod would read as alive.
      try {
        // Counts use { count: 'exact', head: true } so NO rows are fetched:
        // immune by construction to the unranged-select truncation documented
        // in lib/client-library/paged-fetch.ts, which fails toward
        // "everything's fine" — the worst direction for a health panel.
        const [latestRes, errCountRes, lastErrRes, rejectRes] = await Promise.all([
          supabase
            .from('ac_telemetry')
            .select('app_version, commit, received_at')
            .eq('env', 'prod')
            .order('received_at', { ascending: false })
            .range(0, 0),
          supabase
            .from('ac_telemetry')
            .select('id', { count: 'exact', head: true })
            .eq('env', 'prod')
            .in('event', [...AC_ERROR_EVENTS])
            .gte('received_at', cutoff),
          supabase
            .from('ac_telemetry')
            .select('event, error_kind, error_detail, received_at')
            .eq('env', 'prod')
            .in('event', [...AC_ERROR_EVENTS])
            .order('received_at', { ascending: false })
            .range(0, 0),
          supabase
            .from('ac_telemetry_rejects')
            .select('id', { count: 'exact', head: true })
            .gte('received_at', cutoff),
        ]);

        if (latestRes.error) throw latestRes.error;

        const latest = (latestRes.data?.[0] as AcLatest | undefined) ?? null;

        let firstSeenAt: string | null = null;
        let firstSeenVersion: string | null = null;
        if (latest) {
          // "First seen", read from the never-pruned ledger. Deriving it from
          // ac_telemetry instead would break silently: the first row for a
          // commit is the oldest, i.e. the first thing retention deletes.
          const seenRes = await supabase
            .from('ac_version_seen')
            .select('app_version, first_seen_at')
            .eq('env', 'prod')
            .eq('commit', latest.commit)
            .range(0, 0);
          const row = seenRes.data?.[0] as
            | { app_version: string; first_seen_at: string }
            | undefined;
          firstSeenAt = row?.first_seen_at ?? null;
          firstSeenVersion = row?.app_version ?? null;
        }

        if (cancelled) return;
        setAc({
          latest,
          firstSeenAt,
          firstSeenVersion,
          errorCount: errCountRes.count ?? 0,
          lastError: (lastErrRes.data?.[0] as AcLastError | undefined) ?? null,
          rejectCount: rejectRes.count ?? 0,
        });
      } catch (err) {
        if (cancelled) return;
        // Surfaced rather than swallowed: an RLS or schema problem must not
        // look like "AC has sent nothing", which is a different diagnosis.
        setAcError(err instanceof Error ? err.message : 'Failed to load AC telemetry');
      } finally {
        if (!cancelled) setAcLoading(false);
      }
    }

    loadAc();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (isAdmin === false) {
    return (
      <div className="space-y-6">
        <BackToSettings />
        <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-[color:var(--f92-dark)]">Admin access required</h1>
          <p className="mt-2 text-sm text-[color:var(--f92-gray)]">You do not have permission to view system info.</p>
        </div>
      </div>
    );
  }

  const commitLabel = BUILD_COMMIT ?? 'dev';
  const timeLabel = formatBuildTime(BUILD_TIME);
  const canLinkCommit = Boolean(BUILD_COMMIT);

  const acStale = isStale(ac?.latest?.received_at ?? null, new Date());
  const acDisagree = versionsDisagree(
    ac?.latest?.app_version ?? null,
    ac?.firstSeenVersion ?? null,
  );

  return (
    <div className="space-y-6">
      <BackToSettings />
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">System Info</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
          Deploy verification: which bundle is live right now.
        </p>
      </div>

      <Card className="p-6">
        <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-navy)]">Dashboard (DC)</p>
        <dl className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Version</dt>
            <dd className="mt-1 text-lg font-semibold text-[color:var(--f92-dark)]">
              {APP_VERSION ?? 'unknown'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Commit</dt>
            <dd className="mt-1 font-mono text-sm text-[color:var(--f92-dark)]">
              {canLinkCommit ? (
                <a
                  href={`${GITHUB_COMMIT_URL}/${BUILD_COMMIT}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--f92-orange)] hover:underline"
                >
                  {commitLabel}
                </a>
              ) : (
                commitLabel
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Build time</dt>
            <dd className="mt-1 text-sm text-[color:var(--f92-dark)]">{timeLabel}</dd>
          </div>
        </dl>
        <p className="mt-6 text-xs text-[color:var(--f92-gray)]">
          Build time reflects when the current bundle was compiled. Deploy time may be up to a few minutes later.
        </p>
      </Card>

      <Card className="p-6">
        <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-navy)]">
          Jira QA Automation (AC)
        </p>
        <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
          AC runs inside Jira and cannot be polled, so it pushes events here. Production only.
        </p>

        {acLoading && (
          <p className="mt-4 text-sm text-[color:var(--f92-gray)]">Loading…</p>
        )}

        {!acLoading && acError && (
          <p className="mt-4 text-sm text-[color:var(--status-blocked)]">
            Could not load AC telemetry: {acError}
          </p>
        )}

        {!acLoading && !acError && !ac?.latest && (
          <p className="mt-4 text-sm text-[color:var(--f92-gray)]">
            No telemetry received yet — AC may be idle, unreachable, or not yet emitting.
          </p>
        )}

        {!acLoading && !acError && ac?.latest && (
          <>
            <dl className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Version</dt>
                <dd className="mt-1 text-lg font-semibold text-[color:var(--f92-dark)]">
                  {ac.latest.app_version}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Commit</dt>
                <dd className="mt-1 font-mono text-sm text-[color:var(--f92-dark)]">{ac.latest.commit}</dd>
              </div>
              <div>
                {/* "First seen", NOT "last deploy": this is when DC first
                    OBSERVED the commit, which lags the real deploy by however
                    long until someone ran a draft. */}
                <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
                  First seen
                </dt>
                <dd className="mt-1 text-sm text-[color:var(--f92-dark)]">
                  {formatStamp(ac.firstSeenAt)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
                  Last activity
                </dt>
                <dd className="mt-1 text-sm text-[color:var(--f92-dark)]">
                  {formatStamp(ac.latest.received_at)}
                </dd>
              </div>
              <div>
                {/* "error events", not "errors": duplicates are deduped at
                    ingest, but the figure still counts events rather than
                    distinct incidents. */}
                <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
                  Error events ({AC_ERROR_WINDOW_DAYS}d)
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[color:var(--f92-dark)]">
                  {ac.errorCount}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
                  Rejected payloads ({AC_ERROR_WINDOW_DAYS}d)
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[color:var(--f92-dark)]">
                  {ac.rejectCount}
                </dd>
              </div>
            </dl>

            {ac.lastError && (
              <p className="mt-4 text-xs text-[color:var(--f92-gray)]">
                Last error — <span className="font-mono">{ac.lastError.error_kind ?? 'unknown'}</span>{' '}
                on {formatStamp(ac.lastError.received_at)}
                {ac.lastError.error_detail ? `: ${ac.lastError.error_detail}` : ''}
              </p>
            )}

            {acDisagree && (
              <p className="mt-2 text-xs text-[color:var(--f92-gray)]">
                Version changed without a new commit — running {ac.latest.app_version}, first seen as{' '}
                {ac.firstSeenVersion} for this build.
              </p>
            )}

            {ac.rejectCount > 0 && (
              <p className="mt-2 text-xs text-[color:var(--f92-gray)]">
                AC sent {ac.rejectCount} payload(s) DC could not accept — likely a payload-shape change.
                That is a different problem from silence.
              </p>
            )}

            {acStale && (
              /* Deliberately ambiguous copy: with only draft/post events,
                 absence cannot distinguish a broken AC from a quiet week, and
                 those need opposite responses. Stating the ambiguity beats
                 implying a fault. */
              <p className="mt-2 text-xs text-[color:var(--f92-gray)]">
                No activity in {AC_LIVENESS_DAYS} days — AC may be idle or unreachable.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
