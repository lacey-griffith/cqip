# Batch 004.99 — Multi-client foundation · clients → projects → brands

**Board sequence:** promoted to head. **Mode:** `manual` (migration + Jenny-gated,
and Jenny-gated is `manual` regardless).
**Gates:** **Jenny** (migration, write-path change) · Karen post-flight · Lacey pushes
**Blocks:** 007 Custom Jira Boards names this a **hard prereq**. That prereq is
now confirmed correct — see §0.2.

> **Route (b): all detail and the post-mortem live HERE.** CLAUDE.md §15 gets a
> pointer only. Cite this file by section number.

---

## 0. Why this exists, and what it settles

### 0.1 The goal, stated as a test

**Adding a client must touch no code.** That is the acceptance criterion, and it
is testable: *can a new client be onboarded entirely through the UI, with no file
edited and no deploy?*

Second goal, and it turns out to be the same one: **CQIP should be forkable** for
another team. Both goals reduce to one rule — **all client config lives in the
database and the UI, never in env vars or source.** A fork is then just an empty
database.

### 0.2 It settles the 007 prereq disagreement

Three claims were in conflict (recorded in §15 as an open action):

- `docs/specs/batch-007-jira-boards.md`: *"post-006, hard prereq: 004.99 + SPL onboarding"*
- CLAUDE.md §0.1: 007 behind 010.1
- Board rev 8.1: 007 at #13 with **no dependency**

**The spec is right and the board was wrong.** Lacey's own description of 007
(2026-08-25) is *"onboard a client via their Jira account info, Teams info and
potentially OneDrive… adding a new client should only have to happen in one
place"* — which is this batch, not 007. **007 consumes 004.99.**

**The "post-006" half is DROPPED.** 006 is blocked on a retired dispatch
mechanism (board rev 8.7) and nothing in a board view needs Teams dispatch.
Carrying it would block 007 behind an unrelated external problem.

---

## 1. The model — DECIDED 2026-08-25 (Lacey)

```
clients ──────→ projects           Neighborly → NBLYCRO (+ future packages)
   │
   └──────────→ brands             the 16 — owned by the CLIENT, not the project
                   │
             brand_projects        which brands are in scope for which project
                                   ← per-(brand, project) contract lives here
```

### 1.1 Why a `clients` table at all

**Because a parent company can have more than one Jira project.** F92 sells
multiple packages, so Neighborly may hold a second project for a different
service. `projects` currently doubles as "client", which is fine at 1:1 and
breaks the moment that happens.

### 1.2 ⚠ WHY BRANDS MOVE OFF `project_key` — this is the expensive half

Today: `brands.project_key`. **That is wrong under the new model.** If Neighborly
gets a paid-media project, **the same 16 brands are the subjects of that work
too.** A brand is an entity belonging to a client; its *participation* in a
project is a separate fact.

**Doing this later means re-keying a table with 1,400+ live cells and real audit
history.** Doing it now is a migration on 17 rows. That asymmetry is the entire
argument.

### 1.3 Why the contract is on `brand_projects`, not on `brands`

Lacey, 2026-08-25: *"They would be the same subjects but it would be new
contracts from there also."* A brand's contract is **per project**, so it cannot
be a column on `brands`. It is an attribute of the participation.

**And CQIP does not model contract detail.** Same source: *"it would need to just
read from Jira and see where it's at."* CQIP stores **participation and targets**;
work state is read from Jira. Do not build a contract module.

### 1.4 ✅ THIS GIVES QMS Rec 3 A HOME — re-tier it

Rec 3 (per-brand contracted targets) was demoted to nice-to-have because
*"per-brand contracted targets are a client-contract artifact."* Under this model
they are a column on `brand_projects`. **Rec 3 closes G4 and unblocks the
measurement doc's §4.3.3 and §4.1.5.** Re-tier after this ships; do not fold it
into this batch.

### 1.5 ⚠ MOST OF THIS IS ALREADY BUILT — probed 2026-08-25

**`projects` already carries the client concept AND the parent/child
distinction.** Migration 019 (`019_project_brand_model.sql`) shipped it:

