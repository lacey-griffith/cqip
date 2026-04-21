'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface LogEntry {
  id: string;
  jira_ticket_id: string;
  jira_ticket_url: string;
  jira_summary: string | null;
  project_key: string;
  client_brand: string | null;
  trigger_from_status: string;
  trigger_to_status: string;
  triggered_at: string;
  log_number: number;
  log_status: string;
  detected_by: string | null;
  experiment_paused: boolean | null;
  issue_category: string[] | null;
  issue_subtype: string[] | null;
  issue_details: string | null;
  reproducibility: string | null;
  severity: string | null;
  resolution_type: string[] | null;
  root_cause_initial: string[] | null;
  root_cause_final: string[] | null;
  root_cause_description: string | null;
  resolution_notes: string | null;
  who_owns_fix: string | null;
  test_type: string | null;
  preventable: boolean | null;
  documentation_updated: boolean | null;
  process_improvement_needed: boolean | null;
  screenshot_urls: string[] | null;
  affected_url: string | null;
  jira_created_at: string | null;
  resolved_at: string | null;
  created_by: string;
  updated_at: string;
  ai_suggested_root_cause: string[] | null;
  ai_confidence_score: number | null;
  notes: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
  notes: string | null;
}

const statusVariant = {
  Open: 'open',
  'In Progress': 'in_progress',
  Blocked: 'blocked',
  'Pending Verification': 'pending',
  Resolved: 'resolved',
} as const;

type StatusVariant = (typeof statusVariant)[keyof typeof statusVariant] | 'default';

