# Spec — single-brand onboarding, Part 2: `create_single_brand_project()`

**Status:** DRAFT, awaiting Lacey review → Jenny pre-flight → build
**Opened:** 2026-08-31
**Closes:** Karen **K2** (CRITICAL) — the two-step create can leave a half-state
that badges "Configured"
**Parent spec:** `docs/specs/batch-single-brand-onboarding.md` — §9.1 defines K2,
§2.2.5 records the flow decision, §9.7 the fix order
**Prior art:** `docs/HANDOFF-single-brand-onboarding-2026-08-27.md` — the held
draft's Jenny review, verbatim
**Migration number:** **031** (030 is applied; see §7)

---

## 0. What this is, and what was rejected

K2: brand POST succeeds, project PATCH fails, and the row lands `multi_brand` +
`brand_jira_field_id` set + 1 active brand. Every `multiBrandChecks()` branch
reads that as valid, so `brandConfigChecks()` returns the lone `ok` finding, the
findings row is suppressed, and the badge says **CONFIGURED**. Retry cannot
recover: the brand POST 409s and `finish` is never cleared.

**An `intended_brand_model` column was considered and REJECTED (Lacey,
2026-08-27).** It records a UI wizard's intent as permanent schema surface, it
has no honest backfill (HDCRO's value is "unknown"), and it leaves the failure
mode live and merely visible.

**Unreachable beats visible beats silent.** One form, one transaction.

### 0.1 What this deletes — stated so it is not rediscovered as a regression

- The finish panel
- Its "Step 2 of 2" copy
- Its **"Leaving now is safe"** line — TRUE today (the project exists after step
  1), FALSE under one transaction (nothing exists until submit)

§2.2.5 of the parent spec was struck in place rather than contradicted from §9,
per the `batch-012 §2.6` incident.

---

## 1. The five fixes owed before this can run

All five are Jenny's, from the held draft's review. **This section is the
opening section of this spec deliberately** — the draft passed 456 tests, `tsc`
and `eslint`, and Jenny still found two CRITICALs, both of which were *claims*
rather than code.

### 1.1 C2 — derive every audit row from the committed row, never the input

The held draft's audit loops iterate `jsonb_each_text(p_project)`, auditing the
**input** rather than the committed row, directly beneath a comment claiming
falsification was impossible by construction. Three concrete failures:

- An unconsumed `default_brand_id` key produces a row contradicting the explicit
  block — same target, same field, same timestamp, opposite values
- `is_active: null` audits NULL while the row holds TRUE
- `is_active` omitted audits nothing while the row holds TRUE

`audit_log` has **no UPDATE and no DELETE policy** (`014:22-23`), so every one of
those is permanent.

**Fix:** derive from `v_project` / `v_brand`. Both composites are already in
hand. This makes falsification impossible by construction rather than by caller
discipline.

### 1.2 H1 — do not lean on the column default to pass the CHECK

Do not rely on `019:37-38`'s `brand_jira_field_id` default to carry the
intermediate row past `019:90-93`'s CHECK. **Use an explicit literal.**

**Use a SENTINEL, not `'customfield_12220'`** (added 2026-09-01). e.g.
`'__transient_single_brand_create__'`. Nothing reads `brand_jira_field_id` on a
`single_brand` project (§13 r28) and statement 3 nulls it, so the value never
survives the transaction — but `customfield_12220` is *precisely* the value
HDCRO is silently misconfigured with. If it ever does leak it reads as
legitimate config; a sentinel reads as broken. There is no CHECK or format
constraint on the column, so any literal is accepted.

Dropping that default is the natural follow-up to *this very batch* — it is the
batch's own diagnosis of how HDCRO got misconfigured — and nothing in the repo
connects the two files. Changing its value is harmless; only dropping it breaks
you.

Not available: `DEFERRABLE` (Postgres forbids it on CHECK) and reordering (the FK
at `009:14` is not deferrable). A `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY
DEFERRED` replacing `019:90-93` is the structurally correct answer and **belongs
in its own batch.**

### 1.3 H2 — refuse every in-session caller

*(Retitled 2026-09-01. It read "validate the caller-supplied identity", which
named a thing this function cannot do — see the resolution below.)*

`p_changed_by` is caller-supplied and unvalidated, against §13 r19's
"universally". Under `SECURITY INVOKER` an anon caller who got past a grant
regression writes nothing (RLS stops them), but an **authenticated admin passes
`public.is_admin()` on all three tables**, so INVOKER is no second line of
defence for them. A grant regression becomes permanent audit forgery rather than
a no-op.

**✅ PREDICATE SETTLED 2026-09-01 (Jenny). The review's recorded fix —
`IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION` — is CORRECT AS RECORDED and
was never inverted.** What was wrong is the intent it got paraphrased against.

*Reject when `p_changed_by` disagrees with the authenticated identity* is
**unimplementable here**, because on the only legal call path there is no
authenticated identity to disagree with:

- `app/api/admin/projects/route.ts` gates with the cookie-bound client and
  **writes with `supabaseAdmin`** (`route.ts:186`, `:214`). §4's RPC branch
  mirrors that, so the caller is `service_role`.
- §2's grants — Jenny-cleared, and pinned by §9 acceptance item 4 — **revoke
  EXECUTE from `authenticated`**. The cookie-bound client therefore *cannot*
  call this function. That is deliberate, not an oversight.
- A service-role call carries no JWT, so inside the function `auth.uid()` IS
  NULL on every legal invocation.

So the guard is a **caller-context assertion, not an identity comparison.** Its
job is to delete the population that could forge undetectably — an in-session
admin reaching the RPC directly through PostgREST after a grant regression — and
leave the service-role route as the sole caller, where `getChangedBy()`
(`lib/audit/get-changed-by.ts`) is the verification. Build exactly this:

```sql
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
```

**Write that comment exactly that honestly.** A comment claiming the identity is
*validated* would be §1.1's C2 again — an unsupported claim three lines under the
fix for an unsupported claim.

**Do NOT substitute `current_user <> 'service_role'`.** It is the tighter
assertion, but it refuses the Supabase SQL editor (`current_user` = `postgres`),
and §5 item 5 — the forced-failure test, the one thing a passing happy path
cannot prove — is hand-run there. `auth.uid() IS NULL` holds for both
`service_role` and the SQL editor.

**The stronger form, considered and REJECTED.** Drop `p_changed_by` entirely and
derive it in-DB (`auth.uid()` → `user_profiles.email` → `auth.jwt() ->> 'email'`),
making forgery impossible by construction — the same repair as §1.1. It requires
granting EXECUTE to `authenticated`, which reopens §2, rewrites acceptance item
4, and makes the RPC directly callable by any admin through PostgREST — turning
§3.2's accepted TS/DB divergence from theoretical into reachable. The grants are
the better trade. Recorded so it is not re-litigated mid-build.

**⚠ The guard needs its own verification item or it is never exercised at all**
— §5 item 3, added in the same pass. Without it §5 tests only the grant, which
leaves the grant as the sole guard: the exact thing this fix exists to stop being
true.

### 1.4 M1 — schema-qualify

Schema-qualify the function and **all four** grant statements, per 026/027's own
corrected precedent (`public.prune_ac_telemetry()` throughout).

### 1.5 M2 — use an instrument that gives negative proof

The held draft's verification block used `information_schema.role_routine_grants`,
which is role-filtered and gives no negative proof. **That is the instrument that
missed the 026 hole.** What caught it was `027:36-39`'s live anon-key curl.

**Use:** `pg_proc.proacl` **plus** a live anon POST.

**⚠ The exact instruments live in §5 items 1–3, not here** (amended 2026-09-01).
Two details this paragraph previously stated wrongly, both corrected there: the
`pg_proc` query **must be scoped** by `pronamespace` and matched against
`pg_get_function_identity_arguments`, or §7's overload hazard slips past it; and
the anon POST **must assert the EFFECT** — not 2xx, plus zero rows created —
rather than a `401/403` status, because PostgREST can legitimately answer 403 or
404 depending on how it resolves a revoked function against the schema cache.
**Cite §5. Do not re-derive an instrument from this paragraph.**

---

## 2. Confirmed correct in the held draft — keep these

Jenny cleared all of the following. They are not open questions.

- **The grants.** `REVOKE` from PUBLIC **and** `authenticated` **and** `anon` is
  precisely 027's fix — Supabase's `ALTER DEFAULT PRIVILEGES` issues explicit
  grants to those two roles that `REVOKE … FROM PUBLIC` does not touch, which is
  why 026 stayed anon-callable.
- **`SECURITY INVOKER`** over `DEFINER`.
- **Forcing the brand's `project_key` from the inserted project** rather than
  trusting the caller — stronger than the route.
- **The three-statement ordering**, which is forced by the constraints.

---

## 3. Signature and shape

```
public.create_single_brand_project(
  p_project    jsonb,
  p_brand      jsonb,
  p_changed_by text
) RETURNS projects
```

`SECURITY INVOKER`. Grants pinned to `(JSONB, JSONB, TEXT)`.

**Ordering, forced:**

1. `INSERT INTO projects` — `brand_model = 'multi_brand'` with an **explicit
   literal** `brand_jira_field_id` (§1.2), returning into `v_project`
2. `INSERT INTO brands` — `project_key` taken from `v_project`, not the caller,
   returning into `v_brand`
3. `UPDATE projects SET brand_model = 'single_brand', brand_jira_field_id = NULL,
   default_brand_id = v_brand.id` — returning into `v_project`

Then audit rows, every value read from `v_project` / `v_brand` (§1.1).

**Confirmed forced 2026-09-01 (Jenny), with the receipts** — three
non-deferrable constraints admitting exactly one order, and no two-statement
form exists:

- `brands.project_key` → `projects(jira_project_key)` (`009:14`) — the project
  must exist before the brand.
- `projects_brand_model_config_chk` (`019:90-93`) — `single_brand` requires
  `default_brand_id IS NOT NULL`, so the project cannot be inserted as
  single-brand before the brand exists.
- `projects.default_brand_id` → `brands(id) ON DELETE RESTRICT` (`019:39`) — so
  it can only be set after.

**⚠ Statement 1 deliberately creates the exact half-state this batch exists to
prevent, and that is fine BECAUSE IT IS INVISIBLE:** the row is uncommitted, so
under READ COMMITTED no other session — and no `brandConfigChecks()` read — can
observe it, and a failure at statement 2 or 3 rolls it away entirely. Stated
here because Karen will otherwise read the `brand_model = 'multi_brand'` literal
in §3 statement 1 as the K2 defect being reintroduced. It is the opposite: K2 is
that half-state reaching COMMIT.

### 3.1 M5 — `deactivated_at`

Set `deactivated_at` when the RPC creates an **inactive** project. The held draft
did not, reopening the gap `route.ts:296-298` closed.

### 3.2 No validation in plpgsql

**Do NOT put validation in the function.** That manufactures the
validator/SQL divergence K6 already flagged. **The route validates in
TypeScript; the RPC exists for atomicity only.**

Known and accepted: the DB accepts what TS rejects. The pattern is that absent
required keys fail loudly (23502) and present-but-garbage keys are accepted
silently. The three brand-config columns are genuinely un-diverge-able. The two
that matter, both guarded in the route and not in the function:

- `jira_project_key` is neither uppercased nor pattern-checked
  (`route.ts:121-127` does both), so `'hdcro'`, `''`, `'A-B!'` all pass and
  produce a project no ingestion will ever match
- `brand_code` is entirely unvalidated, with no CHECK on the column either

Plus untrimmed names and URL, and `is_active: "false"` casting to false.

**Confirmed 2026-09-01 (Jenny) — hold this, unchanged. Two validators drift,
plpgsql validation is unreachable by `node:test` (§5.1), and K6 is the failure
you would be manufacturing.**

**But the DB-side guarantee has a right instrument, and it is not this
function: a CHECK constraint on the column.** A CHECK is a single declarative
definition with nothing to diverge from — it is a constraint, not a second
validator, so it does not create the K6 shape. Both of §3.2's named gaps
(`jira_project_key` pattern, `brand_code`) belong there. **Land them in the
batch §8 already scopes** for dropping `019:37-38`'s default and replacing
`019:90-93` with a `CONSTRAINT TRIGGER` — same file, same reasoning, one
migration. Not here.

---

## 4. The caller ships in the same commit

**C1 was a comment claiming a caller that did not exist**, present tense.
Repo-wide grep found only two `.rpc(` call sites in the codebase and neither was
this one.

**Rule for this batch: the migration and its call site land in one commit.** A
function with no caller is not a shipped fix, and a comment saying otherwise is a
G5a instance.

- `app/api/admin/projects/route.ts` — POST gains a single-brand branch calling
  `.rpc('create_single_brand_project', …)`
- `app/dashboard/settings/projects/page.tsx` — the two-step create collapses to
  one form; §0.1's three deletions apply

---

## 5. Verification

Run in this order. Items 1–3 are run in the SQL editor / by curl against the
installed function; 4–6 exercise it through the app. **Renumbered 2026-09-01**
when item 3 was added — there were five items, and item 4 was the forced failure.

1. **The grants, with negative proof (§1.5).** Scope the query or an overload
   (§7's hazard) slips past it:
   ```sql
   SELECT p.proacl, pg_get_function_identity_arguments(p.oid)
     FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'create_single_brand_project';
   ```
   Expect **exactly one row**, `proacl` **NOT NULL**, containing `service_role=X/`
   and **no** `anon=` and **no** `authenticated=`.
   **⚠ A NULL `proacl` is a FAILURE, not a pass.** NULL means no explicit ACL was
   ever recorded — i.e. default privileges apply, which is EXECUTE to PUBLIC. It
   renders as blank in the psql output, which reads like "no grants". This is the
   same class of instrument error as §1.5's `role_routine_grants`: an absence
   that looks like a clean result.
2. **Anon-key POST against the RPC endpoint (§1.5) — assert the EFFECT, not the
   status code.** A revoked RPC can answer 403 *or* 404 depending on how
   PostgREST resolves it against the schema cache, so a test pinned to 401/403
   can fail on a correct outcome. Expect **not 2xx**, *and*
   `SELECT count(*) FROM projects WHERE jira_project_key = '<probe key>'`
   returns 0. Shape per `027:36-39`.
3. **The §1.3 H2 guard — WITHOUT THIS ITEM THE PREDICATE IS NEVER EXERCISED AT
   ALL**, and items 1–2 leave the grant as the sole guard, which is what §1.3
   exists to stop being true. In the SQL editor:
   ```sql
   BEGIN;
   SET LOCAL ROLE authenticated;
   SET LOCAL request.jwt.claims = '{"sub":"<a real admin user uuid>","role":"authenticated"}';
   SELECT public.create_single_brand_project('{}'::jsonb, '{}'::jsonb, 'probe@fusion92.com');
   ROLLBACK;
   ```
   Expect the **`42501` RAISE from the guard** — not a permission-denied on the
   function, and not a `23502`. If `auth.uid()` still returns NULL, the installed
   helper reads a different GUC than the one set above: check it with
   `SELECT pg_get_functiondef('auth.uid'::regproc);` and set whichever it reads.
   Getting a permission error instead means the role cannot reach the function at
   all, which proves item 1 and leaves this item unproven — run it as `postgres`
   with `SET LOCAL request.jwt.claims` alone in that case.
4. Happy path through the UI: a Spotloan-shaped client created start to finish,
   then the row verified in prod. **This is also the POSITIVE CONTROL for items
   1–2** — a REVOKE that clipped `service_role`'s own grant looks identical to a
   passing negative test until the UI breaks, which is why `027:41-45` pairs its
   anon curl with a service-role one. Do not skip it as "just the happy path".
5. **Forced failure at statement 2 or 3** — confirm no `projects` row survives.
   This is the whole point of the batch and it is the one item that cannot be
   proven by a passing happy path.
6. `SELECT * FROM audit_log WHERE target_type = 'project' ORDER BY changed_at
   DESC` — every row's value matches the committed row, not the submitted payload

### 5.1 What cannot be tested, stated rather than implied

`node:test` cannot reach plpgsql. There is no live PostgREST in the test
environment. **Item 5 is a hand-run observation, not coverage** — the same
distinction the G7 batch drew for its skip link and the 409 runbook drew for
Scenario A.

**Do not write a test that re-derives the function's behaviour from the
function's own output.** That is K6, and §3.1 of the parent spec is the standing
warning.

---

## 6. Gates

- **Jenny** — REQUIRED. New migration, new mutation path. Pre-flight before
  Claudette builds. **§1.3's predicate was settled ahead of that round
  (2026-09-01) — it is no longer an open question; confirm the built code matches
  the block in §1.3 rather than re-deriving it.**
- **Karen** — REQUIRED, post-flight on the built diff. Direct her at: whether any
  audit row can still be sourced from the input jsonb, and whether the collapsed
  form can fail in a way the badge misses.
- **Lacey** — pushes. Manual mode throughout; Jenny-gated is manual regardless.

---

## 7. Rollback

**No bad state is reachable.** Part 1 (migration 030) is first, applied, and
independent. The function's absence regresses nothing because — before §4 lands —
nothing calls it.

Two facts Jenny answered that would otherwise get re-litigated:

- **`CREATE OR REPLACE` does not break when `projects` gains a column.**
  `prorettype` is an OID; the type's definition changes, not its OID. But it
  **does** refuse a parameter rename, and the grants are pinned to
  `(JSONB, JSONB, TEXT)` — so a signature change creates an overload while
  grant-locking only the old one.
- **`ADD CONSTRAINT` without `NOT VALID` does touch existing rows.** It validates
  every one and takes ACCESS EXCLUSIVE for the duration. **It must not run
  mid-sync** — the cron is `0 */6 * * *`.

---

## 8. Out of scope

- **K9, K25, K4** — considered as ride-alongs and **declined.** The 08-27 handoff
  sorts K9 and K25 into the 18-item **AUTO** pass; folding them into a
  Jenny-gated manual batch converts them to manual and slows both. K4 is a
  MANUAL item needing its own decision on what the user sees.
- **Dropping `019:37-38`'s default**, and the `CONSTRAINT TRIGGER` replacement
  for `019:90-93` — §1.2 names both as their own batch.
- **L4** — the allowed `target_type` set is now hand-copied **six times**,
  protected only by a comment claiming fidelity. §13 r38's exact shape: the
  comment asserting parity IS the tell. Two more values are already named in
  unbuilt specs (`root_cause_taxonomy`, `convert_deployment`), so a seventh copy
  is coming. Mechanism when it is built: a test asserting the **installed**
  `pg_get_constraintdef` contains every `target_type` literal present in the
  codebase. Filed by Jenny as out-of-scope.
- Validation in plpgsql — §3.2.

---

## 9. Acceptance

1. A single-brand client is created start to finish in one form, and the prod row
   reads `single_brand` with a non-null `default_brand_id`.
2. A forced failure at statement 2 or 3 leaves **no** `projects` row (§5 item
   5 — hand-run, and recorded as such).
3. Every `target_type='project'` audit row's value matches the committed row.
4. `proacl` is **non-null** and shows `service_role` but no `anon` and no
   `authenticated` execute grant (a NULL `proacl` FAILS this item — §5 item 1);
   an anon POST is refused with no row created (§5 item 2); and an in-session
   caller hits the §1.3 guard's `42501` (§5 item 3).
5. `npx tsc --noEmit` clean. `npm test` green on Lacey's Mac.

> **⚠ Parent spec §6.4 must be amended in the same commit.** It requires "test 1
> verified red against `main` first", which §3.1 says is impossible. That is K19,
> and it is an unsignable acceptance item as written.
