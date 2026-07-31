// Batch 012 — Pulse: directive matrix controls (search · status filter · sort ·
// hide paused brands). Pure, side-effect-free logic for the matrix page's four
// client-side controls, so the render layer stays thin and
// tests/matrix-controls.test.ts can pin the rules that would otherwise only be
// verifiable by clicking. Mirrors the lib/client-library/{directives,pulse,
// monitoring}.ts split — logic in lib, page + tests import it.
//
// Everything here operates on data the page has ALREADY loaded: no fetch, no
// route, no schema. See docs/batch-012-pulse-matrix-controls-spec.md.

import {
  CELL_STATUSES,
  CELL_STATUS_LABEL,
  DIRECTIVE_TYPES,
  outstandingCount,
  type CellStatus,
  type DirectiveType,
} from './directives';

// -------------------------------------------------------------------------
// Derived resolve state (spec §2). Computed from live cell data on every
// render — there is deliberately NO stored `resolved` flag on `directives`,
// so this can never drift from the cells it describes.
// -------------------------------------------------------------------------
export const DIRECTIVE_RESOLVE_STATES = ['active', 'resolved', 'unstarted'] as const;
export type DirectiveResolveState = (typeof DIRECTIVE_RESOLVE_STATES)[number];

// The 3-way rule, as one expression (spec §2):
//   Outstanding > 0                 -> active
//   Outstanding == 0 AND Done >= 1  -> resolved
//   Outstanding == 0 AND Done == 0  -> unstarted
//
// `unstarted` covers a directive whose every cell is n_a AND one with no cells
// at all (a placeholder, or a directive created before any brand existed). Both
// legitimately have work outstanding in the real world even though no cell owes
// it yet — which is exactly why the `open` filter below must keep them visible.
export function resolveStateFrom(outstanding: number, done: number): DirectiveResolveState {
  if (outstanding > 0) return 'active';
  return done >= 1 ? 'resolved' : 'unstarted';
}

export interface DirectiveCellSummary {
  outstanding: number;
  done: number;
  resolveState: DirectiveResolveState;
}

// One pass over a directive's cells → the numbers the row needs plus its state.
// `outstanding` reuses the shared outstandingCount() (todo / in_progress /
// blocked per OWED_CELL_STATUSES) rather than re-deriving the owed set here, so
// the matrix, both admin routes, and this module cannot disagree about what
// "outstanding" means.
export function summarizeDirectiveCells(
  cells: ReadonlyArray<{ status: CellStatus }>,
): DirectiveCellSummary {
  const outstanding = outstandingCount(cells);
  let done = 0;
  for (const cell of cells) {
    if (cell.status === 'done') done += 1;
  }
  return { outstanding, done, resolveState: resolveStateFrom(outstanding, done) };
}

export function classifyDirectiveCells(
  cells: ReadonlyArray<{ status: CellStatus }>,
): DirectiveResolveState {
  return summarizeDirectiveCells(cells).resolveState;
}

// -------------------------------------------------------------------------
// Status filter (spec §2). `open` is the DEFAULT.
// -------------------------------------------------------------------------
export const MATRIX_STATUS_FILTERS = ['open', 'resolved', 'all'] as const;
export type MatrixStatusFilter = (typeof MATRIX_STATUS_FILTERS)[number];

export const MATRIX_STATUS_FILTER_LABEL: Record<MatrixStatusFilter, string> = {
  open: 'Open',
  resolved: 'Resolved',
  all: 'All',
};

