'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
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
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (alerts.length === 0) {
    return (
      <div
        key="empty"
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-2xl border border-[color:var(--f92-border)] bg-white px-5 py-3 shadow-sm cqip-fade-in"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-[color:var(--f92-dark)]">All systems normal</span>
        <span className="text-xs text-[color:var(--f92-gray)]">— no active alerts</span>
        <Link
          href="/dashboard/logs"
          className="ml-auto text-xs text-[color:var(--f92-orange)] transition-colors hover:text-[color:var(--f92-navy)]"
        >
          View logs →
        </Link>
      </div>
    );
  }

  return (
    <Card
      key="populated"
      role="region"
      aria-label="Active alerts"
      aria-live="polite"
      className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm cqip-fade-in"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[color:var(--f92-navy)]">Active Alerts</h3>
        <Link
          href="/dashboard/logs"
          className="text-xs text-[color:var(--f92-orange)] hover:text-[color:var(--f92-navy)] transition-colors"
        >
          View all logs →
        </Link>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          // Source of truth for "which kind of alert" is the FK on
          // alert_events itself, not the joined data shape — protects against
          // a stale brand row or a deleted log throwing off the branch.
          const isBrandScoped = alert.log_entry_id == null && alert.brand_id != null;
          const rule = pickFirst(alert.alert_rules);
          const log = pickFirst(alert.quality_logs);
          const brand = pickFirst(alert.brands);
          const ruleName = rule?.rule_name ?? 'Alert';

          return (
            <div
              key={alert.id}
              className="group border border-[color:var(--f92-border)] rounded-lg p-3 bg-[color:var(--f92-warm)] hover:bg-white transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-[color:var(--f92-navy)]">
                    {ruleName}
                    {isBrandScoped && brand ? (
                      <span className="text-[color:var(--f92-gray)] font-normal">
                        {' '}• {brand.display_name} ({brand.brand_code})
                      </span>
                    ) : null}
                  </h4>
                  <p className="text-xs text-[color:var(--f92-gray)] mt-1">
                    {isBrandScoped
                      ? describeBrandAlert(rule)
                      : (
                        <>
                          {log?.jira_ticket_id ?? 'Unknown ticket'}
                          {log?.jira_summary ? ` • ${log.jira_summary}` : ''}
                        </>
                      )}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {!isBrandScoped && log?.severity ? (
                    <Badge
                      variant={getSeverityVariant(log.severity)}
                      className="text-xs px-2 py-0.5"
                    >
                      {log.severity}
                    </Badge>
                  ) : null}
                  <span className="text-xs text-[color:var(--f92-gray)]">
                    {formatTimeAgo(alert.triggered_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-[color:var(--f92-gray)]">
                  {isBrandScoped ? (
                    brand ? <span>Brand: {brand.brand_code}</span> : null
                  ) : (
                    <>
                      {log?.client_brand ? <span>Client: {log.client_brand}</span> : null}
                      {log?.project_key ? <span>Project: {log.project_key}</span> : null}
                    </>
                  )}
                </div>

                {isBrandScoped ? (
                  <Link
                    href="/dashboard/coverage"
                    className="text-xs text-[color:var(--f92-orange)] group-hover:text-[color:var(--f92-navy)] hover:text-[color:var(--f92-navy)] font-medium transition-colors"
                  >
                    View coverage →
                  </Link>
                ) : alert.log_entry_id ? (
                  <Link
                    href={`/dashboard/logs/${alert.log_entry_id}`}
                    className="text-xs text-[color:var(--f92-orange)] group-hover:text-[color:var(--f92-navy)] hover:text-[color:var(--f92-navy)] font-medium transition-colors"
                  >
                    View Details →
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
