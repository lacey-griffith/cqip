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
//
// ⚠ COMPARE THE SELECTION AGAINST THE ROW'S PRISTINE VALUE, NEVER AGAINST THE
// SUGGESTION. The first version compared against the suggestion, and it inverted
// the feature on the ONLY reachable path — Karen post-flight CRITICAL-1:
//
//   Classifier §13.6 selection admits a row only when root_cause_final is null or
//   '{}', so snapshotFromLog seeds the dropdown EMPTY on every eligible row. An
//   untouched form therefore never equalled the suggestion, the button always read
//   "Save correction" with nothing edited, and clicking it POSTed `values: []` —
//   which classifyReviewOutcome scores as 'rejected'. Every accepted suggestion
//   was discarded and filed as a human rejection, and "Confirm suggestion" was
//   unreachable unless the admin first retyped the suggestion by hand.
//
// The question this answers is "has the human touched the field", and only the
// pristine value can answer it. The suggestion is not a parameter at all now —
// which is the point: it was never the right comparand.
//
// Note an admin who types the suggestion's exact values by hand files `correct`,
// and the route then scores the outcome `exact`. That is honest on both axes:
// they DID edit the field, and they DID arrive at the same answer.
export function suggestionAction(
  currentSelection: readonly string[],
  pristineSelection: readonly string[],
): 'confirm' | 'correct' {
  return arraysEqual([...currentSelection], [...pristineSelection]) ? 'confirm' : 'correct';
}

// Whether the primary button can be clicked at all.
//
// Reason 1 — no suggestion to act on — is live: a row can reach the strip with an
// empty `ai_suggested_root_cause`.
//
// Reason 2 — a `correct` carrying an EMPTY selection — is scored 'rejected' by
// classifyReviewOutcome (`confirmed.length === 0` is checked FIRST, deliberately,
// so rejections are not swallowed as misses), so a button reading "Save
// correction" would file a rejection. Clearing the field IS a rejection and
// belongs on the control that says so. The retired queue had exactly this guard
// (`disabled={correctedValues.length === 0}`) and it was dropped in the collapse
// to one button.
//
// ⚠ BUT REASON 2 IS NOT REACHABLE TODAY, and saying otherwise would overstate it.
// Now that the comparand is the pristine snapshot, an empty selection can only be
// a `correct` when the PRISTINE value was non-empty — and in that state
// `isRulingBlocked` is already true, so the button is disabled by that instead.
// The two guards overlap completely at present.
//
// It is kept because the overlap is contingent on a decision that is explicitly
// open: the classifier batch left "should a human explicitly choosing values be
// allowed to overwrite" as Lacey's call (recorded at the route's §13.1 re-check).
// If that re-check is ever loosened to permit `correct` on a populated row,
// `isRulingBlocked` stops gating and this becomes the ONLY thing standing between
// a cleared field and a rejection filed under a correction's label.
export function isPrimaryRulingDisabled(
  action: 'confirm' | 'correct',
  currentSelection: readonly string[],
  suggested: readonly string[],
): boolean {
  if (suggested.length === 0) return true;
  return action === 'correct' && currentSelection.length === 0;
}

// ---------------------------------------------------------------------------
// What the ROUTE writes to root_cause_final — mirrored in one tested place
// ---------------------------------------------------------------------------
//
// ⚠ THIS EXISTS BECAUSE THE UI'S LOCAL MIRROR SILENTLY DISAGREED WITH THE ROUTE,
// AND THE DISAGREEMENT ERASED CONFIRMED DATA WITH NO AUDIT ROW (Karen CRITICAL-2).
//
// The route (`app/api/admin/logs/ai-review/route.ts`) writes:
//   confirm → the STORED SUGGESTION      (`confirmedValues = suggested`, :114)
//   correct → the human's values         (`confirmedValues = body.values`, :123)
//   reject  → nothing; the key is absent (:198-200)
//
// The dialog had hardcoded `action === 'reject' ? persisted : rootCauseFinal`,
// which is right for `correct` and WRONG for `confirm` — and `confirm` only became
// reachable when CRITICAL-1 was fixed, so the two defects were stacked. On the live
// path `rootCauseFinal` is `[]`, so confirm wrote the suggestion to the database
// while the dropdown, the snapshot and the table row all kept `[]`. Then the
// post-ruling status line says "use Save changes below", and that save sends
// `root_cause_final: null` — which `/api/logs/edit` writes wholesale while its diff
// guard sees `null` vs stale `null`, emits NO diff, and therefore NO audit row.
// A confirmed classification, gone, with the trail showing nothing after it: §13
// r37's exact shape.
//
// Returning it from one pure function means the mirror cannot drift from the route
// without a test failing, instead of being pinned by a regex over source — which
// is what failed here. See the note on the tests.
//
// HONEST LIMIT: `suggested` comes from the dialog's `log` prop, while the route
// re-reads it from the row at write time. They can only diverge if the suggestion
// changed between render and click, and `ai_review_pending` makes that a 409
// rather than a silent mismatch. Closing it properly means the route returning the
// values it wrote, which is a route change — out of scope per spec §4.
// ⚠ THE PARAMETER SHAPE IS DELIBERATE: three arguments of three DISTINCT types, so
// no two can be transposed without failing tsc (Karen MEDIUM-1).
//
// The first version took four positional parameters — `(action, suggested,
// currentSelection, persistedRootCause)` — with arguments 2 and 3 both
// `readonly string[]`. Swapping those two at the call site reintroduced CRITICAL-2
// **verbatim** (confirm returning the empty selection) with **tsc 0 and the full
// suite passing**, because two adjacent same-typed parameters transpose silently.
// That is round one's MEDIUM-2 in a new location: the pure function was well
// tested, its USE was not.
//
// Taking the LOG rather than its two extracted arrays also moves the
// field → role mapping inside this tested function, where it is exercised, instead
// of leaving it at an untested call site. A source assertion on argument order
// would have been the other option, and round two's lesson is precisely that a
// regex over source is the wrong tool — so the shape is made unconstructable
// instead of merely watched.
export interface RulingLog {
  ai_suggested_root_cause: string[] | null;
  root_cause_final: string[] | null;
}

export function rulingWriteValues(
  action: 'confirm' | 'reject' | 'correct',
  log: RulingLog,
  selection: readonly string[],
): string[] | null {
  if (action === 'reject') return log.root_cause_final === null ? null : [...log.root_cause_final];
  if (action === 'confirm') return [...(log.ai_suggested_root_cause ?? [])];
  return [...selection];
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
