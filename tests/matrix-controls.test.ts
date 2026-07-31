import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildMatrixRows,
  classifyDirectiveCells,
  compareMatrixRows,
  countHiddenByStatus,
  countHiddenOwedCells,
  DIRECTIVE_RESOLVE_STATES,
  matchesSearch,
  matchesStatusFilter,
  MATRIX_STATUS_FILTERS,
  resolveStateFrom,
  summarizeDirectiveCells,
  visibleMatrixBrands,
  type MatrixCellLike,
  type MatrixControls,
  type MatrixRow,
} from '../lib/client-library/matrix-controls';
import {
  CELL_STATUSES,
  outstandingCount,
  type CellStatus,
} from '../lib/client-library/directives';

const cell = (directive_id: string, status: CellStatus): MatrixCellLike => ({ directive_id, status });

// -------------------------------------------------------------------------
// Spec §2 — the derived 3-way resolve state, incl. the two unstarted paths.
// -------------------------------------------------------------------------
test('classifyDirectiveCells: outstanding > 0 → active (regardless of done count)', () => {
  assert.equal(classifyDirectiveCells([cell('d', 'todo')]), 'active');
  assert.equal(classifyDirectiveCells([cell('d', 'in_progress')]), 'active');
  assert.equal(classifyDirectiveCells([cell('d', 'blocked')]), 'active');
  // A mostly-done directive with one owed cell still owes work.
  assert.equal(
    classifyDirectiveCells([cell('d', 'done'), cell('d', 'done'), cell('d', 'todo')]),
    'active',
  );
});

test('classifyDirectiveCells: outstanding 0 + done >= 1 → resolved (n_a does not block)', () => {
  assert.equal(classifyDirectiveCells([cell('d', 'done')]), 'resolved');
  // The real prod shape: done for active brands, n_a for the 3 paused ones.
  assert.equal(
    classifyDirectiveCells([cell('d', 'done'), cell('d', 'n_a'), cell('d', 'n_a')]),
    'resolved',
  );
});

test('classifyDirectiveCells: outstanding 0 + done 0 → unstarted, via BOTH paths', () => {
  // Path 1: every cell is n_a (e.g. a directive only paused brands carry).
  assert.equal(classifyDirectiveCells([cell('d', 'n_a'), cell('d', 'n_a')]), 'unstarted');
  // Path 2: no cells at all (a brand-less directive / placeholder).
  assert.equal(classifyDirectiveCells([]), 'unstarted');
});

test('resolveStateFrom pins the rule at the boundaries', () => {
  assert.equal(resolveStateFrom(1, 0), 'active');
  assert.equal(resolveStateFrom(1, 99), 'active'); // outstanding wins
  assert.equal(resolveStateFrom(0, 1), 'resolved');
  assert.equal(resolveStateFrom(0, 0), 'unstarted');
});

test('summarizeDirectiveCells reports outstanding + done alongside the state', () => {
  const summary = summarizeDirectiveCells([
    cell('d', 'todo'),
    cell('d', 'blocked'),
    cell('d', 'done'),
    cell('d', 'n_a'),
  ]);
  assert.deepEqual(summary, { outstanding: 2, done: 1, resolveState: 'active' });
});

// -------------------------------------------------------------------------
// Spec §2.1 — THE VERBATIM GUARD. Every (state × filter) pair, with the
// load-bearing case called out explicitly.
// -------------------------------------------------------------------------
test('GUARD: unstarted stays VISIBLE under the default "open" filter', () => {
  assert.equal(matchesStatusFilter('unstarted', 'open'), true);
  // The whole point: `open` is NOT-resolved, not `=== active`. If someone
  // rewrites the predicate as state === 'active', this assertion fails.
  assert.equal(matchesStatusFilter('active', 'open'), true);
  assert.equal(matchesStatusFilter('resolved', 'open'), false);
});

