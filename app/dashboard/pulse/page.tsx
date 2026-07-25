'use client';

// Batch 012 — Pulse (Directive Matrix). The main Pulse view.
//
// Phase A shipped this as "Client Library"; Phase E1 (2026-07-17) renamed the
// user-facing area to Pulse, moved the route to /dashboard/pulse, and added
// deep-linkable per-brand pages + a contextual client nav. This page is
// unchanged in content — it is the directive × brand status matrix per project.
// (Internal identifiers under lib/client-library/* keep their name — they are
// concern-named, not page-named; API routes are untouched.)
//
// Any authenticated user can VIEW; edit affordances render only for admins and
// the routes enforce admin server-side regardless. Reads/writes ONLY the two
// directive tables (directives + directive_brand_status) + monitoring_findings
// (Phase B panel) — never the live coverage tables.
//
// This page broadcasts its selected project (sessionStorage + a `pulse:project`
// CustomEvent) so the contextual client nav can mirror the picker without a
// URL-search-param dependency (the shared nav can't use useSearchParams under
// statically-prerendered dashboard pages). Brand pages carry the project in
// the URL instead.
//
// Phase C/D + E2/E3 are OUT OF SCOPE — TODOs only:
// TODO(Phase C): Jira ticketing from a cell.
// TODO(Phase D): public bug-submission form + per-cell ticket links.
// TODO(Phase E2): Convert config sync on the brand page.
// TODO(Phase E3): expandable directive rows with comments + lifecycle dates.
// TODO(follow-on): directive edit/archive UI; brand-target picker (fan-out is
//   all-active-brands in Phase A).

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/layout/toaster';
import { CellEditStrip } from '@/components/client-library/cell-edit-strip';
import {
  DIRECTIVE_TYPES,
  type CellStatus,
  type DirectiveType,
} from '@/lib/client-library/directives';
import {
  buildMatrixRows,
  countHiddenByStatus,
  visibleMatrixBrands,
  MATRIX_SORT_KEYS,
  MATRIX_SORT_LABEL,
  MATRIX_STATUS_FILTERS,
  MATRIX_STATUS_FILTER_LABEL,
  type MatrixSortKey,
  type MatrixStatusFilter,
} from '@/lib/client-library/matrix-controls';
import { saveDirectiveCell } from '@/lib/client-library/directive-cell-save';
import {
  compareForPanel,
  type AdminStatus,
  type FindingSeverity,
  type IssueType,
} from '@/lib/client-library/monitoring';
import {
  writeStoredPulseProject,
  readStoredPulseProject,
  PULSE_PROJECT_EVENT,
} from '@/lib/client-library/pulse-project-channel';

interface ProjectRow {
  jira_project_key: string;
  display_name: string;
}

interface BrandRow {
  id: string;
  brand_code: string;
  display_name: string;
  is_paused: boolean;
}

interface DirectiveRow {
  id: string;
  title: string;
  directive_type: DirectiveType;
  description: string | null;
  status: string;
  created_at: string;
}

interface CellRow {
  id: string;
  directive_id: string;
  brand_id: string;
  status: CellStatus;
  note: string | null;
}

// Batch 012 Phase B — a monitoring finding for the "Needs action" panel.
// `brand` is the embedded brands row (null when brand_id is unresolved).
interface FindingRow {
  id: string;
  source: string;
  external_ref: string | null;
  brand_id: string | null;
  convert_test_id: string | null;
  issue_type: IssueType;
  severity: FindingSeverity | null;
  summary: string;
  status: string;
  detected_at: string;
  brand: { brand_code: string; display_name: string; project_key: string } | null;
}

const TYPE_LABEL: Record<DirectiveType, string> = {
  goal: 'Goal',
  trigger: 'Trigger',
  site_area: 'Site area',
  audience: 'Audience',
};

const STATUS_LABEL: Record<CellStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
  n_a: 'N/A',
};

// Cell status → token color (§13 r25 — reference tokens, no inline hex).
// done = --status-resolved (green), blocked = --status-blocked (red, the
// signal is load-bearing per spec §5). todo/in_progress/n_a use existing
// neutral + in-progress tokens; n_a renders hollow (not owed).
const STATUS_DOT: Record<CellStatus, string> = {
  todo: 'var(--f92-lgray)',
  in_progress: 'var(--status-in-progress)',
  done: 'var(--status-resolved)',
  blocked: 'var(--status-blocked)',
  n_a: 'transparent',
};

