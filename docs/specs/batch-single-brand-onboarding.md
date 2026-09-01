# Batch — Single-brand onboarding (project brand config in the UI)

**Status:** spec, unbuilt
**Opened:** 2026-08-26
**Size:** half a day. Ships independently of Batch 013.
**Why it's separate:** it is a defect fix, not new capability. 013 depends on the
onboarding path being correct; proving it first de-risks the migration.

---

## 0. Verification record

Every figure below was read from prod (`hupklpjruveleaahufmw`) or from the file
named, on 2026-08-26. Nothing is carried over from a prior document.

### 0.1 Correction to Batch 013 §1.3 — the "hard cycle" does not exist

013 §1.3 claims a `single_brand` project cannot be created because the
`019` CHECK requires `default_brand_id`, which requires a brand, which requires a
project. **That is wrong, and the real defect is worse.**

- `019:36-39` gives `brand_jira_field_id` the column default `'customfield_12220'`
  and `brand_model` the default `'multi_brand'`.
- So `addProject()`'s four-column insert **satisfies the CHECK and succeeds.**
- The constraint text is at `019:90-93`, not `:92-96` as 013 states.

There is no cycle and nothing is blocked. A single-brand client is created
**silently misconfigured as multi-brand** — no error, no warning, no UI signal.
A blocked insert would have been self-announcing. This isn't.

013 §1.3 is corrected in the same commit as this spec.

### 0.2 What the UI can and cannot reach — verified

| Column | Set at creation? | Editable after? | Where |
|---|---|---|---|
| `jira_project_key`, `client_name`, `display_name`, `jira_project_url` | yes | **no** | `app/dashboard/settings/projects/page.tsx` `addProject()` |
| `is_active` | default | yes | same file, `toggleActive()` |
| `brand_model` | **no** — falls to `multi_brand` | **no** | nowhere |
| `brand_jira_field_id` | **no** — falls to `customfield_12220` | **no** | nowhere |
| `default_brand_id` | **no** — stays NULL | **no** | nowhere |

Both project writes are **direct browser Supabase calls, not API routes** —
`supabase.from('projects').insert(...)` and `.update(...)` client-side. There is
no server route for projects to extend. Contrast `brands`, which does have
`app/api/admin/brands/route.ts` (POST, admin-gated, service-role, audit rows per
field) fronted by `components/coverage/add-brand-drawer.tsx` — and that drawer
**can already target any project** via a project `<Select>` (`:190-202`).

So brand creation is solved. Project brand *configuration* is the hole.

### 0.3 Prod state

| project | brand_model | brand_jira_field_id | default_brand_id | brands | live logs |
|---|---|---|---|---|---|
| NBLYCRO | multi_brand | customfield_12220 | NULL | 16 | 100 |
| SPLCRO | single_brand | NULL | set | 1 | 1 |
| HDCRO | multi_brand | customfield_12220 | NULL | **0** | **0** |

SPLCRO is correct **only** because `019:46-53` set it by hand in SQL. HDCRO was
added through the UI and is in the default state with zero brands.

### 0.4 The consequence is data loss, not just a wrong label

`supabase/functions/jira-sync/index.ts:630` writes

```ts
client_brand: resolvedBrand.clientBrandString,
```

in the **unguarded** column block — unconditionally, r37's guard does not cover
it. `resolveBrandForSync()` (`:412-465`) returns `clientBrandString: null` when a
multi-brand project's configured field is empty or matches no brand or alias and
`default_brand_id` is NULL. That null is then written over whatever was there.

**HDCRO is currently one sync away from every one of its logs landing with
`client_brand = null`.** It has 0 logs today, so nothing has been destroyed yet.
That window is why this batch is half a day and not a backlog item.

---

## 1. Defect statement

Adding a client through Settings → Projects produces a project whose brand
resolution is silently wrong for any client that is not Neighborly-shaped, and
provides no path to correct it short of hand-written SQL. "Adding a new client
should only have to happen in one place that takes effect" is false today.

---

## 2. Fix

Three pieces. No schema change.

### 2.1 A server route for project writes — `app/api/admin/projects/route.ts`

`POST` (create) and `PATCH` (edit). Modelled column-for-column on
`app/api/admin/brands/route.ts`: cookie-bound client validates the admin session,
`supabaseAdmin` performs the write, `changed_by` derived server-side via
`getChangedBy()`, client-supplied `changed_by` ignored with a forensic warn, one
audit row per submitted field with `target_type='project'`.

