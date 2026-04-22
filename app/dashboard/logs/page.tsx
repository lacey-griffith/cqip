'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { EditLogDialog, type EditableLog } from '@/components/logs/edit-log-dialog';
import { ConfirmDeleteDialog } from '@/components/logs/confirm-delete-dialog';
import { TicketLink } from '@/components/logs/ticket-link';
import { MmiList } from '@/components/logs/mmi-tooltip';
import { RowActionsMenu } from '@/components/logs/row-actions-menu';
import { SyncJiraButton } from '@/components/dashboard/sync-jira-button';
import { cn } from '@/lib/utils';

const ALL = '__all__';

interface LogEntry {
  id: string;
  triggered_at: string;
  jira_ticket_id: string;
  jira_ticket_url: string;
  jira_summary: string | null;
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

type SortKey = 'date' | 'severity' | 'status' | 'category';
type SortDir = 'asc' | 'desc';

type DatePill = 'all' | '30' | '60' | '90';

const PILL_OPTIONS: Array<{ id: DatePill; label: string; days: number | null }> = [
  { id: 'all', label: 'All time', days: null },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '60', label: 'Last 60 days', days: 60 },
  { id: '90', label: 'Last 90 days', days: 90 },
];

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
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

  const [activePill, setActivePill] = useState<DatePill | null>('all');
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [editingLog, setEditingLog] = useState<EditableLog | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deletingLog, setDeletingLog] = useState<LogEntry | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<TicketGroup | null>(null);
  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});

  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: logsData } = await supabase
        .from('quality_logs')
        .select('id, triggered_at, jira_ticket_id, jira_ticket_url, jira_summary, client_brand, severity, log_status, issue_category, root_cause_final, who_owns_fix, log_number, notes, resolution_notes')
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

  function handleStartDateChange(value: string) {
    setStartDate(value);
    setActivePill(null);
  }

  function handleEndDateChange(value: string) {
    setEndDate(value);
    setActivePill(null);
  }

  function selectPill(pill: DatePill) {
    if (activePill === pill) {
      if (pill === 'all') return; // clicking the already-active "all" is a no-op
      setActivePill('all');
      setStartDate('');
      setEndDate('');
      return;
    }
    setActivePill(pill);
    const opt = PILL_OPTIONS.find(p => p.id === pill);
    if (!opt || opt.days == null) {
      setStartDate('');
      setEndDate('');
    } else {
      setStartDate(daysAgoISO(opt.days));
      setEndDate('');
    }
  }

  function resetAllFilters() {
    setStartDate('');
    setEndDate('');
    setClientBrand('');
    setSeverity('');
    setStatus('');
    setActivePill('all');
  }

  const activeFilterCount =
    (startDate || endDate ? 1 : 0) +
    (clientBrand ? 1 : 0) +
    (severity ? 1 : 0) +
    (status ? 1 : 0);

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

  function openDeleteDialog(log: LogEntry) {
    setDeletingLog(log);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deletingLog) return;
    const response = await fetch('/api/logs/edit', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deletingLog.id }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error || 'Unable to delete log.');
    }
    // Remove the log from local state so the row disappears without refetch.
    setLogs(prev => prev.filter(l => l.id !== deletingLog.id));
    setDeletingLog(null);
  }

  function openDeleteGroupDialog(group: TicketGroup) {
    setDeletingGroup(group);
    setDeleteGroupOpen(true);
  }

  async function confirmDeleteGroup() {
    if (!deletingGroup) return;
    const response = await fetch('/api/logs/edit', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'ticket',
        jira_ticket_id: deletingGroup.ticketId,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error || 'Unable to delete ticket logs.');
    }
    // Drop every log for the ticket from local state.
    const doomedIds = new Set(deletingGroup.entries.map(e => e.id));
    setLogs(prev => prev.filter(l => !doomedIds.has(l.id)));
    setDeletingGroup(null);
  }

  function toggleGroupSelection(ticketId: string) {
    setSelectedTicketIds(prev => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId);
      else next.add(ticketId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedTicketIds(new Set());
  }

  async function confirmBatchDelete() {
    if (selectedTicketIds.size === 0) return;
    const ticketIds = Array.from(selectedTicketIds);
    const responses = await Promise.all(
      ticketIds.map(ticketId =>
        fetch('/api/logs/edit', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'ticket', jira_ticket_id: ticketId }),
        }),
      ),
    );
    const failed = responses.filter(r => !r.ok);
    if (failed.length > 0) {
      throw new Error(`Failed to delete ${failed.length} of ${ticketIds.length} ticket${ticketIds.length === 1 ? '' : 's'}.`);
    }
    // Drop every log belonging to any selected ticket from local state.
    const doomedTicketIds = new Set(ticketIds);
    setLogs(prev => prev.filter(l => !doomedTicketIds.has(l.jira_ticket_id)));
    setSelectedTicketIds(new Set());
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

  // Main-row columns: col1 + Date + Ticket + Severity + Status + Category + Sendbacks (+ Actions for admin)
  const colCount = profile?.role === 'admin' ? 8 : 7;
  const isAdmin = profile?.role === 'admin';

  const selectedLogsTotal = useMemo(() => {
    if (selectedTicketIds.size === 0) return 0;
    return sortedGroups
      .filter(g => selectedTicketIds.has(g.ticketId))
      .reduce((sum, g) => sum + g.entries.length, 0);
  }, [sortedGroups, selectedTicketIds]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Logs</p>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--f92-dark)]">Quality Logs</h1>
        </div>
        <SyncJiraButton />
      </div>

      <Card className="p-3 md:p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFiltersOpen(o => !o)}
            aria-expanded={filtersOpen}
            aria-controls="cqip-filter-body"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--f92-dark)] hover:text-[color:var(--f92-navy)] focus-visible:outline-none focus-visible:underline"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 text-[color:var(--f92-gray)] transition-transform duration-300',
                filtersOpen ? 'rotate-0' : '-rotate-90',
              )}
              aria-hidden="true"
            />
            Filters
            {activeFilterCount > 0 ? (
              <span className="text-xs font-medium text-[color:var(--f92-gray)]">
                • {activeFilterCount} active
              </span>
            ) : null}
          </button>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs text-[color:var(--f92-gray)] transition hover:text-[color:var(--f92-orange)] focus-visible:outline-none focus-visible:underline"
            >
              Reset
            </button>
          ) : null}
        </div>

        <div
          id="cqip-filter-body"
          className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-out',
            filtersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
          aria-hidden={!filtersOpen}
        >
          <div className="overflow-hidden">
            <div className="pt-3">
              {/* Quick filter pills */}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range presets">
                {PILL_OPTIONS.map(opt => {
                  const active = activePill === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => selectPill(opt.id)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition',
                        active
                          ? 'border-[color:var(--f92-orange)] bg-[color:var(--f92-orange)] text-white'
                          : 'border-[color:var(--f92-border)] bg-transparent text-[color:var(--f92-dark)] hover:border-[color:var(--f92-orange)] hover:text-[color:var(--f92-orange)]',
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Compact filter row */}
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[9rem] flex-1">
                  <Label htmlFor="startDate" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">From</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={e => handleStartDateChange(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="min-w-[9rem] flex-1">
                  <Label htmlFor="endDate" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">To</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={e => handleEndDateChange(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="min-w-[10rem] flex-1">
                  <Label htmlFor="clientBrand" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Brand</Label>
                  <Combobox
                    value={clientBrand || ALL}
                    onChange={v => setClientBrand(v === ALL ? '' : v)}
                    options={clientBrandOptions}
                    placeholder="All brands"
                    emptyLabel="No matching brand"
                  />
                </div>
                <div className="min-w-[9rem] flex-1">
                  <Label htmlFor="severity" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Severity</Label>
                  <Select value={severity || ALL} onValueChange={value => setSeverity(value === ALL ? '' : value)}>
                    <SelectTrigger id="severity" className="h-9 text-sm">
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
                <div className="min-w-[10rem] flex-1">
                  <Label htmlFor="status" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Status</Label>
                  <Select value={status || ALL} onValueChange={value => setStatus(value === ALL ? '' : value)}>
                    <SelectTrigger id="status" className="h-9 text-sm">
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
              </div>
            </div>
          </div>
        </div>
      </Card>

      {isAdmin && selectedTicketIds.size > 0 ? (
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--f92-orange)] bg-white px-4 py-2 shadow-sm">
          <p className="text-sm font-medium text-[color:var(--f92-dark)]">
            {selectedTicketIds.size} ticket{selectedTicketIds.size === 1 ? '' : 's'} selected
            <span className="ml-2 text-xs text-[color:var(--f92-gray)]">
              ({selectedLogsTotal} log{selectedLogsTotal === 1 ? '' : 's'})
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchDeleteOpen(true)}
              className="text-red-600 hover:text-red-700"
            >
              Delete selected
            </Button>
            <Button variant="secondary" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3 text-left text-sm">
            <thead>
              <tr className="text-[color:var(--f92-dark)]">
                <th className="sticky left-0 z-[2] w-12 whitespace-nowrap bg-white px-2 py-3" aria-label={isAdmin ? 'Select ticket' : 'Expand'}>{' '}</th>
                <SortableHeader k="date" label="Date" className="sticky left-12 z-[2] whitespace-nowrap bg-white" />
                <th className="sticky left-[9.5rem] z-[2] whitespace-nowrap bg-white px-4 py-3 font-semibold">Ticket</th>
                <SortableHeader k="severity" label="Severity" />
                <SortableHeader k="status" label="Status" />
                <SortableHeader k="category" label="Issue category" />
                <th className="px-4 py-3 font-semibold">Sendbacks</th>
                {isAdmin ? <th className="px-4 py-3 font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-6 text-center text-[color:var(--f92-gray)]">
                    Loading logs...
                  </td>
                </tr>
              ) : sortedGroups.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-6 text-center text-[color:var(--f92-gray)]">
                    No logs found for the selected filters.
                  </td>
                </tr>
              ) : (
                sortedGroups.flatMap(group => {
                  const isExpanded = !!expanded[group.ticketId];
                  const hasMultiple = group.entries.length > 1;
                  const latest = group.latest;
                  const isSelected = selectedTicketIds.has(group.ticketId);
                  const expandButton = hasMultiple ? (
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
                  ) : null;
                  const rows = [
                    <tr
                      key={`${group.ticketId}-summary`}
                      className="rounded-3xl border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)]"
                    >
                      <td className="sticky left-0 z-[1] w-12 bg-[color:var(--f92-warm)] px-2 py-3 align-top">
                        <div className="flex items-center gap-1">
                          {isAdmin ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleGroupSelection(group.ticketId)}
                              aria-label={`Select ${group.ticketId} for batch action`}
                              className="h-4 w-4 cursor-pointer rounded border-[color:var(--f92-border)] text-[color:var(--f92-orange)] focus:ring-[color:var(--f92-orange)]"
                            />
                          ) : null}
                          {expandButton}
                        </div>
                      </td>
                      <td className="sticky left-12 z-[1] whitespace-nowrap bg-[color:var(--f92-warm)] px-4 py-3 align-top">
                        {formatTriggeredDate(latest.triggered_at)}
                      </td>
                      <td className="sticky left-[9.5rem] z-[1] bg-[color:var(--f92-warm)] px-4 py-3 align-top">
                        <div className="flex items-start gap-1">
                          <TicketLink
                            ticketId={group.ticketId}
                            url={latest.jira_ticket_url}
                            title={latest.jira_summary}
                            brand={latest.client_brand}
                          />
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
                      <td className="px-4 py-3 align-top">
                        <Badge variant={getSeverityVariant(latest.severity ?? '')}>
                          {latest.severity ?? 'Unknown'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant={getStatusVariant(latest.log_status)}>{latest.log_status}</Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <MmiList values={latest.issue_category} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        {hasMultiple ? (
                          <Badge
                            variant="default"
                            className="inline-flex items-center gap-1 text-xs"
                            title={`${group.entries.length} rework events`}
                          >
                            <RefreshCw className="h-3 w-3" aria-hidden="true" />
                            {group.entries.length}
                            <span className="sr-only"> rework events</span>
                          </Badge>
                        ) : (
                          <span className="text-xs text-[color:var(--f92-gray)]">1</span>
                        )}
                      </td>
                      {isAdmin ? (
                        <td className="px-4 py-3 align-top">
                          <RowActionsMenu
                            ticketId={latest.jira_ticket_id}
                            logNumber={latest.log_number}
                            onEdit={() => openEditDialog(latest)}
                            onDelete={() => openDeleteDialog(latest)}
                          />
                        </td>
                      ) : null}
                    </tr>,
                  ];

                  if (isExpanded && hasMultiple) {
                    rows.push(
                      <tr key={`${group.ticketId}-details`} id={`group-${group.ticketId}-details`}>
                        <td colSpan={colCount} className="px-4 pb-4 pt-0">
                          <div className="rounded-2xl border border-dashed border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] p-4">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs uppercase tracking-widest text-[color:var(--f92-gray)]">
                                <span>All sendbacks for {group.ticketId}</span>
                                {latest.client_brand ? (
                                  <>
                                    <span className="mx-2" aria-hidden="true">·</span>
                                    <span>Brand: <span className="text-[color:var(--f92-navy)]">{latest.client_brand}</span></span>
                                  </>
                                ) : null}
                                {latest.who_owns_fix ? (
                                  <>
                                    <span className="mx-2" aria-hidden="true">·</span>
                                    <span>Owner: <span className="text-[color:var(--f92-dark)]">{latest.who_owns_fix}</span></span>
                                  </>
                                ) : null}
                              </p>
                              {isAdmin ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDeleteGroupDialog(group)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  Delete all logs for this ticket
                                </Button>
                              ) : null}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-left text-xs">
                                <thead>
                                  <tr className="text-[color:var(--f92-gray)]">
                                    <th className="px-2 py-2 font-semibold">Date</th>
                                    <th className="px-2 py-2 font-semibold">#</th>
                                    <th className="px-2 py-2 font-semibold">Brand</th>
                                    <th className="px-2 py-2 font-semibold">Status</th>
                                    <th className="px-2 py-2 font-semibold">Severity</th>
                                    <th className="px-2 py-2 font-semibold">Category</th>
                                    <th className="px-2 py-2 font-semibold">Owner</th>
                                    <th className="px-2 py-2 font-semibold">Root cause</th>
                                    <th className="px-2 py-2 font-semibold">Notes</th>
                                    {isAdmin ? <th className="px-2 py-2 font-semibold">Actions</th> : null}
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.entries.map(entry => (
                                    <tr key={entry.id} className="border-t border-[color:var(--f92-border)]">
                                      <td className="px-2 py-2 align-top">{formatTriggeredDate(entry.triggered_at)}</td>
                                      <td className="px-2 py-2 align-top">{entry.log_number}</td>
                                      <td className="px-2 py-2 align-top">{entry.client_brand ?? '—'}</td>
                                      <td className="px-2 py-2 align-top">
                                        <Badge variant={getStatusVariant(entry.log_status)}>{entry.log_status}</Badge>
                                      </td>
                                      <td className="px-2 py-2 align-top">
                                        <Badge variant={getSeverityVariant(entry.severity ?? '')}>
                                          {entry.severity ?? '—'}
                                        </Badge>
                                      </td>
                                      <td className="px-2 py-2 align-top">
                                        <MmiList values={entry.issue_category} />
                                      </td>
                                      <td className="px-2 py-2 align-top">{entry.who_owns_fix ?? '—'}</td>
                                      <td className="px-2 py-2 align-top">
                                        {Array.isArray(entry.root_cause_final) ? entry.root_cause_final.join(', ') : '—'}
                                      </td>
                                      <td className="px-2 py-2 align-top">{entry.notes ?? '—'}</td>
                                      {isAdmin ? (
                                        <td className="px-2 py-2 align-top">
                                          <RowActionsMenu
                                            ticketId={entry.jira_ticket_id}
                                            logNumber={entry.log_number}
                                            onEdit={() => openEditDialog(entry)}
                                            onDelete={() => openDeleteDialog(entry)}
                                          />
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

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={open => {
          setDeleteOpen(open);
          if (!open) setDeletingLog(null);
        }}
        title="Delete this log entry?"
        description={
          deletingLog
            ? `This will soft-delete ${deletingLog.jira_ticket_id} log #${deletingLog.log_number}. This cannot be undone.`
            : 'This cannot be undone.'
        }
        onConfirm={confirmDelete}
      />

      <ConfirmDeleteDialog
        open={deleteGroupOpen}
        onOpenChange={open => {
          setDeleteGroupOpen(open);
          if (!open) setDeletingGroup(null);
        }}
        title={deletingGroup ? `Delete all logs for ${deletingGroup.ticketId}?` : 'Delete all logs?'}
        description={
          deletingGroup
            ? `Delete all ${deletingGroup.entries.length} log${deletingGroup.entries.length === 1 ? '' : 's'} for ticket ${deletingGroup.ticketId}? This cannot be undone.`
            : 'This cannot be undone.'
        }
        confirmLabel="Delete all"
        onConfirm={confirmDeleteGroup}
      />

      <ConfirmDeleteDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title={`Delete ${selectedTicketIds.size} ticket${selectedTicketIds.size === 1 ? '' : 's'}?`}
        description={`This will soft-delete all ${selectedLogsTotal} log${selectedLogsTotal === 1 ? '' : 's'} across ${selectedTicketIds.size} ticket${selectedTicketIds.size === 1 ? '' : 's'}. This cannot be undone.`}
        confirmLabel="Delete selected"
        onConfirm={confirmBatchDelete}
      />
    </div>
  );
}
