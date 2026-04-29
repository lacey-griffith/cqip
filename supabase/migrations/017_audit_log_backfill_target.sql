-- Batch 004.9 — backfill `target_type` / `target_id` on legacy
-- audit_log rows.
--
-- Backfills target_type/target_id for rows written by jira-webhook and
-- jira-sync between migration 011 (target columns added) and the
-- Batch 004.9 cleanup. New rows written after the edge-function
-- deploy will have both columns set directly.
--
-- Why these rows existed in this shape: migration 011 made
-- `audit_log.log_entry_id` nullable and added the generic
-- `(target_type, target_id)` pair plus a CHECK constraint. The CHECK
-- is satisfied for rows where `target_type IS NULL` because Postgres
-- treats the constraint expression as NULL (not FALSE) under
-- three-valued logic, so writers that only set `log_entry_id`
-- continued to land successfully but produced rows that didn't match
-- the new shape. The audit page filters on `target_type='quality_log'`
-- and was silently missing those rows; this migration backfills them.
--
-- Idempotent — the WHERE clause naturally no-ops on a second run.
-- Safe under concurrent writes (the edge-function deploy lands the
-- direct-write path; this migration handles everything written
-- before that deploy plus anything written after if either function
-- somehow regresses).

UPDATE audit_log
   SET target_type = 'quality_log',
       target_id   = log_entry_id
 WHERE target_type IS NULL
   AND log_entry_id IS NOT NULL;
