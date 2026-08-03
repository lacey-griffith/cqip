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

/**
 * The matrix cell's ACCESSIBLE NAME.
 *
 * Extracted here rather than inlined in JSX for one reason: after this batch it
 * is the ONLY announced path to a note for keyboard and browse-mode users. The
 * readout's live region is deliberately silent on focus (see
 * `buildReadoutAnnouncement`), and browse mode never fires `onFocus` at all, so
 * a virtual cursor only ever hears this string. Left as 8 lines of concatenation
 * inside a 200-line JSX block, a later simplification could drop the note clause
 * with tsc, ESLint and every test still green and the VISIBLE readout still
 * working — which is exactly how the dead `sr-only "has note"` span survived
 * unnoticed. A pure function with a test turns that convention into a contract.
 *
 * The note is included when present and OMITTED when absent — deliberately not
 * "No note", which would add a clause to ~1,300 cells to convey nothing. Present
 * vs absent is itself the distinction, which is what §2.2 needs: a
 * screen-reader user can tell a noted cell from a bare one.
 *
 * `canEdit` differentiates the two roles here, in the NAME, rather than via
 * `aria-disabled` on a control whose click really does something. See the call
 * site for that decision.
 */
export function buildCellAriaLabel(
  readout: CellReadout,
  opts: { canEdit: boolean; isExpanded: boolean; isPinned: boolean },
): string {
  const base = `${readout.directiveTitle} — ${readout.brandLabel}: ${readout.statusLabel}`;
  const note = readout.note ? `. Note: ${readout.note}` : '';
  const action = opts.canEdit
    ? opts.isExpanded
      ? ' (editing — activate to close)'
      : ' (edit)'
    : opts.isPinned
      ? ' (activate to unpin)'
      : ' (activate to pin)';
  return base + note + action;
}

/**
 * The live region's text — '' means "say nothing".
 *
 * THE §2.3-vs-§5 RESOLUTION LIVES HERE. §2.3 wants a polite region; §5 wants the
 * readout announced once per cell, not twice. On a FOCUS-driven change the cell
 * button's own accessible name already speaks brand + directive + status + note,
 * so a region repeating it is exactly the double announcement §5 forbids →
 * silent. Pointer moves no focus, so nothing else announces → speak.
 *
 * A PIN ALWAYS SPEAKS, even though clicking a button focuses it in Chrome and
 * Firefox and therefore arrives with `focusDriven: true`. That is what the
 * `pinned` term is doing, and it is not incidental: pinning is the touch and
 * screen-reader path to a note (§2.6), so a silent pin would mean the note
 * reaches nobody in exactly the case the pin exists for. Pinned state is also
 * NEW information the button's name does not carry at the moment of the click.
 * Tested against the real event order (mouseenter → focus → click), not against
 * this paragraph.
 */
export function buildReadoutAnnouncement(
  readout: CellReadout | null,
  opts: { pinned: boolean; focusDriven: boolean },
): string {
  if (!readout) return '';
  if (!opts.pinned && opts.focusDriven) return '';
  const note = readout.note ? `Note: ${readout.note}` : 'No note';
  return `${readout.brandLabel}, ${readout.directiveTitle}: ${readout.statusLabel}. ${note}`;
}
