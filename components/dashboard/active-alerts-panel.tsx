'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

    // Set up real-time subscription for new alerts
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

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

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
      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[color:var(--f92-navy)] mb-4">Active Alerts</h3>
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-500">Loading alerts...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[color:var(--f92-navy)] mb-4">Active Alerts</h3>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-700 text-sm">Error loading alerts: {error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[color:var(--f92-navy)]">Active Alerts</h3>
        <Link
          href="/dashboard/logs"
          className="text-xs text-[color:var(--f92-orange)] hover:text-[color:var(--f92-navy)] transition-colors"
        >
          View all logs →
        </Link>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">✅</div>
          <p className="text-sm text-gray-500">No active alerts</p>
          <p className="text-xs text-gray-400 mt-1">All systems normal</p>
        </div>
      ) : (
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
                  <p className="text-xs text-gray-600 mt-1">
                    {alert.quality_logs[0]?.jira_ticket_id}
                    {alert.quality_logs[0]?.jira_summary && ` • ${alert.quality_logs[0].jira_summary}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {alert.quality_logs[0]?.severity && (
                    <Badge
                      variant="default"
                      className={`text-xs px-2 py-0.5 ${getSeverityColor(alert.quality_logs[0].severity)}`}
                    >
                      {alert.quality_logs[0].severity}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-500">
                    {formatTimeAgo(alert.triggered_at)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-gray-600">
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
      )}
    </Card>
  );
}
