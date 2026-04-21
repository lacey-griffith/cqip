'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { capitalizeName, cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { ScorecardReport } from '@/components/reports/scorecard-report';
import { RootCauseReport } from '@/components/reports/root-cause-report';
import { ClientReport } from '@/components/reports/client-report';
import type { DateRange } from '@/components/reports/common';

const ALL = '__all__';

interface QualityLog {
  id: string;
  triggered_at: string;
  jira_ticket_id: string;
  jira_ticket_url: string | null;
  client_brand: string | null;
  severity: string | null;
  log_status: string;
  issue_category: string[] | null;
  root_cause_final: string[] | null;
  who_owns_fix: string | null;
  test_type: string | null;
  jira_summary: string | null;
  project_key: string;
}

interface SavedReport {
  id: string;
  name: string;
  created_by: string;
  filters: Record<string, any>;
  created_at: string;
}

const initialFilters = {
  startDate: '',
  endDate: '',
  clientBrand: '',
  severity: '',
  status: '',
  issueCategory: '',
  rootCauseFinal: '',
  whoOwnsFix: '',
  testType: '',
};

export default function ReportsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [logs, setLogs] = useState<QualityLog[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [filterOptions, setFilterOptions] = useState({
    clientBrands: [] as string[],
    severities: [] as string[],
    statuses: [] as string[],
    issueCategories: [] as string[],
    rootCauses: [] as string[],
    owners: [] as string[],
    testTypes: [] as string[],
  });
  const [saveName, setSaveName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Named-report selector state
  type ReportKind = 'scorecard' | 'rootcause' | 'client';
  const defaultStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();
  const today = new Date().toISOString().slice(0, 10);
  const [cardStart, setCardStart] = useState<Record<ReportKind, string>>({
    scorecard: defaultStart,
    rootcause: defaultStart,
    client: defaultStart,
  });
  const [cardEnd, setCardEnd] = useState<Record<ReportKind, string>>({
    scorecard: today,
    rootcause: today,
    client: today,
  });
  const [activeReport, setActiveReport] = useState<ReportKind | null>(null);
  const [activeRange, setActiveRange] = useState<DateRange | null>(null);

  function generateReport(kind: ReportKind) {
    const s = cardStart[kind];
    const e = cardEnd[kind];
    if (!s || !e) return;
    setActiveReport(kind);
    setActiveRange({ startISO: `${s}T00:00:00Z`, endISO: `${e}T23:59:59Z` });
  }

  useEffect(() => {
    fetchReportsPage();
  }, []);

  async function fetchReportsPage() {
    try {
      setLoading(true);
      await Promise.all([fetchLogs(), fetchSavedReports(), fetchFilterOptions()]);
    } catch (err) {
      console.error(err);
      setError('Unable to load reports page.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchFilterOptions() {
    const { data, error } = await supabase
      .from('quality_logs')
      .select('client_brand,severity,log_status,issue_category,root_cause_final,who_owns_fix,test_type')
      .is('is_deleted', false)
      .limit(500);

    if (error) {
      console.error(error);
      return;
    }

    const clientBrands = new Set<string>();
    const severities = new Set<string>();
    const statuses = new Set<string>();
    const issueCategories = new Set<string>();
    const rootCauses = new Set<string>();
    const owners = new Set<string>();
    const testTypes = new Set<string>();

    (data || []).forEach((row: any) => {
      if (row.client_brand) clientBrands.add(row.client_brand);
      if (row.severity) severities.add(row.severity);
      if (row.log_status) statuses.add(row.log_status);
      if (row.issue_category) row.issue_category.forEach((value: string) => issueCategories.add(value));
      if (row.root_cause_final) row.root_cause_final.forEach((value: string) => rootCauses.add(value));
      if (row.who_owns_fix) owners.add(row.who_owns_fix);
      if (row.test_type) testTypes.add(row.test_type);
    });

    setFilterOptions({
      clientBrands: Array.from(clientBrands).sort(),
      severities: Array.from(severities).sort(),
      statuses: Array.from(statuses).sort(),
      issueCategories: Array.from(issueCategories).sort(),
      rootCauses: Array.from(rootCauses).sort(),
      owners: Array.from(owners).sort(),
      testTypes: Array.from(testTypes).sort(),
    });
  }

  async function fetchLogs(customFilters = filters) {
    try {
      let query = supabase
        .from('quality_logs')
        .select(
          `id, triggered_at, jira_ticket_id, jira_ticket_url, jira_summary, client_brand, severity, log_status, issue_category, root_cause_final, who_owns_fix, test_type, project_key`
        )
        .is('is_deleted', false)
        .order('triggered_at', { ascending: false });

      if (customFilters.startDate) {
        query = query.gte('triggered_at', `${customFilters.startDate}T00:00:00Z`);
      }
      if (customFilters.endDate) {
        query = query.lte('triggered_at', `${customFilters.endDate}T23:59:59Z`);
      }
      if (customFilters.clientBrand) {
        query = query.eq('client_brand', customFilters.clientBrand);
      }
      if (customFilters.severity) {
        query = query.eq('severity', customFilters.severity);
      }
      if (customFilters.status) {
        query = query.eq('log_status', customFilters.status);
      }
      if (customFilters.issueCategory) {
        query = query.contains('issue_category', [customFilters.issueCategory]);
      }
      if (customFilters.rootCauseFinal) {
        query = query.contains('root_cause_final', [customFilters.rootCauseFinal]);
      }
      if (customFilters.whoOwnsFix) {
        query = query.eq('who_owns_fix', customFilters.whoOwnsFix);
      }
      if (customFilters.testType) {
        query = query.eq('test_type', customFilters.testType);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data as QualityLog[]) || []);
    } catch (err) {
      console.error(err);
      setError('Unable to load filtered logs.');
    }
  }

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value === ALL ? '' : value }));
  };

  const selectValue = (value: string) => (value ? value : ALL);

  const applyFilters = async () => {
    setInfoMessage(null);
    await fetchLogs();
  };

  const clearFilters = async () => {
    setFilters(initialFilters);
    setInfoMessage(null);
    await fetchLogs(initialFilters);
  };

  const downloadCsv = () => {
    const header = [
      'Triggered At',
      'Ticket',
      'Client Brand',
      'Severity',
      'Status',
      'Issue Category',
      'Root Cause Final',
      'Owner',
      'Test Type',
      'Project Key',
      'Summary',
    ];
    const rows = logs.map(log => [
      log.triggered_at,
      log.jira_ticket_url ? `${log.jira_ticket_id} (${log.jira_ticket_url})` : log.jira_ticket_id,
      log.client_brand || '',
      log.severity || '',
      log.log_status,
      Array.isArray(log.issue_category) ? log.issue_category.join('; ') : '',
      Array.isArray(log.root_cause_final) ? log.root_cause_final.join('; ') : '',
      log.who_owns_fix || '',
      log.test_type || '',
      log.project_key,
      log.jira_summary || '',
    ]);

    const csvContent = [header, ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cqip-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadExcel = () => {
    const data = logs.map(log => ({
      'Triggered At': log.triggered_at,
      'Ticket': log.jira_ticket_url ? `${log.jira_ticket_id} (${log.jira_ticket_url})` : log.jira_ticket_id,
      'Client Brand': log.client_brand || '',
      'Severity': log.severity || '',
      'Status': log.log_status,
      'Issue Category': Array.isArray(log.issue_category) ? log.issue_category.join('; ') : '',
      'Root Cause Final': Array.isArray(log.root_cause_final) ? log.root_cause_final.join('; ') : '',
      'Owner': log.who_owns_fix || '',
      'Test Type': log.test_type || '',
      'Project Key': log.project_key,
      'Summary': log.jira_summary || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CQIP Reports');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cqip-reports-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveReport = async () => {
    if (!saveName.trim()) {
      setInfoMessage('Enter a report name before saving.');
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session?.user?.id) {
      setError('Unable to save report without a valid user session.');
      return;
    }

    // RLS on saved_reports (migration 005) requires created_by = auth.uid()::text.
    const { error: saveError } = await supabase.from('saved_reports').insert({
      name: saveName,
      filters,
      created_by: session.user.id,
    });

    if (saveError) {
      console.error(saveError);
      setError('Unable to save report.');
      return;
    }

    setSaveName('');
    setInfoMessage('Report saved successfully.');
    fetchSavedReports();
  };

  const fetchSavedReports = async () => {
    const { data, error } = await supabase
      .from('saved_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const reports = (data as SavedReport[]) || [];
    setSavedReports(reports);

    // created_by is now a UUID — resolve display names so the UI stays friendly.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uuids = Array.from(
      new Set(reports.map(r => r.created_by).filter((v): v is string => !!v && uuidRe.test(v))),
    );
    if (uuids.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, display_name')
        .in('id', uuids);
      const map: Record<string, string> = {};
      (profiles || []).forEach((p: { id: string; display_name: string }) => {
        map[p.id] = p.display_name;
      });
      setCreatorNames(map);
    }
  };

  const recallReport = async (report: SavedReport) => {
    const merged = { ...initialFilters, ...(report.filters || {}) };
    setFilters(merged);
    await fetchLogs(merged);
    setInfoMessage(`Recalled report: ${report.name}`);
  };

  const filterCount = useMemo(
    () => Object.values(filters).filter(value => value).length,
    [filters]
  );

  const reportCards: Array<{
    id: 'scorecard' | 'rootcause' | 'client';
    title: string;
    description: string;
  }> = [
    {
      id: 'scorecard',
      title: 'Quality Health Scorecard',
      description: 'Monthly snapshot for leadership. How are we doing overall?',
    },
    {
      id: 'rootcause',
      title: 'Root Cause Breakdown',
      description: 'Where are issues coming from? Use this for process improvement.',
    },
    {
      id: 'client',
      title: 'Client Quality Report',
      description: 'Per-client breakdown. Where should we focus our attention?',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm cqip-skip-in-print">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Reports</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">Reports</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
          Pick a named report for a focused view, or use the custom filter below for an ad-hoc table.
        </p>
      </div>

      {/* Three named report cards */}
      <div className="cqip-skip-in-print grid gap-4 md:grid-cols-3">
        {reportCards.map(rc => {
          const active = activeReport === rc.id;
          return (
            <Card
              key={rc.id}
              className={cn(
                'flex flex-col border bg-white p-5 shadow-sm transition',
                active
                  ? 'border-[color:var(--f92-orange)] ring-2 ring-[color:var(--f92-orange)]/40'
                  : 'border-[color:var(--f92-border)]',
              )}
            >
              <h3 className="text-base font-semibold text-[color:var(--f92-navy)]">{rc.title}</h3>
              <p className="mt-1 text-xs text-[color:var(--f92-gray)]">{rc.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={`start-${rc.id}`} className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">From</Label>
                  <Input
                    id={`start-${rc.id}`}
                    type="date"
                    value={cardStart[rc.id]}
                    onChange={e => setCardStart(prev => ({ ...prev, [rc.id]: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor={`end-${rc.id}`} className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">To</Label>
                  <Input
                    id={`end-${rc.id}`}
                    type="date"
                    value={cardEnd[rc.id]}
                    onChange={e => setCardEnd(prev => ({ ...prev, [rc.id]: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <Button
                onClick={() => generateReport(rc.id)}
                className="mt-4 w-full"
                variant={active ? 'default' : 'secondary'}
              >
                {active ? 'Regenerate' : 'Generate Report'}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Active report panel */}
      {activeReport && activeRange ? (
        <div>
          {activeReport === 'scorecard' ? <ScorecardReport key={`${activeRange.startISO}-${activeRange.endISO}`} range={activeRange} /> : null}
          {activeReport === 'rootcause' ? <RootCauseReport key={`${activeRange.startISO}-${activeRange.endISO}`} range={activeRange} /> : null}
          {activeReport === 'client' ? <ClientReport key={`${activeRange.startISO}-${activeRange.endISO}`} range={activeRange} /> : null}
        </div>
      ) : null}

      <div className="cqip-skip-in-print rounded-3xl border border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Custom filter &amp; export</h2>
        <p className="mt-1 text-sm text-[color:var(--f92-gray)]">
          Build your own view with the filters below. Save the filter set as a named report, or export the table as CSV / Excel.
        </p>
      </div>

      <Card className="cqip-skip-in-print border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={e => handleFilterChange('startDate', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">End date</Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={e => handleFilterChange('endDate', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="clientBrand">Client brand</Label>
            <Select
              value={selectValue(filters.clientBrand)}
              onValueChange={value => handleFilterChange('clientBrand', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All brands</SelectItem>
                {filterOptions.clientBrands.map(brand => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="severity">Severity</Label>
            <Select
              value={selectValue(filters.severity)}
              onValueChange={value => handleFilterChange('severity', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All severities</SelectItem>
                {filterOptions.severities.map(severity => (
                  <SelectItem key={severity} value={severity}>{severity}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={selectValue(filters.status)}
              onValueChange={value => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {filterOptions.statuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="issueCategory">Issue category</Label>
            <Select
              value={selectValue(filters.issueCategory)}
              onValueChange={value => handleFilterChange('issueCategory', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {filterOptions.issueCategories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rootCauseFinal">Root cause final</Label>
            <Select
              value={selectValue(filters.rootCauseFinal)}
              onValueChange={value => handleFilterChange('rootCauseFinal', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All root causes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All root causes</SelectItem>
                {filterOptions.rootCauses.map(cause => (
                  <SelectItem key={cause} value={cause}>{cause}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="whoOwnsFix">Who owns fix</Label>
            <Select
              value={selectValue(filters.whoOwnsFix)}
              onValueChange={value => handleFilterChange('whoOwnsFix', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All owners</SelectItem>
                {filterOptions.owners.map(owner => (
                  <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="testType">Test type</Label>
            <Select
              value={selectValue(filters.testType)}
              onValueChange={value => handleFilterChange('testType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All test types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All test types</SelectItem>
                {filterOptions.testTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={applyFilters}>Apply filters ({filterCount})</Button>
          <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
          <Button variant="secondary" onClick={downloadCsv} disabled={logs.length === 0}>Export CSV</Button>
          <Button variant="secondary" onClick={downloadExcel} disabled={logs.length === 0}>Export Excel</Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card className="cqip-skip-in-print border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Filtered results</h2>
              <p className="text-sm text-[color:var(--f92-gray)]">{logs.length} rows matched</p>
            </div>
            <Badge variant="default" className="text-sm">{logs.length}</Badge>
          </div>

          {logs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] p-8 text-center text-sm text-[color:var(--f92-gray)]">
              No logs match the current filter selection.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[color:var(--f92-border)] text-left text-sm">
                <thead className="bg-[color:var(--f92-warm)] text-[color:var(--f92-dark)]">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Date</th>
                    <th className="px-3 py-3 font-semibold">Ticket</th>
                    <th className="px-3 py-3 font-semibold">Client</th>
                    <th className="px-3 py-3 font-semibold">Severity</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Root Cause</th>
                    <th className="px-3 py-3 font-semibold">Owner</th>
                    <th className="px-3 py-3 font-semibold">Test</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--f92-border)]">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-[color:var(--f92-warm)]">
                      <td className="px-3 py-3 text-xs text-[color:var(--f92-dark)]">{new Date(log.triggered_at).toLocaleDateString()}</td>
                      <td className="px-3 py-3 text-xs text-[color:var(--f92-dark)]">{log.jira_ticket_id}</td>
                      <td className="px-3 py-3 text-xs text-[color:var(--f92-dark)]">{log.client_brand || '—'}</td>
                      <td className="px-3 py-3 text-xs text-[color:var(--f92-dark)]">{log.severity || '—'}</td>
                      <td className="px-3 py-3 text-xs text-[color:var(--f92-dark)]">{log.log_status}</td>
                      <td className="px-3 py-3 text-xs text-[color:var(--f92-dark)]">{Array.isArray(log.root_cause_final) ? log.root_cause_final.join('; ') : '—'}</td>
                      <td className="px-3 py-3 text-xs text-[color:var(--f92-dark)]">{log.who_owns_fix || '—'}</td>
                      <td className="px-3 py-3 text-xs text-[color:var(--f92-dark)]">{log.test_type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="cqip-skip-in-print border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[color:var(--f92-navy)]">Save current report</h3>
            <p className="text-sm text-[color:var(--f92-gray)]">Persist your current filters for later recall.</p>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reportName">Report name</Label>
              <Input id="reportName" value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="E.g. Weekly client spike" />
            </div>
            <Button className="w-full" onClick={saveReport}>Save Report</Button>
            {infoMessage ? <p className="text-sm text-[color:var(--f92-navy)]">{infoMessage}</p> : null}
          </div>

          <div className="mt-8">
            <h4 className="text-sm font-semibold text-[color:var(--f92-dark)]">Saved reports</h4>
            <div className="mt-3 space-y-3">
              {savedReports.length === 0 ? (
                <p className="text-sm text-[color:var(--f92-gray)]">No saved reports yet.</p>
              ) : (
                savedReports.map(report => (
                  <div key={report.id} className="rounded-2xl border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[color:var(--f92-dark)]">{report.name}</p>
                        <p className="text-xs text-[color:var(--f92-gray)]">Saved by {capitalizeName(creatorNames[report.created_by]) || capitalizeName(report.created_by) || report.created_by} • {new Date(report.created_at).toLocaleString()}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => recallReport(report)}>Recall</Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}
    </div>
  );
}
