-- Batch 005.10 — sync_runs cache table for jira-sync observability.
--
-- Persists the outcome of every jira-sync invocation (manual + cron)
-- so admins have a durable pass/fail signal next to the Sync button
-- and so silent cron failures stop being possible.
--
-- Writes happen exclusively from the jira-sync edge function via the
-- service role (one INSERT at start, one UPDATE at end). The Worker
-- proxy at /api/jira/sync forwards an `X-Triggered-By` header so the
-- function can attribute manual clicks vs cron invocations.
--
-- RLS posture matches Batch 004.6 audit_log cleanup: authenticated
-- SELECT for everyone (read-only users see the indicator too —
-- visibility is universally useful), no INSERT/UPDATE/DELETE policies
-- for `authenticated` since service-role writes bypass RLS.

CREATE TABLE sync_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by    TEXT NOT NULL,        -- 'manual:<email>' | 'cron:jira-sync-6h'
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  status          TEXT NOT NULL CHECK (status IN ('running','success','failed')),
  logs_updated    INTEGER,
  logs_failed     INTEGER,
  error_category  TEXT CHECK (
                    error_category IS NULL OR
                    error_category IN ('auth_mismatch','jira_401','jira_500','network','unknown')
                  ),
  error_message   TEXT,
  duration_ms     INTEGER
);

CREATE INDEX idx_sync_runs_started_at ON sync_runs(started_at DESC);
CREATE INDEX idx_sync_runs_status ON sync_runs(status);

ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_runs_select_authenticated ON sync_runs
  FOR SELECT TO authenticated USING (TRUE);

-- No INSERT/UPDATE/DELETE policies for `authenticated` — service-role
-- writes from the edge function bypass RLS, matching the append-only
-- pattern set by Batch 004.6's audit_log cleanup (migration 016).