// Batch 012 Phase B — severity dot colors (§13 r25, tokens only). critical is
// the load-bearing red signal; unset severity falls through to gray.
const SEVERITY_DOT: Record<FindingSeverity, string> = {
  critical: 'var(--status-blocked)',
  medium: 'var(--pill-amber-border)',
  low: 'var(--f92-lgray)',
};
function severityDot(severity: FindingSeverity | null): string {
  return severity === null ? 'var(--f92-lgray)' : SEVERITY_DOT[severity];
}

const ISSUE_LABEL: Record<IssueType, string> = {
  no_conversions: 'No conversions',
  no_visitors: 'No visitors',
  high_bounce: 'High bounce',
  low_engagement: 'Low engagement',
  error: 'Error',
  other: 'Other',
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

const DEFAULT_PROJECT = 'NBLYCRO';

// This page is the live consumer of the pulse:project channel. The channel
// (lib/client-library/pulse-project-channel.ts) hands a project selection
// across the app without a URL param (the shared nav can't read search params
// under statically-prerendered dashboard pages): sessionStorage persists the
// pick across navigation — initialLoad seeds from it on mount — and a
// CustomEvent lets EXTERNAL producers (the cross-project client nav's group
// headers, the brand page's return-context broadcast) re-scope the matrix live
// while it's already mounted (see the listener effect below). This page's own
// producers persist the pick with writeStoredPulseProject (no self-dispatch —
// they update state + load directly). One definition shared by the page, nav,
// and brand page (extracted from the E1 page-local copy in the E1 follow-on).

export default function ClientLibraryPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectKey, setProjectKey] = useState<string>('');
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [directives, setDirectives] = useState<DirectiveRow[]>([]);
  const [cells, setCells] = useState<CellRow[]>([]);
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Inline create affordance (admin) — collapsed behind the header button,
  // expands as a pinned strip at the top of the matrix (no overlay).
  const [createOpen, setCreateOpen] = useState(false);
  // Inline cell editor — which cell's row-expansion strip is open (one at a
  // time). Keyed by (directiveId, brandId); only real cells are ever set here.
  const [expandedCell, setExpandedCell] = useState<{
    directiveId: string;
    brandId: string;
  } | null>(null);

  // Matrix controls (search · status filter · sort · hide paused). All four are
  // client-side over data already loaded — no refetch on change. Session-only
  // React state by design (spec §6): no sessionStorage / localStorage / URL
  // params, so a reload resets them. These are transient find-and-scan controls,
  // unlike ProjectBrandFilter's persisted page scope.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MatrixStatusFilter>('open');
  const [sortKey, setSortKey] = useState<MatrixSortKey>('title');
  const [hidePaused, setHidePaused] = useState(false);

  // Fetch brands + directives + cells for a project. RLS allows authenticated
  // SELECT on both new tables, so direct client queries are fine (spec §4).
  const loadProject = useCallback(async (key: string) => {
    if (!key) return;
    // Single data load per §4: brands + directives + monitoring findings.
    // Findings are fetched status='new' across all brands (RLS allows
    // authenticated SELECT) and scoped to this project client-side via the
    // embedded brand.project_key; null-brand findings surface under
    // "Unassigned" regardless of project so they're never lost.
    const [brandsRes, directivesRes, findingsRes] = await Promise.all([
      supabase
        .from('brands')
        .select('id, brand_code, display_name, is_paused')
        .eq('project_key', key)
        .eq('is_active', true)
        .order('display_name'),
      supabase
        .from('directives')
        .select('id, title, directive_type, description, status, created_at')
        .eq('project_key', key)
        .eq('status', 'active')
        .order('created_at'),
      supabase
        .from('monitoring_findings')
        .select(
          'id, source, external_ref, brand_id, convert_test_id, issue_type, severity, summary, status, detected_at, brand:brands(brand_code, display_name, project_key)',
        )
        .eq('status', 'new')
        .order('detected_at', { ascending: false }),
    ]);

    const failures: string[] = [];
    if (brandsRes.error) failures.push(`brands: ${brandsRes.error.message}`);
    if (directivesRes.error) failures.push(`directives: ${directivesRes.error.message}`);
    if (findingsRes.error) failures.push(`findings: ${findingsRes.error.message}`);

    const directiveRows = (directivesRes.data ?? []) as DirectiveRow[];
    let cellRows: CellRow[] = [];
    if (directiveRows.length > 0) {
      const { data: cellData, error: cellErr } = await supabase
        .from('directive_brand_status')
        .select('id, directive_id, brand_id, status, note')
        .in('directive_id', directiveRows.map((d) => d.id));
      if (cellErr) failures.push(`cells: ${cellErr.message}`);
      cellRows = (cellData ?? []) as CellRow[];
    }

    // supabase-js returns a to-one embed (brand_id → brands.id) as a single
    // object, but its generated type widens to an array; normalize to one.
    const findingRows: FindingRow[] = ((findingsRes.data ?? []) as unknown[]).map((raw) => {
      const r = raw as Omit<FindingRow, 'brand'> & {
        brand: FindingRow['brand'] | FindingRow['brand'][];
      };
      const brand = Array.isArray(r.brand) ? (r.brand[0] ?? null) : r.brand;
      return { ...r, brand };
    });

    setBrands((brandsRes.data ?? []) as BrandRow[]);
    setDirectives(directiveRows);
    setCells(cellRows);
    setFindings(findingRows);
    setLoadError(failures.length > 0 ? failures.join(' · ') : null);
    if (failures.length > 0) console.error('[pulse] fetch failures', failures);
  }, []);

  // Initial load: projects + admin role, then the default project's matrix.
  useEffect(() => {
    let cancelled = false;
    async function initialLoad() {
      const { data: projectData, error: projectErr } = await supabase
        .from('projects')
        .select('jira_project_key, display_name')
        .eq('is_active', true)
        .order('display_name');
      if (cancelled) return;
      if (projectErr) {
        setLoadError(`projects: ${projectErr.message}`);
        setLoading(false);
        return;
      }
      const projectRows = (projectData ?? []) as ProjectRow[];
      // Prefer the last-picked project (shared with the contextual client nav
      // via the pulse:project channel) so navigating back from a brand page
      // restores the pick, then the default, then the first project.
      const storedKey = readStoredPulseProject();
      const initialKey =
        (storedKey && projectRows.some((p) => p.jira_project_key === storedKey) ? storedKey : null) ??
        projectRows.find((p) => p.jira_project_key === DEFAULT_PROJECT)?.jira_project_key ??
        projectRows[0]?.jira_project_key ??
        '';

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

      if (cancelled) return;
      setProjects(projectRows);
      setProjectKey(initialKey);
      writeStoredPulseProject(initialKey); // persist only — this page owns the state (no self-dispatch)
      await loadProject(initialKey);
      if (!cancelled) setLoading(false);
    }
    initialLoad();
    return () => {
      cancelled = true;
    };
  }, [loadProject]);

  function handleProjectChange(key: string) {
    setProjectKey(key);
    setExpandedCell(null); // stale across a project switch
    writeStoredPulseProject(key); // persist only — this page owns the state (no self-dispatch)
    void loadProject(key);
  }

  // Live consumer of the pulse:project channel for EXTERNAL producers only —
  // the cross-project client nav's multi-brand group headers and the brand
  // page. Those `broadcastPulseProject`; when the user is ALREADY on the matrix
  // a same-URL header Link doesn't remount the page, so initialLoad's one-time
  // sessionStorage read never re-fires — this listener re-scopes in place on
  // the event. (On a real navigation to a fresh mount, initialLoad's
  // readStoredPulseProject() handles it; the two paths are complementary.)
  //
  // This page's OWN producers (initialLoad / handleProjectChange) intentionally
  // use writeStoredPulseProject (persist only, no dispatch): they already set
  // projectKey + load directly, so routing through the event would double-fire
  // loadProject (broadcast dispatches synchronously, before React commits the
  // setState, so the guard's projectKey closure would still be stale). The
  // `detail !== projectKey` guard here then only needs to skip a redundant load
  // when a nav header for the already-current project is clicked.
  //
  // The handler's setState runs on the event, not synchronously in the effect
  // body, so the set-state-in-effect rule doesn't apply. Re-subscribes when
  // projectKey changes so the guard reads a fresh committed value (cheap).
  useEffect(() => {
    function onProject(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string' && detail && detail !== projectKey) {
        setProjectKey(detail);
        setExpandedCell(null); // symmetric with handleProjectChange — no stale open editor across a switch
        void loadProject(detail);
      }
    }
    window.addEventListener(PULSE_PROJECT_EVENT, onProject);
    return () => window.removeEventListener(PULSE_PROJECT_EVENT, onProject);
  }, [projectKey, loadProject]);

  const cellByKey = useMemo(() => {
    const map = new Map<string, CellRow>();
    for (const cell of cells) map.set(`${cell.directive_id}:${cell.brand_id}`, cell);
    return map;
  }, [cells]);

  // The rendered row set: group cells per directive → classify (active /
  // resolved / unstarted) → filter (search AND status) → sort. Each row carries
  // its own `outstanding`, so the pill renders off the row and there is no
  // second, divergent Outstanding computation on this page.
  //
  // NOTE (spec §3.1): this reads the FULL `cells` array and takes no
  // hidePaused argument. That is deliberate and load-bearing — hiding paused
  // COLUMNS must never change an Outstanding count. Do not pass a
  // visible-brand-scoped cell subset in here.
  const matrixRows = useMemo(
    () => buildMatrixRows(directives, cells, { search, statusFilter, sortKey }),
    [directives, cells, search, statusFilter, sortKey],
  );

  // The rendered brand axis. Orthogonal to matrixRows above: this is the only
  // thing the hide-paused toggle touches.
  const visibleBrands = useMemo(
    () => visibleMatrixBrands(brands, hidePaused),
    [brands, hidePaused],
  );
  const pausedBrandCount = useMemo(() => brands.filter((b) => b.is_paused).length, [brands]);

  // Directives matching the search but excluded by the status filter. Surfaced
  // so "search found nothing" can never be read as "it doesn't exist" — see
  // countHiddenByStatus for why that false negative is dangerous here.
  const hiddenByStatus = useMemo(
    () => countHiddenByStatus(directives, cells, { search, statusFilter, sortKey }),
    [directives, cells, search, statusFilter, sortKey],
  );

  // "Needs action" panel (spec §4). Assigned findings are scoped to the
  // selected project via the embedded brand.project_key; null-brand findings
  // surface under "Unassigned" regardless of project. Both sorted by severity
  // then detected_at desc.
  const assignedFindings = useMemo(
    () =>
      findings
        .filter((f) => f.brand_id !== null && f.brand?.project_key === projectKey)
        .sort(compareForPanel),
    [findings, projectKey],
  );
  const unassignedFindings = useMemo(
    () => findings.filter((f) => f.brand_id === null).sort(compareForPanel),
    [findings],
  );
  const hasFindings = assignedFindings.length > 0 || unassignedFindings.length > 0;

  const handleFindingStatus = useCallback(
    async (findingId: string, status: AdminStatus) => {
      // Optimistic: a finding that leaves 'new' drops out of the panel.
      setFindings((prev) => prev.filter((f) => f.id !== findingId));
      try {
        const res = await fetch('/api/admin/monitoring/findings/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ finding_id: findingId, status }),
        });
        const result: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
        if (!res.ok || !result.ok) {
          toast(`❌ ${result.error ?? `Update failed (${res.status})`}`);
          void loadProject(projectKey); // reconcile — put it back
          return;
        }
        toast(status === 'dismissed' ? '✅ Dismissed' : '✅ Marked actioned');
      } catch (err) {
        toast(`❌ ${err instanceof Error ? err.message : String(err)}`);
        void loadProject(projectKey);
      }
    },
    [projectKey, loadProject, toast],
  );

  // Inline cell save (admin). The optimistic + reconcile-on-error orchestration
  // now lives in the shared saveDirectiveCell (lib/client-library/
  // directive-cell-save.ts) so the matrix and the per-brand page share one
  // implementation. This wrapper supplies the matrix-specific bits: the local
  // optimistic update (keyed by the unique directive_id/brand_id pair) +
  // collapsing the open strip, and the reconcile (reload the project).
  // `nextNote` arrives already normalized (trim || null).
  const handleCellSave = useCallback(
    (cell: CellRow, nextStatus: CellStatus, nextNote: string | null) =>
      saveDirectiveCell(cell, nextStatus, nextNote, {
        applyOptimistic: (target, status, note) => {
          setCells((prev) =>
            prev.map((c) =>
              c.directive_id === target.directive_id && c.brand_id === target.brand_id
                ? { ...c, status, note }
                : c,
            ),
          );
          setExpandedCell(null);
        },
        reconcile: () => void loadProject(projectKey),
        toast,
      }),
    [projectKey, loadProject, toast],
  );

  const projectLabel = projects.find((p) => p.jira_project_key === projectKey)?.display_name ?? projectKey;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase text-[color:var(--f92-gray)]" style={{ letterSpacing: 'var(--tracking-eyebrow)' }}>
            Pulse
          </p>
          <h1 className="text-2xl font-semibold text-[color:var(--f92-dark)]">Directive Matrix</h1>
          <p className="mt-1 text-sm text-[color:var(--f92-gray)]">
            Cross-brand experimentation directives × brand status. Outstanding
            counts exclude paused brands.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <Label htmlFor="clProject" className="sr-only">Project</Label>
            <Select value={projectKey} onValueChange={handleProjectChange}>
              <SelectTrigger id="clProject" className="h-9 w-56 text-sm">
                <SelectValue placeholder="Pick a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.jira_project_key} value={p.jira_project_key}>
                    {p.display_name} ({p.jira_project_key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin ? (
            <Button
              onClick={() => setCreateOpen((o) => !o)}
              disabled={!projectKey}
              aria-expanded={createOpen}
              variant={createOpen ? 'outline' : 'default'}
            >
              {createOpen ? 'Close' : '+ New directive'}
            </Button>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <Card className="mb-4 border-[color:var(--status-blocked)] p-3 text-sm text-[color:var(--status-blocked)]">
          Failed to load part of the matrix: {loadError}
        </Card>
      ) : null}

      {loading ? (
        <Card className="p-8 text-center text-sm text-[color:var(--f92-gray)]">Loading…</Card>
      ) : directives.length === 0 && !createOpen ? (
        <Card className="p-8 text-center text-sm text-[color:var(--f92-gray)]">
          No active directives for {projectLabel}.{' '}
          {isAdmin ? 'Create one to seed the matrix.' : 'An admin can create one.'}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0" style={{ boxShadow: 'var(--shadow-sm)' }}>
          {/* Matrix controls — pinned above the horizontal-scroll region so they
              never scroll out of view on a ≥16-brand project. All client-side
              over already-loaded data; nothing here refetches. Suppressed when
              the project has no directives (nothing to search/filter/sort) —
              that case only reaches here with the create strip open. */}
          {directives.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--f92-border)] p-3">
            <div className="relative min-w-[15rem] flex-1">
              <Label htmlFor="matrixSearch" className="sr-only">Search directives by title</Label>
              {/* type="text", not "search": webkit's native cancel button would
                  render on top of the explicit Clear button below. */}
              <Input
                id="matrixSearch"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search directives…"
                className="h-9 pr-14 text-sm"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs font-medium text-[color:var(--f92-gray)] hover:text-[color:var(--f92-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div>
              <Label htmlFor="matrixStatus" className="sr-only">Filter by resolve status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as MatrixStatusFilter)}
              >
                {/* "Status:" prefix in the trigger — a bare "Open" is ambiguous
                    on a page that also renders the open-findings "Needs action"
                    panel (Karen LOW-1). */}
                <SelectTrigger id="matrixStatus" className="h-9 w-44 text-sm">
                  <span className="shrink-0 text-[color:var(--f92-gray)]">Status:&nbsp;</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATRIX_STATUS_FILTERS.map((f) => (
                    <SelectItem key={f} value={f}>{MATRIX_STATUS_FILTER_LABEL[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="matrixSort" className="sr-only">Sort directives</Label>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as MatrixSortKey)}>
                <SelectTrigger id="matrixSort" className="h-9 w-52 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATRIX_SORT_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>{MATRIX_SORT_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Hides paused brand COLUMNS only. Default off = shown (today's
                behavior). Outstanding counts are unaffected — they read every
                cell regardless of which columns render (spec §3.1). Hidden
                entirely when the project has no paused brands. */}
            {pausedBrandCount > 0 ? (
              <label className="flex h-9 items-center gap-2 text-sm text-[color:var(--f92-dark)]">
                <input
                  type="checkbox"
                  checked={hidePaused}
                  onChange={(e) => setHidePaused(e.target.checked)}
                  className="h-4 w-4 rounded border-[color:var(--f92-border)] text-[color:var(--f92-orange)] focus:ring-[color:var(--f92-orange)]"
                />
                Hide paused brands ({pausedBrandCount})
              </label>
            ) : null}

            <span className="ml-auto text-xs font-medium text-[color:var(--f92-gray)]" aria-live="polite">
              {matrixRows.length === directives.length
                ? `${directives.length} directive${directives.length === 1 ? '' : 's'}`
                : `${matrixRows.length} of ${directives.length} directives`}
            </span>

            {/* Never let "I searched and found nothing" read as "it doesn't
                exist" — the status filter may be hiding the match, and creating
                a duplicate title is unguarded server-side (see
                countHiddenByStatus). Only shown when rows ARE listed; the
                zero-row case says the same thing in its empty state below. */}
            {hiddenByStatus > 0 && matrixRows.length > 0 ? (
              <p className="basis-full text-xs text-[color:var(--f92-gray)]">
                {hiddenByStatus === 1
                  ? '1 more directive matches but is hidden by the status filter.'
                  : `${hiddenByStatus} more directives match but are hidden by the status filter.`}{' '}
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="font-medium text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
                >
                  Show all statuses
                </button>
              </p>
            ) : null}
          </div>
          ) : null}

          {/* Inline create (admin) — a pinned strip at the top of the matrix
              Card, above the horizontal-scroll region so it never scrolls out
              of view. Replaces the old create modal; expands in place, no
              overlay. */}
          {isAdmin && createOpen ? (
            <InlineCreateForm
              projectKey={projectKey}
              projectLabel={projectLabel}
              onCreated={() => {
                setCreateOpen(false);
                // Clear the row filters so the directive that was just created
                // is GUARANTEED visible (Karen MEDIUM-2). Without this, an
                // admin who created while a search was active — the very flow
                // the search box invites — got a "✅ created" toast and no new
                // row, whose natural reading is "it failed, try again" → a
                // duplicate title. A new directive fans out to todo/n_a, so it
                // is always `active` and always shown under `open`.
                setSearch('');
                setStatusFilter('open');
                void loadProject(projectKey);
              }}
              onCancel={() => setCreateOpen(false)}
            />
          ) : null}

          {directives.length === 0 ? (
            <div className="p-8 text-center text-sm text-[color:var(--f92-gray)]">
              No active directives for {projectLabel} yet.{' '}
              {isAdmin ? 'Add one above.' : 'An admin can add one.'}
            </div>
          ) : matrixRows.length === 0 ? (
            /* Filters hid everything. Distinct from the "project has none"
               state above — the project HAS directives, this view just
               excluded them all. Keep both reachable. */
            <div className="p-8 text-center text-sm text-[color:var(--f92-gray)]">
              No directives match these filters.{' '}
              {hiddenByStatus > 0 ? (
                /* The dangerous case: the search DID match, the status filter
                   hid it. Say so and offer a reset that KEEPS the search, so
                   the admin sees the match instead of concluding it doesn't
                   exist and creating a duplicate (unguarded server-side). */
                <>
                  {hiddenByStatus === 1
                    ? '1 directive matches your search but is hidden by the status filter.'
                    : `${hiddenByStatus} directives match your search but are hidden by the status filter.`}{' '}
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className="font-medium text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
                  >
                    Show all statuses
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                  }}
                  className="font-medium text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
                >
                  Show all {directives.length}
                </button>
              )}
            </div>
          ) : (
            /* Horizontal scroll keeps ≥16-brand projects usable (spec §4). */
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--f92-border)]">
                    <th className="sticky left-0 z-10 bg-[color:var(--f92-surface)] px-4 py-3 text-left text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]" style={{ letterSpacing: 'var(--tracking-wide)' }}>
                      Directive
                    </th>
                    {visibleBrands.map((brand) => (
                      <th
                        key={brand.id}
                        className="px-3 py-3 text-center text-[10px] font-semibold uppercase"
                        style={{
                          letterSpacing: 'var(--tracking-wide)',
                          color: brand.is_paused ? 'var(--f92-lgray)' : 'var(--f92-gray)',
                        }}
                        title={brand.is_paused ? `${brand.display_name} (paused)` : brand.display_name}
                      >
                        {brand.brand_code}
                        {brand.is_paused ? <span className="ml-0.5 opacity-70">·</span> : null}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]" style={{ letterSpacing: 'var(--tracking-wide)' }}>
                      Outstanding
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map(({ directive, outstanding }) => {
                    // The one open cell-editor strip, if it belongs to this row.
                    // Looked up in visibleBrands, not brands, so hiding paused
                    // columns also closes an editor opened on one of them —
                    // an editor for an invisible column would be incoherent.
                    const editorBrand =
                      expandedCell?.directiveId === directive.id
                        ? visibleBrands.find((b) => b.id === expandedCell.brandId)
                        : undefined;
                    const editorCell = editorBrand
                      ? cellByKey.get(`${directive.id}:${editorBrand.id}`)
                      : undefined;
                    return (
                      <Fragment key={directive.id}>
                        <tr className="border-b border-[color:var(--f92-border)] last:border-0">
                          <td className="sticky left-0 z-10 bg-[color:var(--f92-surface)] px-4 py-3 align-top">
                            <div className="flex flex-col gap-1">
                              <span
                                className="inline-flex w-fit items-center px-2 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--f92-navy)]"
                                style={{
                                  letterSpacing: 'var(--tracking-wide)',
                                  background: 'var(--pill-filter-bg)',
                                  borderRadius: 'var(--radius-full)',
                                }}
                              >
                                {TYPE_LABEL[directive.directive_type]}
                              </span>
                              <span className="font-medium text-[color:var(--f92-dark)]">{directive.title}</span>
                              {directive.description ? (
                                <span className="max-w-xs text-xs text-[color:var(--f92-gray)]">{directive.description}</span>
                              ) : null}
                            </div>
                          </td>
                          {visibleBrands.map((brand) => {
                            const cell = cellByKey.get(`${directive.id}:${brand.id}`);
                            // A brand added AFTER this directive was created has
                            // no cell yet (Phase A has no backfill). Render it as
                            // the hollow n_a style — NOT a solid todo dot, which
                            // would falsely read as "owes this directive". It
                            // stays non-interactive (clickable needs a real cell)
                            // and out of the Outstanding count (computed from
                            // `cells` only).
                            const status = cell?.status ?? 'n_a';
                            const dotColor = STATUS_DOT[status];
                            const clickable = isAdmin && !!cell;
                            const isExpanded =
                              !!cell &&
                              expandedCell?.directiveId === directive.id &&
                              expandedCell?.brandId === brand.id;
                            return (
                              <td key={brand.id} className="px-3 py-3 text-center">
                                <button
                                  type="button"
                                  disabled={!clickable}
                                  aria-expanded={clickable ? isExpanded : undefined}
                                  onClick={() =>
                                    cell &&
                                    setExpandedCell((cur) =>
                                      cur && cur.directiveId === directive.id && cur.brandId === brand.id
                                        ? null
                                        : { directiveId: directive.id, brandId: brand.id },
                                    )
                                  }
                                  aria-label={`${directive.title} — ${brand.display_name}: ${STATUS_LABEL[status]}${clickable ? (isExpanded ? ' (editing — activate to close)' : ' (edit)') : ''}`}
                                  title={`${STATUS_LABEL[status]}${cell?.note ? ` — ${cell.note}` : ''}`}
                                  className={
                                    'mx-auto flex h-6 w-6 items-center justify-center rounded-full transition ' +
                                    (clickable
                                      ? 'cursor-pointer hover:ring-2 hover:ring-[color:var(--f92-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)] '
                                      : 'cursor-default ') +
                                    (isExpanded ? 'ring-2 ring-[color:var(--f92-orange)]' : '')
                                  }
                                >
                                  <span
                                    className="block h-3 w-3 rounded-full"
                                    style={
                                      status === 'n_a'
                                        ? { border: '1.5px dashed var(--f92-lgray)' }
                                        : { background: dotColor }
                                    }
                                  />
                                  {cell?.note ? <span className="sr-only">has note</span> : null}
                                </button>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right">
                            <span
                              className="inline-flex min-w-6 items-center justify-center px-2 py-0.5 text-xs font-semibold"
                              style={{
                                borderRadius: 'var(--radius-full)',
                                background: outstanding > 0 ? 'var(--pill-amber-bg)' : 'var(--pill-green-bg)',
                                border: `1px solid ${outstanding > 0 ? 'var(--pill-amber-border)' : 'var(--pill-green-border)'}`,
                                color: outstanding > 0 ? 'var(--pill-amber-fg)' : 'var(--pill-green-fg)',
                              }}
                            >
                              {outstanding}
                            </span>
                          </td>
                        </tr>

                        {/* Inline cell editor — a row-expansion strip spanning
                            the full table width under this directive (one open
                            at a time). This is the E3 seam: E3 enriches this
                            same container with comments / timeline / lifecycle
                            dates — extend it, don't rebuild. */}
                        {editorBrand && editorCell ? (
                          <tr className="border-b border-[color:var(--f92-border)] bg-[color:var(--f92-tint)]">
                            <td colSpan={visibleBrands.length + 2} className="p-0">
                              {/* sticky-left so the editor stays visible when a
                                  ≥16-brand row is scrolled horizontally. */}
                              <div className="sticky left-0 w-[min(48rem,100%)] p-2">
                                <CellEditStrip
                                  key={editorCell.id}
                                  brandLabel={editorBrand.display_name}
                                  directiveTitle={directive.title}
                                  initialStatus={editorCell.status}
                                  initialNote={editorCell.note}
                                  onSave={(s, n) => handleCellSave(editorCell, s, n)}
                                  onCancel={() => setExpandedCell(null)}
                                />
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Needs-action panel (spec §4). Hidden entirely when there are no open
          findings. View-for-all; dismiss/action controls render only for
          admins (the route enforces admin server-side regardless). */}
      {!loading && hasFindings ? (
        <section className="mt-8">
          <h2 className="mb-1 text-lg font-semibold text-[color:var(--f92-dark)]">Needs action</h2>
          <p className="mb-3 text-sm text-[color:var(--f92-gray)]">
            Open monitoring findings for {projectLabel}. Sorted by severity.
          </p>

          {assignedFindings.length > 0 ? (
            <div className="space-y-2">
              {assignedFindings.map((f) => (
                <FindingCard key={f.id} finding={f} isAdmin={isAdmin} onStatus={handleFindingStatus} />
              ))}
            </div>
          ) : null}

          {unassignedFindings.length > 0 ? (
            <div className="mt-5">
              <p
                className="mb-2 text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]"
                style={{ letterSpacing: 'var(--tracking-wide)' }}
              >
                Unassigned · no brand resolved
              </p>
              <div className="space-y-2">
                {unassignedFindings.map((f) => (
                  <FindingCard key={f.id} finding={f} isAdmin={isAdmin} onStatus={handleFindingStatus} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

    </div>
  );
}

// -------------------------------------------------------------------------
// Inline create-directive form (admin only). Renders as a pinned strip at the
// top of the matrix Card (no overlay). Mounted fresh each time it opens, so
// useState initializers reset the fields — no seeding effect. POST is unchanged
// from the retired modal; toast handling (fanOut / audit / cell count) kept.
// -------------------------------------------------------------------------
function InlineCreateForm({
  projectKey,
  projectLabel,
  onCreated,
  onCancel,
}: {
  projectKey: string;
  projectLabel: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [directiveType, setDirectiveType] = useState<DirectiveType>('goal');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && !!projectKey && !submitting;

  async function handleCreate() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/directives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_key: projectKey,
          title: title.trim(),
          directive_type: directiveType,
          description: description.trim() || undefined,
        }),
      });
      const result: { ok?: boolean; error?: string; auditError?: string; fanOutError?: string; cells_created?: number } =
        await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        toast(`❌ ${result.error ?? `Create failed (${res.status})`}`);
        return;
      }
      if (result.fanOutError) {
        toast(`⚠️ Directive created, but fan-out failed: ${result.fanOutError}`);
      } else if (result.auditError) {
        toast(`⚠️ Directive created (${result.cells_created ?? 0} cells), but audit write failed`);
      } else {
        toast(`✅ Directive created — ${result.cells_created ?? 0} brand cells`);
      }
      onCreated();
    } catch (err) {
      toast(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && !submitting) onCancel();
  }

  return (
    <div
      onKeyDown={handleKeyDown}
      aria-label={`New directive for ${projectLabel}`}
      className="border-b border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] p-4"
    >
      <p className="mb-3 text-xs text-[color:var(--f92-gray)]">
        Fans out one status cell per active brand in {projectLabel}. Paused brands start as N/A.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Label htmlFor="dirTitle" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
            Title
          </Label>
          <Input
            id="dirTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Add exit-intent modal"
            className="h-9 text-sm"
            autoFocus
          />
        </div>
        <div className="w-44">
          <Label htmlFor="dirType" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
            Type
          </Label>
          <Select value={directiveType} onValueChange={(v) => setDirectiveType(v as DirectiveType)}>
            <SelectTrigger id="dirType" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTIVE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[16rem] flex-1">
          <Label htmlFor="dirDesc" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
            Description (optional)
          </Label>
          <Input
            id="dirDesc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Context for the team"
            className="h-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {submitting ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// A single "Needs action" card (spec §4). severity dot + <brand> — <summary>
// + <source> · <convert_test_id> · <detected_at ago>. Admin-only Dismiss /
// Action controls; read-only users see the card without controls.
// -------------------------------------------------------------------------
function FindingCard({
  finding,
  isAdmin,
  onStatus,
}: {
  finding: FindingRow;
  isAdmin: boolean;
  onStatus: (findingId: string, status: AdminStatus) => void;
}) {
  const brandLabel = finding.brand?.display_name ?? 'Unassigned';
  const meta = [
    finding.source,
    finding.convert_test_id ? `test ${finding.convert_test_id}` : null,
    ISSUE_LABEL[finding.issue_type],
    timeAgo(finding.detected_at),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card className="flex items-start gap-3 p-3" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <span
        className="mt-1.5 block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: severityDot(finding.severity) }}
        title={finding.severity ?? 'unset severity'}
        aria-label={`Severity: ${finding.severity ?? 'unset'}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[color:var(--f92-dark)]">
          <span className="font-semibold">{brandLabel}</span>
          <span className="text-[color:var(--f92-gray)]"> — </span>
          {finding.summary}
        </p>
        <p className="mt-0.5 text-xs text-[color:var(--f92-gray)]">{meta}</p>
      </div>
      {isAdmin ? (
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => onStatus(finding.id, 'dismissed')}>
            Dismiss
          </Button>
          <Button size="sm" onClick={() => onStatus(finding.id, 'actioned')}>
            Action
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
