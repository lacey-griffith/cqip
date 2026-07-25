import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { saveDirectiveCell, type DirectiveCellSaveCallbacks } from '../lib/client-library/directive-cell-save';

// Shared optimistic-save orchestration used by BOTH the matrix and the brand
// page. These tests pin the contract that made it worth extracting: the
// optimistic update always fires first, a successful PATCH toasts by the
// `changed`/`auditError` shape, and any failure reconciles (reverts).

const target = { directive_id: 'd1', brand_id: 'b1' };

function harness(fetchFn: DirectiveCellSaveCallbacks['fetchFn']) {
  const events: string[] = [];
  const toasts: string[] = [];
  const cb: DirectiveCellSaveCallbacks = {
    applyOptimistic: (t, status, note) =>
      events.push(`optimistic:${t.directive_id}/${t.brand_id}=${status}/${note ?? '∅'}`),
    reconcile: () => events.push('reconcile'),
    toast: (m) => toasts.push(m),
    fetchFn,
  };
  return { events, toasts, cb };
}

function jsonResponse(ok: boolean, body: unknown, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

test('optimistic update fires before the PATCH, with the normalized note', async () => {
  // Capture into separate typed locals rather than one nullable object — an
  // `assert.ok(nullableObject)` would flow-narrow the read site to `never`
  // under tsc since the closure assignment isn't visible to control-flow.
  let capturedUrl: string | undefined;
  let capturedBody: Record<string, unknown> | undefined;
  const { events, cb } = harness(async (url, init) => {
    capturedUrl = String(url);
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return jsonResponse(true, { ok: true, changed: 1 });
  });

  await saveDirectiveCell(target, 'done', 'shipped', cb);

  assert.equal(events[0], 'optimistic:d1/b1=done/shipped');
  assert.equal(capturedUrl, '/api/admin/directives/status');
  assert.deepEqual(capturedBody, {
    directive_id: 'd1',
    brand_id: 'b1',
    status: 'done',
    note: 'shipped',
  });
});

test('success with changed>0 toasts Updated and does NOT reconcile', async () => {
  const { events, toasts, cb } = harness(async () => jsonResponse(true, { ok: true, changed: 1 }));
  await saveDirectiveCell(target, 'in_progress', null, cb);
  assert.deepEqual(toasts, ['✅ Updated']);
  assert.ok(!events.includes('reconcile'));
});

test('changed:0 is a no-op toast', async () => {
  const { toasts, cb } = harness(async () => jsonResponse(true, { ok: true, changed: 0 }));
  await saveDirectiveCell(target, 'todo', null, cb);
  assert.deepEqual(toasts, ['No changes']);
});

test('auditError toasts the audit warning (write still succeeded)', async () => {
  const { events, toasts, cb } = harness(async () =>
    jsonResponse(true, { ok: true, changed: 1, auditError: 'boom' }),
  );
  await saveDirectiveCell(target, 'blocked', null, cb);
  assert.deepEqual(toasts, ['⚠️ Saved, but audit write failed']);
  assert.ok(!events.includes('reconcile')); // the write landed — no revert
});

test('non-ok response reconciles (reverts the optimistic change) and toasts the error', async () => {
  const { events, toasts, cb } = harness(async () =>
    jsonResponse(false, { error: 'Matrix cell not found' }, 404),
  );
  await saveDirectiveCell(target, 'done', null, cb);
  assert.ok(events.includes('reconcile'));
  assert.equal(events.indexOf('reconcile') > events.indexOf('optimistic:d1/b1=done/∅'), true);
  assert.deepEqual(toasts, ['❌ Matrix cell not found']);
});

test('a thrown fetch reconciles and never throws out of saveDirectiveCell', async () => {
  const { events, toasts, cb } = harness(async () => {
    throw new Error('network down');
  });
  await assert.doesNotReject(saveDirectiveCell(target, 'done', null, cb));
  assert.ok(events.includes('reconcile'));
  assert.deepEqual(toasts, ['❌ network down']);
});

test('ok=false in a 200 body is still treated as failure', async () => {
  const { events, cb } = harness(async () => jsonResponse(true, { ok: false, error: 'nope' }));
  await saveDirectiveCell(target, 'done', null, cb);
  assert.ok(events.includes('reconcile'));
});
