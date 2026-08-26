# Batch 013 — Multi-client foundation · clients → projects → brands

**Renumbered from 004.99**, which is a **shipped** batch (Multi-Client Readiness
Review, 2026-05-06, in the §16 archive index). Reusing it would put one number in
both §15.5 and §16, against §13 r34. Decided 2026-08-26 (Lacey).

**Mode:** `manual` (migration + Jenny-gated). **Gates:** Jenny · Karen post-flight ·
Lacey pushes.
**Write-back program (§9) has NO external blocker** as of 2026-08-26 — per-user API
tokens replace OAuth 3LO, so nothing waits on an Atlassian app registration.
**Supersedes:** `docs/specs/batch-004.99-multi-client.md` — delete that file.

> **Route (b): all detail and the post-mortem live HERE.** CLAUDE.md §15 gets a
> pointer only.

---

## 0. What this batch became, after a Jenny pre-flight and two verification passes

**The first draft of this spec was DO-NOT-BUILD-YET (Jenny, 3 Critical).** Two of
Lacey's decisions on 2026-08-26 then removed most of the batch:

| Decision | Effect |
|---|---|
| **One project per client, at the SCHEMA level** | Kills `brand_projects`. Kills `brands.client_id`. **Jenny C1, C3, C3b, I2, I3, I5, M1, M3 all evaporate.** |
| **Two-way CRUD via per-user OAuth** | Moves ALL write-back out of this batch into its own program (§9). |

**What is left is small**: a `clients` table, one FK, a UI-only access table, a
settings page, two guard tests, and one deleted constant. **No cell is re-keyed.
Nothing is dropped. Every step is additive and reversible.**

### 0.1 ⚠ TWO SHIPPED DECISIONS ARE REVERSED HERE. RECORDED, NOT SLIPPED IN.

`docs/multi-client-readiness.md` shipped 2026-05-06 and decided both of these.
This spec reverses one and **confirms** the other. Neither file cross-referenced
the other until now, which is the internal-contradiction failure this project
already tracks.

**REVERSED — §6.3, verbatim:**
> *"RLS policies are role-based (admin / authenticated / read_only), **not
> project-scoped**. CQIP operates as a single-instance multi-client tool — every
> admin sees every client's data… **Not in scope for v1.5.**"*

**Reversal (Lacey, 2026-08-26):** per-client visibility becomes a thing, but
**as UI filtering only** (§4). The May verdict stays true of *enforcement* —
nothing in v1 narrows a read. See §4.2, which is emphatic about the difference.

**CONFIRMED, NOT REVERSED — §7 and §11:**
> *"the FK `quality_logs.project_key → projects.jira_project_key` (and the
> analogous FK on `brands`)… is the single source of truth for 'which client owns
> this data.'"*

The 2026-08-25 draft called this *"wrong under the new model."* **That draft was
wrong and the May review was right** — once a client has exactly one project,
`brands.project_key` transitively answers "which client", and moving brands off it
would have been ~1,400 cells of risk for nothing.

---

## 1. The model — DECIDED 2026-08-26

```
clients ──1:1──→ projects ────→ brands
  Neighborly      NBLYCRO        the 16
  Spotloan        SPLCRO         1
  Heartland Dental HDCRO         0
```

**A client has exactly one Jira project.** If Neighborly buys a second package it
becomes **its own client row** — the tradeoff Lacey accepted knowingly: the parent
overview splits across two client rows rather than the schema carrying a
many-to-many.

**So `brands` DOES NOT MOVE.** `brands.project_key` stays exactly as it is,
`NOT NULL`, FK intact. The client is `brands → projects → clients`.

### 1.1 What the `clients` table is actually for

Only this: **a place to hang client-level facts that are not project facts** —
display name, per-user access grants (§4), and later the parent/child overview
roll-up. `projects.client_name` becomes the seed and then a deprecated mirror.

