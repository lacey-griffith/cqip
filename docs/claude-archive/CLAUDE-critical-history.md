# CRITICAL header — deployed-state history (April–August 2026)

> # ⚠ HISTORY — NOT AUTHORITY
>
> **This file is append-only history. It is NEVER authority for current state.**
> Per CLAUDE.md §13 **r40**, every state read — what is deployed, what is
> pending, what a rule requires, what a table looks like — resolves against
> **CLAUDE.md**, and against **`docs/schema.md`** for schema.
>
> Everything below was true **on its ship date**. Each entry is correct *as a
> record* and may be stale *as a claim* — those are different things, and this
> file only ever offers the first. A present-tense sentence here (`prod reports
> version: …`, `not yet started`, `NEXT`) is scoped by its entry's date and must
> not be read as describing today.
>
> **Do not cite this file as evidence for a present-tense claim.** If you need to,
> the fact belongs in CLAUDE.md and has not been carried across — fix that
> instead. **Never edit an entry here to make it current**; write current facts
> where current facts live.
>
> Entries are keyed on **ship date + slug, never batch number** — batch numbers
> are not unique in this repo (`Batch 005.3` names two unrelated batches,
> 2026-07-08 and 2026-05-06).

This is the `**Current deployed state:**` running paragraph that lived at the top
of CLAUDE.md until 2026-08-22. It is **one continuous Apr–Aug prose run**, not a
set of per-batch entries, which is why it is kept whole here rather than split
across the month files.

**It is the reason this batch exists.** §13 r23 bullet 1 told every batch to
append to it; 77 batches complied; it reached **24,792 characters** — the single
largest contributor to CLAUDE.md outgrowing the 150,000-character read limit.
That bullet was rewritten in the same batch (see r23) so nothing appends here
again.

**Two things in it were already stale when it was extracted**, which is the
clearest possible demonstration of why a running history is not a state claim:

- Its trailing line reads *"All migrations 001-025 have run against production"*.
  **Wrong by four** — 029 is applied, and the very entry above it says so.
- Its per-batch `prod /api/health reports version: …` claims are present-tense
  sentences scoped by batch dates months old.

The **correct** current state was already consolidated into the `Prod right now`
stanza that stays in CLAUDE.md. Nothing live left with this text.

---