test('matchesStatusFilter covers every (state × filter) pair', () => {
  const expected: Record<string, boolean> = {
    'active|open': true,
    'active|resolved': false,
    'active|all': true,
    'resolved|open': false,
    'resolved|resolved': true,
    'resolved|all': true,
    'unstarted|open': true, // the guard
    'unstarted|resolved': false,
    'unstarted|all': true,
  };
  // Exhaustive over the declared unions — a new state or filter that isn't
  // enumerated above makes this fail rather than silently going untested.
  let checked = 0;
  for (const state of DIRECTIVE_RESOLVE_STATES) {
    for (const filter of MATRIX_STATUS_FILTERS) {
      const key = `${state}|${filter}`;
      assert.equal(matchesStatusFilter(state, filter), expected[key], `mismatch for ${key}`);
      checked += 1;
    }
  }
  assert.equal(checked, Object.keys(expected).length);
});

// -------------------------------------------------------------------------
// Spec §1 — search.
// -------------------------------------------------------------------------
test('matchesSearch: case-insensitive substring, trimmed, blank matches all', () => {
  const title = '[Upsell] Clicks Submit CTA';
  assert.equal(matchesSearch(title, 'upsell'), true); // case-insensitive
  assert.equal(matchesSearch(title, 'SUBMIT'), true);
  assert.equal(matchesSearch(title, 'submit cta'), true); // multi-word substring
  assert.equal(matchesSearch(title, '  clicks  '), true); // trimmed
  assert.equal(matchesSearch(title, 'chat'), false);
  // Blank / whitespace-only → no filtering.
  assert.equal(matchesSearch(title, ''), true);
  assert.equal(matchesSearch(title, '   '), true);
});

// -------------------------------------------------------------------------
// Spec §3 — the paused-column transform.
// -------------------------------------------------------------------------
const BRANDS = [
  { brand_code: 'ASV', is_paused: false },
  { brand_code: 'MRR-CA', is_paused: true },
  { brand_code: 'MDG', is_paused: false },
  { brand_code: 'SHG', is_paused: true },
  { brand_code: 'WDG', is_paused: true },
];

test('visibleMatrixBrands drops paused when ON, keeps all when OFF, never mutates', () => {
  const before = BRANDS.map((b) => b.brand_code);

  assert.deepEqual(
    visibleMatrixBrands(BRANDS, true).map((b) => b.brand_code),
    ['ASV', 'MDG'],
  );
  assert.deepEqual(
    visibleMatrixBrands(BRANDS, false).map((b) => b.brand_code),
    before,
  );
  // Input untouched, and a fresh array is returned in both modes.
  assert.deepEqual(BRANDS.map((b) => b.brand_code), before);
  assert.notEqual(visibleMatrixBrands(BRANDS, false), BRANDS);
});

// -------------------------------------------------------------------------
// Spec §4 — sort, incl. the title tie-break in BOTH modes.
// -------------------------------------------------------------------------
const row = (id: string, title: string, outstanding: number): MatrixRow<{ id: string; title: string }> => ({
  directive: { id, title },
  outstanding,
  resolveState: outstanding > 0 ? 'active' : 'resolved',
});

test('compareMatrixRows: title A–Z; outstanding high→low; ties break by title in both', () => {
  const a = row('1', 'Alpha', 3);
  const b = row('2', 'Beta', 9);

  // Title mode ignores outstanding entirely.
  assert.ok(compareMatrixRows(a, b, 'title') < 0);
  assert.ok(compareMatrixRows(b, a, 'title') > 0);

  // Outstanding mode: 9 sorts before 3.
  assert.ok(compareMatrixRows(b, a, 'outstanding') < 0);
  assert.ok(compareMatrixRows(a, b, 'outstanding') > 0);

  // Equal outstanding → title decides (deterministic, not sort-stability luck).
  const tieZ = row('3', 'Zulu', 5);
  const tieA = row('4', 'Apple', 5);
  assert.ok(compareMatrixRows(tieA, tieZ, 'outstanding') < 0);
  assert.ok(compareMatrixRows(tieZ, tieA, 'outstanding') > 0);
  assert.equal(compareMatrixRows(tieA, tieA, 'outstanding'), 0);
});

