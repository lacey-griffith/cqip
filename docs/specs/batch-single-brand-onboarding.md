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

5. **Create single-brand in two visible steps.** Submitting a single-brand project creates it `multi_brand` (satisfying the CHECK), then the form drops the user straight into the brand form for that project, and on brand creation the project is PATCHed to `single_brand` + `default_brand_id`. If the user abandons after step 1, the project is left multi-brand and shows a **"brand config incomplete"** badge in the project list. No half-state is invisible.

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

### 3.3 Delivered 2026-08-26 — steps 1-2 of 5

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
4. `tests/onboarding-checks.test.ts` green in CI; test 1 verified red against `main` first.
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
