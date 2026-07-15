// Batch 012 — Client Library, Phase A. Pure helpers + canonical value sets
// for the directive × brand status matrix. Shared by the two admin mutation
// routes and tests/directives.test.ts so the fan-out rule and the outstanding
// count are defined exactly once (mirrors the lib/coverage/queries.ts +
// tests/coverage-kpis.test.ts split — logic lives in lib, routes/page/test
// import it).

// Directive-level enums (mirror the migration 024 CHECK constraints verbatim).
export const DIRECTIVE_TYPES = ['goal', 'trigger', 'site_area', 'audience'] as const;
export type DirectiveType = (typeof DIRECTIVE_TYPES)[number];

export const DIRECTIVE_STATUSES = ['active', 'archived'] as const;
export type DirectiveStatus = (typeof DIRECTIVE_STATUSES)[number];

// Cell-level status (the matrix cells).
export const CELL_STATUSES = ['todo', 'in_progress', 'done', 'blocked', 'n_a'] as const;
export type CellStatus = (typeof CELL_STATUSES)[number];

// Which cell statuses "owe" work. Spec §2: done + n_a do not owe; the other
// three do. The outstanding count is the number of owing cells per directive.
export const OWED_CELL_STATUSES: readonly CellStatus[] = ['todo', 'in_progress', 'blocked'];
const OWED = new Set<CellStatus>(OWED_CELL_STATUSES);

export function isDirectiveType(value: unknown): value is DirectiveType {
  return typeof value === 'string' && (DIRECTIVE_TYPES as readonly string[]).includes(value);
}

export function isCellStatus(value: unknown): value is CellStatus {
  return typeof value === 'string' && (CELL_STATUSES as readonly string[]).includes(value);
}

// Outstanding count for a directive = cells whose status is in the owed set.
// done / n_a are excluded (spec §2). Paused brands land n_a at fan-out, so
// they never inflate this count — the same paused-exclusion principle the
// 005.1 coverage KPIs use.
export function outstandingCount(cells: ReadonlyArray<{ status: CellStatus }>): number {
  let n = 0;
  for (const cell of cells) {
    if (OWED.has(cell.status)) n += 1;
  }
  return n;
}

// Fan-out rule (spec §2, locked): on directive create, insert one cell per
// ACTIVE brand in the project. Paused brands land 'n_a' (not owed); non-paused
// land 'todo'. Keeps the matrix complete on creation without inflating the
// outstanding count with brands that aren't running tests.
export function initialCellStatus(isPaused: boolean): Extract<CellStatus, 'todo' | 'n_a'> {
  return isPaused ? 'n_a' : 'todo';
}

export interface FanOutBrand {
  id: string;
  is_paused: boolean;
}

export interface FanOutCell {
  directive_id: string;
  brand_id: string;
  status: CellStatus;
}

export function fanOutCells(directiveId: string, activeBrands: ReadonlyArray<FanOutBrand>): FanOutCell[] {
  return activeBrands.map((brand) => ({
    directive_id: directiveId,
    brand_id: brand.id,
    status: initialCellStatus(brand.is_paused),
  }));
}
