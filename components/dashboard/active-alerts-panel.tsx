'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';

interface AlertEvent {
  id: string;
  rule_id: string;
  log_entry_id: string;
  triggered_at: string;
  notification_sent: boolean;
  resolved_at: string | null;
  alert_rules: {
    rule_name: string;
    rule_type: string;
    config: any;
  }[];
  quality_logs: {
    jira_ticket_id: string;
    jira_summary?: string;
    client_brand?: string;
    project_key: string;
    severity?: string;
  }[];
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
    <Card key="populated" className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm cqip-fade-in">
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
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="border border-[color:var(--f92-border)] rounded-lg p-3 bg-[color:var(--f92-warm)] hover:bg-white transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-[color:var(--f92-navy)]">
                  {alert.alert_rules[0]?.rule_name}
                </h4>
                <p className="text-xs text-[color:var(--f92-gray)] mt-1">
                  {alert.quality_logs[0]?.jira_ticket_id}
                  {alert.quality_logs[0]?.jira_summary && ` • ${alert.quality_logs[0].jira_summary}`}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                {alert.quality_logs[0]?.severity && (
                  <Badge
                    variant={getSeverityVariant(alert.quality_logs[0].severity)}
                    className="text-xs px-2 py-0.5"
                  >
                    {alert.quality_logs[0].severity}
                  </Badge>
                )}
                <span className="text-xs text-[color:var(--f92-gray)]">
                  {formatTimeAgo(alert.triggered_at)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-[color:var(--f92-gray)]">
                {alert.quality_logs[0]?.client_brand && (
                  <span>Client: {alert.quality_logs[0].client_brand}</span>
                )}
                <span>Project: {alert.quality_logs[0]?.project_key}</span>
              </div>

              <Link
                href={`/dashboard/logs/${alert.log_entry_id}`}
                className="text-xs text-[color:var(--f92-orange)] hover:text-[color:var(--f92-navy)] font-medium transition-colors"
              >
                View Details →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
