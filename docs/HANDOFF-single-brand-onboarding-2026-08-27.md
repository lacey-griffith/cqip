# Handoff — batch "single-brand onboarding" (2026-08-27)

Supersedes `HANDOFF-single-brand-onboarding-2026-08-26.md`. That file is stale
in three places and should be deleted, not consulted: it says the §9 Karen
review is uncommitted (it is committed), it says Jenny is required *for the
batch* (Jenny already ran and approved the migration that needed her), and its
open question was answered.

Full detail lives in the repo: **`docs/specs/batch-single-brand-onboarding.md`**
— §9 is Karen's 26 findings, §9.7 the fix order, §2.2.5 the flow decision.

---

## Read this first: what shipped, and what it means

**Karen K1 is CLOSED. Migration 030 is applied to production.**

`030_audit_log_project_target.sql` — `audit_log_target_shape_chk` now admits
`target_type='project'`. Applied 2026-08-27 03:07 UTC, verified three ways: the
constraint definition queried directly before AND after, and a live project edit
that wrote a real audit row (`display_name`, one row for the one changed field,
`changed_by` server-derived). The audit-gap banner did not fire, which is the
negative half of the test.

`app/dashboard/settings/projects/page.tsx` — `callApi()` used to test only
`!res.ok`, so a 200 carrying `auditError` printed as a green success. It now
returns `auditError` and all four write sites surface it in a **page-level
banner**, not in `error`. That was deliberate: the write succeeded so it is not
an error, and `error` renders only inside the add-project card (K7), so an edit
or toggle warning would have landed off-screen.

**Verified state at handoff:** 456 tests pass, `tsc --noEmit` clean, `eslint`
clean, all on Lacey's Mac. Both files committed and pushed.

⚠ **Not confirmed at handoff: whether the Actions run fired for that push.**
`page.tsx` is outside `paths-ignore` so it should have. Since run #48 a static
prod SHA has three possible causes — tests red, nothing fired, still building —
and `/api/health` cannot distinguish them. **Check the Actions log first thing.**

⚠ **Possibly uncommitted:** the spec §2.2.5 strike (see below) was written to
disk at the end of the session. `git status` will say. It is docs-only.

---

## The one question that has been asked three times and not answered

**K3 — keep "leave HDCRO unconfigured and use it as the acceptance test," or
hand-fix it in SQL now?**

Lacey chose "leave it" on 2026-08-26 **on a false premise**: the spec §5 said
nothing schedules an HDCRO sync. Karen verified in prod that `cron.job` id 1 is
`0 */6 * * *`, active, POSTing to `functions/v1/jira-sync`, with **no project
predicate** in the function's working set.

HDCRO's only protection is having zero logs (verified 0 total). If it ever gains
one, §0.4's null-overwrite runs: `jira-sync:631` writes `client_brand`
unconditionally in the **unguarded** column block, and `resolveBrandForSync()`
returns `null` for a multi-brand project whose configured field matches nothing
and whose `default_brand_id` is NULL.

**Recommendation is unchanged — leave it.** Zero logs, no ingestion pointed at
it, and configuring it through the shipped UI is the only live acceptance proof
available. But the call was made on bad input and is not on the record as
re-confirmed. **Ask once, take the answer, move on.**

---

## Decision made 2026-08-27, recorded in spec §2.2.5

**The single-brand create becomes ONE FORM, ONE TRANSACTION.**

Karen K2 falsified §2.2.5's claim that "no half-state is invisible": brand POST
succeeds + project PATCH fails leaves `multi_brand` + field id + 1 brand, which
every `brandConfigChecks()` branch reads as clean. It badges "Configured" and
the retry 409s.

**An `intended_brand_model` column was considered and REJECTED (Lacey).** Its
only job would be recording what a UI wizard meant — a client concern taking
permanent schema surface — and it has no honest backfill, since HDCRO's value is
"unknown". It would also leave the failure mode live and merely visible.
Unreachable beats visible beats silent.

**What the change deletes, stated so it is not rediscovered as a regression:**
the finish panel, its "Step 2 of 2" copy, and its **"Leaving now is safe"** line.
That sentence is TRUE today (the project exists after step 1) and FALSE under one
transaction (nothing exists until submit).

§2.2.5 was **struck in place** rather than contradicted from §9 — the failure
mode the batch-012 §2.6 incident established.

---

## Part 2 — drafted, Jenny-reviewed, HELD. Five fixes owed before it can run.

`create_single_brand_project(p_project jsonb, p_brand jsonb, p_changed_by text)
RETURNS projects`. **It has no migration number and is not on disk** — the
combined draft was deleted after the split. It must be rewritten.

**Why it was held, and this is the part worth reading slowly:** the draft passed
456 tests, `tsc`, and `eslint`. Jenny found two CRITICALs anyway, and both were
**claims, not code**:

