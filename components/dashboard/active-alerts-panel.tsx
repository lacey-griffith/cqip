'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';

// Embedded relations from supabase-js v2 come back in two different shapes
// depending on the FK target:
//   - FK targets a unique column (e.g. rule_id → alert_rules.id PK) →
//     single object  { ... }, or null when FK is NULL
//   - FK is to-many → array [ ... ]
// Both shapes show up here. `pickFirst()` normalizes them so the render
// code below can stay shape-agnostic. Ignoring this returns undefined on
// `obj[0]` access (objects aren't arrays) and TypeError on `null[0]`,
// which together produced the dual symptoms of Batch 004.7's first cut:
// drought rows crashing AND, after the crash fix, every card falling
// through to the 'Alert' fallback because `alert_rules?.[0]` was undefined
// on the single-object payload.
type Maybe<T> = T | T[] | null | undefined;

function pickFirst<T>(rel: Maybe<T>): T | undefined {
  if (rel == null) return undefined;
  if (Array.isArray(rel)) return rel[0];
  return rel;
}

// extractBrandCode — contract:
//   Input  | Output
//   -------|--------
//   "MRR - Mr Rooter Plumbing" | "MRR"
//   "ASV - Aire Serv"          | "ASV"
//   "SPL - Spotloan"           | "SPL"
//   "ASV" (raw, pre-Phase-1)   | "ASV"   <- fallback to raw
//   null | undefined            | null
//
// CONTRACT GUARANTEES (per Batch 005.25 sub-task 6):
// - Prefix-agnostic: splits on first " - ", never assumes
//   any specific prefix ("NBLY", "SPL", future client codes).
// - Lossy-safe: an input lacking " - " falls through as-is,
//   so historical raw-code rows render correctly.
// - Pure: no I/O, no state, no side effects.
//
// DO NOT add prefix-specific logic. The brand catalog now
// spans multiple project_keys (NBLY + SPL today, client-3+
// future). Any prefix dependency here would silently
// regress §13 rule 28's Option γ writeback guarantee.
//
// No automated test exists for this function. If you change
// this function, manually verify against the input table
// above.
export function extractBrandCode(clientBrand: string | null | undefined): string | null {
  if (!clientBrand) return null;
  const code = clientBrand.split(' - ')[0]?.trim();
  return code || clientBrand;
}

interface AlertRule {
  rule_name: string;
  rule_type: string;
  config: Record<string, unknown> | null;
}

interface AlertQualityLog {
  jira_ticket_id: string;
  jira_summary?: string;
  client_brand?: string;
  project_key: string;
  severity?: string;
}

interface AlertBrand {
  id: string;
  brand_code: string;
  display_name: string;
}

interface AlertEvent {
  id: string;
  rule_id: string;
  log_entry_id: string | null;
  brand_id: string | null;
  triggered_at: string;
  notification_sent: boolean;
  resolved_at: string | null;
  alert_rules: Maybe<AlertRule>;
  quality_logs: Maybe<AlertQualityLog>;
  brands: Maybe<AlertBrand>;
}