| Column | Purpose |
|---|---|
| `client_name` (NOT NULL) | the parent company, as a string |
| `brand_model` (enum) | **`multi_brand`** or **`single_brand`** |
| `brand_jira_field_id` | which Jira custom field carries the brand |
| `default_brand_id` | the single brand, for `single_brand` projects |
| `jira_project_url` | already per-project |

Live state:

| Project | `client_name` | `brand_model` | Brand field |
|---|---|---|---|
| NBLYCRO | Neighborly | **multi_brand** | `customfield_12220` |
| HDCRO | Heartland Dental | **multi_brand** | `customfield_12220` |
| SPLCRO | Spotloan | **single_brand** | default brand set |

**"Parent Company with Child Brands" vs "standalone client" is `brand_model`, and
it already works.** The hierarchy is not new work.

**So what does the `clients` table actually add?** Exactly one thing: **a client
owning MORE THAN ONE project.** `client_name` as a string on `projects` is fine at
1:1 and cannot express Neighborly holding a second package. That is the whole
justification — nothing more, and the spec should not claim more.

**And the Settings UI is already there:** `Settings → Project Management` has
**Add new project** with Jira project key, Client name, Display name and Jira
project URL, plus an active toggle and a per-project log count.

### 1.5.1 ✅ HEARTLAND IS A LIVE ACCEPTANCE TEST, NOT A HYPOTHETICAL

HDCRO is **`multi_brand`, brand field configured, 0 brands, 0 logs** — a client
**mid-onboarding right now.** So the batch's acceptance criterion is already
sitting in production:

**Can Heartland's brands be added entirely through the UI, with no file edited and
no deploy?** If not, this batch failed. Do not invent a fixture for this.

---

## 2. The config pattern — ported from `current`

Read `/Users/l.hay/Documents/Code/current`: `config/project.ts`,
`lib/settings/schema.ts`, `lib/settings/store.ts`. **Attribution matters here —
these are paid-for findings, not a design exercise.**

### 2.1 The precedence rule, verbatim from `current`

> *"Environment variables stop being the source of truth here and become seed
> defaults. Precedence is stored setting -> environment -> built-in default, so an
> existing deploy keeps behaving exactly as it did until somebody changes
> something, and a fresh fork can be configured without an .env file or a Netlify
> login."*

**Adopt this exactly.** Env seeds; the stored record wins; the UI edits the record.

### 2.2 Four sub-patterns to port with it

1. **One file parses env. Nothing else.** `current` has `config/project.ts` as
   *"the single fork surface"*. CQIP gets `lib/config/instance.ts`.
2. **Secrets in a SEPARATE row from settings**, so no caller has to remember to
   redact. `current`'s reasoning: *"Making the secret physically absent from the
   object beats making it absent by convention."* Reveal functions are named to be
   greppable (`revealCredential()`), and responses carry a 4-char hint only.
3. **Merge-on-read defaults** (`withDefaults`). From a real outage in `current`:
   *"That is exactly how `mutedStatuses` took the settings page down."* A record
   written before a field existed has no key for it, and the type lies.
4. **Field-level validation → HTTP 422**, not throw-on-first, because it backs a
   form: *"someone who got three fields wrong should be told about all three."*

### 2.3 The deployment checklist — this IS the onboarding UX

`current`'s `lib/deployment.ts` is a pure function: `checks(facts) → Check[]` with
`state: 'ok'|'todo'|'warn'`, a `detail`, a `fix`, and a `blocking` flag. One list
drives the first-run gate, the settings panel **and** the tests.

> *"A fork is meant to be: deploy, paste two secrets, sign in, connect Jira, sync.
> Every step of that can half-happen, and until now nothing said which half. An
> app that cannot say it is unconfigured is an app that looks broken instead."*

**Port it as `lib/onboarding/checks.ts`, per client.** ~230 lines of pure
function, fully unit-testable, and it is the answer to "one place to add a
client."

---

## 2.4 Sync model — webhook first, sweep as the safety net

**DECIDED 2026-08-25 (Lacey).** Per-change, not polling.

**This is already your architecture.** `supabase/functions/jira-webhook` exists
(it handles rework events today), and 007's locked decisions already say *"Real-time
sync via webhook — extend jira-webhook to cache all ticket state, not just rework
events."*

**Per-change is CHEAPER than polling, not more expensive.** 1-minute polling is
1,440 runs/day, nearly all returning nothing, each burning Jira's cost-based rate
limit to discover that. A webhook fires once per real change.

