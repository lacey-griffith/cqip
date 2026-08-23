// Batch G7 — grid tab-stop burden: the skip-the-matrix link and the focus order
// it exists to shortcut. Pure, side-effect-free logic so tests/focus-order.test.ts
// can pin rules that would otherwise only be verifiable by pressing Tab in a
// browser. Mirrors the lib/client-library/{directives,pulse,monitoring,
// matrix-controls}.ts split — logic in lib, page + tests import it.
//
// See docs/specs/batch-g7-tab-stops.md. §3.4 is the contract this module owes.
//
// ⚠ WHAT THIS MODULE CANNOT DO, stated here rather than discovered later
// (spec §5). It models focus ORDER. It does not press Tab, and no test over it
// can observe a browser moving focus. A `sr-only` class that fails to un-hide on
// :focus, or a target with `display: none`, satisfies every assertion in
// tests/focus-order.test.ts and still fails the user. Acceptance items 1-3 in
// the spec are MANUAL for exactly that reason. Do not add a comment elsewhere
// claiming this module covers the keyboard path.

// -------------------------------------------------------------------------
// The skip target.
//
// A shared const rather than a string literal at each site, because the link's
// href/handler and the anchor's id going out of step is a silent failure: focus
// simply does not move, and nothing throws. One source, two importers.
// -------------------------------------------------------------------------
export const MATRIX_SKIP_TARGET_ID = 'matrix-end';

export const MATRIX_SKIP_LINK_LABEL = 'Skip the directive matrix';

// -------------------------------------------------------------------------
// The state the page already has. No fetch, no route, no schema — every field
// here is something app/dashboard/pulse/page.tsx has computed before it renders.
// -------------------------------------------------------------------------
export interface MatrixFocusState {
  /** Page is still fetching. PART A/B have not resolved yet. */
  loading: boolean;
  /** null / '' before a project is picked. */
  projectKey: string | null;
  /**
   * PART B (the `max-h-[65vh] overflow-auto` scroll region) is what renders.
   * False on the empty state (PART A), which has its own buttons and no grid.
   */
  gridRendered: boolean;
  /** The "Needs action" section renders only when there are open findings. */
  hasFindings: boolean;
  isAdmin: boolean;
  /** Brands actually rendered as columns — excludes paused unless shown. */
  visibleBrandCount: number;
  /** Directive rows actually rendered — excludes archived and filtered-out. */
  renderedDirectiveCount: number;
}

// -------------------------------------------------------------------------
// Spec §3.3 — the skip link renders only when the grid renders.
//
// Three negative cases, and they are not redundant. `loading` and "no project"
// both precede a grid, but they are separate states in the page and either can
// hold without the other. `gridRendered` false with a project selected and
// loading finished is the empty state, which is the one a reader is most likely
// to forget: PART A has focusable buttons of its own ("Show paused", "Show
// archived", "Clear all filters"), so a skip link there would offer to skip past
// controls the user needs and a grid that is not on the page.
// -------------------------------------------------------------------------
export function shouldRenderSkipLink(state: MatrixFocusState): boolean {
  if (state.loading) return false;
  if (!state.projectKey) return false;
  if (!state.gridRendered) return false;
  return true;
}

// -------------------------------------------------------------------------
// Spec §3.2 — the anchor is present whenever the link is.
//
// Deliberately NOT gated on `hasFindings`. The "Needs action" section is
// conditional and absent on the quiet path, which is the majority path; an
// anchor that tracked it would send focus nowhere exactly when the page is
// calmest. The anchor is the target, the findings panel is merely what usually
// follows it.
//
// Returns null rather than throwing when there is no link, so a caller can
// render both from one call and the invariant is expressible as an equality
// rather than as a try/catch.
// -------------------------------------------------------------------------
export function skipLinkTarget(state: MatrixFocusState): string | null {
  return shouldRenderSkipLink(state) ? MATRIX_SKIP_TARGET_ID : null;
}

