import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  CELL_STATUSES,
  DIRECTIVE_EDITABLE_FIELDS,
  DIRECTIVE_TYPES,
  diffDirectiveFields,
  duplicateTitleMessage,
  fanOutCells,
  isDirectiveMovable,
  initialCellStatus,
  isCellStatus,
  isDirectiveType,
  outstandingCount,
  type CellStatus,
  type MovabilityCell,
} from '../lib/client-library/directives';

// Spec §6.1 — Outstanding = cells in {todo,in_progress,blocked}; done/n_a
// excluded.
test('outstanding count owes todo/in_progress/blocked and excludes done/n_a', () => {
  const cells: { status: CellStatus }[] = [
    { status: 'todo' },
    { status: 'in_progress' },
    { status: 'blocked' },
    { status: 'done' },
    { status: 'n_a' },
  ];
  assert.equal(outstandingCount(cells), 3);

  assert.equal(outstandingCount([]), 0);
  assert.equal(outstandingCount([{ status: 'done' }, { status: 'n_a' }]), 0);
  assert.equal(
    outstandingCount([{ status: 'todo' }, { status: 'todo' }, { status: 'done' }]),
    2,
  );
});

// Spec §6.2 — paused brands fan out to n_a (not todo), so they don't add to
// the owed count. Active brands fan out to todo.
test('fan-out lands paused brands on n_a and active brands on todo', () => {
  assert.equal(initialCellStatus(true), 'n_a');
  assert.equal(initialCellStatus(false), 'todo');

  const cells = fanOutCells('dir-1', [
    { id: 'b-active-1', is_paused: false },
    { id: 'b-paused', is_paused: true },
    { id: 'b-active-2', is_paused: false },
  ]);

  assert.equal(cells.length, 3);
  assert.deepEqual(
    cells.map((c) => ({ brand_id: c.brand_id, status: c.status })),
    [
      { brand_id: 'b-active-1', status: 'todo' },
      { brand_id: 'b-paused', status: 'n_a' },
      { brand_id: 'b-active-2', status: 'todo' },
    ],
  );
  // Every cell carries the directive id it fanned out from.
  assert.ok(cells.every((c) => c.directive_id === 'dir-1'));

  // The paused brand does not add to the owed count.
  assert.equal(outstandingCount(cells), 2);
});

// Spec §6.3 — validation guards reject out-of-set values (defense in depth
// in front of the DB CHECK, so a bad value returns 400 not 500).
test('status validation guard rejects out-of-set values', () => {
  for (const status of CELL_STATUSES) {
    assert.equal(isCellStatus(status), true, `${status} should be valid`);
  }
  assert.equal(isCellStatus('resolved'), false);
  assert.equal(isCellStatus('TODO'), false);
  assert.equal(isCellStatus(''), false);
  assert.equal(isCellStatus(null), false);
  assert.equal(isCellStatus(undefined), false);
  assert.equal(isCellStatus(2), false);

  // Sentinel: the cell-status set is locked (matrix contract). Bump
  // intentionally when adding a status.
  assert.equal(CELL_STATUSES.length, 5, 'CELL_STATUSES count drift');
});

test('directive-type validation guard rejects out-of-set values', () => {
  for (const type of DIRECTIVE_TYPES) {
    assert.equal(isDirectiveType(type), true, `${type} should be valid`);
  }
  assert.equal(isDirectiveType('milestone'), false);
  assert.equal(isDirectiveType('Goal'), false);
  assert.equal(isDirectiveType(''), false);
  assert.equal(isDirectiveType(null), false);
  assert.equal(DIRECTIVE_TYPES.length, 4, 'DIRECTIVE_TYPES count drift');
});

// -------------------------------------------------------------------------
// isDirectiveMovable — may project_key change? (spec §4.4)
//
// Moving a directive re-fans its cells, which DELETES them. The predicate is
// what makes that deletion lossless rather than merely warned-about, so a false
// "movable" is data loss. Every fixture below isolates ONE clause: a fixture
// where two clauses fail together cannot tell you which one is doing the work,
// and a fixture where the same clause fails twice cannot discriminate at all.
// -------------------------------------------------------------------------
const clean = (status: CellStatus = 'todo') => ({ status, note: null, updated_by: null });

test('isDirectiveMovable: fresh fan-out output is movable', () => {
  // The load-bearing case. If this is ever false the feature is dead on arrival:
  // a directive created through POST /api/admin/directives yields exactly this
  // shape, and correcting a mis-filed create is the ONLY thing the move is for.
  assert.equal(isDirectiveMovable([clean('todo'), clean('n_a')]).movable, true);
  assert.equal(isDirectiveMovable([]).movable, true); // brand-less project
  assert.equal(isDirectiveMovable([clean()]).blockingCells, 0);
  assert.equal(isDirectiveMovable([clean()]).reason, null);
});