**The 6-hour `jira-sync` does NOT go away — it changes ROLE:** from *how CQIP
learns about changes* to *how CQIP catches what the webhook missed.* Webhooks get
dropped on bad deploys, Jira outages, and 500s on our end.

**⚠ THE NEW FAILURE MODE IS SILENT, so the sweep must be loud.** A webhook that
stops firing leaves CQIP showing stale data confidently — the same shape as a
paginated short read. **The sweep must compare what it finds against what the
webhook should already have delivered and surface the disagreement**, not
reconcile it quietly.

**Bonus for §6.1:** faster sync means *smaller* conflict windows. At 6 hours a
human edit sits unreconciled half a day; at seconds, field-level LWW is almost
always trivially clear.

---

## 3. What must become configurable

### ✅ GATE 0 DONE 2026-08-25 — AND THE ANSWER IS THAT CQIP IS ALREADY NEARLY PROJECT-AGNOSTIC

Grep-derived, not estimated. **The raw counts look alarming and are misleading:**
102 occurrences of `NBLYCRO`/`SPLCRO`/`HDCRO` across the repo. Filtered to shipped
source (`app/`, `lib/`, `components/`):

```
20 lines total
14 are COMMENTS
 6 are "code" — and 4 of those are JSX DISPLAY TEXT
```

**The complete real surface is TWO items:**

1. **`app/dashboard/pulse/page.tsx:228` — `const DEFAULT_PROJECT = 'NBLYCRO';`**
   The only genuine hardcoded client value in the application.
2. **`projectShortCode()` in `components/filters/project-brand-filter.tsx:63`** —
   strips a `CRO` suffix so pills read `NBLY` / `SPL`. **Already defensive** (falls
   back to the raw key), so it is a naming assumption rather than a defect.

**Cosmetic only, safe to leave or fix in passing:** a placeholder
(`settings/projects/page.tsx:161`, *"e.g. NBLYCRO, SPLCRO"*) and doc copy
(`docs/qa-fields/page.tsx:51`).

**Out of scope by nature:** `supabase/migrations/*` (009, 019, 013 — immutable
history and seed data), `scripts/*` (one-off loaders), `tests/*` (42 occurrences,
all fixtures — fixtures SHOULD name concrete projects).

### 3.0 ⚠ ONE JIRA SITE MAKES THIS MUCH SMALLER

**Decided 2026-08-25: one Jira site, many projects.** So `JIRA_BASE_URL`,
`JIRA_EMAIL` and `JIRA_API_TOKEN` stay **instance-level config — NOT per-client.**
Only project keys are per-client. That removes per-client credential storage, the
per-client auth probe, and per-client rate limiting from this batch entirely.

`process.env` inventory (23 distinct vars): the Jira trio is 16 reads, Supabase 26,
Azure/SharePoint 6, CQIP bearer tokens 5. **None of them become per-client.**

### 3.0.1 ✅ THE SETTINGS SHELL ALREADY EXISTS

Seven settings pages ship today: `alerts`, `audit`, `profile`, `projects`,
`system`, `users`, plus the index. **`settings/projects/page.tsx` already does
`addProject()` and `toggleActive()` behind an admin gate.**

Admin API routes exist for `brands` (pause, qa-config), `directives`, `users`,
`milestones`, `monitoring`, `logs`.

**So `Settings → Clients` is a new page in an established pattern, not new
infrastructure.** *(Unverified: whether an "add brand" route exists —
`app/api/admin/brands` has `pause` and `qa-config` only. Check before scoping the
brand CRUD.)*

### 3.1 Two guard tests, ported from `current` — but WIRED TO CI

