-- Batch "single-brand onboarding" — Karen K1.
--
-- Spec: docs/specs/batch-single-brand-onboarding.md. §9 is Karen's 26
-- findings; §9.7 is the fix order. This migration is §9.7 item 1's DB half.
-- Jenny pre-flight: APPROVE (2026-08-26). §9.6 corrects §4's "Jenny — not
-- required".
--
-- WHY THIS EXISTS. audit_log_target_shape_chk does not admit
-- target_type='project'. Both handlers in app/api/admin/projects/route.ts
-- therefore hit their audit-failure branch, which returns HTTP 200 with an
-- `auditError` field — and callApi() in the settings page only tests
-- `!res.ok`, so the UI prints a green success message. 100% of project
-- creates and edits land with zero audit rows. That is the §13 r19 exposure
-- the batch exists to close.
--
-- SCOPE. This file is Part 1 of what was drafted as a two-part migration.
-- Part 2 — create_single_brand_project(), the atomic single-brand create
-- closing Karen K2 — was SPLIT OUT AND HELD on 2026-08-26. It is not in this
-- file and has no migration number yet. Reasons, recorded so the split is not
-- read as an oversight:
--
--   · Its stated caller did not exist. The draft's own comment said "the
--     route calls this", present tense, about work that had not been done.
--   · Its audit loops read the input jsonb rather than the committed row,
--     under a comment claiming falsification was impossible by construction.
--   · Wiring it is a UI redesign, not a rewire: the function takes project
--     and brand in one call, while the shipped wizard is two phases whose
--     copy reads "Leaving now is safe."
--
-- Part 1 does not depend on Part 2 and closes K1 completely on its own.
--
-- ⚠ RUN THIS FILE WHOLE. Do not paste it statement by statement. The
-- BEGIN/COMMIT below is explicit because no other migration in this repo has
-- one, and a partial run of a labelled file is a plausible mistake.
--
-- ⚠ DO NOT RUN MID-SYNC. ADD CONSTRAINT without NOT VALID validates every
-- existing row and takes ACCESS EXCLUSIVE on audit_log for the duration,
-- blocking audited writes. jira-sync fires at 00:00 / 06:00 / 12:00 / 18:00
-- UTC. The table is small on current data, so this is brief — re-derive the
-- row count at the moment you quote it rather than trusting a figure written
-- here (r43).
--
-- Idempotent: DROP CONSTRAINT IF EXISTS before ADD. Safe to re-run.
-- Touches no existing row's data: no UPDATE, no DELETE, no backfill, no
-- INSERT. It does READ every existing row, to validate them.

-- -------------------------------------------------------------------------
-- RUN THIS FIRST, BEFORE THE TRANSACTION BELOW.
--
-- Everything here rests on 025's definition being what is actually installed,
-- with no intervening manual DROP. Confirm it rather than assuming it:
--
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'audit_log_target_shape_chk';
--
-- Expect the two-branch shape with exactly these seven target_id values:
--   test_milestone, brand, alert_event, user, directive,
--   directive_brand_status, monitoring_finding
--
-- If it differs, STOP and reconcile before running this file.
-- -------------------------------------------------------------------------

BEGIN;

-- -------------------------------------------------------------------------
-- audit_log target-shape CHECK admits 'project'.
--
-- Reproduces migration 025's FULL allowed set PLUS 'project'. No value 025
-- admitted is dropped. Same DROP + re-ADD pattern as 011 / 015 / 022 / 024 /
-- 025 — this is the sixth definition of this constraint.
--
-- Chain of custody, verified 2026-08-26 rather than assumed:
--   011 (quality_log, test_milestone, brand)
--   015 (+ alert_event)
--   022 (+ user)
--   024 (+ directive, directive_brand_status)
--   025 (+ monitoring_finding)   ← latest; 026:211 and 028:38-39 confirm
--                                   they changed nothing
--   030 (+ project)
--
-- audit_log.action needs NO change: 'CREATE' and 'UPDATE' are both already
-- admitted by the original CHECK at 001:70-72.
--
-- The route already writes target_id = <project id> (route.ts:203, 368), so
-- both handlers satisfy the second branch the moment 'project' is admitted.
-- No route change is required for the write to LAND — only for the page to
-- stop swallowing auditError, which ships in the same commit as this file.
--
-- ⚠ THE COMMENT ABOVE IS NOT THE CHECK. This is the sixth hand-copy of that
-- allowed set, and the only thing protecting it is a comment claiming
-- fidelity — §13 r38's shape exactly, where the comment asserting parity IS
-- the tell. Two further values are already named in unbuilt specs
-- (root_cause_taxonomy, convert_deployment), so there will be a seventh copy.
-- Filed as L4: a test asserting the INSTALLED pg_get_constraintdef contains
-- every target_type literal present in the codebase. Not built here.
-- -------------------------------------------------------------------------

ALTER TABLE audit_log
  DROP CONSTRAINT IF EXISTS audit_log_target_shape_chk;

ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_target_shape_chk CHECK (
    (target_type = 'quality_log' AND log_entry_id IS NOT NULL) OR
    (target_type IN (
       'test_milestone', 'brand', 'alert_event', 'user',
       'directive', 'directive_brand_status', 'monitoring_finding',
       'project'
     ) AND target_id IS NOT NULL)
  );

COMMIT;

-- -------------------------------------------------------------------------
-- Post-migration checks (commented out — Lacey runs manually).
-- -------------------------------------------------------------------------
-- 1. The installed definition now admits 'project' and still admits all seven:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'audit_log_target_shape_chk';
--
-- 2. A project write now produces audit rows. Create or edit a project through
--    Settings → Projects, then:
--   SELECT field_name, new_value, changed_by, changed_at
--     FROM audit_log
--    WHERE target_type = 'project'
--    ORDER BY changed_at DESC LIMIT 20;
--
--    Expect rows. Before this migration the correct expectation was zero, and
--    the UI reported success either way — which is the whole defect.
--
-- 3. Nothing that worked before stopped working. Trigger any other audited
--    write (a brand pause, a directive cell edit) and confirm its row lands.
--
-- ⚠ Check 2 is a HAND-RUN OBSERVATION, NOT COVERAGE. Nothing in this repo
-- re-runs it. If the constraint is redefined a seventh time without 'project',
-- project audit rows silently stop and the UI will report success exactly as
-- it does today. That is L4's case.
