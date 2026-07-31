import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  brandDirectiveView,
  cellsForBrand,
  effectiveCellStatus,
  filterBrandDirectiveRows,
  matchesBrandStatusFilter,
  toClientNavGroups,
  BRAND_STATUS_FILTERS,
  BRAND_STATUS_FILTER_LABEL,
  TERMINAL_CELL_STATUSES,
  type BrandCell,
  type BrandStatusFilter,
  type ClientNavProjectInput,
  type ClientNavBrandRow,
} from '../lib/client-library/pulse';
import {
  CELL_STATUSES,
  CELL_STATUS_LABEL,
  OWED_CELL_STATUSES,
  type CellStatus,
} from '../lib/client-library/directives';

const cell = (
  directive_id: string,
  brand_id: string,
  status: CellStatus,
  note: string | null = null,
): BrandCell => ({ directive_id, brand_id, status, note });

// -------------------------------------------------------------------------
// Spec §5.1 — the brand-directive filter returns only the target brand's cells
// for a directive set (the filtered view is correct).
// -------------------------------------------------------------------------
test('cellsForBrand returns only the target brand cells', () => {
  const cells: BrandCell[] = [
    cell('d1', 'brandA', 'done'),
    cell('d1', 'brandB', 'todo'),
    cell('d2', 'brandA', 'blocked', 'blocked on assets'),
    cell('d2', 'brandB', 'in_progress'),
  ];
  const forA = cellsForBrand(cells, 'brandA');
  assert.equal(forA.length, 2);
  assert.ok(forA.every((c) => c.brand_id === 'brandA'));
  assert.deepEqual(
    forA.map((c) => c.status).sort(),
    ['blocked', 'done'],
  );
});

test('brandDirectiveView pairs each directive with THIS brand cell (null when none)', () => {
  const directives = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }];
  const cells: BrandCell[] = [
    cell('d1', 'brandA', 'done'),
    cell('d1', 'brandB', 'todo'), // other brand — must not leak in
    cell('d2', 'brandA', 'blocked', 'note A'),
    // d3 has no cell for brandA (brand added after the directive) → null
  ];
  const rows = brandDirectiveView(directives, cells, 'brandA');

  // Order preserved, one row per directive.
  assert.deepEqual(rows.map((r) => r.directive.id), ['d1', 'd2', 'd3']);
  assert.equal(rows[0].cell?.status, 'done');
  assert.equal(rows[1].cell?.status, 'blocked');
  assert.equal(rows[1].cell?.note, 'note A');
  assert.equal(rows[2].cell, null);
  // No brandB status ever surfaced.
  assert.ok(rows.every((r) => r.cell === null || r.cell.brand_id === 'brandA'));
});

// -------------------------------------------------------------------------
// E1 follow-on §5 — cross-project client grouping: multi-brand grouping +
// alpha, single-brand collapse, paused kept / inactive dropped, project alpha,
// empty-brand project skipped, empty set.
// -------------------------------------------------------------------------
const PROJECTS: ClientNavProjectInput[] = [
  { jira_project_key: 'NBLYCRO', display_name: 'Neighborly', brand_model: 'multi_brand', is_active: true },
  { jira_project_key: 'SPLCRO', display_name: 'Spotloan', brand_model: 'single_brand', is_active: true },
  { jira_project_key: 'DEADCRO', display_name: 'Archived Co', brand_model: 'multi_brand', is_active: false },
  { jira_project_key: 'EMPTYCRO', display_name: 'Empty Co', brand_model: 'multi_brand', is_active: true },
];
const BRANDS: ClientNavBrandRow[] = [
  { project_key: 'NBLYCRO', brand_code: 'WDG', display_name: 'Window Genie', is_active: true, is_paused: false },
  { project_key: 'NBLYCRO', brand_code: 'MRR', display_name: 'Mr Rooter', is_active: true, is_paused: true },
  { project_key: 'NBLYCRO', brand_code: 'ASV', display_name: 'Aire Serv', is_active: true, is_paused: false },
  { project_key: 'NBLYCRO', brand_code: 'OLD', display_name: 'Retired Brand', is_active: false, is_paused: false },
  { project_key: 'SPLCRO', brand_code: 'SPL', display_name: 'SPL - Spotloan', is_active: true, is_paused: false },
  { project_key: 'DEADCRO', brand_code: 'DEAD', display_name: 'Dead Brand', is_active: true, is_paused: false },
];

