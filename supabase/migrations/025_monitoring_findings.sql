-- Batch 012 — Client Library, Phase B (Monitoring Ingest).
--
-- Adds one table:
--   monitoring_findings — findings posted by an external monitoring tool
--   (Convert / manual). Deduped on (source, external_ref); each finding
--   resolves to a brand_id where possible (nullable otherwise). Surfaces
--   on the Client Library page as a "Needs action" panel.
--
-- Isolation contract: reads/writes ONLY this new table. It references
-- brands(id) by FK for column population; no coverage KPI reads from it.
--
-- Idempotent (IF NOT EXISTS; DROP POLICY IF EXISTS before CREATE). RLS
-- mirrors migration 009: authenticated SELECT, admin FOR ALL via
-- public.is_admin().

-- -------------------------------------------------------------------------
-- monitoring_findings
--
-- source        — which tool reported it (extensible; Convert 008 posts
--                 with source='convert' through the same surface).
-- external_ref  — the tool's own id for this finding; the dedupe key.
--                 Nullable — findings without one never collide (partial
--                 unique index below).
-- brand_id      — resolved from the tool's brand string (code / jira value)
--                 at ingest; nullable when unresolved.
-- issue_type    — coarse classification.
-- severity      — nullable; the tool may not always send it.
-- summary       — the human one-liner shown on the panel.
-- detail        — raw metrics / payload jsonb from the tool.
-- status        — human workflow: new → actioned | dismissed. Ingest only
--                 ever writes 'new' (on insert); a re-post NEVER resets an
--                 actioned/dismissed row (route §2 leaves status untouched
--                 on update).
-- detected_at   — when the tool observed the condition.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monitoring_findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL CHECK (source IN ('convert', 'manual')),
  external_ref    TEXT,
  brand_id        UUID REFERENCES brands(id) ON DELETE SET NULL,
  convert_test_id TEXT,
  issue_type      TEXT NOT NULL CHECK (issue_type IN
                    ('no_conversions', 'no_visitors', 'high_bounce',
                     'low_engagement', 'error', 'other')),
  severity        TEXT CHECK (severity IS NULL OR severity IN ('critical', 'medium', 'low')),
  summary         TEXT NOT NULL,
  detail          JSONB,
  status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'actioned', 'dismissed')),
  note            TEXT,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      TEXT
);

-- Dedupe key: exactly one row per (source, external_ref) — but PARTIAL, so
-- a batch of findings with NULL external_ref don't all collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_findings_source_ref
  ON monitoring_findings(source, external_ref)
  WHERE external_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_monitoring_findings_brand
  ON monitoring_findings(brand_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_findings_new
  ON monitoring_findings(status) WHERE status = 'new';
CREATE INDEX IF NOT EXISTS idx_monitoring_findings_detected_at
  ON monitoring_findings(detected_at DESC);

-- -------------------------------------------------------------------------
-- RLS — mirror migration 009: authenticated SELECT, admin FOR ALL.
--
-- Ingest writes via the service role (bypasses RLS); the admin FOR ALL
-- policy covers no browser writes in Phase B (the admin status route also
-- writes via the service role), but it's kept for parity with 009 / 024
-- and so a future admin browser write is already permitted.
-- -------------------------------------------------------------------------
ALTER TABLE monitoring_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monitoring_findings_select_all" ON monitoring_findings;
DROP POLICY IF EXISTS "monitoring_findings_admin_write" ON monitoring_findings;

CREATE POLICY "monitoring_findings_select_all" ON monitoring_findings
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "monitoring_findings_admin_write" ON monitoring_findings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -------------------------------------------------------------------------
-- audit_log target-shape CHECK extension.
--
-- The Phase B admin status route writes audit rows with
-- target_type='monitoring_finding' (target_id = the finding id), so the
-- constraint must admit it or every such INSERT throws a CHECK violation.
-- Same DROP + re-ADD pattern as migrations 015 / 022 / 024.
--
-- Reproduces migration 024's FULL allowed set (quality_log / test_milestone
-- / brand / alert_event / user / directive / directive_brand_status) PLUS
-- 'monitoring_finding'. No value 024 admitted is dropped.
--
-- audit_log.action is unchanged: the route reuses the CHECK-allowed 'UPDATE'
-- value with a descriptive field_name, per the codebase audit convention
-- (§13 r15/r35 precedent).
-- -------------------------------------------------------------------------
ALTER TABLE audit_log
  DROP CONSTRAINT IF EXISTS audit_log_target_shape_chk;

ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_shape_chk CHECK (
    (target_type = 'quality_log' AND log_entry_id IS NOT NULL) OR
    (target_type IN (
       'test_milestone', 'brand', 'alert_event', 'user',
       'directive', 'directive_brand_status', 'monitoring_finding'
     ) AND target_id IS NOT NULL)
  );

-- No seed data.
