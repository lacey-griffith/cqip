// Batch 012 restyle batch 3 — what a cell NOTE is, in ONE place.
//
// Two surfaces render a cell's note: the matrix (indicator + hover/focus
// readout) and the brand page (persistent text under the directive title).
// Before this module they answered "does this cell have a note?" with two
// independent truthiness checks — `cell?.note ?` on both — which agreed only by
// luck: an all-whitespace note passed BOTH, so the matrix would have drawn an
// indicator pointing at nothing and the brand page would have rendered a bare
// `Note:` label with no text after it. Wrong in the same direction by accident
// is not a contract. This module is the contract.
//
// Same structural argument that collapsed three copies of CELL_STATUS_LABEL
// into one: if two surfaces must agree, the agreement lives in a shared module,
// not in a convention.

import { CELL_STATUS_LABEL, type CellStatus } from './directives';

/**
 * The single normalization. PRIVATE deliberately — exporting a third way to ask
 * about a note is how a second definition gets born. Consumers use `hasNote`
 * (boolean) or `buildCellReadout` (the model, whose `note` field is this).
 *
 * Whitespace-only counts as NO note. `CellEditStrip` already saves
 * `note.trim() || null`, so new writes can't produce one — but rows predating
 * that save path can, and the DB has no CHECK forbidding it.
 */
function noteText(note: string | null | undefined): string | null {
  if (note == null) return null;
  const trimmed = note.trim();
  return trimmed === '' ? null : trimmed;
}

/** Does this cell carry a real note? Drives the matrix's rendered indicator. */
export function hasNote(note: string | null | undefined): boolean {
  return noteText(note) !== null;
}

/**
 * The readout model. Deliberately data, not JSX: the hover/focus readout is the
 * batch's most interaction-heavy surface, and a model keeps its content
 * testable without a DOM.
 *
 * `note` is `string | null` and NEVER `''` — an empty string would render as a
 * blank region, which reads as broken (spec §2.3). Callers branch on null and
 * say "No note" out loud rather than rendering nothing.
 */
export interface CellReadout {
  brandLabel: string;
  directiveTitle: string;
  status: CellStatus;
  statusLabel: string;
  note: string | null;
}

/**
 * Build the readout for one cell.
 *
 * `status` is the EFFECTIVE status the caller already resolved, not the raw
 * column: a brand added after a directive was created has no
 * `directive_brand_status` row at all, and the matrix renders that as `n_a`.
 * That cell-less case must still produce a readout — it is precisely the cell a
 * confused viewer hovers to ask "why is this one different?" — so this function
 * takes a resolved status and an optional note rather than a cell object it
 * could find missing.
 */
export function buildCellReadout(input: {
  brandLabel: string;
  directiveTitle: string;
  status: CellStatus;
  note?: string | null;
}): CellReadout {
  return {
    brandLabel: input.brandLabel,
    directiveTitle: input.directiveTitle,
    status: input.status,
    statusLabel: CELL_STATUS_LABEL[input.status],
    note: noteText(input.note),
  };
}
