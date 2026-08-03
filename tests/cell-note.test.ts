import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildCellReadout, hasNote } from '../lib/client-library/cell-note';
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
