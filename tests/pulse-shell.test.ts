import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  brandDirectiveView,
  cellsForBrand,
  toClientNavItems,
  type BrandCell,
  type ClientNavBrandInput,
} from '../lib/client-library/pulse';
import type { CellStatus } from '../lib/client-library/directives';

const cell = (
  directive_id: string,
  brand_id: string,
  status: CellStatus,
  note: string | null = null,
): BrandCell => ({ directive_id, brand_id, status, note });

// -------------------------------------------------------------------------
// Spec §5.1 — the brand-directive filter returns only the target brand's cells
// for a directive set (the filtered view is correct).
// -------------------------------------------------------------------------
test('cellsForBrand returns only the target brand cells', () => {
  const cells: BrandCell[] = [
    cell('d1', 'brandA', 'done'),
    cell('d1', 'brandB', 'todo'),
    cell('d2', 'brandA', 'blocked', 'blocked on assets'),
    cell('d2', 'brandB', 'in_progress'),
  ];
  const forA = cellsForBrand(cells, 'brandA');
  assert.equal(forA.length, 2);
  assert.ok(forA.every((c) => c.brand_id === 'brandA'));
  assert.deepEqual(
    forA.map((c) => c.status).sort(),
    ['blocked', 'done'],
  );
});

test('brandDirectiveView pairs each directive with THIS brand cell (null when none)', () => {
  const directives = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }];
  const cells: BrandCell[] = [
    cell('d1', 'brandA', 'done'),
    cell('d1', 'brandB', 'todo'), // other brand — must not leak in
    cell('d2', 'brandA', 'blocked', 'note A'),
    // d3 has no cell for brandA (brand added after the directive) → null
  ];
  const rows = brandDirectiveView(directives, cells, 'brandA');

  // Order preserved, one row per directive.
  assert.deepEqual(rows.map((r) => r.directive.id), ['d1', 'd2', 'd3']);
  assert.equal(rows[0].cell?.status, 'done');
  assert.equal(rows[1].cell?.status, 'blocked');
  assert.equal(rows[1].cell?.note, 'note A');
  assert.equal(rows[2].cell, null);
  // No brandB status ever surfaced.
  assert.ok(rows.every((r) => r.cell === null || r.cell.brand_id === 'brandA'));
});

// -------------------------------------------------------------------------
// Spec §5.2 — the client-nav list includes paused brands (greyed) and excludes
// inactive brands; sorted alpha by display name.
// -------------------------------------------------------------------------
test('toClientNavItems keeps paused (flagged), drops inactive, sorts by name', () => {
  const brands: ClientNavBrandInput[] = [
    { brand_code: 'WDG', display_name: 'Window Genie', is_active: true, is_paused: false },
    { brand_code: 'MRR', display_name: 'Mr Rooter', is_active: true, is_paused: true },
    { brand_code: 'OLD', display_name: 'Retired Co', is_active: false, is_paused: false },
    { brand_code: 'ASV', display_name: 'Aire Serv', is_active: true, is_paused: false },
  ];
  const items = toClientNavItems(brands);

  // Inactive excluded.
  assert.equal(items.length, 3);
  assert.ok(!items.some((i) => i.brand_code === 'OLD'));

  // Paused kept + flagged.
  const paused = items.find((i) => i.brand_code === 'MRR');
  assert.ok(paused);
  assert.equal(paused.paused, true);
  const active = items.find((i) => i.brand_code === 'ASV');
  assert.equal(active?.paused, false);

  // Alpha by display name.
  assert.deepEqual(
    items.map((i) => i.display_name),
    ['Aire Serv', 'Mr Rooter', 'Window Genie'],
  );
});

test('toClientNavItems on an empty / all-inactive set returns []', () => {
  assert.deepEqual(toClientNavItems([]), []);
  assert.deepEqual(
    toClientNavItems([
      { brand_code: 'X', display_name: 'X', is_active: false, is_paused: false },
    ]),
    [],
  );
});