test('multi-brand groups: header + brands alpha, paused kept, inactive brand dropped', () => {
  const groups = toClientNavGroups(PROJECTS, BRANDS);
  const nbly = groups.find((g) => g.projectKey === 'NBLYCRO');
  assert.ok(nbly && nbly.kind === 'multi');
  assert.equal(nbly.label, 'Neighborly');
  // Inactive brand (OLD) dropped; the rest alpha by display name.
  assert.deepEqual(nbly.brands.map((b) => b.displayName), ['Aire Serv', 'Mr Rooter', 'Window Genie']);
  assert.equal(nbly.brands.find((b) => b.brandCode === 'MRR')?.paused, true);
  assert.equal(nbly.brands.find((b) => b.brandCode === 'ASV')?.paused, false);
  // Entries carry projectKey + brandCode for href building.
  assert.ok(nbly.brands.every((b) => b.projectKey === 'NBLYCRO' && b.brandCode));
});

test('single-brand project collapses to one entry under the client name', () => {
  const groups = toClientNavGroups(PROJECTS, BRANDS);
  const spl = groups.find((g) => g.projectKey === 'SPLCRO');
  assert.ok(spl && spl.kind === 'single');
  assert.equal(spl.label, 'Spotloan'); // client display name, not the brand's
  assert.equal(spl.entry.brandCode, 'SPL');
  assert.equal(spl.entry.projectKey, 'SPLCRO');
  assert.equal(spl.entry.paused, false);
});

test('groups sorted alpha by project display name; inactive + empty projects excluded', () => {
  const groups = toClientNavGroups(PROJECTS, BRANDS);
  // DEADCRO is inactive → excluded even though it has an active brand.
  // EMPTYCRO is active but has no active brand → skipped.
  assert.deepEqual(
    groups.map((g) => g.label),
    ['Neighborly', 'Spotloan'],
  );
  assert.ok(!groups.some((g) => g.projectKey === 'DEADCRO'));
  assert.ok(!groups.some((g) => g.projectKey === 'EMPTYCRO'));
});

test('toClientNavGroups on empty inputs returns []', () => {
  assert.deepEqual(toClientNavGroups([], []), []);
  assert.deepEqual(toClientNavGroups(PROJECTS, []), []); // no brands → nothing to link
});

// -------------------------------------------------------------------------
// Brand-page status filter. These pin the rules that are otherwise only
// verifiable by clicking — above all that `open` is an EXCLUSION of the
// terminal statuses, not a whitelist of the owed ones.
// -------------------------------------------------------------------------

// A row set covering every status plus the cell-less case, so the filter is
// exercised against all six shapes a row can take.
const BRAND_ID = 'brandA';
const ALL_SHAPES = [
  { id: 'dTodo', status: 'todo' as CellStatus },
  { id: 'dProg', status: 'in_progress' as CellStatus },
  { id: 'dDone', status: 'done' as CellStatus },
  { id: 'dBlocked', status: 'blocked' as CellStatus },
  { id: 'dNa', status: 'n_a' as CellStatus },
];
const SHAPE_ROWS = brandDirectiveView(
  [...ALL_SHAPES.map((s) => ({ id: s.id })), { id: 'dNoCell' }],
  ALL_SHAPES.map((s) => cell(s.id, BRAND_ID, s.status)),
  BRAND_ID,
);
const visibleIds = (filter: BrandStatusFilter) =>
  filterBrandDirectiveRows(SHAPE_ROWS, filter).map((r) => r.directive.id);

test('effectiveCellStatus: a missing cell reads n_a', () => {
  assert.equal(effectiveCellStatus({ status: 'blocked' }), 'blocked');
  assert.equal(effectiveCellStatus(null), 'n_a');
  assert.equal(effectiveCellStatus(undefined), 'n_a');
});

test('open EXCLUDES the terminal statuses (done + n_a) and keeps everything else', () => {
  assert.deepEqual(visibleIds('open'), ['dTodo', 'dProg', 'dBlocked']);
  // Stated as the exclusion it is, not as the whitelist it must not become.
  for (const status of CELL_STATUSES) {
    assert.equal(
      matchesBrandStatusFilter(status, 'open'),
      !TERMINAL_CELL_STATUSES.includes(status),
      `open must show ${status} iff it is non-terminal`,
    );
  }
});

// THE FAIL-SAFE. This is the whole reason `open` is written as
// `!TERMINAL.has(status)` rather than a whitelist of the owed statuses: a status
// this module has never heard of must default to VISIBLE. A whitelist
// implementation passes every other test in this file and fails only this one.
test('a future sixth cell status defaults to VISIBLE under open, not hidden', () => {
  const future = 'deferred' as CellStatus; // deliberately not in CELL_STATUSES
  assert.equal(matchesBrandStatusFilter(future, 'open'), true);
  assert.equal(matchesBrandStatusFilter(future, 'all'), true);
  // ...and it is not silently swept into some other bucket.
  assert.equal(matchesBrandStatusFilter(future, 'done'), false);
  assert.equal(matchesBrandStatusFilter(future, 'n_a'), false);
});

