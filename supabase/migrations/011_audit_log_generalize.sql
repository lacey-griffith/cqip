-- Batch 002.5b — generalize audit_log so non-quality_log mutations can be
-- recorded (CLAUDE.md §13.2 "Audit everything"). Milestone add/edit/delete
-- and brand pause/unpause currently have no audit trail because
-- audit_log.log_entry_id is NOT NULL with a FK to quality_logs.
--
-- Strategy: relax the FK (nullable) and layer a generic target pair
-- (target_type, target_id) alongside. Legacy rows get back-filled with
-- target_type = 'quality_log' and target_id = log_entry_id. A CHECK
-- constraint keeps either shape intact — you can't write a half-specified
-- row.
--
-- Idempotent.

ALTER TABLE audit_log
  ALTER COLUMN log_entry_id DROP NOT NULL;

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS target_type TEXT,
  ADD COLUMN IF NOT EXISTS target_id UUID;

UPDATE audit_log
   SET target_type = 'quality_log',
       target_id   = log_entry_id
 WHERE target_type IS NULL
   AND log_entry_id IS NOT NULL;

ALTER TABLE audit_log
  DROP CONSTRAINT IF EXISTS audit_log_target_shape_chk;

ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_shape_chk CHECK (
    (target_type = 'quality_log'   AND log_entry_id IS NOT NULL) OR
    (target_type IN ('test_milestone', 'brand') AND target_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_audit_log_target
  ON audit_log(target_type, target_id);