// THE VERBATIM GUARD (spec §2.1). `open` means NOT-RESOLVED — expressed as
// `state !== 'resolved'`, deliberately NOT `state === 'active'`.
//
// An `unstarted` directive MUST stay visible under `open`: hiding it behind the
// default filter would make the not-yet-started work invisible to the people who
// need to start it. The negative form also fails safe — a future fourth resolve
// state defaults to VISIBLE rather than silently disappearing.
//
// Do not "simplify" this to `=== 'active'`. As of 2026-07-25 prod has zero
// unstarted directives (50 active / 19 resolved / 0 unstarted), so the two forms
// look identical when clicked through today. They are not: the first all-n_a or
// cell-less directive would vanish from the default view.
//
// This guard also has a LIVE FUNCTIONAL CONSUMER, not just a defensive one: the
// matrix page resets the filter to `open` after a directive is created, so the
// new row is guaranteed visible. That holds for every fan-out outcome ONLY
// because unstarted is visible here — a project whose every active brand is
// paused fans out to all-n_a, and a project with zero active brands fans out to
// zero cells; both classify `unstarted`. Weakening this predicate would silently
// break create-then-see-your-row for those projects.
export function matchesStatusFilter(
  state: DirectiveResolveState,
  filter: MatrixStatusFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'resolved') return state === 'resolved';
  return state !== 'resolved'; // 'open' — active AND unstarted
}

// -------------------------------------------------------------------------
// Search (spec §1). Title only — the ask is find-by-name. Case-insensitive
// substring; a blank/whitespace query matches everything (no filtering).
// -------------------------------------------------------------------------
export function matchesSearch(title: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return title.toLowerCase().includes(needle);
}

// -------------------------------------------------------------------------
// Hide paused brands (spec §3). A transform on the BRAND axis, kept entirely
// separate from the row pipeline below — that separation is what structurally
// guarantees the toggle cannot influence any Outstanding count (spec §3.1).
//
// `is_paused` is read from the loaded brand rows; paused brand codes are never
// hardcoded. Returns a new array either way (never mutates the input).
// -------------------------------------------------------------------------
export function visibleMatrixBrands<B extends { is_paused: boolean }>(
  brands: ReadonlyArray<B>,
  hidePaused: boolean,
): B[] {
  return hidePaused ? brands.filter((b) => !b.is_paused) : brands.slice();
}

// Owed cells sitting on a brand whose column is hidden — work that Outstanding
// COUNTS but that the user cannot see. Zero in normal operation.
//
// This is the runtime check on the property that justified defaulting hide-paused
// to CHECKED (2026-07-31, Karen MEDIUM-4). Fan-out lands paused brands at `n_a`
// so they start un-owed, and a prod measurement confirmed 0 owed across all 246
// paused-brand cells — but nothing ENFORCES it: the status PATCH route never
// consults `is_paused`, and the brand page will happily set a paused brand's cell
// to Blocked. One such edit makes a row read "Outstanding 1" with no owed dot
// visible anywhere in it. The page renders a warning when this is non-zero, so
// the divergence announces itself rather than waiting to be tripped over.
//
// Deliberately returns 0 when hidePaused is false: nothing is hidden then, so
// there is nothing to warn about — the caller does not have to re-check the flag.
// Reuses outstandingCount() rather than re-deriving the owed set, so this and the
// Outstanding pill cannot disagree about what "owed" means.
export function countHiddenOwedCells<B extends { id: string; is_paused: boolean }>(
  brands: ReadonlyArray<B>,
  cells: ReadonlyArray<{ brand_id: string; status: CellStatus }>,
  hidePaused: boolean,
): number {
  if (!hidePaused) return 0;
  const pausedIds = new Set(brands.filter((b) => b.is_paused).map((b) => b.id));
  if (pausedIds.size === 0) return 0;
  return outstandingCount(cells.filter((c) => pausedIds.has(c.brand_id)));
}

// -------------------------------------------------------------------------
// Sort (spec §4). Ties break by title in BOTH modes, so ordering is fully
// deterministic and does not lean on Array.prototype.sort stability or on the
// incoming created_at order.
// -------------------------------------------------------------------------
export const MATRIX_SORT_KEYS = ['title', 'outstanding'] as const;
export type MatrixSortKey = (typeof MATRIX_SORT_KEYS)[number];

export const MATRIX_SORT_LABEL: Record<MatrixSortKey, string> = {
  title: 'Title (A–Z)',
  outstanding: 'Outstanding (high→low)',
};

export interface MatrixDirectiveLike {
  id: string;
  title: string;
  directive_type: DirectiveType;
}

export interface MatrixCellLike {
  directive_id: string;
  status: CellStatus;
}

