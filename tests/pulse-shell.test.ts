import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  brandDirectiveView,
  cellsForBrand,
  toClientNavGroups,
  type BrandCell,
  type ClientNavProjectInput,
  type ClientNavBrandRow,
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
// E1 follow-on §5 — cross-project client grouping: multi-brand grouping +
// alpha, single-brand collapse, paused kept / inactive dropped, project alpha,
// empty-brand project skipped, empty set.
// -------------------------------------------------------------------------
const PROJECTS: ClientNavProjectInput[] = [
  { jira_project_key: 'NBLYCRO', display_name: 'Neighborly', brand_model: 'multi_brand', is_active: true },
  { jira_project_key: 'SPLCRO', display_name: 'Spotloan', brand_model: 'single_brand', is_active: true },
  { jira_project_key: 'DEADCRO', display_name: 'Archived Co', brand_model: 'multi_brand', is_active: false },
  { jira_project_key: 'EMPTYCRO', display_name: 'Empty Co', brand_model: 'multi_brand', is_active: true },
];
const BRANDS: ClientNavBrandRow[] = [
  { project_key: 'NBLYCRO', brand_code: 'WDG', display_name: 'Window Genie', is_active: true, is_paused: false },
  { project_key: 'NBLYCRO', brand_code: 'MRR', display_name: 'Mr Rooter', is_active: true, is_paused: true },
  { project_key: 'NBLYCRO', brand_code: 'ASV', display_name: 'Aire Serv', is_active: true, is_paused: false },
  { project_key: 'NBLYCRO', brand_code: 'OLD', display_name: 'Retired Brand', is_active: false, is_paused: false },
  { project_key: 'SPLCRO', brand_code: 'SPL', display_name: 'SPL - Spotloan', is_active: true, is_paused: false },
  { project_key: 'DEADCRO', brand_code: 'DEAD', display_name: 'Dead Brand', is_active: true, is_paused: false },
];

test('multi-brand groups: header + brands alpha, paused kept, inactive brand dropped', () => {
  const groups = toClientNavGroups(PROJECTS, BRANDS);
  const nbly = groups.find((g) => g.projectKey === 'NBLYCRO');
  assert.ok(nbly && nbly.kind === 'multi');
  assert.equal(nbly.label, 'Neighborly');
  // Inactive brand (OLD) dropped; the rest alpha by display name.
  assert.deepEqual(nbly.brands.map((b) => b.displayName), ['Aire Serv', 'Mr Rooter', 'Window Genie']);
  assert.equal(nbly.brands.find((b) => b.brandCode === 'MRR')?.paused, true);
  assert.equal(nbly.brands.find((b) => b.brandCode === 'ASV')?.paused, false);
  // Entries carry projectKey + brandCode for href building.
  assert.ok(nbly.brands.every((b) => b.projectKey === 'NBLYCRO' && b.brandCode));
});

test('single-brand project collapses to one entry under the client name', () => {
  const groups = toClientNavGroups(PROJECTS, BRANDS);
  const spl = groups.find((g) => g.projectKey === 'SPLCRO');
  assert.ok(spl && spl.kind === 'single');
  assert.equal(spl.label, 'Spotloan'); // client display name, not the brand's
  assert.equal(spl.entry.brandCode, 'SPL');
  assert.equal(spl.entry.projectKey, 'SPLCRO');
  assert.equal(spl.entry.paused, false);
});

test('groups sorted alpha by project display name; inactive + empty projects excluded', () => {
  const groups = toClientNavGroups(PROJECTS, BRANDS);
  // DEADCRO is inactive → excluded even though it has an active brand.
  // EMPTYCRO is active but has no active brand → skipped.
  assert.deepEqual(
    groups.map((g) => g.label),
    ['Neighborly', 'Spotloan'],
  );
  assert.ok(!groups.some((g) => g.projectKey === 'DEADCRO'));
  assert.ok(!groups.some((g) => g.projectKey === 'EMPTYCRO'));
});

test('toClientNavGroups on empty inputs returns []', () => {
  assert.deepEqual(toClientNavGroups([], []), []);
  assert.deepEqual(toClientNavGroups(PROJECTS, []), []); // no brands → nothing to link
});