Accepts `brand_model`, `brand_jira_field_id`, `default_brand_id` in addition to
the four columns `addProject()` already writes.

Validation the route enforces before the DB sees it (so the user gets a sentence,
not a constraint violation):

- `brand_model = 'multi_brand'` → `brand_jira_field_id` required, `default_brand_id` optional.
- `brand_model = 'single_brand'` → `default_brand_id` required and must be a brand whose `project_key` equals this project's key; `brand_jira_field_id` forced to NULL.
- `default_brand_id` on a `multi_brand` project is allowed (019:84-87 documents it as the intentional final-fallback escape hatch).

### 2.2 Settings → Projects gets brand config

`app/dashboard/settings/projects/page.tsx` moves off direct Supabase writes onto
the route, and grows:

1. **Brand model** radio in the add form — *Multi-brand (one Jira project, many brands)* / *Single-brand (the project is the brand)*. Multi-brand stays the default so no existing behaviour changes.
2. **Jira brand field** text input, shown only for multi-brand, prefilled `customfield_12220`.
3. **Default brand** `<Select>`, populated from `brands` filtered to this project's key. Required for single-brand.
4. **An edit path.** Any existing project's brand config is editable — this is what makes SPLCRO reproducible and HDCRO fixable without SQL.

The ordering problem is real and is handled in the UI, not the schema: a
single-brand project needs a brand that needs the project to exist. So —

5. ~~**Create single-brand in two visible steps.** Submitting a single-brand project creates it `multi_brand` (satisfying the CHECK), then the form drops the user straight into the brand form for that project, and on brand creation the project is PATCHed to `single_brand` + `default_brand_id`. If the user abandons after step 1, the project is left multi-brand and shows a **"brand config incomplete"** badge in the project list. No half-state is invisible.~~

   **⚠ STRUCK 2026-08-27. This is what SHIPPED, and Karen K2 falsified its last
   sentence: brand POST ok + project PATCH failed leaves a state every
   `brandConfigChecks()` branch reads as clean, so the half-state IS invisible,
   and the retry 409s.**

   **REPLACED BY (DECIDED 2026-08-27, Lacey): ONE FORM, ONE TRANSACTION.**
   Project fields and brand fields are collected together and submitted once,
   through a `create_single_brand_project()` RPC that inserts the project
   `multi_brand`, inserts the brand, and flips the project to `single_brand`
   inside a single transaction. The intermediate row is real but never commits.

   **Why not a column instead.** An `intended_brand_model` column was
   considered and rejected: its only job would be recording what a UI wizard
   meant — a client concern taking permanent schema surface — and it has no
   honest backfill, since HDCRO's value is "unknown". It would also leave the
   failure mode live and merely visible. Unreachable beats visible beats
   silent.

   **What this deletes, stated so it is not rediscovered as a regression.**
   The finish panel, its "Step 2 of 2" copy, and its **"Leaving now is safe"**
   line all go. That sentence is TRUE today (the project exists after step 1)
   and FALSE under one transaction (nothing exists until submit). It must not
   survive the change.

   **The ordering problem does not disappear, it moves.** `brands.project_key`
   has an FK to `projects(jira_project_key)` (`009:14`), so the brand still
   cannot be inserted first; and `019:90-93` still requires `default_brand_id`
   on any `single_brand` row. Three statements, one transaction, not two.

   **Not yet built.** The RPC was drafted, Jenny-reviewed and HELD on
   2026-08-26 with five open fixes (audit rows derived from the committed row
   rather than the input jsonb; an explicit literal instead of relying on
   `019:37-38`'s column default; an `auth.uid()` refusal so the grant is not
   the sole guard; schema-qualification; a `proacl` + anon-curl grant check).
   It has no migration number. Part 1 (`030_audit_log_project_target.sql`,
   Karen K1) shipped separately and does not depend on it.

### 2.3 A completeness check that names misconfiguration

`lib/onboarding/checks.ts` — pure, testable, no I/O. Takes a project row plus its
brand count and returns findings:

- `single_brand` with NULL `default_brand_id` → `blocking`
- `multi_brand` with 0 brands and NULL `default_brand_id` → `blocking`, text names the null-overwrite in §0.4
- `multi_brand` with `brand_jira_field_id` NULL → `blocking`
- `single_brand` with >1 active brand → `warning`

Rendered as a badge per row in Settings → Projects and as a banner on the project
itself. **This is the piece 013 also needs**, so it is written here and 013
consumes it rather than the reverse.