**Current deployed state:** Live at https://cqip.l-hay.workers.dev.
All Batch 001-002.5b features shipped. Recent shipped (April-May
2026): Batch 003 (branded exports + dashboard click-drill), Batch
003.5 (CQIP_SYNC_AUTH_KEY decoupling), Batch 004.0 (pg_cron jira-sync
setup), Batch 004.1 (milestone branch hardening), Batch 004.2
(dependabot triage + xlsx removal), Batch 004.3 (audit-write security
cleanup, Migration 014), Batch 004.4 (drought rule evaluator,
Migration 015), Batch 004.5 (Brands QA-config extension, Migration
013), Batch 004.6 (pre-demo security batch, Migration 016 — applied
2026-04-28), Batch 004.7 (active alerts panel — brand-scoped render
path, fixes drought-event TypeError), Batch 004.8 (middleware
admin-route gate), Batch 004.9 (audit_log target_type cleanup,
Migration 017 — backfill-only), Batch 004.10 (pre-demo UX polish:
Next 16 params fix, KPI accuracy + Aging card, alerts panel pill
redesign, pointer cursors, default 60-day logs filter, IdleTimeout
removal — 2026-05-01), Batch 004.11 (Saturday code pull-forward:
chart-name eyebrow on chart drawer, Sendback # replaces severity on
rework-volume rows, stacked LogDetailDrawer over chart drawer —
2026-05-01), Batch 004.12 (Saturday dashboard accuracy + logs page
count: dashboard charts now read all-time data, "Total Logs" KPI
relabeled to "Logs This Month", filtered row count on /dashboard/logs
— 2026-05-02), Batch 005.9 (UI copy: remove NBLY-coded examples —
2026-05-06), Batch 005.10 (Sync with Jira pass/fail indicator —
2026-05-06), Batch 005.20 (brand-create admin UI — 2026-05-07),
Batch 005.21 (SharePoint integration groundwork docs —
2026-05-11), Batch 005.23 (§15 pending-rotations restructure
+ CLAUDE_RULES.md companion file — 2026-05-12), Batch 005.24
(joint cross-project doc at /docs/CROSS_CLAUDE.md + R16/R17
added to CLAUDE_RULES.md — 2026-05-12), Batch 005.25 scoping
(5.19 sweep closed + Batch 005.25 entry added — 2026-05-12),
Batch 005.25 (brand dropdown fix + client_brand
normalization — 2026-05-13), Batch 005.22 Phase 2
(shared project+brand filter on Coverage — 2026-05-19),
Batch 005.22 Phase 2.1 (paused-brand hide + single-brand
row skip + status separator — 2026-05-19),
Batch 005.22 Phase 2.1 polish round 1 (showPaused prop +
Option F pill redesign + status-line removal + Clear in
project row + "Select all" without count — 2026-05-19),
Batch 005.22 Phase 3 (dashboard mount + layout reorder +
chart re-scope + ActiveAlertsPanel overflow peek-arrow +
height-preserving empty state — 2026-05-20),
Batch 005.28 (Option B taxonomy hardening — migration 020
quality_log_taxonomy + quality_logs.needs_review,
scripts/normalize-quality-log-fields.ts, constrained
multi-select edit dialog with server-side taxonomy
validation, /dashboard/logs Needs-review worklist filter +
row badge, /dashboard/docs/qa-fields docs hub page, R29 —
2026-05-20),
Batch 005.29 (additive taxonomy seed — migration 021:
Client Request issue category + 6 client-change-request
issue subtypes; flagged unannounced "Base: New Account
Support" Category placeholder for DC + Lacey review —
2026-05-22),
Batch 005.31 (GitHub Actions auto-deploy workflow at
.github/workflows/deploy.yml; closes the 2026-05-19 →
2026-05-22 deploy gap where 3 batches landed in main but
never reached production — 2026-05-22),
Batch 005.31a (hotfix: pass SUPABASE_SERVICE_ROLE_KEY to the
GH Actions build step so admin route modules can import
supabaseAdmin at module-eval during page-data collection;
deploy.yml header rewrite + §13 r31 on paths-ignore /
workflow_dispatch — 2026-05-26),
Batch 009 (SharePoint proxy — three read-only GET routes
under /api/sharepoint/* against Microsoft Graph,
Sites.Selected scope, 60s in-memory cache, share-id
folder resolution, middleware carveout for /api/sharepoint
+ /api/brands — 2026-05-29),
Batch 010 (Coverage pipeline visibility — new server route
app/api/coverage/pipeline runs LIVE JQL per active project (no
cache; that's Batch 007), buckets tickets by brand + the five
pipeline stages [Strategy · Design · Dev · Queued · Live; Done +
Reporting excluded], surfaces three overlay tags from Jira
customfield_12528 "CRO Labels"; Coverage page split into Output +
Pipeline tables with overlay toggles, per-count badges, a
per-count PipelineStageDrawer, teal long-range KPI accent; no
migration, read-only against Jira — 2026-06-03),
Batch 005.1 (Coverage redesign + BrandAdminDrawer — KPI row reorged
into a 9-card grid with three new program-health cards [Overall
Health, Brands Covered N/M, Quality Score], the standalone
/dashboard/settings/coverage admin page replaced by an in-page
per-brand BrandAdminDrawer [tabs Details/QA Config/Milestones/Pause]
and then deleted; shared isInDrought() predicate so KPI + DROUGHT pill
can't diverge; no schema, no migration; Karen full-chain post-flight
PASS-WITH-FINDINGS, Finding 1 injectable-clock test fix in commit
eefc9f0 — 2026-07-03),
Batch auth.2 (admin temp-password reset for read-only users + forced
change + "app never mutates an admin account" guard on every
/api/admin/users surface + full user-mutation audit trail; migration
022 [must_change_password column + audit target-type 'user' + r22
trigger extended to the flag]; middleware forced-change gate +
/api/account/password-changed flag-clear route; Jenny pre-flight
PASS-WITH-FINDINGS folded [C1/H1/H2/M1/M2/M4]; committed-not-pushed,
DO NOT PUSH — Karen next; auth.1 is a separate follow-up commit —
2026-07-05; UI-only follow-up d5fae92 made the forced-change form a
non-dismissable modal),
Batch auth.1 (email migration + email-primary login — dual-mode login
[input has '@' → email, else legacy @cqip.local synthesis kept as TODO
fallback; the earlier username→user_profiles lookup was dropped in the
Karen-HIGH Approach-C fix — it was dead from the unauthenticated login
screen under authenticated-only RLS, plus a static "enter your email"
hint on failed sign-in]; assertTargetIsReadOnlyOrSelf-guarded set_email
PATCH [ordered two-write, retry-once, loud-fail, no rollback;
email_confirm:true sends nothing; dup pre-check .eq not .ilike];
"Last active" column + email-drift indicator via new GET /api/admin/users
[listUsers()]; audit reuses UPDATE+field_name='email']; also repaired the
pre-existing reset flow [@-input → resetPasswordForEmail directly]; no
migration; committed-not-pushed, DO NOT PUSH — Karen PASS after the
Approach-C fix; Lacey then edits the 7 emails self-first + informs users
+ cleanup commit — 2026-07-05),
Batch login-events (login-activity recording, PLUMBING ONLY — no UI:
migration 023 adds append-only login_events table [user_id FK,
occurred_at; admin-SELECT + insert-own RLS], and login/page.tsx
fire-and-forget inserts one row after each successful sign-in; the
count/heatmap that reads it is a later read-only batch; PUSHED with the
auth chain 2026-07-07),
Batch auth-cleanup (final auth commit — all 7 accounts migrated to real
emails 2026-07-05, so login is now EMAIL-ONLY: dropped the legacy
@cqip.local synthesis fallback + orphaned toEmail/normalizeUsername
helpers, label/hint updated; edit-email @fusion92.com smart-default suffix
[full '@' address still accepted]; removed the "Created" column [Last
active stays]; docs sweep — §15 priority reorder + Brand Wellness / 005.2
Coverage Ledger / login read-side entries; no migration; PUSHED with the
auth chain 2026-07-07),
Batch create-flow (user creation on real emails — closes the Karen af647a6
seam: dropped the account_type:'local' → username@cqip.local mint; create
form now takes an Email [same @fusion92.com smart-default as edit-email] +
temp password, server creates the auth user on that real email with
email_confirm:true [no invite email] + must_change_password=true [forced
change on first login], display_name derived from the local part; deleted
orphaned sanitizeUsername + the stale "sign in with username" copy; §2/§5/§9
docs de-referenced from the @cqip.local username model; no migration;
PUSHED + auto-deployed 2026-07-07 as commit 9c476f6, the tip of the auth
chain — every ancestor auth commit deployed with it),
Batch Brand Wellness v1 (read-only milestone-history proof —
components/reports/brand-wellness-report.tsx on /dashboard/reports as a
self-contained card [brand picker + 30/60/90 toggle], all-time "last
milestone" headline + recharts dot-timeline over a real time axis +
milestone list; brand_id-primary/brand_jira_value-fallback resolution;
Reggie-drawer CTA via ?wellnessBrand; v2 (rework overlay/export/compare)
deferred; read-only, no migration, no Jenny; Karen PASS-WITH-FINDINGS →
follow-up commits 3+4 [6248727 ≤28d fallback scoping + 2068886 Output
orphan footer] PASS; PUSHED + deployed 2026-07-07 — 4-commit chain
731e160 → 0a6022b → 6248727 → 2068886),
Batch 005.2 (Coverage Ledger redesign — merged the Batch 010 split
Output + Pipeline tables on /dashboard/coverage into ONE accordion
"Coverage Ledger" [one row/brand, collapsed summary + inline expandable
detail: 7-day sparkline, delivery stats, 5 pipeline-stage cards with the
LOCKED §15 four-chip set]; new KPI strip with two SVG donut gauges
[FULL-SCOPE]; new --ledger-* token layer [dark=mock, light=F92]; new
components/coverage/{coverage-ledger,coverage-gauge}.tsx + DeliverySparkline;
new dailyCounts()/daily7; read-only, no migration, no new route, no Jenny;
Karen PASS-WITH-FINDINGS [commit 2] → PASS [commit 3]; PUSHED + deployed
2026-07-08 — 3-commit chain 924437a → c23bf0a → c09608b),
Batch 005.3 (Coverage Ledger polish — read-only render/UX on the 005.2
ledger: dropped the standalone "Live" summary column [Live never carries a
hold tag → ratio always N/N; SUPERSEDES the 005.2 five-sortable-column
contract → four]; Live stage card shows presence "N live" with a defensive
fallback if a tag ever lands on Live; stage NAME is the drawer link
["LABEL →", "view →" retired]; drawer subheader "gated in {stage}";
"Full detail →" → outlined button; Delivered-28d/This-Wk numerals colored by
status; Paused legend swatch when show-paused; Expand/Collapse-all header
buttons; and a card merge folding the filter + control bar into ONE card via a
new optional ProjectBrandFilter actions prop; read-only, no migration, no
route, no new token, no Jenny; Karen PASS ×2; PUSHED + deployed 2026-07-09 —
3-commit chain 619a259 → 97513b9 → f41f4b0),
Batch 005.4 (Coverage Ledger polish pass 2 — read-only render/copy + one
data-source swap on the ledger: This-Wk numeral reverted to zero-vs-nonzero
[Delivered-28d kept on status color]; sparkline repointed from the flat 7-day
daily7 to a new 12-month monthly12 field [6mo monthly + daily7 both kept];
stage-name button/span typography unified [shared STAGE_NAME_TYPE, UA-leak
fix]; pipeline legend caption removed; column "Ready / Gated" + captions "N
ready · N gated"; fixed-width ready/total label so bars left-align; L1 pruned
the dead LedgerRow.live field [closes the Karen 005.3 deferral]; read-only, no
migration, no route, no new token, no Jenny; Karen PASS; PUSHED + deployed
2026-07-09 — 2-commit chain ea5f8a5 → b4acb4e),
Batch 005.5 (Reggie brand-detail drawer polish — read-only render/interaction
on the all-user brand drawer + one admin ride-along: static "Last 6 months"
label → range dropdown [6 default / 12, reusing 005.4 monthly12]; month bars
clickable → scope the ticket list to that month [recharts Cell + Bar onClick;
reset + selected-bar highlight; no new fetch]; dropped the THIS MONTH KPI [grid
4→3]; ride-along hid the redundant admin Filter-by-brand via a hideBrandFilter
prop on ManageMilestonesDialog [QA-URL editor left intact — HOLD]; tokenized a
pre-existing #F47920 bar fill; read-only, no migration, no route, no Jenny;
Karen PASS; PUSHED + deployed 2026-07-09 — 2-commit chain 9e3a458 → deda4c1),
Batch 012 Client Library Phase A (directive × brand status matrix MVP —
migration 024, directives + directive_brand_status, matrix page; Karen PASS;
deployed 2026-07-17), Batch 012 Client Library Phase B (monitoring ingest —
migration 025 monitoring_findings, Bearer route POST /api/monitoring/findings
[CQIP_CONVERT_MONITORING_TOKEN], admin PATCH .../findings/status, "Needs action"
panel; Karen PASS-WITH-FINDINGS, LOW-1 folded; PUSHED + deployed 2026-07-17 —
2-commit chain d046820 → 7c9fec3), Batch 012 Phase E1 (Pulse shell — renamed
"Client Library" → "Pulse", moved the route /dashboard/client-library →
/dashboard/pulse with a 307 redirect, added deep-linkable per-brand pages
[/dashboard/pulse/[projectKey]/[brandCode]] + a contextual client nav;
render/routing only, no migration, no Jenny; Karen PASS-WITH-FINDINGS, LOW-1
folded; PUSHED + deployed 2026-07-21 — 2-commit chain cfe374f → d315c50),
Batch 012 Pulse E1 follow-on (cross-project client nav — the client list now
shows every active client across projects, single-brand clients collapsed to
one entry, via the pure toClientNavGroups + the extracted pulse:project channel;
render/nav only, no migration, no Jenny; Karen PASS across 3 rounds; PUSHED +
deployed 2026-07-21 — 89c5e54 → 0da2a57), Batch 012 Pulse inline directive
editing (killed both matrix-page modals — create is a pinned inline strip, cell
edit is a row-expansion strip [the E3 seam] later compacted to a single dense
row; reuses the two existing admin routes, no migration, no Jenny; Karen
PASS-WITH-FINDINGS, LOW folded; PUSHED + deployed 2026-07-21 — 96a6e0a → 705bd37
→ d7a44a1), Batch 012 Pulse admin inline directive editing on the BRAND PAGE
(admins edit a directive's status/note for one brand without bouncing to the
matrix; the matrix's save orchestration + `CellEditStrip` extracted to shared
modules both pages call, local copies deleted; reuses the same PATCH route, no
migration, no Jenny; Karen PASS-WITH-FINDINGS → 2 MEDIUM FOLDED [stale-reconcile
blanking the new brand; permanent `Loading…` on a cell-error] → Karen re-confirm
CONFIRMED, 3 LOW noted; **PUSHED** (`52dc69d` is in `origin/main`; the line read
"COMMITTED, NOT PUSHED" until corrected 2026-08-15) —
89e69df → c58364c → d940772 → 52dc69d, 2026-07-25), Batch 012 Convert
reconciliation backfill (one-off data pass —
`scripts/backfill-convert-reconciliation.ts` flips existing Pulse matrix cells to
match real Convert config for the 13 active NBLY brands [207 todo→done, 8
done→todo]; UPDATE-only, no migration, no route, no app-code change; Jenny
gate-confirmed no-Jenny, Karen reviewed; **script COMMITTED but NOT YET RUN** —
Lacey approves + runs, see §16 for the checklist — 2026-07-25), Batch 012 Pulse
directive matrix controls (search · derived-resolve status filter · sort ·
hide-paused-brand columns on the directive matrix; render/interaction only —
no migration/route/schema/fetch/mutation surface, no Jenny, no version bump;
new pure `lib/client-library/matrix-controls.ts` + 20 tests; Karen
PASS-WITH-FINDINGS → 2 MEDIUM + 4 LOW folded across two fold commits → Karen
CONFIRMED; also committed the cited-but-never-committed
`docs/HANDOFF-goal-directives-load.md` whose §7 is the source of the resolve
semantics; PUSHED + auto-deployed 2026-07-29 — prod `/api/health` reports
`version: 72bb2a0`, the last non-docs commit — 5-commit chain 67d3bb1 →
b73fb51 → 221c954 → 72bb2a0 → 2455c3f),
HOTFIX Pulse cell pagination (PostgREST caps an unranged select at
1,000 with NO error, so the matrix silently rendered 1,000 of 1,216
cells — hollow cells, under-counted Outstanding, uneditable rows —
live since 2026-07-22, diagnosed 07-31; shared `fetchAllPaged()` at
three call sites — 2026-07-31, 3-commit chain 202a410 → 075e30e →
fdf367f),
Batch 012 Pulse brand-page parity + matrix paused default (the
brand-page edit target is the leading status DOT, matching the matrix,
with a 24×24 hit area and the right-hand label inert; a client-side
brand-page status filter [`Open` default = an EXCLUSION of done/n_a,
not a whitelist] with its hidden-count readout in one polite live
region; the matrix's Hide-paused defaults ON, justified by a
re-measured prod probe [3 paused brands · 246 cells · all `n_a` · 0
owed] AND now checked at runtime by `countHiddenOwedCells`; one shared
`CELL_STATUS_LABEL` replacing three copies; render-only, no migration/
route/mutation surface, no Jenny, no version bump; Karen
PASS-WITH-FINDINGS ×2, all folded — incl. an inline `style` that had
silently killed two advertised `hover:` rules, now verified in the
COMPILED CSS; PUSHED + deployed 2026-07-31, prod `/api/health` reports
`version: 5870dae` — 6-commit chain 61a03b8 → 0988ce6 → 3363629 →
4ddcb61 → 83ddfd4 → 5870dae),
Batch 012 Pulse restyle core — batch 2 of 4 (reskinned both Pulse
surfaces onto the Claude Design mockup: cells → rounded squares in a
SHARED status-cell component that the matrix, the brand page and a NEW
5-swatch legend all draw from; a six-card KPI strip with every value
derived; THREE independent AND'd filter groups replacing the single
status filter — State [derived across all brands, keeping the verbatim
`state !== 'resolved'` guard] · Status [ONE cell's own status, NOT a
rename of Resolved; its has-at-least-one predicate makes the tabs
deliberately OVERLAP so they do not partition the rows] · Type [the
REAL directive_type column; the mockup's title-regex typeFor() was NOT
ported]; a new --cell-* token family with DERIVED light values; and the
app-wide focus ring raised to ≥3:1 in both themes at the TOKEN level via
a new --f92-focus-ring, which moves keyboard focus across 26 files
without touching them. Render-only + one token pass: no migration,
route, schema or mutation surface, no Jenny. Karen PASS-WITH-FINDINGS —
2 HIGH [dead "rolled out" vocabulary shipped while two docs claimed it
hadn't; --severity-* dark overrides regressing badge TEXT contrast on
four surfaces outside Pulse, reverted] + 2 MEDIUM + 4 LOW, all folded.
v2.5 → v2.6; PUSHED + deployed 2026-08-02, prod `/api/health` reports
`version: 2826f4b` — 4-commit chain dc7fd12 → 68d8c8a → 16716ee →
2826f4b),
Batch 012 Pulse restyle batch 3 of 4 — hover-inspect + note
surfacing (made cell notes FINDABLE rather than merely reachable: a
rendered marker, because across ~1,300 cells there was no way to tell
which had a note without hovering each one; a readout bar on hover AND
focus that says "No note" aloud rather than leaving a blank region;
row + column banding off ONE resolved cell; and `<button disabled>`
removed for non-admins — with `aria-disabled` dropped too, since the
click really pins and announcing "unavailable" on a working button
contradicted the cell's own name. Four findings, three of one shape —
a claim outrunning the mechanism: the `sr-only "has note"` hint had
NEVER been announced (aria-label wins at AccName 2C, so batch 2's
comment saying the information "isn't lost meanwhile" was false); a
pin filtered off screen killed the readout on every cell; the
"Pinned" badge then lied in the state that very fix created; and my
own self-correction was incomplete twice, in code comments and then in
the docs above them. 13 mutations run / 13 caught, four of them
invisible until full-string assertions were forced — mutation beat
review twice in one batch. Render-only, no Jenny; v2.6 → v2.7; PUSHED
+ deployed 2026-08-03, prod `/api/health` reports `version: dc377df` —
5-commit chain d6efb60 → 986c20e → 1e5a592 → cfd1f3d → dc377df),
Coverage metric honesty (the drought bar moved 2 → 4 and the
constant was RENAMED to say so: `COVERAGE_THRESHOLD = 2` became
`COVERAGE_TARGET = 4` with `count < target`, because writing 4 into
the old `<= threshold` spelling would have made 4 read as DROUGHT —
Lacey's rule is "drought is 3, covered is 4". All drought copy now
derives from the constant, removing FOUR literals that were CORRECT
until this batch, which is why nothing had caught them; the Coverage
subtitle also changed SHAPE — "N or fewer" → "fewer than N" — since
the old phrasing with the new number would have called a 4-test brand
flagged. "Quality Score" → "Clean delivery rate" on three surfaces,
the measure unchanged and the old label simply overclaiming.
**⚠ METRIC BREAK EFFECTIVE 2026-08-03 — Overall Health % and Brands
Covered are NOT comparable across this date; a later drop is not
evidence delivery regressed.** Pill, cron and panel AGREE: the batch moved
`COVERAGE_TARGET` to 4 and Lacey edited `alert_rules.config.threshold`
2 → 3 the same day (row 7cb81a7a…, verified), and `count <= 3` IS
`count < 4` over integers — so there is NO live divergence and NO
deferred parity item. That edit has no audit trail and CANNOT have one
(`'alert_rule'` is not in the audit CHECK), so the §16 entry is its only
record. What 010.1 still owns is structural: per-brand targets, one
spelling, and removing the evaluator's unused `DEFAULT_THRESHOLD = 2`
fallback, which would silently reopen the gap if that config row were
ever lost. Karen PASS-WITH-FINDINGS, 5 MEDIUM + 3 LOW all folded,
every one about the record rather than the code; 11 mutations run /
11 caught; 3 of 141 tests failed on the change, which was the good
outcome. Logic/render/copy only, no Jenny; PUSHED + deployed
2026-08-03, prod `/api/health` reports `version: 9088343` — 3-commit
chain bec0e6c → 593bec4 → 9088343),
Deploy unfreeze (`keep_vars` + CI as canonical path — `wrangler.toml`
gains `keep_vars = true` so no deploy silently deletes dashboard
plaintext vars; CI is now the CANONICAL deploy path and local
`npm run deploy` is emergency-only, Lacey 2026-08-06; all 15 Worker
secret bindings audited current, 9 by unauthenticated probe + 4 by
Lacey in-browser + 3 that have no Worker reader at all; the 8 wiped
plaintext dashboard vars were identified from an 8/05 screenshot and
**deliberately NOT re-added** (Lacey 2026-08-06) — 6 are redundant to
proven-current secret bindings and were *weaker* in plaintext, and 2
[`NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`] were never bindings at all but
BUILD-TIME values from GitHub Actions secrets, so a Worker var cannot
supply them; config + docs only, no migration, no Jenny; PUSHED +
CI-deployed 2026-08-06, prod `/api/health` reports `version: d21ceea`
— commit d21ceea),
Batch telemetry-ac (AC → DC telemetry + System Info AC section —
migration 026 adds `ac_telemetry` + never-pruned `ac_version_seen` +
`ac_telemetry_rejects`; new Bearer ingest `POST /api/telemetry/ac`
[`CQIP_TELEMETRY_TOKEN`, 16th secret] carved out of the middleware
matcher; redaction enforced at the DC boundary, truncate-not-400;
inline prune, no cron; admin-only SELECT RLS; System Info renders
"First seen"/error events/idle-or-unreachable, prod-scoped except the
rejects count, which is labelled all-envs because a payload DC could not
parse has no recoverable env; ride-along
fixed the hardcoded `APP_VERSION = 'v1.2'` → stamped from
package.json; Jenny APPROVED-WITH-FINDINGS, all six revisions folded
into the spec BEFORE the build; **PUSHED** (`4a85869` is in `origin/main`; the line read
"COMMITTED, NOT PUSHED" until corrected 2026-08-15) — **the token is still
not minted, so the route remains inert at 500 not_configured** — 4-commit
chain 8b312c1 → d36110b → 379a642 → docs, 2026-08-07).
Batch 012 directive CRUD (edit · soft-delete · archive on the Pulse matrix —
in-place row editor, `PATCH /api/admin/directives/[id]`, `Hide archived`
toggle, duplicate-title blocking; migration 029 `idx_directives_project_title`
UNIQUE `(project_key, title)` spanning archived rows, **APPLIED TO PRODUCTION**
and verified by direct query in the prod Supabase SQL editor 2026-08-18;
Jenny pre-flight ×2, **FIVE Karen rounds**, browser smoke both themes,
Scenario A 409 hand-run; **PUSHED + deployed 2026-08-18; prod `/api/health`
reported `version: e518624` as of 2026-08-18** — 15-commit chain
887f55e → e518624, v2.9 → v3.0 — 2026-08-18).
All migrations 001-025 have run against production (022 + 023 applied with
the auth-chain deploy on 2026-07-07; 024 + 025 with the Batch 012 deploys
2026-07-17).
Batch 004.4.5 produced a UX discovery plan for Coverage + Settings
reorg (Batch 005 implementation). See §16 for full shipped log.
