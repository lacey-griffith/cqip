-- Batch "single-brand onboarding" Part 2 — Karen K2.
--
-- Spec: docs/specs/batch-single-brand-part2-rpc.md. Cite by section number;
-- the spec was settled 2026-09-01 and is not re-derived here.
-- Part 1: migration 030 (audit_log admits target_type='project') — APPLIED.
--
-- WHY THIS EXISTS (spec §0). The two-step single-brand create can leave a
-- half-state that badges "Configured": the brand POST succeeds, the project
-- PATCH fails, and the row lands multi_brand + brand_jira_field_id set + 1
-- active brand. Every multiBrandChecks() branch reads that as valid, so the
-- findings row is suppressed and the badge says CONFIGURED. Retry cannot
-- recover — the brand POST 409s. An intended_brand_model column was considered
-- and REJECTED (Lacey, 2026-08-27): it records a wizard's intent as permanent
-- schema surface and leaves the failure mode live and merely visible.
--
-- Unreachable beats visible beats silent. One form, one transaction.
--
-- DEPENDS ON 030. The audit writes below use target_type='project', which
-- audit_log_target_shape_chk did not admit before 030. Do not apply this file
-- against a database where 030 has not run: every call would fail at the audit
-- insert and roll back the whole create.
--
-- ⚠ DO NOT RUN MID-SYNC. CREATE OR REPLACE FUNCTION takes no lock on projects
-- or brands, so this file itself is cheap — but the function it installs writes
-- to both tables plus audit_log in one transaction. jira-sync fires at 00:00 /
-- 06:00 / 12:00 / 18:00 UTC.
--
-- Idempotent: CREATE OR REPLACE, and the grants are absolute (REVOKE then
-- GRANT), not additive. Safe to re-run. Touches no existing row.
--
-- ⚠ CREATE OR REPLACE refuses a PARAMETER RENAME, and the grants below are
-- pinned to (JSONB, JSONB, TEXT) — so a signature change creates an OVERLOAD
-- while grant-locking only the old one (spec §7). If the signature must change,
-- DROP the old function in the same file.

-- -------------------------------------------------------------------------
-- public.create_single_brand_project()
--
-- Creates a single-brand project and its one brand in ONE transaction, so the
-- half-state above is unreachable rather than merely visible.
--
-- NO VALIDATION LIVES IN HERE, DELIBERATELY (spec §3.2). The route validates in
-- TypeScript; this function exists for atomicity only. Two validators drift, and
-- a plpgsql copy is unreachable by node:test. Known and accepted: the DB accepts
-- what TS rejects — absent required keys fail loudly (23502) and
-- present-but-garbage keys are accepted silently. jira_project_key is neither
-- uppercased nor pattern-checked here, and brand_code is unvalidated. The right
-- instrument for those is a CHECK constraint on the column, not code in this
-- function; spec §3.2 routes them to the batch that drops 019:38's default.
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_single_brand_project(
  p_project    JSONB,
  p_brand      JSONB,
  p_changed_by TEXT
)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project   public.projects;
  v_brand     public.brands;
  v_is_active BOOLEAN;
