'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { EditLogDialog, type EditableLog } from '@/components/logs/edit-log-dialog';
import { cn } from '@/lib/utils';

const ALL = '__all__';

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
  notes: string | null;
  resolution_notes: string | null;
}

interface UserProfile {
  role: 'admin' | 'read_only';
}

interface TicketGroup {
  ticketId: string;
  ticketUrl: string;
  latest: LogEntry;
  entries: LogEntry[]; // sorted by triggered_at desc
}

type SortKey = 'date' | 'brand' | 'severity' | 'status' | 'category';
type SortDir = 'asc' | 'desc';

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

const SEVERITY_RANK: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const STATUS_RANK: Record<string, number> = {
  Open: 5,
  'In Progress': 4,
  Blocked: 3,
  'Pending Verification': 2,
  Resolved: 1,
};

function getSeverityVariant(severity: string): SeverityVariant {
  return (severityVariant as Record<string, SeverityVariant>)[severity] ?? 'default';
}

function getStatusVariant(status: string): StatusVariant {
  return (statusVariant as Record<string, StatusVariant>)[status] ?? 'default';
}

function formatTriggeredDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function compareNullable<T>(a: T | null | undefined, b: T | null | undefined, getter: (v: T) => number | string): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const av = getter(a);
  const bv = getter(b);
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av).localeCompare(String(bv));
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

  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [editingLog, setEditingLog] = useState<EditableLog | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadData() {
      const { data: logsData } = await supabase
        .from('quality_logs')
        .select('id, triggered_at, jira_ticket_id, jira_ticket_url, client_brand, severity, log_status, issue_category, root_cause_final, who_owns_fix, log_number, notes, resolution_notes')
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

      // Egg #10 — count audit_log rows per log so we can flag heavily-edited entries.
      const ids = (logsData ?? []).map(l => l.id);
      if (ids.length > 0) {
        const { data: auditRows } = await supabase
          .from('audit_log')
          .select('log_entry_id')
          .in('log_entry_id', ids);
        const counts: Record<string, number> = {};
        (auditRows ?? []).forEach((row: { log_entry_id: string }) => {
          counts[row.log_entry_id] = (counts[row.log_entry_id] || 0) + 1;
        });
        setAuditCounts(counts);
      }
    }

    loadData();
  }, []);

  const clientBrands = useMemo(
    () => Array.from(new Set(logs.map(log => log.client_brand ?? '').filter(Boolean))).sort(),
    [logs],
  );

  const clientBrandOptions = useMemo(
    () => [
      { value: ALL, label: 'All brands' },
      ...clientBrands.map(b => ({ value: b, label: b })),
    ],
    [clientBrands],
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

  const groupedTickets = useMemo<TicketGroup[]>(() => {
    const map = new Map<string, LogEntry[]>();
    for (const log of filteredLogs) {
      const arr = map.get(log.jira_ticket_id) ?? [];
      arr.push(log);
      map.set(log.jira_ticket_id, arr);
    }
    const groups: TicketGroup[] = [];
    for (const [ticketId, entries] of map) {
      const sorted = [...entries].sort(
        (a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime(),
      );
      groups.push({
        ticketId,
        ticketUrl: sorted[0].jira_ticket_url,
        latest: sorted[0],
        entries: sorted,
      });
    }
    return groups;
  }, [filteredLogs]);

  const sortedGroups = useMemo<TicketGroup[]>(() => {
    const dirMul = sortDir === 'asc' ? 1 : -1;
    return [...groupedTickets].sort((a, b) => {
      switch (sortKey) {
        case 'date':
          return dirMul * (new Date(a.latest.triggered_at).getTime() - new Date(b.latest.triggered_at).getTime());
        case 'brand':
          return dirMul * compareNullable(a.latest.client_brand, b.latest.client_brand, v => v);
        case 'severity':
          return dirMul * ((SEVERITY_RANK[a.latest.severity ?? ''] ?? 0) - (SEVERITY_RANK[b.latest.severity ?? ''] ?? 0));
        case 'status':
          return dirMul * ((STATUS_RANK[a.latest.log_status] ?? 0) - (STATUS_RANK[b.latest.log_status] ?? 0));
        case 'category': {
          const aCat = Array.isArray(a.latest.issue_category) ? a.latest.issue_category[0] ?? '' : '';
          const bCat = Array.isArray(b.latest.issue_category) ? b.latest.issue_category[0] ?? '' : '';
          return dirMul * aCat.localeCompare(bCat);
        }
        default:
          return 0;
      }
    });
  }, [groupedTickets, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
  }

  function toggleExpand(ticketId: string) {
    setExpanded(prev => ({ ...prev, [ticketId]: !prev[ticketId] }));
  }

  function openEditDialog(log: LogEntry) {
    setEditingLog({
      id: log.id,
      jira_ticket_id: log.jira_ticket_id,
      log_status: log.log_status,
      severity: log.severity,
      who_owns_fix: log.who_owns_fix,
      root_cause_final: log.root_cause_final,
      resolution_notes: log.resolution_notes,
      notes: log.notes,
    });
    setEditOpen(true);
  }

  function applyEditedLog(updated: EditableLog) {
    setLogs(prev =>
      prev.map(l =>
        l.id === updated.id
          ? {
              ...l,
              log_status: updated.log_status,
              severity: updated.severity,
              who_owns_fix: updated.who_owns_fix,
              root_cause_final: updated.root_cause_final,
              resolution_notes: updated.resolution_notes,
              notes: updated.notes,
            }
          : l,
      ),
    );
  }

  function SortIcon({ active }: { active: boolean }) {
    if (!active) return <ChevronsUpDown className="ml-1 inline h-3 w-3 text-[color:var(--f92-lgray)]" aria-hidden="true" />;
    return sortDir === 'asc'
      ? <ChevronUp className="ml-1 inline h-3 w-3 text-[color:var(--f92-orange)]" aria-hidden="true" />
      : <ChevronDown className="ml-1 inline h-3 w-3 text-[color:var(--f92-orange)]" aria-hidden="true" />;
  }

  function SortableHeader({ k, label, className }: { k: SortKey; label: string; className?: string }) {
    const active = sortKey === k;
    return (
      <th className={cn('px-4 py-3', className)} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className="inline-flex items-center font-semibold text-[color:var(--f92-dark)] hover:text-[color:var(--f92-navy)] focus-visible:outline-none focus-visible:underline"
        >
          {label}
          <SortIcon active={active} />
        </button>
      </th>
    );
  }

  const colCount = profile?.role === 'admin' ? 10 : 9;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Logs</p>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--f92-dark)]">Quality Logs</h1>
        </div>
      </div>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
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
            <Combobox
              value={clientBrand || ALL}
              onChange={v => setClientBrand(v === ALL ? '' : v)}
              options={clientBrandOptions}
              placeholder="All brands"
              emptyLabel="No matching brand"
            />
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="severity">Severity</Label>
            <Select value={severity || ALL} onValueChange={value => setSeverity(value === ALL ? '' : value)}>
              <SelectTrigger id="severity">
                <SelectValue placeholder="All severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All severities</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status || ALL} onValueChange={value => setStatus(value === ALL ? '' : value)}>
              <SelectTrigger id="status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Blocked">Blocked</SelectItem>
                <SelectItem value="Pending Verification">Pending Verification</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="resetFilters" className="invisible hidden md:inline-block">Reset</Label>
            <Button
              id="resetFilters"
              variant="outline"
              className="w-full"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setClientBrand('');
                setSeverity('');
                setStatus('');
              }}
            >
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
                <th className="w-8 px-2 py-3" aria-label="Expand">{' '}</th>
                <SortableHeader k="date" label="Date" />
                <th className="px-4 py-3 font-semibold">Ticket</th>
                <SortableHeader k="brand" label="Brand" />
                <SortableHeader k="severity" label="Severity" />
                <SortableHeader k="status" label="Status" />
                <SortableHeader k="category" label="Issue category" />
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Sendbacks</th>
                {profile?.role === 'admin' ? <th className="px-4 py-3 font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colCount + 1} className="px-4 py-6 text-center text-[color:var(--f92-gray)]">
                    Loading logs...
                  </td>
                </tr>
              ) : sortedGroups.length === 0 ? (
                <tr>
                  <td colSpan={colCount + 1} className="px-4 py-6 text-center text-[color:var(--f92-gray)]">
                    No logs found for the selected filters.
                  </td>
                </tr>
              ) : (
                sortedGroups.flatMap(group => {
                  const isExpanded = !!expanded[group.ticketId];
                  const hasMultiple = group.entries.length > 1;
                  const latest = group.latest;
                  const rows = [
                    <tr
                      key={`${group.ticketId}-summary`}
                      className="rounded-3xl border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)]"
                    >
                      <td className="px-2 py-3 align-top">
                        {hasMultiple ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(group.ticketId)}
                            aria-expanded={isExpanded}
                            aria-controls={`group-${group.ticketId}-details`}
                            aria-label={isExpanded ? `Collapse ${group.ticketId} sendbacks` : `Expand ${group.ticketId} sendbacks`}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--f92-gray)] transition hover:bg-[color:var(--f92-tint)] hover:text-[color:var(--f92-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top">{formatTriggeredDate(latest.triggered_at)}</td>
                      <td className="sticky left-0 px-4 py-3 align-top bg-[color:var(--f92-warm)]">
                        <div className="flex items-center gap-1">
                          <a
                            href={latest.jira_ticket_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-[color:var(--f92-navy)] hover:underline"
                          >
                            {group.ticketId}
                          </a>
                          {(auditCounts[latest.id] ?? 0) > 5 ? (
                            <span
                              role="img"
                              aria-label="Heavily edited"
                              title="This one's been through some things..."
                              className="cursor-help text-sm"
                            >
                              👀
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">{latest.client_brand ?? '—'}</td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant={getSeverityVariant(latest.severity ?? '')}>
                          {latest.severity ?? 'Unknown'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant={getStatusVariant(latest.log_status)}>{latest.log_status}</Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {Array.isArray(latest.issue_category) ? latest.issue_category.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3 align-top">{latest.who_owns_fix ?? '—'}</td>
                      <td className="px-4 py-3 align-top">
                        {hasMultiple ? (
                          <Badge variant="default" className="text-xs">
                            {group.entries.length} sendbacks
                          </Badge>
                        ) : (
                          <span className="text-xs text-[color:var(--f92-gray)]">1</span>
                        )}
                      </td>
                      {profile?.role === 'admin' ? (
                        <td className="px-4 py-3 align-top">
                          <Button variant="secondary" size="sm" onClick={() => openEditDialog(latest)}>Edit</Button>
                        </td>
                      ) : null}
                    </tr>,
                  ];

                  if (isExpanded && hasMultiple) {
                    rows.push(
                      <tr key={`${group.ticketId}-details`} id={`group-${group.ticketId}-details`}>
                        <td colSpan={colCount + 1} className="px-4 pb-4 pt-0">
                          <div className="rounded-2xl border border-dashed border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] p-4">
                            <p className="mb-2 text-xs uppercase tracking-widest text-[color:var(--f92-gray)]">
                              All sendbacks for {group.ticketId}
                            </p>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-left text-xs">
                                <thead>
                                  <tr className="text-[color:var(--f92-gray)]">
                                    <th className="px-2 py-2 font-semibold">Date</th>
                                    <th className="px-2 py-2 font-semibold">#</th>
                                    <th className="px-2 py-2 font-semibold">Status</th>
                                    <th className="px-2 py-2 font-semibold">Severity</th>
                                    <th className="px-2 py-2 font-semibold">Category</th>
                                    <th className="px-2 py-2 font-semibold">Root cause</th>
                                    <th className="px-2 py-2 font-semibold">Notes</th>
                                    {profile?.role === 'admin' ? <th className="px-2 py-2 font-semibold">Actions</th> : null}
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.entries.map(entry => (
                                    <tr key={entry.id} className="border-t border-[color:var(--f92-border)]">
                                      <td className="px-2 py-2 align-top">{formatTriggeredDate(entry.triggered_at)}</td>
                                      <td className="px-2 py-2 align-top">{entry.log_number}</td>
                                      <td className="px-2 py-2 align-top">
                                        <Badge variant={getStatusVariant(entry.log_status)}>{entry.log_status}</Badge>
                                      </td>
                                      <td className="px-2 py-2 align-top">
                                        <Badge variant={getSeverityVariant(entry.severity ?? '')}>
                                          {entry.severity ?? '—'}
                                        </Badge>
                                      </td>
                                      <td className="px-2 py-2 align-top">
                                        {Array.isArray(entry.issue_category) ? entry.issue_category.join(', ') : '—'}
                                      </td>
                                      <td className="px-2 py-2 align-top">
                                        {Array.isArray(entry.root_cause_final) ? entry.root_cause_final.join(', ') : '—'}
                                      </td>
                                      <td className="px-2 py-2 align-top">{entry.notes ?? '—'}</td>
                                      {profile?.role === 'admin' ? (
                                        <td className="px-2 py-2 align-top">
                                          <Button variant="secondary" size="sm" onClick={() => openEditDialog(entry)}>Edit</Button>
                                        </td>
                                      ) : null}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>,
                    );
                  }

                  return rows;
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <EditLogDialog
        log={editingLog}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={applyEditedLog}
      />
    </div>
  );
}
