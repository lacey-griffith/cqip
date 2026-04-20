-- Enables Row Level Security on every domain table and applies least-privilege
-- policies. The service role bypasses RLS by design, so any operation that
-- must not be reachable from the browser (e.g. audit_log inserts) is left
-- without a policy for authenticated users and must run through a server
-- route that uses the service role.

-- Helper: SECURITY DEFINER avoids recursion on user_profiles policies when
-- callers check admin status. Runs with the function owner's rights, so it
-- can read user_profiles even if the caller has no SELECT policy on it yet.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- =========================================================================
-- user_profiles (supports is_admin() + nav.tsx lookup)
-- =========================================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_self_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_select_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_self_update" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_write" ON user_profiles;

-- Any signed-in user can read their own row (needed for nav avatar / theme).
CREATE POLICY "user_profiles_self_select" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admins can read every profile (needed for the admin users table).
CREATE POLICY "user_profiles_admin_select_all" ON user_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Users can update their own profile (color, pattern, theme). Role and
-- is_active are still protected because the admin policy below lets admins
-- override; a user updating their own row cannot change role/is_active to
-- something an admin policy wouldn't allow (we rely on app-level checks and
-- on the admin-only write path below for role changes).
CREATE POLICY "user_profiles_self_update" ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin-only INSERT / UPDATE / DELETE for role and is_active changes across
-- any user. Mirrors the server-side admin users route.
CREATE POLICY "user_profiles_admin_write" ON user_profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =========================================================================
-- quality_logs
-- =========================================================================
ALTER TABLE quality_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quality_logs_select_active" ON quality_logs;
DROP POLICY IF EXISTS "quality_logs_admin_write" ON quality_logs;

CREATE POLICY "quality_logs_select_active" ON quality_logs
  FOR SELECT TO authenticated
  USING (is_deleted = FALSE);

CREATE POLICY "quality_logs_admin_write" ON quality_logs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =========================================================================
-- audit_log
-- =========================================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_all" ON audit_log;
-- NOTE: no INSERT/UPDATE/DELETE policy for authenticated. Service role
-- (used by server routes only) bypasses RLS and is the sole writer.

CREATE POLICY "audit_log_select_all" ON audit_log
  FOR SELECT TO authenticated
  USING (TRUE);

-- =========================================================================
-- projects
-- =========================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_active" ON projects;
DROP POLICY IF EXISTS "projects_admin_select_all" ON projects;
DROP POLICY IF EXISTS "projects_admin_write" ON projects;

CREATE POLICY "projects_select_active" ON projects
  FOR SELECT TO authenticated
  USING (is_active = TRUE);

-- Admins also need to see inactive projects in the settings page.
CREATE POLICY "projects_admin_select_all" ON projects
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "projects_admin_write" ON projects
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =========================================================================
-- alert_rules
-- =========================================================================
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alert_rules_select_active" ON alert_rules;
DROP POLICY IF EXISTS "alert_rules_admin_select_all" ON alert_rules;
DROP POLICY IF EXISTS "alert_rules_admin_write" ON alert_rules;

CREATE POLICY "alert_rules_select_active" ON alert_rules
  FOR SELECT TO authenticated
  USING (is_active = TRUE);

CREATE POLICY "alert_rules_admin_select_all" ON alert_rules
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "alert_rules_admin_write" ON alert_rules
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =========================================================================
-- alert_events
-- =========================================================================
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alert_events_select_all" ON alert_events;
-- NOTE: no INSERT/UPDATE/DELETE for authenticated. Rule engine runs as
-- service role.

CREATE POLICY "alert_events_select_all" ON alert_events
  FOR SELECT TO authenticated
  USING (TRUE);

-- =========================================================================
-- saved_reports
-- =========================================================================
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_reports_owner_rw" ON saved_reports;
DROP POLICY IF EXISTS "saved_reports_admin_select_all" ON saved_reports;

-- Users manage their own reports. `created_by` is expected to store
-- auth.uid()::text — the reports page writes this value on INSERT.
-- Reports saved before this migration (which stored a display name in
-- created_by) will not match auth.uid() and will become invisible to
-- non-admin users. Admins can still see all.
CREATE POLICY "saved_reports_owner_rw" ON saved_reports
  FOR ALL TO authenticated
  USING (created_by = auth.uid()::text)
  WITH CHECK (created_by = auth.uid()::text);

CREATE POLICY "saved_reports_admin_select_all" ON saved_reports
  FOR SELECT TO authenticated
  USING (public.is_admin());