// A render-ready row. It carries `outstanding` + `resolveState` so the page
// renders the Outstanding pill straight off the row and CANNOT compute it a
// second, divergent way.
export interface MatrixRow<D extends MatrixDirectiveLike> {
  directive: D;
  outstanding: number;
  resolveState: DirectiveResolveState;
}

export function compareMatrixRows<D extends MatrixDirectiveLike>(
  a: MatrixRow<D>,
  b: MatrixRow<D>,
  key: MatrixSortKey,
): number {
  if (key === 'outstanding') {
    const byOutstanding = b.outstanding - a.outstanding; // high → low
    if (byOutstanding !== 0) return byOutstanding;
  }
  // Explicit 'en' locale: collation of the bracket-prefixed titles ([GTM],
  // [Upsell], [Rev]) is the most locale-variable part of the ICU table, and
  // leaving it to the host default would make the ordering (and the test that
  // pins it) depend on where the code runs.
  return a.directive.title.localeCompare(b.directive.title, 'en');
}

// -------------------------------------------------------------------------
// Cell-status group (Batch 012 restyle, group 2 of 3). LOCKED vocabulary.
//
// THIS IS NOT A RENAME OF THE STATE GROUP ABOVE, and the two must both exist:
//   State  (group 1) = DERIVED across ALL brands of a directive — Open / Resolved.
//   Status (group 2) = ONE CELL's own status — To do / In progress / Done /
//                      Blocked / N/A.
// The mockup's `Done` tab is this group, not a relabelled `Resolved`. ("Rolled
// out" from the mockup is dead vocabulary and appears nowhere.)
//
// PREDICATE: a row matches when it has AT LEAST ONE cell in that status. A mixed
// row therefore matches SEVERAL tabs at once. That is intended, and it has a
// consequence the UI must respect: THESE TABS DO NOT PARTITION THE ROW SET, so
// their counts do not sum to the total and no readout may imply they do.
// -------------------------------------------------------------------------
export const MATRIX_CELL_FILTERS = [...CELL_STATUSES, 'all'] as const;
export type MatrixCellFilter = (typeof MATRIX_CELL_FILTERS)[number];

export const MATRIX_CELL_FILTER_LABEL: Record<MatrixCellFilter, string> = {
  ...CELL_STATUS_LABEL,
  all: 'All',
};

export function matchesCellFilter(
  cells: ReadonlyArray<{ status: CellStatus }>,
  filter: MatrixCellFilter,
): boolean {
  if (filter === 'all') return true;
  return cells.some((c) => c.status === filter);
}

// -------------------------------------------------------------------------
// Type group (group 3 of 3). Reads the REAL `directive_type` column — migration
// 024's enum, surfaced through DIRECTIVE_TYPES.
//
// The mockup derives GOAL/TRIGGER from a title regex (`GOALISH`). That is
// scaffolding and is NOT ported: it looks like logic, which makes it the most
// likely thing to slip through, and it would silently mislabel any directive
// whose title doesn't match the pattern.
//
// All four options are ALWAYS rendered even though prod holds only goal +
// trigger today — Lacey intends to use site_area and audience. An empty tab
// therefore needs its own copy; the generic no-match state reads as a bug.
// -------------------------------------------------------------------------
export const MATRIX_TYPE_FILTERS = [...DIRECTIVE_TYPES, 'all'] as const;
export type MatrixTypeFilter = (typeof MATRIX_TYPE_FILTERS)[number];

export const MATRIX_TYPE_FILTER_LABEL: Record<MatrixTypeFilter, string> = {
  goal: 'Goal',
  trigger: 'Trigger',
  site_area: 'Site area',
  audience: 'Audience',
  all: 'All',
};

export function matchesTypeFilter(
  directiveType: DirectiveType,
  filter: MatrixTypeFilter,
): boolean {
  return filter === 'all' || directiveType === filter;
}

// -------------------------------------------------------------------------
// The three groups compose: SINGLE-CHOICE within each, AND across, and AND with
// the search. `search` is the only non-group axis.
// -------------------------------------------------------------------------
export interface MatrixControls {
  search: string;
  statusFilter: MatrixStatusFilter;
  cellFilter: MatrixCellFilter;
  typeFilter: MatrixTypeFilter;
  sortKey: MatrixSortKey;
}