**It is NOT a tenancy boundary.** The FK chain already is one, per the May review.

### 1.2 Already built, verified in prod — do not rebuild

| Thing | Where |
|---|---|
| Parent/child distinction | `projects.brand_model` enum: `multi_brand` / `single_brand`, migration 019 |
| Client identity | `projects.client_name`, NOT NULL |
| Per-project Jira brand field | `projects.brand_jira_field_id` |
| Single-brand clients | `projects.default_brand_id` |
| Add-project UI | `Settings → Project Management`, `addProject()` + `toggleActive()`, admin-gated |
| **Add-brand route + UI** | **`POST /api/admin/brands` + `AddBrandDrawer`** — shipped Batch 005.20, closing this review's own Q1 |

### 1.3 ⚠ ONBOARDING IS ALREADY BROKEN FOR ONE CLIENT SHAPE (Jenny C3b)

**Corrected 2026-08-26.** An earlier revision of this section claimed a hard
FK/CHECK cycle made a `single_brand` project uncreatable. Verified false:
`019:36-39` defaults `brand_jira_field_id` to `'customfield_12220'`, so
`addProject()`'s four-column insert satisfies the CHECK and succeeds. (The
constraint is at `019:90-93`, not `:92-96`.)

The real defect is worse, because it is silent. `addProject()` writes only four
columns, and **no UI anywhere sets `brand_model`, `brand_jira_field_id` or
`default_brand_id`, and there is no edit path after creation.** So a Spotloan-
shaped client is created *successfully* and *misconfigured as multi-brand*, with
no error and no signal. SPLCRO is correct only because `019:46-53` set it by hand.

Live consequence: `jira-sync/index.ts:630` writes `client_brand` **unguarded**,
so a misconfigured project nulls the column on every sync. HDCRO is in that state
now (multi_brand, 0 brands) with 0 logs — one sync away from damage.

**So §7's acceptance criterion is already false today.** Fixed ahead of this
batch by `docs/specs/batch-single-brand-onboarding.md`, which also delivers
`lib/onboarding/checks.ts` that this batch consumes.

---

## 2. Config pattern — ported from `current`

Env seeds → stored record wins → the UI edits it. `current`'s
`lib/settings/schema.ts`, verbatim:

> *"Environment variables stop being the source of truth here and become seed
> defaults… a fresh fork can be configured without an .env file or a Netlify
> login."*