// -------------------------------------------------------------------------
// Spec §5 — compose: search AND status AND sort together.
// -------------------------------------------------------------------------
const DIRECTIVES = [
  { id: 'd1', title: 'Submits Form Lead - Combined' }, // active, outstanding 2
  { id: 'd2', title: '[Upsell] Clicks Submit CTA' },   // resolved
  { id: 'd3', title: 'Chat Started' },                 // active, outstanding 5
  { id: 'd4', title: '[GTM] Submits Lead Combined' },  // unstarted (all n_a)
  { id: 'd5', title: 'Submits Quote Request' },        // resolved
];
const CELLS: MatrixCellLike[] = [
  cell('d1', 'todo'), cell('d1', 'blocked'), cell('d1', 'done'),
  cell('d2', 'done'), cell('d2', 'n_a'),
  cell('d3', 'todo'), cell('d3', 'todo'), cell('d3', 'todo'), cell('d3', 'in_progress'), cell('d3', 'blocked'),
  cell('d4', 'n_a'), cell('d4', 'n_a'),
  cell('d5', 'done'),
];
const controls = (over: Partial<MatrixControls> = {}): MatrixControls => ({
  search: '',
  statusFilter: 'open',
  sortKey: 'title',
  ...over,
});

test('buildMatrixRows: default (open + title) hides resolved, KEEPS unstarted, sorts A–Z', () => {
  const rows = buildMatrixRows(DIRECTIVES, CELLS, controls());
  assert.deepEqual(rows.map((r) => r.directive.id), ['d4', 'd3', 'd1']);
  assert.deepEqual(rows.map((r) => r.directive.title), [
    '[GTM] Submits Lead Combined', // unstarted — visible under the default (guard)
    'Chat Started',
    'Submits Form Lead - Combined',
  ]);
  // Rows carry the numbers the page renders, so the pill can't diverge.
  assert.equal(rows.find((r) => r.directive.id === 'd3')?.outstanding, 5);
  assert.equal(rows.find((r) => r.directive.id === 'd1')?.outstanding, 2);
  assert.equal(rows.find((r) => r.directive.id === 'd4')?.resolveState, 'unstarted');
});

test('buildMatrixRows: statusFilter resolved / all', () => {
  const resolved = buildMatrixRows(DIRECTIVES, CELLS, controls({ statusFilter: 'resolved' }));
  assert.deepEqual(resolved.map((r) => r.directive.id), ['d2', 'd5']);
  assert.ok(resolved.every((r) => r.resolveState === 'resolved'));

  const all = buildMatrixRows(DIRECTIVES, CELLS, controls({ statusFilter: 'all' }));
  assert.equal(all.length, 5);
});

test('buildMatrixRows: sort by outstanding high→low over the filtered set', () => {
  const rows = buildMatrixRows(DIRECTIVES, CELLS, controls({ sortKey: 'outstanding' }));
  assert.deepEqual(rows.map((r) => r.directive.id), ['d3', 'd1', 'd4']); // 5, 2, 0
  assert.deepEqual(rows.map((r) => r.outstanding), [5, 2, 0]);
});

test('buildMatrixRows: COMPOSE — search + status + sort apply together', () => {
  // Matching is a LITERAL substring, so "submits" matches d1 / d4 / d5 but NOT
  // d2 ("Clicks Submit CTA" — singular "Submit"). `all` keeps those three;
  // outstanding sort puts d1 (2) first, then the two zero rows by title.
  const rows = buildMatrixRows(
    DIRECTIVES,
    CELLS,
    controls({ search: 'SUBMITS', statusFilter: 'all', sortKey: 'outstanding' }),
  );
  assert.deepEqual(rows.map((r) => r.directive.title), [
    'Submits Form Lead - Combined',   // outstanding 2
    '[GTM] Submits Lead Combined',    // 0, title tie-break
    'Submits Quote Request',          // 0
  ]);

  // The singular stem widens the match to include d2 — pins that we do plain
  // substring matching, no stemming / word-boundary cleverness.
  const singular = buildMatrixRows(
    DIRECTIVES,
    CELLS,
    controls({ search: 'submit', statusFilter: 'all', sortKey: 'title' }),
  );
  assert.deepEqual(singular.map((r) => r.directive.id), ['d4', 'd2', 'd1', 'd5']);

  // Same "submits" search under the default `open` filter drops the resolved
  // row (d5) but KEEPS the unstarted one (d4) — compose respects the guard.
  const open = buildMatrixRows(DIRECTIVES, CELLS, controls({ search: 'submits' }));
  assert.deepEqual(open.map((r) => r.directive.id), ['d4', 'd1']);
});