// -------------------------------------------------------------------------
// Compose (spec §5): group cells by directive → classify → filter (search AND
// status) → sort. One entry point, so the page's memo is a single call.
//
// `cells` MUST be the directive's FULL cell set (every brand, paused included).
// The hide-paused flag is intentionally NOT a parameter here — that is the
// structural guarantee behind spec §3.1: hiding columns cannot change a count
// this function never sees the flag for.
// -------------------------------------------------------------------------
const NO_CELLS: ReadonlyArray<MatrixCellLike> = [];

function groupCellsByDirective(
  cells: ReadonlyArray<MatrixCellLike>,
): Map<string, MatrixCellLike[]> {
  const byDirective = new Map<string, MatrixCellLike[]>();
  for (const cell of cells) {
    const list = byDirective.get(cell.directive_id);
    if (list) list.push(cell);
    else byDirective.set(cell.directive_id, [cell]);
  }
  return byDirective;
}

export function buildMatrixRows<D extends MatrixDirectiveLike>(
  directives: ReadonlyArray<D>,
  cells: ReadonlyArray<MatrixCellLike>,
  controls: MatrixControls,
): MatrixRow<D>[] {
  const byDirective = groupCellsByDirective(cells);

  const rows: MatrixRow<D>[] = [];
  for (const directive of directives) {
    if (!matchesSearch(directive.title, controls.search)) continue;
    if (!matchesTypeFilter(directive.directive_type, controls.typeFilter)) continue;
    const own = byDirective.get(directive.id) ?? NO_CELLS;
    if (!matchesCellFilter(own, controls.cellFilter)) continue;
    const { outstanding, resolveState } = summarizeDirectiveCells(own);
    if (!matchesStatusFilter(resolveState, controls.statusFilter)) continue;
    rows.push({ directive, outstanding, resolveState });
  }

  rows.sort((a, b) => compareMatrixRows(a, b, controls.sortKey));
  return rows;
}

// How many directives the SEARCH kept but the three filter GROUPS excluded.
//
// Why this replaces the old status-only count (Karen MEDIUM-1, still live): the
// guard exists because a filtered view made someone conclude a directive didn't
// exist and create a duplicate — and `POST /api/admin/directives` STILL performs
// no duplicate-title check, with no unique constraint on (project_key, title), so
// that failure mode is not hypothetical.
//
// With three groups a hidden row can have three different causes, and this
// deliberately does NOT attempt per-group attribution: a row can be excluded by
// two groups at once, so any "hidden because of X" breakdown would either
// double-count or arbitrarily pick a winner. One honest total, and a reset that
// clears ALL THREE groups, is the correct contract — the UI says so plainly.
export function countHiddenByFilters<D extends MatrixDirectiveLike>(
  directives: ReadonlyArray<D>,
  cells: ReadonlyArray<MatrixCellLike>,
  controls: MatrixControls,
): number {
  const byDirective = groupCellsByDirective(cells);
  let hidden = 0;
  for (const directive of directives) {
    if (!matchesSearch(directive.title, controls.search)) continue;
    const own = byDirective.get(directive.id) ?? NO_CELLS;
    const { resolveState } = summarizeDirectiveCells(own);
    const kept =
      matchesTypeFilter(directive.directive_type, controls.typeFilter) &&
      matchesCellFilter(own, controls.cellFilter) &&
      matchesStatusFilter(resolveState, controls.statusFilter);
    if (!kept) hidden += 1;
  }
  return hidden;
}

// True when at least one of the three groups is narrowing the view. Drives
// whether the reset affordance is offered at all — a reset that clears nothing
// is noise, and this is the same "is the correction meaningful?" gate as the
// LOW-6 search check, just for groups.
export function hasActiveFilterGroup(controls: MatrixControls): boolean {
  return (
    controls.statusFilter !== 'all' ||
    controls.cellFilter !== 'all' ||
    controls.typeFilter !== 'all'
  );
}

