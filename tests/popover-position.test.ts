import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computePopoverPosition, POPOVER_GAP } from '../lib/ui/popover-position';

// Batch logs-page — Lacey smoke test 4 (brand dropdown panel clipped).
//
// The defect was NOT filtering and NOT B3's spacing: `overflow-hidden` on the
// collapsible filter body is pre-existing (f2f9511^:550) and load-bearing for the
// grid-rows collapse animation. The panel simply could not escape it, because it
// was `absolute` in-flow while its sibling controls (Severity, Status) render
// through Radix's Portal. This pins the placement maths for the portalled panel.

const PANEL = 240;
const trigger = (top: number, height = 40, left = 100, width = 200) => ({
  top,
  bottom: top + height,
  left,
  width,
});

test('opens BELOW the trigger when there is room', () => {
  const p = computePopoverPosition(trigger(100), 800, PANEL);
  assert.equal(p.placement, 'below');
  assert.equal(p.top, 140 + POPOVER_GAP);
});

test('flips ABOVE when the panel would not fit below and there is more room above', () => {
  // Trigger near the bottom: 700→740 in an 800px viewport leaves 56px below.
  const p = computePopoverPosition(trigger(700), 800, PANEL);
  assert.equal(p.placement, 'above');
  assert.equal(p.top, 700 - POPOVER_GAP - PANEL);
});

test('does NOT flip when below is tight but above is tighter', () => {
  // Both halves of the condition matter: flipping to the side with LESS room
  // would be strictly worse than staying put and letting max-height bound it.
  const p = computePopoverPosition(trigger(20), 300, PANEL);
  assert.equal(p.placement, 'below', 'above has only 20px — staying below is correct');
});

test('a flipped panel is never positioned off the top of the viewport', () => {
  // Unreachable-entirely is worse than partially-clipped. Clamped at 0.
  const p = computePopoverPosition(trigger(120), 200, PANEL);
  if (p.placement === 'above') {
    assert.ok(p.top >= 0, `flipped panel must not go negative, got ${p.top}`);
  }
  // And whichever way it goes, the top is on screen.
  assert.ok(p.top >= 0);
});

test('width and left track the trigger, so the panel still reads as belonging to it', () => {
  const p = computePopoverPosition(trigger(100, 40, 250, 320), 800, PANEL);
  assert.equal(p.left, 250);
  assert.equal(p.width, 320);
});

test('an exact fit below does not flip — the > vs >= boundary', () => {
  // ⚠ THIS TEST WAS WEAK AND A MUTATION CAUGHT IT — §13 r38 mechanism (c),
  // UNDER-CONSTRAINED FIXTURE. Worth classifying precisely, because it is NOT the
  // source-shape cause r38's other two instances share: this was already a
  // behavioural test over a pure function, with the RIGHT oracle. The fixture
  // simply could not discriminate.
  //
  // The first version used trigger(100) in a viewport of 140+GAP+PANEL, which
  // makes spaceBelow exactly PANEL — but ALSO makes spaceAbove only 96. The flip
  // condition is `panelHeight > spaceBelow && spaceAbove > spaceBelow`, so the
  // second half was false either way and `>` vs `>=` was never exercised. It
  // passed under both. Testing behaviour through a pure function is necessary and
  // was not sufficient; the inputs have to reach the branch as well.
  //
  // To reach the boundary, spaceAbove must EXCEED spaceBelow while spaceBelow
  // equals panelHeight exactly:
  //   trigger.top 300, height 40  → spaceAbove = 296
  //   viewport 584                → spaceBelow = 584 - 340 - 4 = 240 = PANEL
  // Now `>` stays below and `>=` flips, so the assertion can tell them apart.
  const p = computePopoverPosition(trigger(300), 584, PANEL);
  assert.equal(p.placement, 'below', 'a panel that exactly fits below must not flip');
});

// ── Wiring ──
//
// The maths above is worthless if the component does not portal, or portals and
// then closes itself on the first click inside the panel.
//
// ⚠ THESE ARE SOURCE-SHAPE ASSERTIONS, WHICH §13 r38 NAMES AS A DEFECT SOURCE.
// Kept deliberately, under r38's own exemption — "where a source assertion is
// genuinely the only reach (wiring), keep it NARROW" — because this repo has no
// DOM/React test harness, so `createPortal`, the outside-click handler and the
// scroll listener cannot be exercised behaviourally at all.
//
// What r38 forbids is the WHOLE-EXPRESSION pin that froze a defect earlier in this
// batch. Each assertion below matches a SINGLE token whose absence is the defect —
// `panelRef.current?.contains`, the capture-phase `true`, `createPortal(` — never a
// complete statement, so a correct change beside them cannot fail, and a wrong
// thing appended beside them cannot pass unnoticed the way the `...log,`
// presence-check did. The VALUES they wire are covered behaviourally above.

const COMBOBOX = readFileSync(join(process.cwd(), 'components/ui/combobox.tsx'), 'utf8');

test('the panel is rendered through a portal, not absolutely inside the trigger', () => {
  assert.ok(/createPortal\(/.test(COMBOBOX), 'panel must portal out of clipping ancestors');
  assert.ok(/document\.body/.test(COMBOBOX));
  assert.ok(
    !/className="absolute z-50 mt-1 w-full/.test(COMBOBOX),
    'the in-flow absolute panel is the clipped version',
  );
});

test('outside-click checks the PANEL as well as the trigger', () => {
  // The trap this fix creates: a portalled panel is a child of <body>, so a
  // containment check against the trigger's root alone treats every click inside
  // the open panel — the search box, every option — as an outside click, closing
  // it instantly and making the control unusable.
  const start = COMBOBOX.indexOf('function onClick(e: MouseEvent)');
  assert.ok(start > 0, 'could not locate the outside-click handler');
  const fn = COMBOBOX.slice(start, COMBOBOX.indexOf('}', COMBOBOX.indexOf('setOpen(false)', start)));
  assert.ok(/panelRef\.current\?\.contains/.test(fn), 'must consult panelRef');
  assert.ok(/rootRef\.current\?\.contains/.test(fn), 'must still consult rootRef');
});

test('position is recomputed on scroll and resize, with capture for ancestor scroll', () => {
  // A fixed panel does not move with the page, so without this it detaches from
  // its trigger the moment anything scrolls. Capture-phase catches scrolling
  // inside ancestors (the filter card, the dialog body), not just the window.
  assert.ok(/addEventListener\('scroll', measure, true\)/.test(COMBOBOX), 'capture-phase scroll');
  assert.ok(/addEventListener\('resize', measure\)/.test(COMBOBOX));
  assert.ok(/removeEventListener\('scroll', measure, true\)/.test(COMBOBOX), 'and removed');
});
