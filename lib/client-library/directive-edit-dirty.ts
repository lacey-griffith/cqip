// Dirty-state tracking for the Pulse directive row editor.
//
// Spec: docs/batch-012-directive-crud-spec.md §3.
//
// WHY A SEPARATE MODULE RATHER THAN WIDENING lib/logs/edit-dirty.ts:
// That module is log-specific — its EditFormSnapshot IS the nine quality-log
// fields, and its arraysEqual exists because four of them are Postgres arrays
// whose ORDER is persisted. None of that applies here: a directive has five
// scalar fields. Widening it to serve two callers would mean a union type and a
// branch on which caller is asking, which is more moving parts than a second
// twenty-line module. What is shared is the CONTRACT below, deliberately
// restated rather than imported, because it is the part that is easy to get
// subtly wrong.
//
// ⚠ THE SNAPSHOT AND THE FORM'S INITIAL VALUES COME FROM ONE FUNCTION.
// The obvious implementation seeds five useStates from `directive` and
// separately builds a snapshot from `directive`. Those are two transcriptions of
// one mapping, and they drift the moment a sixth field is added — after which
// the form opens DIRTY (so every dismiss prompts, and users learn to click
// through the prompt), or opens clean and never notices a change, with tsc clean
// and every test passing. `snapshotFromDirective` is therefore the SINGLE
// producer: the editor seeds its fields FROM the snapshot it stores.
//
// This is the same shared-ancestor shape CLAUDE.md §15 records four times as a
// DEFECT — a reference value and a value under test sharing an ancestor, so
// agreement is guaranteed regardless of correctness. It is inverted here on
// purpose: there is only one mapping to be right or wrong about, so sharing the
// ancestor IS the correctness guarantee rather than a blind spot. The
// distinction is whether the two values are meant to be INDEPENDENT evidence
// (there, yes; here, no).

import type { DirectiveStatus, DirectiveType } from './directives';

/** The five editable fields, in the normalised form the controls hold. */
export interface DirectiveFormSnapshot {
  title: string;
  description: string;
  directiveType: DirectiveType;
  status: DirectiveStatus;
  projectKey: string;
}

/** The subset of a directive row this module reads. Structural, so DirectiveRow satisfies it. */
export interface DirectiveSnapshotSource {
  title: string;
  description: string | null;
  directive_type: DirectiveType;
  status: DirectiveStatus;
  project_key: string;
}

// null -> '' for the text inputs, because a control's value is a string and
// `undefined`/`null` would make it uncontrolled. The route maps '' back to null,
// so the round-trip is lossless — and comparing normalised-to-normalised is what
// stops "null vs empty string" from reading as a change the user did not make.
export function snapshotFromDirective(
  directive: DirectiveSnapshotSource | null,
): DirectiveFormSnapshot {
  return {
    title: directive?.title ?? '',
    description: directive?.description ?? '',
    directiveType: directive?.directive_type ?? 'goal',
    status: directive?.status ?? 'active',
    projectKey: directive?.project_key ?? '',
  };
}

// Dirty = differs from the OPENING SNAPSHOT, not from a submitted flag and not
// from the live row. Against the live row, a concurrent edit elsewhere would
// make an untouched form read dirty; against a submitted flag, a change-then-
// change-back would prompt on a form that matches what is stored.
export function isDirectiveFormDirty(
  snapshot: DirectiveFormSnapshot,
  current: DirectiveFormSnapshot,
): boolean {
  return (
    snapshot.title !== current.title ||
    snapshot.description !== current.description ||
    snapshot.directiveType !== current.directiveType ||
    snapshot.status !== current.status ||
    snapshot.projectKey !== current.projectKey
  );
}

// What the PATCH body should carry: only fields that actually changed.
//
// Sending every field would work, but it would make the route's diff the only
// thing standing between an unchanged form and a pile of no-op audit rows — and
// it would send `project_key` on every save, which is what the route's isMoving
// flag keys on. An unchanged project_key must never look like a move.
export function directivePatchBody(
  snapshot: DirectiveFormSnapshot,
  current: DirectiveFormSnapshot,
): Record<string, string | null> {
  const body: Record<string, string | null> = {};
  if (current.title !== snapshot.title) body.title = current.title.trim();
  if (current.description !== snapshot.description) {
    body.description = current.description.trim() || null;
  }
  if (current.directiveType !== snapshot.directiveType) body.directive_type = current.directiveType;
  if (current.status !== snapshot.status) body.status = current.status;
  if (current.projectKey !== snapshot.projectKey) body.project_key = current.projectKey;
  return body;
}
