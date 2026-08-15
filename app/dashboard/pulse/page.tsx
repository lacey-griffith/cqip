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
import { DirectiveEditStrip } from '@/components/client-library/directive-edit-strip';
import {
  CELL_STATUSES,
  CELL_STATUS_LABEL,
  DIRECTIVE_TYPES,
  type CellStatus,
  type DirectiveStatus,
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
  buildResultCountLabel,
  computeMatrixKpis,
  countArchivedMatchingSearch,
  countByType,
  countHiddenByFilters,
  countHiddenOwedCells,
  hasActiveFilterGroup,
  hasClearableFilters,
  toggleCellStatus,
  visibleMatrixBrands,
  MATRIX_SORT_KEYS,
  MATRIX_SORT_LABEL,
  MATRIX_STATUS_FILTERS,
  MATRIX_STATUS_FILTER_LABEL,
  MATRIX_TYPE_FILTERS,
  MATRIX_TYPE_FILTER_LABEL,
  type MatrixCellSelection,
  type MatrixSortKey,
  type MatrixStatusFilter,
  type MatrixTypeFilter,
} from '@/lib/client-library/matrix-controls';
import { cellBandClass, headerBandClass } from '@/lib/client-library/matrix-band';
import { NoteIndicator, StatusCellBox, StatusLegend } from '@/components/client-library/status-cell';
import { MultiTabGroup, TabGroup } from '@/components/client-library/tab-group';
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
  // Redundant with the query's own scope today (loadProject filters by it), but
  // the row editor edits this field, so it must come from the ROW rather than
  // from the page's current picker value — otherwise a move would submit the
  // project the user is looking at instead of the one the directive is in.
  project_key: string;
  title: string;
  directive_type: DirectiveType;
  description: string | null;
  // Narrowed from `string` by directive CRUD. MatrixDirectiveLike now declares
  // `status: DirectiveStatus`, and a plain `string` does not satisfy it — so this
  // narrowing is what makes computeMatrixKpis' archived filter reachable at all.
  status: DirectiveStatus;
  created_at: string;
}

interface CellRow {
  id: string;
  directive_id: string;
  brand_id: string;
  status: CellStatus;
  note: string | null;
  // Required by isDirectiveMovable, whose parameter declares it NON-optional
  // precisely so that omitting it here is a compile error rather than a silent
  // "every directive is movable". Written by the cell PATCH route and by scripts;
  // left NULL by fanOutCells, which is what makes NULL mean "untouched since
  // creation". MUST stay in loadProject's select.
  updated_by: string | null;
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

// The sticky header's bottom rule (Part B). A box-shadow rather than a border,
// because under `border-collapse: collapse` the collapsed border belongs to the
// table's border model rather than to the cell, so it does not reliably travel
// with a sticky cell while rows scroll under it. Declared once so the three
// header cells cannot end up with three slightly different rules.
const HEADER_RULE = 'inset 0 -1px 0 var(--f92-border)';

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
  // ARCHIVED directives, in their OWN slot and deliberately never merged into
  // `directives` (spec §A7). They exist only to answer "does the title you just
  // searched for exist, archived?" — the question an archived directive
  // otherwise answers with a silent "no", because loadProject reads
  // status='active' only.
  //
  // THE ISOLATION IS THE LOAD-BEARING PART. `directives` is the denominator of
  // the result count and is fed to computeMatrixKpis, buildMatrixRows and
  // countHiddenByFilters; folding archived rows in would inflate every KPI on
  // the page and add rows nobody can act on. Only `title` is kept, so there is
  // nothing here that a render path could accidentally use as a matrix row.
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
  // The one open DIRECTIVE editor. Mutually exclusive with expandedCell below:
  // two open editors in one row would compete for the same expansion slot, and
  // the row would have two Save buttons meaning different things.
  const [editingDirectiveId, setEditingDirectiveId] = useState<string | null>(null);
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
  // Groups 2 + 3. AND across the groups, AND with the search. Both default to
  // "all" so the initial view is only narrowed by the State group's `open`.
  //
  // Group 2 (STATUS) is MULTI-select as of the filter-reorg batch, and its "all"
  // is the EMPTY selection rather than a sixth member — see MatrixCellSelection
  // for why those are not the same thing. Group 3 (TYPE) stays single-choice.
  const [cellFilter, setCellFilter] = useState<MatrixCellSelection>([]);
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

  // Hide archived directives. Default ON: archived means "no longer tracked",
  // so the working view should not carry them. Unchecking reveals them, marked.
  // NOT persisted, matching hidePaused.
  const [hideArchived, setHideArchived] = useState(true);

