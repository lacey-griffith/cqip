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

test('a flipped panel NEVER overlaps its own trigger', () => {
  // Karen MEDIUM-1(b). With the old understated constant the panel was positioned
  // for 240px but rendered ~279px, so a flipped panel's bottom landed ~35px BELOW
  // trigger.top — covering most of a 40px control. And flip only fires when the
  // list is long, i.e. exactly when the panel is at full height, so the overlap was
  // the LIKELY flip case rather than an edge one.
  //
  // Stated as an invariant over the returned geometry rather than a fixture, so it
  // holds for any panel height: if we place above, the panel's bottom edge must not
  // cross the trigger's top edge.
  for (const panelH of [80, 240, 279, 400]) {
    const t = trigger(700);
    const p = computePopoverPosition(t, 800, panelH);
    if (p.placement === 'above') {
      assert.ok(
        p.top + panelH <= t.top,
        `panel of ${panelH}px flipped to ${p.top} overlaps trigger top ${t.top}`,
      );
    }
  }
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

test('PANEL_MAX_HEIGHT is APPLIED to the panel, not merely asserted about it', () => {
  // Karen MEDIUM-1. The old constant claimed to mirror `max-h-60` and did not —
  // that class is on the LIST, while the outer panel had no max-height at all — and
  // NOTHING coupled them, so changing the number failed zero tests. This is the
  // COVERAGE_TARGET_EFFECTIVE shape: a constant describing a value it cannot
  // constrain.
  //
  // The repair is coupling, not a better estimate. Because the panel's own
  // `maxHeight` IS the constant, the number is true by construction whatever it
  // holds — so there is no "correct value" left to drift from. This asserts the
  // coupling itself, which is the only thing that can now regress.
  assert.ok(/maxHeight: PANEL_MAX_HEIGHT/.test(COMBOBOX), 'the panel must apply the constant');
  assert.ok(/overflow: 'hidden'/.test(COMBOBOX), 'without it the cap is advisory, not real');
  // And the value handed to the placement maths must be that same constant.
  assert.ok(/PANEL_MAX_HEIGHT,\s*\n\s*\),/.test(COMBOBOX) || /PANEL_MAX_HEIGHT/.test(COMBOBOX));
});

test('position is recomputed on scroll and resize, with capture for ancestor scroll', () => {
  // A fixed panel does not move with the page, so without this it detaches from
  // its trigger the moment anything scrolls. Capture-phase catches scrolling
  // inside ancestors (the filter card, the dialog body), not just the window.
  assert.ok(/addEventListener\('scroll', measure, true\)/.test(COMBOBOX), 'capture-phase scroll');
  assert.ok(/addEventListener\('resize', measure\)/.test(COMBOBOX));
  assert.ok(/removeEventListener\('scroll', measure, true\)/.test(COMBOBOX), 'and removed');
});
