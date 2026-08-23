import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  MATRIX_SKIP_TARGET_ID,
  MATRIX_SKIP_LINK_LABEL,
  MATRIX_FOCUS_REGIONS,
  focusSequence,
  gridTabStopCount,
  shouldRenderSkipLink,
  skipLinkTarget,
  stopsBypassedBySkipLink,
  type MatrixFocusState,
} from '../lib/client-library/focus-order';

// The loaded, project-selected, grid-rendering, read-only default. Every case
// below is a deviation from this one, so a reader can see exactly which field is
// under test.
const base: MatrixFocusState = {
  loading: false,
  projectKey: 'NBLYCRO',
  gridRendered: true,
  hasFindings: false,
  isAdmin: false,
  visibleBrandCount: 13,
  renderedDirectiveCount: 84,
};

const s = (over: Partial<MatrixFocusState>): MatrixFocusState => ({ ...base, ...over });

// -------------------------------------------------------------------------
// Spec §3.3 — the skip link renders only when the grid renders.
// -------------------------------------------------------------------------
test('§3.3 skip link renders on the loaded grid', () => {
  assert.equal(shouldRenderSkipLink(base), true);
});

test('§3.3 no skip link while loading', () => {
  assert.equal(shouldRenderSkipLink(s({ loading: true })), false);
});

test('§3.3 no skip link before a project is picked', () => {
  assert.equal(shouldRenderSkipLink(s({ projectKey: null })), false);
  assert.equal(shouldRenderSkipLink(s({ projectKey: '' })), false);
});

test('§3.3 no skip link on the empty state (PART A)', () => {
  // PART A has its own buttons — "Show paused", "Show archived", "Clear all
  // filters" — and no grid. A skip link here would offer to skip past controls
  // the user needs, to a grid that is not on the page.
  assert.equal(shouldRenderSkipLink(s({ gridRendered: false })), false);
});

test('§3.3 loading wins even with a grid flagged', () => {
  // The two negatives are independent in the page, so neither may mask the other.
  assert.equal(shouldRenderSkipLink(s({ loading: true, gridRendered: true })), false);
});

// -------------------------------------------------------------------------
// Spec §3.2 — the target does not track hasFindings.
//
// ⚠ WHAT IS NOT TESTED HERE, AND WHY. The first draft asserted "link and target
// are present or absent together" over all 32 states via a
// `shouldRenderSkipTarget` helper. Both sides reduced to the same expression, so
// the test could not fail while looking like it covered the headline invariant.
// Karen caught it; the helper is gone. The real guarantee is that page.tsx gates
// both JSX sites on ONE const — structural, and not reachable from a unit test.
// Stated rather than papered over with a passing assertion.
// -------------------------------------------------------------------------
test('§3.2 the target does NOT depend on hasFindings', () => {
  // The quiet path is the majority path. An anchor gated on the findings panel
  // would send focus nowhere exactly when the page is calmest.
  assert.equal(skipLinkTarget(s({ hasFindings: false })), MATRIX_SKIP_TARGET_ID);
  assert.equal(skipLinkTarget(s({ hasFindings: true })), MATRIX_SKIP_TARGET_ID);
});

test('§3.2 target id is a single shared constant', () => {
  assert.equal(MATRIX_SKIP_TARGET_ID, 'matrix-end');
  assert.equal(skipLinkTarget(base), MATRIX_SKIP_TARGET_ID);
  assert.equal(skipLinkTarget(s({ gridRendered: false })), null);
});

test('label is the spec §3.1 wording', () => {
  assert.equal(MATRIX_SKIP_LINK_LABEL, 'Skip the directive matrix');
});

// -------------------------------------------------------------------------
// Spec §3.4 / §1 — the tab-stop count, including the term every prior count
// missed.
// -------------------------------------------------------------------------
test('§1 read-only default view: cells + brand headers', () => {
  // 84 x 13 = 1,092 cells, + 13 brand headers = 1,105. Probed 2026-08-23.
  assert.equal(gridTabStopCount(base), 1105);
});

test('§1 brand headers are counted — they are real buttons and they DO cost stops', () => {
  const cellsOnly = base.renderedDirectiveCount * base.visibleBrandCount;
  assert.equal(gridTabStopCount(base) - cellsOnly, base.visibleBrandCount);
});

test('§1 paused shown: 84 x 16 + 16', () => {
  assert.equal(gridTabStopCount(s({ visibleBrandCount: 16 })), 84 * 16 + 16);
});

test('§1 admin adds one stop per rendered row, read-only adds none', () => {
  const readOnly = gridTabStopCount(base);
  const admin = gridTabStopCount(s({ isAdmin: true }));
  assert.equal(admin - readOnly, base.renderedDirectiveCount);
});

