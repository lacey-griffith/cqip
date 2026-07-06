-- Batch auth.2 — admin temp-password reset + forced change.
--
-- Three related schema changes land atomically:
--
--   1. user_profiles.must_change_password — the forced-change flag. Set
--      TRUE (service role) when an admin issues a temp password; cleared
--      (service role) when the user completes a password change. Middleware
--      gates every dashboard route on it until cleared.
--
--   2. [Jenny C1] audit_log_target_shape_chk — the CHECK from migration 011
--      (extended in 015 for 'alert_event') permits only
--      quality_log | test_milestone | brand | alert_event. auth.2 writes
--      audit rows for user mutations (temp-password set, role change,
--      deactivate, reset, create backfill) with target_type='user', so the
--      constraint must admit 'user' or every such INSERT throws. Same
--      idempotent DROP + re-ADD pattern migration 015 used for 'alert_event'.
--
--   3. [Jenny M1] r22 privileged-column trigger — migration 016 protects
--      role / is_active from non-admin browser writes. must_change_password
--      is equally sensitive (a read_only user could otherwise self-clear the
--      flag via the migration-005 self_update RLS policy and skip the forced
--      change). Extend the same trigger/function to cover it. Service-role
--      writers (auth.uid() IS NULL) still pass, so the route's set/clear
--      paths are unaffected.
--
-- Idempotent.

-- =========================================================================
-- Part 1 — user_profiles.must_change_password
-- =========================================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN user_profiles.must_change_password IS
  'Batch auth.2: TRUE forces a password change on next login (set by admin '
  'temp-password reset via service role; cleared by /api/account/password-changed '
  'via service role after the user changes their password). Trigger-protected '
  'against non-admin browser writes (see user_profiles_protect_privileged_columns).';

-- =========================================================================
-- Part 2 — [C1] audit_log target-shape CHECK: admit target_type='user'
-- =========================================================================
--
-- User audit rows carry target_type='user' with the user_profiles.id in
-- target_id and log_entry_id NULL. Mirror the 'alert_event' addition from
-- migration 015.
ALTER TABLE audit_log
  DROP CONSTRAINT IF EXISTS audit_log_target_shape_chk;

ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_shape_chk CHECK (
    (target_type = 'quality_log' AND log_entry_id IS NOT NULL) OR
    (target_type IN ('test_milestone', 'brand', 'alert_event', 'user') AND target_id IS NOT NULL)
  );

-- =========================================================================
-- Part 3 — [M1] extend the r22 trigger to protect must_change_password
-- =========================================================================
--
-- Same function/guard shape as migration 016. The auth.uid() IS NOT NULL
-- guard preserves the service-role bypass: /api/admin/users sets the flag
-- and /api/account/password-changed clears it, both via supabaseAdmin
-- (no auth.uid()), so both continue to pass. A non-admin browser write to
-- role, is_active, OR must_change_password now raises insufficient_privilege.
CREATE OR REPLACE FUNCTION public.user_profiles_protect_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (NEW.role IS DISTINCT FROM OLD.role
          OR NEW.is_active IS DISTINCT FROM OLD.is_active
          OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change role, is_active, or must_change_password'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_protect_privileged_columns
  ON public.user_profiles;

CREATE TRIGGER user_profiles_protect_privileged_columns
  BEFORE UPDATE OF role, is_active, must_change_password ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.user_profiles_protect_privileged_columns();

-- =========================================================================
-- Hand-verification snippets (do not run in migration)
-- =========================================================================
--
-- (1) As read-only user: self-clearing the flag should fail.
--     UPDATE user_profiles SET must_change_password = FALSE WHERE id = auth.uid();
--     -- Expect: ERROR  Only admins can change role, is_active, or must_change_password
--
-- (2) As read-only user: benign self-update still succeeds.
--     UPDATE user_profiles SET theme_preference = 'dark' WHERE id = auth.uid();
--     -- Expect: UPDATE 1
--
-- (3) Service role (server route) setting/clearing the flag succeeds
--     (auth.uid() IS NULL bypasses the guard) — exercised by
--     /api/admin/users (set) and /api/account/password-changed (clear).
--
-- (4) User-target audit row inserts without CHECK violation:
--     INSERT INTO audit_log (target_type, target_id, action, field_name, changed_by)
--       VALUES ('user', gen_random_uuid(), 'UPDATE', 'password', 'test');
--     -- Expect: INSERT 0 1  (clean up afterward)
