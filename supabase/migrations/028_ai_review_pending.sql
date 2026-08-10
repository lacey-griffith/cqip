-- Batch classifier-1 — AI root-cause classifier, Phase 1. COMMIT 1.
-- Spec: docs/HANDOFF-root-cause-classifier.md §8 COMMIT 1, as revised by §13.4.
--
-- TWO columns, not one. The handoff's §5 gate header and §8 COMMIT 1 both said
-- "new column" singular; Jenny pre-flight HIGH-2 established that a second is
-- required, and §13.4 records why. Stated here so a reader diffing the spec
-- against the migration does not read the second column as scope creep.
--
--   1. ai_review_pending  — the review-queue flag (§3 Writes).
--   2. ai_confidence_band — the confidence band (§11.2, LOCKED by Lacey).
--
-- WHY ai_confidence_band EXISTS AT ALL, since ai_confidence_score already does:
-- §11.2 locks confidence as a DERIVED BAND (high/medium/low), not a raw float,
-- because "a float invites a threshold and a threshold invites auto-confirm",
-- which is the failure mode §9 names and forbids. ai_confidence_score is
-- NUMERIC (001_initial_schema.sql) and cannot hold 'high'. Encoding the band as
-- 1/2/3 would recreate the orderable number §11.2 exists to eliminate — after
-- which "Confirm all high" is one ORDER BY away. A CHECK-constrained TEXT band
-- is therefore the STRUCTURAL prevention for §9's worst failure mode, not a
-- storage convenience.
--
-- ai_confidence_score is left UNWRITTEN and UNUSED in Phase 1 (§13.4). Its
-- emptiness is intentional. Do not "fix" it by writing the raw model number
-- there for reference — that reintroduces exactly what this column avoids.
--
-- No backfill, and none is possible to need: probed 2026-08-10, across all 122
-- quality_logs rows ai_suggested_root_cause is non-null on 0 and
-- ai_confidence_score on 0. §8 COMMIT 1 asked this to be confirmed rather than
-- assumed; it is confirmed. There are no pre-existing suggestions that could be
-- silently left unflagged.
--
-- No RLS change. quality_logs already carries its policies from migration 005;
-- these are two more columns on an existing table, and every write in this batch
-- goes through a server route on the service role.
--
-- No audit_log CHECK change either (§13.5): action='AI_SUGGESTION' is already in
-- the 001:70-72 allowed set with ZERO rows in production, and
-- target_type='quality_log' + non-null log_entry_id already satisfies
-- audit_log_target_shape_chk as last redefined in 025_monitoring_findings.sql.
-- Unlike Batch 012, nothing needs extending.
--
-- Idempotent.

ALTER TABLE quality_logs
  ADD COLUMN IF NOT EXISTS ai_review_pending BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE quality_logs
  ADD COLUMN IF NOT EXISTS ai_confidence_band TEXT;

-- Separate, guarded, and idempotent: ADD COLUMN IF NOT EXISTS cannot carry the
-- CHECK on a re-run, so the constraint is added on its own.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quality_logs_ai_confidence_band_chk'
  ) THEN
    ALTER TABLE quality_logs
      ADD CONSTRAINT quality_logs_ai_confidence_band_chk
      CHECK (ai_confidence_band IS NULL OR ai_confidence_band IN ('high', 'medium', 'low'));
  END IF;
END $$;

-- Partial index on the review queue's only access pattern. Mirrors the
-- needs_review index from migration 020: the TRUE set is small and is the only
-- thing ever selected on.
CREATE INDEX IF NOT EXISTS idx_quality_logs_ai_review_pending
  ON quality_logs(ai_review_pending) WHERE ai_review_pending = TRUE;

COMMENT ON COLUMN quality_logs.ai_review_pending IS
  'AI suggestion awaiting human review. Set TRUE by the classifier route; cleared ONLY by POST /api/logs/ai-review on an explicit confirm/reject/correct. A general row save through /api/logs/edit must leave it untouched — this is deliberately NOT the needs_review pattern (which clears on any save per r29), because reusing that behaviour would silently unflag an unreviewed AI suggestion and it would then read as fact. See spec §4 and §13.2. The column is deliberately absent from the edit route ALLOWED_FIELDS.';

COMMENT ON COLUMN quality_logs.ai_confidence_band IS
  'Derived confidence band for the AI suggestion: high | medium | low. NOT a raw float — see spec §11.2 and migration 028''s header. ai_confidence_score stays unwritten in Phase 1.';

-- Verify after applying:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'quality_logs'
--      AND column_name IN ('ai_review_pending', 'ai_confidence_band');
--   -- expect ai_review_pending boolean NO false, ai_confidence_band text YES null
--
--   SELECT COUNT(*) FROM quality_logs WHERE ai_review_pending;      -- expect 0
--   SELECT COUNT(*) FROM quality_logs WHERE ai_confidence_band IS NOT NULL;  -- expect 0
--
-- And the CHECK must actually bite (expect 23514, not a successful update):
--   UPDATE quality_logs SET ai_confidence_band = 'med'
--    WHERE id = (SELECT id FROM quality_logs LIMIT 1);
--   -- 'med' is rejected on purpose: §13.4 spells the band out as 'medium'
--   -- because the CHECK is the contract and abbreviating one of three costs a
--   -- migration later.
