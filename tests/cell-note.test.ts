import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildCellAriaLabel,
  buildCellReadout,
  buildReadoutAnnouncement,
  hasNote,
} from '../lib/client-library/cell-note';
import { CELL_STATUSES, CELL_STATUS_LABEL } from '../lib/client-library/directives';

// Spec §4.1 — hasNote. The whitespace case is the whole reason this module
// exists: before it, both surfaces used a bare `cell?.note ?` truthiness check,
// which calls '   ' a note. The matrix would then draw an indicator promising
// content the readout has none of, and the brand page would render a `Note:`
// label with nothing after it.
test('hasNote: null, undefined, empty and whitespace-only are NOT notes', () => {
  assert.equal(hasNote(null), false);
  assert.equal(hasNote(undefined), false);
  assert.equal(hasNote(''), false);
  assert.equal(hasNote('   '), false);
  assert.equal(hasNote('\t\n  \n'), false, 'tabs and newlines are whitespace too');

  assert.equal(hasNote('x'), true);
  assert.equal(hasNote('  padded  '), true, 'padding does not disqualify real content');
});

// Spec §4.2 — buildCellReadout over the three shapes that actually occur.
test('buildCellReadout: a normal cell carries label, title and status label', () => {
  const r = buildCellReadout({
    brandLabel: 'Aire Serv',
    directiveTitle: 'Clicks Print Offer',
    status: 'todo',
  });

  assert.equal(r.brandLabel, 'Aire Serv');
  assert.equal(r.directiveTitle, 'Clicks Print Offer');
  assert.equal(r.status, 'todo');
  assert.equal(r.statusLabel, 'To do');
  assert.equal(r.note, null);
});

test('buildCellReadout: a cell with a note exposes it trimmed', () => {
  const r = buildCellReadout({
    brandLabel: 'Mr. Rooter Plumbing',
    directiveTitle: '[Rev] Total Page Views',
    status: 'blocked',
    note: '  waiting on Convert goal id  ',
  });

  assert.equal(r.note, 'waiting on Convert goal id');
  assert.equal(r.statusLabel, 'Blocked');
});

// The cell-less case: a brand added AFTER a directive was created has no
// directive_brand_status row at all (Phase A has no backfill). The matrix
// renders it as n_a, and it is exactly the cell someone hovers to ask "why is
// this one different?" — so the readout must still build.
test('buildCellReadout: a cell-less cell still produces a readout', () => {
  const r = buildCellReadout({
    brandLabel: 'Glass Doctor',
    directiveTitle: 'Chat Started',
    status: 'n_a',
    // no `note` key at all — not null, absent
  });

  assert.equal(r.status, 'n_a');
  assert.equal(r.statusLabel, 'N/A');
  assert.equal(r.note, null);
  assert.equal(r.brandLabel, 'Glass Doctor');
});

// Spec §4.3 — the readout's note field is null or text, NEVER ''. An empty
// string is what produces the blank region that reads as broken.
test('buildCellReadout: note is never an empty string, for any status', () => {
  for (const status of CELL_STATUSES) {
    for (const note of [null, undefined, '', '   ', '\n\t']) {
      const r = buildCellReadout({
        brandLabel: 'B',
        directiveTitle: 'D',
        status,
        note,
      });
      assert.notEqual(r.note, '', `status=${status} note=${JSON.stringify(note)}`);
      assert.equal(r.note, null, `status=${status} note=${JSON.stringify(note)}`);
    }
  }
});

// ── The accessible name ────────────────────────────────────────────────────
// After this batch this string is the ONLY announced path to a note for
// keyboard and browse-mode users, so it is pinned rather than left to a comment.
// This is the regression guard for the exact defect this batch found: a dead
// `sr-only "has note"` span that nobody noticed for months.
test('aria label: carries the note when there is one, and omits it when there is not', () => {
  const withNote = buildCellAriaLabel(
    buildCellReadout({
      brandLabel: 'Aire Serv',
      directiveTitle: 'Clicks Print Offer',
      status: 'blocked',
      note: 'waiting on Convert goal id',
    }),
    { canEdit: false, isExpanded: false, isPinned: false },
  );
  assert.ok(
    withNote.includes('Note: waiting on Convert goal id'),
    'a noted cell must announce its note — this is the whole of §2.2 for AT users',
  );

  const without = buildCellAriaLabel(
    buildCellReadout({ brandLabel: 'Aire Serv', directiveTitle: 'Clicks Print Offer', status: 'blocked' }),
    { canEdit: false, isExpanded: false, isPinned: false },
  );
  // Case-INSENSITIVE deliberately. The case-sensitive form of this assertion
  // let a mutation through: padding the name with ". No note" contains no
  // substring "Note" (capital N, lowercase "ote"), so `!includes('Note')`
  // passed while every one of ~1,300 names grew a clause conveying nothing.
  // Found by mutation, not by review.
  assert.ok(
    !/note/i.test(without),
    'a bare cell must not pad ~1,300 names with "No note" — absence is the signal',
  );

  // The distinction §2.2 needs: the two names must differ.
  assert.notEqual(withNote, without);
});

test('aria label: the action clause differentiates role and state', () => {
  const r = buildCellReadout({ brandLabel: 'B', directiveTitle: 'D', status: 'todo' });
  const label = (o: { canEdit: boolean; isExpanded: boolean; isPinned: boolean }) =>
    buildCellAriaLabel(r, o);

  assert.ok(label({ canEdit: true, isExpanded: false, isPinned: false }).endsWith('(edit)'));
  assert.ok(
    label({ canEdit: true, isExpanded: true, isPinned: false }).endsWith('(editing — activate to close)'),
  );
  // Non-admins: the name is what says the control is inert-but-operable, since
  // aria-disabled was dropped from a button whose click really pins.
  assert.ok(label({ canEdit: false, isExpanded: false, isPinned: false }).endsWith('(activate to pin)'));
  assert.ok(label({ canEdit: false, isExpanded: false, isPinned: true }).endsWith('(activate to unpin)'));
});