`current` has both and **runs neither in CI** — it has no `.github/` at all, and
`npm run check` is enforced by documentation. CQIP already gained a CI test gate
(run #48), so:

1. **`tests/forkability.test.ts`** — fails the build if a client identifier
   appears in shipped source. **Two corrections to `current`'s version:**
   - It scans five dirs and **misses `tools/`**. Scan every shipped dir.
   - It greps two hardcoded substrings, so **`F92` slips through** —
     `current`'s own `lib/theme.ts` ships `built-in-f92-light/dark` today. Load
     the identifier list from config so a fork guards its own names.
2. **`tests/client-bundle.test.ts`** — walks the import graph from the client
   entry and fails if a server-only module is reachable. `current`'s note: *"A
   typecheck cannot see this and a build only warns. So it is a test."*

---

## 4. Migration plan

**Jenny gates this.** Sequenced so no step leaves the app unable to read.

1. `clients` table. **Backfill from the EXISTING `projects.client_name`** —
   `Neighborly`, `Spotloan`, `Heartland Dental`. Dedup is trivial at 1:1 today.
   *(Not from `display_name` — that is the project label, "Neighborly CRO".)*
2. `projects.client_id` → FK. Backfill 1:1 by `client_name`. **Keep
   `client_name` until every reader moves**, same discipline as step 5.
3. `brands.client_id` → FK. Backfill from `brands.project_key` → `projects.client_id`.
4. `brand_projects (brand_id, project_id)` + contract/target columns. Backfill
   from today's `brands.project_key` — **17 rows.**
5. **`brands.project_key` stays, deprecated, until every reader moves.** Do not
   drop it in the same migration that adds the replacement.
6. Instance/client settings tables + the secrets table (§2.2.2).

### 4.1 ⚠ The count that makes step 5 non-negotiable

`directive_brand_status` holds **1,408 cells** for NBLYCRO alone, **64 of them on
4 archived directives**, with live `audit_log` history. A read that silently
switches keys mid-flight is the paginated-truncation failure class this project
has already recorded twice. **Dual-read, verify counts match, then cut over.**

---

## 5. Parent / child overviews

**Both levels are first-class.** Lacey, 2026-08-25: *"Its important to be able to
see the Neighborly overview in addition to the Brand Overviews. This will apply to
any Parent Company - Child Brand relationship."*

- **Client overview** — rolls up across the client's projects and brands.
- **Brand overview** — the existing per-brand view.
- **⚠ Every rolled-up figure names its denominator and its date.** G1 says a
  percentage against a moving population is not comparable, and a parent roll-up
  is the most tempting place in the app to publish one anyway.
- **A client with 0 brands renders** (§1.5).

### 5.1 Navigation — decided against tabs

**16+ clients is not a tab bar.** `current`'s answer was per-client boards plus a
"View All". Recommendation: a **client switcher** plus an all-clients home, not a
tab per client. **Not final — flagged in §6.**

---

## 6. OPEN DECISIONS — not assumptions

**These are recorded as open because Lacey stated a position and I proposed a
different one, and the disagreement was never resolved.** Writing them as settled
would be the same failure as the 006 un-blocking, which turned on an artifact
nobody re-verified.

### 6.1 ✅ DECIDED — BIDIRECTIONAL sync, sequenced behind #10

**Lacey, 2026-08-25.** The ask is **not** write-back. It is **two-way sync**: move a
ticket in either Jira or CQIP and the other follows.

**Conflict model, decided:**
- **Keep-both-and-flag is the conflict surface** — batch #10, already on the board.
- **Fallback: last-write-wins, and it MUST be FIELD-level, not row-level.**
  Row-level LWW drops an unrelated field: a human edits the CQIP note while Jira
  changes the status, and one of the two disappears.
- **Timestamps come from BOTH sources, never from "when the sync noticed."** Jira's
  changelog gives per-field change times; `audit_log.changed_at` gives CQIP's.

**⚠ SEQUENCE IS NOT NEGOTIABLE, and the reason is in this project's own defect
record: read-only → #10 keep-both-and-flag → two-way.**

The sync-guard defect was **one-way** and it still destroyed 27 field-values
across 5 rows over ten weeks, silently, because Jira's empty QA tab overwrote
human entries every six hours with no audit row. **#10 exists precisely because
"Jira wins silently" is the wrong default.** Two-way sync before #10 re-creates
that defect at ticket scale, and this time the writes land in the team's live
Jira rather than in CQIP.

**§13 r5 (CQIP read-only against Jira) must be amended as its own recorded
decision**, not absorbed into a board build.

### 6.2 ✅ DECIDED — store all three, validate only Jira

**Lacey, 2026-08-25.** `Settings → Clients`. Per client:

| Integration | Fields | Connection test in v1? |
|---|---|---|
| **Jira** | project key(s) | **YES** |
| **Teams** | which channel this client's alerts go to | **NO** — mechanism retired 05-22, Workflows unverified |
| **OneDrive** | which folder this client's reports save to | **NO** — blocked on Azure + Carl |

Teams and OneDrive fields **save and sit inert, marked "not yet verified" on
screen.** When 006 unblocks, the config is already there. A "Test connection"
button against an endpoint nobody has verified would either fail or lie — which
is the shape that put 006 three months behind.

### 6.3 ✅ DECIDED — both, and more over time. **007's scope, not this batch's.**

**Lacey, 2026-08-25:** saved views *and* full drag-resize layout per user, plus
further customization as it comes up.

Port `current`'s `src/ui/columns.ts` — CSS custom properties so header and body
grids stay aligned from one source, pointer drag **plus keyboard parity** (a
drag-only affordance is unusable from a keyboard).

**⚠ PORT THE MECHANISM, NOT THE BUG.** In `current`, `sort` and `seenDate` are
sent by `main.ts` and **silently dropped** by `netlify/functions/prefs.ts` — the
stored type has no such fields. Sort resets on every reload. Whatever CQIP
persists, assert it round-trips.

### 6.4 ✅ DECIDED — all clients visible by default; admin grants per user

**Lacey, 2026-08-25:** *"since this is for CRO or any other department, it makes
sense to show all of them. Admin should have ability to toggle view access for the
configured brands per user."*

**Implementation: grant at CLIENT level, not brand level.** 3 clients today
against 17 brands — most people need "all of Neighborly", not a hand-picked six.
One join table, `user_client_access`; a new user defaults to all clients and an
admin unchecks.

**Brand-level override: schema leaves room, UI is NOT built** until someone asks.

**⚠ RLS is per TABLE, not per route** — batch #3 shipped a Critical from exactly
that assumption. Every new table here needs its policy written with the batch, and
the read-only path must be exercised, not reasoned about.

---

## 7. Acceptance

1. **A new client is onboarded entirely through the UI** — no file edited, no
   deploy. Verified by adding a real one.
2. **Heartland renders with 0 brands**, and its brands can be added through the
   UI afterwards.
3. `forkability` and `client-bundle` tests pass **and run in CI**.
4. Existing NBLYCRO matrix renders identically post-migration — **cell count
   verified against a pre-migration `count:'exact'`**, not eyeballed.
5. `npm run typecheck` passes. *(`npm test` alone is not the gate — `tsx` strips
   types. Batch #3's C2.)*
6. Both themes.
7. **Every figure in this file re-derived at write time**, naming its quantity.

---

## 7.1 ⚠ REVISED SIZE — this batch is much smaller than it first looked

Every "hard part" I originally scoped turned out to exist:

| Assumed new work | Reality |
|---|---|
| Parent/child hierarchy | ✅ `brand_model` enum, migration 019 |
| Client identity | ✅ `projects.client_name`, NOT NULL |
| Per-project Jira brand field | ✅ `brand_jira_field_id` |
| Single-brand clients | ✅ `default_brand_id` |
| Settings shell + add-project UI | ✅ `Settings → Project Management` |
| Per-client Jira credentials | ✅ Not needed — one Jira site (§3.0) |
| De-hardcoding the app | ✅ Two items total (§3 Gate 0) |

**What is genuinely new:**

1. `clients` table — solely to let one client own multiple projects (§1.5)
2. `brands.client_id` — brands move off `project_key` (§1.2) ← **the expensive half**
3. `brand_projects` join + contract/target columns (§1.3)
4. `user_client_access` (§6.4)
5. `Settings → Clients`, extending the existing page
6. Delete one constant, `DEFAULT_PROJECT`
7. Two guard tests, wired to CI (§3.1)
8. `lib/onboarding/checks.ts`, ported from `current` (§2.3)

**Items 2 and 3 are the batch.** Everything else is small.

---

## 8. Explicitly OUT of scope

- A contract module (§1.3 — read Jira instead)
- QMS Rec 3's targets (§1.4 — the home is built here, the feature is not)
- The 007 board itself
- Dropping `brands.project_key` (§4.5)
- Anything Teams or OneDrive beyond stored config, pending §6.2

---

## 9. Post-mortem

*(Written at ship. Stays HERE, per route (b).)*