Scope boundary: this batch delivers the **brand-config** findings only. 013 §2
extends the same `checks(facts) → Check[]` shape with Jira-credential, Teams and
OneDrive facts. Same file, same signature, additive.

---

## 3. Tests

`tests/onboarding-checks.test.ts`, `node:test`, wired into the existing
`npm test` glob (`tests/*.test.ts`) so CI runs it — the `test` job already gates
`deploy`.

### 3.1 What these tests prove, and what they do not

`brandConfigChecks()` does not exist on `main`, so **none of this can be run red
against `main` first.** What is broken on `main` is the *system* — HDCRO is
misconfigured in prod and nothing surfaces it — not an assertion. Saying
otherwise would repeat G7's "test that could not fail".

The guard against a tautological check is structural instead: all three prod
fixtures are verbatim copies of real rows, and **two of them must come back
clean.** A function that degenerated to "always blocking" fails NBLYCRO and
SPLCRO; one that degenerated to "always ok" fails HDCRO.

### 3.2 Required cases

1. Today's HDCRO row (multi_brand / customfield_12220 / NULL default / 0 brands) is blocking, and the detail names the null-overwrite consequence, not just the misconfiguration.
2. Today's SPLCRO row returns clean.
3. Today's NBLYCRO row returns clean.
4. A single-brand project with NULL `default_brand_id` is blocking.
5. A fully-configured single-brand project is clean.

Plus route-level validation tests for the three §2.1 rules, once §2.1 exists.

`npm run typecheck` in the same pass — `npm test` runs under tsx and strips
types, so it cannot see strict-null errors.

### 3.3 Delivered 2026-08-26 — steps 1-4 of 5

`lib/onboarding/checks.ts` (202 lines, pure) and
`tests/onboarding-checks.test.ts` (13 tests). **13 pass, 0 fail; `tsc --noEmit`
clean** under this repo's compilerOptions. Verified in a Linux sandbox, not via
`npm test` in the repo — the checked-in `node_modules` carries
`@esbuild/darwin-arm64`, so tsx cannot run there from a Linux shell. **`npm test`
on Lacey's Mac is the confirming run.**

Beyond the five required cases it also pins: multi-brand with no Jira field;
multi-brand with 0 brands but a fallback (not blocked — the fallback is
sufficient); a default brand belonging to another project, in both models; a
`default_brand_id` resolving to nothing, in both models; single-brand with extra
active brands (warning, not blocking); that a clean project returns exactly one
`ok` finding rather than an empty array, so "clean" is never confused with
"unchecked"; and that every non-ok finding carries a fix string.

**Step 2** adds `lib/onboarding/project-config.ts` (163 lines, pure),
`tests/project-config.test.ts` (13 tests) and `app/api/admin/projects/route.ts`
(389 lines, POST + PATCH). **26 tests pass, 0 fail; full-repo `tsc --noEmit`
clean**, route included.

Three things in the route are deliberate and worth Karen's attention:

- **`jira_project_key` is immutable after creation**, and a PATCH attempting to change it is rejected rather than ignored. `brands.project_key` and `quality_logs.project_key` join on it with **no FK**, so a rename orphans them silently.
- **Brand config validates as a unit even on a partial PATCH.** Submitting `brand_model` alone is checked against the `default_brand_id` already stored, so switching an existing project to single-brand cannot half-apply.
- **Audit rows are written only for fields that actually changed.** A resubmitted identical value produces no audit row. Writing one would be the G5a claim-pattern — a record asserting a change that did not happen.

`tests/project-config.test.ts` closes with the assertion Karen's §4 question needs:
everything the validator accepts also satisfies the 019:90-93 CHECK, and the test
counts its own accepted cases so it cannot pass by accepting nothing. The reverse
direction is deliberately false — the constraint accepts defaulted-not-configured,
which is the defect.

**Steps 3-4** rewrite `app/dashboard/settings/projects/page.tsx` (238 → 855
lines). Both project writes now go through `/api/admin/projects`; the direct
browser `supabase.from('projects').insert()` and `.update()` are gone. Added: a
brand-model Select, a Jira-brand-field input shown only for multi-brand, an
**Edit config** row expander (the edit path that did not exist), a per-row
`brandConfigChecks()` badge with the findings listed beneath any non-clean row,
and a page-level banner counting blocked projects. `tsc --noEmit` and `eslint`
both clean.

Deviations from §2.2 as sketched, both deliberate:

