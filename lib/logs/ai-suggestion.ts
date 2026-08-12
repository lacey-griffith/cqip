// AI suggestion strip — pure logic.
//
// Spec: docs/HANDOFF-logs-page-batch.md §3 (C2, C3, C4), and the classifier spec
// docs/HANDOFF-root-cause-classifier.md §6 / §13.1 / §13.2 for the semantics this
// must not contradict.

import { arraysEqual } from './edit-dirty';

export const CONFIDENCE_BAND_LABEL = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
} as const;

// ---------------------------------------------------------------------------
// C4 — which outcome a click means
// ---------------------------------------------------------------------------
//
// §3 C3 asks for TWO actions (Confirm · Reject) while §3 C4's table has THREE
// outcomes, the third being "correct via the normal dropdown". Those are
// reconciled without a third button: the reviewer either accepts the suggestion
// as-is, or edits the modal's own Root cause (final) dropdown first — at which
// point the same button means `correct` and says so.
//
// WHY NOT A SEPARATE "Correct…" CONTROL: the retired queue had one, and it had to
// carry its own MultiCombobox because the queue had no other way to pick values.
// The whole point of moving the surface into the edit modal is that the modal
// ALREADY has the constrained dropdown. A second picker inside the strip would be
// a second, unvalidated way to set the same field.
//
// The distinction is not cosmetic — it decides which action the route records, and
// §6 makes the outcome shape (exact/partial/miss/rejected) the batch's only
// validation. A correction filed as a confirm would report the classifier as
// exactly right on a row where the human changed the answer.
export function suggestionAction(
  suggested: readonly string[],
  currentSelection: readonly string[],
): 'confirm' | 'correct' {
  return arraysEqual([...suggested], [...currentSelection]) ? 'confirm' : 'correct';
}

// ---------------------------------------------------------------------------
// §13.1 — whether a ruling can be filed at all
// ---------------------------------------------------------------------------
//
// The route refuses BOTH confirm and correct with a 409 when root_cause_final is
// already non-empty — its re-check is `action !== 'reject'`. Reject stays legal,
// because rejecting does not write the canonical field.
//
// Selection excludes non-empty rows, so this should normally be false. If it is
// true, r37's "a non-empty Jira value still wins on sync" moved a value in
// between classification and review, and a human needs to see both before either
// is overwritten. Mirroring the route here means the UI cannot offer an action the
// server will refuse — the classifier batch's Karen MEDIUM-2, which shipped with
// Confirm disabled and Correct enabled under a message saying confirming was
// blocked.
export function isRulingBlocked(existingRootCauseFinal: readonly string[] | null): boolean {
  return (existingRootCauseFinal ?? []).length > 0;
}

// ---------------------------------------------------------------------------
// C3 — the source prose
// ---------------------------------------------------------------------------
//
// ⚠ THESE ARE THE FIELDS THE CLASSIFIER *READ*, NOT THE FIELD THE SUGGESTION
// "CAME FROM". §3 C3 asks for the latter — "From resolution notes: …" — and the
// data cannot support it: lib/classifier/model.ts locks the model response to
// `root_causes` + `confidence`, so no provenance is captured, and
// buildClassifierPayload sends all eight §3 fields without recording which one the
// answer used. Resolved with Lacey 2026-08-12: label every non-empty prose field
// as what was read. Naming a single field by precedence would read as attribution
// while being a guess — a claim the mechanism cannot support.
//
// Adding real provenance means a model-schema change plus a column, which is out
// of scope here ("surface change only", spec §4) and would pull Jenny back in.
export interface ProseSource {
  issue_details: string | null;
  resolution_notes: string | null;
  notes: string | null;
}

export interface ProseBlock {
  label: string;
  value: string;
}

// Ordered as the classifier's payload orders them, so the reviewer reads them in
// the same sequence the model did. Empty and whitespace-only values are dropped:
// a labelled block with nothing under it reads as a fault rather than as absence.
export function proseBlocks(log: ProseSource): ProseBlock[] {
  const candidates: Array<[string, string | null]> = [
    ['Resolution notes', log.resolution_notes],
    ['Notes', log.notes],
    ['Issue details', log.issue_details],
  ];
  const out: ProseBlock[] = [];
  for (const [label, value] of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      out.push({ label, value: value.trim() });
    }
  }
  return out;
}