// ── The live region ────────────────────────────────────────────────────────
test('announcement: silent on a focus-driven change, spoken on a pointer-driven one', () => {
  const r = buildCellReadout({ brandLabel: 'Aire Serv', directiveTitle: 'D', status: 'todo' });

  // Focus already speaks the button's name; repeating it is the double
  // announcement spec §5 forbids.
  assert.equal(buildReadoutAnnouncement(r, { pinned: false, focusDriven: true }), '');
  // Pointer moves no focus, so the region is the only voice.
  assert.ok(buildReadoutAnnouncement(r, { pinned: false, focusDriven: false }).length > 0);
  assert.equal(buildReadoutAnnouncement(null, { pinned: false, focusDriven: false }), '');
});

// THE ONE THAT MATTERS. Clicking a button FOCUSES it in Chrome and Firefox, so a
// pin arrives with focusDriven=true. If the focus rule won, a pinned note would
// be announced to nobody — and the pin is the touch/screen-reader path to a
// note, i.e. precisely the user §2.6 exists for. Modelled on the real event
// order a click produces: mouseenter (pointer) → focus (focus) → click (pin).
test('announcement: a PIN speaks even though clicking focuses the button', () => {
  const r = buildCellReadout({
    brandLabel: 'Aire Serv',
    directiveTitle: 'Clicks Print Offer',
    status: 'todo',
    note: 'ask Xandor',
  });

  // state after mouseenter
  assert.ok(buildReadoutAnnouncement(r, { pinned: false, focusDriven: false }).length > 0);
  // state after focus, before click — silent, name is speaking
  assert.equal(buildReadoutAnnouncement(r, { pinned: false, focusDriven: true }), '');
  // state after click: pinned, and STILL focus-driven. Must speak.
  const pinned = buildReadoutAnnouncement(r, { pinned: true, focusDriven: true });
  assert.ok(pinned.length > 0, 'a pin must never be silent — it is the touch path to a note');
  assert.ok(pinned.includes('Note: ask Xandor'));

  // Keyboard activation reaches the same state by a different route.
  assert.equal(pinned, buildReadoutAnnouncement(r, { pinned: true, focusDriven: true }));
});

test('announcement: an absent note is spoken as "No note", never as a gap', () => {
  const r = buildCellReadout({ brandLabel: 'B', directiveTitle: 'D', status: 'n_a' });
  const said = buildReadoutAnnouncement(r, { pinned: true, focusDriven: false });
  assert.ok(said.endsWith('No note'));
  // NOTE: a second `!endsWith('. ')` assertion used to sit here and was DEAD —
  // a string has one suffix per length, so it could not fail while the line
  // above passed. Deleting it changed nothing, which is how it was found. An
  // assertion that cannot fail while its predecessor passes is not a check
  // (Karen LOW-D1). The full-string tests below are what actually pin the shape.
});

// ── The FULL strings ───────────────────────────────────────────────────────
// Every other assertion in this file is a fragment matcher (`includes` /
// `endsWith`), which pins the note and the action clause but leaves the BASE
// unpinned. Karen mutated it: dropping `brandLabel` from either function's base
// produced ZERO failures, and so did reordering the name and swapping the em
// dash. On a 13-column grid "Clicks Print Offer: To do" is unusable without the
// brand — the column header is not part of the button's accessible name, so a
// browse-mode user would have no idea which brand they were on. These two
// assertions pin base, separators and ordering at once (Karen MEDIUM-D3), and
// they also close the "padding that dodges the literal substring" hole that
// /note/i still left open (LOW-D3).
test('aria label: the exact string, so the base cannot be silently refactored away', () => {
  const r = buildCellReadout({
    brandLabel: 'Aire Serv',
    directiveTitle: 'Clicks Print Offer',
    status: 'todo',
    note: 'ask Xandor',
  });

  assert.equal(
    buildCellAriaLabel(r, { canEdit: false, isExpanded: false, isPinned: false }),
    'Clicks Print Offer — Aire Serv: To do. Note: ask Xandor (activate to pin)',
  );

  const bare = buildCellReadout({
    brandLabel: 'Aire Serv',
    directiveTitle: 'Clicks Print Offer',
    status: 'done',
  });
  assert.equal(
    buildCellAriaLabel(bare, { canEdit: true, isExpanded: false, isPinned: false }),
    'Clicks Print Offer — Aire Serv: Done (edit)',
  );
});

test('announcement: the exact string, base included', () => {
  const r = buildCellReadout({
    brandLabel: 'Aire Serv',
    directiveTitle: 'Clicks Print Offer',
    status: 'blocked',
    note: 'ask Xandor',
  });
  assert.equal(
    buildReadoutAnnouncement(r, { pinned: true, focusDriven: true }),
    'Aire Serv, Clicks Print Offer: Blocked. Note: ask Xandor',
  );
});

// Every declared status must produce a label — so a sixth cell status can't be
// added without this failing, rather than silently reading `undefined` in the
// readout bar. Derived from CELL_STATUSES at runtime, never a hardcoded count
// (spec §3).
test('buildCellReadout: every declared cell status yields its canonical label', () => {
  for (const status of CELL_STATUSES) {
    const r = buildCellReadout({ brandLabel: 'B', directiveTitle: 'D', status });
    assert.equal(r.statusLabel, CELL_STATUS_LABEL[status]);
    assert.ok(r.statusLabel && r.statusLabel.length > 0, `${status} has no label`);
  }
});