test('isDirectiveMovable: a worked STATUS blocks (status clause alone)', () => {
  for (const s of ['in_progress', 'done', 'blocked'] as const) {
    const v = isDirectiveMovable([clean(), { status: s, note: null, updated_by: null }]);
    assert.equal(v.movable, false, `${s} must block`);
    assert.equal(v.blockingCells, 1);
  }
});

test('isDirectiveMovable: a NOTE blocks even on a fan-out status (note clause alone)', () => {
  // status is `todo` and updated_by is NULL — only the note differs, so this
  // fixture fails if the note clause is dropped and nothing else.
  const v = isDirectiveMovable([clean(), { status: 'todo', note: 'client asked', updated_by: null }]);
  assert.equal(v.movable, false);
  assert.equal(v.blockingCells, 1);
});

test('isDirectiveMovable: updated_by blocks even on a pristine-looking cell (updated_by clause alone)', () => {
  // status `todo`, note null — the cell is indistinguishable from fan-out output
  // EXCEPT that someone wrote it. Measured against prod 2026-08-15: 620 cells
  // look exactly like this, so dropping this clause is not a theoretical loss.
  const v = isDirectiveMovable([
    clean(),
    { status: 'todo', note: null, updated_by: 'l.hay@fusion92.com' },
  ]);
  assert.equal(v.movable, false);
  assert.equal(v.blockingCells, 1);
  // A deliberate n_a — "this brand does not run this test" — is real information
  // wearing a fan-out default's clothing. The cell PATCH route accepts n_a with
  // no paused check, which is what makes this reachable.
  assert.equal(
    isDirectiveMovable([{ status: 'n_a', note: null, updated_by: 'system:convert-reconciliation' }])
      .movable,
    false,
  );
});

test('isDirectiveMovable: a whitespace-only note does NOT block', () => {
  // Otherwise a stray space in a textarea permanently freezes project_key, with
  // a reason naming a note the user cannot see.
  assert.equal(isDirectiveMovable([{ status: 'todo', note: '   ', updated_by: null }]).movable, true);
  assert.equal(isDirectiveMovable([{ status: 'todo', note: '', updated_by: null }]).movable, true);
});

test('isDirectiveMovable: the reason names BOTH clauses and pluralises', () => {
  // "hold status beyond their defaults" is FALSE for a todo cell blocked only by
  // a note, which is why the message says "edited or hold a note".
  const one = isDirectiveMovable([{ status: 'done', note: null, updated_by: null }]);
  assert.match(one.reason ?? '', /^Cannot move — 1 brand cell has been edited or hold a note\.$/);
  const many = isDirectiveMovable([
    { status: 'done', note: null, updated_by: null },
    { status: 'todo', note: 'x', updated_by: null },
  ]);
  assert.equal(many.blockingCells, 2);
  assert.match(many.reason ?? '', /2 brand cells have been edited or hold a note/);
});

test('isDirectiveMovable: every clause can only SHRINK the movable set', () => {
  // The reason three redundant clauses cost nothing (spec §4.4): the predicate is
  // fail-safe in one direction BY CONSTRUCTION. Adding a blocking cell to a
  // movable set can never make it movable again — asserted rather than argued, so
  // a future "simplification" that inverts a clause fails here.
  const movable = [clean('todo'), clean('n_a')];
  assert.equal(isDirectiveMovable(movable).movable, true);
  for (const extra of [
    { status: 'done' as const, note: null, updated_by: null },
    { status: 'todo' as const, note: 'note', updated_by: null },
    { status: 'todo' as const, note: null, updated_by: 'someone' },
  ]) {
    assert.equal(isDirectiveMovable([...movable, extra]).movable, false);
  }
});

test('isDirectiveMovable: fanOutCells output satisfies it (the two cannot drift)', () => {
  // Anchors the predicate to the REAL producer instead of to a hand-written
  // fixture that agrees with it by construction — the shared-ancestor trap §15
  // records four times. fanOutCells omits updated_by and note entirely, so this
  // also pins that omission: if it ever starts writing updated_by, this fails.
  const cells = fanOutCells('d1', [
    { id: 'b1', is_paused: false },
    { id: 'b2', is_paused: true },
  ]);
  const asMovability = cells.map((c) => ({
    status: c.status,
    note: (c as { note?: string | null }).note ?? null,
    updated_by: (c as { updated_by?: string | null }).updated_by ?? null,
  }));
  assert.equal(isDirectiveMovable(asMovability).movable, true);
});

// -------------------------------------------------------------------------
// diffDirectiveFields — decides BOTH what gets written and what gets audited.
// A false diff writes a false row into the permanent trail; a missing diff
// writes no row at all, which reads as "nothing happened".
// -------------------------------------------------------------------------
const STORED = {
  title: 'Chat Started',
  description: null,
  directive_type: 'goal',
  status: 'active',
  project_key: 'NBLYCRO',
} as const;