  // PART C — the clicked brand column. NOT a filter and NOT a selection: it
  // changes nothing about which rows or cells exist, it only bands one column so
  // the eye can follow it across a 16-wide grid.
  //
  // Kept deliberately separate from `pinned` and `hover`, which drive the batch-3
  // crosshair. Those answer "which CELL is being inspected"; this answers "which
  // COLUMN did the user ask to keep visible", and they can legitimately disagree
  // — hovering row 4 of column B while column A is highlighted is a normal state,
  // not a conflict to resolve away.
  //
  // Holds a brand id that may stop being rendered (hide-paused toggled, project
  // switched). That is harmless by construction: the id is only ever compared
  // against brands being rendered, so an unresolvable one simply bands nothing —
  // the same reasoning that lets `pinned` survive a filter change.
  const [highlightBrandId, setHighlightBrandId] = useState<string | null>(null);

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
      // ALL statuses. The archived rows are needed for the Hide-archived toggle
      // AND for the archived-search signal, and loading them here rather than
      // separately means toggling never refetches — a refetch would show the row
      // before its cells and render it hollow, which is the pagination-hotfix
      // symptom manufactured on purpose.
      fetchAllPaged<DirectiveRow>('directives', (from, to) =>
        supabase
          .from('directives')
          .select('id, project_key, title, directive_type, description, status, created_at')
          .eq('project_key', key)
          .order('created_at')
          .range(from, to),
      ),
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
    if (directivesRes.error) failures.push(directivesRes.error);
    if (findingsRes.error) failures.push(`findings: ${findingsRes.error.message}`);

