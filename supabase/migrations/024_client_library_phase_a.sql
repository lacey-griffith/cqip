-- Batch 012 — Client Library, Phase A (Directive Matrix MVP).
--
-- Adds two tables:
--   directives              — cross-brand experimentation directives per project
--   directive_brand_status  — the matrix cells: one row per (directive, brand)
--
-- Isolation contract: these tables NEVER touch the live coverage tables
-- (brands / test_milestones / quality_logs). They only reference brands and
-- projects by FK for column population; no coverage KPI reads from them.
--
-- Idempotent (IF NOT EXISTS, DO-block enum-free but DROP POLICY IF EXISTS
-- before CREATE). RLS mirrors migration 009: authenticated SELECT, admin
-- FOR ALL via public.is_admin().

-- -------------------------------------------------------------------------
-- directives
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS directives (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key    TEXT NOT NULL REFERENCES projects(jira_project_key),
  title          TEXT NOT NULL,
  directive_type TEXT NOT NULL CHECK (directive_type IN
                   ('goal', 'trigger', 'site_area', 'audience')),
  description    TEXT,
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'archived')),
  created_by     TEXT NOT NULL,   -- server-derived via getChangedBy()
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_directives_project ON directives(project_key);
CREATE INDEX IF NOT EXISTS idx_directives_active
  ON directives(status) WHERE status = 'active';

-- -------------------------------------------------------------------------
-- directive_brand_status — the matrix cells.
-- UNIQUE (directive_id, brand_id): exactly one cell per directive/brand pair.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS directive_brand_status (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  directive_id UUID NOT NULL REFERENCES directives(id) ON DELETE CASCADE,
  brand_id     UUID NOT NULL REFERENCES brands(id)     ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'todo'
                 CHECK (status IN ('todo', 'in_progress', 'done', 'blocked', 'n_a')),
  note         TEXT,
  updated_by   TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (directive_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_directive_brand_status_directive
  ON directive_brand_status(directive_id);
CREATE INDEX IF NOT EXISTS idx_directive_brand_status_brand
  ON directive_brand_status(brand_id);

-- -------------------------------------------------------------------------
-- RLS — mirror migration 009: authenticated SELECT, admin FOR ALL.
-- -------------------------------------------------------------------------
ALTER TABLE directives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "directives_select_all" ON directives;
DROP POLICY IF EXISTS "directives_admin_write" ON directives;

CREATE POLICY "directives_select_all" ON directives
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "directives_admin_write" ON directives
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE directive_brand_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "directive_brand_status_select_all" ON directive_brand_status;
DROP POLICY IF EXISTS "directive_brand_status_admin_write" ON directive_brand_status;

CREATE POLICY "directive_brand_status_select_all" ON directive_brand_status
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "directive_brand_status_admin_write" ON directive_brand_status
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -------------------------------------------------------------------------
-- audit_log target-shape CHECK extension.
--
-- The constraint from migration 011 (extended by 015 for 'alert_event' and
-- 022 for 'user') only admits target_type values of quality_log /
-- test_milestone / brand / alert_event / user. The Phase A mutation routes
-- write audit rows with target_type='directive' and
-- target_type='directive_brand_status' (target_id = the row id), so the
-- constraint must admit both or every such INSERT throws a CHECK violation.
-- Same DROP + re-ADD pattern as migrations 015 / 022.
--
-- audit_log.action is unchanged: the routes reuse the CHECK-allowed 'CREATE'
-- and 'UPDATE' values with a descriptive field_name, per the codebase audit
-- convention (§13 r15/r35 precedent).
-- -------------------------------------------------------------------------
ALTER TABLE audit_log
  DROP CONSTRAINT IF EXISTS audit_log_target_shape_chk;

ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_shape_chk CHECK (
    (target_type = 'quality_log' AND log_entry_id IS NOT NULL) OR
    (target_type IN (
       'test_milestone', 'brand', 'alert_event', 'user',
       'directive', 'directive_brand_status'
     ) AND target_id IS NOT NULL)
  );

-- No seed data.