test('buildMatrixRows: no match → empty array (the "no directives match" state)', () => {
  assert.deepEqual(buildMatrixRows(DIRECTIVES, CELLS, controls({ search: 'zzzz' })), []);
  // Every directive resolved → `resolved` filter is populated, `open` is empty.
  const allDone = [{ id: 'x', title: 'Only One' }];
  const doneCells: MatrixCellLike[] = [cell('x', 'done')];
  assert.deepEqual(buildMatrixRows(allDone, doneCells, controls()), []);
  assert.equal(buildMatrixRows(allDone, doneCells, controls({ statusFilter: 'resolved' })).length, 1);
});

test('buildMatrixRows on empty inputs returns []', () => {
  assert.deepEqual(buildMatrixRows([], [], controls()), []);
  assert.deepEqual(buildMatrixRows([], CELLS, controls()), []);
});

// -------------------------------------------------------------------------
// Karen MEDIUM-1 — countHiddenByStatus. Guards the "searched, found nothing,
// created a duplicate" false negative: the route has no duplicate-title check
// and (project_key, title) has no unique constraint, so a silent miss is
// expensive.
// -------------------------------------------------------------------------
test('countHiddenByStatus: counts search matches the status filter excluded', () => {
  // "submits" matches d1 (active), d4 (unstarted), d5 (resolved). Under the
  // default `open` filter only d5 is hidden → 1.
  assert.equal(countHiddenByStatus(DIRECTIVES, CELLS, controls({ search: 'submits' })), 1);

  // The load-bearing case: a search that shows ZERO rows while a resolved
  // directive matches. Without this signal the admin concludes it doesn't exist.
  assert.equal(buildMatrixRows(DIRECTIVES, CELLS, controls({ search: 'Quote' })).length, 0);
  assert.equal(countHiddenByStatus(DIRECTIVES, CELLS, controls({ search: 'Quote' })), 1);

  // Under `resolved`, the active/unstarted matches are the hidden ones.
  assert.equal(
    countHiddenByStatus(DIRECTIVES, CELLS, controls({ search: 'submits', statusFilter: 'resolved' })),
    2, // d1 active + d4 unstarted
  );
});

test('countHiddenByStatus: 0 under "all", and 0 when nothing matches the search', () => {
  // `all` hides nothing by status, by definition.
  assert.equal(countHiddenByStatus(DIRECTIVES, CELLS, controls({ statusFilter: 'all' })), 0);
  assert.equal(
    countHiddenByStatus(DIRECTIVES, CELLS, controls({ search: 'submits', statusFilter: 'all' })),
    0,
  );
  // A search matching nothing has nothing to hide — the hint must not fire.
  assert.equal(countHiddenByStatus(DIRECTIVES, CELLS, controls({ search: 'zzzz' })), 0);

  // BLANK search counts every status-excluded directive (a blank query matches
  // all — see matchesSearch). That is DELIBERATE and must not be "fixed" to 0:
  // the zero-row empty state uses this to say "N are hidden by the status
  // filter" when no search is active. The search-worded HINT is gated in the UI
  // on a non-empty search instead (Karen LOW-6) — presentation is gated there,
  // not here, so the count stays a single honest number with one meaning.
  assert.equal(countHiddenByStatus(DIRECTIVES, CELLS, controls()), 2);
});

test('countHiddenByStatus + buildMatrixRows partition the search matches', () => {
  // Invariant: shown + hidden === total search matches, for every filter.
  const search = 'submit'; // singular → matches d1, d2, d4, d5
  const totalMatches = buildMatrixRows(
    DIRECTIVES,
    CELLS,
    controls({ search, statusFilter: 'all' }),
  ).length;
  assert.equal(totalMatches, 4);
  for (const statusFilter of MATRIX_STATUS_FILTERS) {
    const shown = buildMatrixRows(DIRECTIVES, CELLS, controls({ search, statusFilter })).length;
    const hidden = countHiddenByStatus(DIRECTIVES, CELLS, controls({ search, statusFilter }));
    assert.equal(shown + hidden, totalMatches, `partition broken for ${statusFilter}`);
  }
});

