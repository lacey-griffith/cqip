'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkline } from '@/components/coverage/sparkline';
import { BrandDetailDrawer } from '@/components/coverage/brand-detail-drawer';
import { PipelineStageDrawer } from '@/components/coverage/pipeline-stage-drawer';
import { OverlayCountBadge, OVERLAY_ACTIVE_CLASS } from '@/components/coverage/overlay-badge';
import { SyncJiraButton } from '@/components/dashboard/sync-jira-button';
import {
  ProjectBrandFilter,
  type FilterValue,
} from '@/components/filters/project-brand-filter';
import { downloadBrandedXlsx } from '@/lib/export/branded-xlsx';
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
import {
  OVERLAY_KEYS,
  OVERLAY_LABELS,
  PIPELINE_STAGES,
  STAGE_LABELS,
  type OverlayKey,
  type PipelineBrand,
  type PipelineResponse,
  type PipelineStage,
  type PipelineTicket,
} from '@/lib/coverage/pipeline-stages';
import { cn } from '@/lib/utils';

type SortKey =
  | 'brand'
  | 'thisWeek'
  | 'lastWeek'
  | 'rolling28'
  | 'thisMonth'
  | 'rework28'
  | 'reworkRatio'
  | 'status';
type SortDir = 'asc' | 'desc';

// Status sort rank — higher wins on desc so the default (status desc)
// floats drought brands to top, matching the pre-Batch-002.5b UX. The
// spec's phrasing was internally inconsistent on the asc ordering; we
// went with the "drought first on desc" reading since that matches the
// stated default behavior.
function statusRank(row: CoverageRow): number {
  if (row.brand.is_paused) return 2;
  if (row.droughtFlag) return 3;
  return 1;
}

function ratioSortValue(tests: number, rework: number): number {
  if (tests === 0) return -1; // '—' sorts lowest per spec
  return rework / tests;
}

interface ProjectRow {
  jira_project_key: string;
  client_name: string;
  display_name: string;
  brand_model: 'multi_brand' | 'single_brand';
}

function formatRatio(tests: number, rework: number): string {
  if (tests === 0) return '—';
  return (rework / tests).toFixed(2);
}

