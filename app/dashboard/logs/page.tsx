'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

interface LogEntry {
  id: string;
  triggered_at: string;
  jira_ticket_id: string;
  jira_ticket_url: string;
  client_brand: string | null;
  severity: string | null;
  log_status: string;
  issue_category: string[] | null;
  root_cause_final: string[] | null;
  who_owns_fix: string | null;
  log_number: number;
}

interface UserProfile {
  role: 'admin' | 'read_only';
}

const severityVariant = {
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
} as const;

type SeverityVariant = (typeof severityVariant)[keyof typeof severityVariant] | 'default';

const statusVariant = {
  Open: 'open',
  'In Progress': 'in_progress',
  Blocked: 'blocked',
  'Pending Verification': 'pending',
  Resolved: 'resolved',
} as const;

type StatusVariant = (typeof statusVariant)[keyof typeof statusVariant] | 'default';

function getSeverityVariant(severity: string): SeverityVariant {
  return (severityVariant as Record<string, SeverityVariant>)[severity] ?? 'default';
}

function getStatusVariant(status: string): StatusVariant {
  return (statusVariant as Record<string, StatusVariant>)[status] ?? 'default';
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clientBrand, setClientBrand] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    async function loadData() {
      const { data: logsData } = await supabase
        .from('quality_logs')
        .select('id, triggered_at, jira_ticket_id, jira_ticket_url, client_brand, severity, log_status, issue_category, root_cause_final, who_owns_fix, log_number')
        .eq('is_deleted', false)
        .order('triggered_at', { ascending: false });

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      let profileData = null;

      if (userId) {
        const { data } = await supabase.from('user_profiles').select('role').eq('id', userId).single();
        profileData = data as UserProfile | null;
      }

      setLogs((logsData ?? []) as LogEntry[]);
      setProfile(profileData);
      setLoading(false);
    }

    loadData();
  }, []);

  const clientBrands = useMemo(
    () => Array.from(new Set(logs.map(log => log.client_brand ?? '').filter(Boolean))),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (clientBrand && log.client_brand !== clientBrand) return false;
      if (severity && log.severity !== severity) return false;
      if (status && log.log_status !== status) return false;
      if (startDate && new Date(log.triggered_at) < new Date(startDate)) return false;
      if (endDate && new Date(log.triggered_at) > new Date(endDate)) return false;
      return true;
    });
  }, [logs, clientBrand, severity, status, startDate, endDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Logs</p>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--f92-dark)]">Rework event log</h1>
        </div>
      </div>

      <Card>
        <div className="grid gap-4 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Label htmlFor="startDate">Start date</Label>
            <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="endDate">End date</Label>
            <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="clientBrand">Client brand</Label>
            <Select id="clientBrand" value={clientBrand} onChange={e => setClientBrand(e.target.value)}>
              <option value="">All brands</option>
              {clientBrands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="severity">Severity</Label>
            <Select id="severity" value={severity} onChange={e => setSeverity(e.target.value)}>
              <option value="">All severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="status">Status</Label>
            <Select id="status" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Blocked">Blocked</option>
              <option value="Pending Verification">Pending Verification</option>
              <option value="Resolved">Resolved</option>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label>&nbsp;</Label>
            <Button variant="outline" className="w-full" onClick={() => {
              setStartDate('');
              setEndDate('');
              setClientBrand('');
              setSeverity('');
              setStatus('');
            }}>
              Reset filters
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3 text-left text-sm">
            <thead>
              <tr className="text-[color:var(--f92-dark)]">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Issue category</th>
                <th className="px-4 py-3">Root cause</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">#</th>
                {profile?.role === 'admin' ? <th className="px-4 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={profile?.role === 'admin' ? 10 : 9} className="px-4 py-6 text-center text-[color:var(--f92-gray)]">
                    Loading logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={profile?.role === 'admin' ? 10 : 9} className="px-4 py-6 text-center text-[color:var(--f92-gray)]">
                    No logs found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="rounded-3xl border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)]">
                    <td className="px-4 py-3 align-top">{new Date(log.triggered_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 align-top">
                      <a href={log.jira_ticket_url} target="_blank" rel="noreferrer" className="font-medium text-[color:var(--f92-navy)] hover:underline">
                        {log.jira_ticket_id}
                      </a>
                    </td>
                    <td className="px-4 py-3 align-top">{log.client_brand ?? '—'}</td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant={getSeverityVariant(log.severity ?? '')}>
                        {log.severity ?? 'Unknown'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant={getStatusVariant(log.log_status)}>{log.log_status}</Badge>
                    </td>
                    <td className="px-4 py-3 align-top">{Array.isArray(log.issue_category) ? log.issue_category.join(', ') : '—'}</td>
                    <td className="px-4 py-3 align-top">{Array.isArray(log.root_cause_final) ? log.root_cause_final.join(', ') : '—'}</td>
                    <td className="px-4 py-3 align-top">{log.who_owns_fix ?? '—'}</td>
                    <td className="px-4 py-3 align-top">{log.log_number}</td>
                    {profile?.role === 'admin' ? (
                      <td className="px-4 py-3 align-top space-x-2">
                        <Button variant="secondary" size="sm">Edit</Button>
                        <Button variant="outline" size="sm">Delete</Button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