BEGIN
  -- p_changed_by is caller-supplied and CANNOT be verified in-DB: the only legal
  -- caller is service_role, which carries no JWT, so there is no identity here to
  -- compare it against. This guard does not verify the value. It refuses every
  -- in-session caller, so the value can only have come from the route, where
  -- getChangedBy() derived it from auth.uid() per CLAUDE.md §13 r19.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION
      'public.create_single_brand_project is service-role only; refusing in-session caller %',
      auth.uid()
      USING ERRCODE = '42501';
  END IF;

  IF p_changed_by IS NULL OR btrim(p_changed_by) = '' THEN
    RAISE EXCEPTION 'p_changed_by is required' USING ERRCODE = '22023';
  END IF;

  IF p_changed_by LIKE 'system:%' THEN
    RAISE EXCEPTION 'p_changed_by must not use the system: namespace (§13 r20)'
      USING ERRCODE = '22023';
  END IF;

  -- §3.2: '"false"' casts to false, garbage raises 22P02 loudly, absent is TRUE.
  v_is_active := COALESCE((p_project->>'is_active')::BOOLEAN, TRUE);

  -- -----------------------------------------------------------------------
  -- Statement 1 of 3. Ordering is FORCED by three non-deferrable constraints
  -- (spec §3): brands.project_key → projects(jira_project_key) (009:14) means
  -- the project must exist first; projects_brand_model_config_chk (019:90-93)
  -- requires default_brand_id on a single_brand row, which cannot exist yet;
  -- projects.default_brand_id → brands(id) (019:39) means it can only be set
  -- after. No two-statement form exists.
  --
  -- ⚠ THIS DELIBERATELY CREATES THE EXACT HALF-STATE THE BATCH EXISTS TO
  -- PREVENT, AND THAT IS FINE BECAUSE IT IS INVISIBLE: the row is uncommitted,
  -- so under READ COMMITTED no other session — and no brandConfigChecks() read —
  -- can observe it, and a failure at statement 2 or 3 rolls it away entirely.
  -- K2 is that half-state reaching COMMIT.
  --
  -- brand_jira_field_id is an EXPLICIT SENTINEL, not the 019:38 column default
  -- (spec §1.2). Two reasons: leaning on that default to pass the CHECK breaks
  -- the day the default is dropped — which is this batch's own diagnosis of how
  -- HDCRO got misconfigured, and a scoped follow-up — and 'customfield_12220'
  -- would read as legitimate config if it ever leaked. A sentinel reads as
  -- broken. Statement 3 nulls it; nothing reads it on a single_brand project
  -- (§13 r28).
  -- -----------------------------------------------------------------------
  INSERT INTO public.projects (
    jira_project_key,
    client_name,
    display_name,
    jira_project_url,
    is_active,
    deactivated_at,
    brand_model,
    brand_jira_field_id,
    default_brand_id
  ) VALUES (
    p_project->>'jira_project_key',
    p_project->>'client_name',
    p_project->>'display_name',
    p_project->>'jira_project_url',
    v_is_active,
    -- §3.1 (M5). The route writes deactivated_at on every is_active change
    -- (route.ts:296-298); an RPC that created an inactive project without it
    -- would reopen the gap that closed.
    CASE WHEN v_is_active THEN NULL ELSE now() END,
    'multi_brand',
    '__transient_single_brand_create__',
    NULL
  )
  RETURNING * INTO v_project;

  -- -----------------------------------------------------------------------
  -- Statement 2 of 3. project_key is taken from the INSERTED PROJECT, never
  -- from p_brand — stronger than the route, and the reason p_brand has no
  -- project_key key at all (spec §2).
  -- -----------------------------------------------------------------------
  INSERT INTO public.brands (
    project_key,
    brand_code,
    jira_value,
    display_name,
    is_active
  ) VALUES (
    v_project.jira_project_key,
    p_brand->>'brand_code',
    p_brand->>'jira_value',
    p_brand->>'display_name',
    COALESCE((p_brand->>'is_active')::BOOLEAN, TRUE)
  )
  RETURNING * INTO v_brand;

  -- -----------------------------------------------------------------------
  -- Statement 3 of 3. The sentinel is nulled here; this is the row that commits.
  -- -----------------------------------------------------------------------
  UPDATE public.projects
     SET brand_model         = 'single_brand',
         brand_jira_field_id = NULL,
         default_brand_id    = v_brand.id
   WHERE id = v_project.id
  RETURNING * INTO v_project;

  -- -----------------------------------------------------------------------
  -- Audit. EVERY VALUE IS READ FROM v_project / v_brand — the committed rows —
  -- AND NEVER FROM p_project / p_brand (spec §1.1, Jenny C2).
  --
  -- This is not a style preference. audit_log has NO UPDATE and NO DELETE policy
  -- (014:22-23), so a false row is permanent. Auditing the input would let an
  -- unconsumed key produce a row contradicting the row that actually committed:
  -- an unconsumed default_brand_id contradicting the explicit block, is_active
  -- null auditing NULL while the row holds TRUE, is_active omitted auditing
  -- nothing while the row holds TRUE. Reading the composites makes falsification
  -- impossible BY CONSTRUCTION rather than by caller discipline.
  --
  -- ⚠ DO NOT "SIMPLIFY" THIS INTO jsonb_each_text(p_project). That is the exact
  -- shape Jenny rejected in the held draft, and it was sitting under a comment
  -- claiming falsification was impossible.
  --
  -- Note what the project rows therefore say: brand_model='single_brand',
  -- brand_jira_field_id=NULL, default_brand_id=<the brand> — the committed
  -- values, not statement 1's transient ones. The transient sentinel is audited
  -- nowhere because it never committed.
  --
  -- Field list mirrors route.ts POST's 8 (route.ts:200-201) so the two create
  -- paths produce the same audit shape. deactivated_at is written above but not
  -- audited, matching that route.
  -- -----------------------------------------------------------------------
  INSERT INTO public.audit_log (
    log_entry_id, target_type, target_id, action,
    field_name, old_value, new_value, changed_by, notes
  )
  SELECT
    NULL, 'project', v_project.id, 'CREATE',
    f.field_name, NULL, f.new_value, p_changed_by,
    'Project created via admin UI (single-brand, atomic)'
  FROM (VALUES
    ('jira_project_key',    v_project.jira_project_key),
    ('client_name',         v_project.client_name),
    ('display_name',        v_project.display_name),
    ('jira_project_url',    v_project.jira_project_url),
    ('is_active',           v_project.is_active::TEXT),
    ('brand_model',         v_project.brand_model::TEXT),
    ('brand_jira_field_id', v_project.brand_jira_field_id),
    ('default_brand_id',    v_project.default_brand_id::TEXT)
  ) AS f(field_name, new_value);

  INSERT INTO public.audit_log (
    log_entry_id, target_type, target_id, action,
    field_name, old_value, new_value, changed_by, notes
  )
  SELECT
    NULL, 'brand', v_brand.id, 'CREATE',
    f.field_name, NULL, f.new_value, p_changed_by,
    'Brand created via admin UI (single-brand, atomic)'
  FROM (VALUES
    ('project_key',  v_brand.project_key),
    ('brand_code',   v_brand.brand_code),
    ('jira_value',   v_brand.jira_value),
    ('display_name', v_brand.display_name),
    ('is_active',    v_brand.is_active::TEXT)
  ) AS f(field_name, new_value);

  RETURN v_project;
