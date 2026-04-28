-- Batch 004.3 — security cleanup on audit_log.
--
-- Migration 012 added an admin INSERT policy on audit_log using an
-- inline EXISTS lookup against user_profiles. The rest of the codebase
-- uses public.is_admin() (defined in migration 005), and the helper
-- additionally checks is_active = TRUE — the inline version did not.
-- This migration normalizes the policy to use the helper.
--
-- This migration was originally planned as 013, but 013 was claimed
-- by 013_brand_qa_config.sql first. No behavior change for active
-- admins; deactivated users that still happened to have role='admin'
-- can no longer INSERT into audit_log.
--
-- Idempotent.

DROP POLICY IF EXISTS "audit_log_admin_insert" ON audit_log;

CREATE POLICY "audit_log_admin_insert" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- No UPDATE / DELETE policy — audit rows stay append-only from the
-- client side. Service-role writers (edge functions for quality_logs
-- create/update via jira-webhook) continue to bypass RLS.
