import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  CELL_STATUSES,
  DIRECTIVE_TYPES,
  fanOutCells,
  initialCellStatus,
  isCellStatus,
  isDirectiveType,
  outstandingCount,
  type CellStatus,
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
