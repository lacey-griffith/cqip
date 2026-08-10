// Suggestion write-set, review outcome shapes, and audit rows for the AI
// root-cause classifier.
//
// Spec: docs/HANDOFF-root-cause-classifier.md §3 (writes / does not write),
// §6 (outcome shapes), §8, as revised by §13.4 and §13.5.

import { CONFIDENCE_BANDS, type ConfidenceBand } from './confidence';

// §13 r20 form, matching its three siblings — system:jira-sync,
// system:drought-evaluator, system:normalize-quality-log-fields. The spec's
// original 'system:classifier' was thinner than any existing identity (§13.8).
//
// r20 is scoped to CRON writers as the documented exception to r19, and this is
// manual-trigger — so the scope is stretched, and §13.8 says so out loud rather
// than leaving it looking like a misapplied rule. It is still correct here:
// there is no meaningful auth.uid() attribution for a machine classification even
// with a human on the button. The triggering admin's email goes in `notes`, so
// "who ran the batch" stays answerable.
export const CLASSIFIER_CHANGED_BY = 'system:root-cause-classifier';

// THE #1 NON-NEGOTIABLE, ENFORCED STRUCTURALLY RATHER THAN BY REVIEW.
//
// The classifier writes exactly these three columns and nothing else. In
// particular it never writes root_cause_final — not behind a confidence
// threshold, not behind a config flag (§3). A human confirming is the only path
// into the canonical field.
//
// Note ai_confidence_score is NOT here: §13.4 leaves it unwritten in Phase 1
// because it is NUMERIC and the locked confidence representation is a band. Its
// emptiness is intentional; writing the raw float "for reference" would recreate
// the orderable number §11.2 exists to eliminate.
export const CLASSIFIER_WRITE_FIELDS = [
  'ai_suggested_root_cause',
  'ai_confidence_band',
  'ai_review_pending',
] as const;

export interface ClassifierUpdate {
  ai_suggested_root_cause: string[];
  ai_confidence_band: ConfidenceBand;
  ai_review_pending: true;
}

// The only thing that ever builds the classifier's update object. Returning a
// typed literal with exactly three keys is what makes "never writes
// root_cause_final" checkable: a test asserts the key set, so adding a fourth key
// — including the canonical field — fails rather than shipping.
//
// ai_review_pending is hardcoded true, not a parameter. A suggestion that did not
// enter the review queue would be a suggestion nobody ever sees and nobody ever
// confirms, which is §4's "reads as fact six months later" arriving immediately.
export function buildClassifierUpdate(
  acceptedValues: readonly string[],
  band: ConfidenceBand,
): ClassifierUpdate {
  return {
    ai_suggested_root_cause: [...acceptedValues],
    ai_confidence_band: band,
    ai_review_pending: true,
  };
}

// ---------------------------------------------------------------------------
// §6 — scoring is set overlap, not string equality
// ---------------------------------------------------------------------------
//
// root_cause_final is a Postgres array and a row can legitimately carry several
// root causes — verified in prod 2026-08-10: 13 non-deleted rows are multi-value
// and two carry three values. So a review has FOUR outcomes, not two, and
// recording only "matched / didn't" would hide the partials — which §6 says are
// where the classifier is most useful and most misleading.

export const REVIEW_OUTCOMES = ['exact', 'partial', 'miss', 'rejected'] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

// `confirmed` empty means the human cleared the suggestion entirely → 'rejected'.
// That is checked FIRST: an empty confirmed set also has an empty intersection
// with the suggestion, so testing 'miss' first would swallow every rejection and
// the correction rate would report human rejections as classifier misses. Those
// mean different things — a rejection says "no root cause applies here", a miss
// says "the classifier was wrong about which".
export function classifyReviewOutcome(
  suggested: readonly string[],
  confirmed: readonly string[],
): ReviewOutcome {
  if (confirmed.length === 0) return 'rejected';

  const suggestedSet = new Set(suggested);
  const confirmedSet = new Set(confirmed);
  const intersection = [...confirmedSet].filter((v) => suggestedSet.has(v));

  if (intersection.length === 0) return 'miss';
  // Set equality, order-insensitive: the arrays are sets in meaning, so
  // ['A','B'] confirmed against a suggested ['B','A'] is exact, not partial.
  if (suggestedSet.size === confirmedSet.size && intersection.length === suggestedSet.size) {
    return 'exact';
  }
  return 'partial';
}

// ---------------------------------------------------------------------------
// audit_log rows (§13.5)
// ---------------------------------------------------------------------------
//
// Both shapes set log_entry_id AND target_type AND target_id — following the
// sync's convention (jira-sync sets all three), NOT the edit route's, which omits
// target_type and passes the shape CHECK only via three-valued logic. That
// omission is the source of the NULL-target_type rows Batch 004.9 tried to clean
// up; there is no reason to add more.
//
// Neither shape needs a migration: action='AI_SUGGESTION' is already in the
// migration-001 action CHECK — with ZERO rows in production as of 2026-08-10, so
// the verb is free — and target_type='quality_log' already satisfies
// audit_log_target_shape_chk as last redefined in migration 025.

export interface AuditRow {
  log_entry_id: string;
  target_type: 'quality_log';
  target_id: string;
  action: 'AI_SUGGESTION' | 'UPDATE';
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  notes: string | null;
}

export function buildSuggestionAuditRow(
  logId: string,
  accepted: readonly string[],
  band: ConfidenceBand,
  triggeredBy: string,
): AuditRow {
  return {
    log_entry_id: logId,
    target_type: 'quality_log',
    target_id: logId,
    action: 'AI_SUGGESTION',
    field_name: 'ai_suggested_root_cause',
    old_value: null, // Always null: selection requires ai_suggested_root_cause IS NULL (§13.6).
    new_value: JSON.stringify(accepted),
    changed_by: CLASSIFIER_CHANGED_BY,
    // Band and trigger attribution live in notes rather than in their own
    // columns. The band is already on the row; what the trail needs is WHO ran
    // the batch, which r20's system-identity convention otherwise loses.
    notes: `Confidence band: ${band}. Triggered by ${triggeredBy}.`,
  };
}

// The outcome row. `new_value` is a bare literal — not prose in `notes` —
// specifically so the correction rate is directly GROUP BY-able. §2 makes that
// aggregate the batch's entire validation mechanism, and prose cannot be
// aggregated.
//
// `old_value` carries the PRE-EXISTING root_cause_final, not the suggestion.
// That is r37's ten-week-invisibility lesson applied: the trail has to show what
// was there before, or a later reader sees a write with nothing behind it and
// reads it as "the value is still there."
export function buildReviewOutcomeAuditRow(
  logId: string,
  outcome: ReviewOutcome,
  previousRootCauseFinal: readonly string[] | null,
  changedBy: string,
): AuditRow {
  return {
    log_entry_id: logId,
    target_type: 'quality_log',
    target_id: logId,
    action: 'UPDATE',
    field_name: 'ai_review_outcome',
    old_value: previousRootCauseFinal === null ? null : JSON.stringify(previousRootCauseFinal),
    new_value: outcome,
    changed_by: changedBy,
    notes: null,
  };
}

export function isReviewOutcome(v: unknown): v is ReviewOutcome {
  return typeof v === 'string' && (REVIEW_OUTCOMES as readonly string[]).includes(v);
}

// Re-exported so a caller validating a band does not have to import from two
// modules to build one row.
export { CONFIDENCE_BANDS };
