-- Batch telemetry-ac — AC → DC telemetry ingest + System Info render.
--
-- AC (the Atlassian Forge QA-automation app) has no pollable surface: its
-- functions run only inside Jira. So AC PUSHES events to
-- POST /api/telemetry/ac and DC stores + renders them on System Info.
-- This is the first AC-authored WRITE into DC storage; every prior AC↔DC
-- surface is AC reading DC.
--
-- Spec: docs/specs/telemetry-ac.md
-- Idempotent.

-- -------------------------------------------------------------------------
-- 1. ac_telemetry — the event stream.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ac_telemetry (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_version   TEXT NOT NULL,
  commit        TEXT NOT NULL,
  event         TEXT NOT NULL CHECK (event IN (
                  'draft_ok', 'draft_error', 'post_ok', 'post_error'
                )),
  ticket        TEXT NOT NULL,
  -- error_kind is deliberately NOT CHECK-constrained. AC owns that taxonomy
  -- (auth, sharepoint_404, xlsx_parse, ...) and a CHECK here would turn an
  -- AC-side taxonomy addition into a DC migration PLUS a hard ingest failure
  -- — exactly the cross-project coupling §13 r27's blast-radius reasoning
  -- exists to avoid.
  error_kind    TEXT,
  -- Redacted + hard-truncated to 200 chars at the DC boundary before insert
  -- (lib/telemetry/redact.ts). The column is not the enforcement point; the
  -- route is. See spec §3.2 for the traceable leak path this closes.
  error_detail  TEXT,
  env           TEXT NOT NULL CHECK (env IN ('dev', 'prod')),
  -- AC's clock. DISPLAY ONLY — never used for ordering, retention or
  -- liveness, so a skewed Forge clock cannot reorder "latest event".
  ts            TIMESTAMPTZ NOT NULL,
  -- DC's clock. Orders everything.
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ac_telemetry_received_at
  ON ac_telemetry(received_at DESC);

-- The render is always prod-scoped and time-windowed (latest event, 7-day
-- error count), so this is the hot path.
CREATE INDEX IF NOT EXISTS idx_ac_telemetry_env_received
  ON ac_telemetry(env, received_at DESC);

-- Dedupe key. Protects the 7-day error COUNT from retry inflation: error
-- paths are exactly where a fire-and-forget sender retries, and duplicates
-- there would be counted as distinct incidents.
--
-- DELIBERATE WIDENING vs the review, which said (commit, event, ticket, ts):
-- `env` is included so a dev and a prod event that coincide exactly cannot
-- collide and silently drop the prod one. A retry always shares its own env,
-- so dedupe strength is unchanged.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ac_telemetry_dedupe
  ON ac_telemetry(env, commit, event, ticket, ts);

-- -------------------------------------------------------------------------
-- 2. ac_version_seen — NEVER PRUNED.
--
-- Why this table exists at all: "first event per commit" is by definition the
-- OLDEST row for that commit — precisely what retention deletes first. AC
-- deploys infrequently (that is the premise for inferring deploys from a
-- version change), so a commit live beyond the retention window would lose
-- its own first row and the derived date would silently jump FORWARD to the
-- oldest survivor. Always wrong, always in the more-recent direction, never
-- an error. A handful of rows kept forever removes the contradiction.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ac_version_seen (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env           TEXT NOT NULL CHECK (env IN ('dev', 'prod')),
  commit        TEXT NOT NULL,
  app_version   TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per (env, commit). Written with ignoreDuplicates so the FIRST write
-- wins and first_seen_at is immutable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ac_version_seen_unique
  ON ac_version_seen(env, commit);

-- -------------------------------------------------------------------------
-- 3. ac_telemetry_rejects — makes shape drift VISIBLE.
--
-- AC swallows telemetry failures by design. Without this, a payload-shape
-- regression after an AC refactor would produce: DC 400s → AC swallows →
-- System Info renders "no events in 7 days" → operator reads "AC is dead"
-- when AC is fine. A log line does not fix that, because Worker logs are not
-- on the System Info page.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ac_telemetry_rejects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason       TEXT NOT NULL,
  -- Redacted + truncated with the same helper as error_detail: a rejected
  -- payload is MORE likely to contain something unexpected, not less.
  detail       TEXT,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ac_telemetry_rejects_received_at
  ON ac_telemetry_rejects(received_at DESC);

-- -------------------------------------------------------------------------
-- 4. Retention — keep within 90 days OR the newest 500, whichever set is
--    LARGER. Expressed as: delete rows that are BOTH older than 90 days AND
--    outside the newest 500.
--
-- Called inline (fire-and-forget) from the ingest route after each insert
-- rather than from cron. Rationale (spec §5.1): no ops step for anyone to
-- forget, no new cron surface and therefore no new silent-failure class, no
-- edge function ⇒ no verify_jwt (§13 r21) and no fifth shared secret
-- (§13 r27). Volume is a handful of events per QA draft against a ≤~500-row
-- table.
--
-- SECURITY INVOKER: called with the service role, which bypasses RLS anyway.
-- Deliberately NOT SECURITY DEFINER — nothing here needs to escalate.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_ac_telemetry()
RETURNS TABLE (telemetry_deleted INTEGER, rejects_deleted INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_keep_rows   CONSTANT INTEGER  := 500;
  v_keep_window CONSTANT INTERVAL := INTERVAL '90 days';
  v_total       INTEGER;
  v_tel         INTEGER := 0;
  v_rej         INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO v_total FROM ac_telemetry;

  -- Early exit: under the row floor, the 90-day rule can never delete
  -- anything, because the newest-500 set covers the whole table.
  IF v_total > v_keep_rows THEN
    WITH keep AS (
      SELECT id FROM ac_telemetry
      ORDER BY received_at DESC
      LIMIT v_keep_rows
    )
    DELETE FROM ac_telemetry t
    WHERE t.received_at < NOW() - v_keep_window
      AND NOT EXISTS (SELECT 1 FROM keep k WHERE k.id = t.id);
    GET DIAGNOSTICS v_tel = ROW_COUNT;
  END IF;

  -- Rejects follow the same window but have no row floor: they are a
  -- diagnostic signal, not history worth preserving past the window.
  DELETE FROM ac_telemetry_rejects
  WHERE received_at < NOW() - v_keep_window;
  GET DIAGNOSTICS v_rej = ROW_COUNT;

  telemetry_deleted := v_tel;
  rejects_deleted   := v_rej;
  RETURN NEXT;
END;
$$;

-- -------------------------------------------------------------------------
-- 5. RLS — admin-only SELECT, service-role write.
--
-- LOAD-BEARING, not boilerplate. app/dashboard/settings/system/page.tsx is a
-- CLIENT component reading through lib/supabase/client — the anon key, which
-- is RLS-bound. supabaseAdmin covers the WRITE side only. Without an explicit
-- SELECT policy the AC section renders EMPTY WITH NO ERROR.
--
-- Posture mirrors login_events (023): admin-only SELECT via public.is_admin(),
-- and no INSERT/UPDATE/DELETE policy for `authenticated` — every write is
-- service-role from the ingest route, matching the append-only convention in
-- 016 and 018.
-- -------------------------------------------------------------------------
ALTER TABLE ac_telemetry         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_version_seen      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ac_telemetry_rejects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_telemetry_admin_select"         ON ac_telemetry;
DROP POLICY IF EXISTS "ac_version_seen_admin_select"      ON ac_version_seen;
DROP POLICY IF EXISTS "ac_telemetry_rejects_admin_select" ON ac_telemetry_rejects;

CREATE POLICY "ac_telemetry_admin_select" ON ac_telemetry
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "ac_version_seen_admin_select" ON ac_version_seen
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "ac_telemetry_rejects_admin_select" ON ac_telemetry_rejects
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- No audit_log rows on ingest, so audit_log_target_shape_chk needs NO
-- extension. This is not an §13 r2 violation: r2 is scoped to quality_logs,
-- and /api/monitoring/findings sets the precedent for external
-- fire-and-forget feeds ("No per-ingest audit row").
