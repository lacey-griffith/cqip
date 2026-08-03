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
  buildCellAriaLabel,
  buildCellReadout,
  buildReadoutAnnouncement,
  hasNote,
} from '@/lib/client-library/cell-note';
import {
  buildMatrixRows,
  computeMatrixKpis,
  countByType,
  countHiddenByFilters,
  countHiddenOwedCells,
  hasActiveFilterGroup,
  visibleMatrixBrands,
  MATRIX_CELL_FILTERS,
  MATRIX_CELL_FILTER_LABEL,
  MATRIX_SORT_KEYS,
  MATRIX_SORT_LABEL,
  MATRIX_STATUS_FILTERS,
  MATRIX_STATUS_FILTER_LABEL,
  MATRIX_TYPE_FILTERS,
  MATRIX_TYPE_FILTER_LABEL,
  type MatrixCellFilter,
  type MatrixSortKey,
  type MatrixStatusFilter,
  type MatrixTypeFilter,
} from '@/lib/client-library/matrix-controls';
import { NoteIndicator, StatusCellBox, StatusLegend } from '@/components/client-library/status-cell';
import { TabGroup } from '@/components/client-library/tab-group';
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
import { fetchAllPaged } from '@/lib/client-library/paged-fetch';

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

// NOTE: the old STATUS_DOT map is gone — the cell visual moved to the shared
// components/client-library/status-cell.tsx so the matrix, the brand page, and
// the new legend cannot describe a status three different ways. It also stopped
// borrowing the quality-log --status-* palette: cells now use the dedicated
// --cell-* tokens (see globals.css).

