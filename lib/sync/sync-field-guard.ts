// Skip-if-empty guard for the Jira sync write path.
//
// WHY THIS FILE EXISTS AT ALL — it is not dead code and it is not the code
// that runs. `supabase/functions/jira-sync/index.ts` is a Deno edge function
// that declares itself self-contained (see its line 2), and `tsconfig.json`
// EXCLUDES `supabase/functions`, so the deployed file is never type-checked
// and cannot import from here.
//
// So the guard body below is INLINED VERBATIM into that function between
// `SYNC-FIELD-GUARD:BEGIN` / `:END` markers, and `tests/sync-field-guard.test.ts`
// asserts the two copies are identical. That drift assertion is what makes the
// unit tests a valid oracle for the deployed code — without it, testing this
// module would prove nothing about the edge function, which is exactly the
// "the reference and the value under test share no independent oracle" failure
// CLAUDE.md §15 records four times.
//
// EDITING RULE: change this file and the inlined copy together, or the drift
// test fails. Do not "tidy" the block's formatting in one file only.
//
// Spec: docs/batch-sync-guard-spec.md §3, §5.

// --- SYNC-FIELD-GUARD:BEGIN ---
// Fields the Jira sync writes that a human can also edit in CQIP, i.e.
// exactly `ALLOWED_FIELDS` (app/api/logs/edit/route.ts) INTERSECT the sync's
// `updateData`. These are the only columns where an empty Jira value can
// destroy human work, so these are the only ones guarded.
//
// Everything else the sync writes (jira_summary, client_brand, detected_by,
// reproducibility, root_cause_description, the four booleans, updated_at) is
// Jira-authoritative with no human-entered value to protect, and keeps its
// unconditional write. client_brand in particular MUST stay unconditional —
// §13 r28 depends on it.
export const SYNC_GUARDED_FIELDS = [
  'issue_category',
  'issue_subtype',
  'root_cause_final',
  'resolution_type',
  'severity',
  'who_owns_fix',
] as const;

// "Empty" = Jira has nothing here. Deliberately NOT falsy-testing: `false` is
// a real boolean value, and 0 would be a real number, so neither counts as
// empty. Strings are trimmed for the TEST ONLY — a non-empty value is stored
// verbatim by the caller, so no stored value changes shape.
export function isEmptyForSync(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

// Copy the guarded fields onto `target` ONLY where Jira supplied a real value.
//
// The key is OMITTED, not set to null/[]. That distinction is the whole fix:
// writing null would still destroy the stored value while looking like a
// no-op to a naive "did the value change" assertion.
export function addGuardedSyncFields(
  target: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  for (const field of SYNC_GUARDED_FIELDS) {
    const value = incoming[field];
    if (isEmptyForSync(value)) continue;
    target[field] = value;
  }
  return target;
}
// --- SYNC-FIELD-GUARD:END ---
