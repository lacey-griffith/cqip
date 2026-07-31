// lib/client-library/paged-fetch.ts — the PostgREST pager.
//
// These tests exist because the bug they prevent is SILENT: an unranged
// PostgREST select returns 1,000 rows with NO error, and the caller renders the
// short result as if complete. On 2026-07-31 that made the Pulse matrix
// under-count Outstanding on 46 of 76 directives and render real cells as
// hollow/uneditable.
//
// The boundary cases are the point. A test that only covers small inputs passes
// on the BROKEN (unpaged) implementation, so it would have caught nothing.
//
// Run: npx tsx --test tests/paged-fetch.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchAllPaged,
  POSTGREST_PAGE_SIZE,
  MAX_PAGES,
} from '../lib/client-library/paged-fetch';

/**
 * A fake PostgREST endpoint holding `total` rows that HONOURS .range() but also
 * enforces the 1,000-row cap per request — i.e. it behaves like the real thing.
 * Records each requested window so tests can assert the paging pattern.
 */
function fakeTable(total: number, opts: { cap?: number } = {}) {
  const cap = opts.cap ?? POSTGREST_PAGE_SIZE;
  const calls: Array<[number, number]> = [];
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  return {
    calls,
    page: (from: number, to: number) => {
      calls.push([from, to]);
      const width = Math.min(to - from + 1, cap);
      return Promise.resolve({ data: rows.slice(from, from + width), error: null });
    },
  };
}

test('small result: one request, no paging needed', async () => {
  const t = fakeTable(42);
  const { data, error } = await fetchAllPaged('rows', t.page);
  assert.equal(error, null);
  assert.equal(data.length, 42);
  assert.equal(t.calls.length, 1);
});

test('empty result', async () => {
  const t = fakeTable(0);
  const { data, error } = await fetchAllPaged('rows', t.page);
  assert.equal(error, null);
  assert.deepEqual(data, []);
  assert.equal(t.calls.length, 1);
});

// -------------------------------------------------------------------------
// The boundary. These are the cases that fail on an unpaged implementation.
// -------------------------------------------------------------------------
test('EXACTLY 1000 rows: returns all 1000, costs one extra empty request', async () => {
  const t = fakeTable(POSTGREST_PAGE_SIZE);
  const { data, error } = await fetchAllPaged('rows', t.page);
  assert.equal(error, null);
  assert.equal(data.length, POSTGREST_PAGE_SIZE);
  // A full page cannot be distinguished from "there is more", so it probes once
  // more and gets an empty page. Deliberate — see the helper's docs.
  assert.equal(t.calls.length, 2);
  assert.deepEqual(t.calls[0], [0, 999]);
  assert.deepEqual(t.calls[1], [1000, 1999]);
});

test('1001 rows: the off-by-one an unpaged read silently drops', async () => {
  const t = fakeTable(POSTGREST_PAGE_SIZE + 1);
  const { data, error } = await fetchAllPaged('rows', t.page);
  assert.equal(error, null);
  assert.equal(data.length, 1001);
  assert.equal(t.calls.length, 2);
  // Every row present exactly once, in order — no gap at the seam.
  assert.deepEqual(data.map((r) => r.id).slice(998, 1002), [998, 999, 1000]);
});

test('1216 rows — the real NBLYCRO cell count that triggered the hotfix', async () => {
  const t = fakeTable(1216);
  const { data, error } = await fetchAllPaged('cells', t.page);
  assert.equal(error, null);
  assert.equal(data.length, 1216, 'an unpaged read returns 1000 here and loses 216');
  assert.equal(new Set(data.map((r) => r.id)).size, 1216, 'no duplicates across the seam');
});

test('multi-page: 2500 rows over three requests, contiguous and complete', async () => {
  const t = fakeTable(2500);
  const { data, error } = await fetchAllPaged('rows', t.page);
  assert.equal(error, null);
  assert.equal(data.length, 2500);
  assert.equal(t.calls.length, 3);
  assert.deepEqual(t.calls, [[0, 999], [1000, 1999], [2000, 2999]]);
  // Contiguous 0..2499 with nothing lost or repeated.
  assert.deepEqual(data.map((r) => r.id), Array.from({ length: 2500 }, (_, i) => i));
});

// -------------------------------------------------------------------------
// Failure handling.
// -------------------------------------------------------------------------
test('query error is RETURNED (not thrown), prefixed, with the partial data', async () => {
  let n = 0;
  const { data, error } = await fetchAllPaged<{ id: number }>('cells', (from, to) => {
    n += 1;
    if (n === 2) return Promise.resolve({ data: null, error: { message: 'boom' } });
    return Promise.resolve({
      data: Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i })),
      error: null,
    });
  });
  assert.equal(error, 'cells: boom');
  // Partial rows come back so a caller CAN inspect them, but the contract is
  // check `error` first — rendering partial data as complete is the bug.
  assert.equal(data.length, POSTGREST_PAGE_SIZE);
});

test('error on the FIRST page returns empty data plus the error', async () => {
  const { data, error } = await fetchAllPaged('cells', () =>
    Promise.resolve({ data: null, error: { message: 'nope' } }),
  );
  assert.equal(error, 'cells: nope');
  assert.deepEqual(data, []);
});

test('runaway guard: a source that always returns full pages fails loudly', async () => {
  // Pathological: never returns a short page, so termination never comes.
  let calls = 0;
  const { data, error } = await fetchAllPaged<{ id: number }>(
    'cells',
    (from, to) => {
      calls += 1;
      return Promise.resolve({
        data: Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i })),
        error: null,
      });
    },
    { pageSize: 10, maxPages: 5 },
  );
  assert.equal(calls, 5, 'stops at maxPages instead of spinning forever');
  assert.equal(data.length, 50);
  assert.ok(error, 'must NOT report success');
  assert.match(error!, /still returning full pages after 5 requests/);
  // The whole point: it does not hand back 50 rows as if that were everything.
  assert.match(error!, /Refusing to continue/);
});

test('MAX_PAGES default is high enough to be a bug signal, not a data-growth limit', () => {
  assert.equal(POSTGREST_PAGE_SIZE, 1000);
  assert.ok(MAX_PAGES * POSTGREST_PAGE_SIZE >= 500_000);
});

test('custom pageSize is honoured end to end', async () => {
  const t = fakeTable(25, { cap: 10 });
  const { data, error } = await fetchAllPaged('rows', t.page, { pageSize: 10 });
  assert.equal(error, null);
  assert.equal(data.length, 25);
  assert.deepEqual(t.calls, [[0, 9], [10, 19], [20, 29]]);
});