// Batch 012 Phase B — severity dot colors (§13 r25, tokens only).
//
// REPOINTED onto the --severity-* family, which exists for exactly this and was
// not being used: this map previously read --status-blocked (a STATUS token used
// for SEVERITY) and --pill-amber-border (a "-border" token used as a FILL). Those
// were the two misnamed usages; the blocker was that --severity-* had no dark
// values, which commit cc95b7a added.
const SEVERITY_DOT: Record<FindingSeverity, string> = {
  critical: 'var(--severity-critical)',
  medium: 'var(--severity-medium)',
  low: 'var(--severity-low)',
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

  // ── Hover-inspect (batch 3, spec §2.3/§2.4) ────────────────────────────────
  //
  // `hover` is the transiently-inspected cell; `pinned` is one deliberately
  // stuck there by a click. PIN WINS — a pin that silently follows the mouse
  // isn't a pin. Clicking a different cell re-pins to it; clicking the pinned
  // cell unpins.
  //
  // `source` exists ONLY to keep the live region honest, and it is the whole
  // resolution of the §2.3-vs-§5 tension: §2.3 asks for a polite aria-live
  // readout, §5 requires the readout announce once per cell and not twice. On
  // FOCUS the cell button's own accessible name already speaks
  // "<directive> — <brand>: <status>", so a live region repeating it is exactly
  // the double announcement §5 forbids. So focus updates the readout VISUALLY
  // and stays silent; pointer and pin — neither of which moves focus, so
  // neither announces anything on its own — speak.
  const [hover, setHover] = useState<{
    directiveId: string;
    brandId: string;
    source: 'pointer' | 'focus';
  } | null>(null);
  const [pinned, setPinned] = useState<{ directiveId: string; brandId: string } | null>(null);

  // Matrix controls (search · status filter · sort · hide paused). All four are
  // client-side over data already loaded — no refetch on change. Session-only
  // React state by design (spec §6): no sessionStorage / localStorage / URL
  // params, so a reload resets them. These are transient find-and-scan controls,
  // unlike ProjectBrandFilter's persisted page scope.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MatrixStatusFilter>('open');
  // Groups 2 + 3 (Batch 012 restyle). Single-choice within each, AND across, AND
  // with the search. `all` is the default for both so the initial view is only
  // narrowed by the State group's `open`, exactly as before this batch.
  const [cellFilter, setCellFilter] = useState<MatrixCellFilter>('all');
  const [typeFilter, setTypeFilter] = useState<MatrixTypeFilter>('all');
  const [sortKey, setSortKey] = useState<MatrixSortKey>('title');
  // Defaults to CHECKED (2026-07-31): a paused brand's column is dead width on
  // a ≥16-brand matrix. Safe to hide by default ONLY because it is
  // count-neutral, which was RE-MEASURED against prod rather than inherited from
  // the 2026-07-29 batch (whose numbers are void — the project has since grown
  // 76 → 82 active directives): NBLYCRO's 3 paused active brands (SHG, MRR-CA,
  // WDG) hold 246 cells across active directives, ALL 246 `n_a`, zero owed. So
  // no Outstanding number on screen changes when the columns go away. SPLCRO has
  // no paused brands, so the toggle isn't rendered there at all.
  //
  // That measurement is a snapshot, and nothing in the app enforces it — so it is
  // ALSO checked at runtime now: countHiddenOwedCells drives a visible warning if
  // a paused brand ever holds owed work (Karen MEDIUM-4). Re-measure before
  // widening this, but the UI will no longer stay quiet if it drifts.
  //
  // NOT persisted (no sessionStorage, no channel) — a reload shows every column
  // again, same as the other three controls.
  const [hidePaused, setHidePaused] = useState(true);

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
      // PAGED — directives × brands exceeds PostgREST's 1,000-row cap, and an
      // unranged select returns the short result with NO error. Before this,
      // NBLYCRO's 1,216 cells came back as 1,000: 46 directives rendered some
      // cells hollow, under-counted Outstanding, and left those cells
      // non-editable. See lib/client-library/paged-fetch.ts.
      const ids = directiveRows.map((d) => d.id);
      const { data: cellData, error: cellErr } = await fetchAllPaged<CellRow>(
        'cells',
        (from, to) =>
          supabase
            .from('directive_brand_status')
            .select('id, directive_id, brand_id, status, note')
            .in('directive_id', ids)
            .range(from, to),
      );
      // Surface the error BEFORE using the rows: a partial read must never be
      // rendered as if complete — that is the bug this replaced.
      if (cellErr) failures.push(cellErr);
      cellRows = cellData;
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
    setPinned(null); // ditto — a pinned readout from another client is nonsense
    setHover(null);
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
        setPinned(null);
        setHover(null);
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
  const controls = useMemo(
    () => ({ search, statusFilter, cellFilter, typeFilter, sortKey }),
    [search, statusFilter, cellFilter, typeFilter, sortKey],
  );
  const matrixRows = useMemo(
    () => buildMatrixRows(directives, cells, controls),
    [directives, cells, controls],
  );

  // The rendered brand axis. Orthogonal to matrixRows above: this is the only
  // thing the hide-paused toggle touches.
  const visibleBrands = useMemo(
    () => visibleMatrixBrands(brands, hidePaused),
    [brands, hidePaused],
  );
  const pausedBrandCount = useMemo(() => brands.filter((b) => b.is_paused).length, [brands]);

  // ── The inspected cell, RESOLVED against what is actually on screen ────────
  //
  // Candidates are looked up in `matrixRows` and `visibleBrands` — the RENDERED
  // sets, not the raw data — so a cell that a filter, the hide-paused toggle or
  // a project switch has taken off screen can never leave a readout describing
  // a cell nobody can see. That invariant is why there is no cleanup handler on
  // every filter setter: it holds by construction rather than by remembering to
  // clear.
  const inspected = useMemo(() => {
    // Pin wins — but only if it still RESOLVES. Karen HIGH-1: an unconditional
    // `pinned ?? hover` meant a pin that a filter, the hide-paused toggle or a
    // search had taken off screen returned null and never consulted `hover`, so
    // the readout went dead on every visible cell with no explanation — and the
    // recovery was noticing an orphaned "Unpin" link next to an empty state.
    // That is a real flow: a read-only user pins a cell to read its note (the
    // only touch path), then searches for the next one.
    //
    // Resolving the CANDIDATES in order, rather than picking one and then
    // resolving it, keeps the "readout describes a visible cell" invariant
    // without letting an unresolvable pin disable the deliverable. The dangling
    // pin is left set deliberately: it re-takes precedence the moment its row
    // comes back, and the Unpin control stays available meanwhile.
    // `isPinnedCell` marks whether the thing we RESOLVED is the pin — not the
    // same as "a pin exists". That is the distinction the live region needs: a
    // pin that has fallen back to hover must not be announced as a pin.
    const resolve = (
      candidate: { directiveId: string; brandId: string } | null,
      isPinnedCell: boolean,
    ) => {
      if (!candidate) return null;
      const row = matrixRows.find((r) => r.directive.id === candidate.directiveId);
      const brand = visibleBrands.find((b) => b.id === candidate.brandId);
      if (!row || !brand) return null;
      const cell = cellByKey.get(`${row.directive.id}:${brand.id}`);
      return {
        directiveId: row.directive.id,
        brandId: brand.id,
        isPinnedCell,
        readout: buildCellReadout({
          brandLabel: brand.display_name,
          directiveTitle: row.directive.title,
          // Same effective-status resolution the grid uses: a brand added after
          // the directive has no cell row and renders n_a.
          status: cell?.status ?? 'n_a',
          note: cell?.note,
        }),
      };
    };
    return resolve(pinned, true) ?? resolve(hover, false);
  }, [pinned, hover, matrixRows, visibleBrands, cellByKey]);
  const readout = inspected?.readout ?? null;
  // The column to band (spec §2.4). The ROW bands in pure CSS (`group-hover` /
  // `group-focus-within` on the <tr>); a COLUMN cannot be expressed that way,
  // because CSS has no way to reach the nth cell of every OTHER row from a hover
  // on one of them — so this is the piece that needs state. NOTE that this does
  // NOT make hovering free: the readout is state-driven too, so a crossing in
  // either direction re-renders. See the perf note on the cell handlers.
  const hotBrandId = inspected?.brandId ?? null;
  const isHotCell = useCallback(
    (directiveId: string, brandId: string) =>
      inspected?.directiveId === directiveId && inspected?.brandId === brandId,
    [inspected],
  );

  // Pure — see buildReadoutAnnouncement for the §2.3-vs-§5 argument and for why
  // a PIN always speaks despite clicking a button also focusing it.
  //
  // `focusDriven` is asked of the HOVER state, and `pinned` of what actually
  // RESOLVED (isPinnedCell), not of whether a pin exists: a pin that has been
  // filtered off screen falls back to hover, and that fallback must not be
  // announced as though it were the pin.
  const readoutAnnouncement = useMemo(
    () =>
      buildReadoutAnnouncement(readout, {
        pinned: inspected?.isPinnedCell ?? false,
        focusDriven: hover?.source === 'focus',
      }),
    [readout, inspected, hover],
  );

  // Runtime check on the property that justified defaulting hide-paused to
  // CHECKED (Karen MEDIUM-4) — see countHiddenOwedCells for why a prod
  // measurement alone is not enough. Reads only already-loaded state, no query.
  const hiddenOwedCount = useMemo(
    () => countHiddenOwedCells(brands, cells, hidePaused),
    [brands, cells, hidePaused],
  );

  // Directives matching the search but excluded by the status filter. Surfaced
  // so "search found nothing" can never be read as "it doesn't exist" — see
  // countHiddenByFilters for why that false negative is dangerous here. With
  // three groups a hidden row can have three causes, so this is ONE honest total
  // and the reset clears ALL of them — no per-group attribution (a row can be
  // excluded by two groups at once, so any breakdown would double-count).
  const hiddenByFilters = useMemo(
    () => countHiddenByFilters(directives, cells, controls),
    [directives, cells, controls],
  );
  const filtersActive = hasActiveFilterGroup(controls);

  // KPI strip — every value derived from loaded data, never a literal. Reuses the
  // same classifier + outstandingCount the rows use, so the strip and the
  // per-row Outstanding pill cannot disagree.
  const kpi = useMemo(
    () => computeMatrixKpis(directives, cells, brands),
    [directives, cells, brands],
  );

  // Clears every filter group AND the search — what the hidden-count reset does.
  const clearAllFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setCellFilter('all');
    setTypeFilter('all');
  }, []);

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
  // A blank query matches everything (matchesSearch), so "did the user actually
  // search?" is a separate question from "are rows hidden?" — the hidden-match
  // correction is only meaningful once a search is active (Karen LOW-6).
  const searchActive = search.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase text-[color:var(--f92-gray)]" style={{ letterSpacing: 'var(--tracking-eyebrow)' }}>
            Pulse
          </p>
          <h1 className="text-2xl font-semibold text-[color:var(--f92-dark)]">Directive Matrix</h1>
          {/* The paused-brand exclusion is stated in the Brands KPI card's
              sub-label and NOWHERE ELSE. It used to live here too; saying it in
              both places is the kind of duplicated copy that drifts, and saying
              it in neither would drop a real caveat. Once, next to the number it
              qualifies. */}
          <p className="mt-1 text-sm text-[color:var(--f92-gray)]">
            Cross-brand experimentation directives × brand status.
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
        <>
        {/* ---------------------------------------------------------------
            KPI strip. NEW render surface, read-only, EVERY value derived from
            already-loaded data — no literal renders, because prod moved 76 -> 82
            directives inside one batch. Reuses computeMatrixKpis, which reuses
            the same classifier + outstandingCount as the rows, so the strip and
            the per-row Outstanding pill cannot disagree.

            "Largest gap" from the mockup is OMITTED rather than rendered inert:
            it is a per-FAMILY number, and family grouping does not exist (no
            such column; the mockup invents nine families client-side). A card
            that permanently reads "needs family grouping" is chrome that teaches
            the reader nothing, so the strip ships with the six cards that carry
            real data. Batch 3/4 can add it when the grouping exists.
            --------------------------------------------------------------- */}
        {directives.length > 0 ? (
          <div
            className="mb-4 flex flex-wrap items-stretch overflow-hidden border border-[color:var(--f92-border)]"
            style={{ borderRadius: 'var(--radius-xl)', background: 'var(--f92-surface)', boxShadow: 'var(--shadow-sm)' }}
          >
            {/* Coverage leads, with the teal long-range treatment already used
                by the Coverage KPI strip (--kpi-longrange-*). */}
            <div
              className="min-w-[10.5rem] flex-1 border-r border-[color:var(--f92-border)] px-5 py-4"
              style={{ background: 'var(--kpi-longrange-bg)' }}
            >
              <div
                className="mb-1.5 text-[10px] font-semibold uppercase"
                style={{ letterSpacing: 'var(--tracking-wide)', color: 'var(--kpi-longrange-border)' }}
              >
                Directive coverage
              </div>
              <div
                className="text-2xl font-bold leading-none tabular-nums"
                style={{ color: 'var(--kpi-longrange-fg)' }}
              >
                {kpi.coveragePct}%
              </div>
              <div className="mt-1.5 text-[10px]" style={{ color: 'var(--kpi-longrange-fg)' }}>
                {kpi.resolved} of {kpi.total} resolved
              </div>
            </div>

            <KpiCard label="Directives" value={kpi.total}>
              {kpi.openDirectives} with outstanding cells
            </KpiCard>
            <KpiCard label="Outstanding cells" value={kpi.outstandingCells} hue="var(--cell-blocked)">
              across {kpi.openDirectives} directive{kpi.openDirectives === 1 ? '' : 's'}
            </KpiCard>
            <KpiCard label="In progress" value={kpi.inProgressCells} hue="var(--cell-progress)">
              {kpi.blockedCells} blocked
            </KpiCard>
            {/* LABELLED "Resolved", not "Fully rolled out" (Karen HIGH-1). This
                value IS `resolveStateFrom(...) === 'resolved'` — the exact
                population the State tab labels Resolved. Two names for one
                concept is the confusion the locked vocabulary exists to prevent,
                and "rolled out" is dead vocabulary besides. */}
            <KpiCard label="Resolved" value={kpi.resolved} hue="var(--cell-done)">
              no cells owing, ≥1 done
            </KpiCard>
            {/* The paused-brand caveat is stated HERE and nowhere else — the page
                subtitle no longer repeats it. Said once, not twice, not zero times.

                The wording is "columns hidden by default", NOT "excluded from
                Outstanding" (Karen MEDIUM-1). The latter was inherited from the old
                subtitle and is FALSE: computeMatrixKpis counts every cell of the
                loaded directives, and buildMatrixRows is required to see the FULL
                cell set — paused included — which is the structural guarantee
                behind hiding columns not changing counts. Paused cells merely start
                as n_a at fan-out, so they usually owe nothing; they CAN owe, which
                is exactly why countHiddenOwedCells and its amber warning exist. The
                old wording would have contradicted that warning on the same screen,
                and the KPI card would have been the false one. */}
            <KpiCard label="Brands" value={`${kpi.brandsActive}/${kpi.brandsTotal}`} last>
              {kpi.brandsPaused > 0
                ? `${kpi.brandsPaused} paused — columns hidden by default`
                : 'none paused'}
            </KpiCard>
          </div>
        ) : null}

        <Card className="overflow-hidden p-0" style={{ boxShadow: 'var(--shadow-sm)' }}>
          {/* Matrix controls — pinned above the horizontal-scroll region so they
              never scroll out of view on a >=16-brand project. All client-side
              over already-loaded data; nothing here refetches. Suppressed when
              the project has no directives (nothing to search/filter/sort) —
              that case only reaches here with the create strip open. */}
          {directives.length > 0 ? (
          <div className="border-b border-[color:var(--f92-border)] p-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[13rem] flex-1 max-w-xs">
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs font-medium text-[color:var(--f92-gray)] hover:text-[color:var(--f92-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                    aria-label="Clear search"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              {/* THREE INDEPENDENT GROUPS — single-choice within each, AND across,
                  AND with the search.

                  Group 1 STATE is the DERIVED classifier across all brands of a
                  directive. Group 2 STATUS is one CELL's own status. They are
                  different concepts and both exist; group 2 is NOT a rename of
                  group 1, and "rolled out" is not vocabulary here. */}
              <TabGroup
                legend="State"
                options={MATRIX_STATUS_FILTERS}
                labels={MATRIX_STATUS_FILTER_LABEL}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
              />
              <TabGroup
                legend="Status"
                options={MATRIX_CELL_FILTERS}
                labels={MATRIX_CELL_FILTER_LABEL}
                value={cellFilter}
                onChange={(v) => setCellFilter(v)}
              />
              {/* Type reads the REAL directive_type column. All four always render.
                  (Karen LOW-4: "prod holds only goal + trigger" was wrong — verified
                  2026-08-02, NBLYCRO is goal 75 / trigger 7 but SPLCRO already has 1
                  site_area, so a tab empty on one project is populated on another.
                  That strengthens the case for all four rather than weakening it.)
                  An empty tab must read as empty, not broken. */}
              <TabGroup
                legend="Type"
                options={MATRIX_TYPE_FILTERS}
                labels={MATRIX_TYPE_FILTER_LABEL}
                value={typeFilter}
                onChange={(v) => setTypeFilter(v)}
              />

              <div>
                <Label htmlFor="matrixSort" className="sr-only">Sort directives</Label>
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as MatrixSortKey)}>
                  <SelectTrigger id="matrixSort" className="h-9 w-48 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATRIX_SORT_KEYS.map((k) => (
                      <SelectItem key={k} value={k}>{MATRIX_SORT_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Hides paused brand COLUMNS only. Default ON as of 2026-07-31
                  (see the hidePaused state above for the prod evidence that this
                  is count-neutral). Outstanding counts are unaffected either way —
                  they read every cell regardless of which columns render.
                  Because this is the DEFAULT, the accepted LOW-3 behavior — the
                  editor lookup goes through visibleBrands, so a paused brand's
                  cells can't be opened, and toggling discards an unsaved note in
                  one — is reached without the user opting in. Karen verified no
                  lock-up and endorsed keeping it; unchecking restores access. */}
              {pausedBrandCount > 0 ? (
                <label className="flex h-9 items-center gap-2 text-xs font-medium text-[color:var(--f92-dark)]">
                  <input
                    type="checkbox"
                    checked={hidePaused}
                    onChange={(e) => setHidePaused(e.target.checked)}
                    className="h-4 w-4 rounded border-[color:var(--f92-border)] text-[color:var(--f92-orange)] focus:ring-[color:var(--f92-focus-ring)]"
                  />
                  Hide paused ({pausedBrandCount})
                </label>
              ) : null}

              {/* The precondition behind the checked-by-default state, checked at
                  RUNTIME instead of trusted (countHiddenOwedCells). If a paused
                  brand ever holds owed work, an Outstanding pill would count it
                  while no owed cell is visible in the row — so say so, and offer
                  the one click that reveals it. Renders only when the invariant is
                  actually violated, so it is silent in normal operation.
                  PRESERVED from 3363629: this guard exists because nothing at the
                  route level enforces paused-cell count-neutrality. */}
              {hiddenOwedCount > 0 ? (
                <span
                  className="flex h-9 items-center gap-2 text-xs font-medium"
                  style={{ color: 'var(--pill-amber-fg)' }}
                >
                  ⚠ {hiddenOwedCount} outstanding{' '}
                  {hiddenOwedCount === 1 ? 'cell' : 'cells'} on paused{' '}
                  {hiddenOwedCount === 1 ? 'brand is' : 'brands are'} hidden but still counted.
                  <button
                    type="button"
                    onClick={() => setHidePaused(false)}
                    className="font-semibold text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                  >
                    Show paused
                  </button>
                </span>
              ) : null}

              {/* ONE polite live region holding the count AND the hidden-row
                  correction. They must share a region (Karen LOW-7): with the
                  count announced alone, a screen-reader user who searched a
                  resolved title heard "0 of 82 directives" — which AFFIRMS the
                  false "it doesn't exist" inference this signal exists to
                  correct.

                  The count says "N of M directives" and never implies the tabs
                  partition the rows — they deliberately overlap, so a mixed row
                  matches several Status tabs and the tab counts do not sum. */}
              <div
                className="ml-auto flex flex-wrap items-center justify-end gap-x-2 text-xs font-medium text-[color:var(--f92-gray)]"
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="tabular-nums">
                  {matrixRows.length === directives.length
                    ? `${directives.length} directive${directives.length === 1 ? '' : 's'}`
                    : `${matrixRows.length} of ${directives.length} directives`}
                </span>

                {/* Never let "I searched and found nothing" read as "it doesn't
                    exist" — a filter may be hiding the match, and a duplicate
                    title is STILL unguarded server-side (POST /api/admin/directives
                    has no duplicate check and there is no unique constraint), so
                    the failure this prevents is live.
                    Gated on a NON-EMPTY search (Karen LOW-6): matchesSearch()
                    matches everything on a blank query, so without this gate the
                    line would render on every page load, claiming a match when
                    nothing was searched.
                    With THREE groups the count has three possible causes, so it
                    is deliberately ONE total and the reset clears ALL groups —
                    and says so. No per-group attribution: a row can be excluded
                    by two groups at once, so any breakdown would double-count. */}
                {searchActive && hiddenByFilters > 0 ? (
                  <span className="font-normal">
                    ·{' '}
                    {hiddenByFilters === 1
                      ? '1 directive matches your search but is hidden by the filters.'
                      : `${hiddenByFilters} directives match your search but are hidden by the filters.`}{' '}
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="font-medium text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                    >
                      Clear all filters
                    </button>
                  </span>
                ) : null}
              </div>
            </div>

            {/* Legend — renders from CELL_STATUSES via the same component the
                cells use, so it cannot drift from what the grid draws. The note
                entry is real as of batch 3 (§2.5). */}
            <div className="mt-3 border-t border-[color:var(--f92-border)] pt-2.5">
              <StatusLegend />
            </div>

            {/* ── Readout bar (spec §2.3) ────────────────────────────────────
                PERSISTENT in the DOM and fixed-height, for two separate
                reasons: an aria-live region that gets mounted at the moment its
                content appears is unreliable (many AT/browser pairs only watch
                regions that existed beforehand), and a bar that appears on
                first hover would shove the whole matrix down by its own height
                exactly when the pointer is over it.

                Driven by hover AND focus identically (§2.3). It also shows the
                PINNED cell, which is what a read-only user gets on touch, where
                hover does not exist.

                aria-live lives here; its text is deliberately empty for
                focus-driven changes — see readoutAnnouncement. The visible
                content is aria-hidden so the region never speaks the same cell
                twice (§5). */}
            <div
              className="mt-2.5 flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 border-t border-[color:var(--f92-border)] pt-2.5 text-xs"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="sr-only">{readoutAnnouncement}</span>
              {readout ? (
                <span aria-hidden="true" className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold uppercase text-[color:var(--f92-navy)]" style={{ letterSpacing: 'var(--tracking-label)' }}>
                    {readout.brandLabel}
                  </span>
                  <span className="text-[color:var(--f92-lgray)]">×</span>
                  <span className="font-medium text-[color:var(--f92-dark)]">{readout.directiveTitle}</span>
                  <span className="text-[color:var(--f92-lgray)]">→</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--f92-dark)]">
                    <StatusCellBox status={readout.status} size={13} emphasis />
                    {readout.statusLabel}
                  </span>
                  {/* NEVER an empty region — an absent note says so out loud.
                      A blank gap after the arrow reads as a rendering fault, and
                      "does this cell have a note?" is the question the bar
                      exists to answer. */}
                  <span className="text-[color:var(--f92-gray)]">
                    ·{' '}
                    {readout.note ? (
                      <>
                        <span className="font-medium text-[color:var(--f92-dark)]">Note:</span>{' '}
                        {readout.note}
                      </>
                    ) : (
                      <span className="italic">No note</span>
                    )}
                  </span>
                  {pinned ? (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--pill-filter-fg)]"
                      style={{ letterSpacing: 'var(--tracking-label)', background: 'var(--pill-filter-bg)', borderRadius: 'var(--radius-full)' }}
                    >
                      Pinned
                    </span>
                  ) : null}
                </span>
              ) : (
                <span aria-hidden="true" className="text-[color:var(--f92-lgray)]">
                  {/* Interaction-NEUTRAL wording (Karen MEDIUM-3). "Hover or
                      focus" named two interactions a touch device does not have,
                      on the one surface whose whole justification is that tapping
                      to pin is the only note path when there is no hover. */}
                  Hover, focus, or select a cell to inspect it.
                </span>
              )}
              {pinned ? (
                /* aria-hidden (Karen LOW-6): this button sits INSIDE the
                   aria-atomic live region, so without it every pin announcement
                   ended "… Unpin button", and the control appearing/disappearing
                   was itself a content change in the region. The pin is already
                   undoable from the cell (activating it again unpins, and the
                   accessible name says so), so nothing is lost for AT users. */
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setPinned(null)}
                  className="font-medium text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                >
                  Unpin
                </button>
              ) : null}
            </div>
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
            /* Filters hid everything. Distinct from the "project has none" state
               above — the project HAS directives, this view just excluded them
               all. Keep both reachable, or a filtered-out view reads as a
               data-loading bug on a project with 82 directives.

               THREE shapes, most specific first. An unused TYPE gets its own copy
               because "no site area directives yet" is a fact about the data,
               while the generic no-match copy reads as a bug on a type Lacey
               simply has not started using. */
            <div className="p-8 text-center text-sm text-[color:var(--f92-gray)]">
              {typeFilter !== 'all' && countByType(directives, typeFilter) === 0 ? (
                <>
                  No {MATRIX_TYPE_FILTER_LABEL[typeFilter].toLowerCase()} directives yet for{' '}
                  {projectLabel}.{' '}
                  <button
                    type="button"
                    onClick={() => setTypeFilter('all')}
                    className="font-medium text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                  >
                    Show all types
                  </button>
                </>
              ) : searchActive && hiddenByFilters > 0 ? (
                /* The dangerous case — the search DID match, a filter hid it. The
                   count + correction + "Clear all filters" live in the controls
                   bar's persistent live region just above, so they are announced
                   reliably; don't duplicate the button here (Karen LOW-7). */
                <>
                  No directives match these filters.{' '}
                  <span className="italic">See the note above the table.</span>
                </>
              ) : filtersActive ? (
                /* No search, but the filters emptied the view. Search-neutral
                   copy — nothing was searched, so don't claim a "match" — and ONE
                   total with an all-clearing reset, because with three groups the
                   cause is ambiguous and per-group attribution would double-count
                   a row excluded by two groups at once. */
                <>
                  {hiddenByFilters === 1
                    ? '1 directive is hidden by the current filters.'
                    : `${hiddenByFilters} directives are hidden by the current filters.`}{' '}
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="font-medium text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                  >
                    Clear all filters
                  </button>
                </>
              ) : (
                <>
                  No directives match “{search.trim()}”.{' '}
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="font-medium text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                  >
                    Clear all filters
                  </button>
                </>
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
                        // §2.4 — the brand header bands with its column, so the
                        // band reads as "this column" rather than as a stripe
                        // floating in the middle of the grid.
                        className={
                          'px-3 py-3 text-center text-[10px] font-semibold uppercase transition-colors ' +
                          (hotBrandId === brand.id ? 'bg-[color:var(--f92-tint)]' : '')
                        }
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
                        {/* `group` drives the ROW band (spec §2.4) in pure CSS:
                            group-hover for the mouse, group-focus-within for the
                            keyboard, so the two paths are identical and the BAND
                            itself needs no state. That is simplicity, NOT free
                            hovering — the readout is state-driven, so a crossing
                            in either direction still re-renders. See the perf
                            note on the cell handlers for the real cost. */}
                        <tr className="group border-b border-[color:var(--f92-border)] last:border-0">
                          {/* The sticky column MUST band too. It carries an
                              opaque --f92-surface background (without which rows
                              would show through it while scrolled), so a row
                              band that skipped it would leave a white notch at
                              the start of every highlighted row and read as
                              broken.
                              WHY the band wins: SPECIFICITY, not source order.
                              `.group-hover\:bg-…:is(:where(.group):hover *)` is
                              (0,2,0) — the leading class, plus :is() taking its
                              most specific argument, where :where() contributes
                              zero and :hover one class — against (0,1,0) for the
                              base `bg-*`. Tailwind also happens to emit it later,
                              but order is a compiler detail and specificity is
                              not. Verified in the compiled CSS, not assumed. */}
                          <td className="sticky left-0 z-10 bg-[color:var(--f92-surface)] px-4 py-3 align-top transition-colors group-hover:bg-[color:var(--f92-tint)] group-focus-within:bg-[color:var(--f92-tint)]">
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
                            // EDITING needs a real cell and admin. INSPECTING
                            // needs neither — that split is the whole of §2.6.
                            const canEdit = isAdmin && !!cell;
                            const isExpanded =
                              !!cell &&
                              expandedCell?.directiveId === directive.id &&
                              expandedCell?.brandId === brand.id;
                            const isPinned =
                              pinned?.directiveId === directive.id && pinned?.brandId === brand.id;
                            const cellHasNote = hasNote(cell?.note);
                            return (
                              <td
                                key={brand.id}
                                className={
                                  'px-2.5 py-2.5 text-center transition-colors group-hover:bg-[color:var(--f92-tint)] group-focus-within:bg-[color:var(--f92-tint)] ' +
                                  (hotBrandId === brand.id ? 'bg-[color:var(--f92-tint)]' : '')
                                }
                              >
                                <button
                                  type="button"
                                  // NOT `disabled` — never again. `disabled`
                                  // removes the element from the tab order AND
                                  // suppresses its mouse events in most
                                  // browsers, so it killed hover, focus and the
                                  // tooltip for read-only users: precisely the
                                  // people the readout exists for, and the only
                                  // ones with no other way to reach a note. It
                                  // also brings the matrix in line with the
                                  // standing "never a disabled control" rule the
                                  // brand page has always honoured and this page
                                  // never did.
                                  //
                                  // AND NOT `aria-disabled` EITHER (Karen
                                  // MEDIUM-2, DC's call 2026-08-03 — the spec's
                                  // §2.6 asks for it, and the spec is wrong
                                  // here). ARIA defines aria-disabled as
                                  // "perceivable but disabled … not editable or
                                  // otherwise operable". This control IS
                                  // operable: the click pins/unpins the readout.
                                  // Announcing "unavailable" on a button that
                                  // works is incoherent on its own, and it
                                  // directly contradicted this cell's own
                                  // accessible name, which ends "(activate to
                                  // pin)" — so AT spoke "unavailable … activate
                                  // to pin". Worse, NVDA and JAWS can be
                                  // configured to skip unavailable controls,
                                  // which would have degraded exactly the
                                  // population §2.6 exists to serve.
                                  //
                                  // The role difference is carried in the
                                  // ACCESSIBLE NAME instead — "(edit)" vs
                                  // "(activate to pin)" — which states what the
                                  // control does rather than falsely denying it
                                  // does anything.
                                  aria-expanded={canEdit ? isExpanded : undefined}
                                  // Editors edit. Everyone else pins/unpins the
                                  // readout — which gives the control an honest
                                  // job instead of being a button that does
                                  // nothing, and is the ONLY note path that
                                  // works on touch, where there is no hover at
                                  // all. Admins on a cell-less cell land here
                                  // too: there is no row to PATCH, so pinning is
                                  // the only truthful behaviour.
                                  onClick={() => {
                                    if (canEdit && cell) {
                                      setExpandedCell((cur) =>
                                        cur && cur.directiveId === directive.id && cur.brandId === brand.id
                                          ? null
                                          : { directiveId: directive.id, brandId: brand.id },
                                      );
                                      return;
                                    }
                                    setPinned((cur) =>
                                      cur && cur.directiveId === directive.id && cur.brandId === brand.id
                                        ? null
                                        : { directiveId: directive.id, brandId: brand.id },
                                    );
                                  }}
                                  // PERF (spec §3, and it is a real constraint).
                                  // The naive version is `onMouseMove`, which
                                  // fires at pointer rate — ~60Hz — and would
                                  // reconcile the grid on every event. What
                                  // actually keeps this cheap is ONE thing:
                                  //
                                  //   `onMouseEnter`, not `onMouseMove`. State
                                  //   changes only when the pointer CROSSES a
                                  //   cell boundary, so the rate is bounded by
                                  //   how fast a hand moves across cells (a
                                  //   handful per second) rather than by the
                                  //   event loop.
                                  //
                                  // COST, stated plainly and WITHOUT the
                                  // flattering version of this claim: EVERY
                                  // crossing re-renders the matrix subtree —
                                  // vertical as well as horizontal. An earlier
                                  // draft of this comment said the pure-CSS row
                                  // band made vertical movement "cost zero
                                  // renders". That was FALSE: the band needs no
                                  // state, but the READOUT does, and it is fed
                                  // by the same `hover` — whose directiveId
                                  // changes on a vertical crossing. The CSS band
                                  // buys simplicity (no isHotRow prop threaded
                                  // through the row), not renders.
                                  //
                                  // THE NUMBER, DERIVED — because it is what
                                  // decides whether the memo follow-on is
                                  // needed, and an earlier draft's "~650
                                  // typically" was a STALE figure, not an
                                  // estimate. Rendered cells are exactly
                                  //   matrixRows.length × visibleBrands.length
                                  // (the two `.map`s below). 650 = 50 × 13, and
                                  // 50 was the open-filtered row count recorded
                                  // when prod held 69 directives; prod is now
                                  // 82, so that product describes a tree that
                                  // no longer exists. Same shelf-life problem
                                  // the 2026-07-31 batch hit at 45 minutes.
                                  //
                                  // What IS derivable today:
                                  //   82 × 13 = 1,066  defaults (hide-paused ON
                                  //                     → 16 active − 3 paused),
                                  //                     before the status filter
                                  //                     removes any row
                                  //   82 × 16 = 1,312  paused columns shown
                                  // The `open` default only ever subtracts rows,
                                  // so 1,066 is the ceiling under defaults and
                                  // the typical figure sits below it by however
                                  // many directives are fully resolved — a count
                                  // nobody has measured at 82 directives. Probe
                                  // it before sizing the follow-on; do not scale
                                  // the old 50/69 ratio, which is how the stale
                                  // number got here.
                                  //
                                  // So judge the follow-on against ~1,066, not
                                  // 650. Each cell is a button plus one styled
                                  // span, so it is still a cheap reconcile a few
                                  // times a second rather than sixty — which is
                                  // why this is acceptable, rather than because
                                  // half the crossings were free.
                                  //
                                  // If it ever janks, the next step is a
                                  // memoized row keyed on `hotBrandId`. That
                                  // WOULD make vertical crossings nearly free
                                  // (the band is CSS, so no row-level prop
                                  // changes and every row bails out; only the
                                  // readout re-renders) — which is precisely why
                                  // the CSS band is still the right call. NOT
                                  // done here: extracting the row would put the
                                  // sticky editor strip and the E3 seam in the
                                  // blast radius of a render-only batch.
                                  onMouseEnter={() =>
                                    setHover({ directiveId: directive.id, brandId: brand.id, source: 'pointer' })
                                  }
                                  onMouseLeave={() => setHover(null)}
                                  onFocus={() =>
                                    setHover({ directiveId: directive.id, brandId: brand.id, source: 'focus' })
                                  }
                                  onBlur={() => setHover(null)}
                                  // The accessible name carries the NOTE now,
                                  // and it is built by a TESTED pure function
                                  // rather than inlined here (Karen MEDIUM-5).
                                  // Why that matters: the old
                                  // `sr-only "has note"` span in this button was
                                  // dead — aria-label wins at AccName step 2C
                                  // and name-from-content never runs at 2F — so
                                  // screen-reader users never heard it by ANY
                                  // mechanism, and the batch-2 comment claiming
                                  // the information "isn't lost meanwhile" was
                                  // false. This string is now the only announced
                                  // path to a note on focus and in browse mode
                                  // (where a virtual cursor never fires onFocus,
                                  // so the live region never speaks at all), and
                                  // 8 lines of inline concatenation in a
                                  // 200-line JSX block is how the last one
                                  // rotted unnoticed.
                                  aria-label={buildCellAriaLabel(
                                    buildCellReadout({
                                      brandLabel: brand.display_name,
                                      directiveTitle: directive.title,
                                      status,
                                      note: cell?.note,
                                    }),
                                    { canEdit, isExpanded, isPinned },
                                  )}
                                  // §2.8 — the native `title` is GONE, not
                                  // merely stripped of its note. Keeping a
                                  // status-only tooltip would leave a second
                                  // hover surface for information the readout
                                  // bar already shows, with a different delay
                                  // and a different position; the status lives
                                  // in the accessible name above.
                                  //
                                  // The DOT (a rounded square) is still the edit
                                  // target — settled 5870dae, unchanged. The
                                  // 24x24 wrapper is both hit area (WCAG 2.5.8)
                                  // and ring carrier; the box stays 19px so grid
                                  // rhythm matches the mockup. `relative` is new
                                  // — it anchors the note marker, and costs no
                                  // layout.
                                  className={
                                    'relative mx-auto flex h-6 w-6 items-center justify-center transition ' +
                                    'hover:ring-2 hover:ring-[color:var(--f92-focus-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)] ' +
                                    // cursor-pointer for BOTH roles (Karen
                                    // MEDIUM-3): the non-admin click really does
                                    // something — it pins the readout — so
                                    // cursor-default was the same lie as
                                    // aria-disabled, in the mouse channel.
                                    'cursor-pointer ' +
                                    (isExpanded || isPinned ? 'ring-2 ring-[color:var(--f92-focus-ring)]' : '')
                                  }
                                  style={{ borderRadius: 'var(--radius-md)' }}
                                >
                                  {/* Shared visual — the legend draws the same
                                      component, so the two cannot disagree. */}
                                  <StatusCellBox
                                    status={status}
                                    size={19}
                                    emphasis={isExpanded || isPinned || isHotCell(directive.id, brand.id)}
                                  />
                                  {/* §2.2 — the rendered marker. This is what
                                      makes a note findable by SCANNING; the
                                      readout is only how you read one once
                                      found. `hasNote` from the shared module, so
                                      an all-whitespace note draws nothing here
                                      and the brand page agrees by contract. */}
                                  {cellHasNote ? <NoteIndicator /> : null}
                                </button>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right transition-colors group-hover:bg-[color:var(--f92-tint)] group-focus-within:bg-[color:var(--f92-tint)]">
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
        </>
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
// One KPI card. Presentational only — every value is computed by
// computeMatrixKpis and passed in, so no card can derive a number of its own.
// -------------------------------------------------------------------------
function KpiCard({
  label,
  value,
  hue,
  last = false,
  children,
}: {
  label: string;
  value: number | string;
  hue?: string;
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={
        'min-w-[8.5rem] flex-1 px-5 py-4 ' +
        (last ? '' : 'border-r border-[color:var(--f92-border)]')
      }
    >
      <div
        className="mb-1.5 text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]"
        style={{ letterSpacing: 'var(--tracking-wide)' }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-bold leading-none tabular-nums"
        style={{ color: hue ?? 'var(--f92-dark)' }}
      >
        {value}
      </div>
      {children ? (
        <div className="mt-1.5 text-[10px] text-[color:var(--f92-gray)]">{children}</div>
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
