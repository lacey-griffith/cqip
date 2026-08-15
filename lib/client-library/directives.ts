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

// Human labels for the cell statuses. ONE definition, deliberately: the matrix
// dot's aria-label, the brand page's status pill, the shared CellEditStrip's
// dropdown, and the brand page's status filter all read from here. Those four
// surfaces previously carried three identical private copies — the brand page
// now renders an editor dropdown and a status filter side by side, and two
// spellings of one status on a single page is a defect, so the guarantee is
// structural rather than conventional.
export const CELL_STATUS_LABEL: Record<CellStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
  n_a: 'N/A',
};

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

// -------------------------------------------------------------------------
// Field diff for the directive PATCH route.
//
// Pure, and in lib rather than inline in the route, because it decides TWO
// things at once and getting either wrong is silent: which columns are written,
// and which audit_log rows are emitted. A field that diffs when it should not
// writes a false row into the permanent trail; a field that fails to diff writes
// no row at all, which reads as "nothing happened" — the §13 r37 shape.
//
// `before` always comes from the STORED row (the route re-reads it server-side)
// and never from the client, per §13 r19's reasoning one field over.
// -------------------------------------------------------------------------
export const DIRECTIVE_EDITABLE_FIELDS = [
  'title',
  'description',
  'directive_type',
  'status',
  'project_key',
] as const;
export type DirectiveEditableField = (typeof DIRECTIVE_EDITABLE_FIELDS)[number];

export type DirectiveFieldValues = Partial<Record<DirectiveEditableField, string | null>>;

export interface DirectiveFieldChange {
  field: DirectiveEditableField;
  before: string | null;
  after: string | null;
}

export function diffDirectiveFields(
  stored: Record<DirectiveEditableField, string | null>,
  next: DirectiveFieldValues,
): DirectiveFieldChange[] {
  const changes: DirectiveFieldChange[] = [];
  for (const field of DIRECTIVE_EDITABLE_FIELDS) {
    // `undefined` means "absent from the PATCH body" and is NOT the same as
    // null, which means "clear this field". Collapsing the two would make every
    // partial PATCH null out the fields it did not mention.
    if (!(field in next)) continue;
    const after = next[field] ?? null;
    const before = stored[field] ?? null;
    if (after === before) continue;
    changes.push({ field, before, after });
  }
  return changes;
}

// -------------------------------------------------------------------------
// Movability — may a directive's project_key be changed?
//
// Moving a directive between projects MUST re-fan-out its cells, because cells
// are keyed to brand_id and would otherwise be stranded: they render nowhere
// (the new project's columns don't match them) yet computeMatrixKpis scopes
// cells by directive_id, so they would still be COUNTED. Counted-but-invisible,
// silently — the defect countHiddenOwedCells catches for paused brands, arriving
// through a door that guard does not watch.
//
// A re-fan-out deletes cells. So the move is permitted ONLY when every cell is
// provably free of human work, which makes the deletion lossless rather than
// merely warned-about. Lacey's call, 2026-08-15: block, over an inline warning
// and over a confirm step, because it is the only option where no data can be
// lost. Spec: docs/batch-012-directive-crud-spec.md §4.4.
//
// ⚠ THIS PREDICATE IS THE GUARANTEE, AND THE ROUTE IS WHERE IT COUNTS.
// The UI lock is a convenience — the page snapshots cells once per load, so its
// view goes stale the moment another admin edits a cell. The route MUST re-run
// this against freshly-read cells and answer 409. Both call THIS function; a
// second transcription of the rule is how the two get to disagree.
//
// WHY THREE CLAUSES WHEN ONE IMPLIES THE OTHERS TODAY:
// Every clause can only SHRINK the movable set, so adding one can never
// introduce data loss — only reduce a convenience. The predicate is fail-safe in
// one direction BY CONSTRUCTION. That asymmetry, not any measurement, is why
// requiring all three costs nothing. They also fail independently: if a future
// writer forgets updated_by, the status and note clauses still catch worked
// cells; if a future fan-out gains a third default status, updated_by still
// catches edits.
//
// WHY `updated_by` IS NOT ENOUGH ON ITS OWN, AND WHY IT IS NOT "EXACT":
// fanOutCells writes only {directive_id, brand_id, status}, leaving updated_by
// NULL, and the cell PATCH route always sets it — so NULL means "untouched since
// creation". But prod contains cells inserted by DIRECT SQL that populated
// updated_by at creation, which no edit ever touched. So it OVER-blocks (5
// directives as of 2026-08-15), and that is the safe direction.
//
// WHY status ∈ {todo, n_a} IS NOT ENOUGH ON ITS OWN:
// n_a is NOT machine-only. app/api/admin/directives/status/route.ts accepts any
// cell status including n_a with no paused-brand check, so a deliberate "this
// brand does not run this test" is real information wearing a fan-out default's
// clothing. Measured 2026-08-15: 620 cells that this clause alone called
// disposable had in fact been written by a human or a script.
// -------------------------------------------------------------------------

// The statuses fanOutCells can produce. Anything else is work by definition.
const FAN_OUT_STATUSES: readonly CellStatus[] = ['todo', 'n_a'];
const FAN_OUT = new Set<CellStatus>(FAN_OUT_STATUSES);

// `updated_by` is deliberately NON-OPTIONAL. With `?`, a caller whose row type
// simply lacks the column satisfies this structurally, every cell reads
// undefined → treated as untouched → EVERY directive reads movable, with tsc
// clean and only the route's 409 between that and data loss. Required means the
// omission is a compile error instead of a silent inversion.
export interface MovabilityCell {
  status: CellStatus;
  note: string | null;
  updated_by: string | null;
}

export interface MovabilityVerdict {
  movable: boolean;
  /** Cells blocking the move. 0 when movable. */
  blockingCells: number;
  /**
   * User-facing reason, or null when movable. Returned from HERE so the inert
   * <span> in the editor and the route's 409 body cannot disagree about WHY —
   * two derivations of one message is the second-spelling defect this module
   * removed for CELL_STATUS_LABEL.
   */
  reason: string | null;
}

function cellHoldsWork(cell: MovabilityCell): boolean {
  if (cell.updated_by !== null && cell.updated_by !== undefined) return true;
  if (!FAN_OUT.has(cell.status)) return true;
  return typeof cell.note === 'string' && cell.note.trim().length > 0;
}

export function isDirectiveMovable(
  cells: ReadonlyArray<MovabilityCell>,
): MovabilityVerdict {
  let blockingCells = 0;
  for (const cell of cells) if (cellHoldsWork(cell)) blockingCells += 1;

  if (blockingCells === 0) {
    return { movable: true, blockingCells: 0, reason: null };
  }
  // Names BOTH clauses, because a todo cell carrying only a note blocks too and
  // "hold status beyond their defaults" would be false for it.
  return {
    movable: false,
    blockingCells,
    reason:
      `Cannot move — ${blockingCells} brand ${blockingCells === 1 ? 'cell has' : 'cells have'}` +
      ' been edited or hold a note.',
  };
}
