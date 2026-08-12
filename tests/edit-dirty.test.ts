import test from 'node:test';
import assert from 'node:assert/strict';
import {
  arraysEqual,
  isFormDirty,
  snapshotFromLog,
  type EditFormSnapshot,
  type EditSnapshotSource,
} from '../lib/logs/edit-dirty';

// Batch logs-page — Part A (dismiss guard).
// Spec: docs/HANDOFF-logs-page-batch.md §1.
//
// What these tests are FOR: the guard's whole value is that it fires when work
// would be lost and does not fire otherwise. Both failure directions are silent
// in the UI — a guard that never fires looks identical to a guard that is not
// needed, and a guard that always fires trains users to click through it. So the
// predicate is tested directly rather than inferred from the component.

const FULL: EditSnapshotSource = {
  log_status: 'Open',
  severity: 'High',
  who_owns_fix: 'Dev',
  issue_category: ['Client Request'],
  issue_subtype: ['Copy Change Request'],
  root_cause_final: ['QA Gap', 'Late Assets/ Info'],
  resolution_type: ['Fixed'],
  resolution_notes: 'notes here',
  notes: 'more',
};

const EMPTY: EditSnapshotSource = {
  log_status: 'Open',
  severity: null,
  who_owns_fix: null,
  issue_category: null,
  issue_subtype: null,
  root_cause_final: null,
  resolution_type: null,
  resolution_notes: null,
  notes: null,
};

function currentOf(s: EditFormSnapshot): EditFormSnapshot {
  return { ...s, issueCategory: [...s.issueCategory], issueSubtype: [...s.issueSubtype], rootCauseFinal: [...s.rootCauseFinal], resolutionType: [...s.resolutionType] };
}

// ── The load-bearing case: an untouched form is never dirty ──
//
// This is the one that keeps the prompt from firing on every dismiss. It is run
// over the all-null row deliberately: severity and who_owns_fix are frequently
// null in prod, and a null-vs-'' mismatch would make EVERY such row open dirty.

test('a freshly-opened form is not dirty — fully populated row', () => {
  const snap = snapshotFromLog(FULL);
  assert.equal(isFormDirty(snap, currentOf(snap)), false);
});

test('a freshly-opened form is not dirty — all-null row (the null-vs-empty-string trap)', () => {
  const snap = snapshotFromLog(EMPTY);
  assert.equal(isFormDirty(snap, currentOf(snap)), false);
  // And the normalisation is asserted explicitly, not just via the false above:
  // if these ever became null the controls would be uncontrolled and the
  // comparison would be null !== '' on every render.
  assert.equal(snap.severity, '');
  assert.equal(snap.whoOwnsFix, '');
  assert.equal(snap.resolutionNotes, '');
  assert.equal(snap.notes, '');
  assert.deepEqual(snap.issueCategory, []);
  assert.deepEqual(snap.rootCauseFinal, []);
});

test('a null log yields a usable snapshot rather than throwing', () => {
  const snap = snapshotFromLog(null);
  assert.equal(snap.logStatus, 'Open');
  assert.equal(isFormDirty(snap, currentOf(snap)), false);
});

// ── Every field must be able to make the form dirty ──
//
// Enumerated one per field rather than spot-checked: dropping a field from
// isFormDirty's explicit chain is the exact mutation that makes the guard stop
// protecting that field, and it is invisible in every other check.

const MUTATIONS: Array<[string, (s: EditFormSnapshot) => EditFormSnapshot]> = [
  ['logStatus', s => ({ ...s, logStatus: 'Resolved' })],
  ['severity', s => ({ ...s, severity: 'Low' })],
  ['whoOwnsFix', s => ({ ...s, whoOwnsFix: 'QA' })],
  ['issueCategory', s => ({ ...s, issueCategory: ['Process/ Communication'] })],
  ['issueSubtype', s => ({ ...s, issueSubtype: [] })],
  ['rootCauseFinal', s => ({ ...s, rootCauseFinal: ['QA Gap'] })],
  ['resolutionType', s => ({ ...s, resolutionType: ['Reverted'] })],
  ['resolutionNotes', s => ({ ...s, resolutionNotes: 'changed' })],
  ['notes', s => ({ ...s, notes: '' })],
];