- **C1** — the file's own comment said "the route calls this," present tense,
  about a caller that did not exist. Repo-wide grep found only two `.rpc(` call
  sites in the entire codebase and neither was this one.
- **C2** — the audit loops iterate `jsonb_each_text(p_project)`, auditing the
  **input** rather than the committed row, directly beneath a comment claiming
  falsification was impossible by construction. Three concrete failures: an
  unconsumed `default_brand_id` key produces a row contradicting the explicit
  block (same target, same field, same timestamp, opposite values); `is_active:
  null` audits NULL while the row holds TRUE; `is_active` omitted audits nothing
  while the row holds TRUE. `audit_log` has no UPDATE or DELETE policy
  (`014:22-23`), so every one of those is permanent.

**The five fixes, all from Jenny:**

1. **C2** — derive every audit row from `v_project` / `v_brand`, never from the
   input jsonb. Both composites are already in hand. Makes falsification
   impossible by construction rather than by caller discipline.
2. **H1** — do not rely on `019:37-38`'s column default to carry the intermediate
   row past `019:90-93`'s CHECK. Use an explicit literal. Dropping that default
   is the natural follow-up to *this very batch* — it is the batch's own
   diagnosis of how HDCRO got misconfigured — and nothing in the repo connects
   the two files. Changing its value is harmless; only dropping it breaks you.
   `DEFERRABLE` is not available (Postgres forbids it on CHECK); reordering is
   not available (the FK at `009:14` is not deferrable). A `CONSTRAINT TRIGGER …
   DEFERRABLE INITIALLY DEFERRED` replacing `019:90-93` is the structurally
   correct answer and belongs in its own batch.
3. **H2** — `p_changed_by` is caller-supplied and unvalidated, against §13 r19's
   "universally". Under `SECURITY INVOKER` an anon caller who got past a grant
   regression writes nothing (RLS stops them), but an **authenticated admin
   passes `public.is_admin()` on all three tables**, so INVOKER is no second line
   of defence for them — a grant regression becomes permanent audit forgery
   rather than a no-op. Add `IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION`.
   Three lines, makes the grant belt-and-braces instead of the sole guard.
4. **M1** — schema-qualify the function and all four grant statements, per
   026/027's own corrected precedent (`public.prune_ac_telemetry()` throughout).
5. **M2** — the verification block used `information_schema.role_routine_grants`,
   which is role-filtered and gives no negative proof. **That is the instrument
   that missed the 026 hole.** What caught it was `027:36-39`'s live anon-key
   curl. Use `SELECT proacl FROM pg_proc WHERE proname = …` plus an anon POST
   expecting 401/403.

**Confirmed correct in the draft and worth keeping:** the grants themselves
(`REVOKE` from PUBLIC **and** `authenticated` **and** `anon` is precisely 027's
fix — Supabase's `ALTER DEFAULT PRIVILEGES` issues explicit grants to those two
roles that `REVOKE … FROM PUBLIC` does not touch, which is why 026 stayed
anon-callable); `SECURITY INVOKER` over `DEFINER`; forcing the brand's
`project_key` from the inserted project rather than trusting the caller, which is
stronger than the route; and the three-statement ordering, which is forced.

**What the DB would accept that TS rejects** — the pattern is that absent
required keys fail loudly (23502) and present-but-garbage keys are accepted
silently. The three brand-config columns are genuinely un-diverge-able. The two
that matter: `jira_project_key` is neither uppercased nor pattern-checked
(`route.ts:121-127` does both), so `'hdcro'`, `''`, `'A-B!'` all pass and produce
a project no ingestion will ever match; and `brand_code` is entirely unvalidated
with no CHECK on the column either. Plus untrimmed names and URL, `is_active:
"false"` casting to false, and **M5 — `deactivated_at` is not set when the RPC
creates an inactive project**, reopening the gap `route.ts:296-298` closed.

**Do NOT put validation in plpgsql.** That manufactures the validator/SQL
divergence K6 already flagged. The route validates in TypeScript; the RPC exists
for atomicity only.

