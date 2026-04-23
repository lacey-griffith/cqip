-- Batch 002.5b hotfix — audit_log was never given an INSERT policy for
-- authenticated users (migration 005 intentionally left it off because the
-- original writers were edge functions using the service role). Milestone
-- and brand audit writes shipped in 002.5b go through the browser client
-- and get silently rejected by RLS.
--
-- Fix: allow admins (active, role='admin') to INSERT directly. Keep the
-- table append-only from the client — no UPDATE or DELETE policy. Service
-- role continues to bypass RLS as before, so edge-function writes
-- (quality_logs create/update via jira-webhook) are unaffected.

DROP POLICY IF EXISTS "audit_log_admin_insert" ON audit_log;

CREATE POLICY "audit_log_admin_insert" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
        AND user_profiles.is_active = TRUE
    )
  );

-- Intentionally no UPDATE or DELETE policy for authenticated. Audit rows
-- are append-only from the client side; history stays tamper-evident.
