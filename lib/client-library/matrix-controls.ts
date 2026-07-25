// Batch 012 — Pulse: directive matrix controls (search · status filter · sort ·
// hide paused brands). Pure, side-effect-free logic for the matrix page's four
// client-side controls, so the render layer stays thin and
// tests/matrix-controls.test.ts can pin the rules that would otherwise only be
// verifiable by clicking. Mirrors the lib/client-library/{directives,pulse,
// monitoring}.ts split — logic in lib, page + tests import it.
//
// Everything here operates on data the page has ALREADY loaded: no fetch, no
// route, no schema. See docs/batch-012-pulse-matrix-controls-spec.md.

import { outstandingCount, type CellStatus } from './directives';

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

export interface MatrixControls {
  search: string;
  statusFilter: MatrixStatusFilter;
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
    const own = byDirective.get(directive.id) ?? NO_CELLS;
    const { outstanding, resolveState } = summarizeDirectiveCells(own);
    if (!matchesStatusFilter(resolveState, controls.statusFilter)) continue;
    rows.push({ directive, outstanding, resolveState });
  }

  rows.sort((a, b) => compareMatrixRows(a, b, controls.sortKey));
  return rows;
}

// How many directives match the SEARCH but were excluded by the STATUS filter.
//
// Why this exists (Karen MEDIUM-1): the default `open` filter hides resolved
// directives, which turns the new search box into a false-negative machine for
// the most natural admin flow — "search for a title to see if it exists → find
// nothing → create it". That is dangerous here specifically because
// `POST /api/admin/directives` performs NO duplicate-title check and migration
// 024 puts NO unique constraint on (project_key, title), so a duplicate title
// silently makes a title→id resolver pick the wrong directive (the exact shape
// §16 records as a folded finding on the Convert-reconciliation batch).
//
// Surfacing this count lets the UI say "N match under other statuses" instead
// of an unqualified "nothing found". Fixing the route would be the durable
// answer, but that is a mutation-surface change and out of this batch's profile.
export function countHiddenByStatus<D extends MatrixDirectiveLike>(
  directives: ReadonlyArray<D>,
  cells: ReadonlyArray<MatrixCellLike>,
  controls: MatrixControls,
): number {
  if (controls.statusFilter === 'all') return 0;
  const byDirective = groupCellsByDirective(cells);
  let hidden = 0;
  for (const directive of directives) {
    if (!matchesSearch(directive.title, controls.search)) continue;
    const { resolveState } = summarizeDirectiveCells(byDirective.get(directive.id) ?? NO_CELLS);
    if (!matchesStatusFilter(resolveState, controls.statusFilter)) hidden += 1;
  }
  return hidden;
}
