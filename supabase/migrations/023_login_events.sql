-- Batch login-events — login-activity recording (plumbing only, no UI).
--
-- Durably records every SUCCESSFUL login so a later read-only batch can
-- render a per-user count / GitHub-style heatmap over real history. There is
-- no visible surface yet — this batch only starts capturing the data so the
-- history exists when the read side ships. Rows are written fire-and-forget
-- from the login page by the now-authenticated client (insert-own RLS).
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS login_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Read side is always "this user's events, most recent first" (heatmap/count).
CREATE INDEX IF NOT EXISTS idx_login_events_user_occurred
  ON login_events(user_id, occurred_at DESC);

ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_events_admin_select" ON login_events;
DROP POLICY IF EXISTS "login_events_insert_own" ON login_events;

-- Admins can read all login activity (the future heatmap/count is admin-only).
-- Mirrors the public.is_admin() pattern used across the other tables (005/016).
CREATE POLICY "login_events_admin_select" ON login_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- A signed-in user may insert only their OWN login event — auth.uid() equals
-- user_profiles.id (which FKs auth.users.id), so the fire-and-forget insert
-- from the just-authenticated client passes. No public/anon access.
CREATE POLICY "login_events_insert_own" ON login_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE / DELETE policy: rows are append-only from the client. The service
-- role bypasses RLS for any future maintenance / the read-side aggregation.