export function ActiveAlertsPanel() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pill row overflow affordance — same pattern as the brand row in
  // components/filters/project-brand-filter.tsx. When the row overflows
  // the panel width, a chevron-right indicator fades in over the right
  // edge so the additional pills are discoverable.
  const pillRowRef = useRef<HTMLDivElement | null>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    async function fetchActiveAlerts() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('alert_events')
          .select(`
            id,
            rule_id,
            log_entry_id,
            brand_id,
            triggered_at,
            notification_sent,
            resolved_at,
            alert_rules (
              rule_name,
              rule_type,
              config
            ),
            quality_logs (
              jira_ticket_id,
              jira_summary,
              client_brand,
              project_key,
              severity
            ),
            brands (
              id,
              brand_code,
              display_name
            )
          `)
          .is('resolved_at', null)
          .order('triggered_at', { ascending: false })
          .limit(10);

        if (error) throw error;

        setAlerts((data || []) as AlertEvent[]);
      } catch (err) {
        console.error('Error fetching active alerts:', err);
        setError(err instanceof Error ? err.message : 'Failed to load alerts');
      } finally {
        setLoading(false);
      }
    }

    fetchActiveAlerts();

    const subscription = supabase
      .channel('alert_events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alert_events',
        },
        () => {
          fetchActiveAlerts();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const el = pillRowRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      const overflowing = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setCanScrollRight(overflowing);
    }
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [alerts]);

  const severityVariant: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'default'> = {
    Critical: 'critical',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
  };
  const getSeverityVariant = (severity?: string) =>
    severity ? severityVariant[severity] ?? 'default' : 'default';

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  // Brand-scoped alerts (drought) have log_entry_id IS NULL and a brand_id set.
  // Pull threshold + window from alert_rules.config — the drought evaluator
  // reads these same fields from the same row, so the rendered text matches
  // the rule the evaluator just enforced. Falls back to documented defaults
  // (threshold=2, window_days=28) when config is missing keys, mirroring the
  // evaluator's defaults.
  function describeBrandAlert(rule: AlertRule | undefined): string {
    const config = rule?.config ?? {};
    const threshold = typeof config.threshold === 'number' ? config.threshold : 2;
    const windowDays = typeof config.window_days === 'number' ? config.window_days : 28;
    const noun = threshold === 1 ? 'milestone' : 'milestones';
    return `Fewer than ${threshold} ${noun} in last ${windowDays} days`;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--f92-border)] bg-white px-5 py-3 shadow-sm cqip-fade-in">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--f92-gray)]" />
        <span className="text-sm text-[color:var(--f92-gray)]">Checking alerts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Error loading alerts: {error}
      </Card>
    );
  }

  // Shared shell — empty and populated states use the same Card +
  // heading + content-row structure so the panel height is preserved
  // when alerts toggle between empty and non-empty. The content row
  // height is driven by pill intrinsic size in the populated state;
  // the empty state mirrors the same vertical padding so the page
  // below doesn't jump as alerts come and go.
  if (alerts.length === 0) {
    return (
      <Card
        key="empty"
        role="region"
        aria-label="Active alerts"
        aria-live="polite"
        className="border-[color:var(--f92-border)] bg-white p-4 shadow-sm cqip-fade-in"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[color:var(--f92-navy)]">Active Alerts</h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-1" role="status">
          <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
          <span className="text-xs text-[color:var(--f92-gray)]">All systems normal — no active alerts</span>
        </div>
      </Card>
    );
  }

  return (
    <Card
      key="populated"
      role="region"
      aria-label="Active alerts"
      aria-live="polite"
      className="border-[color:var(--f92-border)] bg-white p-4 shadow-sm cqip-fade-in"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[color:var(--f92-navy)]">Active Alerts</h3>
      </div>

      <div className="relative min-w-0">
        <div
          ref={pillRowRef}
          className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1"
        >
        {alerts.map((alert) => {
          // Source of truth for "which kind of alert" is the FK on
          // alert_events itself, not the joined data shape — protects against
          // a stale brand row or a deleted log throwing off the branch.
          const isBrandScoped = alert.log_entry_id == null && alert.brand_id != null;
          const rule = pickFirst(alert.alert_rules);
          const log = pickFirst(alert.quality_logs);
          const brand = pickFirst(alert.brands);
          const ruleName = rule?.rule_name ?? 'Alert';

          // Pill text — brand code dominant in both cases, descriptor + time on the right.
          // Brand-scoped: "MRR drought · 3d"
          // Log-scoped:   "MOJ critical · 3d"   (brand code from log.client_brand;
          //                                       falls back to project_key if missing)
          const brandLabel = isBrandScoped
            ? brand?.brand_code ?? 'Unknown'
            : extractBrandCode(log?.client_brand) ?? log?.project_key ?? 'Unknown';

          const descriptor = isBrandScoped
            ? 'drought'
            : (log?.severity ?? 'alert').toLowerCase();

          const timeAgo = formatTimeAgo(alert.triggered_at);

          // Pill color — amber for drought, semantic ramps for severity.
          // Uses CSS vars so light/dark mode swap automatically. The vars
          // are defined in globals.css; both modes pass WCAG AA on the
          // active alerts panel surface.
          const pillToken: 'amber' | 'red' | 'coral' | 'gray' = (() => {
            if (isBrandScoped) return 'amber';
            switch (log?.severity) {
              case 'Critical': return 'red';
              case 'High':     return 'coral';
              case 'Medium':   return 'amber';
              case 'Low':      return 'gray';
              default:         return 'gray';
            }
          })();

          // Compute the destination — null means non-clickable (rare:
          // alert with neither a brand_id nor a log_entry_id).
          const href = isBrandScoped
            ? '/dashboard/coverage'
            : alert.log_entry_id
              ? `/dashboard/logs/${alert.log_entry_id}`
              : null;

          const ariaLabel = `${ruleName}${
            isBrandScoped && brand ? ` for ${brand.display_name}` : ''
          } — ${timeAgo}`;

          const pillInner = (
            <>
              <span className="font-semibold">{brandLabel}</span>
              <span className="ml-1.5" style={{ opacity: 0.85 }}>{descriptor} · {timeAgo}</span>
            </>
          );

          // Clickable pill — keyboard accessible (Enter / Space).
          if (href) {
            return (
              <span
                key={alert.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(href)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(href);
                  }
                }}
                title={`${ruleName}${log?.jira_summary ? ` — ${log.jira_summary}` : ''}`}
                aria-label={ariaLabel}
                style={{
                  backgroundColor: `var(--pill-${pillToken}-bg)`,
                  color: `var(--pill-${pillToken}-fg)`,
                  borderColor: `var(--pill-${pillToken}-border)`,
                }}
                className="inline-flex items-center text-xs px-3 py-1 rounded-full whitespace-nowrap border-[1.5px] transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"              >
                {pillInner}
              </span>
            );
          }

          // Non-clickable fallback (extremely rare).
          return (
            <span
              key={alert.id}
              title={ruleName}
              style={{
                backgroundColor: `var(--pill-${pillToken}-bg)`,
                color: `var(--pill-${pillToken}-fg)`,
                borderColor: `var(--pill-${pillToken}-border)`,
              }}
              className="inline-flex items-center text-xs px-3 py-1 rounded-full whitespace-nowrap border-[1.5px]"
            >
              {pillInner}
            </span>
          );
        })}
        </div>

        {canScrollRight ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center pl-6 pr-1"
            style={{
              background:
                'linear-gradient(to right, transparent, var(--f92-bg) 60%)',
            }}
            aria-hidden="true"
          >
            <ChevronRight className="h-4 w-4 text-[color:var(--f92-gray)]" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