- **Brand model is a `Select`, not a radio.** This repo has no radio-group component and two options do not justify adding one.
- **The §2.2.5 second step is an inline panel on this page**, not a reuse of `components/coverage/add-brand-drawer.tsx`. The drawer has no prop for a preset project, and adding one would ripple into the Coverage page that also mounts it. The panel POSTs to `/api/admin/brands` — same route the drawer uses — then PATCHes the project to `single_brand`.

Failure handling in that two-step flow is explicit at both seams: if the brand
POST fails the project stays multi-brand and the error names it; if the PATCH
fails the brand exists and the error says to use Edit config. Either way the row
carries the blocking badge, so **there is no half-state that is invisible** —
which was the §2.2.5 requirement.

**A consequence worth knowing:** a newly created multi-brand project shows a
blocking badge until its first brand is added, because with zero brands it *is*
misconfigured — that is the HDCRO state exactly. This is intended, not a false
positive, and the finding text says what to do.

One React defect caught during build: the row was a bare `<>` fragment with keys
on its child `<tr>`s. The list item is the fragment, so those keys are ignored and
React reconciles rows by index. Changed to `<Fragment key={project.id}>`. `tsc`
cannot see this class of bug.

---

## 4. Gates

- **Jenny** — not required. No schema change, no migration, no constraint touched. If §2 grows a migration during build, Jenny gates it before it runs.
- **Karen** — required, on the built diff. Specifically directed at: whether the §2.2.5 two-step create can leave a state the badge misses, and whether the route's validation and the DB CHECK can disagree.
- **Lacey** — decides §5 before build starts.

---

## 5. Open decision — one

**Fix HDCRO's config as part of this batch, or leave it for the new UI to fix?**

**DECIDED 2026-08-26 (Lacey): leave it.** Configuring Heartland through the
shipped UI is the acceptance test. HDCRO has 0 logs, so nothing is at risk while
it waits; hand-fixing it in SQL first would remove the only live proof available.

**Consequence to hold:** HDCRO must not be synced before this batch ships, or
§0.4's null-overwrite runs against real rows. Nothing schedules an HDCRO sync
today — it is only reachable by a manual Sync with Jira.

---

## 6. Acceptance

1. A Spotloan-shaped client can be created start to finish in Settings → Projects with no SQL.
2. HDCRO is switched to its correct config through that UI, and the resulting row is verified in prod.
3. An incompletely configured project is visibly flagged, with text that names what is wrong.
4. `tests/onboarding-checks.test.ts` green in CI. **AMENDED 2026-09-01 (K19) —
   the "test 1 verified red against `main` first" clause is STRUCK, not softened.**
   It was unsignable: `brandConfigChecks()` does not exist on `main`, so test 1
   cannot be run there at all, and §3.1 said so in the same document. An
   acceptance item nobody can honestly tick is worse than none — it gets ticked
   anyway. **What replaces it is §3.1's structural guard, which is a real check
   and already holds:** all three prod fixtures are verbatim copies of real rows
   and **two of them must come back clean**, so a function that degenerated to
   "always blocking" fails NBLYCRO and SPLCRO, and one that degenerated to
   "always ok" fails HDCRO. That is what a red-first run would have bought, and
   it is reachable.
5. `npm run typecheck` clean.

---

## 7. Out of scope

- `DEFAULT_PROJECT` in `app/dashboard/pulse/page.tsx:228` — deleted in 013.
- The `clients` table and parent/child model — 013.
- Guarding `client_brand` in the sync writer under r37. **Real, and larger than this batch.** §0.4 makes it a live null-overwrite path for any misconfigured project; this batch removes the misconfiguration but not the underlying unguarded write. Files as its own defect.
- Teams / OneDrive onboarding fields — 013 §9 onward.

---

## 8. Standing lesson

013 §1.3 asserted a hard blocking cycle from reading a CHECK constraint without
reading the column defaults three lines above it. The claim was structurally
plausible, wrong, and would have sent the fix at the wrong problem — a blocked
insert instead of a silent misconfiguration. **Read the defaults before
concluding a constraint blocks anything.**

---

## 9. Karen review 2026-08-26 — 26 findings, DO NOT SHIP

Three independent reviewers (route correctness / UI state machine / claim
integrity). All three CRITICALs re-verified against prod directly, not taken on
the reviewers' word.

### 9.1 CRITICAL

