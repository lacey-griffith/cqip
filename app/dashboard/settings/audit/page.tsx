'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BackToSettings } from '@/components/ui/back-to-settings';

const ALL = '__all__';

interface AuditEntry {
  id: string;
  log_entry_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
  notes: string | null;
  quality_logs: {
    jira_ticket_id: string;
    jira_summary: string | null;
  } | null;
}

const ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'AI_SUGGESTION'] as const;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function actionVariant(action: string): 'open' | 'in_progress' | 'blocked' | 'resolved' | 'default' {
  switch (action) {
    case 'CREATE':        return 'open';
    case 'UPDATE':        return 'in_progress';
    case 'DELETE':        return 'blocked';
    case 'STATUS_CHANGE': return 'resolved';
    default:              return 'default';
  }
}

export default function AuditLogPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [action, setAction] = useState('');
  const [user, setUser] = useState('');
  const [ticketFilter, setTicketFilter] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      const admin = data?.role === 'admin';
      setIsAdmin(admin);
      if (admin) loadEntries();
      else setLoading(false);
    }
    init();
  }, []);

  async function loadEntries() {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_log')
      .select(`
        id, log_entry_id, action, field_name, old_value, new_value,
        changed_by, changed_at, notes,
        quality_logs:log_entry_id ( jira_ticket_id, jira_summary )
      `)
      .order('changed_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[audit] load failed', error);
      setLoading(false);
      return;
    }
    setEntries((data ?? []) as unknown as AuditEntry[]);
    setLoading(false);
  }

  const userOptions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => { if (e.changed_by) set.add(e.changed_by); });
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (startDate && e.changed_at < startDate) return false;
      if (endDate && e.changed_at > `${endDate}T23:59:59`) return false;
      if (action && e.action !== action) return false;
      if (user && e.changed_by !== user) return false;
      if (ticketFilter) {
        const tid = e.quality_logs?.jira_ticket_id?.toLowerCase() ?? '';
        if (!tid.includes(ticketFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [entries, startDate, endDate, action, user, ticketFilter]);

  if (isAdmin === false) {
    return (
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[color:var(--f92-dark)]">Admin access required</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">You do not have permission to view the change log.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackToSettings />
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">Change Log</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
          Every create, update, delete, and status change on quality logs is recorded here. Showing the 500 most recent events.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[9rem] flex-1">
            <Label htmlFor="auditStart" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">From</Label>
            <Input id="auditStart" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="min-w-[9rem] flex-1">
            <Label htmlFor="auditEnd" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">To</Label>
            <Input id="auditEnd" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="min-w-[9rem] flex-1">
            <Label htmlFor="auditAction" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Action</Label>
            <Select value={action || ALL} onValueChange={v => setAction(v === ALL ? '' : v)}>
              <SelectTrigger id="auditAction" className="h-9 text-sm">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All actions</SelectItem>
                {ACTION_OPTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[10rem] flex-1">
            <Label htmlFor="auditUser" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">User</Label>
            <Select value={user || ALL} onValueChange={v => setUser(v === ALL ? '' : v)}>
              <SelectTrigger id="auditUser" className="h-9 text-sm">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All users</SelectItem>
                {userOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[10rem] flex-1">
            <Label htmlFor="auditTicket" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Ticket</Label>
            <Input id="auditTicket" placeholder="NBLYCRO-" value={ticketFilter} onChange={e => setTicketFilter(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[color:var(--f92-dark)]">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Ticket</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Field</th>
                <th className="px-4 py-3 font-semibold">Change</th>
                <th className="px-4 py-3 font-semibold">By</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-[color:var(--f92-gray)]">Loading change log…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-[color:var(--f92-gray)]">No matching events.</td></tr>
              ) : filtered.map(e => (
                <tr key={e.id} className="border-t border-[color:var(--f92-border)] align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-[color:var(--f92-dark)]">{formatTimestamp(e.changed_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {e.quality_logs?.jira_ticket_id ? (
                      <div className="flex flex-col">
                        <span className="font-medium text-[color:var(--f92-dark)]">{e.quality_logs.jira_ticket_id}</span>
                        {e.quality_logs.jira_summary ? (
                          <span className="text-xs text-[color:var(--f92-gray)] line-clamp-1 max-w-[24rem]">
                            {e.quality_logs.jira_summary}
                          </span>
                        ) : null}
                      </div>
                    ) : <span className="text-[color:var(--f92-gray)]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={actionVariant(e.action)}>{e.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--f92-dark)]">{e.field_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-[color:var(--f92-dark)]">
                    {e.old_value || e.new_value ? (
                      <div className="flex flex-col gap-0.5">
                        {e.old_value ? <span><span className="text-[color:var(--f92-gray)]">from:</span> {e.old_value}</span> : null}
                        {e.new_value ? <span><span className="text-[color:var(--f92-gray)]">to:</span> {e.new_value}</span> : null}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[color:var(--f92-dark)]">{e.changed_by}</td>
                  <td className="px-4 py-3 text-xs text-[color:var(--f92-gray)]">{e.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
