-- Batch 004.4 — wire the drought rule evaluator's persistence layer.
--
-- alert_events historically scoped events to a single quality_logs row
-- via log_entry_id. Drought is brand-scoped, not log-scoped, so the
-- table needs a brand_id reference and a CHECK enforcing that at least
-- one of the two scopes is set.
--
-- Also extends the audit_log target-shape CHECK from migration 011 to
-- accept target_type='alert_event', so the drought evaluator's audit
-- writes (drought-started / drought-ended) land without violating the
-- existing constraint.
--
-- Idempotent.

-- -------------------------------------------------------------------------
-- alert_events.brand_id
-- -------------------------------------------------------------------------
ALTER TABLE alert_events
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);

-- Hot-path lookup: "find the open brand-scoped alert for this brand"
-- runs once per brand per evaluator invocation. Partial index on the
-- common predicate keeps the scan tight.
CREATE INDEX IF NOT EXISTS idx_alert_events_brand_open
  ON alert_events(brand_id)
  WHERE resolved_at IS NULL AND brand_id IS NOT NULL;

-- Race-safety: cron + manual-trigger overlap could otherwise both fall
-- in "drought, no open alert → INSERT", leaving two open rows for the
-- same (brand, rule). Partial unique index on the open subset means at
-- most one open alert per (brand, rule) pair; the loser of any race
-- gets a 23505 it can swallow as "case 2 already covered".
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_events_one_open_per_brand_rule
  ON alert_events(brand_id, rule_id)
  WHERE resolved_at IS NULL AND brand_id IS NOT NULL;

-- At least one scope must be set. Existing log-scoped rows already
-- satisfy this via log_entry_id IS NOT NULL; new brand-scoped rows
-- satisfy via brand_id IS NOT NULL.
ALTER TABLE alert_events
  DROP CONSTRAINT IF EXISTS alert_events_target_required;

ALTER TABLE alert_events
  ADD CONSTRAINT alert_events_target_required CHECK (
    log_entry_id IS NOT NULL OR brand_id IS NOT NULL
  );

-- -------------------------------------------------------------------------
-- audit_log target-shape CHECK extension
--
-- The constraint from migration 011 only allowed target_type values of
-- 'quality_log', 'test_milestone', and 'brand'. Drought
-- evaluator audit writes use target_type='alert_event' with the
-- alert_events.id in target_id. Add 'alert_event' to the allowed set.
-- log_entry_id remains NULL for these rows.
-- -------------------------------------------------------------------------
ALTER TABLE audit_log
  DROP CONSTRAINT IF EXISTS audit_log_target_shape_chk;

ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_shape_chk CHECK (
    (target_type = 'quality_log' AND log_entry_id IS NOT NULL) OR
    (target_type IN ('test_milestone', 'brand', 'alert_event') AND target_id IS NOT NULL)
  );
