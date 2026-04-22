-- Batch 002 Part A follow-up — brand_aliases + pause MRR-CA.
--
-- The Dev Client Review backfill surfaced 4 historical Jira brand strings
-- that don't match the canonical brands.jira_value seed. Jira's dropdown
-- now only shows the canonical names, but older tickets still carry the
-- legacy strings. Rather than rewrite history or guess at canonical
-- mappings in every consumer, route all non-canonical strings through a
-- brand_aliases table and resolve to brand_id at read time.
--
-- Also marks MRR-CA as paused (no active tests currently running).
-- Idempotent: safe to re-run.

-- -------------------------------------------------------------------------
-- brand_aliases
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brand_aliases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  jira_value   TEXT UNIQUE NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_aliases_jira_value
  ON brand_aliases(jira_value);

ALTER TABLE brand_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_aliases_read" ON brand_aliases;
CREATE POLICY "brand_aliases_read" ON brand_aliases
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "brand_aliases_admin_write" ON brand_aliases;
CREATE POLICY "brand_aliases_admin_write" ON brand_aliases
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin')
  );

-- -------------------------------------------------------------------------
-- Seed historical aliases surfaced by the first backfill run.
-- -------------------------------------------------------------------------
INSERT INTO brand_aliases (brand_id, jira_value, notes)
SELECT b.id, alias.jira_value, alias.notes
FROM (VALUES
  ('MRR',    'MRR - Mr Rooter',             'Historical variant without "Plumbing"'),
  ('PDS',    'PDS - Precision Garage Door', 'Historical variant without "Service"'),
  ('SHG',    'SHG - Shelf Genie',           'Historical variant with space'),
  ('MRR-CA', 'CA MRR - Mr. Rooter CA',      'Historical variant, different prefix order')
) AS alias(brand_code, jira_value, notes)
JOIN brands b ON b.brand_code = alias.brand_code
ON CONFLICT (jira_value) DO NOTHING;

-- -------------------------------------------------------------------------
-- Pause MRR-CA (not currently running tests).
-- -------------------------------------------------------------------------
UPDATE brands
   SET is_paused = TRUE,
       paused_at = NOW(),
       paused_by = 'system',
       paused_reason = 'Not currently running tests (set at seed time)'
 WHERE brand_code = 'MRR-CA' AND is_paused = FALSE;

-- -------------------------------------------------------------------------
-- Backfill brand_id on historical test_milestones whose brand_jira_value
-- now resolves via an alias.
-- -------------------------------------------------------------------------
UPDATE test_milestones tm
   SET brand_id = ba.brand_id
  FROM brand_aliases ba
 WHERE tm.brand_jira_value = ba.jira_value
   AND tm.brand_id IS NULL
   AND tm.is_deleted = FALSE;
