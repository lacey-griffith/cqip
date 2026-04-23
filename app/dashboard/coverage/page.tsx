'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkline } from '@/components/coverage/sparkline';
import { BrandDetailDrawer } from '@/components/coverage/brand-detail-drawer';
import { SyncJiraButton } from '@/components/dashboard/sync-jira-button';
import {
  buildCoverageRows,
  countInWindow,
  endOfLastWeek,
  startOfCurrentMonth,
  startOfCurrentWeek,
  startOfLastWeek,
  startOfRolling28,
  type Brand,
  type CoverageRow,
  type Milestone,
  type QualityLog,
} from '@/lib/coverage/queries';
import { cn } from '@/lib/utils';

type SortMode = 'drought' | 'alpha';

function formatRatio(tests: number, rework: number): string {
  if (tests === 0) return '—';
  return (rework / tests).toFixed(2);
}

export default function CoveragePage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [logs, setLogs] = useState<QualityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>('drought');
  const [showPaused, setShowPaused] = useState(false);
  const [drawerRow, setDrawerRow] = useState<CoverageRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const refetchAll = useCallback(async () => {
    const [brandsRes, milestonesRes, logsRes] = await Promise.all([
      supabase.from('brands').select('id, brand_code, jira_value, display_name, is_active, is_paused, paused_reason').order('display_name'),
      supabase.from('test_milestones').select('id, jira_ticket_id, jira_ticket_url, jira_summary, brand_id, brand_jira_value, milestone_type, reached_at, source, created_by, notes, is_deleted').eq('is_deleted', false),
      supabase.from('quality_logs').select('id, client_brand, triggered_at, is_deleted').eq('is_deleted', false),
    ]);

    // Surface partial failures so the page doesn't silently render as empty.
    const failures: string[] = [];
    if (brandsRes.error) failures.push(`brands: ${brandsRes.error.message}`);
    if (milestonesRes.error) failures.push(`test_milestones: ${milestonesRes.error.message}`);
    if (logsRes.error) failures.push(`quality_logs: ${logsRes.error.message}`);
    if (failures.length > 0) {
      console.error('[coverage] fetch failures', failures);
      setLoadError(failures.join(' · '));
    } else {
      setLoadError(null);
    }

    setBrands((brandsRes.data ?? []) as Brand[]);
    setMilestones((milestonesRes.data ?? []) as Milestone[]);
    setLogs((logsRes.data ?? []) as QualityLog[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function initialLoad() {
      await refetchAll();
      if (cancelled) return;
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
        if (!cancelled) setIsAdmin(profile?.role === 'admin');
      }
      if (!cancelled) setLoading(false);
    }
    initialLoad();
    return () => { cancelled = true; };
  }, [refetchAll]);

  // Refetch when the tab regains focus so admin round-trips to
  // /settings/coverage don't leave this page showing stale counts.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        void refetchAll();
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetchAll]);

  const crossBrand = useMemo(() => {
    const now = new Date();
    return {
      thisWeek: countInWindow(milestones, null, startOfCurrentWeek(), now),
      lastWeek: countInWindow(milestones, null, startOfLastWeek(), endOfLastWeek()),
      rolling28: countInWindow(milestones, null, startOfRolling28(), now),
      thisMonth: countInWindow(milestones, null, startOfCurrentMonth(), now),
    };
  }, [milestones]);

  const rows = useMemo(() => buildCoverageRows(brands, milestones, logs), [brands, milestones, logs]);

  const visibleRows = useMemo(() => {
    const filtered = showPaused ? rows : rows.filter(r => !r.brand.is_paused);
    const sorted = [...filtered];
    if (sortMode === 'drought') {
      sorted.sort((a, b) => {
        const ad = a.droughtFlag ? 0 : 1;
        const bd = b.droughtFlag ? 0 : 1;
        if (ad !== bd) return ad - bd;
        return a.brand.display_name.localeCompare(b.brand.display_name);
      });
    } else {
      sorted.sort((a, b) => a.brand.display_name.localeCompare(b.brand.display_name));
    }
    return sorted;
  }, [rows, sortMode, showPaused]);

  function handleExportCsv() {
    const header = [
      'brand_code',
      'display_name',
      'is_paused',
      'tests_this_week',
      'tests_last_week',
      'tests_rolling_28d',
      'tests_this_month',
      'rework_28d',
      'rework_ratio',
      'drought',
    ];
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const r of visibleRows) {
      lines.push([
        escape(r.brand.brand_code),
        escape(r.brand.display_name),
        r.brand.is_paused ? 'true' : 'false',
        r.testsCurrentWeek,
        r.testsLastWeek,
        r.testsRolling28,
        r.testsCurrentMonth,
        r.reworkRolling28,
        formatRatio(r.testsRolling28, r.reworkRolling28),
        r.droughtFlag ? 'true' : 'false',
      ].map(escape).join(','));
    }
    const csv = lines.join('\n');
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cqip-client-coverage-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function openDrawer(row: CoverageRow) {
    setDrawerRow(row);
    setDrawerOpen(true);
  }

  const kpiCards = [
    { label: 'This Week', value: crossBrand.thisWeek },
    { label: 'Last Week', value: crossBrand.lastWeek },
    { label: 'Rolling 28 Days', value: crossBrand.rolling28 },
    { label: 'This Month', value: crossBrand.thisMonth },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-6 md:p-7 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Coverage</p>
            <h1 className="mt-2 text-3xl font-semibold text-[color:var(--f92-dark)]">Client Coverage</h1>
            <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
              Tests (Dev Client Review first-entries) by brand. Brands with ≤2 tests in the last 28 days are flagged.
            </p>
          </div>
          <SyncJiraButton />
        </div>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">Some data failed to load</p>
          <p className="mt-1 text-xs">{loadError}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <Card key={i} className="border-[color:var(--f92-border)] bg-white p-3 md:p-4 shadow-sm">
                <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--f92-tint)]" />
                <div className="mt-2 h-8 w-16 animate-pulse rounded bg-[color:var(--f92-tint)]" />
              </Card>
            ))
          : kpiCards.map(k => (
              <Card key={k.label} className="border-[color:var(--f92-border)] bg-white p-3 md:p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--f92-gray)]">{k.label}</p>
                <p className="mt-2 text-3xl md:text-4xl font-bold text-[color:var(--f92-navy)]">{k.value}</p>
                <p className="mt-2 text-xs text-[color:var(--f92-gray)]">Tests reached</p>
              </Card>
            ))}
      </div>

      <Card className="sticky top-2 z-10 p-3 md:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem]">
            <Label htmlFor="coverageSort" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Sort</Label>
            <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
              <SelectTrigger id="coverageSort" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="drought">Drought first</SelectItem>
                <SelectItem value="alpha">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex h-9 items-center gap-2 text-sm text-[color:var(--f92-dark)]">
            <input
              type="checkbox"
              checked={showPaused}
              onChange={e => setShowPaused(e.target.checked)}
              className="h-4 w-4 rounded border-[color:var(--f92-border)] text-[color:var(--f92-orange)] focus:ring-[color:var(--f92-orange)]"
            />
            Show paused brands
          </label>
          <div className="ml-auto">
            <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={visibleRows.length === 0}>
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[color:var(--f92-dark)]">
                <th className="px-4 py-3 font-semibold">Brand</th>
                <th className="px-4 py-3 font-semibold">This Week</th>
                <th className="px-4 py-3 font-semibold">Last Week</th>
                <th className="px-4 py-3 font-semibold">Rolling 28d</th>
                <th className="px-4 py-3 font-semibold">This Month</th>
                <th className="px-4 py-3 font-semibold">Rework 28d</th>
                <th className="px-4 py-3 font-semibold">Rework Ratio</th>
                <th className="px-4 py-3 font-semibold">Trend</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} className="border-t border-[color:var(--f92-border)]">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-[color:var(--f92-tint)]" />
                    </td>
                  </tr>
                ))
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[color:var(--f92-gray)]">
                    {brands.length === 0
                      ? 'No brands configured. Ask an admin to seed brands in Settings → Projects.'
                      : 'No brands match the current filters.'}
                  </td>
                </tr>
              ) : (
                visibleRows.map(row => {
                  const status = row.brand.is_paused
                    ? { label: 'Paused', variant: 'default' as const }
                    : row.droughtFlag
                      ? { label: 'Drought', variant: 'critical' as const }
                      : { label: 'Active', variant: 'resolved' as const };
                  return (
                    <tr
                      key={row.brand.id}
                      onClick={() => openDrawer(row)}
                      className={cn(
                        'cursor-pointer border-t border-[color:var(--f92-border)] transition hover:bg-[color:var(--f92-tint)]',
                        row.droughtFlag && !row.brand.is_paused ? 'bg-[color:var(--f92-warm)]' : '',
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[color:var(--f92-dark)]">{row.brand.display_name}</span>
                          <span className="rounded-full border border-[color:var(--f92-border)] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">
                            {row.brand.brand_code}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--f92-dark)]">{row.testsCurrentWeek}</td>
                      <td className="px-4 py-3 text-[color:var(--f92-dark)]">{row.testsLastWeek}</td>
                      <td className="px-4 py-3 font-semibold text-[color:var(--f92-navy)]">{row.testsRolling28}</td>
                      <td className="px-4 py-3 text-[color:var(--f92-dark)]">{row.testsCurrentMonth}</td>
                      <td className="px-4 py-3 text-[color:var(--f92-dark)]">{row.reworkRolling28}</td>
                      <td className="px-4 py-3 text-[color:var(--f92-dark)]">{formatRatio(row.testsRolling28, row.reworkRolling28)}</td>
                      <td className="px-4 py-3">
                        <Sparkline points={row.monthly} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <BrandDetailDrawer
        row={drawerRow}
        milestones={milestones}
        open={drawerOpen}
        onOpenChange={open => {
          setDrawerOpen(open);
          if (!open) setDrawerRow(null);
        }}
        isAdmin={isAdmin}
        onManageMilestones={() => {
          // Hand off to Settings → Coverage; the in-drawer inline manage
          // UI is served from that page (§5) to keep scope tight.
          setDrawerOpen(false);
          if (drawerRow) {
            window.location.href = `/dashboard/settings/coverage?brand=${encodeURIComponent(drawerRow.brand.id)}`;
          } else {
            window.location.href = '/dashboard/settings/coverage';
          }
        }}
      />
    </div>
  );
}