// -------------------------------------------------------------------------
// Spec §3.1 — Outstanding is structurally independent of the column toggle.
// This is the assertion that would catch someone "helpfully" feeding the
// visible-brand subset into the row pipeline.
// -------------------------------------------------------------------------
test('Outstanding counts a PAUSED brand cell and is unaffected by column filtering', () => {
  const brands = [
    { id: 'bActive', brand_code: 'ASV', is_paused: false },
    { id: 'bPaused', brand_code: 'MRR-CA', is_paused: true },
  ];
  const directives = [{ id: 'd1', title: 'Some directive' }];
  // A brand paused AFTER the directive was created can still hold an owed
  // status — the count includes it, by design (excluding it would change
  // reported data, which this render batch deliberately does not do).
  const cells: MatrixCellLike[] = [cell('d1', 'todo'), cell('d1', 'todo')];

  const rows = buildMatrixRows(directives, cells, controls());
  assert.equal(rows[0].outstanding, 2);

  // Hiding the paused column changes the rendered brand axis and NOTHING else:
  // buildMatrixRows takes no hidePaused argument, so it cannot be influenced.
  assert.equal(visibleMatrixBrands(brands, true).length, 1);
  const afterHide = buildMatrixRows(directives, cells, controls());
  assert.equal(afterHide[0].outstanding, rows[0].outstanding);
  assert.equal(afterHide[0].resolveState, rows[0].resolveState);
});

// -------------------------------------------------------------------------
// countHiddenOwedCells — the runtime guard behind hide-paused defaulting to
// CHECKED (2026-07-31). Prod says 0 owed on paused brands today, but the status
// PATCH route never consults is_paused, so an ordinary admin edit can break that.
// These pin that the guard actually fires when it does.
// -------------------------------------------------------------------------
const GUARD_BRANDS = [
  { id: 'bActive', is_paused: false },
  { id: 'bPaused', is_paused: true },
  { id: 'bPaused2', is_paused: true },
];

test('countHiddenOwedCells is 0 in the normal case: paused cells are all n_a', () => {
  const cells = [
    { brand_id: 'bPaused', status: 'n_a' as CellStatus },
    { brand_id: 'bPaused2', status: 'n_a' as CellStatus },
    { brand_id: 'bActive', status: 'todo' as CellStatus }, // owed, but VISIBLE
  ];
  assert.equal(countHiddenOwedCells(GUARD_BRANDS, cells, true), 0);
});

test('countHiddenOwedCells FIRES when a paused brand holds owed work', () => {
  // The scenario the guard exists for: an admin sets a paused brand's cell to
  // Blocked from the brand page (nothing rejects it), so Outstanding counts a
  // cell whose column is hidden.
  const cells = [
    { brand_id: 'bPaused', status: 'blocked' as CellStatus },
    { brand_id: 'bPaused', status: 'n_a' as CellStatus },
    { brand_id: 'bPaused2', status: 'in_progress' as CellStatus },
    { brand_id: 'bPaused2', status: 'done' as CellStatus }, // done does not owe
    { brand_id: 'bActive', status: 'todo' as CellStatus }, // visible, not counted here
  ];
  assert.equal(countHiddenOwedCells(GUARD_BRANDS, cells, true), 2);
});

test('countHiddenOwedCells is 0 when nothing is hidden, or no brand is paused', () => {
  const cells = [{ brand_id: 'bPaused', status: 'blocked' as CellStatus }];
  // hidePaused off → the column is on screen, so there is nothing to warn about.
  assert.equal(countHiddenOwedCells(GUARD_BRANDS, cells, false), 0);
  // No paused brands at all (e.g. SPLCRO) → the toggle isn't even rendered.
  assert.equal(
    countHiddenOwedCells([{ id: 'bActive', is_paused: false }], cells, true),
    0,
  );
  assert.equal(countHiddenOwedCells([], [], true), 0);
});

test('countHiddenOwedCells agrees with outstandingCount about what "owed" means', () => {
  // It must not fork the owed set — todo/in_progress/blocked owe, done/n_a do not.
  for (const status of CELL_STATUSES) {
    const owes = countHiddenOwedCells(
      [{ id: 'b', is_paused: true }],
      [{ brand_id: 'b', status }],
      true,
    );
    assert.equal(
      owes,
      outstandingCount([{ status }]),
      `disagreement on ${status}`,
    );
  }
});