function getStatusVariant(status: string): StatusVariant {
  return (statusVariant as Record<string, StatusVariant>)[status] ?? 'default';
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const datePart = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

export default function LogDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [log, setLog] = useState<LogEntry | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDetails() {
      const { data: logData } = await supabase
        .from('quality_logs')
        .select('*')
        .eq('id', id)
        .single();

      if (!logData) {
        setLoading(false);
        return;
      }

      setLog(logData as LogEntry);

      const [{ data: auditData }, { data: historyData }] = await Promise.all([
        supabase
          .from('audit_log')
          .select('*')
          .eq('log_entry_id', id)
          .order('changed_at', { ascending: false }),
        supabase
          .from('quality_logs')
          .select('*')
          .eq('jira_ticket_id', logData.jira_ticket_id)
          .eq('is_deleted', false)
          .order('log_number', { ascending: true }),
      ]);

      setAuditTrail((auditData ?? []) as AuditEntry[]);
      setHistory((historyData ?? []) as LogEntry[]);
      setLoading(false);
    }

    loadDetails();
  }, [id]);

  const detailRows = useMemo(() => {
    if (!log) return [];

    return [
      ['Ticket', log.jira_ticket_id],
      ['Summary', log.jira_summary ?? '—'],
      ['Project', log.project_key],
      ['Client brand', log.client_brand ?? '—'],
      ['Trigger from', log.trigger_from_status],
      ['Trigger to', log.trigger_to_status],
      ['Triggered at', formatShortDate(log.triggered_at)],
      ['Status', log.log_status],
      ['Severity', log.severity ?? '—'],
      ['Log number', String(log.log_number)],
      ['Owner', log.who_owns_fix ?? '—'],
      ['Detected by', log.detected_by ?? '—'],
      ['Test type', log.test_type ?? 'A/B'],
      ['Experiment paused', log.experiment_paused ? 'Yes' : 'No'],
      ['Preventable', log.preventable ? 'Yes' : 'No'],
      ['Documentation updated', log.documentation_updated ? 'Yes' : 'No'],
      ['Process improvement needed', log.process_improvement_needed ? 'Yes' : 'No'],
      ['Reproducibility', log.reproducibility ?? '—'],
      ['Issue category', Array.isArray(log.issue_category) ? log.issue_category.join(', ') : '—'],
      ['Issue subtype', Array.isArray(log.issue_subtype) ? log.issue_subtype.join(', ') : '—'],
      ['Resolution type', Array.isArray(log.resolution_type) ? log.resolution_type.join(', ') : '—'],
      ['Root cause initial', Array.isArray(log.root_cause_initial) ? log.root_cause_initial.join(', ') : '—'],
      ['Root cause final', Array.isArray(log.root_cause_final) ? log.root_cause_final.join(', ') : '—'],
      ['Root cause description', log.root_cause_description ?? '—'],
      ['Resolution notes', log.resolution_notes ?? '—'],
      ['Affected URL', log.affected_url ?? '—'],
      ['Jira created at', formatDateTime(log.jira_created_at)],
      ['Resolved at', formatDateTime(log.resolved_at)],
      ['Created by', log.created_by],
      ['Updated at', formatDateTime(log.updated_at)],
      ['Notes', log.notes ?? '—'],
    ];
  }, [log]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-[color:var(--f92-dark)]">Loading log details...</div>;
  }

  if (!log) {
    return <div className="min-h-[60vh] flex items-center justify-center text-[color:var(--f92-dark)]">Log entry not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Log detail</p>
          <h1 className="mt-2 text-3xl font-semibold">
            {log.jira_ticket_url ? (
              <a
                href={log.jira_ticket_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-[color:var(--f92-orange)] hover:underline"
                aria-label={`${log.jira_ticket_id} — opens in Jira`}
              >
                {log.jira_ticket_id}
                <ExternalLink className="h-5 w-5" aria-hidden="true" />
              </a>
            ) : (
              <span className="text-[color:var(--f92-dark)]">{log.jira_ticket_id}</span>
            )}
          </h1>
          <p className="text-sm text-[color:var(--f92-gray)]">Rework history for this ticket and full audit trail.</p>
        </div>
        <Badge variant={getStatusVariant(log.log_status)}>{log.log_status}</Badge>
      </div>

      <Card>
        <div className="grid gap-5 md:grid-cols-2">
          {detailRows.map(([label, value]) => (
            <div key={label} className="space-y-1 rounded-3xl border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--f92-gray)]">{label}</p>
              <p className="text-sm text-[color:var(--f92-dark)] whitespace-pre-wrap">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--f92-dark)]">Audit trail</h2>
              <p className="text-sm text-[color:var(--f92-gray)]">Changes logged for this entry.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-[color:var(--f92-dark)]">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Field</th>
                  <th className="px-3 py-2">Old</th>
                  <th className="px-3 py-2">New</th>
                  <th className="px-3 py-2">By</th>
                </tr>
              </thead>
              <tbody>
                {auditTrail.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[color:var(--f92-gray)]">
                      No audit history available for this log.
                    </td>
                  </tr>
                ) : (
                  auditTrail.map(entry => (
                    <tr key={entry.id} className="border-t border-[color:var(--f92-border)]">
                      <td className="px-3 py-3">{new Date(entry.changed_at).toLocaleString()}</td>
                      <td className="px-3 py-3">{entry.action}</td>
                      <td className="px-3 py-3">{entry.field_name ?? '—'}</td>
                      <td className="px-3 py-3">{entry.old_value ?? '—'}</td>
                      <td className="px-3 py-3">{entry.new_value ?? '—'}</td>
                      <td className="px-3 py-3">{entry.changed_by}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--f92-dark)]">Ticket history</h2>
            <p className="text-sm text-[color:var(--f92-gray)]">All rework logs for this Jira ticket.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-[color:var(--f92-dark)]">
                  <th className="px-3 py-2">Log #</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Root cause</th>
                </tr>
              </thead>
              <tbody>
                {history.map(entry => (
                  <tr key={entry.id} className="border-t border-[color:var(--f92-border)]">
                    <td className="px-3 py-3">{entry.log_number}</td>
                    <td className="px-3 py-3">{formatShortDate(entry.triggered_at)}</td>
                    <td className="px-3 py-3">
                      <Badge variant={getStatusVariant(entry.log_status)}>{entry.log_status}</Badge>
                    </td>
                    <td className="px-3 py-3">{entry.severity ?? '—'}</td>
                    <td className="px-3 py-3">{entry.who_owns_fix ?? '—'}</td>
                    <td className="px-3 py-3">{Array.isArray(entry.root_cause_final) ? entry.root_cause_final.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