test('diffDirectiveFields: absent keys are untouched, not nulled', () => {
  // A PATCH is partial. Without the absent-key guard every field missing from
  // the body reads as null → diffs against its stored value → gets WRITTEN, each
  // wipe carrying a real audit row, so the trail would look deliberate. Verified
  // by mutation: deleting that guard fails four tests here.
  //
  // HONEST LIMIT, recorded rather than papered over: the guard is spelled
  // `field in next`, and rewriting it as `next[field] !== undefined` is an
  // EQUIVALENT MUTANT — no test here catches it, and none can. The two diverge
  // only on a key present with an explicitly `undefined` value, which the route
  // cannot produce (every assignment into `next` is `string | null`, and
  // JSON.parse never yields undefined). So the `in` form is chosen for saying
  // what it means, not because behaviour depends on it.
  assert.deepEqual(diffDirectiveFields(STORED, {}), []);
  assert.deepEqual(diffDirectiveFields(STORED, { title: 'Chat Started' }), []);
});

test('diffDirectiveFields: only genuinely changed fields diff', () => {
  assert.deepEqual(diffDirectiveFields(STORED, { title: 'Chat Engaged' }), [
    { field: 'title', before: 'Chat Started', after: 'Chat Engaged' },
  ]);
  // Archive is an ordinary field change — it is NOT a special action, which is
  // what keeps the delete control and the editor's status field on one path.
  assert.deepEqual(diffDirectiveFields(STORED, { status: 'archived' }), [
    { field: 'status', before: 'active', after: 'archived' },
  ]);
});

test('diffDirectiveFields: clearing a set field IS a change, present-but-null', () => {
  const withDesc = { ...STORED, description: 'some text' };
  assert.deepEqual(diffDirectiveFields(withDesc, { description: null }), [
    { field: 'description', before: 'some text', after: null },
  ]);
  // ...but a null on an already-null field is not a change, so it emits no row.
  assert.deepEqual(diffDirectiveFields(STORED, { description: null }), []);
});

test('diffDirectiveFields: multi-field edit emits one row per field, in order', () => {
  const changes = diffDirectiveFields(STORED, {
    title: 'Renamed',
    directive_type: 'trigger',
    project_key: 'SPLCRO',
  });
  assert.deepEqual(
    changes.map((c) => c.field),
    ['title', 'directive_type', 'project_key'],
  );
  assert.equal(changes.length, 3, 'one audit row per changed field, per §13 r2');
});

test('diffDirectiveFields: covers every editable field and nothing else', () => {
  // Pins the set itself. If a column is added to the route without being added
  // here it silently writes with no audit row — the sync-guard defect's shape.
  const all = diffDirectiveFields(STORED, {
    title: 'x',
    description: 'x',
    directive_type: 'audience',
    status: 'archived',
    project_key: 'SPLCRO',
  });
  assert.equal(all.length, 5);
  assert.deepEqual(DIRECTIVE_EDITABLE_FIELDS.length, 5, 'DIRECTIVE_EDITABLE_FIELDS drift');
});

test('isDirectiveMovable: a MISSING updated_by fails CLOSED (Karen LOW-5)', () => {
  // Only reachable through a cast — MovabilityCell declares updated_by
  // non-optional precisely so tsc catches the omission. But the predicate's
  // failures cost cells, so its one runtime branch must fail closed, and this
  // pins the direction: missing counts as TOUCHED, never as untouched.
  //
  // Written with the cast deliberately rather than skipped as "unreachable":
  // `!== null` alone survives every other test in this file, so without this the
  // clause could be silently weakened back.
  const missing = [{ status: 'todo', note: null } as unknown as MovabilityCell];
  assert.equal(isDirectiveMovable(missing).movable, false);
  assert.equal(isDirectiveMovable(missing).blockingCells, 1);
});

test('duplicateTitleMessage: ONE definition, so POST and PATCH cannot drift', () => {
  // Karen re-gate LOW-2: this string used to be a literal in both routes under a
  // comment asserting they were "kept verbatim in step". Nothing enforced it —
  // her drift mutation survived with zero failures. Both routes now import this,
  // so drift is unconstructable rather than watched; the assertions below pin the
  // two things the message must carry.
  const msg = duplicateTitleMessage('Chat Started', 'NBLYCRO');
  assert.match(msg, /"Chat Started"/, 'names the offending title');
  assert.match(msg, /NBLYCRO/, 'names the project, since uniqueness is per-project');
  // The archived clause is load-bearing: without it "already exists" is baffling
  // when the colliding directive is archived and therefore not on screen.
  assert.match(msg, /including archived directives/);
});