test('no grid, no stops', () => {
  assert.equal(gridTabStopCount(s({ gridRendered: false })), 0);
  assert.equal(gridTabStopCount(s({ gridRendered: false, isAdmin: true })), 0);
});

test('an empty project does not produce phantom stops', () => {
  // A project with no directives still renders its brand columns.
  assert.equal(gridTabStopCount(s({ renderedDirectiveCount: 0 })), 13);
  assert.equal(gridTabStopCount(s({ renderedDirectiveCount: 0, visibleBrandCount: 0 })), 0);
});

// -------------------------------------------------------------------------
// Spec §3.4 — the orderings that are the whole point of the module.
// -------------------------------------------------------------------------
test('§3.4 skip-link precedes grid, matrix-end follows it', () => {
  const seq = focusSequence(base);
  const link = seq.indexOf('skip-link');
  const grid = seq.indexOf('grid');
  const end = seq.indexOf('matrix-end');
  assert.ok(link >= 0 && grid >= 0 && end >= 0, 'all three regions present');
  assert.ok(link < grid, 'skip link must come BEFORE the grid or it saves nothing');
  assert.ok(grid < end, 'the anchor must come AFTER the grid');
});

test('§3.4 skip link precedes the first brand header, which opens the grid', () => {
  // The 13 brand headers are the first focusables inside `grid`, so "before the
  // grid" is the assertion that clears them in the same press.
  const seq = focusSequence(base);
  assert.ok(seq.indexOf('skip-link') < seq.indexOf('grid'));
});

test('§3.4 needs-action follows matrix-end when findings exist', () => {
  const seq = focusSequence(s({ hasFindings: true }));
  assert.ok(seq.indexOf('matrix-end') < seq.indexOf('needs-action'));
});

test('§3.4 no findings: matrix-end is the last region', () => {
  const seq = focusSequence(base);
  assert.equal(seq[seq.length - 1], 'matrix-end');
  assert.equal(seq.includes('needs-action'), false);
});

test('§3.4 no grid: no skip link, no grid region, no anchor', () => {
  // ⚠ `gridRendered: false` covers TWO page states with DIFFERENT focus content,
  // and this test deliberately asserts only what is true of both. page.tsx
  // suppresses the whole controls bar when `visibleDirectives.length === 0`
  // (project genuinely has none) but RENDERS it when `matrixRows.length === 0`
  // (filters hid everything). The first draft pinned `['page-controls',
  // 'filter-bar']` for the flag as a whole, which is wrong for the first of
  // those. Karen caught it. `filter-bar` is out of scope for this module until
  // the flag is split — what matters here is that the skip link, the grid and
  // the anchor are all absent.
  const seq = focusSequence(s({ gridRendered: false }));
  assert.equal(seq.includes('skip-link'), false);
  assert.equal(seq.includes('grid'), false);
  assert.equal(seq.includes('matrix-end'), false);
  assert.equal(seq[0], 'page-controls');
});

test('§3.4 loading: page controls only', () => {
  assert.deepEqual(focusSequence(s({ loading: true })), ['page-controls']);
  assert.deepEqual(focusSequence(s({ projectKey: null })), ['page-controls']);
});

test('§3.4 every emitted region is a declared region, in declared order', () => {
  for (const state of [base, s({ hasFindings: true }), s({ gridRendered: false }), s({ loading: true })]) {
    const seq = focusSequence(state);
    for (const region of seq) {
      assert.ok(MATRIX_FOCUS_REGIONS.includes(region), `undeclared region ${region}`);
    }
    const positions = seq.map((r) => MATRIX_FOCUS_REGIONS.indexOf(r));
    const sorted = [...positions].sort((a, b) => a - b);
    assert.deepEqual(positions, sorted, `out of declared order: ${seq.join(' > ')}`);
  }
});

// -------------------------------------------------------------------------
// The link has to be worth pressing.
// -------------------------------------------------------------------------
test('the skip link bypasses the whole grid, and nothing when absent', () => {
  assert.equal(stopsBypassedBySkipLink(base), 1105);
  assert.equal(stopsBypassedBySkipLink(s({ gridRendered: false })), 0);
});

test('a skip link that saves nothing is a defect', () => {
  // The ASSERTION is ">1", not a total: like for like, the default view went
  // 1,118 (08-14, 86 rows) -> 1,092 (08-23, 84 rows), and a hardcoded total
  // would fail on real data movement. The 1,105 above is a FIXTURE, not a live
  // figure — it pins the arithmetic, not the state of prod.
  assert.ok(stopsBypassedBySkipLink(base) > 1, 'skip link must bypass more than one stop');
});