**K1. `audit_log` rejects `target_type='project'`, so every project mutation
commits unaudited and reports success.** Verified in prod:
`audit_log_target_shape_chk` admits `quality_log, test_milestone, brand,
alert_event, user, directive, directive_brand_status, monitoring_finding`. Not
`project`. Both handlers therefore hit their audit-failure branch, which returns
**HTTP 200** with an `auditError` field — and `callApi()` in the page only tests
`!res.ok`, so the UI prints a green success message. 100% of creates and edits
land with zero audit rows. This is the §13 r19 exposure the batch exists to close.
**Requires migration 030 reproducing 025's full list plus `'project'`, and §4's
"Jenny — not required" is WRONG and is corrected below.**

**K2. The two-step create can leave a half-state that badges "Configured".**
If the brand POST succeeds and the PATCH fails, the project is `multi_brand` +
`brand_jira_field_id` set + 1 active brand. Run that through
`multiBrandChecks()`: field id present, `activeBrandCount !== 0`, no
`default_brand_id` — every branch false, so `brandConfigChecks()` returns the
lone `ok` finding and the findings row is suppressed. **§3.3's "there is no
half-state that is invisible" is false, and it is a false answer to the exact
question §4 directed Karen at.** Retry cannot recover it either: the brand POST
now 409s, and `finish` is never cleared on that path.

**K3. §5's "Nothing schedules an HDCRO sync today" is false.** Verified in prod:
`cron.job` id 1, schedule `0 */6 * * *`, `active = true`, POSTing to
`functions/v1/jira-sync`; the function's working set is
`.not('log_status','in','("Resolved")').eq('is_deleted', false)` with **no project
predicate**. HDCRO's only protection is having zero logs — re-verified 0 rows
total on 2026-08-26. The §5 decision to leave HDCRO was taken on this false
premise and must be re-confirmed knowing the cron is live and unfiltered.

### 9.2 HIGH

**K4.** `getChangedBy()` throws when there is no user, contradicting its own
header comment ("We never throw"), and is called AFTER the write commits in both
handlers with no try/catch. Token expiry mid-request → 500 with the project
already created → the retry gets 409 for a project the admin was told failed.

**K5.** `edit` is snapshotted at `startEdit` and never re-derived, while three
handlers call `loadProjects()`. `saveEdit` resubmits all six fields
unconditionally, so an open expander is a full-row overwrite from a snapshot of
unknown age. Finishing the two-step flow with an expander open and then saving
wipes the single-brand config and reports success.

**K6.** The closing test in `tests/project-config.test.ts` **cannot fail.** It
re-derives the validator's own two guards from the validator's own output, so
`satisfiesCheck` is true for every accepted value; and it never parses or
executes the actual constraint, so a validator/constraint divergence is
undetectable. §3.3 cites it as "the assertion Karen's §4 question needs" —
overclaim, same shape as the G7 defect this spec's own §3.1 warns about. The
*proposition* is true (verified by reading both `ok` branches); the test is not
the evidence for it.

**K7.** `message` and `error` render in exactly one place — inside the add-project
card. Every finish-panel, edit-expander and toggle failure appears there, often
off-screen. The finish panel's empty-field guard returns before `setSaving(true)`,
so it shows nothing at all locally and reads as a dead button.

**K8.** Badge contrast fails AA for 12px text: `resolved` 2.28:1, `medium`
1.92:1, `default` 2.56:1 in dark (`--f92-gray` is theme-swapped, `text-white` is
not — the standing shape). Only `critical` passes. In the column this batch
exists to make readable.

### 9.3 MEDIUM

**K9.** `deactivated_at` is written whenever `is_active` is present, without
comparing to the stored value. Re-submitting `is_active: false` on an
already-inactive project destroys the real deactivation timestamp and emits an
audit row asserting a deactivation that did not happen.

**K10.** The `role="alert"` banner asserts one failure mechanism for all five
blocking checks. For `DEFAULT_BRAND_FOREIGN` sync resolves a brand fine — the
wrong client's — and writes a non-empty wrong value. The findings row below
states the truth, so the banner contradicts the check it summarises.

**K11.** The findings list is gated on `!isEditing`, so the fix instructions
disappear the moment the fixing tool opens, and cannot be re-read without
cancelling and losing typed changes.

**K12.** `asTrimmedString` coerces any non-string to null, so a garbage
`default_brand_id` is treated as "clear the fallback" and 200s. Same class:
`brand_model: null` becomes a silent multi-brand create on POST, and
`is_active: "false"` becomes `true` — both correctly 400 on PATCH.

**K13.** A single-brand PATCH submitting only `brand_jira_field_id` has it
force-nulled, matches the stored null, and returns `200 {unchanged: true}` — the
input is silently discarded with no `field` naming it.