    const directiveRows = directivesRes.data;
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
            .select('id, directive_id, brand_id, status, note, updated_by')
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
    setEditingDirectiveId(null); // ditto — and an open editor would submit a
    // PATCH for a directive the user is no longer looking at.
    setPinned(null); // ditto — a pinned readout from another client is nonsense
    setHover(null);
    // Part C. Harmless if left set — an unrendered brand id bands nothing — but
    // cleared for the same reason as the three above: state describing another
    // client should not survive the switch, and leaving it would mean a column
    // silently re-highlights if the user switches back.
    setHighlightBrandId(null);
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
        setEditingDirectiveId(null);
        setPinned(null);
        setHover(null);
        setHighlightBrandId(null);
        void loadProject(detail);
      }
    }
    window.addEventListener(PULSE_PROJECT_EVENT, onProject);
    return () => window.removeEventListener(PULSE_PROJECT_EVENT, onProject);
  }, [projectKey, loadProject]);

  // ⚠ §4.2's MECHANISM. "Filter at render" is a phrase; this is the thing.
  //
  // EIGHT consumers read the directive set, and the right answer is NOT uniform.
  // Two of them must keep the RAW array:
  //   • computeMatrixKpis — its own internal status filter IS the guarantee, and
  //     pre-filtering here would make that filter dead code in the default state
  //     instead of exercised on every render.
  //   • countArchivedMatchingSearch — its whole job is counting what the view
  //     hides, so a filtered input would zero it out.
  // Everything else — the rendered rows, the hidden-by-filters correction, the
  // type-tab empty state, and every `.length` readout — takes visibleDirectives.
  const visibleDirectives = useMemo(
    () => (hideArchived ? directives.filter((d) => d.status === 'active') : directives),
    [directives, hideArchived],
  );

  // Cells scoped to the rendered directives, for countHiddenOwedCells ONLY —
  // the one consumer that takes no directive argument and therefore cannot scope
  // itself. Without this, an owed cell on a paused brand belonging to an ARCHIVED
  // directive fires the amber warning, whose text ("still counted") is false and
  // whose offered fix (Show paused) reveals nothing, because the row is hidden by
  // hideArchived rather than by hidePaused.
  const visibleCells = useMemo(() => {
    if (!hideArchived) return cells;
    const ids = new Set(visibleDirectives.map((d) => d.id));
    return cells.filter((c) => ids.has(c.directive_id));
  }, [cells, visibleDirectives, hideArchived]);

  const cellByKey = useMemo(() => {
    const map = new Map<string, CellRow>();
    for (const cell of cells) map.set(`${cell.directive_id}:${cell.brand_id}`, cell);
    return map;
  }, [cells]);

  // Cells grouped per directive, for the editor's project_key lock.
  //
  // Reads the FULL `cells` array, NEVER visibleBrands — a paused or hidden
  // brand's cell can hold work just as much as a visible one, and a movability
  // verdict computed off the visible subset would tell an admin a move is safe
  // while a hidden cell was about to be deleted. The same reason
  // buildMatrixRows takes no hidePaused flag.
  const cellsByDirective = useMemo(() => {
    const map = new Map<string, CellRow[]>();
    for (const cell of cells) {
      const list = map.get(cell.directive_id);
      if (list) list.push(cell);
      else map.set(cell.directive_id, [cell]);
    }
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
    () => buildMatrixRows(visibleDirectives, cells, controls),
    [visibleDirectives, cells, controls],
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
  // The crosshair axes (spec §2.4). BOTH derive from `inspected` — the same
  // resolved cell the readout describes — so the row band, the column band and
  // the readout cannot disagree. See the <tr>'s `isHotRow` comment for why the
  // row band moved off pure CSS to get here (Karen MEDIUM-4).
  //
  // A column could never have been CSS anyway: there is no way to reach the nth
  // cell of every OTHER row from a hover on one of them.
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
    () => countHiddenOwedCells(brands, visibleCells, hidePaused),
    [brands, visibleCells, hidePaused],
  );

  // Directives matching the search but excluded by the status filter. Surfaced
  // so "search found nothing" can never be read as "it doesn't exist" — see
  // countHiddenByFilters for why that false negative is dangerous here. With
  // three groups a hidden row can have three causes, so this is ONE honest total
  // and the reset clears ALL of them — no per-group attribution (a row can be
  // excluded by two groups at once, so any breakdown would double-count).
  const hiddenByFilters = useMemo(
    () => countHiddenByFilters(visibleDirectives, cells, controls),
    [visibleDirectives, cells, controls],
  );
  const filtersActive = hasActiveFilterGroup(controls);
  // Drives whether `Clear filters` is offered at all (spec §A1). Broader than
  // filtersActive: it includes the search, because clearing a search is the most
  // common thing the control is wanted for.
  const clearable = hasClearableFilters(controls);

  // §A7 — archived directives matching the CURRENT search. The other half of the
  // "found nothing" correction: hiddenByFilters covers rows a filter hid,
  // this covers rows the STATUS='active' LOAD hid, which no filter can reveal
  // and which therefore contribute 0 to hiddenByFilters. Returns 0 on a blank
  // query by construction.
  const archivedMatches = useMemo(
    () => countArchivedMatchingSearch(directives, search),
    [directives, search],
  );

  // KPI strip — every value derived from loaded data, never a literal. Reuses the
  // same classifier + outstandingCount the rows use, so the strip and the
  // per-row Outstanding pill cannot disagree.
  const kpi = useMemo(
    () => computeMatrixKpis(directives, cells, brands),
    [directives, cells, brands],
  );

  // Clears every filter group AND the search — what the hidden-count reset does.
  // Clears exactly what `hasClearableFilters` reports — the search and all three
  // groups. NOT the sort (not a filter, hides nothing) and NOT hide-paused
  // (which has its own dedicated correction, and two competing reset paths for
  // one piece of state is worse than none). The two must stay in step: a control
  // that appears when nothing it clears is set, or hides while something is, is
  // the same class of dishonest signal as a wrong count.
  const clearAllFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setCellFilter([]);
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

  // Directive edit / archive / restore / move. Returns null on success or the
  // failure MESSAGE, which the strip renders inline — the route's 409s ("N brand
  // cells have been edited", "a directive titled X already exists") are the
  // informative part and a toast that vanishes is the wrong surface for them.
  //
  // Deliberately NOT optimistic, unlike handleCellSave. A cell edit changes one
  // dot; this can change a row's identity, its type badge, whether it renders at
  // all (archive), and — on a move — its entire cell set. Reloading is the only
  // way the page cannot end up describing a directive that no longer matches
  // what was stored.
  const handleDirectiveSave = useCallback(
    async (directiveId: string, body: Record<string, string | null>): Promise<string | null> => {
      try {
        const res = await fetch(`/api/admin/directives/${directiveId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          return result.error ?? `Save failed (${res.status})`;
        }
        if (result.auditError) {
          // The write landed but the trail did not. Say so rather than reporting
          // a clean success — an incomplete audit trail is exactly the silence
          // that let the sync-guard defect run for ten weeks.
          toast('⚠ Saved, but the change log entry failed to write.');
        } else if (result.changed === 0) {
          toast('No changes to save');
        } else {
          toast(
            result.cells_refanned !== undefined
              ? `✅ Directive moved — ${result.cells_refanned} brand cells rebuilt`
              : '✅ Directive updated',
          );
        }
        await loadProject(projectKey);
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'Save failed';
      }
    },
    [projectKey, loadProject, toast],
  );


  const projectLabel = projects.find((p) => p.jira_project_key === projectKey)?.display_name ?? projectKey;
  // Move targets. `projects` already holds ACTIVE projects only (initialLoad
  // filters is_active), which matters: the route rejects a move to an inactive
  // project, so offering one would be an option that always 409s.
  // Archived directives in THIS project, regardless of search. Drives the
  // toggle's own visibility and the result line's second figure. Derived from
  // the single all-status load — one fetch, one source.
  const archivedCount = useMemo(
    () => directives.filter((d) => d.status === 'archived').length,
    [directives],
  );
  // The ACTIVE total for this project, independent of the toggle. This is the
  // figure the KPI strip's `total` reports, so the result line quoting the same
  // number is what keeps the two from contradicting each other on one screen.
  const activeCount = useMemo(
    () => directives.filter((d) => d.status === 'active').length,
    [directives],
  );

  const projectOptions = useMemo(
    () => projects.map((p) => ({ key: p.jira_project_key, label: p.display_name })),
    [projects],
  );
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
      ) : visibleDirectives.length === 0 && !createOpen ? (
        <Card className="p-8 text-center text-sm text-[color:var(--f92-gray)]">
          {hideArchived ? 'No active directives for ' : 'No directives for '}
          {projectLabel}.{' '}
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
        {visibleDirectives.length > 0 ? (
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
          {visibleDirectives.length > 0 ? (
          <div className="border-b border-[color:var(--f92-border)] p-3">
            {/* TWO ROWS (spec §A1):
                  row 1  search · STATE · STATUS
                  row 2  TYPE · sort · hide-paused (+ warning) · result count
                Each group brightens its border + legend when it holds a
                non-default value, so "something is filtered" is visible without
                reading every tab. */}
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

              {/* THREE INDEPENDENT GROUPS — AND across, AND with the search.

                  Group 1 STATE is the DERIVED classifier across all brands of a
                  directive; single-choice. Group 2 STATUS is one CELL's own
                  status; MULTI-select, OR within the group. They are different
                  concepts and both exist; group 2 is NOT a rename of group 1,
                  and "rolled out" is not vocabulary here.

                  Their legends differ by one letter and they sit adjacent. That
                  is accepted (spec §A2) — neither name is load-free enough to
                  change, and the GroupShell legend is each group's accessible
                  name, so a bare "Done" is never ambiguous between them. */}
              <TabGroup
                legend="State"
                options={MATRIX_STATUS_FILTERS}
                labels={MATRIX_STATUS_FILTER_LABEL}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                active={statusFilter !== 'all'}
              />
              {/* Labels come STRAIGHT from CELL_STATUS_LABEL — the same export
                  the editor dropdown and the cell aria-labels read. Spec §A3
                  requires the five strings to be verbatim identical across those
                  surfaces, and this batch deleted MATRIX_CELL_FILTER_LABEL,
                  which was a second spelling of them and therefore the thing
                  that could drift. Guaranteed by construction now, not by care. */}
              <MultiTabGroup
                legend="Status"
                options={CELL_STATUSES}
                labels={CELL_STATUS_LABEL}
                selected={cellFilter}
                onToggle={(s) => setCellFilter((cur) => toggleCellStatus(cur, s))}
                onClear={() => setCellFilter([])}
              />
            </div>

            {/* ── row 2 ───────────────────────────────────────────────────── */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
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
                active={typeFilter !== 'all'}
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

              {/* Offered only when something is non-default (spec §A1), gated on
                  hasClearableFilters so the button and clearAllFilters cannot
                  disagree about what "non-default" covers. Deliberately does NOT
                  clear the sort (not a filter) or hide-paused (has its own
                  correction, two clicks below). */}
              {clearable ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="h-9 whitespace-nowrap px-2 text-xs font-medium text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                >
                  Clear filters
                </button>
              ) : null}

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

              {/* Mirrors Hide paused, including its own visibility gate: it
                  appears the first time something in this project is archived,
                  rather than sitting there permanently doing nothing. Default ON
                  — archived means "no longer tracked", so the working view
                  should not carry it. */}
              {archivedCount > 0 ? (
                <label className="flex h-9 items-center gap-2 text-xs font-medium text-[color:var(--f92-dark)]">
                  <input
                    type="checkbox"
                    checked={hideArchived}
                    onChange={(e) => setHideArchived(e.target.checked)}
                    className="h-4 w-4 rounded border-[color:var(--f92-border)] text-[color:var(--f92-orange)] focus:ring-[color:var(--f92-focus-ring)]"
                  />
                  Hide archived ({archivedCount})
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
                {/* §A6 — THE QUANTITY, STATED. The design file reads "87
                    directives", and 87 has meant a different thing on every
                    probe: on 2026-08-14 it was the GLOBAL active count (86 NBLY
                    + 1 SPL) and ALSO, by coincidence, NBLY's all-status count.
                    Re-probed 2026-08-15 it is NBLY's active count, while global
                    active is 88 and NBLY all-status is 88. Three quantities
                    circling the same couple of numbers, none of them reliably
                    the per-project figure this surface needs.

                    ⚠ DO NOT WRITE ANY OF THEM DOWN. The count has moved on all
                    four probes (82 → 83 → 86 → 87 NBLY active in two weeks), so
                    a figure in a comment is wrong by the next re-read; that is
                    why every number here is derived. This paragraph names them
                    only to show they are NOT interchangeable.

                    `visibleDirectives` is project-scoped by loadProject and
                    status-scoped by the toggle, so the number is correct by
                    construction — the project NAME is what makes which quantity
                    it is legible to a reader, which is the whole point of the
                    finding.

                    The word "active" is deliberately absent: `active` is also a
                    derived resolve state in the State group sitting inches away,
                    and a DIFFERENT number again (openDirectives). Writing "86
                    active directives" beside Open/Resolved tabs would recreate
                    the same ambiguity in a new form. */}
                {/* ⚠ THE DENOMINATOR IS THE VISIBLE SET, NOT THE LOADED ONE.
                    Post-CRUD `directives` is ALL statuses, so using it here
                    would put NBLY's all-status count on a per-project line —
                    exactly the "two different quantities at one number" the
                    comment above forbids — and would contradict the KPI strip's
                    `total` inches away.

                    And when archived rows ARE shown, the line names both
                    figures rather than merging them: the first still matches the
                    KPI card, so neither number has to be wrong. */}
                {/* ⚠ THE DENOMINATOR IS THE ACTIVE COUNT, ALWAYS — never
                    `visibleDirectives.length`, which with the toggle OFF is the
                    ALL-STATUS count. Using it there produced "88 directives +
                    1 archived" (reading as 89) beside a KPI card saying 87:
                    HIGH-3 reintroduced in exactly the state the both-figures
                    decision was written to close, because the suffix was
                    appended to a base that already contained it.
                    Keeping the base on activeCount means the first figure
                    ALWAYS equals the KPI strip's `total`, in both toggle
                    states, which is the invariant §8 asserts. */}
                <span className="tabular-nums">
                  {buildResultCountLabel({
                    shown: matrixRows.length,
                    renderable: visibleDirectives.length,
                    activeCount,
                    archivedCount,
                    hideArchived,
                    projectLabel,
                  })}
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

                {/* §A7 — THE ARCHIVED HALF of the same correction, and the one
                    no filter can fix. hiddenByFilters covers rows a FILTER hid;
                    this covers rows the status='active' LOAD hid, which
                    contribute 0 to that count and are unreachable from every
                    control on this page.

                    It matters because acting on the false negative mints a
                    DUPLICATE: POST /api/admin/directives still performs no
                    duplicate-title check and migration 024 puts no unique
                    constraint on (project_key, title), after which any title→id
                    resolver silently picks the wrong row.

                    NO CLEAR BUTTON HERE, deliberately — there is nothing to
                    clear. Archived directives are not rendered by this page at
                    all (loadProject reads active only), and there is no archive
                    UI to link to yet. Stating the fact is the whole deliverable;
                    an affordance that did nothing would be worse than none.

                    Recorded as unreachable by Karen LOW-8 on 2026-07-29 — that
                    audit checked app/api/ for an archive writer and found none.
                    Prod has one, written by direct SQL. */}
                {/* GATED ON hideArchived. With the toggle off, archived rows
                    ARE shown, so "are not shown" would be a false statement on
                    the one surface whose job is preventing a false conclusion —
                    the same failure mode in a new direction. */}
                {hideArchived && archivedMatches > 0 ? (
                  <span className="font-normal">
                    ·{' '}
                    {archivedMatches === 1
                      ? '1 archived directive matches your search and is not shown.'
                      : `${archivedMatches} archived directives match your search and are not shown.`}
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
                  {/* `isPinnedCell`, NOT `pinned` (Karen MEDIUM-D1). `pinned`
                      answers "a pin exists"; this badge claims "the cell you are
                      reading IS the pin", and after the HIGH-1 fallback those
                      diverge: pin a cell, filter it out, and the bar correctly
                      describes the HOVER cell — with a "Pinned" badge beside it.
                      The announcement never made that claim, because it already
                      asks isPinnedCell, so the visible badge would have
                      contradicted the spoken text with the visible one lying.
                      Same shape as batch 2's HIGH-2: two consumers of one fact,
                      only one wired. */}
                  {inspected?.isPinnedCell ? (
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
              {/* A pin that exists but is NOT what we resolved is off screen —
                  filtered out, or in a hidden paused column. Say so, rather than
                  leaving an "Unpin" control next to a readout that has nothing to
                  do with it (Karen MEDIUM-D1). Cheap, and it explains the one
                  state where the button and the readout are legitimately about
                  different cells. */}
              {pinned && !inspected?.isPinnedCell ? (
                <span aria-hidden="true" className="italic text-[color:var(--f92-lgray)]">
                  · pinned cell is hidden by the current filters
                </span>
              ) : null}
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
                // duplicate title.
                //
                // NOW clearAllFilters(), NOT search + state alone. The original
                // pair predates the Type and Status groups and the guarantee in
                // the comment above it had QUIETLY STOPPED BEING TRUE: creating
                // a goal while Type=Trigger, or while Status=Done, left the new
                // row hidden and reproduced the exact MEDIUM-2 failure the reset
                // exists to prevent. Multi-select STATUS widens the ways to
                // reach it, which is what surfaced this.
                //
                // Correct for every fan-out outcome only because `open` keeps
                // `unstarted` visible (the verbatim guard): an all-paused
                // project fans out to all-n_a and a brand-less one to zero
                // cells; both classify unstarted, and clearAllFilters lands on
                // `all`, which shows them either way.
                clearAllFilters();
                void loadProject(projectKey);
              }}
              onCancel={() => setCreateOpen(false)}
            />
          ) : null}

          {visibleDirectives.length === 0 ? (
            <div className="p-8 text-center text-sm text-[color:var(--f92-gray)]">
              {hideArchived ? 'No active directives for ' : 'No directives for '}
              {projectLabel} yet.{' '}
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
              {typeFilter !== 'all' && countByType(visibleDirectives, typeFilter) === 0 ? (
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
                  {/* THE WORST CASE FOR A FALSE NEGATIVE: nothing on screen and
                      a search that "found nothing", which is exactly when
                      someone concludes the directive does not exist and creates
                      a duplicate. If the term matches an ARCHIVED directive, say
                      so right here — the live region above carries it too, but
                      this is where the eye is. */}
                  {/* "MATCHES", NEVER "EXISTS" (Karen LOW-2). The helper knows
                      only that an archived TITLE CONTAINS the query — searching
                      "form" matching "Submits Form Lead - Combined" is not the
                      same claim as "the thing you searched for exists". This is
                      the copy shown at the exact moment someone decides whether
                      to create a duplicate, so it must not assert identity from
                      a substring. Kept word-for-word in step with the live
                      region above. */}
                  {hideArchived && archivedMatches > 0 ? (
                    <span className="italic">
                      {archivedMatches === 1
                        ? '1 archived directive matches your search and is not shown. '
                        : `${archivedMatches} archived directives match your search and are not shown. `}
                      {/* The one-click escape, mirroring the paused warning's
                          "Show paused". Without it the empty state names a row
                          it will not let you reach — and "Clear all filters"
                          beside it does NOT reveal it, because hideArchived is a
                          view preference and clearAllFilters deliberately leaves
                          those alone (same as hidePaused). */}
                      <button
                        type="button"
                        onClick={() => setHideArchived(false)}
                        className="font-semibold not-italic text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                      >
                        Show archived
                      </button>
                      {'. '}
                    </span>
                  ) : null}
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
            /* ── PART B: the scroll region ───────────────────────────────────
               BOTH axes scroll here (was `overflow-x-auto`), because `position:
               sticky` resolves against the nearest scrollport: a header row can
               only pin to something that scrolls, and the page body is not it.

               HEIGHT — 65vh, chosen rather than magic. On a 900px laptop
               viewport that is ~585px, roughly 13 body rows at the current ~44px
               row height, while leaving the KPI strip, filter bar and legend
               reachable above without pushing the filter controls off screen. A
               `vh` unit so it can never exceed the viewport on a short screen,
               and a MAX-height so a three-row project does not render 65vh of
               empty box.

               STACKING — intersection 30 > header 20 > sticky body cells 10.
               The top-left cell is sticky on BOTH axes, so it is the one cell
               that both of the others would otherwise scroll over. */
            /* PART C's clear-on-outside-click lives HERE, on the scroll region,
               as ONE rule: any click in the grid that is not on a brand header
               clears the highlight. The header buttons stop propagation, so
               "click the same header again" is a toggle and "click a different
               header" moves it, while a cell click — which already pins or opens
               the editor — clears it on the way past. Clicking inside the open
               editor strip clears it too; that is "anywhere else in the grid",
               stated rather than special-cased.

               A DIV WITH onClick AND NO ROLE IS CORRECT HERE, not a missing
               button: every interactive thing inside is already a real <button>
               with its own keyboard path, and this handler only ever REMOVES a
               purely decorative state. There is nothing here for a keyboard user
               to reach that they cannot reach by activating a header again. */
            <div className="max-h-[65vh] overflow-auto" onClick={() => setHighlightBrandId(null)}>
              <table className="w-full border-collapse text-sm">
                {/* The header's bottom rule is an inset BOX-SHADOW, not a
                    border, and the <tr>'s border-b is gone. Under
                    `border-collapse: collapse` a collapsed border belongs to the
                    table's border model rather than to the cell, so it does not
                    reliably travel with a sticky cell while rows scroll beneath
                    it — the rule detaches or disappears. A box-shadow is drawn
                    by the cell itself and is untouched by border collapsing.

                    Every header cell also needs an OPAQUE background or the rows
                    scroll straight through it. That is why the brand headers,
                    which previously had no background at all, now carry the same
                    surface/tint ternary as the body: two competing `bg-*`
                    utilities at equal specificity would be resolved by
                    Tailwind's emission order, so exactly one class is emitted. */}
                <thead>
                  <tr>
                    <th
                      className="sticky left-0 top-0 z-30 bg-[color:var(--f92-surface)] px-4 py-3 text-left text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]"
                      style={{ letterSpacing: 'var(--tracking-wide)', boxShadow: HEADER_RULE }}
                    >
                      Directive
                    </th>
                    {visibleBrands.map((brand) => {
                      const isHighlighted = highlightBrandId === brand.id;
                      return (
                      <th
                        key={brand.id}
                        // §2.4 — the brand header bands with its column, so the
                        // band reads as "this column" rather than as a stripe
                        // floating in the middle of the grid.
                        //
                        // PRECEDENCE (spec §C1) lives in headerBandClass, not
                        // here: highlight > crosshair > opaque fallback, always
                        // exactly one class. Shared with the body cells so the
                        // header cannot disagree with its own column, and
                        // pinned by tests/matrix-band.test.ts — a ternary in
                        // JSX would be invisible to tsc, ESLint and the build.
                        className={
                          'sticky top-0 z-20 px-3 py-3 text-center text-[10px] font-semibold uppercase transition-colors ' +
                          headerBandClass({
                            highlighted: isHighlighted,
                            crosshair: hotBrandId === brand.id,
                          })
                        }
                        style={{
                          letterSpacing: 'var(--tracking-wide)',
                          // Both text colours step UP on the highlight rather
                          // than staying put. In LIGHT that is not a bonus, it
                          // is a REPAIR: the light highlight lowers contrast for
                          // anything that keeps its colour (see globals.css), so
                          // holding --f92-gray here would have dropped the
                          // header to 3.94:1 — below AA — on the one column the
                          // user asked to look at. Stepping up recovers it and
                          // then some. In dark the background already helps and
                          // the step is pure gain.
                          //   non-paused 4.83:1 → 13.89:1 light · 6.13:1 →
                          //     15.01:1 dark
                          //   paused     2.54:1 →  3.94:1 light · 3.30:1 →
                          //     7.22:1 dark
                          //
                          // Light-mode paused-and-highlighted is 3.94:1, short of
                          // AA for small text — stated rather than rounded up. It
                          // is a strict improvement on the pre-existing 2.54:1,
                          // the paused state is redundantly encoded by the `·`
                          // suffix and the title, and paused columns are hidden
                          // by default, so reaching this state at all takes two
                          // deliberate actions.
                          //
                          // Figures recomputed 2026-08-14 (Karen MEDIUM-1): the
                          // first set here was estimated, not run, and every one
                          // was off.
                          color: isHighlighted
                            ? brand.is_paused
                              ? 'var(--f92-gray)'
                              : 'var(--f92-dark)'
                            : brand.is_paused
                              ? 'var(--f92-lgray)'
                              : 'var(--f92-gray)',
                          boxShadow: HEADER_RULE,
                        }}
                      >
                        {/* A REAL BUTTON, and it costs a tab stop per visible
                            brand — 13 under defaults, 16 with paused shown. The
                            handoff asked to confirm it adds none; it does, and
                            saying otherwise would be false. A keyboard-operable
                            control needs a tab stop, and the alternatives are a
                            mouse-only feature or a control Tab cannot reach. The
                            only way to have both is a roving tabindex over
                            role="grid", which is out of scope (G7, recorded
                            against restyle batch 4) — and these 13 sit at the
                            very top of the grid, where the already-recorded
                            skip-the-matrix link would clear them in one press.

                            stopPropagation is what makes the container's
                            clear-on-click a toggle rather than an
                            immediately-undone set.

                            The title moved onto the button so the tooltip is
                            reachable by the thing that is now interactive. */}
                        <button
                          type="button"
                          aria-pressed={isHighlighted}
                          title={brand.is_paused ? `${brand.display_name} (paused)` : brand.display_name}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHighlightBrandId((cur) => (cur === brand.id ? null : brand.id));
                          }}
                          className="cursor-pointer rounded px-1 py-0.5 uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                        >
                          {brand.brand_code}
                          {brand.is_paused ? <span className="ml-0.5 opacity-70">·</span> : null}
                          <span className="sr-only">
                            {' — '}
                            {brand.display_name}
                            {brand.is_paused ? ' (paused)' : ''}
                            {isHighlighted ? ', column highlighted' : ', highlight column'}
                          </span>
                        </button>
                      </th>
                      );
                    })}
                    <th
                      className="sticky top-0 z-20 bg-[color:var(--f92-surface)] px-4 py-3 text-right text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]"
                      style={{ letterSpacing: 'var(--tracking-wide)', boxShadow: HEADER_RULE }}
                    >
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
                    // ROW BAND — from STATE, off the same resolved cell the
                    // column band and the readout use (Karen MEDIUM-4, option 1).
                    //
                    // It used to be pure CSS (`group-hover` / `group-focus-within`
                    // on the <tr>), which was cheaper but could DISAGREE with the
                    // rest of the crosshair: the row came from the pointer while
                    // the column came from `inspected`, and `inspected` prefers a
                    // PIN. Pin A then hover B and you got row B + column A —
                    // crosshairing a cell that was neither pinned nor hovered nor
                    // the one the readout was describing. Suppressing the focus
                    // variant while pinned does NOT fix that (it only stops row A
                    // self-banding; `group-hover` still bands row B), and neither
                    // does blurring after the pin. The defect was structural: one
                    // axis pointer-driven, the other state-driven, pin winning.
                    //
                    // Now BOTH axes read `inspected`. One derivation, one render,
                    // so the crosshair cannot disagree with the readout — the
                    // same argument that put `hasNote` in a shared module.
                    //
                    // Dropping `group-focus-within` costs nothing, because
                    // `onFocus` already feeds `hover`: a tabbed-to cell resolves
                    // through `inspected` and bands its row from state.
                    const isEditingDirective = editingDirectiveId === directive.id;
                    const isHotRow = inspected?.directiveId === directive.id;
                    return (
                      <Fragment key={directive.id}>
                        <tr className="border-b border-[color:var(--f92-border)] last:border-0">
                          {/* The sticky column MUST band too. It carries an
                              opaque --f92-surface background (without which rows
                              would show through it while scrolled), so a row
                              band that skipped it would leave a white notch at
                              the start of every highlighted row and read as
                              broken.
                              The two backgrounds are MUTUALLY EXCLUSIVE, not
                              layered, and that is load-bearing: both are plain
                              `bg-*` utilities at specificity (0,1,0), so if both
                              were ever present the winner would be decided by
                              Tailwind's EMISSION ORDER — not by the order they
                              appear in this className. The old `group-hover:`
                              variant could be layered safely because its
                              `:is(:where(.group):hover *)` made it (0,2,0); a
                              state-driven plain class has no such advantage. A
                              ternary is the only form that is order-independent
                              here. */}
                          <td
                            className={
                              'sticky left-0 z-10 px-4 py-3 align-top transition-colors ' +
                              (isHotRow
                                ? 'bg-[color:var(--f92-tint)]'
                                : 'bg-[color:var(--f92-surface)]')
                            }
                          >
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
                              {/* Archived rows only ever render with the toggle
                                  off, so this marker cannot appear unasked. It
                                  says LIFECYCLE, not completion — "Archived" is
                                  not a resolve state and must never be read as
                                  one, which is why it sits beside the type badge
                                  rather than anywhere near the Outstanding
                                  pill. */}
                              {directive.status === 'archived' ? (
                                <span
                                  className="inline-flex w-fit items-center border border-dashed border-[color:var(--f92-gray)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]"
                                  style={{
                                    letterSpacing: 'var(--tracking-wide)',
                                    borderRadius: 'var(--radius-full)',
                                  }}
                                >
                                  Archived
                                </span>
                              ) : null}
                              <span className="font-medium text-[color:var(--f92-dark)]">{directive.title}</span>
                              {directive.description ? (
                                <span className="max-w-xs text-xs text-[color:var(--f92-gray)]">{directive.description}</span>
                              ) : null}
                              {/* Admin-only. Non-admins get NO control at all
                                  rather than a disabled one — the route and RLS
                                  both enforce this regardless of what renders.
                                  Opening the directive editor closes any open
                                  CELL editor: one expansion slot per row, and
                                  two Save buttons in one row would mean two
                                  different things. */}
                              {isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedCell(null);
                                    setEditingDirectiveId(isEditingDirective ? null : directive.id);
                                  }}
                                  aria-expanded={isEditingDirective}
                                  className="w-fit text-xs font-medium text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                                >
                                  {isEditingDirective ? 'Close' : 'Edit'}
                                </button>
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
                            // Archived rows render their cells READ-ONLY. A
                            // retired directive is not being worked, so an
                            // editor on it is an affordance without a meaning —
                            // and an edit would move the per-row Outstanding
                            // pill on a row computeMatrixKpis deliberately does
                            // not count, which is a fresh instance of the same
                            // counted-vs-shown mismatch the paused-brand warning
                            // exists to catch. The cells stay INTACT either way
                            // (they must, so a restore finds them as they were);
                            // that does not require them to be editable while
                            // archived. Restore-then-edit is the two-click path
                            // and it leaves an audit trail of the restore.
                            const canEdit =
                              isAdmin && !!cell && directive.status === 'active';
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
                                // Both crosshair axes, ONE source (`inspected`),
                                // now behind the Part C highlight — and the
                                // whole precedence in cellBandClass, shared
                                // with the header. Note the fallback differs
                                // there: a body cell must stay TRANSPARENT so
                                // the row band underneath shows through, while
                                // the sticky header must be opaque. That
                                // difference is load-bearing in both directions
                                // and is pinned by test.
                                className={
                                  'px-2.5 py-2.5 text-center transition-colors ' +
                                  cellBandClass({
                                    highlighted: highlightBrandId === brand.id,
                                    crosshair: isHotRow || hotBrandId === brand.id,
                                  })
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
                                      // The other direction of the mutual
                                      // exclusion: a row has one expansion slot,
                                      // so opening the cell editor closes the
                                      // directive editor. Unconditional rather
                                      // than row-scoped — only one directive
                                      // editor is ever open, and if it belongs
                                      // to another row it is being replaced by
                                      // this one anyway.
                                      setEditingDirectiveId(null);
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
                                  // keeps this cheap is ONE thing:
                                  //
                                  //   `onMouseEnter`, not `onMouseMove`. State
                                  //   changes only when the pointer CROSSES a
                                  //   cell boundary, so the rate is bounded by
                                  //   how fast a hand moves across cells (a
                                  //   handful per second) rather than by the
                                  //   event loop.
                                  //
                                  // COST: EVERY crossing re-renders the matrix
                                  // subtree, vertical as well as horizontal.
                                  // BOTH axes are state-driven as of the
                                  // MEDIUM-4 fix, and even before it the readout
                                  // alone made vertical crossings re-render — so
                                  // there was never a free axis. Two earlier
                                  // drafts of this comment claimed the pure-CSS
                                  // row band made vertical movement "cost zero
                                  // renders"; that was false then and is moot
                                  // now, and leaving it standing would have been
                                  // the spec §1 violation this batch corrected
                                  // in batch 2's comments.
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
                                  // 86, so that product describes a tree that
                                  // no longer exists. Same shelf-life problem
                                  // the 2026-07-31 batch hit at 45 minutes —
                                  // and this comment has now been stale TWICE
                                  // (it said 82 until 2026-08-14), which is the
                                  // argument for probing rather than trusting
                                  // any figure written here, this one included.
                                  //
                                  // What IS derivable today (re-probed
                                  // 2026-08-14; 86 is NBLYCRO's ACTIVE count —
                                  // 87 is the global figure and also NBLY's
                                  // all-status count, two different quantities
                                  // at one number, so never paste 87 here):
                                  //   86 × 13 = 1,118  defaults (hide-paused ON
                                  //                     → 16 active − 3 paused),
                                  //                     before the status filter
                                  //                     removes any row
                                  //   86 × 16 = 1,376  paused columns shown
                                  // The `open` default only ever subtracts rows,
                                  // so 1,118 is the ceiling under defaults and
                                  // the typical figure sits below it by however
                                  // many directives are fully resolved — a count
                                  // nobody has measured at 86 directives. Probe
                                  // it before sizing the follow-on; do not scale
                                  // the old 50/69 ratio, which is how the stale
                                  // number got here.
                                  //
                                  // So judge the follow-on against ~1,118, not
                                  // 1,066 and not 650. Each cell is a button plus one styled
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
                          <td
                            className={
                              'px-4 py-3 text-right transition-colors ' +
                              (isHotRow ? 'bg-[color:var(--f92-tint)]' : '')
                            }
                          >
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

                        {/* Inline DIRECTIVE editor — same expansion-row shape
                            as the cell editor below, so the two read as one
                            pattern. Keyed by directive id so the form's
                            useState initializers re-seed from the snapshot on
                            every open; without the key, closing and reopening a
                            DIFFERENT row would reuse the previous row's field
                            state and the dirty guard would compare against the
                            wrong snapshot. */}
                        {isEditingDirective ? (
                          <tr className="border-b border-[color:var(--f92-border)] bg-[color:var(--f92-tint)]">
                            <td colSpan={visibleBrands.length + 2} className="p-0">
                              <div className="sticky left-0 w-[min(56rem,100%)] p-2">
                                <DirectiveEditStrip
                                  key={directive.id}
                                  directive={directive}
                                  typeLabel={TYPE_LABEL}
                                  projectOptions={projectOptions}
                                  cells={cellsByDirective.get(directive.id) ?? []}
                                  onSave={(body) => handleDirectiveSave(directive.id, body)}
                                  onClose={() => setEditingDirectiveId(null)}
                                />
                              </div>
                            </td>
                          </tr>
                        ) : null}

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
