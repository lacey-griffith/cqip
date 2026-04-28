-- Batch 004 — extend the existing brands table (migration 009) with QA
-- automation config fields used by the external Forge app. Storage and
-- read API only — no Forge integration code lives in this repo.
--
-- Schema strategy: extend brands; do NOT introduce a parallel
-- brand_configs table (existing brand_code, display_name, project_key,
-- jira_value already cover the canonical identity).
--
-- API exposure rule: GET /api/brands/* only returns rows where
-- qa_automation_enabled = TRUE. Disabled rows return 404 even when
-- present.
--
-- Idempotent.

-- -------------------------------------------------------------------------
-- New columns
-- -------------------------------------------------------------------------
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS live_url_base TEXT
    CHECK (live_url_base IS NULL OR (live_url_base LIKE 'https://%' AND live_url_base NOT LIKE '%/'));

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS default_local_sub_areas TEXT[];

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS client_contact_name TEXT;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS client_contact_jira_account_id TEXT;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS url_pattern TEXT
    CHECK (url_pattern IS NULL OR url_pattern IN ('convert-preview','live-qa'));

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS qa_automation_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Partial index on enabled rows — the Forge consumer's hot path is
-- "list QA-enabled brands for projectKey", so the WHERE clause keeps the
-- index tight.
CREATE INDEX IF NOT EXISTS idx_brands_qa_automation_enabled
  ON brands(qa_automation_enabled)
  WHERE qa_automation_enabled = TRUE;

-- -------------------------------------------------------------------------
-- RLS — additive admin UPDATE policy specifically for the QA config
-- columns. The existing brands_admin_write policy from migration 009
-- already grants admins full CRUD via FOR ALL, so this policy is
-- belt-and-suspenders / discoverability. Uses public.is_admin() per the
-- migration-005 helper convention. Existing policies are NOT modified.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "brands_admin_qa_config_update" ON brands;

CREATE POLICY "brands_admin_qa_config_update" ON brands
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -------------------------------------------------------------------------
-- Seed: GUY and RBW already exist as rows (seeded by migration 009).
-- We UPDATE them, never INSERT. The other 14 NBLY brands are untouched.
-- Lacey fills the remaining QA fields (sub-areas, contact, notes) via the
-- admin UI.
-- -------------------------------------------------------------------------
UPDATE brands
   SET live_url_base         = 'https://groundsguys.com',
       url_pattern           = 'convert-preview',
       qa_automation_enabled = TRUE,
       updated_at            = NOW()
 WHERE project_key = 'NBLYCRO'
   AND brand_code  = 'GUY';

UPDATE brands
   SET live_url_base         = 'https://rainbowrestores.com',
       url_pattern           = 'convert-preview',
       qa_automation_enabled = TRUE,
       updated_at            = NOW()
 WHERE project_key = 'NBLYCRO'
   AND brand_code  = 'RBW';