export default function CoveragePage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [logs, setLogs] = useState<QualityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showPaused, setShowPaused] = useState(false);
  const [filter, setFilter] = useState<FilterValue>({ projectKeys: [], brandCodes: [] });
  const [drawerRow, setDrawerRow] = useState<CoverageRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Live Jira pipeline (Batch 010). Keyed by brand_code; merged onto the
  // shared CoverageRow brand set so both tables share filter + paused scope.
  const [pipelineBrands, setPipelineBrands] = useState<Map<string, PipelineBrand>>(new Map());
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  // Overlay toggles are visual-only (they never filter rows out). Local state.
  const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>({
    needs_info: false,
    troubleshooting: false,
    on_hold: false,
  });
  const [stageDrawer, setStageDrawer] = useState<{
    brandLabel: string;
    stageLabel: string;
    tickets: PipelineTicket[];
  } | null>(null);

  const refetchAll = useCallback(async () => {
    const [brandsRes, projectsRes, milestonesRes, logsRes, pipelineRes] = await Promise.all([
      supabase.from('brands').select('id, project_key, brand_code, jira_value, display_name, is_active, is_paused, paused_reason').order('display_name'),
      supabase.from('projects').select('jira_project_key, client_name, display_name, brand_model').eq('is_active', true).order('display_name'),
      supabase.from('test_milestones').select('id, jira_ticket_id, jira_ticket_url, jira_summary, brand_id, brand_jira_value, milestone_type, reached_at, source, created_by, notes, is_deleted').eq('is_deleted', false),
      supabase.from('quality_logs').select('id, client_brand, triggered_at, is_deleted').eq('is_deleted', false),
      // Live Jira pipeline. Server route — keeps JIRA_API_TOKEN off the client.
      fetch('/api/coverage/pipeline')
        .then(async (r) =>
          r.ok
            ? { ok: true as const, data: (await r.json()) as PipelineResponse }
            : { ok: false as const, detail: `${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`.trim() },
        )
        .catch((e) => ({ ok: false as const, detail: e instanceof Error ? e.message : String(e) })),
    ]);

    // Surface partial failures so the page doesn't silently render as empty.
    const failures: string[] = [];
    if (brandsRes.error) failures.push(`brands: ${brandsRes.error.message}`);
    if (projectsRes.error) failures.push(`projects: ${projectsRes.error.message}`);
    if (milestonesRes.error) failures.push(`test_milestones: ${milestonesRes.error.message}`);
    if (logsRes.error) failures.push(`quality_logs: ${logsRes.error.message}`);

    if (pipelineRes.ok) {
      const data = pipelineRes.data;
      setPipelineBrands(new Map(data.brands.map((b) => [b.brand_code, b])));
      setUnresolvedCount(data.unresolved_count);
      // Per-project Jira errors are partial — surface but still render counts.
      if (data.errors.length > 0) failures.push(`pipeline (partial): ${data.errors.join('; ')}`);
    } else {
      failures.push(`pipeline: ${pipelineRes.detail}`);
    }

    if (failures.length > 0) {
      console.error('[coverage] fetch failures', failures);
      setLoadError(failures.join(' · '));
    } else {
      setLoadError(null);
    }

    setBrands((brandsRes.data ?? []) as Brand[]);
    setProjects((projectsRes.data ?? []) as ProjectRow[]);
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
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const allTime = milestones.filter(m => !m.is_deleted);
    const earliest = allTime.reduce<Date | null>((acc, m) => {
      const t = new Date(m.reached_at);
      if (Number.isNaN(t.getTime())) return acc;
      return !acc || t < acc ? t : acc;
    }, null);
    return {
      thisWeek: countInWindow(milestones, null, startOfCurrentWeek(), now),
      lastWeek: countInWindow(milestones, null, startOfLastWeek(), endOfLastWeek()),
      rolling28: countInWindow(milestones, null, startOfRolling28(), now),
      thisMonth: countInWindow(milestones, null, startOfCurrentMonth(), now),
      ytd: countInWindow(milestones, null, startOfYear, now),
      allTime: allTime.length,
      earliest,
    };
  }, [milestones]);

  const rows = useMemo(() => buildCoverageRows(brands, milestones, logs), [brands, milestones, logs]);

  const singleBrandProjectKeys = useMemo(
    () => new Set(projects.filter(p => p.brand_model === 'single_brand').map(p => p.jira_project_key)),
    [projects],
  );

  const visibleRows = useMemo(() => {
    // Project + brand filter (Batch 005.22 Phase 2). Applied BEFORE
    // the paused-row toggle so the paused-set logic still keys off
    // the project-scoped view, not the global brand list.
    //
    // Single-brand projects (Phase 2.1) are exempt from the
    // brandCodes check — the project pill IS the entire filter
    // affordance for them. Without this exemption, selecting both
    // a multi-brand project's brand codes AND a single-brand project
    // would hide the single-brand project's row, which is not the
    // user's intent.
    const filteredByProjectBrand = rows.filter(r => {
      if (filter.projectKeys.length > 0 && !filter.projectKeys.includes(r.brand.project_key)) return false;
      if (singleBrandProjectKeys.has(r.brand.project_key)) return true;
      if (filter.brandCodes.length > 0 && !filter.brandCodes.includes(r.brand.brand_code)) return false;
      return true;
    });
    const filtered = showPaused ? filteredByProjectBrand : filteredByProjectBrand.filter(r => !r.brand.is_paused);
    const sorted = [...filtered];
    const dirMul = sortDir === 'asc' ? 1 : -1;
    const alphaTieBreak = (a: CoverageRow, b: CoverageRow) => a.brand.display_name.localeCompare(b.brand.display_name);
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'brand':
          cmp = a.brand.display_name.localeCompare(b.brand.display_name);
          break;
        case 'thisWeek':
          cmp = a.testsCurrentWeek - b.testsCurrentWeek;
          break;
        case 'lastWeek':
          cmp = a.testsLastWeek - b.testsLastWeek;
          break;
        case 'rolling28':
          cmp = a.testsRolling28 - b.testsRolling28;
          break;
        case 'thisMonth':
          cmp = a.testsCurrentMonth - b.testsCurrentMonth;
          break;
        case 'rework28':
          cmp = a.reworkRolling28 - b.reworkRolling28;
          break;
        case 'reworkRatio':
          cmp = ratioSortValue(a.testsRolling28, a.reworkRolling28)
              - ratioSortValue(b.testsRolling28, b.reworkRolling28);
          break;
        case 'status':
          cmp = statusRank(a) - statusRank(b);
          break;
      }
      if (cmp !== 0) return dirMul * cmp;
      // Stable alphabetical tie-break, independent of sortDir, so equal
      // rows don't flip order when the user toggles direction.
      return alphaTieBreak(a, b);
    });
    return sorted;
  }, [rows, sortKey, sortDir, showPaused, filter, singleBrandProjectKeys]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Status and brand default to the more-useful first direction
      // (desc for status so drought floats up; asc for brand for A-Z).
      setSortDir(key === 'brand' ? 'asc' : 'desc');
    }
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

  function handleExportXlsx() {
    // Leadership-ready: always exclude paused brands (ignoring the
    // show-paused toggle) and always sort alphabetically by brand name
    // regardless of the table's current sort state.
    const exportRows = rows
      .filter(r => !r.brand.is_paused)
      .slice()
      .sort((a, b) => a.brand.display_name.localeCompare(b.brand.display_name));

    const droughtCount = exportRows.filter(r => r.droughtFlag).length;
    const dateStamp = new Date().toISOString().slice(0, 10);
    const friendlyStamp = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });

    downloadBrandedXlsx({
      title: 'Client Coverage',
      subtitle: `Exported ${friendlyStamp}`,
      summaryRows: [
        { label: 'Brands tracked (active)', value: exportRows.length },
        { label: 'Drought brands', value: droughtCount },
        { label: 'Tests this week', value: crossBrand.thisWeek },
        { label: 'Tests rolling 28 days', value: crossBrand.rolling28 },
      ],
      headers: [
        'Brand Code',
        'Brand',
        'Tests This Week',
        'Tests Last Week',
        'Tests Last 28 Days',
        'Tests This Month',
        'Rework Events (28d)',
        'Rework Ratio',
        'Coverage Flag',
      ],
      rows: exportRows.map(r => [
        r.brand.brand_code,
        r.brand.display_name,
        r.testsCurrentWeek,
        r.testsLastWeek,
        r.testsRolling28,
        r.testsCurrentMonth,
        r.reworkRolling28,
        formatRatio(r.testsRolling28, r.reworkRolling28),
        r.droughtFlag ? 'DROUGHT' : '',
      ]),
      highlightRowWhen: row => row[8] === 'DROUGHT',
      highlightNote: '⚠ flagged rows had ≤2 tests in the last 28 days',
      filename: `CQIP_Client_Coverage_${dateStamp}`,
    });
  }

  function openDrawer(row: CoverageRow) {
    setDrawerRow(row);
    setDrawerOpen(true);
  }

  function openStageDrawer(row: CoverageRow, stage: PipelineStage) {
    const pipeline = pipelineBrands.get(row.brand.brand_code);
    const tickets = (pipeline?.tickets ?? []).filter((t) => t.stage === stage);
    setStageDrawer({
      brandLabel: row.brand.display_name,
      stageLabel: STAGE_LABELS[stage],
      tickets,
    });
  }

  const activeOverlayKeys = OVERLAY_KEYS.filter((k) => overlays[k]);

  const kpiCards = [
    { label: 'This Week', value: crossBrand.thisWeek, hint: 'Tests reached' },
    { label: 'Last Week', value: crossBrand.lastWeek, hint: 'Tests reached' },
    { label: 'Rolling 28 Days', value: crossBrand.rolling28, hint: 'Tests reached' },
    { label: 'This Month', value: crossBrand.thisMonth, hint: 'Tests reached' },
  ];

  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const earliestLabel = crossBrand.earliest
    ? crossBrand.earliest.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  const deliveredCards = [
    { label: 'Tests This Year', value: crossBrand.ytd, hint: `Through ${todayLabel}` },
    { label: 'Tests All Time', value: crossBrand.allTime, hint: earliestLabel ? `Since ${earliestLabel}` : null },
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
                <p className="mt-2 text-xs text-[color:var(--f92-gray)]">{k.hint}</p>
              </Card>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {loading
          ? Array.from({ length: 2 }, (_, i) => (
              <Card key={i} className="border-[color:var(--f92-border)] bg-white p-3 md:p-4 shadow-sm">
                <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--f92-tint)]" />
                <div className="mt-2 h-8 w-16 animate-pulse rounded bg-[color:var(--f92-tint)]" />
              </Card>
            ))
          : deliveredCards.map(k => (
              // Long-range accent (Batch 010): teal treatment promotes these
              // two cumulative KPIs above the rolling-window row. Tokens in
              // globals.css (§13 rule 25) — WCAG AA in both themes.
              <Card
                key={k.label}
                className="border-2 border-[color:var(--kpi-longrange-border)] bg-[color:var(--kpi-longrange-bg)] p-3 md:p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--kpi-longrange-fg)]">{k.label}</p>
                <p className="mt-2 text-3xl md:text-4xl font-bold text-[color:var(--kpi-longrange-fg)]">{k.value}</p>
                {k.hint ? <p className="mt-2 text-xs text-[color:var(--kpi-longrange-fg)] opacity-80">{k.hint}</p> : null}
              </Card>
            ))}
      </div>

      <ProjectBrandFilter
        storageKey="cqip-filter-coverage"
        projects={projects}
        brands={brands}
        value={filter}
        onChange={setFilter}
        showPaused={showPaused}
      />

      <Card className="sticky top-2 z-10 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <label className="flex h-9 items-center gap-2 text-sm text-[color:var(--f92-dark)]">
              <input
                type="checkbox"
                checked={showPaused}
                onChange={e => setShowPaused(e.target.checked)}
                className="h-4 w-4 rounded border-[color:var(--f92-border)] text-[color:var(--f92-orange)] focus:ring-[color:var(--f92-orange)]"
              />
              Show paused brands
            </label>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportXlsx}
              disabled={rows.every(r => r.brand.is_paused)}
            >
              Export to Excel
            </Button>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="cqip-section-title text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--f92-navy)]">Output</h2>
        <p className="mt-1 text-xs text-[color:var(--f92-gray)]">Tests delivered (Dev Client Review first-entries) by brand.</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[color:var(--f92-dark)]">
                <SortableHeader k="brand" label="Brand" />
                <SortableHeader k="thisWeek" label="This Week" />
                <SortableHeader k="lastWeek" label="Last Week" />
                <SortableHeader k="rolling28" label="Rolling 28d" />
                <SortableHeader k="thisMonth" label="This Month" />
                <SortableHeader k="rework28" label="Rework 28d" />
                <SortableHeader k="reworkRatio" label="Rework Ratio" />
                <th className="px-4 py-3 font-semibold">Trend</th>
                <SortableHeader k="status" label="Status" />
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
                        row.brand.is_paused
                          ? 'bg-slate-100 text-[color:var(--f92-gray)] opacity-75 dark:bg-slate-900/40'
                          : row.droughtFlag
                            ? 'bg-[color:var(--f92-warm)]'
                            : '',
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="cqip-section-title text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--f92-navy)]">Pipeline</h2>
          <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
            Live work-in-progress by stage (from Jira). Click any count to see the tickets.
          </p>
        </div>
        {/* Overlay toggles live with the Pipeline table — they only badge
            pipeline counts. State + handlers unchanged; render-location only. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--f92-gray)]">
            Overlays
          </span>
          {OVERLAY_KEYS.map(k => (
            <button
              key={k}
              type="button"
              aria-pressed={overlays[k]}
              onClick={() => setOverlays(o => ({ ...o, [k]: !o[k] }))}
              className={cn(
                'inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition',
                overlays[k]
                  ? OVERLAY_ACTIVE_CLASS[k]
                  : 'border-[color:var(--f92-border)] bg-transparent text-[color:var(--f92-gray)] hover:bg-[color:var(--f92-tint)]',
              )}
            >
              {OVERLAY_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[color:var(--f92-dark)]">
                <th className="px-4 py-3 font-semibold">Brand</th>
                {PIPELINE_STAGES.map(stage => (
                  <th key={stage} className="px-4 py-3 font-semibold">{STAGE_LABELS[stage]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} className="border-t border-[color:var(--f92-border)]">
                    <td colSpan={1 + PIPELINE_STAGES.length} className="px-4 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-[color:var(--f92-tint)]" />
                    </td>
                  </tr>
                ))
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={1 + PIPELINE_STAGES.length} className="px-4 py-8 text-center text-[color:var(--f92-gray)]">
                    {brands.length === 0
                      ? 'No brands configured. Ask an admin to seed brands in Settings → Projects.'
                      : 'No brands match the current filters.'}
                  </td>
                </tr>
              ) : (
                visibleRows.map(row => {
                  const pipeline = pipelineBrands.get(row.brand.brand_code);
                  return (
                    <tr
                      key={row.brand.id}
                      className={cn(
                        'border-t border-[color:var(--f92-border)]',
                        row.brand.is_paused
                          ? 'bg-slate-100 text-[color:var(--f92-gray)] opacity-75 dark:bg-slate-900/40'
                          : '',
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
                      {PIPELINE_STAGES.map(stage => {
                        const count = pipeline?.counts[stage] ?? 0;
                        const overlayBadges = activeOverlayKeys
                          .map(k => ({ k, n: pipeline?.overlays[k][stage] ?? 0 }))
                          .filter(({ n }) => n > 0);
                        return (
                          <td key={stage} className="px-4 py-3 align-top">
                            {count > 0 ? (
                              <button
                                type="button"
                                onClick={() => openStageDrawer(row, stage)}
                                className="font-semibold text-[color:var(--f92-navy)] hover:underline focus-visible:underline"
                              >
                                {count}
                              </button>
                            ) : (
                              <span className="text-[color:var(--f92-lgray)]">0</span>
                            )}
                            {overlayBadges.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {overlayBadges.map(({ k, n }) => (
                                  <OverlayCountBadge key={k} overlayKey={k} count={n} />
                                ))}
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {unresolvedCount > 0 ? (
          <p className="border-t border-[color:var(--f92-border)] px-4 py-2 text-xs text-[color:var(--f92-gray)]">
            {unresolvedCount} active {unresolvedCount === 1 ? 'ticket' : 'tickets'} not shown — no brand assigned in Jira.
          </p>
        ) : null}
      </Card>

      <PipelineStageDrawer
        open={stageDrawer !== null}
        onOpenChange={open => {
          if (!open) setStageDrawer(null);
        }}
        brandLabel={stageDrawer?.brandLabel ?? ''}
        stageLabel={stageDrawer?.stageLabel ?? ''}
        tickets={stageDrawer?.tickets ?? []}
      />

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
