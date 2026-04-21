-- Radara — CQIP triage agent. This migration creates the sweep_config
-- table, seeds rows for the three daily sweeps, and schedules pg_cron
-- jobs that POST to the radara-sweep edge function.
--
-- BEFORE RUNNING: set the two Postgres settings below so the cron commands
-- point at your project. These are session-local; to persist them across
-- restarts configure them at the database level via `ALTER DATABASE`:
--
--   ALTER DATABASE postgres SET app.radara_function_url =
--     'https://<PROJECT_REF>.supabase.co/functions/v1/radara-sweep';
--   ALTER DATABASE postgres SET app.radara_service_key =
--     '<SERVICE_ROLE_KEY>';
--
-- If you skip that, the cron jobs will still be created but will fail at
-- runtime until the settings are set.

-- -------------------------------------------------------------------------
-- Extensions
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- -------------------------------------------------------------------------
-- sweep_config — one row per scheduled sweep
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sweep_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sweep_name   TEXT UNIQUE NOT NULL,
  last_run_at  TIMESTAMPTZ,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sweep_config (sweep_name, is_active)
VALUES
  ('morning', TRUE),
  ('midday',  TRUE),
  ('eod',     TRUE)
ON CONFLICT (sweep_name) DO NOTHING;

-- RLS — service role bypasses; authenticated admins can read config.
ALTER TABLE sweep_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sweep_config_admin_read" ON sweep_config;
CREATE POLICY "sweep_config_admin_read" ON sweep_config
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- -------------------------------------------------------------------------
-- Helper: invoke the radara-sweep edge function with a sweep name
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.radara_invoke_sweep(sweep TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  url TEXT := current_setting('app.radara_function_url', TRUE);
  key TEXT := current_setting('app.radara_service_key', TRUE);
  request_id BIGINT;
BEGIN
  IF url IS NULL OR key IS NULL THEN
    RAISE NOTICE 'radara_invoke_sweep: app.radara_function_url / app.radara_service_key not set; skipping';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('sweep', sweep)
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.radara_invoke_sweep(TEXT) FROM PUBLIC;

-- -------------------------------------------------------------------------
-- pg_cron schedules (UTC, CDT-locked)
--
-- 9:00 AM CT  = 14:00 UTC (CDT) / 15:00 UTC (CST)
-- 1:00 PM CT  = 18:00 UTC (CDT) / 19:00 UTC (CST)
-- 4:30 PM CT  = 21:30 UTC (CDT) / 22:30 UTC (CST)
--
-- DST is NOT handled automatically; sweeps will drift by one hour in local
-- time during CST months (early Nov through mid-Mar). Reschedule manually
-- if a consistent local-time slot is required.
-- -------------------------------------------------------------------------

-- Remove any existing jobs with these names so this migration is idempotent.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('radara-morning-sweep', 'radara-midday-sweep', 'radara-eod-sweep');

SELECT cron.schedule(
  'radara-morning-sweep',
  '0 14 * * *',
  $$ SELECT public.radara_invoke_sweep('morning'); $$
);

SELECT cron.schedule(
  'radara-midday-sweep',
  '0 18 * * *',
  $$ SELECT public.radara_invoke_sweep('midday'); $$
);

SELECT cron.schedule(
  'radara-eod-sweep',
  '30 21 * * *',
  $$ SELECT public.radara_invoke_sweep('eod'); $$
);