// How many directives carry a given type, for the empty-tab copy. An empty tab
// must say "no <type> directives yet" rather than falling through to the generic
// no-match state, which reads as a bug on a type Lacey has simply not used yet.
export function countByType<D extends MatrixDirectiveLike>(
  directives: ReadonlyArray<D>,
  type: DirectiveType,
): number {
  let n = 0;
  for (const d of directives) if (d.directive_type === type) n += 1;
  return n;
}

// -------------------------------------------------------------------------
// KPI strip (Batch 012 restyle). EVERY value is derived from loaded data — no
// literal ever renders. That is not stylistic: prod went 76 → 82 active
// directives inside one batch and a whole new project appeared mid-batch, so any
// number written down is wrong by the next week.
//
// Reuses the existing classifier and outstandingCount rather than re-deriving:
// the KPI strip and the per-row Outstanding pill must not be able to disagree.
//
// OUTSTANDING SEMANTICS ARE UNCHANGED AND MUST STAY SO: a cell is outstanding
// when it is neither Done nor N/A, so In progress AND Blocked both count. This
// was verified against prod (an MRH todo→in_progress flip left the count at 12).
// It is `outstandingCount`'s OWED set, untouched here.
// -------------------------------------------------------------------------
export interface MatrixKpis {
  /** Active directives loaded for this project. */
  total: number;
  /** Directives with ≥1 outstanding cell (i.e. resolveState === 'active'). */
  openDirectives: number;
  /** Directives fully rolled out: 0 outstanding AND ≥1 done → 'resolved'. */
  resolved: number;
  /** Directives with no cells owing and none done → 'unstarted'. */
  unstarted: number;
  /** Cells owing work across the project (the OWED set). */
  outstandingCells: number;
  /** Of those, the two sub-counts the strip surfaces separately. */
  inProgressCells: number;
  blockedCells: number;
  /** Coverage = resolved ÷ total, 0 when there are no directives. */
  coveragePct: number;
  /** Brand axis, for the Brands card. */
  brandsTotal: number;
  brandsActive: number;
  brandsPaused: number;
}

export function computeMatrixKpis<D extends MatrixDirectiveLike>(
  directives: ReadonlyArray<D>,
  cells: ReadonlyArray<MatrixCellLike>,
  brands: ReadonlyArray<{ is_paused: boolean }>,
): MatrixKpis {
  const byDirective = groupCellsByDirective(cells);
  let openDirectives = 0;
  let resolved = 0;
  let unstarted = 0;
  for (const d of directives) {
    const state = summarizeDirectiveCells(byDirective.get(d.id) ?? NO_CELLS).resolveState;
    if (state === 'active') openDirectives += 1;
    else if (state === 'resolved') resolved += 1;
    else unstarted += 1;
  }

  // Cell-level counts. Scoped to the loaded directives so a stray cell belonging
  // to another project's directive cannot inflate the strip.
  const known = new Set(directives.map((d) => d.id));
  const own = cells.filter((c) => known.has(c.directive_id));
  const outstandingCells = outstandingCount(own);
  let inProgressCells = 0;
  let blockedCells = 0;
  for (const c of own) {
    if (c.status === 'in_progress') inProgressCells += 1;
    else if (c.status === 'blocked') blockedCells += 1;
  }

  const brandsPaused = brands.filter((b) => b.is_paused).length;
  return {
    total: directives.length,
    openDirectives,
    resolved,
    unstarted,
    outstandingCells,
    inProgressCells,
    blockedCells,
    coveragePct: directives.length === 0 ? 0 : Math.round((resolved / directives.length) * 100),
    brandsTotal: brands.length,
    brandsActive: brands.length - brandsPaused,
    brandsPaused,
  };
}

// NOTE: `countHiddenByStatus` (status-group-only) was REPLACED by
// countHiddenByFilters above when the second and third filter groups landed.
// Keeping both would have left two ways to compute nearly the same number —
// exactly the divergence hazard this module exists to prevent — and the
// status-only version would under-report the moment a Type or Status(cell) tab
// was the thing hiding rows, which is the false-negative the guard exists to
// stop. Its rationale is preserved verbatim on the replacement.
