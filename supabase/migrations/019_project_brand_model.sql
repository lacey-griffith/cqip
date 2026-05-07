-- Batch 005.22 Phase 1 — project-aware brand resolution.
--
-- Adds brand_model + brand_jira_field_id + default_brand_id to projects
-- so CQIP can resolve brands correctly for both multi-brand projects
-- (NBLYCRO, customfield-12220-driven) and single-brand projects
-- (SPLCRO, project IS the brand). Closes audit doc §4.5 sub-cases
-- and SPL ingestion gap.
--
-- Pre-migration verification (must be run BEFORE this migration; see
-- spec "Pre-migration verification SQL"):
--   - SELECT * FROM projects;  -- expect 2 rows: NBLYCRO, SPLCRO
--   - SELECT id FROM brands WHERE project_key='SPLCRO' AND brand_code='SPL';
--     -- expect 1 UUID
--   - SELECT COUNT(*) FROM quality_logs WHERE client_brand='SPL'
--     AND is_deleted=FALSE;  -- expect 0
--
-- Idempotent: every step uses IF NOT EXISTS or equivalent, and
-- DROP CONSTRAINT IF EXISTS before ADD CONSTRAINT. Safe to re-run
-- mid-deploy retry or recovery.

-- ---------------------------------------------------------------
-- 1. Enum type. CREATE TYPE doesn't accept IF NOT EXISTS, so wrap
-- in a DO block that swallows duplicate_object on re-run.
-- ---------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE brand_model_type AS ENUM ('multi_brand', 'single_brand');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------
-- 2. Add columns. brand_jira_field_id defaults to 'customfield_12220'
-- so every existing project (and every project added via the existing
-- admin UI before Phase 5 ships) auto-satisfies the CHECK constraint
-- below. Single-brand projects override to NULL via explicit UPDATE.
-- ---------------------------------------------------------------
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS brand_model brand_model_type NOT NULL DEFAULT 'multi_brand',
  ADD COLUMN IF NOT EXISTS brand_jira_field_id TEXT DEFAULT 'customfield_12220',
  ADD COLUMN IF NOT EXISTS default_brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------
-- 3. Configure SPLCRO as single-brand. The brand_jira_field_id is
-- nulled out (single-brand path skips field extraction entirely);
-- default_brand_id points at the SPL brand row.
-- ---------------------------------------------------------------
UPDATE projects
   SET brand_model = 'single_brand',
       brand_jira_field_id = NULL,
       default_brand_id = (
         SELECT id FROM brands
         WHERE project_key = 'SPLCRO' AND brand_code = 'SPL'
       )
 WHERE jira_project_key = 'SPLCRO';

-- ---------------------------------------------------------------
-- 4. Align SPL brand jira_value with the "CODE - Display Name"
-- convention used by multi-brand projects. Before this batch, the
-- SPL brand was inserted with jira_value='SPL' (bare brand code per
-- the AddBrandDrawer placeholder hint). Aligning to 'SPL - Spotloan'
-- makes the writeback shape uniform across all brands and matches
-- the literal-string-equality rework-count math in
-- lib/coverage/queries.ts.
-- ---------------------------------------------------------------
UPDATE brands
   SET jira_value = 'SPL - Spotloan'
 WHERE project_key = 'SPLCRO'
   AND brand_code = 'SPL'
   AND jira_value = 'SPL';

-- ---------------------------------------------------------------
-- 5. Conditional: if any quality_logs rows already carry the old
-- bare-code 'SPL' client_brand, propagate the rename. UNCOMMENT ONLY
-- if pre-migration verification step 4 returned > 0. The SPL brand
-- shipped 2026-05-07 so this is unlikely to be needed.
-- ---------------------------------------------------------------
-- UPDATE quality_logs
--    SET client_brand = 'SPL - Spotloan'
--  WHERE client_brand = 'SPL'
--    AND is_deleted = FALSE;

-- ---------------------------------------------------------------
-- 6. CHECK constraint. multi-brand requires brand_jira_field_id
-- (default ensures every existing row qualifies). single-brand
-- requires default_brand_id. Multi-brand MAY ALSO set default_brand_id
-- as an escape-hatch fallback for tickets with empty brand fields —
-- the constraint permits this combo; the resolution chain treats
-- default_brand_id as the final fallback after brands → aliases.
-- ---------------------------------------------------------------
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_brand_model_config_chk;
ALTER TABLE projects ADD CONSTRAINT projects_brand_model_config_chk CHECK (
  (brand_model = 'multi_brand' AND brand_jira_field_id IS NOT NULL) OR
  (brand_model = 'single_brand' AND default_brand_id IS NOT NULL)
);

-- ---------------------------------------------------------------
-- 7. Post-migration sanity checks (commented out — Lacey runs manually).
-- ---------------------------------------------------------------
-- SELECT jira_project_key, brand_model, brand_jira_field_id, default_brand_id
-- FROM projects ORDER BY jira_project_key;
--   Expect:
--     NBLYCRO | multi_brand  | customfield_12220 | NULL
--     SPLCRO  | single_brand | NULL              | <SPL brand uuid>

-- SELECT brand_code, jira_value FROM brands WHERE project_key='SPLCRO';
--   Expect: SPL | SPL - Spotloan
