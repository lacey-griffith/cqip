-- Batch 004.6 — pre-demo security batch.
--
-- Bundles three RLS-layer fixes from the 2026-04-28 read-only
-- permissions review (Findings 1, 5, 11). Lands atomically because
-- all three are related cleanup on the same surface (RLS + role
-- protection) and because a Tue May 5 demo is handing out a
-- read-only guest credential.
--
--   Fix 1 (Finding 1) — BEFORE UPDATE trigger on user_profiles
--     blocks non-admin mutations of role / is_active. Closes the
--     privilege-escalation hole where a read-only user could run
--     `supabase.from('user_profiles').update({ role: 'admin' })`
--     from dev tools — the existing `user_profiles_self_update`
--     policy in migration 005 is row-level only, with no column
--     restriction.
--
--   Fix 2 (Finding 5) — drop `audit_log_admin_insert`. Vestigial
--     after Batch 004.3 moved every audit writer to a server route
--     using the service role. Today the policy lets an admin
--     fabricate audit rows from dev tools, undermining
--     tamper-evidence (§13 rule 19).
--
--   Fix 3 (Finding 11) — tighten audit_log SELECT to admins only.
--     `changed_by` contains user emails; guest creds may leave the
--     room. The audit page already gates UI on isAdmin, but a
--     read-only user can SELECT audit_log directly via supabase-js.
--
-- Idempotent.

-- =========================================================================
-- Fix 1 — protect user_profiles.role / user_profiles.is_active
-- =========================================================================
--
-- Why a trigger and not a column-level GRANT/REVOKE:
--   - Postgres RLS is row-level only; you can't add WITH CHECK clauses
--     scoped to specific columns.
--   - Column-level revokes against `authenticated` would also block
--     supabase-js SELECTs that happen to project these columns
--     (e.g. the audit page reading `user_profiles.role` to label rows),
--     which is more disruption than the privilege-escalation fix needs.
--   - A BEFORE UPDATE trigger is cheap, surgical, and auditable.
--
-- Why SECURITY INVOKER:
--   - We need auth.uid() of the actual caller. SECURITY DEFINER would
--     evaluate auth.uid() in the function-owner's context (typically
--     postgres / supabase_admin) and return NULL, which would silently
--     short-circuit the guard via the auth.uid() IS NOT NULL check
--     and approve every mutation.
--
-- Why the auth.uid() IS NOT NULL guard:
--   - /api/admin/users/route.ts uses supabaseAdmin (service role) to
--     change `is_active` and `role` on legitimate admin actions
--     (deactivate user, role change). Service-role context has no
--     auth.uid(); without this guard the trigger would brick the
--     admin user-management page.
--   - The guard is safe: a non-service-role caller always has a
--     populated auth.uid() — there is no "anonymous mutation" path
--     because RLS already requires authenticated for UPDATE.

CREATE OR REPLACE FUNCTION public.user_profiles_protect_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (NEW.role IS DISTINCT FROM OLD.role
          OR NEW.is_active IS DISTINCT FROM OLD.is_active)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change role or is_active'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_protect_privileged_columns
  ON public.user_profiles;

CREATE TRIGGER user_profiles_protect_privileged_columns
  BEFORE UPDATE OF role, is_active ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.user_profiles_protect_privileged_columns();

-- =========================================================================
-- Fix 2 — drop the vestigial audit_log admin INSERT policy
-- =========================================================================
--
-- Originally added in migration 012 to let admin-initiated milestone /
-- brand audit writes succeed from the browser. Batch 004.3 retrofitted
-- every writer to use a server route + service-role insert; the policy
-- has been unreachable from production code since. Removing it closes
-- the dev-tools tampering vector (an admin INSERTing fabricated rows
-- with arbitrary changed_by). Service-role writes continue to bypass
-- RLS exactly as before.
--
-- No replacement policy. After this migration runs, the only writer of
-- audit_log is the service role, called from within server routes that
-- derive changed_by via lib/audit/get-changed-by.ts (§13 rule 19).

DROP POLICY IF EXISTS "audit_log_admin_insert" ON audit_log;

-- =========================================================================
-- Fix 3 — admin-only SELECT on audit_log
-- =========================================================================
--
-- Renaming the policy to match its new behavior (select_all -> select_admin).
-- The audit page already gates its UI on isAdmin; this brings the wire
-- protocol in line so a read-only user can no longer exfiltrate the audit
-- trail (which contains user emails in changed_by) via direct supabase-js.
-- Service role continues to bypass RLS for the radara-sweep / future
-- analytics paths.

DROP POLICY IF EXISTS "audit_log_select_all" ON audit_log;
DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;

CREATE POLICY "audit_log_select_admin" ON audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- No UPDATE / DELETE policy. Audit rows remain append-only; service-role
-- writers (server routes) continue to bypass RLS. No INSERT policy as of
-- this migration — every audit writer goes through a server route.


-- =========================================================================
-- Hand-verification snippets (do not run in migration)
-- =========================================================================
--
-- Run these in the Supabase SQL editor authed as the indicated role.
-- Each snippet documents the expected outcome inline.
--
-- (1) As read-only user 'katy': self-promotion attempt should fail
--     with insufficient_privilege (SQLSTATE 42501).
--
--     UPDATE user_profiles SET role = 'admin' WHERE id = auth.uid();
--     -- Expect: ERROR  Only admins can change role or is_active
--
-- (2) As read-only user 'katy': updating own theme should succeed.
--     Demonstrates the trigger lets benign self-updates through.
--
--     UPDATE user_profiles SET theme_preference = 'dark' WHERE id = auth.uid();
--     -- Expect: UPDATE 1
--
-- (3) As admin 'lacey': promoting another user should succeed.
--     Demonstrates admins still pass public.is_admin() and can mutate
--     role on any row.
--
--     UPDATE user_profiles SET role = 'admin' WHERE email = 'mark@cqip.local';
--     -- Expect: UPDATE 1
--     -- (Remember to revert: UPDATE ... SET role = 'read_only' ...)
--
-- (4) As any authenticated user: SELECT audit_log returns 0 rows for
--     read-only callers, full count for admins.
--
--     SELECT count(*) FROM audit_log;
--     -- Expect (read-only): 0
--     -- Expect (admin):     <full row count>
--
-- (5) As any authenticated admin: INSERT into audit_log should fail.
--     Demonstrates Fix 2 — there is no admin INSERT policy any more,
--     so direct browser inserts are blocked even for admins.
--
--     INSERT INTO audit_log (action, target_type, target_id, changed_by)
--       VALUES ('UPDATE', 'brand', gen_random_uuid(), 'tampering-test');
--     -- Expect: ERROR  new row violates row-level security policy for table "audit_log"
--
-- Service-role bypass spot-check (from a server route, not the SQL editor):
--   /api/admin/users PATCH that toggles is_active on an existing user
--   must continue to succeed. The auth.uid() IS NOT NULL guard on the
--   trigger lets the service role through.
