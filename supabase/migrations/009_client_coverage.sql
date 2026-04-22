-- Batch 002 Part A — Client Coverage data layer.
--
-- Adds two tables:
--   brands           — canonical per-project brand list with pause state
--   test_milestones  — first-time-reached status milestones per Jira ticket
-- Plus seeds 16 NBLY brands and a Client Coverage Drought alert rule.
-- RLS follows the pattern from migration 005 (authenticated read, admin write).

-- -------------------------------------------------------------------------
-- brands
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brands (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key       TEXT NOT NULL REFERENCES projects(jira_project_key),
  brand_code        TEXT NOT NULL,           -- e.g. "MRA"
  jira_value        TEXT UNIQUE NOT NULL,    -- matches customfield_12220 value, e.g. "MRA - Mr Appliance"
  display_name      TEXT NOT NULL,           -- e.g. "Mr. Appliance"
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_paused         BOOLEAN NOT NULL DEFAULT FALSE,
  paused_at         TIMESTAMPTZ,
  paused_by         TEXT,
  paused_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brands_project ON brands(project_key);
CREATE INDEX IF NOT EXISTS idx_brands_active ON brands(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_brands_not_paused ON brands(is_paused) WHERE is_paused = FALSE;

-- -------------------------------------------------------------------------
-- Seed 16 NBLY brands. jira_value strings match the format Jira returns on
-- customfield_12220.value. Only "MRA - Mr Appliance" is confirmed in
-- production; the rest are best-guess. The backfill script (scripts/
-- backfill-milestones.ts) logs any unmatched brand_jira_value so we can
-- patch this table if real Jira strings differ.
-- -------------------------------------------------------------------------
INSERT INTO brands (project_key, brand_code, jira_value, display_name) VALUES
  ('NBLYCRO', 'ASV',    'ASV - Aire Serv',                        'Aire Serv'),
  ('NBLYCRO', 'FSP',    'FSP - Five Star Painting',               'Five Star Painting'),
  ('NBLYCRO', 'JUK',    'JUK - Junk King',                        'Junk King'),
  ('NBLYCRO', 'MDG',    'MDG - Glass Doctor',                     'Glass Doctor'),
  ('NBLYCRO', 'MLY',    'MLY - Molly Maid',                       'Molly Maid'),
  ('NBLYCRO', 'MOJ',    'MOJ - Mosquito Joe',                     'Mosquito Joe'),
  ('NBLYCRO', 'MRH',    'MRH - Mr Handyman',                      'Mr. Handyman'),
  ('NBLYCRO', 'MRA',    'MRA - Mr Appliance',                     'Mr. Appliance'),
  ('NBLYCRO', 'MRR',    'MRR - Mr Rooter Plumbing',               'Mr. Rooter Plumbing'),
  ('NBLYCRO', 'MRR-CA', 'MRR-CA - Mr Rooter Plumbing (CA)',       'Mr. Rooter Plumbing (CA)'),
  ('NBLYCRO', 'MRE',    'MRE - Mr Electric',                      'Mr. Electric'),
  ('NBLYCRO', 'PDS',    'PDS - Precision Garage Door Service',    'Precision Garage Door Service'),
  ('NBLYCRO', 'RBW',    'RBW - Rainbow Restoration',              'Rainbow Restoration'),
  ('NBLYCRO', 'GUY',    'GUY - Grounds Guys',                     'Grounds Guys'),
  ('NBLYCRO', 'SHG',    'SHG - ShelfGenie',                       'ShelfGenie'),
  ('NBLYCRO', 'WDG',    'WDG - Window Genie',                     'Window Genie')
ON CONFLICT (jira_value) DO NOTHING;

-- -------------------------------------------------------------------------
-- test_milestones — first-time-reached status milestones per ticket.
-- Partial unique index on (ticket, milestone_type) WHERE is_deleted = FALSE
-- enforces "only one active milestone per (ticket, type)" while still
-- allowing soft-deleted rows to coexist.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_milestones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_ticket_id    TEXT NOT NULL,
  jira_ticket_url   TEXT,
  jira_summary      TEXT,
  brand_id          UUID REFERENCES brands(id),
  brand_jira_value  TEXT,
  milestone_type    TEXT NOT NULL DEFAULT 'dev_client_review',
  reached_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source            TEXT NOT NULL DEFAULT 'webhook'
                      CHECK (source IN ('webhook','manual','backfill')),
  created_by        TEXT NOT NULL DEFAULT 'system',
  notes             TEXT,
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_milestones_unique
  ON test_milestones(jira_ticket_id, milestone_type)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_test_milestones_brand ON test_milestones(brand_id);
CREATE INDEX IF NOT EXISTS idx_test_milestones_reached ON test_milestones(reached_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_milestones_not_deleted
  ON test_milestones(is_deleted) WHERE is_deleted = FALSE;

-- -------------------------------------------------------------------------
-- RLS — mirror migration 005: authenticated SELECT, admin FOR ALL.
-- -------------------------------------------------------------------------
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brands_select_all" ON brands;
DROP POLICY IF EXISTS "brands_admin_write" ON brands;

CREATE POLICY "brands_select_all" ON brands
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "brands_admin_write" ON brands
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE test_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_milestones_select_active" ON test_milestones;
DROP POLICY IF EXISTS "test_milestones_admin_write" ON test_milestones;

CREATE POLICY "test_milestones_select_active" ON test_milestones
  FOR SELECT TO authenticated
  USING (is_deleted = FALSE);

CREATE POLICY "test_milestones_admin_write" ON test_milestones
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -------------------------------------------------------------------------
-- Seed drought alert rule. alert_rules.rule_name is not UNIQUE, so guard
-- with WHERE NOT EXISTS to keep the migration idempotent. Teams dispatch
-- isn't wired yet; this rule will surface in alert_events + the in-app
-- panel once the rule engine picks it up.
-- -------------------------------------------------------------------------
INSERT INTO alert_rules (rule_name, rule_type, config, created_by)
SELECT
  'Client Coverage Drought',
  'frequency_pattern',
  '{"scope":"brand_coverage","threshold":2,"window_days":28,"skip_paused":true}'::jsonb,
  'system'
WHERE NOT EXISTS (
  SELECT 1 FROM alert_rules WHERE rule_name = 'Client Coverage Drought'
);