for (const [field, mutate] of MUTATIONS) {
  test(`changing ${field} makes the form dirty`, () => {
    const snap = snapshotFromLog(FULL);
    assert.equal(isFormDirty(snap, mutate(currentOf(snap))), true, `${field} is not covered by isFormDirty`);
  });
}

test('typing into an empty field and clearing it again is NOT dirty', () => {
  // The round-trip case. If this reported dirty, a user who typed a character and
  // deleted it would be prompted on dismiss with nothing to lose.
  const snap = snapshotFromLog(EMPTY);
  const touched = { ...currentOf(snap), notes: 'x' };
  assert.equal(isFormDirty(snap, touched), true);
  assert.equal(isFormDirty(snap, { ...touched, notes: '' }), false);
});

// ── Array order is a real change ──
//
// root_cause_final is a Postgres ARRAY and order persists, so a reorder is a diff
// the save would write. Treating it as equal would let a real edit vanish.

test('reordering a taxonomy array counts as dirty', () => {
  const snap = snapshotFromLog(FULL);
  const reordered = { ...currentOf(snap), rootCauseFinal: ['Late Assets/ Info', 'QA Gap'] };
  assert.equal(isFormDirty(snap, reordered), true);
});

test('arraysEqual is order-sensitive and null-tolerant', () => {
  assert.equal(arraysEqual(['a', 'b'], ['a', 'b']), true);
  assert.equal(arraysEqual(['a', 'b'], ['b', 'a']), false);
  assert.equal(arraysEqual(null, []), true);
  assert.equal(arraysEqual(undefined, null), true);
  assert.equal(arraysEqual(['a'], []), false);
});

// ── The single-mapping guarantee ──
//
// The dialog seeds its nine controls FROM snapshotFromLog's output. If a field is
// added to EditFormSnapshot but not to snapshotFromLog, the control would seed
// undefined and the form would open dirty forever. tsc catches that today; this
// pins the key set so a future `Partial<>` or index signature cannot loosen it.

test('the snapshot key set is exactly the nine editable fields', () => {
  assert.deepEqual(Object.keys(snapshotFromLog(FULL)).sort(), [
    'issueCategory',
    'issueSubtype',
    'logStatus',
    'notes',
    'resolutionNotes',
    'resolutionType',
    'rootCauseFinal',
    'severity',
    'whoOwnsFix',
  ]);
});

// ── Structural assertions on the dialog itself ──
//
// The component cannot be rendered here (no React test infrastructure in this
// repo — see the TERMINAL_CELL_STATUSES precedent in §16, where an invariant that
// no test could reach was recorded as review-level rather than pretended into
// coverage). These assert the wiring that a render test would otherwise cover.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function src(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

test('all four dismiss paths route through the guard, none call onOpenChange(false) directly', () => {
  const dialog = src('components/logs/edit-log-dialog.tsx');
  // Cancel must not bypass requestClose.
  assert.ok(
    !/onClick=\{\(\)\s*=>\s*onOpenChange\(false\)\}/.test(dialog),
    'Cancel calls onOpenChange(false) directly — it must route through requestClose',
  );
  // The Dialog must be wired to the interceptor, not straight to the prop.
  assert.ok(
    /<Dialog open=\{open\} onOpenChange=\{handleOpenChange\}>/.test(dialog),
    'the edit Dialog must intercept onOpenChange via handleOpenChange',
  );
  // requestClose must actually consult dirtiness rather than always closing.
  assert.ok(
    /function requestClose\(\)\s*\{\s*if \(!isDirty\)/.test(dialog),
    'requestClose must branch on isDirty',
  );
});

test('the dirty predicate is imported, not re-implemented in the dialog', () => {
  const dialog = src('components/logs/edit-log-dialog.tsx');
  assert.ok(/from '@\/lib\/logs\/edit-dirty'/.test(dialog));
  // A second local copy of arraysEqual is how the two definitions drift.
  assert.ok(
    !/function arraysEqual/.test(dialog),
    'arraysEqual must live only in lib/logs/edit-dirty.ts',
  );
});
