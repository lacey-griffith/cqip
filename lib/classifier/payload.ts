// Blinded payload builder for the AI root-cause classifier.
//
// Spec: docs/HANDOFF-root-cause-classifier.md §3 (field list), §5 (blinding),
// §13.9 (the structure that makes §5 testable).
//
// WHY THIS IS A PURE EXPORTED FUNCTION AND NOT INLINE IN THE ROUTE:
// §5's blinding is only as good as its test, and a test that asserts on a payload
// it reconstructed itself proves nothing — the reference and the value under test
// would share an ancestor, which is the failure CLAUDE.md §15 records four
// separate times. Exporting the builder lets the test assert on the REAL object
// that goes to the model.
//
// WHY BLINDING MATTERS AT ALL (§5): if the classifier can see the existing
// root_cause_final it is copying, not classifying, and the correction rate —
// which §2 makes the batch's ONLY validation — becomes meaningless. The guard is
// at the query layer, not in the prompt, because an instruction not to look at a
// field that is present in the payload is not a control.

// The eight fields the classifier may read (§3). This is a WHITELIST, and the
// test asserts the payload's key set equals it exactly — not that the six
// excluded names are absent. A denylist of six passes forever as new columns are
// added to quality_logs; a whitelist fails the moment a seventh field appears,
// which is the direction that catches mistakes.
export const CLASSIFIER_READ_FIELDS = [
  'jira_summary',
  'resolution_notes',
  'notes',
  'issue_details',
  'trigger_from_status',
  'trigger_to_status',
  'client_brand',
  'test_type',
] as const;

export type ClassifierReadField = (typeof CLASSIFIER_READ_FIELDS)[number];

// Never sent, for the reasons in §5. Exported so the route's own select and the
// tests can both name the same set, and so a reader does not have to infer the
// exclusions by diffing against the quality_logs schema.
//
// root_cause_initial is on this list because §13 r3 freezes it as a snapshot of
// the SAME Jira field (customfield_12905) that backs root_cause_final — so on
// many rows it literally IS the answer.
export const CLASSIFIER_BLINDED_FIELDS = [
  'root_cause_final',
  'root_cause_initial',
  'ai_suggested_root_cause',
  'issue_category',
  'issue_subtype',
  'resolution_type',
] as const;

export type ClassifierPayload = Record<ClassifierReadField, string | null>;

function normalise(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  // Non-string arrivals are stringified rather than dropped: every field in
  // CLASSIFIER_READ_FIELDS is TEXT in the schema, so this branch means the
  // caller passed something unexpected. Coercing keeps the payload's key set
  // stable — which the whitelist test depends on — instead of silently omitting
  // a key and changing the shape.
  return String(value);
}

// Build the object handed to the model. Exactly the §3 keys, always all of them,
// in a fixed order, so the shape does not depend on which fields a given row
// happens to populate. Prod check 2026-08-10: 0 of 91 non-deleted rows have no
// prose at all, so a fully-null payload is not a live case — but the shape is
// stable regardless.
export function buildClassifierPayload(row: Record<string, unknown>): ClassifierPayload {
  const payload = {} as ClassifierPayload;
  for (const field of CLASSIFIER_READ_FIELDS) {
    payload[field] = normalise(row[field]);
  }
  return payload;
}
