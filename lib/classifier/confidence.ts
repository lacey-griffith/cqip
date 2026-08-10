// Confidence band derivation for the AI root-cause classifier.
//
// Spec: docs/HANDOFF-root-cause-classifier.md §11.2 (LOCKED by Lacey), §13.4.
//
// §11.2: confidence is a DERIVED BAND (high/medium/low), never a raw float,
// because "a float invites a threshold and a threshold invites auto-confirm",
// which is the failure mode §9 names and forbids.
//
// So the model reports a number, this function turns it into a band, and THE
// NUMBER IS NEVER PERSISTED — it dies in memory here. ai_confidence_score stays
// unwritten in Phase 1 (§13.4). That is the whole point: with no stored number
// there is nothing to sort or filter on, so the "Confirm all above 0.9" button
// cannot be built without first adding a column, which is a reviewable act rather
// than an afternoon's UI work.
//
// ⚠ THESE BOUNDARIES ARE A DISPLAY DEVICE, NOT A GATE. Nothing in this batch may
// read the band to decide whether to write root_cause_final — a human confirm is
// the only path (§3), and §13.11 additionally forbids any bulk or select-all
// action on the review queue, because bulk confirm is auto-confirm with a human's
// finger resting on it. If you find yourself branching on the band, stop.

export const CONFIDENCE_BANDS = ['high', 'medium', 'low'] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

// 'medium' is spelled out. §11.2 said "med" colloquially; migration 028's CHECK
// is the contract, and abbreviating one of three values is the kind of thing that
// costs a migration later.
export const HIGH_BAND_MIN = 0.8;
export const MEDIUM_BAND_MIN = 0.5;

// Anything unusable — absent, non-finite, out of range, wrong type — becomes
// 'low' rather than null or a throw. Rationale: a missing confidence signal is
// not a reason to discard an otherwise-valid suggestion, and it is certainly not
// grounds for treating it as trustworthy. 'low' is the conservative reading and
// it keeps the column non-null whenever a suggestion exists, so the queue never
// has to render "unknown confidence" as a fourth state.
export function deriveConfidenceBand(raw: unknown): ConfidenceBand {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 'low';
  if (raw < 0 || raw > 1) return 'low';
  if (raw >= HIGH_BAND_MIN) return 'high';
  if (raw >= MEDIUM_BAND_MIN) return 'medium';
  return 'low';
}

export function isConfidenceBand(value: unknown): value is ConfidenceBand {
  return typeof value === 'string' && (CONFIDENCE_BANDS as readonly string[]).includes(value);
}