Port with it: **one file parses env**; **secrets in a separate row** (*"Making the
secret physically absent from the object beats making it absent by convention"*);
**merge-on-read defaults** (a real outage in `current`: *"That is exactly how
`mutedStatuses` took the settings page down"*); **field-level validation → 422**.

**And `lib/deployment.ts` → `lib/onboarding/checks.ts`** — `checks(facts) →
Check[]` with `state`/`detail`/`fix`/`blocking`, one list driving the first-run
gate, the settings panel and the tests. 231 lines of pure function. **This is the
"one place to add a client" UX.**

---

## 3. Gate 0 — CQIP is already project-agnostic

Grep-derived 2026-08-25, re-confirmed by Jenny. `app/` + `lib/` + `components/`:
**20 lines mentioning a project key, 14 of them comments, 6 "code" — 4 of those
JSX display text.**

**Two real items:**

1. `app/dashboard/pulse/page.tsx:228` — `const DEFAULT_PROJECT = 'NBLYCRO';`,
   consumed once at `:548`. **Delete it.**
2. `components/filters/project-brand-filter.tsx:66-70` — `projectShortCode()`
   strips a `CRO` suffix. Already falls back to the raw key. **A naming
   assumption, not a defect.** Leave or fix in passing.

**One Jira site (decided 2026-08-25)**, so `JIRA_BASE_URL` / `JIRA_EMAIL` /
`JIRA_API_TOKEN` stay **instance-level**. No per-client credential in this batch.

### 3.1 Two guard tests, ported — and WIRED TO CI

`current` has both and runs **neither** — no `.github/` at all. CQIP gained a CI
test gate at run #48, so these become real gates.

1. **`tests/forkability.test.ts`** — fails the build if a client identifier appears
   in shipped source. **Two fixes to `current`'s version:** it scans five dirs and
   misses `tools/`; and it greps two hardcoded substrings, so **`F92` slips
   through** — `current` ships `built-in-f92-light/dark` in `lib/theme.ts:913,963`
   today. Load the identifier list from config.
2. **`tests/client-bundle.test.ts`** — walks the import graph from the client entry
   and fails if a server-only module is reachable. *"A typecheck cannot see this
   and a build only warns. So it is a test."*

---

## 4. Per-client access — UI FILTERING ONLY (Lacey, 2026-08-26)

`user_client_access (user_id, client_id)`. A new user defaults to all clients; an
admin unchecks. The UI hides unchecked clients from the switcher and the
all-clients home.

### 4.1 Why UI-only, stated as the tradeoff it is

Everyone with an account is internal F92 today — 3 active admins, 3 active
read_only. Enforcement is a bigger batch (§4.3) and this is a convenience filter
until someone external needs a login.

### 4.2 ⚠ THIS ENFORCES NOTHING, AND THE SPEC SAYS SO IN THE UI

Verified 2026-08-26: **zero of 40 RLS policies reference any tenancy column.**
`brands`, `directives`, `directive_brand_status`, `monitoring_findings`,
`alert_events` are all `USING true`. The only per-user predicates in the entire
database are `saved_reports.created_by`, `login_events.user_id` and
`user_profiles.id`. **Nothing filters client data by user anywhere** — not RLS,
not a route, not the UI.

**So a user whose access is unchecked can still reach the data** by URL, by API,
or by any client that isn't this UI. **The settings screen must SAY that** —
something like *"Controls what each person sees by default. Not a security
boundary."* An unenforced grant that looks enforced is worse than an admitted
convenience filter, and batch #3 shipped a Critical from exactly that gap.

### 4.3 What real enforcement would cost, priced so it can be scheduled

**8 SELECT policies + 1 route.** Smaller than it looked:

- Rewrite the 8 `USING true` / soft-delete policies with a client predicate.
- **Exactly one RLS-bypassing route reads client data and is reachable by a
  non-admin:** `app/api/coverage/pipeline/route.ts`, whose own header says
  *"cookie-bound session, any authenticated user… NOT Bearer, NOT admin-gated"*
  while reading via `supabaseAdmin`. Everything else is admin-gated in-route or
  Bearer with no user session.
- **`middleware.ts` contributes zero authorization to `/api/*`** — §13 r24 scopes
  it to `/dashboard/settings/*`.

### 4.4 `/api/coverage/pipeline` — DECIDED: leave it, document it

Lacey, 2026-08-26. Its three DB reads are already inside what RLS grants an
authenticated user. **What has no RLS analogue is the live Jira ticket payload for
every active project**, which reaches the browser only through this route. The
route comment documents the choice; **this spec records the justification**, which
it previously lacked.

---

## 5. Parent / child overviews

Both levels first-class. Lacey: *"Its important to be able to see the Neighborly
overview in addition to the Brand Overviews. This will apply to any Parent Company
- Child Brand relationship."*

- **Client overview** rolls up across the client's brands.
- **Brand overview** — the existing per-brand view.
- **⚠ Every rolled-up figure names its denominator and its date.** G1 says a
  percentage against a moving population is not comparable, and a parent roll-up is
  the most tempting place in the app to publish one anyway.
- **A client with 0 brands renders** — Heartland, today.
- **Navigation: a client switcher, not tabs.** 16+ clients is not a tab bar.

---

## 6. Migration — additive, reversible, no cell touched

**Jenny gates this.** Every step has an inverse.

1. `clients` table. **`name` UNIQUE**, case-insensitive. Backfill from
   `projects.client_name` — `Neighborly`, `Spotloan`, `Heartland Dental`.
   **Pre-flight assertion:** `count(distinct lower(trim(client_name))) = count(*)`
   on `projects`. Today 3 = 3.
2. `projects.client_id` → FK, then `NOT NULL`. Backfill 1:1 by name.
   **`projects.client_name` STAYS** until its 3 readers move:
   `settings/projects/page.tsx:16,64,101,215`, `coverage/page.tsx:66,104`,
   `scripts/import-csv.ts:158`.
3. `user_client_access (user_id, client_id)` + RLS (admin-write, self-select).
4. **Fix the single-brand cycle (§1.3):** make `projects.default_brand_id`
   settable after creation, or allow a project to be created `single_brand` with a
   deferred brand. **This is the step that makes §7.1 true.**
5. `clients` settings + secrets tables (§2), if the config work lands here rather
   than in its own batch.

**NOT in this migration:** `brands` is untouched. No `brand_projects`. No
`brands.client_id`. Nothing dropped.

### 6.1 Verification — the query, not a number

**Jenny found my counts wrong: I wrote 1,408 cells / 4 archived directives; actual
is 1,456 / 2** — and there are only 2 archived directives in the whole database, so
"4" was never true of anything. **§7.4 had made that number the gate.**

Capture this before and after; the two runs must match row for row:

```sql
SELECT d.project_key, d.status,
       count(DISTINCT d.id) AS directives, count(dbs.id) AS cells
FROM directives d
LEFT JOIN directive_brand_status dbs ON dbs.directive_id = d.id
GROUP BY 1,2 ORDER BY 1,2;
```

Baseline 2026-08-26: NBLYCRO 89 active / 1,424 cells + 2 archived / 32 cells;
SPLCRO 1 / 1. **Re-derive at run time — this moves weekly** (87 active on 08-18,
89 on 08-26).

### 6.2 Rollback

Steps 1–3 are additive: drop the FK, drop the columns, drop the tables. Step 4
alters a constraint and needs its inverse written before it runs. **State
transaction boundaries per step.** Migration 019 is the house pattern — pre-flight
queries with expected results, an idempotency statement, post-migration
assertions, and a commented-out conditional step. Match it.

---

## 7. Acceptance

1. **A new client is onboarded entirely through the UI** — no file edited, no
   deploy. Verified by adding a real one.
2. **A SINGLE-BRAND client can be created through the UI** (§1.3). This is
   currently impossible and Heartland cannot detect it.
3. **Heartland renders with 0 brands**, and its brands can be added through the UI.
4. `forkability` and `client-bundle` pass **and run in CI**.
5. §6.1's query matches pre- and post-migration, row for row.
6. `npm run typecheck` passes. **`npm test` alone is not the gate** — `tsx` strips
   types; batch #3's C2.
7. Both themes.
8. The access screen states in the UI that it is not a security boundary (§4.2).

---

## 8. Out of scope

- Anything that writes to Jira (§9)
- Real per-client read enforcement (§4.3 — priced, not built)
- The 007 board itself
- Touching `brands` in any way
- QMS Rec 3's targets — **its home is no longer this batch.** With one project per
  client, per-brand contracted targets are columns on `brands`, not on a join.
  Re-tier separately.

---

## 9. ⚠ THE WRITE-BACK PROGRAM — a new external blocker, not part of this batch

**Lacey, 2026-08-26: full two-way CRUD** — comments, status moves, tags, edits,
comment deletions — with **correct per-user attribution in Jira.**

### 9.0 ⚠ IDENTITY: PER-USER API TOKENS FOR v1, NOT OAuth 3LO

**Decided 2026-08-26 (Lacey), reversing an OAuth-3LO choice made minutes earlier
in the same session — because a factual check changed the answer.**

**Atlassian API tokens are PER USER.** Each person creates their own at
`id.atlassian.com/manage-profile/security/api-tokens`, and a write made with it
attributes to **them** in Jira. **Correct attribution does not require OAuth.**

| | Per-user API token | OAuth 3LO |
|---|---|---|
| Attribution in Jira | ✅ correct | ✅ correct |
| Atlassian app registration | **none** | required |
| Blocked on another person | **no** | probably admin approval — Carl-class |
| Refresh handling | none | required |
| Expiry | **365 days max, 1 year default** | refresh rotates |
| Revocation | **user only, no admin revoke** | app-level |

**Why this reversal matters more than it looks: it turns an external blocker into
a task.** OAuth 3LO would have put write-back in the same class as 006 (retired
mechanism) and the Azure work (parked on Carl) — blocked on somebody else's
approval. Tokens make it *"six people paste a token."*

**⚠ THE TWO REAL COSTS, and they are why OAuth exists:**

1. **Tokens expire — 365 days maximum, one year by default.** Six people means six
   expiry dates and six *silent* write failures spread across a year. **CQIP must
   detect a dead token and prompt that person**, or write-back fails quietly, which
   is this project's signature defect class.
   **⚠ AND CHECK BEFORE BUILDING: tokens created before 2024-12-15 expire between
   2026-03-14 and 2026-05-12** — so any long-lived token already in use is gone or
   about to be. That includes whatever `JIRA_API_TOKEN` currently holds.
2. **No admin revoke.** When someone leaves, only they can kill their token.
   Deleting it from CQIP's store is easy; Jira-side it stays live. **Offboarding
   documentation must say so.**

**Build the seam, not the mode.** `current`'s `lib/jira/credentials.ts` is one
interface with two implementations and the note *"the interface returns the base
URL as well as the headers because the two modes call different hosts… Every
caller above this line is identical either way, which is the point: switching
modes must not touch the sync."* **Ship tokens behind that interface; OAuth
becomes an implementation swap when expiry management gets annoying.**

Sequenced:

1. **Per-user Jira credentials** — the `JiraCredentials` interface, a per-user
   encrypted token store, a connection test that tells the person which token
   shape answered (`current`'s `jira-test.ts` probes classic-vs-scoped against two
   hosts rather than asking the user to know), and **expiry detection with a
   prompt.**
2. **007 board, read-only** — `jira_tickets` cache fed by the existing
   `jira-webhook`, plus the 6-hour sync demoted to a reconciliation sweep that
   **surfaces disagreement loudly** rather than reconciling quietly.
3. **#10 keep-both-and-flag** — the conflict surface.
4. **Per-field audit coverage on the sync's whole write set** (Jenny I6). Today
   audit rows exist for **only the 7 guarded fields**; `jira-sync/index.ts:629-638`
   writes 9 more unconditionally with **no audit row**, and stamps `updated_at` on
   every pass whether anything changed or not, so it is useless as a field clock.
   **Field-level LWW is not implementable until this lands.**
5. **Two-way CRUD** itself. **§13 r5 gets amended as its own recorded decision**
   before this starts, never absorbed into a board build.

**⚠ WHY THE ORDER IS NOT NEGOTIABLE.** The sync-guard defect was **one-way** and
still destroyed 27 field-values across 5 rows over ten weeks — silently, because
the sync wrote with **no audit row**, so *"the trail showed the human's write and
nothing after it, which reads as 'the value is still there.'"* Two-way CRUD before
steps 3 and 4 recreates that, and the writes land in the team's live Jira.

**One more constraint on step 5:** `tsconfig.json` excludes `supabase/functions`,
so the guard body is **inlined verbatim** into the Deno function and a drift test
asserts the copies match. Per r37 that test *"is the only gate reaching the
deployed code."* Anything added there is untypechecked and inherits the dual-copy
discipline.

---

## 10. Post-mortem

*(Written at ship. Stays HERE, per route (b).)*