**Three things Jenny answered that would otherwise get re-litigated:** `CREATE OR
REPLACE` does **not** break when `projects` gains a column (`prorettype` is an
OID; the type's definition changes, not its OID) — but it does refuse a parameter
rename, and the grants are pinned to `(JSONB, JSONB, TEXT)`, so a signature
change creates an overload while grant-locking only the old one. Rollback has no
bad state: Part 1 is first and independent, and the function's absence regresses
nothing because nothing calls it. And `ADD CONSTRAINT` without `NOT VALID`
**does** touch existing rows — it validates every one and takes ACCESS EXCLUSIVE
for the duration, so it must not run mid-sync.

---

## The 25 open findings, sorted by agent mode

Applying the board's own rule: **auto where failure is LOUD, manual where it is
SILENT or writes to prod, Jenny-gated manual regardless.**

### AUTO — 18. One pass, then Karen, then Lacey pushes.

Auto does not mean skipping Karen. It means not stopping to check in.

```
K6    Delete the tautological test — it re-derives the validator's own guards
      from the validator's own output and cannot fail. §3.3 cites it as proof.
      The proposition is true; the test is not the evidence. Delete, don't keep
      as ceremony.
K9    deactivated_at written whenever is_active is present, without comparing
      to stored. Re-submitting is_active:false destroys the real timestamp AND
      emits an audit row asserting a deactivation that did not happen.
K10   role="alert" banner asserts one failure mechanism for five checks. For
      DEFAULT_BRAND_FOREIGN sync resolves a brand fine — the wrong client's —
      and writes a non-empty wrong value. The findings row below states the
      truth, so the banner contradicts the check it summarises.
K11   Findings list gated on !isEditing, so fix instructions vanish the moment
      the fixing tool opens, unrecoverable without losing typed changes.
K12   asTrimmedString coerces any non-string to null, so a garbage
      default_brand_id reads as "clear the fallback" and 200s. Same class:
      brand_model:null becomes a silent multi_brand create on POST.
K13   Single-brand PATCH submitting only brand_jira_field_id force-nulls it,
      matches stored null, returns 200 {unchanged:true}. Input silently
      discarded with no field naming it.
K14   jira_project_key IS UNIQUE (001:5) so no duplicate can be created, but
      the losing racer gets 500 with the raw constraint string rendered into
      the UI — against project-config.ts's own promise.
K16   Default-brand Select lists only that project's active brands, so a
      foreign or inactive stored value renders as the placeholder —
      indistinguishable from unset — while still being submitted.
K17   toggleActive rebuilds from the projects value in its own closure instead
      of a functional updater. Two quick toggles revert each other on screen
      while both writes land.
K18   §0.2's "verified" rows are false as of §3.3, same document, same date.
K19   §6.4 requires "test 1 verified red against main first", which §3.1 says
      is impossible. Unsignable acceptance item.
K20   jira-sync/index.ts:630 is jira_summary; client_brand is :631. Wrong
      pointer in checks.ts:7, checks.ts:134, and 013:110.
K21   §8's "three lines above it" is 52 lines (019:37-38 vs 019:90-93), in a
      different section. The wrong figure INVERTS the lesson — the hazard is
      that defaults and the constraint depending on them sit far apart.
K22   013 §5.4 still names the nonexistent FK/CHECK cycle as its migration
      step. The §1.3 correction did not propagate.
K23   checks.ts is 203 lines, not 202.
K24   "Mirrors brands/route.ts exactly" — that route is POST only. PATCH,
      deactivated_at, immutability rejection and the changed-only audit filter
      have nothing to mirror.
K25   "One audit row per submitted field" — POST maps Object.keys(newRow),
      always 8 rows, including nulls the caller never sent.
K27   NEW, found 2026-08-26, not in Karen's 26. route.ts:27-30 says
      brands.project_key and quality_logs.project_key join "with no FK" and a
      rename would "orphan every row silently". BOTH FALSE — 009:14 and 001:19
      are FKs, and a rename would be BLOCKED, not silent. Immutability is still
      right; its stated reason asserts the inverse of the schema. §3.3 repeats
      it as one of three things flagged for Karen's attention and §9.5 cleared
      the surrounding claims without touching it.
```

### MANUAL — 7. Each needs a decision or writes to prod.

```
K2    Part 2. Decided, Jenny-gated, writes to prod.
K3    The HDCRO call. Yes/no. See above.
K4    getChangedBy() throws when there is no user — contradicting its own
      header comment "We never throw" — and is called AFTER the write commits
      in both handlers with no try/catch. Token expiry mid-request → 500 with
      the project already created → the retry 409s a project the admin was
      told failed. Needs a decision on what the user sees.
K5    `edit` is snapshotted at startEdit and never re-derived while three
      handlers call loadProjects(). saveEdit resubmits all six fields
      unconditionally, so an open expander is a full-row overwrite from a
      snapshot of unknown age. Finishing the two-step flow with an expander
      open then saving wipes the single-brand config and reports success.
      State-machine judgment, not a mechanical fix.
K7    message and error render in exactly ONE place — inside the add-project
      card. Every finish-panel, edit-expander and toggle failure appears
      there, often off-screen. The finish panel's empty-field guard returns
      before setSaving(true), so it shows nothing at all and reads as a dead
      button. Worked around for the audit banner; still true everywhere else.
      Layout call.
K8    Badge contrast fails AA at 12px: resolved 2.28:1, medium 1.92:1,
      default 2.56:1 in dark. Only critical passes. --f92-gray is
      theme-swapped, text-white is not — the standing shape. SILENT failure,
      in the column this batch exists to make readable, and G5a instance 5 was
      exactly this defect shipped inside an accessibility batch.
K15   None of the three loads uses .range(), against lib/client-library/
      paged-fetch.ts's rule that this repo has been bitten by three times.
      Nothing wrong at 101 live logs. Past 1,000 the log count under-reports
      AND SO DOES activeBrandCount, which drives the badges — and heap order
      drops the most-recently-updated rows first. Silent by construction.
```

---

## Two unexplained figures — do not let these go quiet

1. **The test count moved 443 → 456.** The 08-26 handoff recorded 443/443; the
   08-27 run reports 456. **Nobody in this session added a test.** Either the 443
   was stale when written or thirteen tests landed from somewhere else. Cheap to
   settle: `git log` on `tests/`.
2. **L4 — the allowed set is now hand-copied SIX times**, protected only by a
   comment claiming fidelity. That is §13 r38's exact shape: the comment
   asserting parity IS the tell. Two further values are already named in unbuilt
   specs (`root_cause_taxonomy`, `convert_deployment`), so a seventh copy is
   coming. The mechanism is a test asserting the **installed**
   `pg_get_constraintdef` contains every `target_type` literal present in the
   codebase. Filed by Jenny as out-of-scope; recorded here so it is not lost.

---

## Also owed, non-blocking

- **Board update to rev 8.9.** Rev 8.8 has NO entry for this batch at all — it
  lists startable-today as #10 and #13. 013 promoted to head, 004.99 spec
  removed.
- **Delete `DRAFT-outline-rev8.md`** from project knowledge (four revisions
  stale, internally wrong).
- **Delete `HANDOFF-single-brand-onboarding-2026-08-26.md`** — superseded by this
  file.
- **CI typecheck wiring** — one line in `deploy.yml`. `.github/**` is in
  `paths-ignore` so it does not deploy. Owed since batch #3.
- **`CROSS_CLAUDE.md` four-plus batches behind** — AC-facing, needs Claudia,
  coordinated not unilateral per CC7.
- **CLAUDE.md §9 is wrong on accounts:** says 7 / 2 admin / 5 read-only all
  active; prod has 9 rows / 3 active admin / 3 active read_only / 3 deactivated.
- **The 64 archived-invisible cells** — grew from 16 with no code change.
- **013 §5.4** (K22 above) and **013 §1.3's** correction propagation.

---

## Working notes for whoever picks this up

- **Read the canonical docs from the `cqip-shared` connector before recommending
  anything.** Treat them as authoritative over any summary, including this one.
- **`cqip-shared` write is ENABLED as of 2026-08-26** (Customize → Connectors →
  cqip-shared → Tool permissions). `write_file` and `edit_file` both work. There
  is no delete tool — Lacey removes files.
- **Do not run `git` against the repo from the sandbox side.** It strands
  `.git/index.lock` (three times) and the VM cannot unlink it. Write files;
  Lacey stages, commits, pushes.
- **`npm test` cannot run from a Linux shell there:** `node_modules/@esbuild/`
  has only `darwin-arm64`. `npx tsc --noEmit` DOES work (tsc is pure JS). Lacey's
  Mac is the confirming run.
- **`npm test` is NOT the typecheck gate.** It runs under `tsx`, which strips
  types. `npx tsc --noEmit` is the real check and prints nothing when clean.
- **zsh eats `!` in commit messages** (history expansion). `set +H` first, or
  avoid the character.
- **Prod Supabase project is `hupklpjruveleaahufmw`.** The SQL editor runs the
  SELECTION if there is one — clicking into the editor first avoids running a
  fragment. This bit us once: a highlighted first line turned a filtered query
  into a full `pg_constraint` dump that read as a plausible answer.
- **Do not paste a full migration file into the SQL editor.** Strip to the
  statements. The comments live in the repo.
- **`/api/health` reports the WORKER ONLY.** It does not reflect Supabase
  edge-function deploys, and since run #48 it cannot distinguish tests-red from
  nothing-fired from still-building. **The Actions log is not optional.**
- **Figures are re-derived at the moment of writing, never transcribed (r43), and
  every figure names its QUANTITY, not only its date and method.**

---

## Suggested first three moves

1. **Check the Actions log** for the K1 push, and `git status` for the spec
   strike.
2. **Ask Lacey K3.** One question, yes/no, last live-data risk on the board.
3. **Start the 18-item auto pass.** Karen on the result, Lacey pushes.

Part 2 after that, or before it if Lacey would rather close K2 while the decision
is fresh. Both are defensible; the auto pass is the one that makes the list feel
shorter.