END;
$$;

-- -------------------------------------------------------------------------
-- Grants. FOUR statements, all schema-qualified and pinned to the signature
-- (spec §1.4), following 027's corrected precedent.
--
-- REVOKE ... FROM PUBLIC alone is NOT ENOUGH and was verified insufficient
-- against production for prune_ac_telemetry (027:3-16): Supabase ships
-- ALTER DEFAULT PRIVILEGES granting EXECUTE on new public-schema functions to
-- anon and authenticated, and those are EXPLICIT grants to named roles that the
-- PUBLIC revoke does not touch.
--
-- Revoking `authenticated` is deliberate and load-bearing, not collateral: it is
-- what makes the cookie-bound client unable to reach this function, which is
-- what makes auth.uid() reliably NULL on every legal call, which is what the
-- guard at the top of the body asserts (spec §1.3).
-- -------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.create_single_brand_project(JSONB, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_single_brand_project(JSONB, JSONB, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.create_single_brand_project(JSONB, JSONB, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_single_brand_project(JSONB, JSONB, TEXT) TO service_role;

-- -------------------------------------------------------------------------
-- Post-migration verification (commented out — Lacey runs manually).
-- Spec §5, in this order. Items 1-3 run here; 4-6 exercise the app.
--
-- 1. The grants, with NEGATIVE proof. Scoped, or an overload slips past it:
--
--   SELECT p.proacl, pg_get_function_identity_arguments(p.oid)
--     FROM pg_proc p
--    WHERE p.pronamespace = 'public'::regnamespace
--      AND p.proname = 'create_single_brand_project';
--
--    Expect EXACTLY ONE row, proacl NOT NULL, containing service_role=X/ and
--    no anon= and no authenticated=.
--    ⚠ A NULL proacl is a FAILURE, not a pass. NULL means no explicit ACL was
--    ever recorded — default privileges apply, which is EXECUTE to PUBLIC — and
--    it renders as blank, which reads like "no grants". Same class of instrument
--    error as information_schema.role_routine_grants, which missed the 026 hole.
--
-- 2. Anon-key POST to /rest/v1/rpc/create_single_brand_project — assert the
--    EFFECT, not the status code. A revoked RPC can answer 403 OR 404 depending
--    on how PostgREST resolves it against the schema cache.
--    Expect NOT 2xx, and:
--      SELECT count(*) FROM projects WHERE jira_project_key = '<probe key>';  -- 0
--
-- 3. The §1.3 guard. WITHOUT THIS ITEM THE PREDICATE IS NEVER EXERCISED AT ALL,
--    and items 1-2 leave the grant as the sole guard — the thing §1.3 exists to
--    stop being true.
--
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<a real admin user uuid>","role":"authenticated"}';
--   SELECT public.create_single_brand_project('{}'::jsonb, '{}'::jsonb, 'probe@fusion92.com');
--   ROLLBACK;
--
--    Expect the 42501 RAISE from the guard — not a permission-denied on the
--    function, and not a 23502. If auth.uid() still returns NULL, the installed
--    helper reads a different GUC than the one set above:
--      SELECT pg_get_functiondef('auth.uid'::regproc);
--    and set whichever it reads. A permission error instead means the role
--    cannot reach the function at all, which proves item 1 and leaves this item
--    unproven — run it as postgres with SET LOCAL request.jwt.claims alone.
--
-- 4. Happy path through the UI: a Spotloan-shaped client, start to finish, then
--    the row verified in prod. THIS IS ALSO THE POSITIVE CONTROL FOR ITEMS 1-2 —
--    a REVOKE that clipped service_role's own grant looks identical to a passing
--    negative test until the UI breaks (027:41-45 pairs its curls for this
--    reason). Do not skip it as "just the happy path".
--
-- 5. FORCED FAILURE at statement 2 or 3 — confirm no projects row survives.
--    The whole point of the batch, and the one item a passing happy path cannot
--    prove. Easiest probe: submit a jira_value that already exists (the UNIQUE
--    on brands.jira_value fails statement 2), then:
--      SELECT count(*) FROM projects WHERE jira_project_key = '<the key>';  -- 0
--
-- 6. SELECT * FROM audit_log WHERE target_type = 'project'
--     ORDER BY changed_at DESC;
--    Every row's value matches the COMMITTED row, not the submitted payload.
--
-- ⚠ Item 5 is a HAND-RUN OBSERVATION, NOT COVERAGE (spec §5.1). node:test
-- cannot reach plpgsql and there is no live PostgREST in the test environment.
-- Nothing in this repo re-runs any of the six. Same distinction the G7 batch
-- drew for its skip link and the 409 runbook drew for Scenario A.
-- -------------------------------------------------------------------------
