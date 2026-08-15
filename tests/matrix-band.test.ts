import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  BAND_CROSSHAIR,
  BAND_HIGHLIGHT,
  BAND_NONE,
  BAND_SURFACE,
  cellBandClass,
  headerBandClass,
} from '../lib/client-library/matrix-band';

// Batch 012 — Pulse matrix, Part C. The clicked-column highlight has to coexist
// with the batch-3 hover/focus crosshair, which already bands a column with
// --f92-tint. These pin the two properties that a ternary in JSX would let slip
// silently past tsc, ESLint and the build.

test('precedence: the deliberate highlight beats the transient crosshair', () => {
  // The case that matters — pointer sweeping down the column the user pinned.
  // Reversed, the column would appear to flicker between two treatments under
  // the user's own hand.
  assert.equal(
    cellBandClass({ highlighted: true, crosshair: true }),
    BAND_HIGHLIGHT,
    'a highlighted cell must not lose its band to the crosshair',
  );
  assert.equal(
    headerBandClass({ highlighted: true, crosshair: true }),
    BAND_HIGHLIGHT,
    'and the header must agree with its own column',
  );
});

test('each state alone paints its own band', () => {
  assert.equal(cellBandClass({ highlighted: true, crosshair: false }), BAND_HIGHLIGHT);
  assert.equal(cellBandClass({ highlighted: false, crosshair: true }), BAND_CROSSHAIR);
  assert.equal(headerBandClass({ highlighted: true, crosshair: false }), BAND_HIGHLIGHT);
  assert.equal(headerBandClass({ highlighted: false, crosshair: true }), BAND_CROSSHAIR);
});

// THE FALLBACKS DIFFER, AND THE DIFFERENCE IS LOAD-BEARING IN BOTH DIRECTIONS.
// A sticky header (Part B) with a transparent fallback lets body rows scroll
// visibly through it. A body cell with an opaque fallback would paint over the
// row band beneath it, breaking the crosshair's horizontal axis. Neither is a
// default anyone should "unify".
test('the unbanded fallback differs between header and body, deliberately', () => {
  assert.equal(
    headerBandClass({ highlighted: false, crosshair: false }),
    BAND_SURFACE,
    'a sticky header must be opaque or rows scroll through it',
  );
  assert.equal(
    cellBandClass({ highlighted: false, crosshair: false }),
    BAND_NONE,
    'a body cell must stay transparent or it paints over the row band',
  );
  assert.notEqual(BAND_SURFACE, BAND_NONE);
});

// EXACTLY ONE CLASS, EVERY TIME. Every candidate is a plain `bg-*` utility at
// specificity (0,1,0), so two present at once would be resolved by Tailwind's
// EMISSION ORDER in the built stylesheet — not by the order written in the
// className, and not by anything visible in the source. Returning a joined pair
// would look correct in review and be decided by the bundler.
test('never returns more than one background class', () => {
  for (const highlighted of [true, false]) {
    for (const crosshair of [true, false]) {
      for (const fn of [headerBandClass, cellBandClass]) {
        const out = fn({ highlighted, crosshair });
        const classes = out.split(/\s+/).filter(Boolean);
        assert.ok(
          classes.length <= 1,
          `${fn.name}({highlighted:${highlighted},crosshair:${crosshair}}) returned ${classes.length}: "${out}"`,
        );
      }
    }
  }
});

// The three tokens must stay distinct. The highlight exists precisely BECAUSE
// reusing --f92-tint would make a deliberate persistent state indistinguishable
// from transient pointer feedback; if someone ever points them at the same token
// the feature silently stops being a feature while every other test still passes.
test('the three bands are three different tokens', () => {
  const all = [BAND_HIGHLIGHT, BAND_CROSSHAIR, BAND_SURFACE];
  assert.equal(new Set(all).size, 3, 'highlight, crosshair and surface must not collapse');
  assert.match(BAND_HIGHLIGHT, /--pulse-col-highlight/);
  assert.match(BAND_CROSSHAIR, /--f92-tint/);
  // BAND_SURFACE NEEDS ITS OWN ANCHOR (Karen LOW-1). Without this line the only
  // constraints on it are `notEqual(BAND_SURFACE, BAND_NONE)` and set
  // cardinality — both of which `'bg-transparent'` satisfies, and
  // `'bg-transparent'` IS the Part B breakage: a sticky header that body rows
  // scroll straight through. Mutating the value survived the entire file. The
  // property this module's own comment calls load-bearing was the one property
  // nothing tested, because its oracle was itself (§13 r38).
  assert.match(BAND_SURFACE, /--f92-surface/);
});