**K14.** `projects.jira_project_key` IS `UNIQUE` (`001:5`), so the non-atomic
duplicate check cannot create a duplicate — but the losing racer gets **500**
with `duplicate key value violates unique constraint …` rendered verbatim into
the UI, against `project-config.ts`'s own promise that user-facing errors are
never constraint strings.

**K15.** None of the three loads uses `.range()`, against the rule in
`lib/client-library/paged-fetch.ts` that this repo has been bitten by three
times. Nothing is wrong today (101 live logs). Past 1,000 the log count
under-reports **and so does `activeBrandCount`, which drives the badges** — and
heap order drops the most-recently-updated rows first.

**K16.** The default-brand Select lists only that project's active brands, so a
foreign or inactive stored value renders as the "Pick a brand" placeholder —
indistinguishable from unset — while still being submitted.

**K17.** `toggleActive` rebuilds from the `projects` value in its own closure
instead of a functional updater. Two quick toggles revert each other on screen
while both writes land.

### 9.4 LOW / claim defects in this spec (all mine)

**K18.** §0.2's "verified" rows are false as of §3.3, same document, same date.
Needs an as-of-batch-opening stamp.
**K19.** ✅ **CLOSED 2026-09-01** — struck in §6.4 and replaced with §3.1's
structural guard, in the commit that built migration 031
(`docs/specs/batch-single-brand-part2-rpc.md` §9's standing requirement that the
amendment land in the same commit). Was: §6.4 requires "test 1 verified red
against `main` first", which §3.1 says is impossible. Unsignable acceptance
item.
**K20.** `jira-sync/index.ts:630` is `jira_summary`; `client_brand` is **:631**.
Wrong pointer copied into `checks.ts:7`, `checks.ts:134` and `013:110`.
**K21.** §8's "the column defaults three lines above it" is **52 lines** (`019:37-38`
vs `019:90-93`), in a different section. The wrong figure inverts the lesson: the
hazard is that defaults and the constraint depending on them sit far apart.
**K22.** `013 §5.4` still names the nonexistent cycle as its migration step. The
§1.3 correction did not propagate to the step the wrong diagnosis created.
**K23.** `checks.ts` is **203** lines, not 202.
**K24.** "Mirrors `app/api/admin/brands/route.ts` exactly" — that route is POST
only. PATCH, `deactivated_at`, immutability rejection and the changed-only audit
filter have nothing to mirror.
**K25.** "One audit row per submitted field" — POST maps `Object.keys(newRow)`,
always 8 rows, including nulls the caller never sent.
**K26.** §0.4 frames the null-overwrite as multi-brand-only. It also reaches a
single-brand project whose `default_brand_id` points at a deleted brand
(`jira-sync:419-424`).

### 9.5 Claims Karen checked and confirmed accurate

`019:36-39`, `019:46-53`, `019:84-87`, `019:90-93`, `jira-sync:412-465`,
`jira-sync:417-425`, `add-brand-drawer:190-202`. **§0.4's central claim holds** —
`SYNC_GUARDED_FIELDS` (`jira-sync:198-208`) is exactly seven columns and
`client_brand` is not among them; the file's own comment at `:194-197` says
`client_brand` "MUST stay unconditional". **§0.1's correction is itself correct.**
Test counts (13 + 13 = 26) match. All five §3.2 required cases exist and map to
real branches, and §3.1's structural anti-tautology argument holds for
`onboarding-checks.test.ts`. The `<Fragment key>` fix is real. Both §3.3
deviations are accurate. Partial-PATCH-vs-CHECK is clean: the validator is
strictly stricter than the constraint and every fallback-to-stored path fails
closed with a 400. `__empty__` cannot be submitted (Radix excludes disabled
items). React keys and hook rules are clean. The `focus:bg-<literal>` shape does
not recur anywhere in the new code.

### 9.6 §4 corrected

**Jenny IS required.** K1 needs migration 030. §4's "no schema change, no
migration, no constraint touched" was true when written and is false now.

### 9.7 Fix order

1. **K1** — migration 030 (Jenny gates it), and make the page surface `auditError` instead of swallowing it.
2. **K2** — the badge must catch the PATCH-failed shape. Needs a real signal for intended-single-brand, not an inference from column state.
3. **K3** — re-confirm the §5 HDCRO decision against the live cron.
4. **K4, K5, K6, K7, K8** — HIGHs.
5. **K9-K17** — MEDIUMs.
6. **K18-K26** — spec and comment corrections, same commit as whatever they describe.
