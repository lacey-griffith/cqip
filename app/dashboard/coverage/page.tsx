'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BrandDetailDrawer } from '@/components/coverage/brand-detail-drawer';
import { BrandAdminDrawer } from '@/components/coverage/brand-admin-drawer';
import { AddBrandDrawer } from '@/components/coverage/add-brand-drawer';
import { PipelineStageDrawer } from '@/components/coverage/pipeline-stage-drawer';
import { CoverageGauge } from '@/components/coverage/coverage-gauge';
import {
  CoverageLedger,
  buildLedgerRow,
  type LedgerRow,
  type LedgerSortKey,
} from '@/components/coverage/coverage-ledger';
import { SyncJiraButton } from '@/components/dashboard/sync-jira-button';
import {
  ProjectBrandFilter,
  type FilterValue,
} from '@/components/filters/project-brand-filter';
import { downloadBrandedXlsx } from '@/lib/export/branded-xlsx';
import {
  buildCoverageRows,
  computeCoverageHealth,
  computeQualityScore,
  countInWindow,
  COVERAGE_THRESHOLD,
  formatReworkRatio,
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
  STAGE_LABELS,
  type PipelineBrand,
  type PipelineResponse,
  type PipelineStage,
  type PipelineTicket,
} from '@/lib/coverage/pipeline-stages';

// Sort key: the five sortable ledger columns plus 'status' — the default
// order (drought floats to top). 'status' is NOT a clickable column; it's
// the initial ordering, so when it's active none of the five column carets
// is highlighted (the ledger shows neutral ⇅ on all five).
type SortKey = LedgerSortKey | 'status';
type SortDir = 'asc' | 'desc';

// Status sort rank — higher wins on desc so the default (status desc) floats
// drought brands to top (paused sits between active and drought).
function statusRank(row: CoverageRow): number {
  if (row.brand.is_paused) return 2;
  if (row.droughtFlag) return 3;
  return 1;
}

interface ProjectRow {
  jira_project_key: string;
  client_name: string;
  display_name: string;
  brand_model: 'multi_brand' | 'single_brand';
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
  // Admin surfaces (Batch 005.1 Phase 4) — per-brand admin drawer + create-brand.
  const [adminBrand, setAdminBrand] = useState<Brand | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [addBrandOpen, setAddBrandOpen] = useState(false);

  // Live Jira pipeline (Batch 010). Keyed by brand_code; merged onto the
  // shared CoverageRow brand set so the ledger + KPIs share filter + paused scope.
  const [pipelineBrands, setPipelineBrands] = useState<Map<string, PipelineBrand>>(new Map());
  const [unresolvedCount, setUnresolvedCount] = useState(0);
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
      supabase.from('quality_logs').select('id, jira_ticket_id, client_brand, triggered_at, is_deleted').eq('is_deleted', false),
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

  // Refetch when the tab regains focus so external changes (other tabs,
  // the admin drawer) don't leave this page showing stale counts.
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

  // Milestones with no brand linked at ingest (§13 r18) — not counted toward any
  // brand's coverage. In-memory off the existing milestones state (no new query).
  const orphanMilestoneCount = useMemo(
    () => milestones.filter(m => !m.is_deleted && m.brand_id == null).length,
    [milestones],
  );

  // Program-health KPIs (Batch 005.1). FULL-SCOPE by design (Batch 005.22
  // boundary, spec §4.1): computed from the FULL brands / milestones / logs
  // state arrays, NEVER from the filtered/paused ledger rows. The KPI strip
  // reports program health and deliberately ignores the project/brand filter;
  // only the ledger below is filter-scoped. Overall Health + Brands Covered
  // share a single pass routed through the shared isInDrought predicate so
  // they can't diverge from the ledger's drought rail.
  const healthKpi = useMemo(() => computeCoverageHealth(brands, milestones), [brands, milestones]);
  const qualityKpi = useMemo(() => computeQualityScore(milestones, logs), [milestones, logs]);

  const singleBrandProjectKeys = useMemo(
    () => new Set(projects.filter(p => p.brand_model === 'single_brand').map(p => p.jira_project_key)),
    [projects],
  );