// The sets partition today's five statuses, but they are declared independently
// so their fail-safes point in opposite directions.
//
// HONEST LIMIT, verified by mutation and not assumed: NO test in this file can
// catch someone "simplifying" TERMINAL_CELL_STATUSES into a computed complement
// of OWED_CELL_STATUSES. Rewriting it that way keeps all 16 tests green,
// INCLUDING the fail-safe test above — because an unknown status is absent from
// the derived list too, so it still reads non-terminal. The two forms only
// diverge when a sixth status is added TO CELL_STATUSES and left out of OWED, at
// which point the complement form auto-classifies it terminal and hides it. A
// test cannot construct that: CELL_STATUSES is a compile-time const.
// So this is a REVIEW-level invariant, and the comment on
// TERMINAL_CELL_STATUSES is its only enforcement. Do not read the green suite as
// proof that the independent declaration is protected. What this test does pin
// is that the two sets agree TODAY, so changing either is a deliberate act.
test('terminal and owed statuses partition the current status set', () => {
  const union = [...TERMINAL_CELL_STATUSES, ...OWED_CELL_STATUSES].sort();
  assert.deepEqual(union, [...CELL_STATUSES].sort());
  assert.equal(
    TERMINAL_CELL_STATUSES.some((s) => OWED_CELL_STATUSES.includes(s)),
    false,
    'no status may be both terminal and owed',
  );
});

test('each individual status filter shows exactly that status', () => {
  assert.deepEqual(visibleIds('todo'), ['dTodo']);
  assert.deepEqual(visibleIds('in_progress'), ['dProg']);
  assert.deepEqual(visibleIds('done'), ['dDone']);
  assert.deepEqual(visibleIds('blocked'), ['dBlocked']);
  // n_a catches BOTH a real n_a cell and the cell-less row, because they render
  // identically (effectiveCellStatus) — the filter must agree with the render.
  assert.deepEqual(visibleIds('n_a'), ['dNa', 'dNoCell']);
});

test('all shows every row, cell-less included, and preserves directive order', () => {
  assert.deepEqual(visibleIds('all'), SHAPE_ROWS.map((r) => r.directive.id));
});

test('a cell-less row is hidden under the default open filter', () => {
  // Deliberate (it is non-interactive anyway) but load-bearing for the page's
  // hidden-count readout, which is what keeps it from being silent.
  assert.ok(!visibleIds('open').includes('dNoCell'));
  assert.ok(visibleIds('all').includes('dNoCell'));
});

test('filterBrandDirectiveRows never mutates its input', () => {
  const before = SHAPE_ROWS.map((r) => r.directive.id);
  filterBrandDirectiveRows(SHAPE_ROWS, 'done');
  assert.deepEqual(SHAPE_ROWS.map((r) => r.directive.id), before);
  assert.deepEqual(filterBrandDirectiveRows([], 'open'), []);
});

// The page computes `hidden = rows.length - visible.length` instead of calling a
// helper (there is no search axis here, unlike the matrix, so the two are
// provably equal). Pin that equality so the shortcut stays honest.
test('hidden count is exactly rows minus visible for every filter', () => {
  for (const filter of BRAND_STATUS_FILTERS) {
    const visible = filterBrandDirectiveRows(SHAPE_ROWS, filter);
    const hidden = SHAPE_ROWS.filter(
      (r) => !matchesBrandStatusFilter(effectiveCellStatus(r.cell), filter),
    ).length;
    assert.equal(SHAPE_ROWS.length - visible.length, hidden, `mismatch for ${filter}`);
  }
});

test('filter options are ordered Open-first and labelled from CELL_STATUS_LABEL', () => {
  assert.deepEqual(
    [...BRAND_STATUS_FILTERS],
    ['open', 'todo', 'in_progress', 'done', 'blocked', 'n_a', 'all'],
  );
  // Per-status labels must match the editor dropdown VERBATIM — two spellings of
  // one status on a single page is a defect, so they share one source.
  for (const status of CELL_STATUSES) {
    assert.equal(BRAND_STATUS_FILTER_LABEL[status], CELL_STATUS_LABEL[status]);
  }
  assert.equal(BRAND_STATUS_FILTER_LABEL.open, 'Open');
  assert.equal(BRAND_STATUS_FILTER_LABEL.all, 'All');
});
