// Dirty-state tracking for the edit-log modal.
//
// Spec: docs/HANDOFF-logs-page-batch.md §1 (Part A).
//
// WHY THIS IS A PURE MODULE AND NOT INLINE IN THE DIALOG:
// §1 defines dirty as "any field differs from the values the modal opened with —
// track against the OPENING SNAPSHOT, not against a submitted flag". That rule is
// the whole guard: if `isFormDirty` is wrong in the false direction the guard
// silently stops firing and the batch's entire reason for existing is gone, with
// no visible symptom. A pure function can be mutation-tested; a `useState`
// comparison buried in a component cannot.
//
// ⚠ THE SNAPSHOT AND THE FORM'S INITIAL VALUES COME FROM ONE FUNCTION, ON PURPOSE.
// The obvious implementation is to seed nine `useState`s from `log` and separately
// build a snapshot from `log`. Those are two transcriptions of the same mapping,
// and they drift the moment a tenth field is added to the form — after which the
// form opens dirty (or opens clean and never notices a change) with tsc clean and
// every test passing. `snapshotFromLog` is therefore the SINGLE producer: the
// dialog seeds its fields FROM the snapshot it stores. One mapping, no oracle
// problem. This is the same shape CLAUDE.md §15 records four times — a reference
// and a value under test sharing an ancestor — inverted deliberately: here sharing
// the ancestor is the correctness guarantee, because there is only one mapping to
// be right or wrong about.

/** The nine editable fields, in the normalised form the controls actually hold. */
export interface EditFormSnapshot {
  logStatus: string;
  severity: string;
  whoOwnsFix: string;
  issueCategory: string[];
  issueSubtype: string[];
  rootCauseFinal: string[];
  resolutionType: string[];
  resolutionNotes: string;
  notes: string;
}

/** The subset of EditableLog this module reads. Structural, so EditableLog satisfies it. */
export interface EditSnapshotSource {
  log_status: string;
  severity: string | null;
  who_owns_fix: string | null;
  issue_category: string[] | null;
  issue_subtype: string[] | null;
  root_cause_final: string[] | null;
  resolution_type: string[] | null;
  resolution_notes: string | null;
  notes: string | null;
}

// Order-sensitive by design. root_cause_final and its three siblings are Postgres
// ARRAYS, and array order is persisted — so reordering IS a change the user made
// and a save would write. Treating [a,b] and [b,a] as equal would let a real edit
// dismiss silently, which is the exact loss Part A exists to prevent.
export function arraysEqual(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  return true;
}

// null → '' for the three text/select fields, because that is what the controls
// hold. Comparing a raw `null` against the control's `''` would report a pristine
// form as dirty on every open where the column is null — which, on a page where
// severity and who_owns_fix are frequently null, means the confirm prompt fires on
// every dismiss and users learn to click through it. A guard that always fires is
// a guard nobody reads.
export function snapshotFromLog(log: EditSnapshotSource | null): EditFormSnapshot {
  return {
    logStatus: log?.log_status ?? 'Open',
    severity: log?.severity ?? '',
    whoOwnsFix: log?.who_owns_fix ?? '',
    issueCategory: log?.issue_category ?? [],
    issueSubtype: log?.issue_subtype ?? [],
    rootCauseFinal: log?.root_cause_final ?? [],
    resolutionType: log?.resolution_type ?? [],
    resolutionNotes: log?.resolution_notes ?? '',
    notes: log?.notes ?? '',
  };
}

// Deliberately NOT a generic deep-equal over Object.keys(). An explicit field list
// fails to compile when a field is added to EditFormSnapshot and not handled here,
// whereas a key-walk would silently start covering it — or silently stop, if the
// snapshot were ever built with a missing key. Compile-time coverage beats runtime
// generality for a nine-field, rarely-changing shape.
export function isFormDirty(snapshot: EditFormSnapshot, current: EditFormSnapshot): boolean {
  return (
    snapshot.logStatus !== current.logStatus ||
    snapshot.severity !== current.severity ||
    snapshot.whoOwnsFix !== current.whoOwnsFix ||
    snapshot.resolutionNotes !== current.resolutionNotes ||
    snapshot.notes !== current.notes ||
    !arraysEqual(snapshot.issueCategory, current.issueCategory) ||
    !arraysEqual(snapshot.issueSubtype, current.issueSubtype) ||
    !arraysEqual(snapshot.rootCauseFinal, current.rootCauseFinal) ||
    !arraysEqual(snapshot.resolutionType, current.resolutionType)
  );
}
