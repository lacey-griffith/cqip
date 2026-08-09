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
// reproducibility, root_cause_description, the four booleans, updated_at)
// keeps its unconditional write. client_brand in particular MUST stay
// unconditional — §13 r28 depends on it.
//
// CAVEAT, because an earlier version of this comment claimed these columns
// hold "no human-entered value to protect" and that is FALSE (Karen
// post-flight MEDIUM-2): 32 non-deleted rows hold human-authored prose in
// root_cause_description, imported from the CSV's "Issue Details" column
// (§11). They are excluded from the sync's working set only by being
// Resolved — and log_status IS in ALLOWED_FIELDS, so an admin reopening one
// pulls it in, after which an empty Jira customfield_12909 nulls that prose
// silently and WITHOUT an audit row. It is unguarded because it is not
// human-editable in CQIP, not because it is empty of human work. See §15.
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

// §13 r20: cron-context writers use `system:<name>` because there is no
// auth.uid() here. Names the WRITER, not the trigger — per-run attribution
// already lives in sync_runs.triggered_by, and this function serves both the
// cron and the manual proxy. Matches the `system:drought-evaluator` precedent,
// which is likewise the function name rather than the pg_cron job name.
export const SYNC_AUDIT_CHANGED_BY = 'system:jira-sync';

export interface SyncAuditRow {
  log_entry_id: string;
  target_type: 'quality_log';
  target_id: string;
  action: 'UPDATE';
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  notes: string;
}

// audit_log.old_value / new_value are TEXT. Arrays are JSON-stringified to
// match what the edit dialog already sends (`["Client Request"]`), so a
// sync-written row and a human-written row for the same column read the same.
export function serializeForAudit(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

// One row per GUARDED field whose stored value actually changed.
//
// Only fields present in `updateData` are considered — a field the guard
// omitted was never written, so it cannot have changed and must not produce a
// row (that is case 3: no write, no audit).
//
// `previous` is the pre-update row. In the sync that snapshot is read once at
// the top of the loop, before a per-log Jira round-trip, so old_value is
// "the value as of loop start", not as of the write. A human editing the same
// row mid-run would therefore be recorded against a slightly stale old_value.
// Narrow window, but stated rather than claimed exact.
export function buildSyncAuditRows(
  logId: string,
  previous: Record<string, unknown>,
  updateData: Record<string, unknown>,
): SyncAuditRow[] {
  const rows: SyncAuditRow[] = [];
  for (const field of SYNC_GUARDED_FIELDS) {
    if (!(field in updateData)) continue;
    const oldValue = serializeForAudit(previous[field]);
    const newValue = serializeForAudit(updateData[field]);
    if (oldValue === newValue) continue;
    rows.push({
      log_entry_id: logId,
      target_type: 'quality_log',
      target_id: logId,
      action: 'UPDATE',
      field_name: field,
      old_value: oldValue,
      new_value: newValue,
      changed_by: SYNC_AUDIT_CHANGED_BY,
      notes: 'Updated via Jira sync',
    });
  }
  return rows;
}
// --- SYNC-FIELD-GUARD:END ---