// ⚠ THERE IS DELIBERATELY NO `shouldRenderSkipTarget()` HERE.
//
// The first draft had one, defined as `skipLinkTarget(state) !== null`, plus a
// 32-state exhaustive test asserting it agreed with shouldRenderSkipLink(). That
// test presented itself as covering this batch's headline invariant and COULD NOT
// FAIL — the two were the same expression. Karen caught it.
//
// What actually guarantees link and target render together is not in this file:
// it is that app/dashboard/pulse/page.tsx computes ONE `showMatrixSkipLink`
// const and gates both JSX sites on it. A second predicate here would only have
// added a way for them to disagree. Removed rather than kept as ceremony.

// -------------------------------------------------------------------------
// Tab stops inside the grid — the quantity G7 is about.
//
// THREE contributors, and the second is the one every prior count missed:
//
//   cells          renderedDirectives x visibleBrands
//   brand headers  one per visible brand. They ARE real buttons and they DO
//                  cost a stop; the 2026-08-03 handoff asked for confirmation
//                  that they add none and the honest answer was that they add
//                  13. They sit at the top of the grid, so the skip link clears
//                  them in the same press.
//   row buttons    admins only, one per rendered row (the directive editor).
//                  The G7 population is the read-only viewer, so this term is
//                  zero in the figure the spec quotes — but a count that
//                  silently omitted it would understate the admin path.
//
// ⚠ Callers must pass FRESHLY PROBED counts (§13 r43). Every figure written into
// a doc about this grid has been wrong by the next probe. LIKE FOR LIKE, default
// view (active directives x 13 visible brands):
//
//     1,118  2026-08-14   86 directives
//     1,092  2026-08-23   84 directives
//
// A net drop of 26 stops = 2 rendered rows. The row count did NOT fall
// monotonically: 86 (08-14) -> 87 (08-18, one created) -> 84 (08-23, three
// archived). Do not hardcode a total anywhere.
//
// ⚠ AND DO NOT SPLICE THE PAUSED-SHOWN SERIES INTO THAT ONE. The often-quoted
// 1,312 (07-31) and 1,376 (08-14) are `x 16`, not `x 13`, and 1,377 is the
// rendered-CELL count at 08-14 (86 x 16 + 1) — a third quantity again. Karen
// caught this batch's first draft doing exactly that splice and reading a
// 3-directive cause off a 2-row delta.
// -------------------------------------------------------------------------
export function gridTabStopCount(state: MatrixFocusState): number {
  if (!state.gridRendered) return 0;
  const cells = state.renderedDirectiveCount * state.visibleBrandCount;
  const brandHeaders = state.visibleBrandCount;
  const rowButtons = state.isAdmin ? state.renderedDirectiveCount : 0;
  return cells + brandHeaders + rowButtons;
}

// -------------------------------------------------------------------------
// The ordered regions a Tab press walks. Coarse by design: this is the sequence
// the skip link has to sit correctly inside, not an enumeration of every
// control. Finer granularity would make the test a transcription of the JSX and
// it would fail on every unrelated filter change.
//
// `skip-link` MUST precede `grid`, and `matrix-end` MUST follow it. That pair of
// orderings is the whole point of the module.
// -------------------------------------------------------------------------
export const MATRIX_FOCUS_REGIONS = [
  'page-controls',
  'filter-bar',
  'skip-link',
  'grid',
  'matrix-end',
  'needs-action',
] as const;

export type MatrixFocusRegion = (typeof MATRIX_FOCUS_REGIONS)[number];

export function focusSequence(state: MatrixFocusState): MatrixFocusRegion[] {
  const seq: MatrixFocusRegion[] = ['page-controls'];
  if (state.loading || !state.projectKey) return seq;

  seq.push('filter-bar');

  if (shouldRenderSkipLink(state)) {
    seq.push('skip-link', 'grid', 'matrix-end');
  }

  if (state.hasFindings) seq.push('needs-action');
  return seq;
}

// -------------------------------------------------------------------------
// What the skip link buys, in stops. Reported rather than asserted against a
// constant, so a shrinking grid does not fail a test — only a skip link that
// saves nothing should.
// -------------------------------------------------------------------------
export function stopsBypassedBySkipLink(state: MatrixFocusState): number {
  return shouldRenderSkipLink(state) ? gridTabStopCount(state) : 0;
}