  // Filtered + pipeline-merged + sorted ledger rows. Merge happens BEFORE the
  // sort so the pipeline-derived keys (live / pipeline) can sort correctly.
  const ledgerRows = useMemo<LedgerRow[]>(() => {
    // Project + brand filter (Batch 005.22). Single-brand projects are exempt
    // from the brandCodes check — the project pill IS their whole affordance.
    const filtered = rows.filter(r => {
      if (filter.projectKeys.length > 0 && !filter.projectKeys.includes(r.brand.project_key)) return false;
      if (singleBrandProjectKeys.has(r.brand.project_key)) return true;
      if (filter.brandCodes.length > 0 && !filter.brandCodes.includes(r.brand.brand_code)) return false;
      return true;
    });
    const scoped = showPaused ? filtered : filtered.filter(r => !r.brand.is_paused);
    const merged = scoped.map(r => buildLedgerRow(r, pipelineBrands.get(r.brand.brand_code)));

    const dirMul = sortDir === 'asc' ? 1 : -1;
    const alpha = (a: LedgerRow, b: LedgerRow) => a.row.brand.display_name.localeCompare(b.row.brand.display_name);
    merged.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'brand':
          cmp = a.row.brand.display_name.localeCompare(b.row.brand.display_name);
          break;
        case 'delivered':
          cmp = a.row.testsRolling28 - b.row.testsRolling28;
          break;
        case 'thisWk':
          cmp = a.row.testsCurrentWeek - b.row.testsCurrentWeek;
          break;
        case 'live':
          cmp = a.live.ready - b.live.ready;
          break;
        case 'pipeline':
          cmp = a.wip - b.wip;
          break;
        case 'status':
          cmp = statusRank(a.row) - statusRank(b.row);
          break;
      }
      if (cmp !== 0) return dirMul * cmp;
      // Stable alphabetical tie-break, independent of sortDir.
      return alpha(a, b);
    });
    return merged;
  }, [rows, pipelineBrands, filter, showPaused, sortKey, sortDir, singleBrandProjectKeys]);

  function toggleSort(key: LedgerSortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Brand defaults to A-Z (asc); numeric columns default to desc.
      setSortDir(key === 'brand' ? 'asc' : 'desc');
    }
  }

  function handleExportXlsx() {
    // Leadership-ready: always exclude paused brands (ignoring the show-paused
    // toggle) and always sort alphabetically by brand name.
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
        formatReworkRatio(r.testsRolling28, r.reworkRolling28),
        r.droughtFlag ? 'DROUGHT' : '',
      ]),
      highlightRowWhen: row => row[8] === 'DROUGHT',
      highlightNote: '⚠ flagged rows had ≤2 tests in the last 28 days',
      filename: `CQIP_Client_Coverage_${dateStamp}`,
    });
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

  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const earliestLabel = crossBrand.earliest
    ? crossBrand.earliest.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  const ledgerSortKey: LedgerSortKey | null = sortKey === 'status' ? null : sortKey;

  return (
    <div className="space-y-6">
      {/* Header — eyebrow, title, threshold subtitle (no hardcoded literal:
          the number is sourced from COVERAGE_THRESHOLD, so Batch 010.1's
          per-brand targets are a one-touch change, spec §3.3), Sync button
          (which carries its own pass/fail status pill, Batch 005.10). */}
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-6 md:p-7 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Coverage</p>
            <h1 className="mt-2 text-3xl font-semibold text-[color:var(--f92-dark)]">Client Coverage</h1>
            <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
              {`Brands with ${COVERAGE_THRESHOLD} or fewer tests in the last 28 days are flagged. Expand a row for trend, rework & live pipeline detail.`}
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

      {/* KPI strip — one connected strip (gap-px reveals the border). LOCKED
          order: teal long-range pair · four rolling-window cards · Overall
          Health gauge · Brands Covered · Quality Score gauge. All FULL-SCOPE
          (crossBrand / healthKpi / qualityKpi read the full state arrays —
          they never consult the filter/paused-scoped ledgerRows). */}
      <div className="overflow-hidden rounded-2xl border border-[color:var(--f92-border)]">
        <div className="grid grid-cols-2 gap-px bg-[color:var(--f92-border)] sm:grid-cols-3 xl:grid-cols-9">
          {loading
            ? Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="bg-white px-5 py-4">
                  <div className="h-3 w-20 animate-pulse rounded bg-[color:var(--f92-tint)]" />
                  <div className="mt-2 h-7 w-14 animate-pulse rounded bg-[color:var(--f92-tint)]" />
                </div>
              ))
            : (
              <>
                {/* Long-range teal pair */}
                {[
                  { label: 'Tests This Year', value: crossBrand.ytd, sub: `Through ${todayLabel}` },
                  { label: 'Tests All Time', value: crossBrand.allTime, sub: earliestLabel ? `Since ${earliestLabel}` : '' },
                ].map(k => (
                  <div key={k.label} className="bg-[color:var(--kpi-longrange-bg)] px-5 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--kpi-longrange-fg)]">{k.label}</p>
                    <p className="mt-1.5 text-[27px] font-bold leading-none tabular-nums text-[color:var(--kpi-longrange-fg)]">{k.value}</p>
                    {k.sub ? <p className="mt-1.5 text-[10px] text-[color:var(--kpi-longrange-fg)] opacity-80">{k.sub}</p> : null}
                  </div>
                ))}
                {/* Rolling-window mid KPIs */}
                {[
                  { label: 'This Week', value: crossBrand.thisWeek },
                  { label: 'Last Week', value: crossBrand.lastWeek },
                  { label: 'Rolling 28d', value: crossBrand.rolling28 },
                  { label: 'This Month', value: crossBrand.thisMonth },
                ].map(k => (
                  <div key={k.label} className="bg-white px-5 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--f92-gray)]">{k.label}</p>
                    <p className="mt-1.5 text-[23px] font-bold leading-none tabular-nums" style={{ color: 'var(--ledger-kpi-mid)' }}>{k.value}</p>
                  </div>
                ))}
                {/* Overall Health gauge */}
                <div className="flex flex-col bg-white px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--f92-gray)]">Overall Health</p>
                  <div className="mt-auto flex justify-center pt-2">
                    <CoverageGauge
                      value={healthKpi.healthPct}
                      colorVar="var(--ledger-gauge-health)"
                      ariaLabel={`Overall Health ${healthKpi.healthPct === null ? 'not available' : `${healthKpi.healthPct} percent`}`}
                    />
                  </div>
                </div>
                {/* Brands Covered */}
                <div className="bg-white px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--f92-gray)]">Brands Covered</p>
                  <p className="mt-1.5 text-[23px] font-bold leading-none tabular-nums text-[color:var(--f92-dark)]">
                    {healthKpi.totalCount === 0 ? '—' : `${healthKpi.coveredCount}/${healthKpi.totalCount}`}
                  </p>
                  <p className="mt-1.5 text-[10px] text-[color:var(--f92-gray)]">Last 28 days</p>
                </div>
                {/* Quality Score gauge */}
                <div className="flex flex-col bg-white px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--f92-gray)]">Quality Score</p>
                  <div className="mt-auto flex justify-center pt-2">
                    <CoverageGauge
                      value={qualityKpi.scorePct}
                      colorVar="var(--ledger-gauge-quality)"
                      ariaLabel={`Quality Score ${qualityKpi.scorePct === null ? 'not available' : `${qualityKpi.scorePct} percent`}`}
                    />
                  </div>
                </div>
              </>
            )}
        </div>
      </div>

      <ProjectBrandFilter
        storageKey="cqip-filter-coverage"
        projects={projects}
        brands={brands}
        value={filter}
        onChange={setFilter}
        showPaused={showPaused}
      />

      <Card className="p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <Button size="sm" onClick={() => setAddBrandOpen(true)}>
              Add brand
            </Button>
          ) : null}
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

      <Card className="p-4 md:p-5">
        <CoverageLedger
          rows={ledgerRows}
          loading={loading}
          brandsConfigured={brands.length > 0}
          sortKey={ledgerSortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          isAdmin={isAdmin}
          onAdmin={brand => {
            setAdminBrand(brand);
            setAdminOpen(true);
          }}
          onFullDetail={row => {
            setDrawerRow(row);
            setDrawerOpen(true);
          }}
          onStage={openStageDrawer}
        />
        {/* Footers — both all-user, mirror each other. Orphan milestones
            (no brand linked at ingest, §13 r18) + live pipeline tickets with
            no brand assigned in Jira. Neither is counted toward any brand. */}
        {orphanMilestoneCount > 0 ? (
          <p className="mt-2 border-t border-[color:var(--f92-border)] px-1 pt-2 text-xs text-[color:var(--f92-gray)]">
            {orphanMilestoneCount} milestone{orphanMilestoneCount === 1 ? '' : 's'} not counted toward coverage — no brand linked.
          </p>
        ) : null}
        {unresolvedCount > 0 ? (
          <p className={`${orphanMilestoneCount > 0 ? 'mt-1' : 'mt-2 border-t border-[color:var(--f92-border)] pt-2'} px-1 text-xs text-[color:var(--f92-gray)]`}>
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
      />

      <BrandAdminDrawer
        brand={adminBrand}
        brands={brands}
        open={adminOpen}
        onOpenChange={open => {
          setAdminOpen(open);
          if (!open) setAdminBrand(null);
        }}
        onMutated={() => { void refetchAll(); }}
      />

      <AddBrandDrawer
        open={addBrandOpen}
        onOpenChange={setAddBrandOpen}
        projects={projects.map(p => ({ jira_project_key: p.jira_project_key, display_name: p.display_name }))}
        onCreated={() => { void refetchAll(); }}
      />
    </div>
  );
}
