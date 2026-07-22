# CQIP — CRO Quality Intelligence Platform
## Claude Code Project Context File
### Fusion92 | CRO Department | v2.4

---

## CRITICAL: Read This First

This file is the single source of truth for this project. Every Claude Code session
starts here. Before writing any code, read this file completely. When in doubt about
a decision, check this file before asking the user. All major decisions are recorded
here so they don't need to be re-explained.

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
→ d7a44a1).
All migrations 001-025 have run against production (022 + 023 applied with
the auth-chain deploy on 2026-07-07; 024 + 025 with the Batch 012 deploys
2026-07-17).
Batch 004.4.5 produced a UX discovery plan for Coverage + Settings
reorg (Batch 005 implementation). See §16 for full shipped log.

---

## 1. What This Project Is

CQIP is an automated quality tracking and intelligence dashboard for the Fusion92 CRO
department. It monitors ALL active CRO client projects (not one specific client).

**Core function:** When a Jira ticket is sent backward in the workflow — from a QA or
review stage back into Active Development or Active Design — that transition is a
"rework event." CQIP automatically detects it, logs it with all available Jira data,
and surfaces it in a dashboard for analysis, reporting, and alerting.

**Why it exists:** The team previously tracked this in a manual Excel/CSV log. CQIP
automates that entirely and adds analytics, alerts, and historical pattern detection.

**Future growth (not v1):**
- AI-driven root cause classification (Claude analyzes issue context and suggests
  root cause from the existing taxonomy — always advisory, never automatic)
- Cost analysis (attach estimated hours/cost to rework events)

---

## 2. Tech Stack — Simplified & Final

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 16 (React 19) | App Router, TypeScript |
| UI Components | shadcn/ui + Tailwind CSS v4 + Radix primitives | dialog, dropdown-menu, select, switch |
| Charts | Recharts | All dashboard visualizations |
| Exports | xlsx (read) + xlsx-js-style (write) | Branded F92 styling on Excel; xlsx-js-style added Batch 003 for cell formatting |
| Backend + DB + Auth | Supabase | Edge Functions (webhook/sync logic), Postgres, Auth |
| Hosting | Cloudflare Workers (via @opennextjs/cloudflare) | Deployed with `npm run deploy`. Workers + Assets — NOT Pages. Pages is incompatible with Next 16. |
| Notifications | Microsoft Teams Incoming Webhooks | In-app alerts + Teams only. NO email. |
| Source + CI/CD | GitHub + GitHub Actions | Auto-deploy on push to main via `.github/workflows/deploy.yml` (Batch 005.31). Docs-only commits skip via paths-ignore. Manual `npm run deploy` still works for local testing. |

**No separate backend server.** All serverless logic runs in Supabase Edge Functions.
**No email alerts.** Teams + in-app only.
**No Render, Railway, or any other backend host.**

**Auth detail:** email-based (as of the auth chain, 2026-07-05/07). Login asks
for an email; accounts are created with a real email (fusion address by default,
any full email accepted) and forced to set a new password on first login
(`must_change_password`). The legacy `username@cqip.local` fake-email model was
fully retired — Batch auth.1 migrated the 7 existing accounts, Batch auth-cleanup
made login email-only, and Batch create-flow removed the last `@cqip.local`
minting from user creation. `@cqip.local` now survives only as defensive guards
(reset refusal, create rejection) and in migration history.

**Supabase Edge Functions run on Deno.** Imports use `npm:` prefix. `process.env`
is replaced with `Deno.env.get()`. All shared code (field map, Jira client) is
inlined into each function's `index.ts` because edge functions don't share modules.

---

## 3. Repository Structure

```
cqip/
├── CLAUDE.md                    # This file
├── .env.local                   # Local dev secrets (gitignored)
├── .env.example                 # Template for env vars (committed)
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── wrangler.toml                # Cloudflare Workers config
├── open-next.config.ts          # @opennextjs/cloudflare adapter config
├── components.json              # shadcn config
│
├── .github/
│   └── workflows/
│       └── deploy.yml           # Batch 005.31: auto-deploy to Cloudflare Workers
│                                  on push to main; docs-only commits skipped via
│                                  paths-ignore. Also exposes workflow_dispatch.
│
├── app/                         # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                 # Redirects to /dashboard or /login
│   ├── globals.css              # Includes easter-egg animations
│   ├── login/
│   │   └── page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx           # Konami listener, EasterEggHost, session check
│   │   ├── page.tsx             # Home view (KPIs + charts + matrix rain + click-drill drawer)
│   │   ├── coverage/
│   │   │   └── page.tsx         # Client Coverage (Batch 002 + 010): split Output + Pipeline
│   │   │                          tables. Output = KPIs, drought flags, sparklines, brand
│   │   │                          detail drawer, paused-row treatment, per-column sort,
│   │   │                          leadership-ready CSV/XLSX export. Pipeline (Batch 010) =
│   │   │                          live per-stage WIP counts from /api/coverage/pipeline,
│   │   │                          overlay toggles + per-count badges + PipelineStageDrawer,
│   │   │                          teal long-range KPI accent
│   │   ├── docs/
│   │   │   ├── page.tsx         # Docs home with QA tab guide
│   │   │   └── array-of-sunshine/page.tsx   # Password-gated egg dossier
│   │   ├── logs/
│   │   │   ├── page.tsx         # Log table view (title + batch actions)
│   │   │   └── [id]/page.tsx    # Log detail view (also reachable via in-page drawer)
│   │   ├── reports/
│   │   │   └── page.tsx         # Saved report views + exports (CSV + branded XLSX via SplitButton)
│   │   └── settings/
│   │       ├── page.tsx         # Settings home
│   │       ├── profile/         # Avatar, photo upload, theme, password
│   │       ├── projects/        # Add/remove Jira projects
│   │       ├── alerts/          # Alert rule config
│   │       ├── users/           # User management (admin only)
│   │       ├── audit/           # Admin change log viewer (Batch 001)
│   │       └── system/          # Admin: build stamp + system info (Batch 003)
│   │       # NOTE: settings/coverage/ removed in Batch 005.1 Phase 5 — brand
│   │       #       admin now lives in the Coverage page's BrandAdminDrawer
│   └── api/
│       ├── admin/
│       │   ├── brands/
│       │   │   ├── route.ts                # Batch 005.20: POST — create brand
│       │   │   ├── pause/route.ts          # Batch 004.3: server-side pause/unpause
│       │   │   └── qa-config/route.ts      # Batch 004.5: brand QA config UPDATE
│       │   ├── milestones/
│       │   │   ├── route.ts                # Batch 004.3: create + restore-soft-deleted
│       │   │   └── [id]/route.ts           # Batch 004.3: edit + soft-delete
│       │   └── users/route.ts              # Admin user create/manage (server-only)
│       ├── brands/
│       │   ├── [projectKey]/[brandCode]/route.ts # Batch 004.5: Bearer-auth, single-brand read
│       │   └── route.ts                    # Batch 004.5: Bearer-auth, list-by-project
│       ├── coverage/
│       │   └── pipeline/route.ts           # Batch 010: GET, cookie-bound session (any authed
│       │                                     user). LIVE JQL per active project → per-brand,
│       │                                     per-stage pipeline counts + overlay subsets +
│       │                                     ticket lists. Reads lib/coverage/pipeline-stages
│       │                                     map; brand resolution per §13 r13/r28. Read-only
│       │                                     against Jira; no cache (Batch 007 owns caching)
│       ├── health/route.ts                 # Batch 011: public, dependency-free health probe
│       │                                     (status/timestamp/version/environment); no auth,
│       │                                     no DB; deploy.yml smoke check hits this
│       ├── logs/edit/route.ts              # Server-side edit endpoint
│       ├── jira/sync/route.ts              # Proxy to jira-sync edge function (forwards CQIP_SYNC_AUTH_KEY)
│       └── sharepoint/                     # Batch 009: read-only Microsoft Graph proxy
│           ├── folder/route.ts             # GET ?url= → enumerate folder (single xlsx + Shareable
│           │                                 Screenshots/); share-id resolution; 60s cache
│           ├── xlsx/route.ts               # GET ?ref= → parse Preview Links sheet → structured rows; 60s cache
│           └── image/route.ts             # GET ?ref= → stream image bytes (25 MB cap; no cache)
│
├── components/
│   ├── ui/                      # shadcn components + SplitButton (Batch 003)
│   ├── charts/                  # Recharts wrappers
│   ├── logs/                    # TicketLink, EditLogDialog, ConfirmDeleteDialog, MmiList,
│   │                              LogDetailDrawer (Batch 003), three-dot action menu
│   ├── coverage/                # BrandDetailDrawer, ManageMilestonesDialog, Sparkline (Batch 002),
│   │                              BrandAdminDrawer + BrandQaConfigForm (Batch 005.1 Phase 4 —
│   │                              per-brand admin drawer opened from the Coverage Output table;
│   │                              tabs Details/QA Config/Milestones/Pause; BrandQaConfigForm is
│   │                              the chrome-less QA-config form, canonical home of the
│   │                              BrandQaConfig type. Replaces EditBrandQaConfigDrawer, whose
│   │                              thin-wrapper file was deleted in Batch 005.1 Phase 5 alongside
│   │                              the /dashboard/settings/coverage page),
│   │                              AddBrandDrawer (Batch 005.20 — sheet drawer for
│   │                              creating a brand row, closes audit Q1 / brand-create
│   │                              UI gap; now opened from the Coverage control bar),
│   │                              PipelineStageDrawer + overlay-badge (Batch 010 —
│   │                              Sheet listing a brand's live Jira tickets in a
│   │                              pipeline stage; OverlayCountBadge + TagBadge use the
│   │                              --pill-* tokens per §13 r25)
│   ├── dashboard/               # KPI cards, ActiveAlertsPanel, SyncJiraButton, LogDrawer
│   │                              (shared click-to-filter drawer, Batch 003),
│   │                              SyncStatusPill (Batch 005.10 — pass/fail
│   │                              indicator next to every Sync button)
│   ├── reports/                 # Scorecard, RootCause, Client reports
│   ├── filters/                 # BrandSelector (Batch 005.25 — shared
│   │                              brand-dropdown component; sources from
│   │                              brands table not DISTINCT quality_logs),
│   │                              ProjectBrandFilter (Batch 005.22 Phase 2 —
│   │                              shared multi-select project+brand pill
│   │                              filter; sessionStorage persistence per
│   │                              page; first mount on /dashboard/coverage)
│   └── layout/                  # Nav (sticky-bottom docs + F92 atom + clouds + shooting stars),
│                                  UserAvatar, EasterEggHost, ThemeProvider,
│                                  F92Logo (inline SVG atom), IdleTimeout, Toaster
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   └── server.ts            # Server Supabase client
│   ├── jira/
│   │   ├── client.ts            # Jira API calls (Node/Next). NOTE: throws at import if
│   │   │                          Jira env is missing — do not import from a build-eval path.
│   │   ├── field-map.ts         # Custom field ID mappings (see §7)
│   │   └── search.ts            # Batch 010: lazy (build-safe) JQL search helper, token
│   │                              pagination (/rest/api/3/search/jql). Reads env inside the
│   │                              fn so a route can import it without breaking `next build`.
│   ├── coverage/
│   │   ├── queries.ts           # Batch 002: pure client-side coverage aggregators +
│   │   │                          literal-string rework match (queries.ts ~line 169, §13 r28)
│   │   └── pipeline-stages.ts   # Batch 010: single source of truth for the stage→Jira-status
│   │                              map + overlay-tag (customfield_12528) definitions +
│   │                              response types. Prose companion: docs/batch-010-pipeline-stage-map.md
│   ├── alerts/
│   │   └── rules.ts             # Alert rule evaluation logic
│   ├── audit/
│   │   └── get-changed-by.ts    # Batch 004.3: canonical helper for server-side
│   │                              `changed_by` derivation (see §13 rule 19)
│   ├── api/
│   │   ├── bearer-auth.ts       # Batch 004.5: timing-safe Bearer compare for
│   │   │                          /api/brands/* routes (CQIP_BRANDS_API_TOKEN)
│   │   └── sharepoint-bearer-auth.ts # Batch 009: timing-safe Bearer compare for
│   │                              /api/sharepoint/* routes (CQIP_SHAREPOINT_API_TOKEN —
│   │                              separate blast radius from the brands token)
│   ├── sharepoint/              # Batch 009: Microsoft Graph proxy helpers
│   │   ├── graph-client.ts      # Fresh Azure AD token per logical request + Graph
│   │   │                          fetch wrapper (1 retry on 5xx; token reused across sub-calls)
│   │   ├── site-resolver.ts     # SharePoint web URL → Graph driveItem via share-id
│   │   │                          (u!base64url); config-driven site/drive resolve; URL normalize
│   │   ├── folder-filter.ts     # single-xlsx-at-root + Shareable Screenshots/ logic;
│   │   │                          ignores assets/ and bugs/
│   │   ├── xlsx-parser.ts       # Preview Links sheet → structured rows (xlsx-js-style)
│   │   ├── cache.ts             # Per-Worker-instance Map + 60s TTL
│   │   └── errors.ts            # Error envelope builders + code→HTTP map
│   ├── easter-eggs/
│   │   ├── use-konami-code.ts
│   │   ├── use-loading-message.ts
│   │   └── use-typing-detector.ts
│   └── utils.ts
│
├── supabase/
│   ├── config.toml              # Custom-auth edge functions (jira-sync, jira-webhook,
│   │                              drought-evaluator) must have verify_jwt = false set here —
│   │                              Supabase gateway otherwise rejects non-JWT auth headers
│   │                              before the function runs (see §13 rule 21).
│   ├── migrations/              # All SQL migrations, numbered
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_user_profile_updates.sql
│   │   ├── 003_admin_setup.sql
│   │   ├── 004_theme_and_patterns.sql
│   │   ├── 005_rls_all_tables.sql      # Defines public.is_admin() helper
│   │   ├── 006_radara_config.sql
│   │   ├── 007_avatar_patterns.sql     # Avatar patterns refresh + photo upload
│   │   ├── 008_easter_egg_stats.sql    # Egg trigger counter + RPC
│   │   ├── 009_client_coverage.sql     # Batch 002: brands + test_milestones
│   │   │                                  + Client Coverage Drought rule seed
│   │   ├── 010_brand_aliases.sql       # Batch 002: brand_aliases table + MRR-CA pause
│   │   │                                  + tm.brand_id backfill via aliases
│   │   ├── 011_audit_log_generalize.sql # Batch 002.5b: nullable log_entry_id +
│   │   │                                   target_type/target_id pair + shape CHECK
│   │   ├── 012_audit_log_admin_insert.sql # Batch 002.5b hotfix: admin INSERT policy
│   │   │                                    on audit_log (append-only from client)
│   │   ├── 013_brand_qa_config.sql      # Batch 004.5: brands QA-automation columns
│   │   │                                    + GUY/RBW seed + admin UPDATE RLS policy
│   │   ├── 014_audit_log_security_cleanup.sql # Batch 004.3: audit_log_admin_insert
│   │   │                                        rewritten to use public.is_admin()
│   │   ├── 015_alert_events_brand_id.sql # Batch 004.4: alert_events.brand_id +
│   │   │                                    CHECK + indexes; audit_log target-shape
│   │   │                                    CHECK extended to allow 'alert_event'
│   │   ├── 020_quality_log_taxonomy.sql # Batch 005.28: quality_log_taxonomy
│   │   │                                    reference table (61 seed rows across
│   │   │                                    4 fields, Jira-verbatim) +
│   │   │                                    quality_logs.needs_review column
│   │   └── 021_client_request_taxonomy.sql # Batch 005.29: +8 taxonomy rows
│   │                                        (1 Client Request category + 6
│   │                                        client-change-request subtypes + 1
│   │                                        unannounced "Base: New Account
│   │                                        Support" category placeholder)
│   └── functions/               # Deno Edge Functions
│       ├── jira-webhook/index.ts       # Receives Jira webhook events. Two branches:
│       │                                 (1) milestone branch — first-time entry into
│       │                                 'Dev Client Review' inserts a test_milestones row;
│       │                                 (2) rework branch — sendback transitions create
│       │                                 quality_logs rows. Both run in the same invocation.
│       ├── jira-sync/index.ts          # On-demand + scheduled sync of open logs.
│       │                                 Validates inbound calls against CQIP_SYNC_AUTH_KEY.
│       ├── drought-evaluator/index.ts  # Batch 004.4: daily cron-driven brand drought
│       │                                 reconciler. Validates inbound calls against
│       │                                 CQIP_DROUGHT_AUTH_KEY. verify_jwt=false in
│       │                                 config.toml.
│       └── radara-sweep/index.ts       # Radara's triage sweeps (not deployed yet)
│
├── scripts/
│   ├── field-discovery.ts            # One-time: maps Jira custom field IDs
│   ├── import-csv.ts                 # One-time: imports historical CSV data
│   ├── fix-dates.ts                  # One-time: backfills triggered_at from CSV
│   ├── seed-alert-rules.ts           # One-time: seeds default alert_rules
│   ├── backfill-brands.ts            # On-demand: re-syncs null client_brand rows
│   ├── backfill-jira-summaries.ts    # On-demand: pulls real Jira titles for CSV-imported logs
│   ├── backfill-milestones.ts        # On-demand: backfills historical Dev Client Review
│   │                                   milestones; loads aliases into brand map; logs
│   │                                   unmatched brand_jira_value strings
│   ├── normalize-quality-log-fields.ts # One-shot (Batch 005.28): maps historical
│   │                                   drift on issue_category / issue_subtype /
│   │                                   root_cause_initial / root_cause_final /
│   │                                   resolution_type to Jira-verbatim canonicals.
│   │                                   Idempotent, audit-logged, --dry-run default.
│   └── gen-build-info.js             # Prebuild: stamps build metadata for Settings → System
│
├── docs/
│   ├── multi-client-readiness.md      # Batch 004.99: multi-client audit + SPL onboarding/offboarding playbooks
│   ├── batch-009-sharepoint-spec.md   # Batch 009: SharePoint integration SPEC (DESIGN locked 2026-05-13)
│   ├── CROSS_CLAUDE.md                # Joint coordination doc for DC + AC (Batch 005.24)
│   ├── root-cause-audit-2026-05-20.md # Batch 005.28 audit findings + Option A/B/C recommendation
│   ├── root-cause-taxonomy-mapping.md # Batch 005.28: variant→canonical map (drives normalize script)
│   ├── qa-field-reference.md          # Batch 005.28: living definition of every QA log field
│   ├── batch-010-pipeline-stage-map.md # Batch 010: prose companion to lib/coverage/pipeline-stages.ts
│   │                                     (stage→status map, overlay tags, exclusions)
│   └── ux-plans/                      # UX redesign plans (Coverage + Settings reorg, etc.)
│
└── .claude/
    └── agents/                  # Agent instructions used by Claude Code
        ├── Karen.md             # Reality check, completion assessment
        ├── Jenny.md             # Spec verification against CLAUDE.md
        └── Radara.md            # Triage & reporting agent (edge fn pending deploy)
```

---

## 4. Environment Variables

### Required

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://hupklpjruveleaahufmw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # Server-side only, never expose to client

# Jira
JIRA_API_TOKEN=                  # Atlassian API token (NEVER commit this)
JIRA_EMAIL=                      # Atlassian account email
JIRA_BASE_URL=https://fusion92.atlassian.net

# Teams
TEAMS_WEBHOOK_URL=               # Incoming webhook URL for #cqip-alerts channel

# App
WEBHOOK_SECRET=                  # Random secret to validate Jira webhook payloads
CQIP_SYNC_AUTH_KEY=              # Shared secret between Worker and jira-sync edge function. Can be any random string — generate with `openssl rand -hex 32`. Not a JWT.
CQIP_BRANDS_API_TOKEN=           # Shared secret for the read-only /api/brands endpoints (consumed by the Forge QA-automation app). Same value must be set as an encrypted Forge variable on the Forge side. Generate with `openssl rand -hex 32`. Not a JWT.
CQIP_DROUGHT_AUTH_KEY=           # Shared secret between the daily pg_cron job and the drought-evaluator edge function. Generate with `openssl rand -hex 32`. Not a JWT. Set on Supabase Edge Functions secrets only — Worker does not need this one.
CQIP_CONVERT_MONITORING_TOKEN=   # Batch 012 Phase B — Bearer secret for the external POST /api/monitoring/findings ingest (Convert 008 + any monitoring tool post through it). Timing-safe compare in lib/api/monitoring-bearer-auth.ts. Separate blast radius from the other tokens per §13 rule 27. Generate with `openssl rand -hex 32`. Not a JWT. Set on the Worker via `wrangler secret put` and wherever the monitoring tool runs.

# SharePoint (Batch 009 — Microsoft Graph proxy)
CQIP_SHAREPOINT_API_TOKEN=       # AC (Forge) ↔ Worker bearer for /api/sharepoint/* (timing-safe compare). Separate blast radius from CQIP_BRANDS_API_TOKEN — NOT shared. Generate with `openssl rand -hex 32`. Not a JWT. Rotates atomically across four surfaces (Worker · Forge dev · Forge prod · DC .env.local) per §13 rule 27.
AZURE_CLIENT_ID=                 # Azure app registration "CQIP Dashboard - SharePoint Integration" (6aa464c1-4eb9-4d94-b087-6eebe4fa8cb6). Worker only.
AZURE_CLIENT_SECRET=             # Azure app client secret (client-credentials flow). Worker only. Hygiene rotation pending (Worker-only; Carl-executable; non-blocking).
AZURE_TENANT_ID=                 # Fusion92 Azure AD tenant. Worker only.
SHAREPOINT_SITE_HOSTNAME=fusion92.sharepoint.com   # CRO SharePoint site host.
SHAREPOINT_SITE_PATH=/sites/CRO  # CRO SharePoint site server-relative path.
```

### Where they're set
- **Local dev:** `.env.local` at repo root (gitignored)
- **Cloudflare Worker:** `npx wrangler secret put SECRET_NAME` for each
- **Supabase Edge Functions:** set in Supabase dashboard → Edge Functions → Secrets

### .env.example
Committed to repo with all keys present but empty values.

### `/api/health` env reads (Batch 011 — all optional, none required)
The public health probe reads, in priority order, `NEXT_PUBLIC_BUILD_COMMIT`
(stamped at build by `scripts/gen-build-info.js` — the only one actually set
in this Workers deploy), then `CF_PAGES_COMMIT_SHA`, then `GIT_COMMIT_SHA` for
its `version` field, falling back to `"unknown"`. It reads `NODE_ENV` then
`ENVIRONMENT` for `environment`, also defaulting to `"unknown"`. None are
required; the endpoint never crashes on a missing var. Note: `CF_PAGES_COMMIT_SHA`
is a Cloudflare Pages var and is never set here (CQIP runs on Workers, not
Pages — see §2) — it is kept only as a documented fallback per the Batch 011 spec.

---

## 5. Database Schema

All tables in Supabase Postgres. UUIDs for all IDs. RLS enabled on all tables.
Migrations 001–015 have all run against the production project.

### quality_logs
Primary table. One row = one rework event.

```sql
CREATE TABLE quality_logs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_ticket_id              TEXT NOT NULL,
  jira_ticket_url             TEXT,
  jira_summary                TEXT,
  project_key                 TEXT NOT NULL REFERENCES projects(jira_project_key),
  client_brand                TEXT,
  trigger_from_status         TEXT NOT NULL,
  trigger_to_status           TEXT NOT NULL,
  triggered_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  log_number                  INTEGER NOT NULL DEFAULT 1,
  log_status                  TEXT NOT NULL DEFAULT 'Open'
                                CHECK (log_status IN (
                                  'Open','In Progress','Blocked',
                                  'Pending Verification','Resolved'
                                )),
  detected_by                 TEXT,
  experiment_paused           BOOLEAN DEFAULT FALSE,
  issue_category              TEXT[],
  issue_subtype               TEXT[],
  issue_details               TEXT,
  reproducibility             TEXT,
  severity                    TEXT CHECK (severity IN ('Critical','High','Medium','Low')),
  resolution_type             TEXT[],
  root_cause_initial          TEXT[],
  root_cause_final            TEXT[],
  root_cause_description      TEXT,
  resolution_notes            TEXT,
  who_owns_fix                TEXT,
  test_type                   TEXT DEFAULT 'A/B',
  preventable                 BOOLEAN,
  documentation_updated       BOOLEAN DEFAULT FALSE,
  process_improvement_needed  BOOLEAN DEFAULT FALSE,
  screenshot_urls             TEXT[],
  affected_url                TEXT,
  jira_created_at             TIMESTAMPTZ,
  resolved_at                 TIMESTAMPTZ,
  created_by                  TEXT NOT NULL DEFAULT 'system',
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ai_suggested_root_cause     TEXT[],    -- reserved for future AI classification
  ai_confidence_score         NUMERIC,   -- reserved for future AI classification
  notes                       TEXT,
  is_deleted                  BOOLEAN NOT NULL DEFAULT FALSE,
  needs_review                BOOLEAN NOT NULL DEFAULT FALSE  -- migration 020 (Batch 005.28)
);

CREATE INDEX idx_quality_logs_ticket ON quality_logs(jira_ticket_id);
CREATE INDEX idx_quality_logs_project ON quality_logs(project_key);
CREATE INDEX idx_quality_logs_brand ON quality_logs(client_brand);
CREATE INDEX idx_quality_logs_status ON quality_logs(log_status);
CREATE INDEX idx_quality_logs_severity ON quality_logs(severity);
CREATE INDEX idx_quality_logs_triggered_at ON quality_logs(triggered_at DESC);
CREATE INDEX idx_quality_logs_not_deleted ON quality_logs(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_quality_logs_needs_review                       -- migration 020 (Batch 005.28)
  ON quality_logs(needs_review) WHERE needs_review = TRUE;
```

`needs_review` is set TRUE by `scripts/normalize-quality-log-fields.ts`
when a historical value was auto-mapped to a default during taxonomy
normalization (Interpretation C), or by the normalizer's cross-field-
pollution path when a value was found in the wrong column. The flag is
cleared by `/api/logs/edit` whenever an admin saves the row — the edit
IS the review decision. `/dashboard/logs` has a "Needs review" worklist
filter pill that scopes the table to flagged rows.

### audit_log
Every create/update/delete/status-change on quality_logs is recorded here.
Surfaced at /dashboard/settings/audit (admin-only).

```sql
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_entry_id    UUID NOT NULL REFERENCES quality_logs(id),
  action          TEXT NOT NULL CHECK (action IN (
                    'CREATE','UPDATE','DELETE','STATUS_CHANGE','AI_SUGGESTION'
                  )),
  field_name      TEXT,
  old_value       TEXT,
  new_value       TEXT,
  changed_by      TEXT NOT NULL,  -- user email or 'system'
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT
);

CREATE INDEX idx_audit_log_entry ON audit_log(log_entry_id);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at DESC);
```

**RLS posture as of migration 016 (Batch 004.6):**
- SELECT — `audit_log_select_admin` (admins only). Rename of the
  previous `audit_log_select_all`; tightened so a read-only user
  cannot exfiltrate `changed_by` emails via direct supabase-js.
- INSERT / UPDATE / DELETE — no policy for `authenticated`. Every
  audit row is written by a server route using the service role
  (bypasses RLS); the migration-012/014 admin INSERT policy was
  dropped as vestigial. Append-only contract preserved.

### projects
Active and inactive Jira projects being monitored. Migration 019
(Batch 005.22 Phase 1) added the brand-model columns and the
`projects_brand_model_config_chk` CHECK constraint.

```sql
CREATE TABLE projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_project_key      TEXT UNIQUE NOT NULL,   -- e.g. 'NBLYCRO'
  client_name           TEXT NOT NULL,
  display_name          TEXT NOT NULL,
  jira_project_url      TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at        TIMESTAMPTZ,
  -- Migration 019 (Batch 005.22 Phase 1):
  brand_model           brand_model_type NOT NULL DEFAULT 'multi_brand',
  brand_jira_field_id   TEXT DEFAULT 'customfield_12220',  -- NULL for single-brand
  default_brand_id      UUID REFERENCES brands(id) ON DELETE RESTRICT
);

-- Enum:
CREATE TYPE brand_model_type AS ENUM ('multi_brand', 'single_brand');

-- CHECK enforces config integrity:
--   multi_brand requires brand_jira_field_id (default supplies it)
--   single_brand requires default_brand_id
--   multi_brand MAY also set default_brand_id (escape-hatch fallback)
ALTER TABLE projects ADD CONSTRAINT projects_brand_model_config_chk CHECK (
  (brand_model = 'multi_brand' AND brand_jira_field_id IS NOT NULL) OR
  (brand_model = 'single_brand' AND default_brand_id IS NOT NULL)
);
```

**Seeded values:**
- `NBLYCRO`: `brand_model='multi_brand'`,
  `brand_jira_field_id='customfield_12220'`, `default_brand_id=NULL`.
  Behavior identical to pre-Phase-1.
- `SPLCRO`: `brand_model='single_brand'`, `brand_jira_field_id=NULL`,
  `default_brand_id=<SPL brand uuid>`. The single-brand path skips
  Jira-field extraction entirely.

These are the ONLY two rows in `projects` (verified against prod
2026-07-11). **`FPOO` is NOT in this table** — it is an archived CRO
Jira project (historical data only, no longer an active client) that
was never onboarded into CQIP, so it carries no `projects` row and no
CQIP brand/coverage config. It is reachable only by read-only JQL
against Jira directly (that is how the 2026-07-10 ClickUp-Archive Step-A
scan reached its 268 FPOO tickets — see §15). It is in scope for
all-time / Client Archive counts and excluded from active-client and
live-coverage views. Do not add an FPOO `projects` row to make it
"appear archived": there is nothing to seed, and a row with
`is_active=FALSE` would still pull it into brand-resolution and
onboarding code paths it has never been part of.

Migration 019 also UPDATEd the SPL brand row's `jira_value` from
`'SPL'` (the bare brand-code shape used at SPL onboarding 2026-05-07)
to `'SPL - Spotloan'`, aligning all brands on the
`"CODE - Display Name"` convention. This keeps the
`quality_logs.client_brand` ↔ `brands.jira_value` literal-string
equality in `lib/coverage/queries.ts:168` working uniformly across
both brand models (Option γ writeback per §13 rule 28).

### user_profiles
Extends Supabase auth.users with role info. Auth is email-based (as of the auth
chain, 2026-07-05/07): `email` holds the real login address; the legacy
`<username>@cqip.local` fake-email model is fully retired (see §2 Auth detail).

```sql
CREATE TABLE user_profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL,
  display_name        TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'read_only'
                        CHECK (role IN ('admin','read_only')),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at       TIMESTAMPTZ,
  color_preference    TEXT,
  pattern_preference  TEXT CHECK (pattern_preference IN (
                        'none','polka_dots','stripes','squiggles',
                        'checkered','checkered_large'
                      )),
  theme_preference    TEXT CHECK (theme_preference IN ('light','dark')),
  avatar_url          TEXT,       -- profile photo URL (Supabase Storage)
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE  -- migration 022 (Batch auth.2)
);
```

**`role`, `is_active`, and `must_change_password` are trigger-protected**
(migration 016 for the first two, extended by migration 022, Batch
auth.2). A `BEFORE UPDATE OF role, is_active, must_change_password`
trigger raises `insufficient_privilege` when `auth.uid()` is set and
the caller is not an admin, even if RLS would otherwise permit the row
update. The existing `user_profiles_self_update` policy (migration 005)
is still row-level only, so the trigger is the sole defense against a
read-only user mutating their own role / is_active / forced-change flag
via supabase-js. Service-role calls (auth.uid() IS NULL) bypass the
trigger so `/api/admin/users` (set flag) and
`/api/account/password-changed` (clear flag) can still write these
columns. See §13 rule 22.

**`must_change_password`** (migration 022, Batch auth.2) is the
forced-change flag. Set TRUE by `/api/admin/users` `set_temp_password`
when an admin issues a temp password; cleared by
`/api/account/password-changed` after the user changes their password
(the change-password form on `/dashboard/settings/profile` calls that
route once the GoTrue `updateUser` succeeds — the browser can't clear
it directly). `middleware.ts` pins any user with the flag set to the
change-password screen until it clears. See §13 rules 22 + 35.

### alert_rules

```sql
CREATE TABLE alert_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name             TEXT NOT NULL,
  rule_type             TEXT NOT NULL CHECK (rule_type IN (
                          'severity_threshold','frequency_pattern',
                          'per_ticket','aging'
                        )),
  config                JSONB NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  notification_channels JSONB NOT NULL DEFAULT '["teams","in_app"]',
  created_by            TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### alert_events

```sql
CREATE TABLE alert_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id             UUID NOT NULL REFERENCES alert_rules(id),
  log_entry_id        UUID REFERENCES quality_logs(id),
  brand_id            UUID REFERENCES brands(id),    -- migration 015
  triggered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at         TIMESTAMPTZ,
  CONSTRAINT alert_events_target_required CHECK (    -- migration 015
    log_entry_id IS NOT NULL OR brand_id IS NOT NULL
  )
);

-- Migration 015 partial indexes:
CREATE INDEX idx_alert_events_brand_open
  ON alert_events(brand_id)
  WHERE resolved_at IS NULL AND brand_id IS NOT NULL;

CREATE UNIQUE INDEX idx_alert_events_one_open_per_brand_rule
  ON alert_events(brand_id, rule_id)
  WHERE resolved_at IS NULL AND brand_id IS NOT NULL;
```

`brand_id` was added in migration 015 (Batch 004.4) to support
brand-scoped alerts (the drought rule). Existing log-scoped alerts
(severity, repeated-sendback, etc.) continue to use `log_entry_id` and
leave `brand_id` NULL. The CHECK enforces "at least one scope set"; the
unique partial index race-protects the drought evaluator's "INSERT new
open alert" path.

**Known gap:** the drought evaluator now writes `alert_events` rows on
its daily run, but Teams webhook dispatch is still NOT wired — Teams
POST will land in Batch 006. See §14 and §15.

### saved_reports

```sql
CREATE TABLE saved_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  created_by    TEXT NOT NULL,
  filters       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### easter_egg_stats (migration 008)
Counts how often each named easter egg triggers. Used by /array-of-sunshine
to show how many times the dossier has been unlocked.

```sql
CREATE TABLE easter_egg_stats (
  egg_name           TEXT PRIMARY KEY,
  hit_count          INTEGER NOT NULL DEFAULT 0,
  last_triggered_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic increment RPC — authenticated users only, SECURITY DEFINER.
CREATE FUNCTION increment_easter_egg(p_name TEXT) RETURNS INTEGER …
```

### sync_runs (migration 018 — Batch 005.10)
Persists the outcome of every `jira-sync` invocation (manual + cron)
so the Sync with Jira pill has a durable pass/fail signal and silent
cron failures stop being possible. Writes happen exclusively from the
edge function via the service role (one INSERT at start, one UPDATE
at end of each invocation).

```sql
CREATE TABLE sync_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by    TEXT NOT NULL,        -- 'manual:<email>' | 'cron:jira-sync-6h'
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  status          TEXT NOT NULL CHECK (status IN ('running','success','failed')),
  logs_updated    INTEGER,
  logs_failed     INTEGER,
  error_category  TEXT CHECK (
                    error_category IS NULL OR
                    error_category IN ('auth_mismatch','jira_401','jira_500','network','unknown')
                  ),
  error_message   TEXT,
  duration_ms     INTEGER
);

CREATE INDEX idx_sync_runs_started_at ON sync_runs(started_at DESC);
CREATE INDEX idx_sync_runs_status ON sync_runs(status);
```

**RLS posture** matches Batch 004.6's audit_log cleanup
(migration 016):
- SELECT — `sync_runs_select_authenticated`. Open to all authenticated
  users so read-only viewers see the indicator too — sync-state
  visibility is universally useful.
- INSERT / UPDATE / DELETE — no policy for `authenticated`. Every row
  is written by the `jira-sync` edge function via the service role
  (bypasses RLS).

**Trigger source attribution.** The Worker proxy at `/api/jira/sync`
forwards `X-Triggered-By: manual:<email>` (email derived server-side
via `getChangedBy()` per §13 rule 19). The edge function reads that
header and falls back to `cron:jira-sync-6h` when absent, so a
missing header doesn't silently mask attribution — there's exactly
one cron caller right now.

**Auth-mismatch rows.** When inbound `CQIP_SYNC_AUTH_KEY` validation
fails, the function still writes a one-shot `failed` row (status
goes straight from nonexistent to failed, never running) with
`triggered_by='unknown:auth_mismatch'`, so the UI can surface
auth drift without the function having to authenticate the caller
to learn who they are.

### login_events (migration 023 — Batch login-events)
Append-only record of every successful login. **Plumbing only** — this
table just starts capturing history; the count / GitHub-style heatmap
that reads it is a later read-only batch (there is no visible surface
today).

```sql
CREATE TABLE login_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_events_user_occurred
  ON login_events(user_id, occurred_at DESC);
```

**RLS posture:**
- SELECT — `login_events_admin_select` (admins only, via
  `public.is_admin()`); the future heatmap/count is admin-only.
- INSERT — `login_events_insert_own`: `WITH CHECK (user_id = auth.uid())`.
  Written fire-and-forget from `app/login/page.tsx` right after
  `signInWithPassword` succeeds (the now-authenticated client satisfies
  the policy). A failed insert is swallowed (`console.warn` at most) and
  never blocks the login.
- No UPDATE/DELETE policy — append-only from the client; the service role
  bypasses RLS for the future read-side aggregation. No public/anon access.

### storage: avatars bucket (migration 007)
Public-read bucket for profile photos. Each user can only write under
their own `<uid>/` folder. `img-src` in next.config.ts CSP includes the
Supabase origin so avatars render.

### brands (migration 009 — Batch 002)
Canonical per-project brand list with pause state. Drives Client Coverage.

```sql
CREATE TABLE brands (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key     TEXT NOT NULL REFERENCES projects(jira_project_key),
  brand_code      TEXT NOT NULL,           -- e.g. "MRA"
  jira_value      TEXT UNIQUE NOT NULL,    -- matches customfield_12220 value,
                                           -- e.g. "MRA - Mr Appliance"
  display_name    TEXT NOT NULL,           -- e.g. "Mr. Appliance"
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_paused       BOOLEAN NOT NULL DEFAULT FALSE,
  paused_at       TIMESTAMPTZ,
  paused_by       TEXT,
  paused_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Seeded with 16 NBLY brands. MRR-CA is paused at seed time
(migration 010) — no active tests. Admins can pause/unpause via
`/dashboard/settings/coverage`.

**QA automation config columns (migration 013 — Batch 004 brands extension):**
The brands table also carries config consumed by an external Forge
QA-automation app (separate repo). All columns nullable except the
gate flag, which defaults to FALSE.

```sql
-- Added by migration 013 (idempotent ADD COLUMN IF NOT EXISTS):
live_url_base                    TEXT
                                 CHECK (live_url_base IS NULL OR (live_url_base LIKE 'https://%' AND live_url_base NOT LIKE '%/'))
default_local_sub_areas          TEXT[]
client_contact_name              TEXT
client_contact_jira_account_id   TEXT
url_pattern                      TEXT
                                 CHECK (url_pattern IS NULL OR url_pattern IN ('convert-preview','live-qa'))
qa_automation_enabled            BOOLEAN NOT NULL DEFAULT FALSE
notes                            TEXT
updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- Partial index on the Forge consumer's hot path:
CREATE INDEX idx_brands_qa_automation_enabled
  ON brands(qa_automation_enabled) WHERE qa_automation_enabled = TRUE;
```

`qa_automation_enabled` gates API exposure: `/api/brands/*` returns 404
for any row where it is FALSE, even if the row exists. GUY and RBW are
seeded with `qa_automation_enabled = TRUE`, `url_pattern =
'convert-preview'`, and a `live_url_base`. The remaining 14 NBLY
brands stay at the FALSE default until Lacey enables them via the
admin UI.

The QA columns are edited from the Coverage page's `BrandAdminDrawer`
(QA Config tab → `BrandQaConfigForm`, Batch 005.1 Phase 4), which calls
`PATCH /api/admin/brands/qa-config`. (Before Batch 005.1 this lived on the
now-deleted `/dashboard/settings/coverage` page via the
`EditBrandQaConfigDrawer`, both removed in Phase 5.) That route writes the
brand row with the service role and emits one audit_log row per changed
field with `target_type = 'brand'` and `changed_by` derived server-side
from `auth.uid()` per §13 rule on audit-write attribution.

`updated_at` has no trigger — none of the existing tables in this
project use updated_at triggers, so the admin route sets it explicitly
on UPDATE. Direct SQL UPDATEs that bypass the route will not bump
`updated_at` automatically.

### brand_aliases (migration 010 — Batch 002)
Maps historical Jira brand strings (e.g. `"MRR - Mr Rooter"` without
"Plumbing") to canonical brands. Webhook + scripts resolve `brand_id`
by checking `brands.jira_value` first, then falling back to
`brand_aliases.jira_value`.

```sql
CREATE TABLE brand_aliases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  jira_value  TEXT UNIQUE NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### test_milestones (migration 009 — Batch 002)
First-time-reached milestones per Jira ticket. Today only the
`dev_client_review` milestone is recorded; the schema is open for more.
Used by Client Coverage to compute "tests delivered" windows and
drought flags.

```sql
CREATE TABLE test_milestones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_ticket_id    TEXT NOT NULL,
  jira_ticket_url   TEXT,
  jira_summary      TEXT,
  brand_id          UUID REFERENCES brands(id),  -- nullable; aliases resolve later
  brand_jira_value  TEXT,
  milestone_type    TEXT NOT NULL DEFAULT 'dev_client_review',
  reached_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source            TEXT NOT NULL DEFAULT 'webhook'
                      CHECK (source IN ('webhook','manual','backfill')),
  created_by        TEXT NOT NULL DEFAULT 'system',
  notes             TEXT,
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_test_milestones_unique
  ON test_milestones(jira_ticket_id, milestone_type)
  WHERE is_deleted = FALSE;   -- partial: soft-deleted rows can coexist
```

The unique index is partial on `is_deleted = FALSE`. This is intentional:
soft-deleted rows do not block re-creation when an admin re-adds the
milestone. The webhook's duplicate-check SELECT also filters on
`is_deleted = FALSE` before inserting.

### quality_log_taxonomy (migration 020 — Batch 005.28)
Canonical option list for the 4 multi-select taxonomy fields on
`quality_logs`. The edit dialog and the server-side validator in
`/api/logs/edit` both read from this table; the seed mirrors Jira's
option strings verbatim (per N2 Policy A, locked 2026-05-20) so values
arriving via webhook pass the same validation as values entered via the
dashboard.

```sql
CREATE TABLE quality_log_taxonomy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name      TEXT NOT NULL
                    CHECK (field_name IN (
                      'issue_category',
                      'issue_subtype',
                      'root_cause',
                      'resolution_type'
                    )),
  canonical_value TEXT NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_taxonomy_field_value
  ON quality_log_taxonomy(field_name, canonical_value);

CREATE INDEX idx_taxonomy_active
  ON quality_log_taxonomy(field_name, sort_order)
  WHERE is_active = TRUE;
```

**Seed:** 61 rows total — 9 `issue_category`, 38 `issue_subtype`,
14 `root_cause` (used for BOTH `root_cause_initial` and
`root_cause_final` columns since they share customfield_12905 in Jira),
9 `resolution_type`. Sourced from a live Jira fetch 2026-05-20.

**RLS posture** (matches Batch 004.6 audit_log cleanup):
- SELECT — `quality_log_taxonomy_select_authenticated` (all
  authenticated users; the dashboard edit dialog reads from this,
  and read-only users benefit from the docs-hub rendering).
- INSERT / UPDATE / DELETE — no `authenticated` policy. Taxonomy
  additions land via SQL editor (admin UI deferred — backlog item).
  Service-role writers bypass RLS.

**Adding a new canonical value:** when Lacey adds an option in Jira,
add a sibling row to `quality_log_taxonomy` with the same string and a
`sort_order` slot. There is no live sync from Jira to this table; the
two stay aligned by human discipline.

### audit_log generalization (migrations 011 + 012 — Batch 002.5b)
Original `audit_log` had `log_entry_id NOT NULL` with FK to
`quality_logs`, so milestone and brand mutations had no place to land.
Migration 011 made `log_entry_id` nullable, added a generic
`(target_type, target_id)` pair, and a CHECK constraint that enforces:

- `target_type = 'quality_log'` requires `log_entry_id IS NOT NULL`, OR
- `target_type IN ('test_milestone','brand','alert_event','user')` requires `target_id IS NOT NULL`

(Migration 015 added `'alert_event'` to the allowed list so the
drought evaluator's start/end audit rows can reference an
`alert_events.id`. Migration 022 — Batch auth.2 — added `'user'` so
user-account mutations from `/api/admin/users` and
`/api/account/password-changed` — create, role change, deactivate,
temp-password/reset, forced-change-completed — can reference a
`user_profiles.id` in `target_id`. Note these rows use the
CHECK-allowed `action` values (`CREATE`/`UPDATE`) plus a descriptive
`field_name`, per the codebase audit convention — the `audit_log.action`
CHECK has its own allowed set and was NOT changed.)

Legacy rows were back-filled with `target_type = 'quality_log'` and
`target_id = log_entry_id`. Migration 012 added an admin-only INSERT
policy on `audit_log` so admin-initiated milestone/brand audit writes
from the browser succeed (service-role edge-function writes were already
fine; they bypass RLS). No UPDATE/DELETE policies — append-only from the
client.

---

## 6. Jira Workflow & Trigger Logic

### Status Hierarchy
```
Strategy
Ready for Design
In Design
  └── Active Design   ← SENDBACK TARGET (trigger_to_status)
  └── Design QA
Design Client Review
Ready for Dev
In Development
  └── Active Dev      ← SENDBACK TARGET (trigger_to_status)
  └── Dev QA          ← SENDBACK SOURCE
Dev Client Review     ← SENDBACK SOURCE
Queued                ← SENDBACK SOURCE
Live                  ← SENDBACK SOURCE
Done                  ← SENDBACK SOURCE
Reporting
```

### Trigger Rule (log is created when ALL are true)
1. ticket.project_key exists in projects table WHERE is_active = TRUE
2. transition.to   IN ['Active Dev', 'Active Development', 'Active Design']
3. transition.from IN ['Dev QA', 'Dev Client Review', 'Queued', 'Live', 'Done']

**Direction matters.** Forward movement (Active Dev → Dev QA) does NOT create a log.

### Log Number Calculation
```sql
SELECT COALESCE(MAX(log_number), 0) + 1
FROM quality_logs
WHERE jira_ticket_id = $1 AND is_deleted = FALSE
```

### Auto-Advance Log Status (ENABLED)
When the same ticket later transitions FROM Active Dev/Active Design BACK TO Dev QA
or Dev Client Review → automatically set the most recent Open/In Progress log for
that ticket to 'Pending Verification'.

### Milestone Trigger (Batch 002 — separate branch in same webhook)
When a ticket transitions INTO `Dev Client Review` (any forward
direction — e.g. `In Development → Dev Client Review`), the webhook
inserts a `test_milestones` row for that ticket if one does not already
exist with `is_deleted = FALSE`. This branch runs BEFORE the rework
branch in `jira-webhook/index.ts` so a transition that doesn't satisfy
`isValidTransition` (the rework rule) still records a milestone. A
single webhook invocation can record both: e.g. `Dev QA → Active Dev`
won't create a milestone, but the prior `In Development → Dev Client
Review` invocation did.

The milestone branch is wrapped in try/catch and logs to
`console.error` on failure but does not return non-200, so the rework
branch still runs in the same invocation.

### Brand resolution flow (used by webhook, sync, scripts)

Resolution depends on the project's brand_model. Look up
`getProjectConfig(projectKey)` first; the model determines the path.

**Single-brand projects** (e.g. SPLCRO):
1. Use `projects.default_brand_id` directly. No field is read.
2. `quality_logs.client_brand` = the brand row's `jira_value`
   (Option γ writeback).
3. `test_milestones.brand_jira_value` = NULL (no field consulted).

**Multi-brand projects** (e.g. NBLYCRO):
1. Read `projects.brand_jira_field_id` from project config.
2. Extract the brand string via `extractBrand()` (handles string,
   single-select, cascading, array shapes).
3. Look up `brands.jira_value = <extracted>` → got `brand_id`? Done.
4. Otherwise, `brand_aliases.jira_value = <extracted>` → got
   `brand_id`? Done.
5. Otherwise, fall back to `projects.default_brand_id` if set.
6. Otherwise, log a warning (with project + fieldId + extracted)
   and proceed with `brand_id = NULL`. `test_milestones.brand_jira_value`
   stores the verbatim extracted string for later alias seeding.

`quality_logs.client_brand` always stores `brands.jira_value`
verbatim (Option γ). `lib/coverage/queries.ts` rework counts depend
on literal string equality between this column and the brand row's
jira_value, so the writeback never constructs a synthetic string.

The backfill scripts (`scripts/backfill-milestones.ts`,
`scripts/backfill-brands.ts`) follow the same project-aware flow and
surface unmatched multi-brand strings so we can patch `brand_aliases`.

### Webhook registration
Webhook URL format (live):
```
https://hupklpjruveleaahufmw.supabase.co/functions/v1/jira-webhook?secret=<WEBHOOK_SECRET>&apikey=<ANON_KEY>
```
Jira can't send custom headers — we pass `secret` as query param (with timing-safe
comparison) and `apikey` as query param. See `supabase/functions/jira-webhook/index.ts`.

### Jira-side automation (CONFIGURED — 2026-05-06)
When a ticket enters `Dev QA` or `Dev Client Review`, all QA tab
custom fields are cleared on that ticket so the next rework cycle
starts clean. Implemented as two Jira native automation flows in the
Neighborly CRO space:
- "Clear QA Fields On Transition" — auto-trigger on status entry
- "Manually Clear QA Fields" — manual button via lightning bolt
  menu on tickets, for edge cases
Owner: Lacey Hay. Actor: Automation for Jira. CQIP stays read-only
against Jira (see §13 rule 5) — these are Jira-side automations,
not CQIP-initiated.

---

## 7. Jira Custom Field ID Mapping

**Source:** fusion92.atlassian.net

```typescript
// lib/jira/field-map.ts
export const JIRA_FIELD_MAP = {
  who_owns_fix:               'customfield_13120',  // Select List (cascading)
  detected_by:                'customfield_12910',  // User Picker (single)
  documentation_updated:      'customfield_12914',  // Checkboxes
  experiment_paused:          'customfield_12912',  // Checkboxes
  issue_category:             'customfield_12871',  // Select List (multiple)
  issue_subtype:              'customfield_12904',  // Select List (multiple)
  preventable:                'customfield_12911',  // Checkboxes
  process_improvement_needed: 'customfield_12913',  // Checkboxes
  reproducibility:            'customfield_12907',  // Select List (single)
  resolution_type:            'customfield_12908',  // Select List (multiple)
  root_cause:                 'customfield_12905',  // Select List (multiple)
  root_cause_description:     'customfield_12909',  // Paragraph (text)
  severity:                   'customfield_12906',  // Select List (single)
} as const;
```

Brand field is per-project (`projects.brand_jira_field_id`); no
longer in `JIRA_FIELD_MAP`. NBLYCRO uses `customfield_12220`;
SPLCRO is single-brand and reads no field. See §6 brand resolution
flow and §13 rule 28.

### Field Type Notes
- `who_owns_fix` is a **cascading select** — returns parent/child object.
  Extract: `field?.child?.value ?? field?.value ?? null`
- `detected_by` is a User Picker — extract: `field?.displayName ?? null`
- Checkbox fields return an array — check `field?.length > 0` for boolean conversion
- Multi-select fields return arrays of `{value, id}` objects — map to `value` strings
- Brand field (per-project, NBLYCRO uses `customfield_12220`) is a
  single select returning `{ value: "CODE - Display Name", id }` —
  e.g. `{ value: "MRA - Mr Appliance", id: "13743" }`. NOT cascading.
  The `quality_logs.client_brand` column stores the resolved brand
  row's `jira_value` verbatim (Option γ writeback per §13 rule 28).

---

## 8. Jira API Integration

### Authentication
```typescript
// Node (scripts, API routes):
const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
// Deno (edge functions):
const auth = btoa(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`);
headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
```

### Base URL
```
https://fusion92.atlassian.net/rest/api/3
```

### Key Endpoints
```
GET  /issue/{issueKey}                          # Fetch full ticket
GET  /issue/{issueKey}/changelog                # Fetch transition history
GET  /field                                     # Field discovery (one-time)
GET  /project                                   # List all projects
```

### Webhook Payload Shape (jira:issue_updated)
```typescript
{
  webhookEvent: 'jira:issue_updated',
  issue: {
    key: 'NBLYCRO-124',
    fields: { /* all issue fields including custom */ }
  },
  changelog: {
    items: [{
      field: 'status',
      fromString: 'Dev QA',
      toString: 'Active Development'
    }]
  }
}
```

---

## 9. User Accounts

### Admins (full access)
- Lacey — primary admin
- Xandor — admin

### Read-Only
- Katy, Mark, Jacob, Randy, Zach

**All 7 accounts (2 admin + 5 read-only) are active and have logged in.**
Account creation is admin-only via Settings → Users; no self-registration.
Sign-in is by real email (all 7 migrated off `@cqip.local` on 2026-07-05).
New accounts are created with a real email + a temp password and are forced
to set a new password on first login (`must_change_password`); no invite
email is sent (admin conveys the temp password out-of-band).

---

## 10. Alert Rules — Default Configuration

Seeded into alert_rules on first deploy.

| Rule | Type | Config |
|------|------|--------|
| Critical Issue Open | severity_threshold | severity = 'Critical' |
| High Severity Spike | severity_threshold | severity = 'High', count >= 3, window = 7 days |
| Repeat Root Cause | frequency_pattern | same root_cause_final, count >= 5, window = 30 days |
| Client Rework Spike | frequency_pattern | same client_brand, count >= 4, window = 14 days |
| Repeated Sendback | per_ticket | log_number >= 3 |
| Long-Running Open | aging | log_status IN ('Open','In Progress'), age >= 14 days |
| Client Coverage Drought | frequency_pattern | scope = 'brand_coverage', threshold = 2, window_days = 28, skip_paused = true (seeded by migration 009) |

All rules are configured to notify on `["teams", "in_app"]`. Neither
channel is yet dispatching: Teams webhook POST and in-app Toaster
pings are both Batch 006 work. Today, `alert_events` rows are written
by the drought evaluator and persisted, but no notification fires.

**Client Coverage Drought** now has a working daily evaluator at
`supabase/functions/drought-evaluator/index.ts` (Batch 004.4). It
writes `alert_events` rows when droughts begin and end. The Coverage
table also surfaces drought visually at read-time. The other six
alert rules (Critical Issue Open, High Severity Spike, Repeat Root
Cause, Client Rework Spike, Repeated Sendback, Long-Running Open)
do not yet have evaluators wired and remain on the Batch 005 backlog.

---

## 11. Historical Data Import

**Source file:** `NBLY_QualityTrackingLog_Error_Log_.csv` (imported)
**Import rule:** Only import rows where `Type of Issue` is NOT empty.
Rows with only Date/Client/JiraTicket/Status and no other data are excluded.

### CSV → Schema Field Mapping
```
Date              → triggered_at
Client            → client_brand
Type of Issue     → issue_category (array wrap single value)
Issue Details     → root_cause_description
Origin            → detected_by
JIRA Ticket       → jira_ticket_id + jira_ticket_url
Status (csv)      → log_status (map: Resolved→Resolved, In Progress→In Progress,
                                 Open→Open, Blocked→Blocked)
Severity          → severity
Summary           → jira_summary
Screenshot Links  → screenshot_urls (array wrap if present, skip if 'N/A')
URL               → affected_url (skip if 'N/A')
Root Cause-Initial → root_cause_initial (array wrap)
Root Cause-Final  → root_cause_final (array wrap)
Resolution        → resolution_notes
Errored           → trigger_from_status
Who Owns the Fix  → who_owns_fix
Test Type         → test_type (default 'A/B' if empty)
```

For all imported rows: `created_by = 'csv_import'`, `log_number = 1`

---

## 12. Design System — Fusion92 Brand

### Colors
```typescript
export const F92 = {
  orange:  '#F47920',   // Primary accent, H1 headings
  navy:    '#1E2D6B',   // Secondary, H2 headings, table headers
  dark:    '#1A1A2E',   // Body text
  gray:    '#6B7280',   // Muted text
  lgray:   '#9CA3AF',   // Placeholder text
  warm:    '#FEF6EE',   // Alt table rows, light backgrounds
  border:  '#E8D5C4',   // Warm borders
  white:   '#FFFFFF',
} as const;
```

F92 atom logo is reproduced as inline SVG in `components/layout/f92-logo.tsx`
using orange/navy/tan rings plus a blue nucleus ring and white core. Scales
freely, transparent background.

### Severity Color Coding
```
Critical → red-600    (#DC2626)
High     → orange-500 (#F97316)
Medium   → yellow-500 (#EAB308)
Low      → gray-400   (#9CA3AF)
```

### Log Status Color Coding
```
Open                 → blue-500
In Progress          → indigo-500
Blocked              → red-500
Pending Verification → yellow-500
Resolved             → green-500
```

---

## 13. Key Business Rules

1. **Soft deletes only.** Never hard-delete a quality_log row.
   Use `is_deleted = TRUE`. All queries filter `WHERE is_deleted = FALSE`.

2. **Audit everything.** Every INSERT, UPDATE, or status change to quality_logs
   must write a corresponding row to audit_log. Batch deletes write one row
   per log, not per group.

3. **Root cause snapshot.** At log creation time, save the current value of
   `customfield_12905` (Root Cause CRO) as BOTH `root_cause_initial` AND
   `root_cause_final`. As Jira syncs update `root_cause_final`, `root_cause_initial`
   never changes.

4. **test_type default.** If no test type tag exists on the Jira ticket, default to 'A/B'.
   'Deployment' is set when the Jira ticket has a 'Deployment' tag/label.

5. **No writes to Jira.** CQIP is read-only against Jira. Never POST/PUT/DELETE to Jira API.
   QA-tab clearing on Dev Client Review is configured in Jira Automation, not here.

6. **Admin-only mutations.** Only users with role = 'admin' can create, edit,
   delete, or update status on log entries. read_only users can only read and export.

7. **Periodic sync frequency.** Every 6 hours (cron). Syncs all logs WHERE
   log_status NOT IN ('Resolved') AND is_deleted = FALSE.
   Re-fetches full Jira ticket and updates all QA tab fields. Admins can also
   run an on-demand sync from the "Sync with Jira" button on Dashboard, Logs,
   and Reports pages.

8. **Log number is per-ticket.** Count non-deleted logs for the same
   jira_ticket_id to determine the next log_number.

9. **Teams notifications** include: rule name, trigger reason, client
   brand, project key, log ID, and a direct link to the CQIP log
   detail page. Dispatch is not yet wired — `alert_events` rows are
   created but no Teams POST happens. Planned for Batch 006.

10. **Webhook security.** Validate incoming Jira webhooks against WEBHOOK_SECRET.
    Reject any request that fails validation with 401. Secret accepted via
    `?secret=` query param or `X-Webhook-Secret` header; timing-safe compare.

11. **Easter egg stats.** Egg triggers are counted in `easter_egg_stats`.
    Increment via `increment_easter_egg(p_name)` RPC (SECURITY DEFINER).
    Counts only fire on successful triggers, not page views.

12. **Webhook has two independent branches.** A single Jira status-change
    invocation runs the milestone branch (entry into Dev Client Review)
    AND the rework branch (sendback) sequentially. Failures in the
    milestone branch are caught and logged but do NOT prevent the
    rework branch from running. The function still returns 200.

13. **Brand lookup falls back through aliases.** Anywhere a brand is
    resolved from a Jira string (webhook, backfill, coverage UI),
    follow `brands.jira_value → brand_aliases.jira_value →
    projects.default_brand_id → null` (Batch 005.22 Phase 1 added the
    `default_brand_id` step as the final fallback for multi-brand
    projects). Never invent a brand row. Unmatched strings get logged
    and stored verbatim in `brand_jira_value` so an alias seed can
    backfill later. Single-brand projects skip this chain entirely
    and use `projects.default_brand_id` directly — see rule 28.

14. **Soft-deleted milestones are recoverable.** The
    `idx_test_milestones_unique` index is partial on `is_deleted = FALSE`,
    so re-adding a previously-deleted milestone for the same
    `(ticket, type)` is allowed. The Manage Milestones dialog restores
    soft-deleted rows on re-add (does not insert a new row).

15. **Audit writes for non-quality-log targets** must use
    `target_type IN ('test_milestone','brand','alert_event')` +
    `target_id`. The CHECK constraint will reject half-specified rows.
    Browser-initiated audit writes need the user to be admin (RLS
    policy from migration 012); edge-function writes via service role
    bypass RLS.

16. **Sync auth uses CQIP_SYNC_AUTH_KEY, not the Supabase anon key.**
    Worker → jira-sync edge function handshake uses a custom shared
    secret on both sides (Supabase secrets + Wrangler secrets). The
    decoupling protects against Supabase-managed key rotations breaking
    the path. 401 from the edge function almost always means the two
    values drifted; see `app/api/jira/sync/route.ts` for the surfaced
    error message.

17. **Build stamp.** `scripts/gen-build-info.js` runs as `prebuild`
    (npm script) and writes a build manifest read by Settings → System.
    Do not regenerate manually outside of build.

18. **Milestone creation is independent of brand resolution.** On a
    `Dev Client Review` transition, the `test_milestones` row is ALWAYS
    inserted. Brand resolution is best-effort and must never gate the
    insert. Order of attempts for brand value (multi-brand projects):
    (1) webhook payload's configured `brand_jira_field_id`,
    (2) `getIssue()` fallback (wrapped in its own try/catch),
    (3) `null`.
    Single-brand projects skip steps 1–3 and resolve via
    `projects.default_brand_id` directly (rule 28). Payload wins on
    conflict — it is the authoritative snapshot of the transition that
    just happened, and matches the state Jira fired the webhook from.
    Null `brand_id` rows are recoverable via
    `scripts/backfill-milestones.ts`. Reason: losing the milestone
    fact because an unrelated Jira call failed (token expiry,
    transient outage) is unacceptable. Batch 004.1 hardening; incident
    2026-04-24 NBLYCRO-1452.

    **`getIssue()` summary backfill is decoupled from brand resolution
    (Batch 005.22 Phase 1).** The webhook fetches the full issue if
    EITHER the payload is missing summary OR the configured brand
    field is empty; both bits of recovered data flow into the
    milestone insert through their own paths
    (`resolvedSummary` for summary; `resolveBrandForTicket()` for
    brand). A `getIssue()` failure still allows a null-summary or
    null-brand insert. The helper signature takes both
    `payloadFields` and optional `fullIssueFields` so the caller —
    not the resolver — owns the decision to invoke `getIssue()`.

19. **Audit log writes derive `changed_by` from `auth.uid()`
    server-side.** Client-supplied `changed_by` values are ignored,
    universally — every audit-emitting route forwards a forensic
    `console.warn` if a body key called `changed_by` is present, then
    discards it. The canonical helper is `getChangedBy()` in
    `lib/audit/get-changed-by.ts`: it resolves
    `user_profiles.email` → `auth.users.email` → `'unknown'`, never
    throws on missing-profile rows, and is the single source of truth
    for every audit write. Direct browser inserts into `audit_log` are
    prohibited; client mutations that need an audit row go through a
    server route that calls `getChangedBy()` against a cookie-bound
    Supabase client and then writes via the service-role client.

20. **Cron-driven audit writes use
    `changed_by = 'system:<cron-name>'`** as the documented exception
    to rule 19. There is no `auth.uid()` in a scheduled-job context, so
    deriving from the session would always fail. Instead, the cron
    function uses a stable, identifiable string the audit page can
    filter on. Currently in use:
    - `system:drought-evaluator` — daily Brand Coverage Drought
      reconciler (Batch 004.4). Also: paused brands are deliberately
      not evaluated by this cron, so any open drought alert from
      before a pause stays open until the brand is unpaused; this
      preserves the audit trail of when each drought began. The
      `jira-sync` auto-advance audit row also uses `changed_by =
      'system'` (predates this rule); future cron-context writers
      should follow the `'system:<cron-name>'` convention so they
      remain distinguishable in `/dashboard/settings/audit` filters.

21. **Edge functions with custom Bearer auth must set `verify_jwt = false`**
    in `supabase/config.toml`. The Supabase gateway defaults to
    `verify_jwt = true`, which means it tries to parse the
    Authorization header as a Supabase-signed JWT and rejects any
    non-JWT bearer (e.g., our hex shared secrets) with 401 before the
    function runs. Affected: `jira-sync`, `jira-webhook`,
    `drought-evaluator`. Any future function that validates a custom
    shared secret (e.g., a future Teams-dispatch trigger) must add
    this setting at deploy time.

22. **`user_profiles.role`, `user_profiles.is_active`, and
    `user_profiles.must_change_password` are trigger-protected; cron /
    service-role writers bypass via the `auth.uid() IS NOT NULL`
    guard.** Migration 016 (Batch 004.6) adds a `BEFORE UPDATE OF role,
    is_active` trigger on `user_profiles`; migration 022 (Batch auth.2)
    extends both the trigger's `OF` list and its guard condition to
    also cover `must_change_password`. The trigger raises
    `insufficient_privilege` when the caller has `auth.uid()` set and
    is not an admin. This closes the
    privilege-escalation hole left by the row-level
    `user_profiles_self_update` RLS policy (migration 005), which
    cannot constrain individual columns and would otherwise let a
    read-only user run
    `supabase.from('user_profiles').update({ role: 'admin' })` from
    dev tools. **Why:** RLS is the wire-level guard for normal
    callers; the trigger is the column-level guard that RLS can't
    express; the `auth.uid() IS NOT NULL` check carves out service-role
    writers (no auth.uid() in that context) so `/api/admin/users` can
    still toggle these columns via `supabaseAdmin`. **How to apply:**
    Any future code that toggles `role`, `is_active`, or
    `must_change_password` from the browser must go through a server
    route that uses the service role; cookie-bound clients will hit the
    trigger. The trigger is intentionally tight — only those three
    columns; benign self-updates (theme, avatar, color) continue to use
    the existing self-update RLS policy.

23. **CLAUDE.md is updated atomically with every ship.** Every batch
    that touches code, schema, or behavior must include CLAUDE.md
    updates in the same commit:
    - Header "Current deployed state" line — append the new batch.
    - §5 schema doc — any new table, column, RLS policy, trigger.
    - §13 — new business rule if behavior changed.
    - §15 — remove anything that just shipped from Pending; add new
      backlog items.
    - §16 — new batch entry with date, what shipped, why.
    - Footer date stamp; version bump only on structural changes.

    **Why:** drift compounds. Future Claude Code sessions reading
    CLAUDE.md must trust it as ground truth, which only works if it
    stays current. A doc that's "mostly right" stops being load-bearing
    fast — the cost of catching up after several batches is much higher
    than the cost of a few CLAUDE.md edits per batch. **How to apply:**
    when assembling a commit, treat CLAUDE.md as part of the change
    set. If a batch ships without doc updates because nothing
    structural changed, say so explicitly in the commit message
    ("docs: no CLAUDE.md update — refactor only") so the omission is
    intentional, not forgotten.

24. **Admin settings paths are middleware-gated; `/dashboard/settings/profile`
    is carved out for self-service.** `middleware.ts` performs a
    single `user_profiles` lookup on requests matching
    `/dashboard/settings/*` (except `/profile`) and redirects
    non-admins to `/dashboard`. The carve-out exists because
    `/dashboard/settings/profile` is the page where every user
    (admin and read_only alike) edits their own theme, avatar, and
    password. **Why:** before Batch 004.8, settings pages were
    "browseable but useless" for non-admins — each page mounted, did
    its own client-side admin check, then rendered "Admin access
    required". The middleware gate removes the surprise factor for a
    guest demo and adds a server-side line of defense in front of the
    client-side checks. **How to apply:** any new admin-only page
    added under `/dashboard/settings/...` is automatically gated; no
    per-page work needed. Any new self-service page under
    `/dashboard/settings` must be added to the carve-out (extend the
    negation in `isAdminSettingsPath`) or the middleware will block
    legitimate users. Settings pages still keep their own client-side
    `isAdmin` check as belt-and-suspenders against middleware bypass
    (misconfigured matcher, deploy regression).

25. **Alert pills use per-theme CSS tokens, never inline hex colors.**
    Each severity tier has a triplet of CSS vars in `app/globals.css`:
    `--pill-{color}-bg`, `--pill-{color}-border`, `--pill-{color}-fg`,
    defined in both `:root` and `:root[data-theme="dark"]`. Light mode
    uses 50-stop tinted fill + 600-stop border + body-text color; dark
    mode uses 900-stop deep fill + 600-stop border + lighter ramp text
    (200-stop). Both modes hit WCAG AA on the active alerts panel
    surface. **Why:** the previous attempt used inline hex on the JSX
    directly — colors that read fine on the white light-mode panel
    turned to mush on the dark-navy panel. Single source of truth in
    tokens means a one-line change in globals.css adjusts every pill.
    **How to apply:** any future severity-coded UI element (badges,
    chips, status indicators) should reference these tokens or follow
    the same per-theme pattern. Do not hardcode `#FAEEDA` etc. in JSX.

26. **Drawer-on-drawer stacking is supported and intentional.**
    shadcn/ui's `Sheet` (Radix Dialog) handles overlay z-index
    and focus management for nested drawers. The chart drill-down
    pattern uses this: clicking a row in `LogDrawer` opens
    `LogDetailDrawer` over it without closing the underlying
    drawer. Closing the detail drawer returns to the chart drawer
    with state intact. ESC closes topmost first; overlay click
    closes only the topmost. **Why:** preserves the user's place
    in their filtered list — they can drill into a ticket, back
    out, drill into another. **How to apply:** new drawers that
    need to layer on top of an existing drawer can render
    unconditionally (Radix handles stacking) — don't try to
    coordinate state to "hide" the underlying drawer.

27. **Custom auth keys must rotate atomically across both sides.**
    Any function using a custom shared secret
    (`CQIP_SYNC_AUTH_KEY`, `CQIP_DROUGHT_AUTH_KEY`,
    `CQIP_BRANDS_API_TOKEN`, future ones) has the secret set in
    two places: the consumer (Worker, pg_cron command, or external
    integration) and the producer (Supabase Edge Functions
    secrets). When rotating, BOTH sides must change in the same
    change window. **Why:** pg_cron logs HTTP 4xx responses as
    "succeeded" (any HTTP response counts as success at the cron
    layer), so a one-sided rotation produces silent failure that
    can persist for days. The 2026-05-07 drought incident
    exemplified this — a partial rotation created 7 days of silent
    failure caught only during an unrelated sweep. **How to apply:**
    treat key rotation as a coordinated procedure, not two
    independent operations. Document the new value in both places
    before either side is updated. For pg_cron-invoked functions,
    after rotation manually invoke the function once via `curl`
    with the new key to verify, then wait for the next scheduled
    tick and re-verify.

28. **Project brand model determines brand resolution path.**
    `multi_brand` projects extract from `projects.brand_jira_field_id`
    then walk `brands → aliases → projects.default_brand_id → null`.
    `single_brand` projects skip field extraction and use
    `projects.default_brand_id` directly. The CHECK constraint on
    `projects` enforces that each model has its required configuration.
    `default_brand_id` is permitted on multi-brand projects too as
    an escape-hatch fallback for tickets with empty brand fields;
    NBLYCRO leaves it NULL today (preserving identical behavior to
    pre-Phase-1). The `getIssue()` summary backfill is independent
    of brand resolution and applies to both models — see rule 18.
    `quality_logs.client_brand` writeback is always the resolved
    brand row's `jira_value` verbatim (Option γ); never a synthetic
    construction from `brand_code + display_name`. **Why:**
    `lib/coverage/queries.ts` Coverage rework counts compare
    `quality_logs.client_brand` to `brands.jira_value` via literal
    string equality. Construction would diverge the two columns and
    silently zero the rework column. **How to apply:** any future
    code that writes to `quality_logs.client_brand` (webhook, sync,
    backfill scripts) must source the string from `brands.jira_value`,
    not construct it. New brand rows must follow the
    `"CODE - Display Name"` convention — enforced by admin UI copy,
    not by schema constraint.

29. **Taxonomy-backed multi-select fields are constrained at every
    write surface.** The five quality_logs array columns
    `issue_category`, `issue_subtype`, `root_cause_initial`,
    `root_cause_final`, `resolution_type` may only contain strings
    that exist in `quality_log_taxonomy` (where `field_name` matches
    and `is_active = TRUE`). The edit dialog
    (`components/logs/edit-log-dialog.tsx`) renders these as
    `MultiCombobox` instances sourced from the taxonomy. The server
    route `/api/logs/edit` validates every submitted value against
    the taxonomy before write; unknown values return 400 with an
    actionable message. The webhook and sync edge functions write
    Jira-verbatim strings, which match the taxonomy seed verbatim
    (N2 Policy A, locked Batch 005.28). **Why:** before Batch 005.28
    the dialog's free-text input on `root_cause_final` and the CSV
    import's free-text passthrough on the other four fields created
    18+ near-duplicate variants in production (`Missing /
    Miscommunicated Info` vs `Missing or Miscommunicated
    Information` etc.) — silently splitting charts and breaking the
    Repeat Root Cause alert's exact-string match. **How to apply:**
    new options are added via SQL editor on
    `quality_log_taxonomy` (admin UI deferred — §15 backlog).
    `root_cause_initial` remains frozen at log creation per rule 3
    and is NOT editable through the dialog or the route; the route's
    ALLOWED_FIELDS whitelist excludes it deliberately. Saving any
    row with `needs_review = TRUE` clears the flag — the edit IS
    the review decision per Interpretation C; the route emits a
    dedicated audit_log row for that transition with
    `field_name='needs_review'`.

30. **Every push to main that touches application code triggers an
    automated Cloudflare Workers deploy** via
    `.github/workflows/deploy.yml`. Docs-only commits skip the deploy
    via the `paths-ignore` filter (`**.md`, `docs/**`, `.github/**`).
    Manual `npm run deploy` is still available for local testing but
    should not be the primary deploy path. **Why:** the 2026-05-19 →
    2026-05-22 deploy gap — three batches landed in main (Phase 3 on
    2026-05-20, Batch 005.28 on 2026-05-20, Batch 005.29 on
    2026-05-22), none reached production — demonstrated that
    "documented but unimplemented" auto-deploy is worse than "no
    auto-deploy claim". The docs claim made the team trust deploys
    were happening when they weren't; Lacey caught up production with
    a manual `npm run deploy` on 2026-05-22 (commit ea12fb9). **How
    to apply:** when adding a new branch deploy, staging environment,
    or preview deploy, extend this workflow file rather than creating
    parallel deploy paths. Required repo secrets:
    `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
    `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` —
    the last two are inlined into the Next bundle AND into
    `next.config.ts` CSP at build time, so missing them at build
    time will produce a Worker that blocks Supabase calls via CSP.
    Runtime-only secrets (`JIRA_API_TOKEN`, `CQIP_SYNC_AUTH_KEY`,
    etc.) live on the Worker via `wrangler secret put` and are NOT
    in the workflow env.

31. **GitHub Actions workflow edits do not trigger themselves.**
    `.github/workflows/deploy.yml` carries
    `paths-ignore: ['**.md', 'docs/**', '.github/**']`, so commits
    that only touch the workflow file are ignored as a trigger.
    Empty commits hit the same path: they touch zero paths and are
    treated as fully-ignored. **Why:** the paths-ignore filter is
    correct for protecting prod from docs-only churn, but it has
    the side-effect that a workflow fix won't deploy itself —
    Batch 005.31a's first manual run was needed precisely because
    the prior workflow commit didn't auto-trigger. **How to apply:**
    after editing `deploy.yml`, manually re-run from the Actions
    tab via workflow_dispatch (the workflow exposes this trigger
    for exactly this reason). Same applies any time you need a
    deploy without a code change — there is no "deploy current
    main" button other than workflow_dispatch.

32. **Long-running blockers must be re-verified before being
    treated as still-blocking** — see CLAUDE_RULES.md **R21**
    (blocker reality-check), the canonical home for this rule,
    with siblings **R19** (stale-status re-verification) +
    **R20** (last-verified timestamps). In short: if a §15 item
    has been "pending external action" or "gated on X" for more
    than 7 days, run a 5-minute reality-check (curl the
    endpoint, query the system, confirm the gate is still real)
    before planning around it. If verification flips the state,
    update §15 + the relevant CROSS_CLAUDE.md section (§3
    contract surfaces or §4 pending rotations) + any spec doc
    that propagated the gate, atomically, per §13 rule 23.
    **Why this entry exists in §13 too:** the originating
    incident was Dashboard-side (Batch 009 treated as "Azure
    prereqs blocked" for 23 days, 2026-05-03 → 2026-05-26, when
    the prereqs had been granted before the 2026-05-02 Postman
    work — a phantom gate inherited from an early misread and
    never re-tested). The 7-day drought-evaluator silent
    failure (2026-05-01 → 2026-05-07, see §13 rule 27) is the
    same failure mode: confidence in a stale state outlasting
    the state's actual reality. R21 carries the full behavioral
    rule; this §13 entry is a discoverability hook so a reader
    scanning §13 lands on it. (Behavior rules live in
    CLAUDE_RULES.md per the CLAUDE.md / CLAUDE_RULES.md split;
    §13 business rules cross-reference them rather than
    duplicate.)

33. **Coverage pipeline counts are LIVE Jira at render, off a single
    source-of-truth stage map.** `app/api/coverage/pipeline/route.ts`
    runs one JQL per active project against
    `/rest/api/3/search/jql` (token-paginated) for tickets whose
    status is in the union of the five pipeline stages, then buckets
    them by brand + stage in-route. There is **no** `jira_tickets`
    cache — caching is Batch 007. The stage→status map and the
    overlay-tag definitions are defined once in
    `lib/coverage/pipeline-stages.ts` (prose companion
    `docs/batch-010-pipeline-stage-map.md`); never scatter Jira
    status strings across the route or page. **`Done` and
    `Reporting` are deliberately excluded** from the Live column and
    every other column. Overlays (Needs Info / Troubleshooting / On
    Hold) live on the multi-select custom field **`customfield_12528`
    "CRO Labels"** — NOT the `labels` field — matched on the option
    `value` with exact Jira casing (`"Needs info"`,
    `"Troubleshooting"`, `"On hold"`; verified against prod
    2026-06-03). Brand resolution reuses the §13 r13/r28 chain
    (single_brand → `default_brand_id`; multi_brand → field →
    `brands.jira_value` → `brand_aliases` → `default_brand_id` →
    null); unresolved tickets are excluded from per-brand counts and
    reported via the response `unresolved_count` (NBLYCRO has many
    legitimately brand-less Strategy tickets). "Age in stage" uses
    `statuscategorychangedate` as the v1 approximation — true
    per-status age needs the changelog (out of scope, flagged in
    code). **Why:** a single map keeps the data layer and the UI from
    drifting on status spellings; live-at-render is correct until the
    Batch 007 cache exists. **How to apply:** new statuses or overlay
    tags go in `pipeline-stages.ts` + the companion doc (atomically,
    rule 23); the new JQL helper `lib/jira/search.ts` reads env
    lazily so server routes can import it without breaking
    `next build` (unlike `lib/jira/client.ts`, which throws at
    import).

34. **In-flight batches live in §15.5 with locked decisions + phase
    status. On ship, the entry MOVES to §16 (full shipped entry) and
    is REMOVED from §15.5** — a batch appears in exactly one of
    §15.5 / §16, never both. This prevents §15.5 from duplicating the
    shipped log and rotting. Lifecycle order reads §15 backlog →
    §15.5 in-flight → §16 shipped: when a backlog item starts active
    build, it gains a §15.5 entry (locked decisions so they're not
    relitigated, current phase, open questions, spec pointer) and the
    §15 backlog item gets a one-line "IN FLIGHT — see §15.5"
    annotation; when it ships, the §15.5 entry is deleted in the same
    commit that writes the §16 entry (atomically, per rule 23).

35. **The app never mutates an admin account; every user-account
    mutation is audited and admin-issued temp passwords force a change.**
    (Batch auth.2.) Every state-changing surface on
    `/api/admin/users` — `set_temp_password`, `reset_password`, the
    generic role / `is_active` PATCH branch (both directions), and
    `DELETE` — runs `assertTargetIsReadOnly(id)` and returns 403 when
    the target's role is `admin`. Promotion (read_only → admin) still
    works because the target is read_only at guard time; demoting,
    deactivating, resetting, or temp-password-ing an admin is refused.
    Admin recovery is out-of-band only (self-initiated email post-auth.1,
    or the Supabase console). Every one of those mutations (plus create)
    also writes an `audit_log` row with `target_type='user'`,
    `target_id=<user id>`, `changed_by` server-derived via
    `getChangedBy()` on the **cookie-bound** route client (§13 r19) —
    the temp password itself is never logged, never persisted, and
    returned once with `Cache-Control: no-store`. `set_temp_password`
    sets `must_change_password=true`; the middleware gate (r24 neighbor)
    pins that user to `/dashboard/settings/profile` until they change
    their password, at which point the profile form calls
    `/api/account/password-changed` to clear the flag (service role —
    the flag is trigger-protected per r22). **Why:** the app must not be
    a lever for privilege changes or admin takeover; the audit trail
    must cover identity mutations, not just quality-log edits (§13 r2);
    a temp password with no forced change is a standing credential.
    **How to apply:** any NEW user-mutation surface must call
    `assertTargetIsReadOnly` (or the auth.1 `assertTargetIsReadOnlyOrSelf`
    variant, which permits admin self-edit for email migration) and emit
    a `target_type='user'` audit row. Because that action-value must be
    in the `audit_log.action` CHECK, reuse `CREATE`/`UPDATE` with a
    descriptive `field_name` (the codebase convention) rather than
    inventing a new action string.

---

## 14. What Is NOT In Scope for V1

- Email notifications (Teams + in-app only)
- AI root cause classification (data model is ready; feature is not built)
- Cost analysis
- Jira write operations
- Self-registration (admin creates all accounts)
- Convert.com integration
- Mobile app

### Planned but not yet shipped
- **Teams webhook dispatch** — Planned as Batch 006 (dedicated batch).
  `alert_events` rows are now written (Batch 004.4); Teams POST, rate
  limiting, retry, message cards, and test-mode toggle are all
  Batch 006 scope.
- **Token-expiry monitoring** — no alert when `JIRA_API_TOKEN` silently
  expires (prompted the 2026-04-23 incident). Planned Batch 005.
- **Radara Edge Function deploy** — code is committed at
  `supabase/functions/radara-sweep/index.ts` but not deployed.

(SharePoint integration shipped as Batch 009 on 2026-05-29 —
moved out of Planned. See §16.)

### Identified for v1.5 (post-v1)
- **Multi-client readiness** — Batch 004.99 discovery shipped
  2026-05-06 (`docs/multi-client-readiness.md`). Phase 1 of the
  remediation shipped 2026-05-07 as Batch 005.22 (project-aware
  brand resolution: SPL ingestion now correct). Subsequent phases
  (filter pills, project-create UI hardening, brand-create
  single-brand affordances) tracked as Batch 005.22 Phases 2-5.
- **Test milestone count exclusion flag** — admin-set
  `excluded_from_count` boolean with required reason; admin restore;
  Coverage queries respect the flag. Tracked as Batch 5.8.

---

## 15. Pending / Active TODOs

### Pre-demo / immediate
(Empty — all demo-prep items shipped via Batch 004 series, including
Batch 004.10 UX polish on 2026-05-01.)

### Awaiting external action

**Forge integration**
- [ ] **Forge consumer integration** — dashboard side of the
      brands API is shipped; Forge app (separate repo,
      Atlassian Forge platform) drafting v0.0.4 SPEC_phase1.
      CQIP_BRANDS_API_TOKEN installed on Forge dev + prod
      variables 2026-05-12. No production traffic on
      `/api/brands/*` until Forge consumer goes live. Tracked
      cross-project; not actionable on dashboard side.

**Pending rotations (live, both sides)**
- [ ] **Rotate Azure client secret** — Hygiene rotation.
      Current secret was visible in 2026-05-02/03 verification
      screenshots and in the 2026-05-26 verification curl.
      Carl-executable (Worker-only rotation per
      `docs/batch-009-sharepoint-spec.md` §7). Batch 009 has
      now SHIPPED on the current value (functional, admin
      consent in place), so this stays a pure hygiene rotation
      per §13 rule 27 (secret rotation atomicity). Target
      window: Fri 2026-05-29 / Mon 2026-06-01. Worker-only —
      no Forge surface holds this value (only
      CQIP_SHAREPOINT_API_TOKEN does), so no AC coordination.
- [ ] **Rotate CQIP_BRANDS_API_TOKEN** — In circulation since
      brands API initial setup (Batch 005.13-005.14 timeframe).
      Never rotated. Not known to be compromised — rotation
      is hygiene per §13 rule 27 (secret rotation atomicity).
      Lives on three surfaces:
        - Worker secret (set via `wrangler secret put`)
        - DC local .env on Dashboard repo
        - Forge variables (dev + prod, installed 2026-05-12)
      Atomic rotation required: all three surfaces within a
      single window. Lacey kicks off; DC + AC walk their
      respective sides. AC mirror tracked under AC §15
      "Pending rotations (live, both sides)" — relay
      2026-05-12.

### Batch 004.99 (post-Batch-004) — Multi-Client Readiness Review — shipped 2026-05-06
Discovery batch. Identifies all NBLY-hardcoded assumptions in CQIP
and produces a remediation plan. Doesn't ship code itself — produced
a markdown report at `docs/multi-client-readiness.md`. See §16 for
the shipped-log entry.

**Immediate downstream consumer:** SPL (second CRO client) onboarding.
Project info ready as of 2026-05-06. The 004.99 output is the
playbook SPL onboarding follows. Subsequent client onboardings
follow the same playbook.

**Hard prerequisite for Batch 007 (Custom Jira Boards)** — boards
are multi-client from day one; building them on a single-client
foundation would mean refactoring after onboarding. 004.99 → SPL
→ Batch 007 is the locked sequence.

Deliverables (all complete):
- [x] Audit `JIRA_FIELD_MAP` for NBLY-specific fields (e.g.,
      `nbly_brand`) → §3 of report. Result: instance-global,
      `nbly_brand` key name is cosmetic.
- [x] Audit jira-webhook JQL filter (currently `project = NBLYCRO`)
      → §4.1. Result: Critical operational item; Lacey adds a
      second webhook for SPLCRO (Option A recommended).
- [x] Audit brand extraction logic in jira-webhook → §4.2 + §4.5.
      Three sub-cases for SPL's brand field shape.
- [x] Audit Coverage page filters/labels for hardcoded NBLY
      assumptions → §5. Result: clean (filters populate from
      brands table).
- [x] Audit CSV import script for NBLY-specific column mappings
      → §2 (one-shot scripts, NBLY-frozen).
- [x] Document onboarding playbook (how to add a new CRO client)
      → §8 (10 steps, ~45 min day-of).
- [x] Document offboarding playbook (deactivate without losing
      history) → §9.
- [x] Identify any UI labels/copy that say "NBLY" → §5 (5 strings
      across 4 files; all Medium severity copy fixes).

### Batch 005 (post-demo) — Backlog cleanup, scope-locked
Strict rule: only items already in scope at lock time. No new
additions.

- [x] **5.1 Coverage + Settings UX redesign** — **SHIPPED 2026-07-03 as
      Batch 005.1; see §16.** Delivered the unified `BrandAdminDrawer`
      (tabs Details / QA Config / Milestones / Pause) on the Coverage
      page, reorged the KPI row with 3 new program-health cards, and
      deleted the standalone `/dashboard/settings/coverage` page.
- [ ] **5.2 Jira token-expiry monitoring** — Teams alert when Jira
      API returns 401/404 from sync or webhook. Calendar-style
      early warning. Prevents silent breakage like the 2026-04-23
      token-expiry incident.
- [ ] **5.4 Brands soft-delete** — only if business need emerges.
      Currently brands table uses hard delete.
- [ ] **5.5 Investigate 12 mystery POSTs** — During 2026-04-24 sync
      debugging, 12 unexpected webhook POSTs appeared in invocation
      logs in a 3-min window. Likely Jira queue drain. If pattern
      repeats, dig in. Otherwise mark resolved.
- [ ] **5.6 webhook_events table** (maybe) — for richer diagnostics
      on webhook failures. Per Jenny's review of Batch 004.1.
      Skip if current diagnostics are sufficient.
- [ ] **5.7 Jira-sync graceful 404 handling** — when sync hits a
      deleted Jira ticket, currently errors and stops. Refactor to
      catch 404 specifically, mark log Resolved with note
      "Auto-resolved: Jira ticket deleted from project", continue
      processing remaining logs.
- [ ] **5.8 Test milestone count exclusion flag** — new
      `excluded_from_count` boolean + `excluded_reason` text on
      test_milestones; 3-dot menu in BrandDetailDrawer milestone
      cards; Coverage queries filter excluded; EXCLUDED badge
      with reason tooltip; restore action. Coordinate with
      drought evaluator (excluded milestones don't count toward
      drought threshold).
- [ ] **5.12 `alert_events.context jsonb` for runtime snapshots** —
      add a `context jsonb` column on `alert_events`, written by
      evaluators at alert creation time with the human-readable
      snapshot they computed (e.g. `{"summary": "MRR has 2
      milestones in last 28 days", "count": 2, "threshold": 2,
      "window_days": 28}`). Lets dashboard cards render truthful
      runtime context (e.g., "has 2 milestones") without N+1
      queries to recompute counts at render time. Schema change +
      drought evaluator update + pattern docs for future
      evaluators (Critical Issue Open, Repeat Root Cause, etc.).
      Tracked from the Batch 004.7 sketch — same-day scope was
      threshold-only rendering off `alert_rules.config`, which is
      accurate but doesn't match the runtime count the evaluator
      saw. Decided not worth same-day for the cosmetic improvement.
- [ ] **5.13 Drought pill → BrandDetailDrawer reuse + drought
      banner** — when a drought pill is clicked from the active
      alerts panel, open the existing `BrandDetailDrawer` from
      `/dashboard/coverage` instead of navigating to the coverage
      page. Add a small banner at the top of the drawer when opened
      from an alert: "Drought alert: N milestone(s) in last 28 days
      (threshold: 2)". Drawer also gets a "View Coverage →" link to
      the full coverage page. Pairs with the chart drawer →
      LogDetailDrawer stacking shipped in Batch 004.11 — together
      they create a unified "click anything → drawer slides in"
      pattern across the dashboard.
- [ ] **5.14 Log detail page density redesign** —
      `/dashboard/logs/[id]` page currently uses a 2-column grid
      where every field gets equal real estate, including
      single-word values like "Yes". Result is sparse and hard to
      scan. Redesign with information hierarchy: header (ticket,
      status, severity, brand, owner, dates) → narrative section
      (notes, resolution notes) → secondary details (booleans, root
      cause arrays) → audit trail in a tab or accordion. Note: the
      `LogDetailDrawer` (used on Logs page + via the chart-drawer
      stacking from Batch 004.11) already handles density well;
      consider whether the standalone page is still needed, or
      whether it becomes a permalink-friendly version of the drawer.
- [ ] **5.16 Dashboard global filter pills** — add an "All time / 30 /
      60 / 90 days" pill UI to `/dashboard`, matching the existing
      pattern on `/dashboard/logs`. All four charts (and optionally
      the KPI strip) should respond to this filter as a single global
      control. Currently dashboard charts are hardcoded to all-time
      per Batch 004.12 (Rework Volume slices its display to the last
      26 weeks for legibility); this would put scope under user
      control instead. Pairs naturally with a "match what /logs is
      filtered to" affordance.
- [ ] **5.17 Chart drawer rows use grouped/expandable layout** — when
      a chart drill-down drawer opens, same-ticket logs (multiple
      rework events on one ticket) should collapse into a single
      expandable row, matching the pattern used on `/dashboard/logs`.
      Currently each rework event is its own row, which can look like
      duplicate tickets to users who don't already think in terms of
      the rework-event model. Today's flat list is fine when most
      tickets only have one log; the redesign matters more once
      tickets routinely have 3+ sendbacks.
- [ ] **5.18 Pagination on /dashboard/logs** — Batch 004.12 added
      `.range(0, 9999)` on the all-time logs query as a defensive fix
      against Supabase's 1000-row default cap. That ceiling is a soft
      10k limit. Once non-deleted log count approaches ~5000, add
      proper pagination or a virtualized list. Cheap monitoring:
      quarterly `SELECT count(*) FROM quality_logs WHERE is_deleted =
      FALSE`. Currently ~50 logs at NBLY pilot rate; revisit when
      multi-client work (Batch 004.99) starts onboarding.
- [x] **5.19 SPL multi-page presence sweep** — verify SPL appears
      correctly on every dashboard surface that displays project /
      brand context. Specifically check:
      - `/dashboard/coverage` — does the SPL brand row appear? Does
        the per-column sort + sparkline render once milestones land?
      - `/dashboard/logs` — filter pills, brand selector, project
        filter, sendback grouping behavior
      - Active alerts panel — brand-code rendering for SPL-scoped
        alerts (none exist yet, but verify the code path doesn't
        assume NBLY-prefixed `client_brand` strings)
      - `/dashboard/reports` — filter dropdowns, saved-report scoping
      - Dashboard chart drilldowns (`LogDrawer`, `LogDetailDrawer`)
        — chart row activation should respect SPL ticket prefixes
      - `/dashboard/settings/audit` — ticket-filter prefix
        recognition for `SPLCRO-` (now generic post-Batch-005.9; this
        verifies the search behavior, not the placeholder)
      Anywhere a hardcoded brand or project list might exist should
      be verified. Most surfaces auto-populate from the
      brands/projects tables and should "just work," but a sweep
      confirms nothing was missed. Pairs with audit Section 6.5
      (settings UI gaps — brand-create UI, brand-aliases admin) —
      consider fixing those at the same time to avoid multiple
      cleanup batches. See `docs/multi-client-readiness.md` §6.5
      for the full settings-UI gap list.

      **Shipped 2026-05-12.** Sweep findings:
      - PASS: /dashboard/coverage (SPL row + drawer + sparkline
        render correctly), Active alerts panel (NBLY drought
        pills render cleanly via extractBrandCode), Dashboard
        chart drilldowns (no SPL data; NBLY renders unaffected),
        /dashboard/settings/audit (ticket filter recognizes
        SPLCRO- prefix, returns matching audit rows).
      - FAIL: /dashboard/logs and /dashboard/reports brand
        dropdowns. Two findings captured for Batch 005.25:
        (F1 HIGH) dropdowns populate from DISTINCT client_brand
        in quality_logs, excluding any brand without active
        non-deleted logs — SPL invisible; (F2 MEDIUM) historical
        pre-Phase-1 quality_logs rows have raw brand codes
        (e.g., 'ASV'), post-Phase-1 rows have full Phase-1
        format (e.g., 'ASV - Aire Serv') — surface as duplicate
        dropdown entries.
      - DEFERRED: code-grep verification of extractBrandCode()
        prefix-agnosticism and chart drilldown routing
        hardcoded-NBLYCRO check — folded into Batch 005.25
        scope.

      F1 + F2 closed by Batch 005.25 (2026-05-13).
- [~] **5.21 Cron-silence monitor** — **ABSORBED into Batch 006
      (Teams dispatch, EXPANDED) on 2026-07-03.** Now framed as
      evaluator-health alerting inside the dispatcher: a broken/failing
      evaluator produces an ALERT, not suppression. Original rationale
      (the 2026-05-07 drought-evaluator 7-day silent failure — pg_cron's
      `cron.job_run_details` only logs HTTP response receipt, not function
      correctness) carries into the Batch 006 scope. See the Batch 006
      entry below.
- [x] **5.22 Phase 1: Project-aware brand resolution** — schema +
      webhook + sync refactor making brand lookup per-project. Closes
      audit Q2 + SPL ingestion gap. **Shipped 2026-05-07**; see §16.
- [x] **5.22 Phase 2: Coverage filter pills** — Coverage page gains
      a project filter (All / NBLY / SPL) so the brand table can be
      scoped to a single client at a time. Pairs with the existing
      brand search/sort affordances; no schema change.
      **Shipped 2026-05-19** as Cluster A Phase 2 (proposed batch
      number 005.26 — Lacey may renumber). New shared component
      `components/filters/project-brand-filter.tsx` with
      sessionStorage persistence per `storageKey`; Coverage mount
      keys at `cqip-filter-coverage`. KPI cards stay full-scope
      (program-health boundary, locked with Lacey); table re-scopes.
      See §16.
- [x] **5.22 Phase 3: Dashboard filter pills** — Dashboard charts
      gain the shared project + brand filter; KPIs + Active Alerts
      stay full-scope. **Shipped 2026-05-20.** See §16.
- [ ] **5.22 Phase 4: Logs filter pills** — `/dashboard/logs` brand
      dropdown becomes project-aware (group by project; default
      "All projects"). Saved-report `filters` jsonb gains a
      `project_key` slot.
- [ ] **5.22 Phase 5: Project-create + brand-create UI hardening
      for multi-client** — `/dashboard/settings/projects` form adds
      `brand_model` + `brand_jira_field_id` + `default_brand_id`
      fields (today the migration 019 default carries new projects
      through as multi-brand). `AddBrandDrawer` adds a single-brand
      affordance that auto-syncs `default_brand_id` on the parent
      project. Closes the Phase 1 deferred-affordances gap.
- [ ] **5.29 Taxonomy admin UI** — managing `quality_log_taxonomy`
      rows from the dashboard instead of via SQL editor. Add an
      admin surface (likely `/dashboard/settings/taxonomy` or a tab
      on Coverage's existing admin page) that lists current
      canonical values per field, lets admins add new options,
      toggle `is_active`, and tweak `sort_order` / `description`.
      Why: when Lacey adds a new option in Jira today, she also has
      to run a one-line SQL INSERT against the dashboard's taxonomy
      table to keep validation aligned (§13 r29). A small admin
      surface removes the SQL step and makes the workflow
      self-service. Deferred from Batch 005.28's ship so the
      taxonomy table could land first and prove itself in
      production; the admin UI is purely operational on top of it.

### Batch 005.25 — Brand dropdown fix + client_brand normalization

Closes 5.19 sweep findings F1 + F2. Small targeted batch.
Scoped 2026-05-12; not yet started.

- [x] Refactor /dashboard/logs brand dropdown to source
      from brands table (filtered by is_active = TRUE),
      not from DISTINCT client_brand in quality_logs.
- [x] Same refactor for /dashboard/reports brand dropdown.
- [x] Consider a shared <BrandSelector> component if /logs
      and /reports dropdowns warrant consolidation
      (decision at implementation — not pre-locking).
- [x] One-shot script: scripts/normalize-client-brand.ts —
      backfills historical quality_logs.client_brand strings
      to the canonical brands.jira_value format (CODE -
      Display Name). Uses brand_code lookup via brands
      table. Logs unmatched rows for manual review.
      Idempotent.
- [x] Code-grep verification: extractBrandCode() helper is
      prefix-agnostic (handles 'SPL - Spotloan' as well as
      'MRR - Mr Rooter Plumbing'). Add a regression test
      if one doesn't exist.
- [x] Code-grep verification: LogDrawer / LogDetailDrawer
      routing has zero hardcoded 'NBLYCRO' references.
      Should pass; this is a sanity check after the §13
      rule 28 work.

Realistic scope: half-day. No migration. No schema change.

Pairs with: Batch 005.22 Phase 4 (Logs filter pills),
which builds project-aware filtering on top of the now-
clean brand dropdown.

Does NOT address: future /dashboard/reports redesign
vision (pre-built templates, chart picker, component
library). That's its own future batch when scoped.

**Shipped 2026-05-13** as commit 35f0dfc.
See §16 entry below.

### auth.1 / auth.2 — Identity migration + admin password reset (scoped 2026-07-03)
Own session; Jenny pre-flight required despite small size (touches
`user_profiles` / Supabase Auth / the §13 r22 trigger-protected column
neighborhood). Build order within the session: auth.2 first
(self-contained), then auth.1. Effort S–MED. Spec: `docs/batch-auth-spec.md`
(v3, Jenny PASS-WITH-FINDINGS folded). First-priority upcoming work — the
only operational-risk item on the board (zero password-recovery path today).

**auth.2 — SHIPPED 2026-07-05 (committed, not pushed); see §16.** Admin
temp-password reset for read-only users + forced change + admin-account
immutability + full user-mutation audit trail. Migration 022, the
`/api/admin/users` guards/actions/audit, the middleware forced-change
gate + `/api/account/password-changed` flag-clear route, and the
users-page UI all landed. UI-only follow-up (`d5fae92`) made the
forced-change form a non-dismissable modal.

**auth.1 — SHIPPED 2026-07-05 (committed, not pushed); see §16.** Email
migration + email-primary login. Dual-mode login (`input.includes('@')`
→ email, else legacy `@cqip.local` synthesis kept as a TODO-marked
fallback + a static "enter your email" hint on failed sign-in; the
earlier `user_profiles` username lookup was dropped in the Karen-HIGH
Approach-C fix — dead from the unauthenticated login screen under
authenticated-only RLS), `assertTargetIsReadOnlyOrSelf`-guarded
`set_email` PATCH action (ordered two-write, retry-once, loud-fail, no
rollback; dup pre-check `.eq` not `.ilike`), the "Last active" column +
email-drift indicator (new `GET /api/admin/users` via `listUsers()`), and
a repair of the pre-existing reset flow (`@`-input →
`resetPasswordForEmail` directly). No migration — the `email` audit row
reuses `action='UPDATE'` + `field_name='email'` (same CHECK reason as
auth.2). **Rollout DONE (Lacey, 2026-07-05):** all 7 accounts migrated to
real emails (no `@cqip.local` left; drift check confirmed clean).
**Cleanup SHIPPED as Batch auth-cleanup (2026-07-06; see §16)** — the
legacy `@cqip.local` synthesis fallback is removed, login is now
email-only. **The auth chain is complete.**

### Login-activity read side (count + heatmap) — backlog (recording LIVE 2026-07-06)
`login_events` recording is **LIVE** — the table + fire-and-forget write
path shipped as Batch login-events (commit `21df742`; plumbing only, see
§16), so real history is accruing now. This backlog item is the **read
side only**: a per-user login count and GitHub-style contribution heatmap
on the admin users page, reading `login_events` (admin-SELECT RLS already
in place). Read-only, no schema change. Open decision (deferred to that
batch, per spec §8): heatmap visibility all-admins vs owner-only. Waits
until enough real history has accrued to be worth rendering.

### Brand Wellness — v1 SHIPPED 2026-07-07 (see §16); v2 deferred
**v1 shipped** as the Brand Wellness report (`components/reports/brand-wellness-report.tsx`
on `/dashboard/reports` + a Reggie-drawer CTA) — a read-only proof of a
brand's real milestone history. Karen post-flight PASS-WITH-FINDINGS; the
one MEDIUM was closed by follow-up commits 3 + 4 (≤28d `brand_jira_value`
fallback scoping so the proof view can't contradict the drought flag in the
rolling-28d window + an Output-table orphan-milestone footer). **v2 remains
deferred:**
- **Rework overlay** — milestones vs sendbacks on one axis.
- **Export/share — downloadable, styled Brand Wellness report:** brand
  multi-select (1 / 2 / 5 / all) feeding a single richly-formatted document
  (likely PDF or branded doc). Builds on existing branded-export infra
  (`downloadBrandedXlsx` / `branded-csv`). Read-only, likely no Jenny; own
  batch. Adjacent to — not the same as — the "multi-brand compare" v2 stub
  (compare = a view; this = a combined export).
- **Multi-brand compare** — a view (distinct from the combined export above).
- **Per-dot "unresolved — not counted" timeline badge** (Karen's suggestion).

(v1 TODO comments in the component mark rework overlay + export/share +
compare.) Note: Batch 005.2
(Coverage Ledger redesign) will re-home the Brand Wellness drawer CTA when
the drawer is rebuilt.

### Batch 005.2 — Coverage Ledger redesign — SHIPPED 2026-07-08 (see §16)
Merged the Batch 010 split Output + Pipeline tables into one accordion
"Coverage Ledger". Read-only render redesign; all four scope forks resolved and
the LOCKED §15 four-chip set wired (verbatim `Awaiting client input`). Deferred
follow-up (spec §6): the Reggie-drawer fold-in + Brand Wellness CTA re-home
(kept as a "Full detail →" link this batch). Optional polish (Karen L2/L3:
drought/active summary-numeral coloring + a "Paused" legend swatch) shipped in
**Batch 005.3 — SHIPPED 2026-07-08 (see §16)**. A further polish pass from
Lacey's 2026-07-09 review shipped as **Batch 005.4 — SHIPPED 2026-07-09 (see
§16)** (incl. the Karen 005.3 L1 `LedgerRow.live` prune). Next: **Batch 005.5**
(Reggie drawer polish).

### Batch 005.5 — Reggie brand-detail drawer polish — SHIPPED 2026-07-09 (see §16)
Read-only, no Jenny. On the all-user brand-detail (Reggie) drawer: a
**6/12-month range dropdown** (reuses the 005.4 `monthly12` field alongside the
existing 6mo `monthly`) · **click-a-month → filter the ticket list** to that
month · **drop the "This Month" KPI** (keep This Week / Last Week / Rolling 28D).
Spec: `docs/batch-005.5-brand-detail-drawer-spec.md`. **Dep:** 005.4 lands
`monthly12` (done — shipped with 005.4's build). Next after 005.4 (priority #1).

### Admin drawer changes (`brand-admin-drawer.tsx`) (scoped 2026-07-09)
Two items:
- **(a) QA-URL-pattern editor removal — HOLD (was GATED; AC answered
  2026-07-09).** AC confirmed there is **no Forge write path** for the
  preview/live QA-URL config: the Brands API is DC-owned and AC/Forge is
  **read-only**, and the would-be writer (Forge Phase 2d) is **unbuilt**.
  Removing the dashboard editor would therefore **strand the config** (nothing
  else can set it), so **KEEP the editor + column** — this item is on HOLD, not
  a near-term build. Revisit only if/when a Forge write path (Phase 2d) exists.
- **(b) Remove the redundant Filter-by-brand control — SHIPPED with Batch 005.5
  (2026-07-09, see §16)** as the #4 ride-along (`hideBrandFilter` prop on
  `ManageMilestonesDialog`).

### ClickUp Client Archive — proposed, discovery-first (scoped 2026-07-09)
Sequenced **behind 006**, exact slot TBD. One-time importer producing
**overview-only** records (title / client / brand / date, maybe a url-id) —
**NO** milestones or quality_logs — in an **isolated** table (no FK; must NOT
feed live coverage KPIs); admin-editable; a new "Client Archive" page for
growth / all-time context. **Discovery gate (before any ClickUp fetch):** a
Jira-first read-only key-coverage scan. **AC answered 2026-07-09 (CROSS §6):
there is NO structured Jira custom field carrying a ClickUp ID/URL** — the
ClickUp URL lives in the **Jira issue description**, so the dedup strategy is
**description-regex + fuzzy match**, not an exact custom-field key. Full brief
DRAFTED (v1, 2026-07-10): `docs/HANDOFF-clickup-archive-discovery.md` — supersedes
v0; adds the LOCKED effort/delivery metric model (design/dev/delivered = "ever
reached" Active Design / Active Dev / DCR; total effort = UNION, counted once) +
an isolation amendment (archive PAGE may read a live Jira aggregate; coverage KPIs
never read the archive). **Discovery Step A DONE (2026-07-10):** Jira-first
key-coverage scan across NBLYCRO + SPLCRO + FPOO — 1,232 ClickUp-referencing
tickets, **100% parseable ids**, 1,153 unique (exact-dedup allowlist), so the fuzzy
pile ≈ 0. But Jira only reaches back to 2025-09 (migration window), so it settled
**dedup, not sizing** — the entire pre-2025 history lives only in ClickUp. Next:
Step B (ClickUp sample-Space probe + Step B′ status-history retrievability),
token handled out-of-band, still sequenced behind 006. **FPOO** is a real but
**ARCHIVED** CRO project (no longer an active client; historical data only) —
**in scope** for all-time / Client Archive counts, **excluded** from
active-client and live-coverage views; it carried 268 of the 1,232 Step-A
tickets. Active CRO projects: NBLYCRO · SPLCRO. All CRO projects incl. archived:
NBLYCRO · SPLCRO · FPOO.
**Discovery COMPLETE (Step B + B′ DONE 2026-07-11; see the HANDOFF doc):** headline
**16,761 worked-on / 15,827 delivered** (ideation stripped; `orderindex` best-effort
floor accepted). The **importer batch is now being drafted phase-by-phase** (Phase 1
schema → Phase 2 ETL → Phase 3 page/live-read → Karen/smoke/push). **Phase 1 (schema +
migration spec) LANDED:** `docs/importer-spec-phase1-schema.md` — `client_archive` +
`parent_clients` tables, the twin-fix dedup (twins are imported WITH their true ClickUp
dates and deduped by the Step-A **1,153-id allowlist**, NOT by a date cutoff — the
migration ran rolling Sep–Nov 2025 with genuinely-new Jira work in the same window, so
there is no clean date seam), the isolation contract, and the classification rules.
The spec is **docs-only**; the importer itself is **Jenny-gated** (migration + mutation
+ new route) and still **sequenced behind 006**. Phase 2 (ETL) not yet drafted. **Twin
allowlist COMMITTED (2026-07-12):** the Step-A **1,153-id twin allowlist** is now a
committed artifact at `docs/clickup-archive/jira-twin-allowlist.json` (verified valid /
1,153 unique / 0 dupes) — Phase 2's ETL reads it directly, **no re-scan needed** (Phase 1
spec §6 open item #1 → CLEARED). Provenance is honest: this is the **original 2026-07-10
extraction RECOVERED**, not a fresh re-scan — so it matches the discovery numbers exactly
and is **not** re-derivable from *current* live Jira (which has drifted since 07-10).
**FREEZER CRAWL DONE (2026-07-12):** the full raw ClickUp source is now snapshotted before
decommission — read-only crawl, 07-11 method (`include_closed=true&subtasks=false`, no
status prefilter, no bucketing in raw), 4 CRO-archive spaces, **36,922 tasks / 337 lists /
545 calls / 0 errors**. Three artifacts (see `docs/clickup-archive/README.md`): **raw**
full task objects `docs/clickup-archive/raw/clickup-full-crawl-2026-07-12.jsonl` (~464 MB,
**GITIGNORED — descriptions + assignee PII; must be moved to durable storage, NOT
committed**); **metadata** PII-free projection `crawl-metadata-2026-07-12.json` (~16 MB,
committable — Lacey's call); **manifest** `crawl-manifest-2026-07-12.json` (~4 KB,
committable). **CANONICAL & 🔒 LOCKED HEADLINE — corrected footprint (Lacey-confirmed
2026-07-12): 14,785 worked-on / 13,858 delivered** — this is the number that goes to the
page, NOT 15,681 (wrong scope) and NOT 16,761 (transcribed, wrong scope). **LOCKED footprint
(authoritative — any future crawl must reproduce exactly; source of truth =
`scope_rules_authoritative` in `crawl-manifest-corrected-2026-07-12.json`):** ADM `ADM - CRO`
folderless list ONLY (NEW crawl, 207 tasks/64 worked-on; excl. ADM-SEO/ADM-Design) + CRO
Projects 4 client lists DWH/FPOO/LF/SPL (702/450; **excl. Conversion Fanatics + both New
Client Template lists**) + CRO Internal Projects **Client Archive folder ONLY** (31,009/12,757;
excl. 12 other folders) + Neighborly all (2,869/1,342) + Sonrava all (344/172) = **35,131
tasks / 14,785 worked-on**; `needs_review` 47 (clean); **262 client-codes / 267 list surfaces
worked-on** (264/269 all); worked-on by year 2019→2026 peaking 2022 (3,678). Page source =
`crawl-metadata-corrected-2026-07-12.json` (35,131 rows) + `crawl-manifest-corrected-2026-07-12.json`;
full-capture metadata + gitignored raw retained as freezer (ADM-CRO appended to both). Client
Archive completeness verified (248 folder lists, 3 zero-task). Final lock dropped the 2 New
Client Template lists (53 setup tasks, 0 worked-on → headline unchanged). **Why the earlier numbers were wrong = SCOPE, not classification** (Neighborly
1,342 + Sonrava 172 reproduce exactly; the prior 15,681 counted the whole CRO Internal space
incl. 12 non-CRO folders + Conversion Fanatics and missed ADM-CRO; 16,761 was transcribed off
a mutating source whose raw is gone). Archived state + pagination both ruled out as factors
(count-only probe: 450 archived total, 70 in Client Archive). Optional pre-shutdown,
owner-run: a ClickUp workspace export could add per-task **status history** (API exposes only
current status + `orderindex`; `time_in_status` 403 on this plan) — non-blocking, not
attempted.

### Later / deferred — ledger + coverage (from Lacey's 2026-07-09 review)
- **Resizable ledger columns (#6b)** — a real feature (width state + drag +
  persistence + survive-sort), not polish. Reassess after 005.4's bar-alignment
  fix (#6a) — may be moot.
- **Ledger alert-color palette (#7)** — the segment purples / gray / blue read
  too close to tell apart; Lacey researching a palette → a `globals.css` token
  swap when delivered.
- **Expanded-panel layout (#8/#9)** — Full-detail moved up + equal-height /
  bottom-aligned expanded panel. With **Claude Design**; folds into a ledger
  batch on return.
- **Add-milestone form polish** — with **Claude Design** (admin drawer).
- **Coverage "true all-time incl. pre-Jira" decision** — whether the ClickUp
  archive count bridges onto the coverage page or stays archive-only. Tied to
  ClickUp; parked.

### Dashboard polish cluster + Pipeline sortable columns + rework indicator (scoped 2026-07-03)
Standalone entry — NOT part of Batch 005.2 (different page). Three grouped
items: (1) dashboard polish — KPI hover popovers, stacked issue-category
chart, Recent Activity panel; (2) sortable Pipeline table columns on
`/dashboard/coverage`; (3) a rework indicator that distinguishes
zero-delivery weeks from genuinely quiet weeks.

### Batch 012 — Client Library (scoped 2026-07-15)
New cross-brand experimentation surface. Provisional-confirmed batch number
012 (Lacey 2026-07-15). Leads the open sequence (see priority order). Four
phases A–D; **Phase A is a shippable MVP.**

Scope:
- **Directive × brand status matrix** — the core view: experimentation
  directives crossed against per-brand status.
- **Monitoring ingest** (Phase B) — the ingest surface that **Batch 008
  (Convert.com) consumes** rather than rebuilding. This is the coupling that
  lets 008 follow 012 instead of standing up its own targeting/monitoring
  layer.
- **Jira ticketing** — create/track tickets from the library.
- **Public bug form** (Phase D) — a new public-facing submission surface.

**Absorbs the former "Per-brand config pages" batch.** That batch's scope
(per-brand URL inventory, site areas, staging/prod URLs, targeting
definitions per site area — regex patterns, exclusion lists, element checks,
audience conditions — a resolution-mode field, and the derived-examples
layer; data-model lock + migration path for existing brand URL data) folds
into Batch 012 as the per-brand config layer. It is no longer a standalone
prereq for Batch 008. *(If the 012/008 overlap resolution changes, only this
absorption note + the 008 prereq framing move.)*

**Gates:** Jenny pre-flight (migration + mutation + new route) and again for
the new public surface at Phase D; Karen post-flight. **DO NOT PUSH** — Lacey
reviews. Effort: LG (multi-phase).

**Phase status:**
- **Phase A (Directive Matrix MVP) — SHIPPED 2026-07-17** (see §16). Migration
  024 + directives/directive_brand_status + matrix page.
- **Phase B (Monitoring Ingest) — SHIPPED 2026-07-17** (see §16). Migration 025
  + `monitoring_findings` + Bearer ingest + admin status route + "Needs action"
  panel. This is the surface Batch 008 (Convert/Pulse) consumes.
- **Phase E — Pulse shell/UX track** (distinct from the C/D feature track):
  - **E1 (Pulse shell: rename + brand pages + nav) — SHIPPED 2026-07-21**
    (see §16). Renamed Client Library → Pulse, moved the route (with redirect),
    added deep-linkable per-brand pages + a contextual client nav. Render/
    routing only; no migration, no new mutation route, no Jenny. Karen
    PASS-WITH-FINDINGS (LOW-1 folded).
  - **E1 follow-on (cross-project client nav) — SHIPPED 2026-07-21** (see §16).
    Made the client list cross-project (single-brand clients collapse to one
    entry) so single-brand clients are discoverable without switching the
    picker. Render/nav only; logic in the pure `toClientNavGroups`; reuses the
    extracted `pulse:project` channel; folded Karen E1 observation-B. Karen PASS
    (3 rounds).
  - **Inline directive editing (kill both modals) — SHIPPED 2026-07-21** (see
    §16). Both matrix-page modals (create + cell edit) became inline; cell edit
    is a row-expansion strip (the E3 seam), later compacted to a single dense
    row. Render/interaction only; Karen PASS-WITH-FINDINGS (LOW folded).
  - **E2 (Convert config sync)** — fills the brand-page "Convert configuration"
    placeholder with synced Convert data. Couples to Batch 008.
  - **E3 (rich directive rows)** — swaps the read-only brand-page directive rows
    for expandable rows with comments + lifecycle dates.
- **Phase C (Jira ticketing) — after E1.** Create/track Jira tickets from a finding
  / a directive cell. **Gated on §1 Jira-create-permission verify** (confirm the
  CQIP Jira credential can POST issues; §13 r5 is read-only today, so a Jira
  WRITE path is a deliberate scope expansion needing its own decision). Jenny
  pre-flight required (new write surface). Per-finding + per-cell ticket links
  land here (the Phase B TODOs).
- **Phase D (Public bug form) — after C.** New public-facing submission surface;
  needs Turnstile (unlike the token-gated Phase B feed). Jenny pre-flight again.

**Phase B deferred follow-ons (backlog):**
- **Unresolved-finding self-heal** — a finding first ingested with
  `brand_id=null` stays under "Unassigned" permanently (Phase B re-post freezes
  identity fields — Karen LOW-2). Add a null→resolve path: re-resolve on
  re-ingest once the brand/alias exists, and/or a periodic sweep. Pairs with →
- **Manual finding-reassign affordance** — admin control to set a finding's
  `brand_id` (today the admin status route only edits status/note). Closes the
  "stuck in Unassigned" gap operationally even without the self-heal sweep.
- **Toast cleanup** — the Client Library panel/dialog toasts accreted across
  Phase A + B; a small pass to unify wording/severity.
- (Phase A LOW-1, still open) **cell-backfill / brand-target picker** — a brand
  added AFTER a directive was created has no `directive_brand_status` cell
  (renders hollow n_a, non-interactive). Backfill on brand-add or a target
  picker at directive-create.

### Batch 006 (post-demo) — Teams dispatch (EXPANDED)
Wires `alert_events` rows to actually fire Teams notifications.
Until this batch ships, alerts accumulate silently in the database.
Scope EXPANDED 2026-07-03 (`docs/batch-outline-2026-07-03.md`): absorbs
backlog 5.21 (cron-silence monitor) + adds a daily morning status digest.
Effort MED–LG (was MED); net board shrinks because 5.21 folds in.

Original scope:
- [ ] Dispatch service — **edge function (locked)**, following the
      drought-evaluator template (sits next to its callers, established
      custom-auth pattern per §13 r21, `verify_jwt=false`).
- [ ] Rate limiting
- [ ] Retry with exponential backoff
- [ ] Adaptive Card / message card formatting per rule type
- [ ] Test mode toggle in Settings → Alerts
- [ ] Mark `notification_sent = TRUE` on success
- [ ] Detect 401/403 from Teams webhook (rotation grace handling)

Expanded scope (locked 2026-07-03):
- [ ] **Single Teams channel** for all alert types (revisit per-client
      channels only if/when volume demands).
- [ ] **Forward-only dispatch:** existing silent `alert_events` rows (open
      droughts etc.) do NOT fire retroactively. Dispatch starts clean from
      ship-time.
- [ ] **Global rate cap with self-announcing overflow:** when the cap
      trips, post one "Alert limit reached (N suppressed) — check
      dashboard" message. Never silently swallow.
- [ ] **Absorbs backlog 5.21 (cron-silence monitor):** evaluator-health
      alerting. A broken/failing evaluator produces an ALERT, not
      suppression. Philosophy: don't limit real alerts — surface when the
      thing producing them is broken.
- [ ] **NEW: daily morning status digest** — cron posting current statuses
      (open droughts, active alerts; pipeline health once Batch 010.1
      lands).

### Batch 007 (post-006, hard prereq: 004.99 + SPL onboarding) — Custom Jira Boards
Internal Kanban-style board view inside CQIP mirroring active tickets
across all onboarded CRO Jira projects. Functions as a CRO-native
replacement for the standard Jira board, with quality_logs context
integrated next to each ticket. Direct team request; high priority
once multi-client foundation is in place.

**Initial scope: read-only.** §13 rule 5 (CQIP read-only against Jira)
remains intact for v1. Drag-drop / write-back is a follow-on batch
once the read-only board has lived in production for a few weeks
and team feedback informs the write model.

**Decisions locked at scope time (2026-05-06):**
- Read-only first; read-write as natural follow-on batch
- Real-time sync via webhook (extend jira-webhook to cache all
  ticket state, not just rework events)
- Multi-board UX: per-client board (NBLY, SPL, future) plus a
  "View All" combined view; same status columns + structure
  across all
- Brand-level filtering on per-client boards; global filter
  system (built-in + user-custom) on all views
- v1 columns only (status); swimlanes deferred to v2 unless
  team friction surfaces during use
- Card content: ticket ID, title, status, severity, brand,
  assignee, sendback count, age, plus any custom-field tags;
  expandable as needs emerge
- Performance: server-side filtering + per-column pagination
  (~50 tickets per column initial load, infinite scroll for
  more) + client-side virtual scrolling per @tanstack/react-virtual
- Cache layer: new `jira_tickets` table populated by webhook,
  read-side served from cache (Jira API never hit at render time)
- Permissions: same view for admins + read-only users (no
  per-action gating in v1)
- Ticket detail: click card opens unified drawer (ticket header
  + status + assignee + brand + custom tags on top, associated
  quality_logs underneath via existing LogDetailDrawer pattern;
  per §13 rule 26 drawer-on-drawer is supported)
- New page: `/dashboard/board` (or `/dashboard/boards` —
  decide at implementation), linked in main nav alongside
  Dashboard, Coverage, etc.

**Decisions banked 2026-07-03 (`docs/batch-outline-2026-07-03.md`) —
promoted from the discovery list below:**
- **Saved views: URL params + per-user saved views + default-view-on-login**
  (uses the `board_views` table already in the sketch). Flow: Jira-like
  default layout → user customizes → saves to profile → their default
  loads on board entry.
- **Filter bar: Jira-parity** (per Lacey's screenshot) — quick filters
  (Exclude Paused Brands / Roadmap / In Progress / QA / With Client /
  Needs Attention / No holds / Assigned to me / Unassigned / Recently
  Updated), brand pills (ASV…WDG), a grouping control.
- **Card density: compact default, comfortable as a user toggle.**
- **Cache freshness: "last synced" indicator + manual "sync now" CTA**
  showing success/failure (sync_runs pattern precedent from Batch 005.10).

DISCOVERY DECISIONS STILL OPEN AT IMPLEMENTATION:
- Exact route path (`/board` vs `/boards`)
- Whether "View All" collapses to a single combined column
  set or shows per-client column groups

IMPLEMENTATION SKETCH (post-discovery):
- New migration: `jira_tickets` cache table — id, jira_ticket_id
  (unique), project_key, status, summary, severity, brand_id,
  assignee, custom_field_tags (jsonb), updated_at, raw_payload
  (jsonb for forward compat)
- New migration: `board_views` table for saved per-user filter
  configs (optional v1, possible v2 punt)
- Extend `jira-webhook/index.ts` with a third branch (after
  milestone + rework branches) — upsert into jira_tickets cache
  on every ticket update, not just sendbacks
- One-time backfill script: `scripts/backfill-jira-tickets.ts`
  pulling current state of all active tickets per project
- New page: `/dashboard/board` with Kanban UI
  (likely dnd-kit for v2 read-write groundwork even though v1
  doesn't ship drag-drop)
- New components: `BoardColumn`, `TicketCard`, `BoardFilters`,
  `TicketDetailDrawer` (wraps existing LogDetailDrawer for
  the logs section)
- Filter system: extensible config-driven filter UI matching
  Jira's filter pattern (built-in filters + user-custom saved
  filters)
- Nav update: add "Boards" entry to main navigation

Realistic scope: 3-5 weeks for read-only v1 (lower than original
2-4 week estimate because decisions are locked upfront vs.
greenfield discovery during build). Read-write follow-on adds
2-4 weeks on top.

**Why high priority:** team request, replaces a daily-use external
tool with a CRO-context-aware view, reuses CQIP's existing data
model (quality_logs, brands, milestones) rather than duplicating it.

### Batch 008 — Convert.com test deployment automation
**Sequenced after Batch 012 (resequence 2026-07-15).** 008 **consumes Batch
012's Phase B monitoring-ingest surface** instead of rebuilding a
targeting/monitoring layer; the former "Per-brand config pages" prereq is
absorbed into Batch 012, so 008 no longer carries a standalone prereq batch.
*(If the 012/008 overlap resolution changes, only this note moves.)*

Big-boy integration. Director of CRO requested a tool that lets the
team pull active A/B tests for a given brand, then convert a winning
variation into a deployment with a single click — pause test,
create deployment from variation, rename per a formula, activate.
NBLY-only initially, but spec assumes brand model is CRUD-ready so
new clients can be onboarded without code changes (overlaps with
Batch 004.99 multi-client readiness work).

Discovery work the batch needs to start with:
- Convert.com API auth model — service accounts? per-user OAuth?
  API keys per project? Document the actual mechanism.
- Rate limits and the pause/deploy state machine — what's atomic?
  Can the four-step sequence happen in one API session, or is
  there polling between steps? What's the failure mode if step 3
  of 4 fails (half-deployed states are dangerous)?
- Brand → Convert project mapping — CQIP knows brands, Convert
  knows projects/accounts. Need a translation table; probably a
  new column on `brands` (e.g. `convert_project_id`).
- The naming formula (Lacey to provide) — derivable from Jira
  ticket data? from CQIP-known fields? from a manual input at
  click time?
- UI placement — extend `/dashboard/coverage`, or new
  `/dashboard/deployments` page?
- Failure / rollback semantics — destructive 4-step action needs
  confirmation dialog, audit trail (who clicked, what got renamed
  to what, did all 4 steps succeed), and idempotency.

Implementation sketch (post-discovery):
- `lib/convert/client.ts` — Convert API client
- New page or page extension for listing active tests by brand
- Single-click deploy button with confirmation dialog
- `convert_deployments` audit table (or extend existing `audit_log`
  with `target_type='convert_deployment'`) recording every
  deploy attempt + per-step success/failure
- New env var(s) for Convert API credentials + per-brand mapping

Realistic scope: 2-4 week build, not a weekend project. The
"single push" hides a multi-step orchestrator with error handling,
idempotency, and rollback semantics.

### Batch 009 — SharePoint integration — SHIPPED 2026-05-29
Read-only Microsoft Graph proxy. Three GET routes under
`/api/sharepoint/*` (`/folder`, `/xlsx`, `/image`),
`Sites.Selected` scope, 60s in-memory cache, share-id folder
resolution. See §16 for the full shipped-log entry and the
four SHIP-day deviations (D1-D4). Full spec at
`docs/batch-009-sharepoint-spec.md` (status header now
SHIPPED). Day-one consumer AC's Phase 2 is unblocked.

**Priority order (resequenced 2026-07-15, confirmed with Lacey; mirrors
CROSS_CLAUDE.md §5. Canonical — the `CQIP Batch Outline` project file mirrors
this; "CLAUDE.md wins"):**

```
NEXT (resequenced 2026-07-15 with Lacey — Batch 012 Client Library
      inserted; the polish/drawer cluster [005.4, 005.5, admin
      filter-by-brand ride-along] all SHIPPED 2026-07-09, see §16)
  1  012     Client Library — Phase C (Jira ticketing) NEXT; A + B SHIPPED
             2026-07-17 (see §16). Phase C gated on §1 Jira-create-permission
             verify (write path = §13 r5 scope expansion). Phase D (public bug
             form) after C.
  2  008     Convert.com integration   (consumes the SHIPPED 012 Phase B ingest; discovery-first)
  3  006     Teams dispatch (expanded) ← unblocks 010.1 live pings
  4  010.1   Pipeline alerts (merged 010.2 + Path 2)  — behind 006; PM consult owed
  5  007     Custom Jira Boards

  •  ClickUp Client Archive — Phase 2 ETL + Phase 3 page; behind 006
  •  Admin QA-URL editor removal — HOLD (no Forge write path; AC gate RED)
  •  Per-brand config pages — ABSORBED into Batch 012 (no longer a standalone item)
```

Rationale (Lacey 2026-07-15): Client Library leads — it's the new cross-brand
experimentation surface (directive × brand status matrix + monitoring ingest +
Jira ticketing + public bug form), Phase A is a shippable MVP. Convert (008)
follows because it consumes the Phase B monitoring-ingest surface rather than
rebuilding it; per-brand config pages (formerly the 008 prereq) are absorbed
into Batch 012, so 008 no longer needs a standalone prereq batch. Teams dispatch
(006) drops below 008 — it's externally parked on the alerts-channel build — and
010.1 stays behind 006 (dependency preserved), moving down with it. 007 follows
010.1. ClickUp Client Archive Phase 2 ETL + Phase 3 page stay behind 006.

(SHIPPED, no longer upcoming — all in §16: 5.19, Batch 005.25, Batch 011,
Batch 009, Batch 010, Batch 005.1, Batch auth.2, Batch auth.1 [+
Approach-C fix + auth-cleanup], Batch login-events, Brand Wellness,
Batch 005.2, Batch 005.3, Batch 005.4, Batch 005.5, Batch 012 Phase A,
Batch 012 Phase B, Batch 012 Phase E1, Batch 012 Pulse E1 follow-on
(cross-project client nav), Batch 012 Pulse inline directive editing.
DISSOLVED: Batch 010.2
and the standalone Path 2 off-by-one item are folded into Batch 010.1; backlog
5.21 is absorbed into Batch 006.)

**SHIP-day open questions resolved:** multi-site support
stays deferred (single Fusion92 tenant via env-config, per
spec §8/§12); 25 MB image cap retained as a proxy-side
Worker-memory guard.

### Drought predicate off-by-one check (Path 2) — DISSOLVED into Batch 010.1
Folded into Batch 010.1 (Pipeline alerts, merged) on 2026-07-03. The
`<= 2` vs `< 2` question stops being a standalone predicate fix and becomes
"define the comparison against the configured per-brand target once,
correctly." See the Batch 010.1 entry below.

### Batch 010.2 — Brand contract management — MERGED into Batch 010.1
Merged 2026-07-03. Per-brand contract targets are now part of Batch 010.1's
scope (below), not a separate batch.

### Batch 010.1 — Pipeline alerts (MERGED: 010.1 + 010.2 + Path 2)
Sequenced after Batch 006. Collapses the three formerly-separate items
(pipeline drought alerting, brand contract management, and the Path 2
off-by-one) into one coherent build.

- **Per-brand targets on the brand record** — milestone targets AND
  pipeline-stage thresholds, replacing the flat 2/28d constant. Driven by
  the fact that contracts already vary per brand (the old "gated on a real
  contract" trigger for 010.2 is moot).
- **UI home: BrandAdminDrawer tab** — resolves the deleted-settings-page
  re-home question (the old 010.2 sketch said `/settings/coverage`, deleted
  in Batch 005.1 Phase 5). This is what the drawer was built for.
- **NEW — scheduled orphan-milestone alert (from Brand Wellness follow-up,
  2026-07-07):** add a null-`brand_id` `test_milestones` check to the 5am
  cron so orphaned milestones (unresolved brand at ingest, §13 r18) are
  actively surfaced, not just visible on the Coverage Output footer (Batch
  Brand Wellness commit 4) and the pipeline `unresolved_count`. Pairs with
  the OPS backfill-cadence check (Ops/deferred) — an alert makes a lagging
  backfill loud instead of silent.
- **Both evaluators (milestone-drought + pipeline-drought) read per-brand
  config.** Batch 005.1's aggregators were deliberately written so the
  flat→per-brand swap is a one-line change inside the per-brand loop.
- **Path 2 off-by-one settled INSIDE this build:** the `<= 2` vs `< 2`
  question becomes "define the comparison against the configured target
  once, correctly." Standalone Path 2 item KILLED; standalone 010.2
  DISSOLVED.
- **`contract_status` ≠ `is_paused` (locked):** separate fields.
  `is_paused` = operational state (mid-contract hold) → drives
  alert-skipping (r20 precedent). `contract_status` = commercial state →
  informational + future billing hooks. A brand can be contracted-but-
  paused; collapsing the two loses that.
- **Default thresholds:** placeholder until PM consult on per-contract
  numbers (Lacey action); configurable per brand from day one.
- **Storage decision (open):** new table vs `alert_rules.config` reuse —
  consult the Batch 005.2 redesign outcome before deciding.
- Daily 5am Central cron → `alert_events`, audit per §13 r20
  (`changed_by = 'system:pipeline-drought-evaluator'`).
- Ships with Teams pings live (Batch 006 lands first in sequence).
- Effort: MED. PM consult on contract verbiage / monthly-vs-28d window
  semantics still owed (Lacey).

### Ops / deferred
- [ ] **Confirm `test_milestones` backfill (§13 r18) runs on a cadence**
      (from Brand Wellness follow-up, 2026-07-07). Null-`brand_id`
      milestones persist until `scripts/backfill-milestones.ts` /
      `backfill-brands.ts` re-runs. Compound risk if it lags: orphaned
      milestones accumulate → undercount coverage, and (pre-commit-3) the
      Brand Wellness proof view could have contradicted the drought flag.
      Commit 3 removed the contradiction inside 28d and commit 4 surfaces
      the count on the Coverage Output footer, but a lagging backfill is
      still a real data-quality gap — verify (and ideally automate) the
      cadence, and pair with the 010.1 scheduled orphan alert.
- [ ] **Radara Edge Function deploy** — code committed at
      `supabase/functions/radara-sweep/index.ts` but not deployed.
- [x] **Deploy smoke check via `/api/health`** — **shipped Batch 011
      (2026-05-27).** `app/api/health/route.ts` added (public,
      dependency-free, always-200 JSON probe); `deploy.yml` smoke
      check swapped from `/login` to `/api/health` and now asserts
      both 200 AND `{"status":"ok"}` in the body. v1 scope is
      deliberately "app responds, env loaded" — NO Supabase
      reachability ping (the original sketch above mentioned one;
      explicitly out of scope per the Batch 011 spec to keep the
      probe fast and dependency-free). See §16.

### Randy items (Cloudflare org-level — when he's back)
- [ ] Cloudflare Workers Paid billing transfer (currently Lacey
      personal card)
- [ ] Worker ownership transfer to F92 Cloudflare org
- [ ] Demo date confirmation (Sammy's slot, otherwise next week)
- [ ] CQIP success metrics check-in
- [ ] Guest account setup for demo

---

## 15.5. In-Flight Batches

Batches actively being built but not yet shipped. Each entry holds the
locked decisions (so they're not relitigated mid-build), current
phase/status, open questions, and a pointer to the spec. Lifecycle:
§15 backlog → §15.5 in-flight → §16 shipped. Per §13 rule 34, a batch
appears in exactly one of §15.5 / §16 — on ship, the entry here is
deleted in the same commit that writes the §16 shipped entry.

---

## 16. Shipped Features Log

### Batch 012 — Pulse: inline directive editing (kill both modals) — 2026-07-21

Killed both matrix-page modals — the "+ New directive" create dialog and the
click-a-dot cell editor — in favor of inline UI. **Render/interaction only — NO
migration, NO new mutation route, NO new page route, NO schema change** (reuses
`POST /api/admin/directives` + `PATCH /api/admin/directives/status`); no Jenny;
no version bump. Spec: `docs/batch-012-pulse-inline-edit-spec.md`. Commits:
`96a6e0a` (spec) + `705bd37` (code) + `d7a44a1` (compact-editor follow-on).
**Karen PASS-WITH-FINDINGS** (LOW folded — see below). **PUSHED + auto-deployed
2026-07-21.**

**What shipped:**
- **Inline create** (`InlineCreateForm`): the header "+ New directive" button
  toggles (`aria-expanded`, label → "Close"); the form renders as a pinned strip
  at the top of the matrix Card, above the horizontal-scroll region (never
  scrolls out of view; no overlay). Mounted fresh on open → `useState`
  initializers seed the fields (no seeding effect). `POST /api/admin/directives`
  unchanged; fanOut/audit/cell-count toasts kept; Esc collapses. The matrix Card
  renders when `createOpen` even at zero directives (standalone empty Card only
  when `directives.length === 0 && !createOpen`).
- **Inline cell edit** (`CellEditStrip`) — ROW EXPANSION: `editCell` →
  `expandedCell {directiveId, brandId}` (one open at a time). Clicking a dot
  toggles (same → collapse; another → move); n_a hollow dots with no cell stay
  non-interactive. Editor is a full-width second `<tr colSpan={brands.length+2}>`
  under the directive row, with a `sticky left-0` inner container so it stays
  visible when a ≥16-brand row is scrolled right. Keyed by `cell.id` → fresh
  mount per cell (`useState` seeds, no effect). Save = **optimistic +
  reconcile-on-error** mirroring `handleFindingStatus` (local `setCells` →
  dot + Outstanding recompute + collapse, then
  `PATCH /api/admin/directives/status` unchanged; on failure `loadProject`
  reverts). Updated/No-changes/audit toasts kept. a11y: dot `aria-expanded`;
  focus into the strip on open (ref focus, not setState); Esc collapses; strip
  `aria-label`. **This is the E3 seam** (E3 enriches this container with
  comments / timeline / lifecycle dates).
- **Compact-editor follow-on (`d7a44a1`)**, per Lacey's live request: the cell
  editor collapsed from a stacked block (header + labeled fields + 2-row
  textarea) to a single dense row — brand context inline, then status + note +
  Save/Cancel on one line (wraps only when narrow). Visible labels dropped for
  height (controls carry `aria-label` + placeholder); the note is now a
  single-line `Input` (was a 2-row `Textarea`) — both inputs preserved, just
  shorter. `Textarea` import removed; expansion-cell wrapper `p-4`→`p-2`.
- **Removed** `CreateDirectiveDialog`, `EditCellDialog`, and the `Dialog*`
  imports.

**Preserved semantics:** n_a-no-cell non-interactive · Outstanding recompute
(now also on the optimistic update) · paused brand columns · sticky left
directive column · horizontal scroll for ≥16 brands · admin-only affordances,
server-enforced.

**Karen post-flight — PASS-WITH-FINDINGS** (re-verified done-definition, zero
set-state-in-effect, optimistic+reconcile correctness, preserved semantics, the
toggle/expansion state machine, zero-directive paths). One LOW, **FOLDED**: the
external `pulse:project` listener re-scoped the matrix without resetting
`expandedCell` (unlike `handleProjectChange`) — fully guarded (a foreign-project
cell renders no editor row) so cosmetic, not a defect; added
`setExpandedCell(null)` for symmetry. Flagged for Lacey's click-through (spec §4
is the real bar): sticky-left editor visibility on horizontal scroll; Esc vs an
open Radix Select; the optimistic collapse-on-failure UX.

**Tests:** no new pure function (UI + fetch) → suite unchanged, 17/17. **No AC
contract surface** (DC-internal) → no CROSS_CLAUDE.md entry.

### Batch 012 — Pulse E1 follow-on: cross-project client nav — 2026-07-21

Made the Pulse side-nav client list **cross-project**: E1 shipped a
project-scoped nav (only the picked project's brands, defaulting to NBLYCRO), so
single-brand clients (SPL, and future Sonrava/ADM) were undiscoverable without
switching the picker. **Render/nav only — NO migration, NO new mutation route,
NO new page route, NO schema change**; no Jenny; no version bump. Spec:
`docs/batch-012-pulse-clientnav-spec.md`. Commits: `89c5e54` (spec) + `0da2a57`
(code, amended twice to fold Karen's two rounds). **Karen PASS across three
rounds** (findings all folded). **PUSHED + auto-deployed 2026-07-21.**

**What shipped:**
- **New pure `toClientNavGroups(projects, brands)`** in
  `lib/client-library/pulse.ts`: `single_brand` projects (keyed on
  `projects.brand_model`, migration 019) collapse to ONE entry under the client
  display name (links to its brand page); `multi_brand` projects render a group
  header (client name → matrix, scoped) + brands. Groups alpha by project
  display name, brands alpha, paused kept + flagged, inactive projects/brands +
  zero-active-brand projects excluded; each node carries `projectKey` +
  `brandCode`. The E1 flat helper `toClientNavItems` (+ 2 now-unused types) was
  REMOVED (superseded; behavior preserved by the group tests).
- **Shared channel** `lib/client-library/pulse-project-channel.ts` — the
  `pulse:project` sessionStorage key + CustomEvent + `broadcastPulseProject`
  (+ `writeStoredPulseProject` persist-only + `readStoredPulseProject`)
  extracted from the page-local E1 copy so the page, nav, and brand page share
  ONE definition.
- **`pulse-client-nav.tsx`** reworked to render the groups cross-project (dropped
  the single-project fetch + pickerProject mirror/listener); multi-brand header
  `onClick` broadcasts the project before navigating to the matrix; paused
  greyed-but-linked; active = `pathname === href`; renders only under
  `/dashboard/pulse`; setState-after-await + `cancelled` guard.
- **Brand-page ride-along** (Karen E1 observation B): a side-effect
  `useEffect(() => broadcastPulseProject(projectKey), [projectKey])` so "← Pulse"
  opens the matrix on the deep-linked client.

**Karen post-flight — PASS across three rounds, all folded:** R1 MEDIUM+LOW (no
live consumer for the `pulse:project` event after the nav's listener was
removed) → fixed by a live listener on the matrix page. R2 MEDIUM (the R1 fix
made the page's own broadcasts self-trigger the listener with a stale closure →
redundant double `loadProject`) → fixed by splitting the channel
(`writeStoredPulseProject` persist-only for the page's own producers;
`broadcastPulseProject` reserved for external producers). R3 → PASS. **No AC
contract surface** (DC-internal) → no CROSS_CLAUDE.md entry.

### Batch 012 — Phase E1 — Pulse shell (rename + brand pages + nav) — 2026-07-21

Renamed the user-facing "Client Library" area to **Pulse**, moved the route,
and added deep-linkable per-brand pages + a contextual client nav. **Render/
routing only — NO migration, NO new mutation route, NO schema change; no Jenny
gate; no version bump (stays v2.5).** Spec:
`docs/batch-012-phase-e1-pulse-shell-spec.md`. Two commits: **`cfe374f`** (docs:
spec) + **`d315c50`** (code, amended to fold Karen LOW-1). **PUSHED + auto-deployed
2026-07-21** (Lacey pushed — the app-code push triggers `.github/workflows/deploy.yml`;
Lacey's post-deploy smoke [nav clients under Pulse, active + paused brand pages,
empty states, old-URL redirect] is the final bar). **Karen post-flight
PASS-WITH-FINDINGS.**

**What shipped:**
- **Rename** "Client Library" → "Pulse" on the two user-facing surfaces: the nav
  label (`components/layout/nav.tsx`) and the main-page eyebrow
  (`app/dashboard/pulse/page.tsx`; the view keeps its "Directive Matrix"
  sub-title). Deliberately NOT renamed: the API routes
  (`/api/admin/directives`, `/api/monitoring/*` — concern-named) and the
  internal `lib/client-library/*` module path (not user-facing; renaming would
  churn 6 import sites). The API-route audit `notes: '… via Client Library'`
  are kept per spec §1 (Observation A below).
- **Route move + redirect:** `git mv app/dashboard/client-library →
  app/dashboard/pulse` (history preserved). `next.config.ts` `redirects()` sends
  `/dashboard/client-library` **and** `/dashboard/client-library/:path*` →
  `/dashboard/pulse(/:path*)` (307). Nav href updated; repo grep for the old
  path is clean.
- **Main Pulse page** = the existing directive matrix + Phase B "Needs action"
  panel, unchanged in content. It now broadcasts its selected project
  (sessionStorage key `pulse:project` + a `pulse:project` CustomEvent) and seeds
  its initial pick from that stored value, so the contextual nav mirrors the
  picker without `useSearchParams` (the shared nav can't use search params under
  the statically-prerendered `/dashboard/pulse`, which builds as `○`).
- **Brand page** `app/dashboard/pulse/[projectKey]/[brandCode]/page.tsx`
  (dynamic `ƒ`; URL mirrors `/api/brands/[projectKey]/[brandCode]`, project-safe
  since brand_code isn't unique across projects). Read-only: header
  (name/code/project/paused badge), this-brand directives (status + note per
  active directive, filtered from the same directive dataset the matrix loads
  via the pure `brandDirectiveView` — one source, RLS allows authenticated
  SELECT so no new read endpoint), and a framed "Convert configuration will
  sync here" placeholder (E2 seam). Clean empty states; `use(params)` unwrap;
  `cancelled`-guarded fetch + a `loadedFor`/`ready` staleness gate (LOW-1).
- **Contextual client nav** `components/layout/pulse-client-nav.tsx`: renders
  ONLY under `/dashboard/pulse`. Current-project `is_active` brands — paused
  greyed-but-linked, inactive excluded, alpha by display name (pure
  `toClientNavItems`). Project source: URL `projectKey` on a brand page; else
  the mirrored picker; else `NBLYCRO`.
- **Pure logic** `lib/client-library/pulse.ts` (`toClientNavItems`,
  `brandDirectiveView`, `cellsForBrand`) + `tests/pulse-shell.test.ts` (4 cases).

**Karen post-flight — PASS-WITH-FINDINGS** (independently re-verified the §0
done-definition, no-dead-links repo-wide, rename scope discipline, the read-only
guarantee, the picker→nav sync [no hydration risk], `brandDirectiveView`
double-scoping, and the tests):
- **LOW-1 — FOLDED (into `d315c50`).** Brand→brand navigation reused the route
  segment (no remount), flashing the prior brand's content until the new fetch
  resolved. Fixed with a render-time staleness gate — a `loadedFor` state set in
  every terminal branch of `load()` (all after an await → no synchronous
  setState-in-effect) + `ready = !loading && loadedFor === currentKey`; a crisp
  `Loading…` shows until the current brand's fetch lands. Correctness was
  already safe (the `cancelled` guard).
- **Observation A (as-scoped):** the three API routes still write audit
  `notes: '… via Client Library'` (admin-audit-viewer visible). Kept per spec §1
  + Phase A/B row consistency; revisit only if provenance should read "Pulse".
- **Observation B (informational):** deep-linking a brand then "← Pulse" lands
  on the sessionStorage matrix pick, not the deep-linked brand's project (the
  brand page never writes its project into the picker). A note for E2/E3 if
  brand-page context should become sticky.

**Out of scope (later phases — placeholders/TODOs only):** Convert config sync
(E2), rich/expandable directive rows with comments + lifecycle dates (E3), Jira
ticketing (C), public bug form (D).

**Verification:** `tsc --noEmit` clean; `npm run build` green
(`/dashboard/pulse` prerenders `○`, brand page `ƒ`, old route gone, redirect
registered); tests 15/15 (pulse-shell 4 + directives 4 + monitoring 7); ESLint
on all new/changed files → zero findings (the 2 `set-state-in-effect` in
`nav.tsx` are the untouched mobile-drawer-close + theme-flip egg cleanup
effects, pre-existing on HEAD). **No AC contract surface** (DC-internal) → no
CROSS_CLAUDE.md entry.

### Batch 012 — Client Library, Phase B — Monitoring Ingest — 2026-07-17

The monitoring-ingest surface Batch 008 (Convert / "Pulse") consumes rather
than rebuilding a targeting/monitoring layer. Source-agnostic: a monitoring
tool POSTs findings to a Bearer-authed route (`source='convert'|'manual'`), they
dedupe + resolve to a brand, and surface on the Client Library page as a "Needs
action" panel where admins dismiss/action them. C/D remain OUT OF SCOPE (TODOs
in-code only): Jira ticketing from a finding, the public bug form, per-finding
ticket links. Spec: `docs/batch-012-client-library-phase-b-spec.md` (Jenny
pre-flighted). Two commits: **`d046820`** (docs: spec) + **`7c9fec3`** (code,
amended to fold Karen LOW-1). Builds ON Phase A. **Karen post-flight
PASS-WITH-FINDINGS** (LOW-1 folded, LOW-2 as-scoped — below).

**PUSHED + auto-deployed 2026-07-17.** The push was accidental (not
Claudette-driven), but production is live and Lacey ran the spec §5 live smoke —
all invariants verified against prod, including dismissed-stays-dismissed on
re-post. `CQIP_CONVERT_MONITORING_TOKEN` set on the Worker; migration 025
applied.

**What shipped:**
- **Migration 025 — `025_monitoring_findings.sql`:** new `monitoring_findings`
  table (idempotent; RLS mirrors 009 — authenticated SELECT, admin `FOR ALL`
  via `public.is_admin()`). Partial unique index on `(source, external_ref)
  WHERE external_ref IS NOT NULL` (the dedupe key; NULL-ref findings never
  collide). `brand_id` FK `ON DELETE SET NULL`; indexes on `brand_id`,
  `status='new'`, `detected_at DESC`. Extends `audit_log_target_shape_chk`
  (DROP + re-ADD) to admit `'monitoring_finding'`, reproducing migration 024's
  FULL allowed set (`quality_log`/`test_milestone`/`brand`/`alert_event`/`user`/
  `directive`/`directive_brand_status`) + the new value — nothing dropped.
  `audit_log.action` unchanged (`UPDATE` + descriptive `field_name`).
- **Ingest route — `POST /api/monitoring/findings`** (external, Bearer):
  validates `Authorization: Bearer` vs **`CQIP_CONVERT_MONITORING_TOKEN`** (new
  `lib/api/monitoring-bearer-auth.ts`, separate blast radius per §13 r27,
  mirrors the brands/sharepoint helpers; token never logged/echoed, 500 on
  not_configured vs 401 otherwise). `supabaseAdmin` write; body is a single
  finding object OR an array (`MAX_BATCH=500`, all-or-nothing validation). The
  inbound brand field is **`brand`** = a brand code OR a jira value, resolved
  server-side (`brand_code` primary, `jira_value` fallback; unresolved →
  `brand_id=NULL`, still ingested, returned in `unresolved_brands[]`). Upsert on
  `(source, external_ref)`: new → insert `status='new'`; existing → update
  `summary`/`detail`/`severity`/`detected_at`/`updated_at` but LEAVE `status`
  untouched (never resurrect an actioned/dismissed finding). No per-ingest
  audit. Returns `{ ok, ingested, updated, unresolved_brands }`.
  `/api/monitoring/*` carved out of the middleware matcher (like `/api/brands`)
  so it never reads the session cookie.
- **Admin route — `PATCH /api/admin/monitoring/findings/status`:** session +
  admin gate (NOT carved out of middleware), `supabaseAdmin` write,
  `getChangedBy()` server-side (client `changed_by` ignored with a warn), one
  `audit_log` row per changed field (`target_type='monitoring_finding'`,
  `action='UPDATE'`); mirrors the Phase A directives/status route.
- **"Needs action" panel** on `/dashboard/client-library` (below the directive
  matrix): folded into the page's single per-project data load (`status='new'`
  findings + embedded `brand`). View-for-all; admin-only Dismiss/Action
  (optimistic — a finding leaving `new` drops out of the panel; route enforces
  admin server-side regardless). Cards: severity dot + `<brand> — <summary>` +
  `<source> · <test> · <issue> · <ago>`, sorted by severity then `detected_at`
  desc. Project-scoped via `brand.project_key`; null-brand findings under an
  "Unassigned" group; panel hidden when no open findings.
- **Pure logic in `lib/client-library/monitoring.ts`** (mirrors the
  `directives.ts` + test split): enums + guards, `resolveBrandId`,
  `parseFinding`, `buildInsertRow`/`buildUpdatePatch` (no-status invariant),
  `dedupeKey`, `compareForPanel`/`countNew`. + `tests/monitoring-findings.test.ts`.
- New env var `CQIP_CONVERT_MONITORING_TOKEN` documented in §4 + `.env.example`.

**Karen post-flight — PASS-WITH-FINDINGS** (independently re-verified isolation,
the audit-CHECK non-regression vs 024, dedupe + no-status-resurrection,
same-ref-different-source non-collision, Bearer/middleware split + token
non-leak, panel scoping/Unassigned/admin-gate, §13 r19, and every §0
done-definition claim):
- **LOW-1 — FOLDED (ingest hardening).** An intra-batch duplicate
  `(source, external_ref)` used to route both rows to the bulk insert → partial
  unique index violation → opaque 500 for a malformed batch. The route now
  collapses intra-batch dupes by dedupe key (keyed pending-insert Map + per-id
  update Map, last-write-wins); null-`external_ref` findings still each insert.
  No spec change; pure robustness. Folded into `7c9fec3`.
- **LOW-2 — as-scoped (informational).** On re-post,
  `brand_id`/`issue_type`/`convert_test_id` are frozen at first ingest (spec §2
  update list + Phase-A no-backfill precedent). Consequence: a finding first
  ingested while its brand was unresolved (`brand_id=null`) stays under
  "Unassigned" permanently — a re-post won't re-resolve it and the admin route
  only edits status/note, so there's no re-attribution path in Phase B.
  `unresolved_brands[]` is the operator's signal to add the brand/alias BEFORE
  first ingest. Self-heal + a manual reassign affordance deferred to §15
  backlog.

**Verification:** `tsc --noEmit` clean; `npm run build` green (both routes
register as `ƒ` dynamic, `/dashboard/client-library` prerenders);
`tests/monitoring-findings.test.ts` 7/7 (+ Phase A `directives` 4/4 = 11/11);
ESLint on all changed/new files → zero findings. No version bump — Phase B adds
new route/table surfaces but rode in during the same 012 arc; version stays
v2.5.

**No AC contract surface** (DC-internal dashboard route + a token-gated machine
feed) → no CROSS_CLAUDE.md §3 change; a §6 event-log entry records the ship for
AC's awareness (008/Pulse consumes this surface). **008 coupling:** this is the
surface Convert/Pulse (008) consumes — it POSTs here with `source='convert'`
rather than building a second ingest path.

### Batch 012 — Client Library, Phase A (Directive Matrix MVP) — 2026-07-17

The first Client Library batch (the area was renamed **Pulse** in Phase E1 —
this shipped on `/dashboard/client-library`, since redirected to
`/dashboard/pulse`). A read-for-all / admin-writable directive × brand status
matrix. Spec: `docs/batch-012-client-library-phase-a-spec.md` (Jenny
pre-flighted). Commits: `6f1dafb` (spec) + `001a70a` (code) + `a6a5975` (Karen
LOW-1 fix). **Karen PASS.** Migration 024 applied; **deployed 2026-07-17.** (This
§16 entry is a late §15.5→§16 reconcile — the batch shipped 2026-07-17 but its
in-flight entry lingered in §15.5 until 2026-07-21.)

**What shipped:**
- **Two new tables** — `directives` + `directive_brand_status` (migration 024).
  ISOLATION: never reads/writes the live coverage tables; no coverage KPI reads
  from them. RLS mirrors migration 009 (authenticated SELECT, admin `FOR ALL`
  via `public.is_admin()`). Migration 024 also extends
  `audit_log_target_shape_chk` to admit `target_type='directive'` /
  `'directive_brand_status'` (same DROP + re-ADD pattern as 015/022; the audit
  INSERTs would otherwise throw a CHECK violation). `audit_log.action` unchanged
  — routes reuse `CREATE`/`UPDATE` with a descriptive `field_name`.
- **Fan-out rule:** on directive create, one cell per ACTIVE brand in the
  project — non-paused → `todo`, paused → `n_a` (paused don't inflate the
  outstanding count; no unpause-backfill — flip a cell manually).
- **Outstanding count** = cells in {`todo`,`in_progress`,`blocked`}; `done` +
  `n_a` don't owe. Single source of truth in `lib/client-library/directives.ts`
  (imported by both routes + the page + `tests/directives.test.ts`).
- **Two admin mutation routes**, mirroring `app/api/admin/brands/qa-config`
  (session→admin gate, `supabaseAdmin` write, `getChangedBy()` server-side,
  client `changed_by` ignored with a warn, one `audit_log` row per changed
  field): `POST /api/admin/directives` (create + fan-out; fan-out audited as ONE
  summary row) and `PATCH /api/admin/directives/status` (set one cell; 404 if
  absent; no-op → `changed:0`).
- **Page** (`/dashboard/client-library`, later `/dashboard/pulse`) + nav entry
  under Reports. Viewable by any authenticated user (NOT middleware-admin-gated);
  edit affordances render only for admins, routes enforce admin server-side.
  Single client-side fetch of `{ projects, brands, directives, cells }` per
  selected project (default NBLYCRO). Matrix: directives as rows, active brands
  as columns (horizontal scroll for ≥16), status dot per cell, Outstanding pill
  per row.
- **`globals.css` token pass:** added the scale layer the reskin assumed —
  `--radius-{sm,md,lg,xl,2xl,3xl,full}`, `--shadow-sm`, `--tracking-eyebrow`,
  `--tracking-wide`, `--f92-on-orange`, `--f92-orange-hover` (+ dark overrides).
  Cell colors reference tokens (§13 r25): `done` → `--status-resolved`,
  `blocked` → `--status-blocked` (RED, load-bearing).

**Karen post-flight — PASS.** One LOW cosmetic finding fixed in a render-only
follow-on (`a6a5975`): a brand added AFTER a directive was created has no cell
and was rendering as a solid `todo` dot (falsely reading "owes this directive");
a missing cell now renders the hollow `n_a` style, non-interactive and out of
the Outstanding count. **Tests:** `tests/directives.test.ts`. **No AC contract
surface** (DC-internal) → no CROSS_CLAUDE.md entry.

### Batch 005.5 — Reggie brand-detail drawer polish — 2026-07-09

Read-only render/interaction polish on the all-user **Reggie** brand-detail
drawer (`brand-detail-drawer.tsx` — opened by clicking a brand *name*) + one
admin ride-along, from Lacey's 2026-07-09 review. **No migration, no route, no
new mutation surface, no Jenny.** Spec:
`docs/batch-005.5-brand-detail-drawer-spec.md`. **PUSHED + auto-deployed
2026-07-09** (Karen PASS; Lacey smoke-tested both themes). **Two commits:**
`9e3a458` (spec + §15.5, docs-only) → `deda4c1` (build). Files:
`brand-detail-drawer.tsx`, `manage-milestones-dialog.tsx`, `brand-admin-drawer.tsx`.

- **#1** Replaced the static "Last 6 months" label with a native range
  `<select>` — "Last 6 Months" (default) / "Last 12 Months". 6 reads
  `row.monthly`, 12 reuses the 005.4 `row.monthly12` field (not re-aggregated);
  local state, bars + axis re-render.
- **#2** Month bars are clickable (recharts `<Cell>` per month + `<Bar onClick>`):
  a click scopes the ticket list below to that month's non-deleted milestones
  for the brand (client-side over the `milestones` already held — no new fetch);
  header → "Tests in {Month YYYY} (N)"; selected bar reads selected
  (`var(--f92-orange)` fill + `var(--f92-navy)` outline, others dim to 0.3);
  reset via re-click the active bar or a "← last 28 days" control; empty month →
  "No tests in {Month YYYY}." Month selection resets on brand/open change via a
  render-time reset (prevKey pattern, no effect → no `set-state-in-effect`).
- **#3** Dropped the THIS MONTH KPI card; grid `grid-cols-2` → `grid-cols-3`
  (This Week / Last Week / Rolling 28d), no orphaned cell.
- **#4 (ride-along)** `ManageMilestonesDialog` gained a `hideBrandFilter?: boolean`
  prop (default false — any un-scoped caller keeps the filter); `BrandAdminDrawer`
  passes it so the redundant "Filter by brand" control is hidden on the
  brand-scoped Milestones tab (the list stays pinned to `initialBrandId`). **The
  QA-URL-pattern editor + column are untouched** (on HOLD — AC gate RED; the
  dashboard editor is the only writer for that config).

**Token discipline:** new bar colors use `var(--f92-orange)` / `var(--f92-navy)`;
the commit actually *removed* a pre-existing inline `#F47920` bar fill (tokenized
it). The only remaining hex is the pre-existing recharts axis `stroke="#6B7280"`
(verbatim, matches sibling charts). **Verification:** `tsc --noEmit` clean;
`npm run build` green (`/dashboard/coverage` prerenders);
`tests/coverage-kpis.test.ts` 5/5; ESLint on the 3 changed files → zero findings.
**No version bump** (render/interaction only; stays v2.5).

**Advisor credit:** Karen (post-flight PASS). **Deferred / out of scope:** the
QA-URL editor removal (HOLD); the add-milestone form (Claude Design); the
Reggie→accordion fold-in + Brand Wellness CTA re-home (deferred 005.2 item, own
batch); Brand Wellness v2. All tracked in §15.

### Batch 005.4 — Coverage Ledger polish, pass 2 — 2026-07-09

Second UX-polish pass on the Coverage Ledger, from Lacey's 2026-07-09 live review
of 005.3. Read-only render/copy + one data-source swap. **No migration, no route,
no new mutation surface, no new token, no new dep, no Jenny.** Spec:
`docs/batch-005.4-ledger-polish-2-spec.md`. **Built/committed 2026-07-08;
PUSHED + auto-deployed 2026-07-09** (Karen PASS; Lacey smoke-tested both themes +
pushed). **Two commits:** `ea5f8a5` (spec + §15.5, docs-only) → `b4acb4e` (build).
Files: `components/coverage/coverage-ledger.tsx`, `lib/coverage/queries.ts`.

- **#1** Reverted the This-Wk (`testsCurrentWeek`) summary numeral to the
  pre-005.3 `=== 0 ? --f92-lgray : --f92-dark`; LEFT Delivered-28d
  (`testsRolling28`) on the 005.3 §2.7 status coloring (paused/drought/active).
  Partial revert of §2.7.
- **#2** Repointed `DeliverySparkline` from `row.daily7` (7-day, ~always flat at
  current volume) to a NEW 12-month `monthly12` field
  (`monthlyCounts(…, 12, now)`) for the growth read. `monthly` (6mo, Reggie
  drawer) UNTOUCHED; `daily7`/`dailyCounts` KEPT (parked for a future daily
  surface, documented — not dead code). Building `monthly12` as its own field
  also serves the coming 005.5 drawer 6/12 toggle. `DeliverySparkline` needed no
  change (n-agnostic).
- **#3** The linked stage-name `<button>` and non-linked `<span>` now share a
  `STAGE_NAME_TYPE` const (`appearance-none … leading-none`) so their computed
  typography is identical — only color, the "→", and hover/focus underline
  differ (killed a UA button-style leak).
- **#4** Deleted the "Bold = ready (no tags) · remainder held by status tags"
  caption in the Pipeline-by-Stage header.
- **#5** Renamed the pipeline summary column header "Pipeline · ready / WIP" →
  "Ready / Gated"; changed the WIP caption "{n} ready · {n} held by tags" →
  "{n} ready · {n} gated" (uniform ready/gated vocabulary, matching the drawer
  "gated in {stage}" copy).
- **#6a** Gave the "N / M" ready/total label a `min-w-[3.25rem] shrink-0
  text-right tabular-nums` box so every row's pipeline bar starts at the same x.
- **L1 (closes the Karen 005.3 deferral)** Removed the dead `LedgerRow.live`
  field + its `buildLedgerRow` assignment + the stale "live / pipeline" comment
  (grep-confirmed the only two refs; §2.2's Live presence card reads the live
  stage via `stages[…]`/`LIVE_STAGE`, unaffected).

**Verification:** `tsc --noEmit` clean; `npm run build` green
(`/dashboard/coverage` prerenders); `tests/coverage-kpis.test.ts` 5/5 (KPI calc
untouched); ESLint on the changed files → zero findings. **No version bump**
(render/copy only; stays v2.5).

**Advisor credit:** Karen (post-flight PASS). **Out of scope (spec §4, deferred):**
#8/#9 (Full-detail placement + equal-height panel → Claude Design), #6b (resizable
columns), #7 (alert palette); plus the still-deferred Reggie fold-in + Brand
Wellness CTA re-home (spec §6). All tracked in §15.

### Batch 005.3 — Coverage Ledger polish — 2026-07-08

Read-only render/UX polish on the 005.2 Coverage Ledger (`324677a`), surfaced in
005.2 smoke + folding in Karen's 005.2 L2/L3. **No migration, no route, no new
mutation surface, no new token, no new dep, no Jenny.** Reuses the 005.2 ledger
components + `--ledger-*` tokens. Spec: `docs/batch-005.3-ledger-polish-spec.md`.
Built + committed 2026-07-08; **PUSHED + auto-deployed 2026-07-09** (Karen PASS on
the §2/§3 build, PASS on the card merge; Lacey smoke-tested both themes + pushed).

**Three commits:** `619a259` (spec + §15.5, docs-only) → `97513b9` (§2/§3 build)
→ `f41f4b0` (card merge). Files: `components/coverage/coverage-ledger.tsx`,
`app/dashboard/coverage/page.tsx`, `components/coverage/pipeline-stage-drawer.tsx`,
`components/filters/project-brand-filter.tsx`.

- **§2.1 Removed the top-level "Live · ready/total" summary column** (5 → 4:
  Brand · Delivered 28d · This Wk · Pipeline). Dropped `'live'` from
  `LedgerSortKey` / `SORT_COLUMNS` / the `GRID` 96px track + the page sort
  `case 'live'`; freed width → the pipeline bar (`minmax` floor 280→320,
  1.5→1.7fr). **SUPERSEDES the 005.2 §3.4 five-sortable-column contract → the
  sort contract is now FOUR columns.** Why (Lacey's workflow rule): a live test
  never carries a hold tag — it becomes a quality log and leaves Live — so on
  Live `held` is structurally 0 and the ratio is always N/N (no information).
- **§2.2 Live stage card shows presence** ("N live", no `/N`) when clean
  (`stage === PIPELINE_STAGES[last] && held === 0`), with a **defensive
  fallback**: if a hold tag ever lands on Live (`held > 0` — mid-sync, cron lag,
  dirty history) it renders the NORMAL ready/total + bar + chips card so the
  anomaly surfaces. `held === 0` is not hardcoded; Live is derived from the SoT
  stage order, not a literal.
- **§2.3 Stage NAME is the drawer link** ("LABEL →", navy→orange, hover/focus
  underline) when `total > 0`; the separate "view →" button is retired; an empty
  stage is a plain non-clickable span (no arrow).
- **§2.4 Drawer subheader** "N ticket(s) in stage" → "N ticket(s) gated in
  {stageLabel}" (pluralized).
- **§2.5 "Full detail →"** text link → secondary/outlined button, same placement.
- **§2.6 All-collapsed on load** — already the behavior; verified, no change.
- **§2.7 Delivered-28d + This-Wk numerals colored by status** (one `numeralColor`:
  paused → `--f92-lgray`, `row.droughtFlag` → `--ledger-drought`, else →
  `--ledger-active`), replacing the old zero-vs-nonzero conditions. [Karen L2]
- **§2.8 Paused legend swatch** (`--ledger-paused`) via a new `showPaused` prop on
  `CoverageLedger`, shown only when Show-paused is on. [Karen L3]
- **§3 Expand all / Collapse all** header buttons on the existing `open` Set
  (`new Set(rows.map(id))` / `new Set()`); disabled when loading or no rows;
  operate on the filter/paused-scoped rows; survive a sort (Set keyed by
  `brand.id`). No state lift.
- **Commit 3 — card merge (layout-only):** the two stacked cards at the top of
  `/dashboard/coverage` (the `ProjectBrandFilter` card + a standalone control-bar
  card) are combined into ONE. `ProjectBrandFilter` gained an optional
  `actions?: ReactNode` prop rendered right-aligned in the Project row alongside
  "Clear"; the page's control-bar `<Card>` is deleted and its three controls
  (admin-gated Add brand, Show-paused, Export) pass through `actions={…}` verbatim
  (same handlers/gate/disabled condition). No logic/state change; other mounts
  (none today) pass no `actions`.

**Verification:** `tsc --noEmit` clean; `npm run build` green
(`/dashboard/coverage` prerenders); `tests/coverage-kpis.test.ts` 5/5 (untouched —
the Live-column removal is render-only, no KPI-calc change); ESLint on all changed
files → zero findings. **No version bump** (render/UX + layout only, no new
structural surface — mirrors 005.2 commit-3; version stays v2.5).

**Advisor credit:** Karen (post-flight PASS on the §2/§3 build; PASS on the card
merge); Lacey (both-theme smoke).

**Deferred (Karen 005.3 L1, non-blocking):** `LedgerRow.live` is now a dead field
(no reader after the Live sort key was dropped) + the adjacent "live / pipeline"
comment is stale. Harmless (an unread interface field, not flagged by tsc/eslint);
a trivial prune to fold into the next ledger-touching batch. Also still deferred
from 005.2: the Reggie-drawer content fold-in + Brand Wellness CTA re-home (own
later batch, spec §6).

### Batch 005.2 — Coverage Ledger redesign — 2026-07-08

Merged the Batch 010 split Output + Pipeline tables on `/dashboard/coverage`
into ONE accordion **"Coverage Ledger"** (one row per brand, collapsed summary
+ inline expandable detail). Read-only render redesign — **no migration, no new
mutation route, no schema change, no Jenny** (spec §9). Built from
`docs/batch-005.2-coverage-ledger-spec.md` (canonical) + the
`docs/design_handoff_coverage_ledger/` bundle (README = structure/tokens;
`Coverage Accordion.dc.html` = color + ready/held logic; `support.js`
reference-only, NOT ported). **PUSHED + auto-deployed 2026-07-08** (Karen
PASS-WITH-FINDINGS on commit 2 → all fixed/waived; Karen PASS on commit 3;
Lacey smoke-tested both themes + pushed).

**Three commits:** `924437a` (spec + design bundle, docs-only) → `c23bf0a`
(the redesign) → `c09608b` (pre-push fixes — see Commit 3 below).

**Data layer (`lib/coverage/queries.ts`):** new `dailyCounts(milestones,
brandId, days=7, now)` (per-day buckets, mirror of `monthlyCounts`) + a
`daily7: number[]` field on `CoverageRow` (fed by `buildCoverageRows`). All off
the existing full-`milestones` state — no new query/route. Also `formatReworkRatio()`
(single source of truth for the rework-ratio string; dedupe, see Commit 3).

**Components:**
- `components/coverage/sparkline.tsx` — new `DeliverySparkline` (212×58,
  baseline + polyline + end dot, tokenized `--ledger-spark-*`; ports the
  bundle's `spark()` math). The old monthly `Sparkline` export (Output-table
  era) was removed in commit 3 once nothing imported it.
- `components/coverage/coverage-gauge.tsx` — NEW. SVG donut + mount animation
  (arc + numeral count up 0→value, 1000ms ease-out cubic; all setState inside
  rAF so it doesn't trip `set-state-in-effect`; reduced-motion snaps;
  track-only + '—' when value is null).
- `components/coverage/coverage-ledger.tsx` — NEW. The accordion: 7-col grid
  (chevron · rail · Brand · Delivered 28d · This Wk · Live · Pipeline), five
  sortable columns (expand state preserved across sorts, default status-desc so
  drought floats up), expanded detail = 7-day sparkline + delivery stats (Last
  Week / This Month / Rework Ratio) + 5 pipeline-stage cards (ready/total,
  stacked bar, status-tag chips or "✓ all clear"). Exports pure `buildLedgerRow`
  (merge CoverageRow + PipelineBrand → per-stage ready/held; `ready` derived
  from `tickets[]` so a two-tag ticket isn't double-subtracted) so the page can
  sort by the pipeline-derived keys (live / pipeline).

**Page (`app/dashboard/coverage/page.tsx`):** the split Output + Pipeline tables
are replaced by `<CoverageLedger>`. New KPI strip (one connected strip, gap-px
hairlines): teal long-range pair · four rolling-window cards · Overall Health
gauge · Brands Covered · Quality Score gauge — all FULL-SCOPE
(`crossBrand`/`healthKpi`/`qualityKpi` read the full state arrays, NEVER the
filter/paused-scoped `ledgerRows`; the 005.22 boundary is preserved). Drought /
covered still route through the shared `isInDrought` predicate (005.1 Path 1).
Threshold subtitle sources `COVERAGE_THRESHOLD` (no hardcoded literal → Batch
010.1 per-brand targets stay a one-touch change). Preserved affordances:
`SyncJiraButton` (header, pass/fail pill), `downloadBrandedXlsx` export,
`showPaused` toggle (paused brands get a muted rail), admin gear →
`BrandAdminDrawer`, `AddBrandDrawer`, `ProjectBrandFilter`, `PipelineStageDrawer`
(per-stage "view →" in the expanded card), and both footers (orphan-milestone +
unresolved-pipeline).

**Reggie drawer (spec §6, Lacey-confirmed path):** kept AS-IS; row click =
expand; a **"Full detail →"** link in the expanded panel opens the Reggie drawer
for that brand. The Brand Wellness CTA stays inside the drawer — NOT moved, NOT
folded in. Drawer deletion / content fold-in / CTA re-home are a deferred
follow-up (mirrors 005.1 Phase 5 discipline).

**Chips = the LOCKED §15 set (four):** Needs Info · Troubleshooting · On Hold ·
Awaiting (matched verbatim via `OVERLAY_TAG_VALUES`, incl. `Awaiting client
input`). The mock README showed only three (Troubleshooting "unused") — §15
superseded the mock; the Troubleshooting chip is wired and renders when data is
present (forward-safe). Per Commit 3, chip/segment colors follow the app's
blue=Needs Info / amber=Troubleshooting / **gray=On Hold** / violet=Awaiting
convention (loud solid-fill + near-black text, AA both themes).

**Theming:** new `--ledger-*` token block in `app/globals.css` (§13 r25) — dark
values pixel-match the mock's palette; light values are F92-conformant and
desaturated so the decorative bars/sparklines clear ≥3:1 on the white card;
status-tag CHIP fills stay bright in BOTH themes (README's solid-fill +
near-black-text pattern is background-independent + AA either way → single-value
chip tokens). No inline hex, no dark island (dark chrome is CQIP-navy, not the
mock's near-black — Karen L1, by design).

**Deliberate deviations from Batch 010 (Karen-accepted):**
- Global overlay TOGGLES dropped — the mock has no toggle; per-stage chips
  replace them (more granular, always visible). Their helpers
  (`OverlayCountBadge`, `UntaggedCountBadge`, `OVERLAY_ACTIVE_CLASS`) were pruned
  from `overlay-badge.tsx` in commit 3; `TagBadge` + `OVERLAY_STYLE` stay (still
  used by `PipelineStageDrawer`).
- No actual typo was found in the "Show paused brands" label (spec §4.5); the
  copy was already correct, left verbatim.
- `PipelineStageDrawer` preserved via a per-stage "view →" (the mock shows plain
  counts; the Batch 010 drill-into-tickets capability was kept additively).

**Commit 3 — pre-push fixes (Lacey's smoke + two Karen hygiene items):**
- **Header space.** Subtitle rendered "Brands with 2or fewer…" (JSX dropped the
  space around `{COVERAGE_THRESHOLD}`) → single template-literal expression,
  constant interpolation kept.
- **On Hold → gray** (app convention; loud-solid chip kept). `--ledger-chip-oh`
  `#FB7185` → `#9CA3AF` (both themes; near-black text `#0A0E16` ≈ 6.9:1 AA);
  `--ledger-seg-oh` light `#E11D48` → `#4B5563` (gray-600, ≥3:1 on white), dark
  `#FB7185` → `#94A3B8` (slate-400, bright on the dark bar track).
- **L4 prune** dead exports (zero importers, tsc-confirmed): monthly `Sparkline`
  (+ its `useState` import); `OverlayCountBadge` / `UntaggedCountBadge` /
  `OVERLAY_ACTIVE_CLASS` (+ unused `OVERLAY_LABELS` import).
- **L5 dedupe** the rework-ratio helper into one exported `formatReworkRatio()`
  in `queries.ts` (page + ledger both call it; identical output).

**Verification:** `tsc --noEmit` clean; `npm run build` green
(`/dashboard/coverage` prerenders); `npx tsx --test tests/coverage-kpis.test.ts`
5/5; ESLint on all changed/new files → zero findings. Version bump v2.4 → v2.5
(new component surfaces + token block + query helper = structural, §13 r23);
commit 3 held at v2.5 (same-batch follow-up).

**Advisor credit:** Karen (post-flight PASS-WITH-FINDINGS on commit 2 → PASS on
commit 3); Lacey (both-theme smoke).

**Open (optional polish, deferred — Karen L2/L3, non-blocking):** (1) L2 —
Delivered-28d / This-Wk summary numerals don't color-differentiate drought vs
active (the rail conveys it); the mock spec'd distinct numeral colors. (2) L3 —
no "Paused" legend swatch when *Show paused* is on (only Drought/Active shown).
Plus the still-deferred Reggie-drawer fold-in + BW CTA re-home (spec §6). None
block; can ride a later commit.

### Batch Brand Wellness (v1) — read-only milestone-history proof — 2026-07-07

A "coverage table is broken" report (MOJ "empty") was a misread of a
*correct* drought flag — MOJ genuinely had 0 milestones in rolling-28d.
Brand Wellness is a read-only proof of a brand's real milestone history so
these self-serve. Read-only, **no migration, no Jenny** (read-only report,
no new write surface). Two commits (`731e160` report + this drawer-CTA
commit).

- **Report (`components/reports/brand-wellness-report.tsx`, commit
  `731e160`):** sibling of the scorecard / root-cause / client reports,
  wired into `/dashboard/reports` as a **self-contained card + panel** —
  deliberately NOT folded into the `ReportKind` union / `reportCards.map`
  (its controls differ: brand picker + 30/60/90 toggle, not from/to), so
  Batch 005.2 re-homes it trivially. Own state + fetch.
  - Brand picker sources from the **brands table** (`id, display_name,
    jira_value, brand_code`, `is_active`), NOT `<BrandSelector>` (which is
    `client_brand`-string-keyed and would break brand_id resolution).
  - Fetches all active brands + all non-deleted `test_milestones` once
    client-side (mirrors the coverage page's fetch-all-then-filter
    pattern; low volume) → brand picker + range toggle re-derive instantly.
  - **Brand resolution: brand_id primary, `brand_jira_value` fallback
    scoped to null-brand_id rows** (§13 r18 legacy). Documented divergence:
    `buildCoverageRows`/`countInWindow` and the Reggie drawer match
    `brand_id` ONLY; the fallback only surfaces genuinely-belonging
    unresolved legacy rows and is identical for a well-resolved brand in
    the recent window, so it never contradicts the drought flag there.
  - **Headline is ALL-TIME last milestone** ("Last milestone: <date> · N
    days ago · <ticket>" linking `jira_ticket_url`; "No milestones on
    record" when none) so a drought brand proves "last delivery N days
    ago" instead of reading empty — the range toggle only zooms the
    timeline/list (deviation from the spec's range-filtered fetch, chosen
    so the proof headline is meaningful; the fetch is brand-then-client-
    filtered).
  - **Dot timeline:** recharts `ScatterChart` on a real time X-axis
    (domain `[now-range, now]`, `scale="time"`) so gaps read visually. No
    new dep. **Milestone list:** date · `milestone_type` · ticket (jira
    link) · source, newest first, range-scoped.
  - **v1 OUT OF SCOPE (TODO comments in-file):** rework overlay,
    export/share, multi-brand compare.
- **Drawer CTA (this commit):** `components/coverage/brand-detail-drawer.tsx`
  (the all-user Reggie drawer opened by clicking a brand NAME — NOT the
  admin drawer) gains a loose `<Link>` to
  `/dashboard/reports?wellnessBrand=<brand.id>`; the report reads that
  param on mount and preselects the brand. Wiring is intentionally loose
  (a plain Link, no new props) — code comment notes 005.2 re-homes it.
- **Verification:** `tsc --noEmit` clean; `npm run build` green; ESLint on
  the new/changed files introduces **zero new** findings (the reports
  page's pre-existing `no-explicit-any` / unused-var / exhaustive-deps
  findings are original code, untouched). No migration.

**Karen post-flight (2026-07-07): PASS-WITH-FINDINGS → follow-up commits 3
+ 4 (`6248727` + this docs commit) close the one MEDIUM.** Karen confirmed
read-only / zero write surface, CTA in the Reggie drawer (not admin), no
reports-page regression, and correct doc housekeeping; the MEDIUM was that
`belongsToBrand`'s `brand_jira_value` fallback could surface a milestone
INSIDE the rolling-28d window that the brand_id-only drought counter does
not count (a null-brand_id row whose jira_value matches — brand renamed
after ingest, or §13 r18 backfill lagging) → the proof view could
contradict the flag it exists to prove. Safe on live data today (0 such
rows in 28d) but data-dependent, not structural.
- **Commit 3 (`6248727`) — ≤28d fallback scoping.** `belongsToBrand` now
  takes a fixed `droughtCutoffMs` (nowMs − 28d, NOT the 30/60/90 range):
  INSIDE 28d it matches `brand_id` ONLY (exact parity with `countInWindow`),
  OUTSIDE 28d it keeps the `brand_jira_value` fallback (old orphans are
  full-history value and can't contradict a rolling-28d flag). The proof
  view can no longer show a recent milestone the flag doesn't count.
- **Commit 4 (this commit) — Output-table orphan footer + docs.**
  `app/dashboard/coverage/page.tsx` gains an all-user footer under the
  Output table mirroring the existing Pipeline `unresolvedCount` footer:
  "`{n}` milestone(s) not counted toward coverage — no brand linked."
  Count is `orphanMilestoneCount` — a memo over the existing `milestones`
  state (`!is_deleted && brand_id == null`); NO new query/fetch, shows only
  when > 0, not admin-gated. Makes the null-brand_id population visible on
  the coverage surface instead of silent.
- **Deferred (see §15):** a scheduled orphan alert on the 010.1 5am cron;
  the optional BW v1.1 per-dot "unresolved — not counted" timeline badge
  (Karen's other suggestion); and an OPS check that the §13 r18
  `test_milestones` backfill runs on a cadence (the compound risk if it
  lags).
- **DO NOT PUSH — Karen re-check next; Lacey smokes on MOJ, then pushes.**

### Batch create-flow — user creation on real emails (last @cqip.local source) — 2026-07-07

Closes the seam Karen flagged on `af647a6` (auth-cleanup): login went
email-only, but user *creation* still minted `username@cqip.local` and the page
copy still said "sign in with username." This makes creation consistent with the
shipped email-based model. No migration (`must_change_password` already exists
from 022). No Jenny (modernizes an existing flow, no new surface).

- **Create form (`settings/users/page.tsx`):** the "Username" field is replaced
  with an **Email** field reusing the edit-email `@fusion92.com` smart-default
  (bare local part → `@fusion92.com`; anything with `@` taken verbatim, via the
  shared `toFusionEmail()`), with a "Will create: …" preview. Password field
  relabeled "Temporary password"; Role unchanged. `display_name` is now derived
  from the email local part via new `displayNameFromEmail()` (separators →
  spaces, title-cased: `first.last@…` → "First Last") — kept as the friendly
  name. Client validates via `EMAIL_RE` + `@cqip.local` rejection before POST.
- **Server (`/api/admin/users` POST):** the `account_type:'local'` →
  `username@cqip.local` mint is **removed**. Creation now requires a real email
  (lowercased, `EMAIL_RE`-validated, `@cqip.local` rejected), creates the auth
  user with that email + the provided password + `email_confirm:true` (marks
  confirmed, **sends nothing** — no-unsolicited-email rule), inserts the profile
  with **`must_change_password: true`** (forced change on first login, same
  model as the temp-password flow), and writes the existing `CREATE` /
  `field_name='role'` / `target_type='user'` audit row via `writeUserAudit`
  (`getChangedBy` on the cookie-bound client, §13 r19). The old
  `resetPasswordForEmail` invite send is gone. A duplicate email surfaces as a
  clean 409 (`auth.users` is the authority). Orphaned `sanitizeUsername` helper
  deleted; the now-unused `Input` import removed from the users page.
- **Stale copy fixed (Karen af647a6 finding):** "Create username/password
  accounts … sign in with their username only" → "Create accounts … sign in
  with their email address"; "Usernames are lowercase first names" → fusion-email
  guidance ("a bare name gets `@fusion92.com`; type a full address for external
  accounts; they set a new password on first sign-in"). §2 Auth detail, §5
  user_profiles intro, and §9 User Accounts notes all rewritten off the
  retired `@cqip.local` username model.
- **Verification:** `tsc --noEmit` clean; `npm run build` green; ESLint on the
  changed files introduces **zero new** findings (only the pre-existing
  `set-state-in-effect` on the untouched login-page rate-limit effect). No
  migration. Version bump v2.2 → v2.3.
- **DO NOT PUSH — Karen review next; DC smokes, then pushes.** Note: this
  completes the `@cqip.local` retirement — the string now appears only in
  defensive guards (reset refusal, create rejection) and migration history.

### Batch auth-cleanup — login is email-only; the auth chain is complete — 2026-07-06

The final auth commit. **Precondition met:** Lacey migrated all 7 accounts
to real fusion emails on 2026-07-05 (no `@cqip.local` left; drift check
confirmed clean), so the transitional dual-mode scaffolding retires. Two
code changes + a docs sweep. No migration. No Jenny (removes a path, adds
no new surface).

- **Login is email-only (`app/login/page.tsx`):** the legacy `@cqip.local`
  synthesis fallback in `resolveIdentifierToEmail()` (the
  `// TODO(auth.1-cleanup)` branch) is removed — the function now just
  `trim().toLowerCase()`s the input as an email. The orphaned `toEmail()`
  and `normalizeUsername()` helpers are deleted (`LOCAL_SUFFIX` stays —
  still used by the reset guard). Field label "Email or username" → "Email"
  (`type="email"`, placeholder `you@fusion92.com`); subtitle copy updated;
  the failed-login username nudge is gone — plain `error?.message ??
  'Invalid login credentials.'`.
- **Edit-email `@fusion92.com` smart default (`settings/users/page.tsx`):**
  the edit-email field shows a fixed `@fusion92.com` suffix adornment and a
  bare local part gets the domain appended on save; **anything containing
  `@` is treated as a full address verbatim** (non-F92 / correction
  accounts stay possible — a default, not a hard cage). New module helper
  `toFusionEmail()`; a "Will set: …" preview line shows the resolved
  address. The suffix hides once the input contains `@`.
- **"Created" column removed** from the users table (header + cell +
  colSpans 6→5). "Last active" stays — it's the useful signal. (`created_at`
  is still returned by the GET route and kept on the type; just not
  rendered.)
- **Docs sweep (this commit, per r23):** §15 priority reorder (auth DONE →
  Brand Wellness → 005.2 → 006 → 010.1 → 007 → per-brand config → 008,
  Lacey 2026-07-05; mirrored to CROSS_CLAUDE.md §5); new §15 entries —
  Brand Wellness (v1 per its own commit; rework overlay/export = v2
  deferred) and the login-activity read side (recording LIVE via `21df742`,
  read side pending); Batch 005.2 expanded to the **Coverage Ledger
  redesign** (accordion merging the Batch 010 split tables, mockup-bundle
  path placeholder, the 4 scope forks — Awaiting-Client tag / per-day
  sparkline / theming-vs-F92-tokens / ≤2-copy-vs-sort overlap — couples
  render-only to the 005.1 gauges, re-homes the Brand Wellness drawer CTA);
  the auth.1 §15 entry marked rollout-DONE + cleanup-SHIPPED;
  `docs/batch-outline-2026-07-03.md` Azure line reworded to **DELIBERATE
  HOLD (Lacey's call, not stale-rot, do not re-flag)**.
- **Verification:** `tsc --noEmit` clean; `npm run build` green; ESLint on
  the two changed files introduces **zero new** findings (only the
  pre-existing `set-state-in-effect` on the unchanged rate-limit effect,
  now line 92). No migration. Version bump v2.1 → v2.2.
- **DO NOT PUSH — Karen review next; DC smokes, then pushes.**

### Batch login-events — login-activity recording (plumbing only) — 2026-07-06

Starts durably recording every successful login NOW so a later read-only
batch can render a per-user count / GitHub-style heatmap over real
history. **No visible surface this batch** — data capture only. Separate
commit from the auth chain. Promotes spec §8 (the fast-follow that
auth.2/.1 named) into its data layer.

- **Migration 023 — `023_login_events.sql` (idempotent):** new
  append-only `login_events` table (`id`, `user_id UUID NOT NULL
  REFERENCES user_profiles(id) ON DELETE CASCADE`, `occurred_at`) +
  index on `(user_id, occurred_at DESC)`. RLS ON: `login_events_admin_select`
  (admins only via `public.is_admin()` — the future read side is
  admin-only) + `login_events_insert_own` (`WITH CHECK (user_id =
  auth.uid())`). No UPDATE/DELETE policy, no public/anon access.
- **Write path (`app/login/page.tsx`):** after `signInWithPassword`
  resolves without error AND a session exists, a **fire-and-forget**
  insert of one `login_events` row for `data.session.user.id` (the
  now-authenticated client satisfies insert-own RLS). Not awaited;
  a failed insert is swallowed with a `console.warn` and never blocks
  or errors the login. Placed in the success tail only — a FAILED login
  inserts nothing. `resolveIdentifierToEmail`, the failed-login hint,
  the reset flow, and the rate-limit effect are all untouched (purely
  additive).
- **No column, no count display, no heatmap** — those are the later
  read-only batch (§15 "Login-activity read side" backlog). The
  all-admins-vs-owner-only visibility decision (spec §8) rides that batch.
- **Verification:** `tsc --noEmit` clean; `npm run build` green; ESLint
  on `login/page.tsx` introduces **zero new** findings (only the
  pre-existing `set-state-in-effect` on the unchanged rate-limit
  `useEffect`). Migration 023 applies idempotently and must be run in
  Supabase before this code deploys (the insert targets `login_events`).
  **DO NOT PUSH — Karen review next; Lacey runs migration 023 + smoke-tests
  (one real login → exactly one row; a failed login → none) + pushes.**
- No Jenny (small additive plumbing, per spec §8's "no Jenny" note).
  Version bump v2.0 → v2.1 (new table + migration = structural, §13 r23).

### Batch auth.1 — Email migration + email-primary login — 2026-07-05

Second half of the auth.2/auth.1 session (spec `docs/batch-auth-spec.md`
§4 + §5). Separate commit after auth.2. Migrates the 7 `@cqip.local`
accounts toward real fusion emails and makes login email-primary via a
dual-mode shim, so Supabase's native forgot-password flow becomes usable.
**No migration this batch.**

**Dual-mode login (`app/login/page.tsx`) [Jenny H3, revised by the
Approach-C fix below]:** `resolveIdentifierToEmail()` — if the input
contains `@`, use it as the email (`trim().toLowerCase()`); otherwise
synthesize the legacy `@cqip.local` address. Migrated users sign in via
the `@` branch (their fusion email); un-migrated users still resolve by
username via synthesis. The synthesis fallback is **kept**, marked
`// TODO(auth.1-cleanup)` — removed only in the post-migration cleanup
commit (spec §4.3), NOT this commit. Label/copy → "Email or username".

> **Post-flight fix — Karen HIGH (Approach C), same commit chain.** The
> first cut of this resolver did a `user_profiles.display_name` lookup
> here to map username → real email. Karen's post-flight proved (and
> `git`-confirmed against migration 005) that the lookup is **dead from
> the login screen**: the browser client is unauthenticated and
> `user_profiles` RLS is `authenticated`-only, so it always returned
> `null` and fell through to synthesis anyway — the H3 anti-lockout
> guarantee was silently absent. **Approach C** (chosen over a resolver
> endpoint or an anon RLS policy — no new surface, no directory
> disclosure, no migration): **drop the lookup entirely.** A migrated
> user typing their old username fails synthesis and gets a static hint
> appended to the failed-login message — *"Switched to email login? Enter
> your email address."* (no lookup). The same fix repairs the
> **pre-existing** broken reset flow (`handlePasswordReset`): it had the
> same dead lookup and never actually reached `resetPasswordForEmail`;
> now an `@`-input calls `resetPasswordForEmail(email)` directly and a
> non-`@` input keeps the `@cqip.local` "contact an admin" refusal.
> Reset copy/label updated to "Email" to match. Also folds the Karen LOW:
> the `set_email` dup pre-check switched from `.ilike('email', …)` (where
> `_` is a wildcard that can false-match) to `.eq('email', …)` on the
> lowercased value, with `auth.users` unique as the backstop.

**`set_email` PATCH action (`/api/admin/users`) [Jenny H2/M3]:** guarded
by the new `assertTargetIsReadOnlyOrSelf(id, callerId)` — an admin may
edit their **own** email (Lacey migrates herself first) but not another
admin's; read-only targets allowed. Validates RFC-ish shape, rejects the
`@cqip.local` domain, and pre-checks duplicates (`.eq` on the lowercased
email per the Approach-C fix; `auth.users` is the real unique authority).
**Ordered two-write, no rollback [M3]:**
`auth.admin.updateUserById(id, {email, email_confirm:true})` FIRST (login
source of truth; `email_confirm:true` sends nothing), then
`user_profiles.email` with **one retry**; on persistent profile failure
it returns a loud error naming which side won (auth updated, profile
stale → recovery reads the profile email, so surface it), no rollback
machinery. Auth-first is deliberate: on failure the user can still sign
in with the new email — the recoverable state is the failure-landing
state. Audit row is `action='UPDATE'` + `field_name='email'` (NOT a
literal `email_change` — same `audit_log.action` CHECK reason as auth.2).

**"Last active" column + drift indicator (§5):** new **`GET
/api/admin/users`** (admin-gated, service role) returns profiles +
`last_sign_in_at` + `auth_email` from `auth.admin.listUsers()`, plus a
per-row `email_drift` flag (profile email ≠ auth email, nearly free since
`listUsers()` is already fetched). The users page switches its list load
from the direct supabase query to this route, adds a **Last active**
column (relative time; "Never" if null) and a red **⚠ email drift** badge
(tooltip shows both addresses). New per-row **Edit email** action opens an
inline editor callout (self OR read-only rows; matches the server guard).

**Fold-in [Karen LOW]:** every user-target audit write now goes through a
new `writeUserAudit()` helper that wraps `getChangedBy()` + the insert in
try/catch (matching `/api/account/password-changed`), so a
`getChangedBy()` throw can never fail a mutation that already succeeded.
Refactored all six auth.2 audit sites onto it too.

**TODOs (comments only):** `display_name` has no UNIQUE constraint
(ambiguous username lookup if two first names ever collide — fine at 7);
`listUsers()` pagination (~50/page default — fine at 7).

**Verification:** `tsc --noEmit` clean; `npm run build` green (`GET
/api/admin/users` registers); ESLint on changed files introduces **zero
new** findings — the one `react-hooks/set-state-in-effect` error on
`login/page.tsx` is **pre-existing** (the rate-limit `useEffect`,
unchanged; confirmed identical on HEAD in-place). No migration, no schema
change. **DO NOT PUSH — Karen review next; Lacey pushes, then edits the 7
emails (self first) + informs users; cleanup commit follows.** §16 auth.2
entry unchanged; this is a sibling batch.

**Advisor credit:** Jenny (pre-flight — H2/H3/M3 land here); Karen
(auth.2 post-flight LOW fold-in).

### Batch auth.2 — Admin temp-password reset + account-recovery hardening — 2026-07-05

First half of the auth.2/auth.1 session (spec `docs/batch-auth-spec.md`
v3, Jenny PASS-WITH-FINDINGS folded). auth.2 gives admins a working
recovery path for read-only users (all 7 accounts are `@cqip.local`
today, so Supabase email recovery is dead — see spec §1.2), closes the
Jenny findings on `/api/admin/users` (no target-role guard, zero audit
rows), and locks the "app never mutates an admin account" posture.
**auth.1 (email migration + dual-mode login + Last active/drift) is the
NEXT, separate commit — deliberately NOT pulled forward.**

**Migration 022 — `022_auth2_recovery.sql` (idempotent), three parts:**
1. `user_profiles.must_change_password BOOLEAN NOT NULL DEFAULT FALSE` —
   the forced-change flag.
2. **[Jenny C1]** DROP + re-ADD `audit_log_target_shape_chk` to admit
   `target_type='user'` (allowed set now
   `quality_log|test_milestone|brand|alert_event|user`), mirroring the
   migration-015 `'alert_event'` pattern. Without it every user audit
   row throws a CHECK violation.
3. **[Jenny M1]** Extended the r22 privileged-column trigger —
   `BEFORE UPDATE OF role, is_active, must_change_password`, same
   function/guard — so a non-admin browser write to the flag (via the
   migration-005 self_update RLS policy) raises `insufficient_privilege`.
   Service-role writers (auth.uid() IS NULL) still pass.

**Second CHECK gap found + handled during build (parallel to C1):** the
`audit_log.action` CHECK (`001:70-72`) only permits
`CREATE|UPDATE|DELETE|STATUS_CHANGE|AI_SUGGESTION` — the spec's literal
`action='password_reset'` would ALSO CHECK-violate. Rather than a fourth
migration part, auth.2 follows the established codebase audit convention
(e.g. `brands/pause/route.ts:98`): allowed action value (`CREATE`/`UPDATE`)
+ descriptive `field_name` (`password` / `role` / `is_active` /
`must_change_password`). Migration 022 stays at exactly the three
enumerated parts. auth.1's `email_change` audit will make the same choice.

**Route `app/api/admin/users/route.ts`:**
- `requireAdmin()` now also returns the cookie-bound route client so
  `getChangedBy()` receives it per **[Jenny M4]** (§13 r19).
- **[Jenny H1]** New `assertTargetIsReadOnly(id)` guard wraps ALL
  state-changing surfaces — `set_temp_password`, `reset_password`, the
  generic role/`is_active` PATCH branch (both directions), and `DELETE`
  — returning 403 on admin targets. Promotion (read_only → admin) still
  works (target is read_only at guard time). The auth.1
  `assertTargetIsReadOnlyOrSelf` variant is NOT built yet.
- New action **`set_temp_password`:** server-generated 20-char
  alphanumeric temp password (`crypto.getRandomValues`, ambiguous glyphs
  dropped) → `auth.admin.updateUserById` → `must_change_password=true`
  (service role) → audit row (pw never in the row) → returns
  `{temp_password}` once with `Cache-Control: no-store`.
- `reset_password` (email) kept + guard + audit; still refuses
  `@cqip.local`. Create/role/deactivate now write `target_type='user'`
  audit rows (closes Jenny finding 4). Client-supplied `changed_by` is
  warned + discarded (§13 r19).

**Forced-change gate + flag-clear [Jenny M1/M2]:**
- `middleware.ts` consolidates the auth-dashboard `user_profiles` lookup
  to ONE round-trip serving both the new forced-change gate and the
  existing r24 admin gate. A user with `must_change_password=true` is
  redirected to `/dashboard/settings/profile?mustChangePassword=1` and
  blocked elsewhere until cleared (runs before the admin gate so a
  flagged admin lands on profile, not a bounce).
- New route **`POST /api/account/password-changed`** — clears the
  caller's own flag via service role (browser can't; trigger-protected)
  and audits the completed change. The change-password form
  (`settings/profile/page.tsx`, corrected from the spec's "layout"
  assumption per Jenny M2) calls it after `supabase.auth.updateUser`
  succeeds, then redirects to `/dashboard`.
  - **Forced-change UI (refined 2026-07-05, UI-only follow-up commit):**
    while the flag is set, `settings/profile/page.tsx` presents the
    change-password form as a **centered, non-dismissable modal** (no
    close button, no click-outside, no Esc — it's a plain fixed overlay,
    not a Radix Dialog) over a dimmed backdrop, and suppresses the rest
    of the profile page behind it (early return). The former inline
    banner copy is now the modal header. Submit logic is unchanged — the
    form was extracted to a shared `renderChangePasswordForm(layout)`
    helper used by both the modal (stacked) and the normal Card (3-col
    on lg). No middleware/route/constraint change.

**UI (`settings/users/page.tsx`):** read-only rows get a "Set temp
password" action → one-time copy callout ("share over a secure channel;
won't be shown again"). Admin rows: role select + active switch disabled,
reset/temp-pw/delete replaced with a "Managed out-of-band" note — the UI
matches the server refusal.

**Verification:** `tsc --noEmit` clean; `npm run build` green (both new
routes register as `ƒ` dynamic); ESLint on all changed files → zero
findings. Migration 022 runs manually in the Supabase SQL editor BEFORE
the code is deployed (the middleware/route select `must_change_password`).
Per §13 r22/r35 the whole write path is service-role, so the trigger is
bypassed by design. **DO NOT PUSH — Lacey routes to Karen, then
smoke-tests + pushes.** §13 rule 35 added; r22 extended; §5 schema doc
updated (must_change_password column + trigger + audit target-type).

**Advisor credit:** Jenny (pre-flight PASS-WITH-FINDINGS — C1/H3/M1 +
H1/H2/M2/M3/M4; auth.2 folds C1/H1/H2(partial)/M1/M2/M4).

### Batch 005.1 — Coverage redesign + BrandAdminDrawer — 2026-07-03

Two bundled changes to `/dashboard/coverage`, shipped across a five-commit
chain: (1) Coverage KPI reorg + 3 new program-health cards, and (2) the
§15 item 5.1 BrandAdminDrawer consolidation — replacing the standalone
`/dashboard/settings/coverage` admin page with a unified per-brand drawer
opened from the Coverage page. Spec:
`docs/batch-005.1-coverage-redesign-spec.md` (Jenny pre-flight
PASS-WITH-FINDINGS 2026-06-05, all findings folded into the spec before
build). No schema change, no migration across the whole chain.

**Phase 2 — KPI calc layer + tests (commit `adb502b`, 2026-06-08):**
- `lib/coverage/queries.ts`: extracted the shared `isInDrought()` predicate
  + `COVERAGE_THRESHOLD` constant; the Output-table DROUGHT pill (via
  `buildCoverageRows`) now routes through it.
- `computeCoverageHealth()` — single pass yielding BOTH Overall Health %
  and Brands Covered N/M (same numerator/denominator, so they cannot
  diverge). `computeQualityScore()` — distinct clean ÷ distinct delivered
  tickets, rolling 28d. Both pure functions over plain arrays.
- `tests/coverage-kpis.test.ts` — 5 cases (normal, 0-denominator,
  dirty-not-in-delivered intersection, exactly-THRESHOLD boundary =
  drought/uncovered, single-pass non-divergence), run via `npx tsx --test`.
- `QualityLog` interface + coverage page `quality_logs` select gained
  `jira_ticket_id` (needed by Quality Score).

**Phase 3 — KPI row reorg + card wiring (commit `48ee281`, 2026-06-10,
UI-only, first phase to reach prod):** `app/dashboard/coverage/page.tsx`
KPI row reorged into ONE responsive 9-card grid in locked order — teal
long-range pair (Tests This Year / Tests All Time) moved to front
(position-only; `--kpi-longrange-*` tokens unchanged), the existing four
rolling-window cards unchanged, then three NEW non-teal cards (Overall
Health, Brands Covered "N/M", Quality Score) wired to the Phase 2 exports.
**Full-scope guard honored** — the new cards read the FULL
brands/milestones/logs state arrays via two memos, never `visibleRows`
(the filter- and paused-scoped memo); tables stay filter-scoped (Batch
005.22 KPI boundary NOT reversed). New-card subtitles read "LAST 28 DAYS".
Prod hand-check confirmed shipped fns === an independent manual recompute
(Overall Health 7/13 = 54%, Quality Score 32/40 = 80%; boundary live:
ASV=2 → uncovered, MDG=3 → covered).

**Phase 4 — BrandAdminDrawer (commit `45b3242`, verified live in prod by
Lacey):** new per-brand admin drawer on `/dashboard/coverage`
consolidating all four brand-admin flows — **Details** (read-only),
**QA Config**, **Milestones**, **Pause** — into one `BrandAdminDrawer`
(`components/coverage/brand-admin-drawer.tsx`; minimal local tab strip, no
Tabs component in the library). Opened by admins via a per-row gear button
on the Output table (`e.stopPropagation` so it doesn't also fire the
read-drawer row click); row click still opens the read-only
`BrandDetailDrawer`. The QA-config form body was extracted to a
chrome-less `components/coverage/brand-qa-config-form.tsx` (canonical home
of the `BrandQaConfig` type). `ManageMilestonesDialog` gained an optional
`onChanged?` callback so the drawer refetches Output counts.
`BrandDetailDrawer` lost its `isAdmin` / `onManageMilestones` props (admin
actions moved to the new drawer). "Add brand" moved onto the Coverage
control bar (admin-only, opens the existing `AddBrandDrawer`). **No new
mutation routes** — every write reuses an existing server-gated route
(`/api/admin/brands/qa-config`, `/api/admin/brands/pause`,
`/api/admin/milestones[/:id]`, `/api/admin/brands`); audit stays
server-derived per §13 r19; middleware r24 posture unaffected.

**Phase 5 — settings-page deletion (commit `f388276`, gated on Phase 4
verified live):** deleted `app/dashboard/settings/coverage/page.tsx` and
the `components/coverage/edit-brand-qa-config-drawer.tsx` thin wrapper
(only consumer was the settings page). Removed the "Client Coverage" tile
from the settings home. `middleware.ts` r24 admin gate is wildcard-based
(`/dashboard/settings/*` minus `/profile`) so the removed child page
needed no gate edit. Repo-wide `grep "settings/coverage"` across
`app/ components/ lib/ middleware.ts` returns zero hits.
`manage-milestones-dialog` + `add-brand-drawer` kept (consumed by
`BrandAdminDrawer` / control bar); `back-to-settings` untouched (5 other
settings pages use it).

**Commit A — Karen Finding 1 fix (commit `eefc9f0`, 2026-07-03):**
`buildCoverageRows`, the five time-window helpers
(`startOfCurrentWeek` / `startOfLastWeek` / `endOfLastWeek` /
`startOfRolling28` / `startOfCurrentMonth`), and `monthlyCounts` gained an
optional trailing `now: Date = new Date()`, mirroring
`computeCoverageHealth` / `computeQualityScore`. The default preserves the
Coverage page call site exactly (no app/component change). Test 4 now pins
NOW on the pill side too; suite re-greened 5/5. Also closes Finding 3
(`buildCoverageRows` was the last coverage aggregator without an injectable
clock). See Karen post-flight below.

**Jenny Critical + Path 1 resolution:** "Covered" is the strict complement
of the drought predicate, computed as `!isInDrought(...)` via the single
shared predicate — so the Overall Health / Brands Covered KPIs and the
Output-table DROUGHT pill are structurally incapable of diverging. A brand
sitting exactly ON the threshold (2 milestones/28d) reads DROUGHT/uncovered
on both surfaces. Flat threshold (2/28d) this batch; the aggregator reads
`target` per-brand inside the loop so the per-brand-target swap is a
one-line change when Batch 010.1 (merged, ex-010.2) lands. The exactly-2
business-semantics question (`<= 2` vs `< 2` — "Path 2") is NOT a bug in
this batch's parity work; it is folded into Batch 010.1 where the
comparison-against-configured-target is defined once, correctly.

**Karen full-chain post-flight (2026-07-03, PASS-WITH-FINDINGS):** reviewed
the whole chain (Phases 2-5), precedent Batch 009 whole-ship review.
Verified by re-running: `tsc --noEmit` clean, `npm run build` exit 0,
zero `settings/coverage` refs, the shared-predicate divergence-proofing
end-to-end, the full-scope guard, permission surfaces (all four flows
through existing server-gated routes, no new routes), and deletion
completeness. One must-fix — Finding 1 (the Jenny-Critical boundary test
had aged RED because `buildCoverageRows` used the wall clock while the test
pinned NOW; **production was never affected** — pill and KPI both read the
same wall clock at render, so they always agreed) — FIXED in Commit A.
Findings 2-3 (LOW doc items) absorbed into this close-out commit: the §5
schema-doc QA-config edit-path reference updated to the BrandAdminDrawer,
and the injectable-clock hygiene item resolved by Commit A.

**Advisor credit (CC4):** Jenny (pre-flight, 2026-06-05 — Critical +
Medium findings folded into the spec); Karen (full-chain post-flight,
2026-07-03).

**Verification (Commit A, re-run at close-out):** `npx tsx --test
tests/coverage-kpis.test.ts` → 5/5 pass; `tsc --noEmit` clean; `npm run
build` exit 0; ESLint on changed files → no new findings (the 8
pre-existing `react-hooks/static-components` on SortableHeader/SortIcon
predate the batch). DO NOT PUSH — Lacey smoke-tests Commit A and pushes
both commits.

### Batch 010 — Coverage pipeline visibility — 2026-06-03

Surfaces live work-in-progress (not just delivered tests) on
`/dashboard/coverage`. Ships **010 only** — 010.1 (drought
pill/cron/thresholds) and 010.2 (contract counts) are explicitly
out and remain unscheduled.

**What shipped:**
- **`lib/coverage/pipeline-stages.ts`** — single source of truth for
  the stage→Jira-status map (Strategy · Design · Dev · Queued · Live;
  `Done` + `Reporting` excluded), the overlay-tag definitions, the
  reverse lookups, and the `/api/coverage/pipeline` response types.
  Prose companion `docs/batch-010-pipeline-stage-map.md` (committed on
  its own first, per the batch's Step 1).
- **`lib/jira/search.ts`** — lazy, build-safe JQL search helper using
  the token-paginated `/rest/api/3/search/jql` endpoint. Reads Jira
  env inside the function (unlike `lib/jira/client.ts`, which throws
  at import) so a Next route can import it without breaking
  `next build` — `JIRA_API_TOKEN` is a runtime-only Worker secret.
- **`app/api/coverage/pipeline/route.ts`** (GET) — cookie-bound
  session auth, any authenticated user (coverage is read-only-visible;
  NOT Bearer, NOT admin-gated). Loads projects/brands/aliases once via
  the service role, runs **one JQL per active project** for the union
  of the five stage buckets, buckets tickets by brand + stage in-route
  (brand resolution mirrors the webhook's §13 r13/r28 chain), and
  returns per-brand `{counts, overlays (per-stage subsets), tickets}`
  plus `unresolved_count` and per-project `errors` (partial-success
  transparency). LIVE at render — no cache (Batch 007 owns caching);
  read-only against Jira (§13 r5).
- **Checklist sub-tasks excluded at the source (010 follow-on):** the
  query carries `AND issuetype NOT IN (...)` for the three
  auto-generated checklist types (`Strategy`/`Design`/`Dev Review
  Checklist`), listed as `EXCLUDED_ISSUE_TYPES` in
  `pipeline-stages.ts`. A 2026-06-03 diagnostic found all 252 NBLYCRO
  brand-less in-pipeline tickets were exactly these scaffolding
  sub-tasks (brand lives on the parent), so `unresolved_count` was a
  misleading 252; excluding them drops it to ~0 while leaving the
  brand-resolved real-work count (239) unchanged. The unresolved
  footnote already self-suppresses when the count is 0.
- **CONFIRM-at-impl resolved:** overlays are stored on the Jira
  multi-select **`customfield_12528` "CRO Labels"** (NBLYCRO/SPLCRO
  tickets carry no `labels`), matched on the exact-cased option values
  `"Needs info"` / `"Troubleshooting"` / `"On hold"`. Verified against
  production 2026-06-03.
- **Coverage page redesign:** pipeline fetch added to `refetchAll()`
  (partial failure flows into the existing `failures[]`/`loadError`);
  Tests This Year + Tests All Time KPIs promoted with a teal
  long-range accent via new `--kpi-longrange-{bg,border,fg}` tokens in
  `app/globals.css` (`:root` + dark, WCAG AA, §13 r25 — no inline
  hex); control bar gains three overlay toggle chips on the left with
  Show paused + Export moved right-aligned into the same bar; tables
  split into **Output** (existing, unchanged — keeps its
  ACTIVE/DROUGHT pill) and **Pipeline** (Brand · Strategy · Design ·
  Dev · Queued · Live, no status column, counts are click targets).
  Both tables share the `ProjectBrandFilter` scope + single-brand
  exemption; KPIs stay full-scope (program-health boundary, Batch
  005.22).
- **Overlay toggles** are visual-only (never filter rows out) and
  live directly above the Pipeline table (relocated out of the top
  control bar in a 010 follow-on — they only badge pipeline counts,
  so they belong with that table; the top bar keeps Project pills +
  Show paused + Export). When
  on, each stage count renders a per-overlay `OverlayCountBadge`
  showing the tagged subset (blue NI / amber TS / gray OH); badges
  stack. **`PipelineStageDrawer`** (Sheet, stacks per §13 r26) opens
  on a count click and lists that brand's live Jira tickets in that
  stage — Jira link, title, `TagBadge`s (all CRO Labels), approximate
  age in stage. Badge colors come from the `--pill-*` tokens.
- **Age in stage** uses `statuscategorychangedate` as the v1
  approximation; true per-status age (changelog) is flagged
  out-of-scope in the route code.
- **No migration, no schema change.** §13 rule 33 added.

**Verification:** `npm run build` green; `tsc --noEmit` clean; new
route returns 401 unauthenticated (auth gate) and the end-to-end data
path was validated against live prod Jira + Supabase (504 in-pipeline
tickets across NBLYCRO + SPLCRO; per-brand stage + overlay counts
sensible; 252 NBLYCRO tickets correctly excluded as brand-less — all
empty brand field, zero alias gaps). Output table unchanged
(regression check). The 8 pre-existing `react-hooks/static-components`
lint findings on the coverage page (SortableHeader/SortIcon, predate
this batch) are untouched; no new lint findings introduced.

DO NOT PUSH — Lacey smoke-tests + deploys manually. Step 1 (doc +
const) committed on its own; the route, page, components, CSS tokens,
and these CLAUDE.md edits land together.

**Follow-on — 4th overlay (Awaiting Client Input) + untagged-remainder
chip — 2026-06-10.** Extends Batch 010 (not a new §15.5 in-flight batch).

- **4th overlay `awaiting_client_input`** added to the SoT
  `lib/coverage/pipeline-stages.ts`: `OverlayKey` union, `OVERLAY_KEYS`,
  `OVERLAY_LABELS` (`'Awaiting Client Input'`), `OVERLAY_TAG_VALUES`
  (`'Awaiting client input'` — verbatim Jira casing, capital A / rest
  lowercase, re-confirmed against the prod CRO Labels option list
  2026-06-10; do not transform per §13 r28), and
  `emptyOverlayStageCounts()`. The route
  (`app/api/coverage/pipeline/route.ts`) needed **no change** — its
  overlay bucketing iterates ticket tags through `overlayKeyForTag()`
  and writes `bucket.overlays[key][stage]`, so the 4th overlay counts
  automatically once the const + empty-counts key exist (verified, not
  assumed).
- **4th toggle chip** on the Coverage page renders automatically (the
  toggle row maps `OVERLAY_KEYS`); only the local `overlays` state
  object gained the `awaiting_client_input: false` slot. New color: a
  violet `--pill-aci-{bg,border,fg}` token set in `app/globals.css`
  (`:root` + dark, WCAG AA, §13 r25 — no inline hex), distinct from the
  blue/amber/gray of the existing three. `OVERLAY_STYLE` /
  `OVERLAY_ACTIVE_CLASS` in `components/coverage/overlay-badge.tsx`
  gained the ACI entry (abbr `ACI`); `TagBadge` picks up the violet for
  the `Awaiting client input` tag in the stage drawer automatically.
- **Untagged-remainder chip.** New `UntaggedCountBadge` (dashed gray,
  sibling to `OverlayCountBadge`). When ≥1 overlay toggle is ACTIVE,
  each non-empty stage cell renders a `None N` chip = count of that
  stage's tickets carrying NONE of the ACTIVE overlay tags. Computed
  from `tickets[]` (a ticket with two active tags counts once) — NOT by
  summing per-overlay badges, which would double-count. Per-cell
  invariant: union-tagged + untagged === stage total. Hidden when zero
  overlays are active (and on empty cells).
- **Atomic doc:** `docs/batch-010-pipeline-stage-map.md` overlay table
  gains the 4th row + an untagged-remainder-chip subsection (§13 r23).
- **Verification:** `npm run build` green; `tsc --noEmit` clean; ESLint
  on the changed files surfaces only the 8 pre-existing
  `react-hooks/static-components` findings (SortableHeader/SortIcon) —
  no new findings. Running-app check against prod (ACI counts where
  ACI-tagged tickets exist — legitimately 0 until the team applies the
  label; ≥1-cell union+untagged=total hand-check; existing 3 overlays
  unregressed) is Lacey's manual smoke step before deploy. DO NOT PUSH.

### Batch 009 — SharePoint integration LIVE — 2026-05-29

Read-only Microsoft Graph proxy from the Worker to the CRO
SharePoint site. Closes the §14 "Planned but not yet shipped"
SharePoint entry and the §15 Batch 009 pending section. Day-one
consumer AC's Phase 2 workflow (Jira QA Doc URL → enumerate
folder → parse Preview Links xlsx → fetch screenshot bytes) is
unblocked as of 2026-05-29.

**What shipped:**
- **Three read-only GET routes under `app/api/sharepoint/`:**
  - `folder/route.ts` — `?url=` enumerates a SharePoint folder:
    identifies the single xlsx at root + the `Shareable
    Screenshots/` images; ignores `assets/` and `bugs/`; returns
    the structured `{folder, xlsx, screenshots[], warnings[]}`
    shape with `ref` opaque to AC. 60s in-memory cache.
  - `xlsx/route.ts` — `?ref=` parses the `Preview Links` sheet
    (rows 4+, Col A→label / B→variation / C→national_url /
    D→local_url); returns structured rows, NOT raw bytes. 60s
    cache.
  - `image/route.ts` — `?ref=` streams image bytes (25 MB cap,
    pass-through `Content-Type`, no cache).
- **`lib/sharepoint/` helpers:** `graph-client` (fresh Azure AD
  token per logical request, reused across the 2-3 Graph
  sub-calls, 1 retry on 5xx), `site-resolver` (share-id folder
  resolution + config-driven site/drive + URL normalize),
  `folder-filter`, `xlsx-parser` (xlsx-js-style), `cache`
  (per-Worker Map + 60s TTL), `errors` (envelope + code→HTTP
  map). Plus `lib/api/sharepoint-bearer-auth.ts` (timing-safe
  Bearer compare against `CQIP_SHAREPOINT_API_TOKEN`, separate
  blast radius from the brands token).
- **Auth:** `Sites.Selected` Graph scope (per-site CRO grant),
  client-credentials flow. Bearer-gated externally; no
  query-param fallback.
- **Middleware carveout** for `/api/sharepoint` + `/api/brands`
  so the session middleware doesn't intercept these
  Bearer-authenticated API routes (the brands routes were
  retroactively covered by the same carveout).
- **No DB migration** — the proxy is stateless (no audit rows,
  no cache table, no token persistence).

**Six new env vars (Worker secrets via `wrangler secret put`;
`.env.local` for local dev):** `CQIP_SHAREPOINT_API_TOKEN`,
`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`,
`SHAREPOINT_SITE_HOSTNAME` (`fusion92.sharepoint.com`),
`SHAREPOINT_SITE_PATH` (`/sites/CRO`). See §4.

**Four SHIP-day deviations from the locked DESIGN (folded into
the spec doc):**
- **D1 — share-id folder resolution.** The original spec listed
  `GET /sites/{site-id}/drive/root:/{path}:/children`. Switched
  to `GET /shares/{u!base64url}/driveItem` → `GET /drives/{drive-id}/items/{item-id}/children`.
  Path-lookup silently 404s on the `Shared Documents` vs
  `Documents` library-alias drift; share-id is robust to URL
  shape.
- **D2 — `xlsx_not_found` flipped to hard-fail (422).** 0 xlsx
  at folder root was originally a soft-fail warning; locked to a
  422 (context: `url`) per Lacey so AC gates Phase 2 on a real
  status code instead of inspecting a warning.
- **D3 — `xlsx-js-style`, not `xlsx`.** The spec said "reuse the
  existing `xlsx` package"; that package was removed 2026-04-26
  (Batch 004.2) over unpatched CVEs. The parser uses
  `xlsx-js-style` (already in deps, read-compatible superset) —
  no new build-time dependency.
- **D4 — token per logical request.** Clarified "fresh token per
  call" to "fresh token per user-facing `/api/sharepoint/*`
  request, reused across the 2-3 Graph sub-calls, discarded at
  request end" — no cross-request caching.

**Smoke target:** live-Azure smoke against the Test Task 001
folder (WDG 07 variants) — green: 12 screenshots enumerated, 6
Preview Links rows parsed.

**Commits:** `c7afede` (Step 2: routes + Jenny/Karen hardening)
+ `98a6133` (Step 2: middleware carveout for /api/sharepoint +
/api/brands) + this SHIP docs commit.

**Advisor credit:** AC for the day-one needs clarification
(folder/xlsx/image shapes, soft-fail vs hard-fail framing);
Jenny + Karen for the five-finding pre-ship review.

**Hygiene follow-up (non-blocking):** `AZURE_CLIENT_SECRET`
rotation remains queued (Worker-only, Carl-executable, Fri/Mon
target) — §15 Pending rotations.

**Addendum 2026-06-23 — variable-header-depth /xlsx parser fix.**
`lib/sharepoint/xlsx-parser.ts` now finds the data-start row dynamically
(first Col A matching `/^(control|v\d+)$/i`) instead of a fixed
`HEADER_ROWS = 3`. Two-row-header sheets — where a National/Local
sub-header row with an empty Col A precedes the data (e.g. NBLYCRO-1823 /
MDG-70) — were breaking the parse immediately and returning `rows: []`;
the one-row-header case (NBLYCRO-1139) is unchanged. Parser-correctness
only: response shape (`{filename, rows}`) and column mapping unchanged, no
contract impact, no AC code change. Spec §3.2 reworded for variable header
depth; two-row regression case added to `tests/xlsx-parser.test.ts`. No new
§13 rule.

### Batch 011 — Node 24 upgrade + /api/health endpoint — 2026-05-27

Two paired CI-hygiene items, both touching `deploy.yml`: bump the
GitHub Actions Node runtime 20 → 24 ahead of the Node 20 EOL
deadline (2026-06-02), and add a purpose-built `/api/health`
endpoint so the auto-deploy smoke check has a real health signal
instead of pinging `/login`. Closes the §15 Ops/deferred
"Deploy smoke check via /api/health" item.

- **New file `app/api/health/route.ts`** — public (no auth, no
  Bearer), dependency-free Next route handler. Always returns 200
  with `{ status: "ok", timestamp, version, environment }` and
  `Cache-Control: no-store`. `export const dynamic = 'force-dynamic'`
  keeps it per-request (fresh timestamp, never statically
  prerendered). No DB / Supabase / Graph call by design — if the
  handler itself fails to execute, the workflow's HTTP fetch fails,
  and that IS the health signal. `version` resolves
  `NEXT_PUBLIC_BUILD_COMMIT` (the build-info SHA — only one actually
  populated here) → `CF_PAGES_COMMIT_SHA` → `GIT_COMMIT_SHA` →
  `"unknown"`; `environment` resolves `NODE_ENV` → `ENVIRONMENT` →
  `"unknown"`. Verifies as `ƒ` (dynamic) in the build route table.
- **`.github/workflows/deploy.yml`** — two edits:
  - Edit A: `actions/setup-node` `node-version: '20'` → `'24'`.
  - Edit B: post-deploy smoke check URL `/login` → `/api/health`;
    assertion strengthened from status-only to status 200 **AND**
    body contains `{"status":"ok"}` (the body is the whole point of
    a dedicated probe over the static login page).
- **CLAUDE.md** — §3 file tree adds `app/api/health/route.ts`; §4
  documents the optional env reads; §15 Ops/deferred item checked
  off; this §16 entry; footer + version bump (v1.5 → v1.6 — first
  bump after the Batch 005.32 spec was superseded; a new public
  route + workflow runtime change is structural per §13 rule 23).
- **§13 rule check:** rule 30/31 `paths-ignore` (`**.md`, `docs/**`,
  `.github/**`) is unchanged and still correct — this commit also
  touches `app/api/health/route.ts` (a non-ignored path), so the
  push DOES trigger the workflow, and the triggered run uses the new
  Node-24 `deploy.yml`. No new rule needed.

**⚠ DEPLOY STATUS AT TIME OF WRITING — COMMITTED, NOT YET PUSHED.**
1. **Step 1 — Node 24 local build verification: DONE, GREEN.** The
   dev machine had only Node v22.16.0 and no version manager, so
   `node@24` (24.16.0) was installed keg-only via Homebrew and the
   spec's gate (`npm ci` + `npm run build`) was run with it — clean
   pass, full route table including `/api/health` as `ƒ` (dynamic).
   The Node-24-only build-break risk the gate exists for is ruled
   out.
2. **Step 5 — commit made on `main`; PUSH HANDED TO LACEY.** `gh`
   is not installed (can't watch the Actions run), and push to
   `main` auto-deploys to production, so the push + CI-watch +
   `curl https://cqip.l-hay.workers.dev/api/health` confirmation
   were left to Lacey per the agreed hand-off. Once pushed: the
   commit touches `app/api/health/route.ts` (non-ignored), so the
   workflow triggers and runs on the new Node-24 `deploy.yml`; the
   smoke check should show `GET /api/health → 200` + the JSON body.

Rollback (per spec §4) if Node 24 breaks the prod deploy: revert
ONLY the `deploy.yml` Node bump (keep `/api/health` — it is
independently shippable and works on Node 20/22 too), push, let it
re-run on Node 20, investigate Node 24 separately before 2026-06-02.

### Azure prereqs verification + docs cleanup — 2026-05-26

Docs-only update bundled atomically with Batch 005.31a. Closes
the long-standing "Azure prereqs gate Batch 009" framing that
had carried in CLAUDE.md + CROSS_CLAUDE.md + the Batch 009
spec since 2026-05-03 (23 days).

- **Reality check.** Lacey ran end-to-end Microsoft Graph
  verification against the CRO SharePoint site:
  - `POST /{tenant}/oauth2/v2.0/token` → 200
  - `GET /sites/fusion92.sharepoint.com:/sites/CRO` → 200 with
    full site metadata
  - `GET /sites/{site-id}/drive/root/children` → 200 with full
    folder + file listing
  All three operations Batch 009 needs are working against the
  current `AZURE_CLIENT_SECRET`. The GET on the app's
  `selectedsites` returned 1, confirming the per-site
  `Sites.Selected` grant on the CRO site is in place — admin
  consent was granted before the original 2026-05-02 Postman
  work (likely by Carl) and has been silently functional ever
  since.
- **The phantom gate.** "SHIP gated on Azure Owner reclaim →
  client secret rotation" entered docs on 2026-05-03 based on
  the assumption that Owner reclaim was required before
  per-site admin consent could be granted. That assumption was
  never re-tested. By 2026-05-26 the framing had propagated to:
  - CLAUDE.md §14 (Planned but not yet shipped)
  - CLAUDE.md §15 "Awaiting external action" (2 items)
  - CLAUDE.md §15 Batch 009 entry (Prerequisites block,
    Priority order line, Open questions)
  - CROSS_CLAUDE.md §5 — formerly §4 before the 2026-05-26
    restructure (2 items)
  - `docs/batch-009-sharepoint-spec.md` (status header,
    §9 Prerequisites, footer)
- **Docs aligned to reality, same commit:**
  - CLAUDE.md §14 SharePoint bullet: added 2026-05-26
    verification note; removed "SHIP gated" line.
  - CLAUDE.md §15 "Pending rotations": Owner reclaim bullet
    deleted; secret rotation reworded as Carl-executable
    hygiene per spec §7, explicitly non-blocking.
  - CLAUDE.md §15 Batch 009: status line updated; old
    "Prerequisites (Azure side)" block replaced with
    "Azure setup (verified 2026-05-26)" summary.
  - CLAUDE.md §15 Priority order: timestamp bumped to
    2026-05-26; Batch 009 annotated "build path clear."
  - CLAUDE.md §15 Open questions: admin-consent question
    marked resolved.
  - CROSS_CLAUDE.md restructured (provided by Lacey),
    finalized in commit e7386e6: a new §2 CC-namespace
    holds **CC1-CC8** — CC1-CC7 promote the seven
    2026-05-11/12 handoff conventions to a numbered
    namespace, and CC8 covers §6 entries on status flips.
    Three rules originally proposed for the CC-namespace
    (stale-status re-verification, last-verified
    timestamps, blocker reality-check) were moved to DC
    CLAUDE_RULES.md local as **R19/R20/R21** per AC's
    namespace-fit review — the failure modes are
    DC-asymmetric. Section numbering settled at: §3
    Contract Surfaces, §4 Pending Rotations, §5
    Cross-Project Priority Order, §6 Append-Only Event
    Log. Owner reclaim bullet deleted from §4; Azure
    secret rotation reworded as Carl-executable hygiene;
    CQIP_BRANDS_API_TOKEN bullet unchanged; §3 contract
    surfaces gained Last-verified fields. New §6 event-log
    entry covers the verification for AC's benefit.
    (An intermediate restructure in commit 78220a0 briefly
    used a CC1-CC11 shape with rotations at §5; e7386e6
    superseded it.)
  - `docs/batch-009-sharepoint-spec.md`: status header
    cleaned; §9 Prerequisites replaced with verification
    evidence; footer cleaned.
- **Rule 32 added** (CLAUDE.md §13). Codifies that §15 items
  carrying a "gated on X" / "pending external action" tag
  past day 7 must be re-verified before being treated as
  still-blocking. Names this incident (23 days) and the
  2026-05-07 drought-evaluator silent failure (7 days) as
  the two reference examples of the failure mode. **Now a
  discoverability hook** — the canonical behavior rule is
  CLAUDE_RULES.md R21 (blocker reality-check), with siblings
  R19 (stale-status re-verification) + R20 (last-verified
  timestamps). Rule 32 was reworked to point at R21 in
  commit #3 (2026-05-26) so the two don't drift; §13 keeps
  the entry for readers who look there first.
- **What did NOT change.** The Azure client secret is still
  in circulation as a hygiene rotation candidate — its
  rotation is Worker-only (no Forge surface today; SharePoint
  proxy isn't shipped, so Forge doesn't hold the value).
  Carl-executable. The CQIP_BRANDS_API_TOKEN hygiene rotation
  is also untouched — different surface, different blast
  radius, still queued. No code change. No migration. No
  CLAUDE.md version bump (no structural change; per §13
  rule 23 the doc-update is the change).

**Lesson worth keeping (codified as §13 rule 32):** an
external blocker tagged at moment T may be resolved by
moment T+1d without anyone updating the docs. The longer
the gap, the more likely the gate is phantom. The fix is
cheap — a few minutes of verification — but only happens if
the rule says "verify on re-encounter." Memory of the
original blocker is a poor proxy for the current state of
the blocker.

### Batch 005.31a — Auto-deploy build-secret hotfix — 2026-05-26

Hotfix to Batch 005.31. Pass `SUPABASE_SERVICE_ROLE_KEY` to the
GitHub Actions build step. The first `workflow_dispatch` run of the
new deploy workflow failed at "Collecting page data" because admin
route modules eagerly import `supabaseAdmin` from
`lib/supabase/server.ts`, which throws on missing service-role key
at module-eval time. The Worker runtime already had the secret via
`wrangler secret put` (TODO: lacey to verify via `wrangler secret
list` — `needs_review` until confirmed); this batch closes the
build-time gap so the GH Actions run can complete the
`opennextjs-cloudflare build` step. See `deploy.yml` header
comment for the now-complete secrets list.

- **GH Actions secret added:** `SUPABASE_SERVICE_ROLE_KEY` added
  to repo Actions secrets (Settings → Secrets and variables →
  Actions).
- **`.github/workflows/deploy.yml`:** env block on the
  build/deploy step now passes `SUPABASE_SERVICE_ROLE_KEY`
  through from the repo secret. Header comment rewritten — the
  "Required repo secrets" list now includes service-role with an
  explicit note that it is needed at BOTH build (page-data
  collection) AND runtime (Worker), correcting the misleading
  prior phrasing that bucketed it under "Runtime-only secrets".
- **CLAUDE.md §13 rule 31** added: GitHub Actions workflow edits
  do not trigger themselves (paths-ignore covers `.github/**`).
  After editing `deploy.yml`, use workflow_dispatch from the
  Actions tab to test. Captures the gotcha that surfaced on the
  005.31 first-run debug loop.
- **Why this is a separate batch:** 005.31's spec listed only 4
  build-time secrets. Adding a fifth wasn't a code regression; it
  was an audit gap surfaced only when the workflow actually ran.
  Split out so the fix has its own commit and §16 entry, and so
  the build-time-vs-runtime distinction is documented once in a
  place future-DC can find it.

**Why not bundled into 005.31:** 005.31 had already shipped to
`main` and the workflow had successfully validated everything
except the page-data collection step (which only fires under a
real build, not under `npm run build` locally with `.env.local`
populated). The build-time gap was a separate audit defect, not a
regression of the 005.31 design.

### Batch 005.31 — GitHub Actions auto-deploy to Cloudflare Workers — 2026-05-22

Closes the deploy gap that surfaced between 2026-05-19 and 2026-05-22.
CLAUDE.md §2 has claimed "auto-deploy on push to main" since v1, but
the workflow file never actually existed. Three batches shipped to
main during the gap (Phase 3 on 2026-05-20, Batch 005.28 on 2026-05-20,
Batch 005.29 earlier 2026-05-22) without reaching production. Lacey
ran a manual `npm run deploy` 2026-05-22 to catch the Worker up to
commit ea12fb9; this batch makes the deploy permanent so future
commits don't drift again.

- **New file `.github/workflows/deploy.yml`**:
  - **Trigger:** `push` on `main` plus `workflow_dispatch` for
    manual / first-run triggering from the Actions tab.
  - **paths-ignore:** `**.md`, `docs/**`, `.github/**`. Docs-only
    commits (e.g. CROSS_CLAUDE.md updates, CLAUDE.md edits without
    a code change) skip the deploy entirely. The `.github/**` entry
    means edits to the workflow file itself don't trigger a deploy —
    use workflow_dispatch to test workflow changes.
  - **Concurrency:** `group: deploy-${{ github.ref }}` with
    `cancel-in-progress: true`. If a newer commit lands on main
    while an older one is still building / deploying, the older run
    is cancelled and the newer one supersedes it. Saves CI minutes
    and prevents racing deploys.
  - **Permissions:** `contents: read` at the workflow level
    (least-privilege; no GITHUB_TOKEN write access needed for a
    deploy-only workflow).
  - **Steps:** `actions/checkout@v4` → `actions/setup-node@v4` with
    `node-version: '20'` and `cache: 'npm'` → `npm ci` → `npm run
    deploy` under env-injected secrets → smoke check curl against
    `https://cqip.l-hay.workers.dev/login`.
  - **Timeout:** 15 min. The repo's build + opennext + wrangler
    deploy cycle is ~3-5 min today; 15 min is comfortable headroom
    without leaving a stuck deploy hanging.
- **Deploy command choice:** `npm run deploy` (the existing script:
  `opennextjs-cloudflare build && wrangler deploy`) over
  `cloudflare/wrangler-action`. Reason: the workflow ships the same
  artifact via the same command path as Lacey's manual `npm run
  deploy`, so a deploy that works locally works in CI and
  vice-versa. wrangler-action would introduce a second deploy code
  path with its own version-pinning surface — strictly more drift
  risk than reusing the existing script. wrangler reads
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from env
  automatically; no extra flags needed.
- **Required repo secrets** (Lacey adds these per §4 below):
  - `CLOUDFLARE_API_TOKEN` — Workers Scripts:Edit scope
  - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID (also surfaced
    by `npx wrangler whoami`)
  - `NEXT_PUBLIC_SUPABASE_URL` — **build-time critical**
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **build-time critical**
- **Build-time env var discovery (worth keeping):** an audit of
  `NEXT_PUBLIC_` usage at build time surfaced that
  `next.config.ts:3` itself reads `NEXT_PUBLIC_SUPABASE_URL` to
  compute the production CSP (`connect-src` + `img-src` allow the
  Supabase origin). If the workflow ran `npm run deploy` without
  that env set, the build would succeed BUT the resulting Worker
  would ship a CSP missing the Supabase origin — the browser would
  block every Supabase REST + realtime call from the production
  bundle, with no obvious deploy-time error. So both Supabase vars
  must be in the workflow env even though they're Supabase's public
  anon-key (not "secret" in the traditional sense). The middleware
  bundle, the client.ts bundle, and the server.ts bundle all also
  consume these at build time. Runtime-only secrets
  (`JIRA_API_TOKEN`, `CQIP_SYNC_AUTH_KEY`,
  `CQIP_BRANDS_API_TOKEN`, `CQIP_DROUGHT_AUTH_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`, `JIRA_EMAIL`,
  `JIRA_BASE_URL`, `TEAMS_WEBHOOK_URL`) stay on the Worker via
  `wrangler secret put` and are deliberately NOT in the workflow
  env — exposing them as repo secrets would expand the blast
  radius for no reason.
- **Smoke check:** `curl -fsS` against
  `https://cqip.l-hay.workers.dev/login` after a 10s sleep. The
  spec offered `/api/health` as preferred — no such endpoint exists
  today. `/login` is the cheapest reliable 200 (returns the login
  page for unauthenticated users; that's literally its purpose) and
  catches the worst failure modes: Worker not deployed (DNS/404),
  Worker deployed but module-level throw → 500, Worker routing
  broken. The spec's fallback ("use a known-200 URL like the
  /login page") is exactly this path. A dedicated `/api/health`
  endpoint is filed as §15 Ops/deferred backlog — would catch
  Supabase-reachability failures the `/login` check can't.
- **CLAUDE.md §2** Tech Stack row updated — the row claim now
  references the actual workflow file. Honest-rule fix: prior to
  this batch, the row was aspirational; now it matches reality.
- **CLAUDE.md §3** file tree extended with the `.github/workflows/`
  directory.
- **CLAUDE.md §13 rule 30** added documenting the deploy contract.
  Spec phrasing locked: "every push to main that touches application
  code triggers an automated Cloudflare Workers deploy." Captures
  the build-time CSP gotcha so future-DC doesn't have to
  rediscover it.
- **CLAUDE.md §15 Ops/deferred** new line for the `/api/health`
  follow-up (non-gating).
- **Pre-merge verification** (this commit):
  - `npm run build` green; TypeScript clean across changed files.
  - YAML structurally valid (15 sanity checks pass: triggers,
    paths-ignore, concurrency, permissions, steps, env vars,
    smoke check).
  - Lint: zero new findings (the YAML file is ignored by ESLint;
    repo's pre-existing lint baseline at 1190 errors / 37732
    warnings, dominated by the Deno edge functions in
    `supabase/functions/`, is unchanged).
- **Pre-deploy ops (Lacey, post-merge):**
  1. Cloudflare dashboard → My Profile → API Tokens → Create
     Token → "Edit Cloudflare Workers" template (or custom token
     with Workers Scripts:Edit + Account:Read + User:Read).
     Copy the token (only shown once).
  2. Cloudflare dashboard → any zone → right sidebar → copy
     Account ID. Or `npx wrangler whoami` from the cqip directory.
  3. github.com/lacey-griffith/cqip → Settings → Secrets and
     variables → Actions → New repository secret. Add all four:
     `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
     `NEXT_PUBLIC_SUPABASE_URL` (`https://hupklpjruveleaahufmw.supabase.co`),
     `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the anon key from `.env.local`).
  4. Trigger the first run via Actions tab → Run workflow
     manually (workflow_dispatch). Should complete in 3-5 min.
  5. Hard-refresh https://cqip.l-hay.workers.dev/dashboard and
     confirm latest changes are live.
  6. Sanity-check the paths-ignore filter: a follow-up docs-only
     commit (e.g. a CLAUDE.md edit) should NOT trigger the
     workflow. Confirm in the Actions tab.
- **What's deliberately NOT in this batch:**
  - Staging environment / preview deploys — single-environment
    setup; PR-level deploys would need a separate Worker and a
    different routing scheme.
  - Branch protection / required status checks — repo settings
    change, not a code change. Lacey can wire "deploy must pass
    before merge" from the GitHub repo settings if desired.
  - Slack/Teams notification on deploy success/failure — not yet
    wired; the workflow log + GitHub email notifications are the
    signal for now.
  - Rollback automation — manual rollback via `wrangler` rolling
    back to a prior version remains the v1 plan.
  - `/api/health` endpoint — see §15 Ops/deferred above.
  - Build cache optimization beyond what `actions/setup-node`'s
    npm cache provides.

### Batch 005.29 — Client Request category + 6 client-change-request subtypes — 2026-05-22

Additive follow-on to Batch 005.28. Closes a usability gap surfaced
post-005.28 ship: `Client Request` existed as a Root Cause canonical
(customfield_12905) but had no Issue Category equivalent, so logs
couldn't bucket "client asked for a change" at the top level. Six new
Issue Subtypes capture what KIND of client change drove the rework
(Copy / Image-or-Asset / Link-or-URL / Styling / Layout / Functionality).
No schema change. No data migration. No historical normalization (these
are net-new canonical values; no quality_log has ever held them).

- **Migration 021** — `021_client_request_taxonomy.sql`:
  - 7 directive-authorized rows: 1 Issue Category
    (`Client Request`) + 6 Issue Subtypes
    (`Copy Change Request`, `Image / Asset Change Request`,
    `Link / URL Change Request`, `Styling Change Request`,
    `Layout Change Request`, `Functionality Change Request`).
  - Jira-verbatim strings per N2 Policy A — note the two
    slash-containing subtypes carry spaces both sides of the
    slash, matching Jira's actual option spelling unlike most
    other slash-containing options in this taxonomy.
  - Sort orders: Category 100/110, Subtype 390-440 (continues
    the migration 020 sequence in steps of 10).
  - Fully idempotent via `ON CONFLICT (field_name,
    canonical_value) DO NOTHING` against migration 020's
    unique index.
- **`docs/qa-field-reference.md`**: new row in Issue Category
  table for `Client Request`; new "Client change requests"
  sub-group at the bottom of the Issue Subtype section with
  the 6 new entries.
- **`app/dashboard/docs/qa-fields/page.tsx`**: inline JSX
  mirror updated identically (per the existing docs-hub
  pattern; no MDX/runtime fetch).
- **Verification**: `npm run build` green. Counts at deploy
  time will be: issue_category=11 (10 directive + 1 placeholder
  — see below), issue_subtype=44, root_cause=14,
  resolution_type=9. Total 78 active taxonomy rows.

**⚠ UNANNOUNCED ADDITION FLAGGED FOR DC + LACEY REVIEW**

The 2026-05-22 re-fetch surfaced an 8th net-new option in Jira's
Issue Category list that was NOT in this batch's directive:
`Base: New Account Support` (position 10 in Jira's return, just
before `Client Request` at position 11). Three options were on
the table when this was discovered:

1. **Skip seeding it.** Would leave it as drift — webhook writes
   carrying this value would land in `quality_logs` but any
   subsequent admin edit on the row would fail
   `/api/logs/edit` validation (§13 r29 server-side check).
2. **Seed with a confident description.** Would require guessing
   what the option means without context. R11 prohibits that.
3. **Seed with a clearly-marked placeholder description.**
   Validates correctly; flags the row in-text for follow-up.

Picked option 3. The row is seeded in migration 021 with
`canonical_value = 'Base: New Account Support'`,
`is_active = TRUE`, `sort_order = 100`, and a description that
starts with `PLACEHOLDER —` and explicitly calls out the
out-of-scope status. The dialog dropdown will show this
description until DC + Lacey replace it via SQL UPDATE (the same
admin-SQL workflow used to add taxonomy rows pre-5.29 UI).

If the option was added by mistake and should be backed out:
`UPDATE quality_log_taxonomy SET is_active = FALSE WHERE
field_name = 'issue_category' AND canonical_value =
'Base: New Account Support';` and remove from Jira. The
deactivation path doesn't break existing rows; it just hides
the option from new selections in the edit dialog.

**What's deliberately NOT in this batch:**
- "Other" catch-all subtype — explicitly rejected by DC; free-text
  notes capture the rare cases.
- Any change to the normalize-quality-log-fields.ts script — net-new
  values don't have historical drift to normalize.
- Admin UI for managing `quality_log_taxonomy` (still backlog 5.29).
- Resolving the `Base: New Account Support` placeholder
  description (DC + Lacey side, follow-up SQL).

### Batch 005.28 — Taxonomy hardening + normalization + docs hub — 2026-05-20

Implements Option B from the 2026-05-20 root cause audit
(`docs/root-cause-audit-2026-05-20.md`). Closes the free-text
drift hole on the 4 multi-select fields
(`issue_category`, `issue_subtype`, `root_cause_*`,
`resolution_type`). Migration + schema + script + dialog refactor
+ server validation + worklist UI + docs hub, atomically.

- **Migration 020** — `020_quality_log_taxonomy.sql`:
  - New `quality_log_taxonomy` reference table
    (`field_name` CHECK-constrained to the 4 taxonomy fields,
    `canonical_value`, `description`, `is_active`, `sort_order`,
    `created_at`, `updated_at`). Unique on
    `(field_name, canonical_value)`; partial index on
    `(field_name, sort_order)` where `is_active = TRUE`.
  - New `quality_logs.needs_review BOOLEAN NOT NULL DEFAULT FALSE`
    column + partial index where TRUE. `COMMENT` documents the
    flag lifecycle (set by normalization, cleared by edit-dialog
    save).
  - RLS: SELECT open to authenticated; no INSERT/UPDATE/DELETE
    policies — additions land via SQL editor with service-role.
  - Seed: 61 rows total (9 / 38 / 14 / 9) from a fresh live Jira
    fetch on 2026-05-20. Strings are Jira-verbatim per N2
    Policy A — including the inconsistent `X/ Y` spacing on
    several options (e.g. `Process/ Communication`,
    `Missing Assets/ Info`, `CSS/ Styling Issue`). The dialog
    dropdown renders these unmodified so values stay aligned
    with what Jira fires via webhook.
  - Fully idempotent (`IF NOT EXISTS` + `ON CONFLICT DO NOTHING`
    on seed rows). Re-running is a no-op.
- **Normalization script**:
  `scripts/normalize-quality-log-fields.ts`. Hand-coded
  `FIELD_MAPPINGS` object mirrors
  `docs/root-cause-taxonomy-mapping.md` (DC + Lacey-resolved
  variant→canonical map). Modes:
  `--dry-run` (report only) · default (prompt
  `"Type 'yes' to proceed"`) · `--yes` (skip prompt).
  Idempotent. Per-row audit_log rows with
  `target_type='quality_log'`,
  `changed_by='system:normalize-quality-log-fields'`,
  plus a dedicated `field_name='needs_review'` row when the
  normalizer flagged a row. Per-element handling for arrays:
  canonical values pass through; legacy values map mechanically;
  Interpretation C defaults set `needs_review = TRUE`;
  cross-field pollution removes the element entirely and flags
  the row.
- **MultiCombobox primitive**: new `components/ui/multi-combobox.tsx`
  — searchable multi-select with pill display below the trigger.
  Sibling to the existing single-select `Combobox`. Used by the
  edit dialog; reusable for future multi-select needs.
- **Edit dialog refactor**: `components/logs/edit-log-dialog.tsx`
  loses its free-text `<Input>` for `root_cause_final` (the
  audit's call-out as the live drift source). Replaces it with
  4 `MultiCombobox` instances — `issue_category`,
  `issue_subtype`, `root_cause_final`, `resolution_type` —
  sourced from a single taxonomy fetch cached for the dialog's
  lifetime. `root_cause_initial` remains frozen per §13 r3 and
  is intentionally not edited here. Dialog header surfaces a
  "Needs review — saving clears the flag" pill when the row is
  flagged. Save propagates the new fields through to
  `EditableLog` and clears `needs_review` locally to keep the
  worklist count in sync without a refetch.
- **`EditableLog` interface** extended with `issue_category`,
  `issue_subtype`, `resolution_type`, `needs_review`. `LogEntry`
  on `/dashboard/logs` mirrors the additions and the page's
  Supabase select adds the four new columns.
- **Server-side validation**
  (`app/api/logs/edit/route.ts`):
  - `ALLOWED_FIELDS` extended to include the four new editable
    columns.
  - New `TAXONOMY_VALIDATION` map drives a per-field validation
    pass against `quality_log_taxonomy` (service-role lookup so
    RLS doesn't gate it). Submitted values not in the active
    taxonomy return 400 with
    `"Value 'X' not found in canonical taxonomy for field 'Y'.
    Pick from the dropdown."` — defense in depth against stale
    browser bundles or direct API callers.
  - On every successful save the route reads the pre-update
    `needs_review` state. If TRUE, the save additionally sets
    `needs_review = false` and emits a dedicated audit_log row
    with `field_name='needs_review'`, `old_value='true'`,
    `new_value='false'`, attributing to the admin via
    `getChangedBy()` per §13 r19. The edit IS the review
    decision per Interpretation C.
- **Worklist UI** on `/dashboard/logs`:
  - "Needs review" pill in the existing filter pill row,
    separated from date presets by a thin divider. Defaults
    OFF — Lacey explicitly opts in. Label includes count when
    `> 0` (e.g. `Needs review (15)`); count derives from a
    `useMemo` over `logs` (no separate query — `loadData`
    already fetches every non-deleted row via the existing
    `.range(0, 9999)` pattern). When `count = 0` AND filter
    is ON, the row-count slot reads
    `All caught up — no reviews pending`.
  - Row-level badge near the ticket link (collapsed view):
    `✏️ review` in `--pill-amber-*` tokens. Clickable for
    admins (opens the edit dialog targeted at the first
    `needs_review` entry in the group); informational only
    for read-only users. Expanded entry rows render a
    smaller `✏️` badge next to the entry's `#log_number`.
  - `resetAllFilters()` and the active-filter count both
    pick up the new filter slot.
- **Docs hub page**: new
  `app/dashboard/docs/qa-fields/page.tsx`. Inline JSX
  rendering of `docs/qa-field-reference.md`'s content
  (project has no MDX/remark setup; matches the existing
  `/dashboard/docs` pattern). Sections: Identification,
  Classification, Analysis, Resolution, Ownership. Anchor-
  linked TOC at the top. Taxonomy fields render as actual
  HTML `<table>` elements with Jira-verbatim canonical
  values + descriptions. Accessible to all authenticated
  users. The existing `/dashboard/docs` page gains an
  "Open QA Field Reference →" CTA button.
- **`docs/qa-field-reference.md`** canonical-list tables
  updated to Jira-verbatim per N2 (`Process/ Communication`,
  `Missing Assets/ Info`, `CSS/ Styling Issue`, etc.).
  Prose around the tables keeps human-readable spacing for
  copy quality. `Targeting / Audience` removed from Issue
  Category (it was removed from Jira along with
  `Analytics/ Tracking` and `Design/ Visual`); the §6 plan
  named one of the wrong removals — actual change confirmed
  via re-fetch). The new subtype `OS or Device Updates`
  spelled with trailing `s` per Jira.
- **`docs/root-cause-taxonomy-mapping.md`**: variant tables
  populated by Claudette earlier in the session (commit
  `88f1c2e`). DC + Lacey resolved N1-N4 questions same day;
  document updated with Jira-verbatim canonical strings
  throughout.
- **N3 reconciliation**: §6 of the Option B directive named
  "Incorrect Traffic Allocation" as a removal from Issue
  Category but that value was always in Issue Subtype. Actual
  Issue Category removals (verified via fresh Jira fetch):
  `Analytics/ Tracking`, `Design/ Visual`, `Targeting/ Audience`.
  Added: `External Factor`. Net 11 → 9. Issue Subtype goes
  35 → 38 (only adds, no removes). Root Cause goes 10 → 14
  (5 adds, 1 remove). Resolution Type unchanged at 9.
- **§13 r29 added** documenting the constrained-dialog
  contract and the `needs_review` clear-on-save semantics.
- **§15 backlog**: new item 5.29 (Taxonomy admin UI) — when
  Lacey adds a Jira option today she also has to run a SQL
  INSERT on `quality_log_taxonomy`; the admin UI would
  collapse that to a click. Deferred from this ship so the
  table could land first.
- **Verification**: `npm run build` green. TypeScript clean
  across changed files. Lint pass introduces zero new
  findings; the 4 pre-existing
  `react-hooks/static-components` errors in
  `app/dashboard/logs/page.tsx` (`SortableHeader` /
  `SortIcon` inner-function pattern, same shape as
  Coverage's pre-existing 8) are on HEAD before this batch
  and out of scope.
- **What's deliberately NOT in this batch**:
  - `root_cause_initial` is NOT editable through the dialog
    (frozen at creation per §13 r3 — by design, not a gap).
  - Admin UI for managing `quality_log_taxonomy` rows
    (5.29 — backlog).
  - Taxonomy versioning / history (not yet needed; YAGNI).
  - Bulk worklist actions (mass-clear, mass-reassign) — the
    per-row edit dialog is sufficient at the 49-row scale we
    have today.
- **Pre-deploy ops checklist** (after this commit lands):
  1. Run migration 020 via Supabase dashboard SQL editor
  2. Confirm row counts:
     `SELECT field_name, COUNT(*) FROM quality_log_taxonomy GROUP BY field_name;`
     Expect 9 / 38 / 14 / 9.
  3. `npx tsx --env-file=.env.local scripts/normalize-quality-log-fields.ts --dry-run`
     to preview changes. Expect ~46 of the 49 non-deleted rows to
     change (3 already canonical), ~31 to be newly flagged
     `needs_review`.
  4. Re-run without `--dry-run` to apply (prompts "Type 'yes' to
     proceed"). Confirm summary matches the dry-run.
  5. Open `/dashboard/logs`, toggle the "Needs review" pill,
     confirm flagged rows surface. Edit one of them, save, confirm
     the flag clears and the worklist count decrements.
  6. Visit `/dashboard/docs/qa-fields` and confirm the docs hub
     renders with all sections present.

### Batch 005.22 Phase 3 — Dashboard mount + layout reorder + chart re-scope — 2026-05-20

Second batch in Cluster A. Phase 3 mounts the shared
ProjectBrandFilter on `/dashboard`, reorders the page layout,
re-scopes the four charts to the filter, and polishes the
ActiveAlertsPanel with overflow peek-arrow + height-preserving
empty state. No schema change. No migration. References
Phase 2 commits 7c6dbbe / 8b7e4bd / 1550ff3.

- **Layout reorder** (`app/dashboard/page.tsx`). Final
  top-to-bottom: header card (unchanged) → Active Alerts
  Panel (promoted) → KPI strip (demoted) → ProjectBrandFilter
  (new mount) → charts grid (unchanged) → drawers. The order
  groups incident-flavored signal (active alerts) above
  scoreboard signal (KPIs), then puts user-controlled scope
  (filter) immediately above the scoped views (charts).
- **Two new data fetches** added alongside the existing
  monthLogs / allLogs / openLogs fetches inside
  `fetchDashboardData`:
  - `projects` — `jira_project_key, display_name, brand_model`
    where `is_active = TRUE`.
  - `brands` — `id, project_key, brand_code, jira_value,
    display_name, is_paused` where `is_active = TRUE`.
  Both throw on error so the existing loading/error gate
  surfaces partial failure. Mirrors Coverage's pattern from
  Batch 005.22 Phase 2.
- **Filter state mount**: new `filter` slot of type
  `FilterValue`; `ProjectBrandFilter` mounted between the KPI
  strip and the charts grid with `storageKey="cqip-filter-dashboard"`.
  `showPaused` prop deliberately omitted — Dashboard hides
  paused brands; only Coverage opts in to surfacing them (per
  the Phase 2.1 polish round 1 lock).
- **Chart aggregation refactor** — the four chart datasets
  were previously computed imperatively inside
  `fetchDashboardData` and pushed via `setCharts(prev => ...)`.
  That structure couldn't re-derive on filter change. Phase 3
  drops the `charts` state slot and the `ChartData` interface
  entirely; each of `volumeByWeek`, `issueCategory`,
  `severityDistribution`, `rootCauseFrequency` is now a
  `useMemo` over a new `scopedChartLogs` memo. Filter changes
  re-derive without a refetch.
- **scopedChartLogs**: `useMemo<DashboardLog[]>` that filters
  `chartLogs` by `filter.projectKeys` AND
  `filter.brandCodes`. Empty filter arrays short-circuit
  return the source array (Variant A contract). Brand code
  is derived via `extractBrandCode` imported from
  `components/dashboard/active-alerts-panel.tsx` — the
  helper was promoted from file-local to a named export to
  keep the contract single-sourced. Its body is unchanged
  (still the Batch 005.25 prefix-agnostic / lossy-safe
  spec).
- **`DashboardLog` type** extended with `project_key: string`
  so the filter can reach the column without a cast. The
  existing `select('*')` on quality_logs already returns the
  field; the type just makes it visible to TypeScript.
- **Chart onClick handlers** switched from
  `chartLogs.filter(...)` to `scopedChartLogs.filter(...)`.
  A drilldown opened after a filter is applied shows scoped
  rows only — e.g. "Week of X" on an NBLY-only filter never
  surfaces SPL tickets.
- **ActiveAlertsPanel overflow peek-arrow**
  (`components/dashboard/active-alerts-panel.tsx`). Pill row
  switched from `flex flex-wrap gap-2` to a single-row
  `overflow-x-auto whitespace-nowrap` container. New
  `pillRowRef` + `canScrollRight` state + ResizeObserver
  effect drives a chevron-right indicator that fades in via a
  fixed gradient over the right edge when pills exceed the
  panel width. Same pattern as the brand row in
  `components/filters/project-brand-filter.tsx`.
- **ActiveAlertsPanel empty state** restructured to share the
  same Card + heading shell as the populated state. Content
  row mirrors pill vertical metric (`px-3 py-1`) so the panel
  height stays constant when alerts toggle between empty and
  non-empty — page below no longer jumps. Phrasing kept
  ("All systems normal — no active alerts").
- **`extractBrandCode` export**. Promoted from file-local to
  named export. Single import site for now (Dashboard); Phase
  4 (Logs filter mount) will be the second.
- **KPI / Active Alerts full-scope confirmation**: both
  surfaces continue to read their own state (kpi from
  monthLogs/openLogs, alerts from `alert_events`) without
  consulting `filter`. This matches the Cluster A boundary
  locked Tuesday: above the filter card = program-health
  view (full scope); below = filter-scoped current view.
- **What's deliberately NOT in this batch**: Phase 4 (Logs
  filter mount), Phase 5 (project + brand create UI
  hardening), Reports filter mount, audit page filter mount,
  ActiveAlertsPanel filter-awareness (Tuesday-locked
  full-scope), KPI re-scoping (Tuesday-locked full-scope),
  any schema or migration, any FilterValue shape change,
  relocation of `extractBrandCode` out of
  `active-alerts-panel.tsx`, codification of the
  sessionStorage convention as a §13 rule (deferred —
  Phase 3 is the second mount; revisit once Phase 4 ships
  for a third data point).
- **Verification**: `npm run build` green; TypeScript clean.
  Lint pass introduces zero new findings; the pre-existing
  `(props: any)` error on `renderActiveCategory` and the
  three pre-existing unused-import warnings in
  `active-alerts-panel.tsx` (Badge, getSeverityVariant,
  describeBrandAlert) are all on HEAD before this batch
  and out of scope.

### Batch 005.22 Phase 2.1 polish round 1 — pill redesign + UX trim — 2026-05-19

Same-day follow-up to 8b7e4bd. Five UX adjustments from
Lacey's second visual test pass. All component-internal
except the Coverage page wiring one new prop. No schema,
no migration, no shape changes to FilterValue. Proposed
batch number 005.27 (continuing the Phase 2 sequence) —
Lacey may renumber on ship.

- **Fix 1 — Paused brands behind a prop**: refactored the
  hard "always hide paused" behavior from 8b7e4bd into an
  opt-in `showPaused?: boolean` prop (default false). When
  the prop is false, paused brands are excluded from the
  pickable pool just like the previous behavior. When true,
  they appear in the brand row with a visible "paused"
  treatment (dashed border + 0.7 opacity, both selected and
  unselected variants — see Fix 5 for the token wiring).
  Coverage wires this prop from its existing local
  `showPaused` state. Phase 3 / Phase 4 mounts leave the
  prop off — paused brands stay hidden everywhere except
  the Coverage page where the user has explicitly opted in.
- **Fix 2 — Single-brand row skip** stays as shipped in
  8b7e4bd. No code change in this round; verified the
  refactored `pickableBrands` derivation still excludes
  single-brand projects unconditionally (single-brand
  projects don't get a per-brand filter affordance under
  any prop value).
- **Fix 3 — Select all without count**: the ghost pill in
  the brand row now reads `Select all` / `Clear all` —
  the trailing `N` is dropped from the visible label. The
  three-state behavior (none → select all in pool; some →
  fill in the rest; all → clear) is unchanged. The count
  survives in the pill's `aria-label`
  (`Select all 16 brands` / `Clear all 16 brands`) so
  screen-reader users still hear the population size.
- **Fix 4 — Status line removed, Clear relocated**: the
  former `Filtering to: NBLY (MDG, MOJ) · Clear` line is
  gone entirely. The `Clear` affordance moved to the right
  edge of the project pill row, rendered only when
  `hasAnyFilter` is true. Phrasing is just `Clear` —
  text-orange, hover-underline, no surrounding text. A
  visually-hidden `aria-live="polite"` region (the existing
  sr-only pattern) replaces the status line for assistive
  tech: `Filter updated. N projects, M brands selected.`
  on every value change; `Filter cleared.` when the filter
  goes empty. Less visual noise; same accessibility.
- **Fix 5 — Pill redesign (Option F)**: project + brand
  pills now use a navy-ghost ↔ orange-solid identity instead
  of the previous transparent-with-orange-border ↔
  orange-solid pair. Five new CSS tokens in
  `app/globals.css`, per-theme:
  - `--pill-filter-bg` — unselected fill. Light mode
    `rgba(30, 45, 107, 0.08)`; dark mode
    `rgba(30, 45, 107, 0.35)`.
  - `--pill-filter-bg-hover` — slightly stronger tint on
    hover (`+0.06` opacity each mode).
  - `--pill-filter-fg` — unselected text. Light mode
    `#1E2D6B` (navy); dark mode `#B5D4F4` (light-blue ramp
    for legibility against the dark surface).
  - `--pill-filter-paused-border` — dashed-border color for
    unselected paused pills. Light:
    `rgba(30, 45, 107, 0.35)`; dark:
    `rgba(181, 212, 244, 0.4)`.
  - `--pill-filter-selected-paused-border` — dashed-border
    color for selected paused pills. `rgba(255,255,255,0.5)`
    in both modes (defined in `:root`; dark inherits).
  Selected pills are unchanged: `var(--f92-orange)` fill,
  `text-white`, `hover:brightness-95`. Per §13 rule 25, no
  inline hex in JSX — all colors land through these tokens.
  WCAG AA verified on both themes against the Coverage card
  surface. Implementation lives in a local `pillClass()`
  helper inside the component, called by both project and
  brand pill render paths so the paused / selected variants
  stay consistent.
- **Hydration prune respects showPaused**: the post-hydrate
  prune effect now keys off `pickableBrands` (the showPaused-
  aware derivation) instead of recomputing a "valid codes"
  set independently. When `showPaused=false` a paused
  brand's code gets pruned; when `showPaused=true` it's
  preserved. Same convergence guarantee (≤2 ticks, only
  calls onChange when length differs from value). Mid-session
  effect: toggling Coverage's showPaused while filter codes
  are populated either drops or restores affected codes
  automatically on the next render.
- **The "Brand row visibility" gate** was tightened from
  `value.projectKeys.length > 0` to `value.projectKeys.length
  > 0 && (poolCodes.length > 0 || grouped.length > 0)` so a
  single-brand-only selection (e.g. SPL alone) renders no
  empty brand row — was a small visual regression in the
  previous shipping pass.
- **Coverage page wiring** (`app/dashboard/coverage/page.tsx`):
  one prop addition (`showPaused={showPaused}`). No other
  Coverage-side changes. The 8b7e4bd `singleBrandProjectKeys`
  exemption in `visibleRows` stays in place — Jenny
  endorsed it last round and it remains correct here.
- **What's NOT in this batch**: Phase 3/4/5 mounts,
  FilterValue shape changes, any schema or migration,
  any change to KPI scope (still locked: KPIs stay
  full-scope program-health view).
- **Verification**: `npm run build` green; TypeScript +
  ESLint clean across the changed files. Pre-existing 8
  `react-hooks/static-components` lint errors in
  `coverage/page.tsx` (`SortableHeader` / `SortIcon`
  inner-function pattern) still out of scope.

### Batch 005.22 Phase 2.1 — Paused-brand hide + single-brand row skip — 2026-05-19

Same-day follow-up to Phase 2 (commit 7c6dbbe). Two findings
from Lacey's visual test pass against /dashboard/coverage,
plus one corner-case fix surfaced during the implementation.
Proposed batch number 005.26 (continuing Phase 2's
proposal) — Lacey may renumber on ship.

- **Fix 1 — Paused brands hidden from filter**:
  `ProjectBrandFilterBrand` interface gains
  `is_paused: boolean`. New `pickableBrands` memo at the
  top of derived state filters `brands` to non-paused
  brands AND brands not belonging to a single-brand project
  (covers Fix 2 in the same derivation). `brandPool`,
  `grouped` (via brandPool), and `toggleProject`'s
  still-reachable lookup all consume `pickableBrands`. The
  "Select all N" count and three-state derivation therefore
  reflect the pickable population, not the full brands array.
  Auto-recovery: when a brand is unpaused via
  `/dashboard/settings/coverage`, the next Coverage refetch
  re-derives pickableBrands and the brand pill returns
  without explicit invalidation.
- **Fix 2 — Single-brand projects skip the brand row**:
  `ProjectBrandFilterProject` interface gains `brand_model`.
  `singleBrandProjectKeys` set is built from `projects` and
  consumed by `pickableBrands` (single-brand projects'
  brands are excluded from the pool entirely). A
  single-brand project can still be picked as a project pill,
  but its brand has no pill to toggle. If only single-brand
  projects are selected the brand row doesn't render at all
  (pool is empty → `value.projectKeys.length > 0` gate still
  shows the row, but the `poolCodes.length > 0` gate hides
  the "Select all N" pill and `grouped` is empty). Mixed
  selection (NBLY + SPL) renders NBLY's brand group only.
- **Status line phrasing updated** per Lacey-locked spec
  (option A, comma separator):
  - Multi-brand project, no brand selection: `NBLY`
  - Multi-brand project, brand selection: `NBLY (MDG, MOJ)`
  - Single-brand project: `SPL` (no parens regardless of
    brandCodes state; project IS the filter)
  - Two projects: `NBLY (MDG, MOJ), SPL`
  - Project-entry separator changed from ` · ` to `, ` in
    the JSX join.
  - Status lookup keeps the raw `brands` prop (not
    `pickableBrands`) so a brand selection made just before
    a brand was paused still renders its label in the status
    line — prevents in-flight UI from going blank during a
    pause race.
- **Hydration-time prune effect** (new): after `didHydrate`
  flips and once `brands` / `projects` arrive, the effect
  drops any `brandCodes` whose only home is now non-pickable.
  "Non-pickable" = paused, OR belongs to a single-brand
  project, OR belongs to a project no longer in `projects[]`.
  Convergent in at most two ticks (prune triggers onChange,
  next render re-runs the effect as a no-op once value
  matches the valid set). Same effect also serves as
  ambient cleanup mid-session when a brand pauses /
  unpauses or a project deactivates.
- **Corner-case fix in Coverage's visibleRows** (deviation
  from Phase 2.1 spec assumption — flagged here): the
  kickoff stated "no filtering-logic change needed" because
  single-brand projects would have empty brandCodes. That
  holds when a single-brand project is the ONLY selection.
  In the mixed case (e.g., user picks NBLY brands + SPL),
  `brandCodes` is populated by the NBLY selection AND SPL's
  brand_code is NOT in it, so the original
  `brandCodes.includes(r.brand.brand_code)` check would have
  silently hidden the SPL row. Fix: build a
  `singleBrandProjectKeys` set on the Coverage page and
  short-circuit the brandCodes check for any row whose
  project is single-brand. Three-line change in the
  `filteredByProjectBrand` step. Without this, picking
  NBLY+SPL with any NBLY brand subset would have hidden
  SPL — direct contradiction of user intent.
- **Coverage projects query**: `app/dashboard/coverage/page.tsx`
  `refetchAll()` select string for `projects` adds
  `brand_model`. `ProjectRow` interface gains the field.
- **What's deliberately NOT in this batch**: Phase 3/4/5
  mounts, FilterValue shape changes, `lib/coverage/queries.ts`
  changes, any schema change, status-line styling, KPI
  rescoping (still locked: KPIs stay full-scope).
- **Verification**: `npm run build` green; TypeScript clean
  across the changed files. Pre-existing 8 `react-hooks/
  static-components` lint errors in `coverage/page.tsx`
  (the `SortableHeader` / `SortIcon` inner-function pattern)
  still out of scope and predate this batch — same
  background as the Phase 2 ship.

### Batch 005.22 Phase 2 — Shared project+brand filter + Coverage mount — 2026-05-19

First batch in Cluster A (Phases 2-5 of 005.22). Phase 2 builds
the shared multi-select project + brand filter and mounts it on
`/dashboard/coverage`. No schema change. No migration. Proposed
batch number 005.26 — Lacey may renumber on ship.

- **New shared component**:
  `components/filters/project-brand-filter.tsx`. Client component;
  the parent owns state via `value` / `onChange`. Persists the
  latest value into `sessionStorage` under a per-mount
  `storageKey` (Coverage uses `cqip-filter-coverage`). Hydrates
  from storage on mount via a `didHydrate` ref so the initial
  empty-array props never overwrite saved state. Defensive
  validation on read: must be an object with `projectKeys[]` +
  `brandCodes[]` of strings; anything else is ignored.
  `FilterValue` shape locked: `{ projectKeys: string[];
  brandCodes: string[] }`. Empty arrays = implicit all (Variant A,
  locked with Lacey — no explicit "ALL" pill).
- **Visual treatment**:
  - Project row labeled `Project` (uppercase eyebrow); pills use
    the existing CQIP convention from `/dashboard/logs` —
    rounded-full, orange-filled when active with a Check icon,
    transparent + border when inactive.
  - Brand row labeled `Brand`, visible only when ≥1 project is
    selected. Horizontally scrollable; chevron-right indicator
    fades in via a fixed gradient when scroll overflow is
    detected (ResizeObserver + scroll listener on the row).
  - "Select all N" three-state ghost pill (dashed border, tint
    fill) at the start of the brand row: `none → select all`,
    `some → fill in the rest`, `all → clear all`. Pool count
    derives from the brands reachable under the current project
    selection.
  - When 2+ projects are selected, brand pills are grouped by
    project with small project-code dividers (uppercase tracking
    badges) matching the brand-chip style used in the Coverage
    table.
  - Status line below the pills (`aria-live="polite"`):
    `Filtering to: NBLY (MDG, MOJ) · Clear` — renders only when
    at least one filter is active. Project short codes are
    derived by stripping the trailing `CRO` suffix from
    `jira_project_key`, falling back to the raw key for projects
    that don't end in CRO.
  - All pill colors via existing F92 tokens (no inline hex per
    §13 rule 25). `aria-pressed` reflects selection state on
    every pill button.
- **Stale-code cleanup on project deselection**: when a project
  is toggled off, any brand codes whose only project_key was
  the dropped project are removed from `brandCodes`. Codes that
  also live in another still-selected project (defensive — not
  observed today but possible if multiple clients share a code
  in the future) are preserved.
- **Coverage page wiring** (`app/dashboard/coverage/page.tsx`):
  - `brands` select string adds `project_key`.
  - New `projects` query (`jira_project_key, client_name,
    display_name` where `is_active = TRUE`) added to
    `refetchAll()` alongside brands / milestones / logs; partial
    failure surfaces in the same `failures[]` error array.
  - New `filter` state slot of type `FilterValue`.
  - `<ProjectBrandFilter storageKey="cqip-filter-coverage" ... />`
    mounted ABOVE the existing sticky filter card so the
    project/brand controls are positioned as the primary scoping
    affordance.
  - `visibleRows` memo adds a `filteredByProjectBrand` step
    BEFORE the existing `showPaused` filter; `filter` added to
    the memo deps.
- **KPI / filter boundary (locked, reused in Phase 3+)**:
  `crossBrand` and `deliveredCards` continue to compute from
  the full `milestones` array regardless of filter. Above the
  filter card = program-health view (full scope); below = filter-
  scoped current view. Coverage table re-scopes; KPIs do not.
  This boundary was locked with Lacey in the Cluster A scope
  session and applies to all future filter mounts (Phase 3
  Dashboard, Phase 4 Logs).
- **`lib/coverage/queries.ts`** `Brand` interface gains a
  non-nullable `project_key: string` field. Mirror update on
  `/dashboard/settings/coverage` page's local brands fetch:
  the select string adds `project_key` so the `as BrandWithQa[]`
  cast stays honest (preserves the "no `as Brand` fib" comment
  intent from Batch 004.5).
- **Pattern decision (deferred, not codified yet)**: §13 rule
  for "page filters persist via sessionStorage with per-page
  keys" was considered but skipped — this is the first mount
  and not yet enough data points to lock a rule. Decision
  revisited at Phase 3 ship.
- **What's deliberately NOT in this batch**: Phase 3
  (Dashboard mount), Phase 4 (Logs mount), Phase 5 (project +
  brand create UI hardening), Reports filter mount, audit page
  filter mount, active alerts panel changes, any KPI re-scoping
  (locked: KPIs stay full).
- **Verification**: `npm run build` green; TypeScript clean
  across the changed files. Pre-existing lint errors in
  `app/dashboard/coverage/page.tsx` (inner-function
  `SortableHeader` / `SortIcon` flagged by
  `react-hooks/static-components`) are out of scope and
  predate this batch.

### Batch 005.25 — Brand dropdown fix + client_brand normalization — 2026-05-13

Closes 5.19 sweep findings F1 + F2. Half-day batch. No
migration, no schema change.

**Commit 1 (earlier 2026-05-13):** `scripts/normalize-client-brand.ts`
landed and executed. 32 historical quality_logs rows updated
from raw codes (e.g. 'ASV', 'MRR') to canonical brands.jira_value
format ('ASV - Aire Serv', 'MRR - Mr Rooter Plumbing'). 14 rows
already canonical (post-Phase-1 webhook writes). Zero unmatched,
zero ambiguous. Idempotent — re-run produces zero updates. Audit
trail: 32 audit_log rows with changed_by='system:normalize-client-brand'
in a ~4.3s window. Per-row updated_at uses a single batch-marker
timestamp (forensic-friendly).

**Commit 2 (this commit):** Dropdown refactor + verification.

- **New file `components/filters/brand-selector.tsx`** — shared
  brand filter wrapping the existing Combobox. Sources from
  brands table (is_active=TRUE), emits brands.jira_value
  verbatim. Exports canonical sentinel BRAND_SELECTOR_ALL =
  '__all__' so consumers stop redefining local ALL constants.
  Optional projectKey prop is a hook for Batch 005.22 Phase 4
  (project-aware dropdown); unused by 005.25 callers.

- **`app/dashboard/logs/page.tsx`** — replaced the
  useMemo(clientBrands) DISTINCT-derivation pattern with
  <BrandSelector>. SPL (and any future newly-onboarded brand)
  now appears in the dropdown without requiring active
  non-deleted logs. Closes F1 on logs.

- **`app/dashboard/reports/page.tsx`** — same refactor.
  fetchFilterOptions() no longer pulls client_brand from
  quality_logs at all; the latent .limit(500) bug that would
  have silently truncated brand options once quality_logs
  exceeded 500 rows is mooted for brands. (Other filter
  options still flow through that query and remain capped;
  enum-bounded so cap is harmless. Tracked indirectly as
  Phase 4 scope.) Upgrade side effect: reports page now has
  typeahead on the brand filter (was a no-typeahead shadcn
  Select).

- **`components/dashboard/active-alerts-panel.tsx`** —
  extractBrandCode() function body unchanged. Comment block
  expanded to a full contract specification (input/output
  table, prefix-agnosticism guarantee, lossy-safe behavior,
  do-not-add-prefix-logic warning). Per Batch 005.25
  sub-task 6: no test runner exists in this codebase, so
  the contract is locked via documentation. Future edits
  must manually verify against the input table.

- **Verified zero hits** for hardcoded 'NBLYCRO' in
  components/dashboard/log-drawer.tsx and
  components/logs/log-detail-drawer.tsx (per sub-task 7).
  §13 rule 28 cleanup work left these clean; this commit
  confirms.

**Side observations during 005.25:**
- Three different env-loading patterns exist across
  scripts/ (Node --env-file flag, manual fs reads, dotenv
  package). Backlog hygiene item; not addressed here.
- backfill-brands.ts and backfill-milestones.ts do not
  write audit rows. Latent §13 rule 2 cleanup; not
  addressed here, not propagated by the new normalize
  script.

**Pairs with:** Batch 005.22 Phase 4 (Logs filter pills,
backlog) which will add project-aware grouping on top of
this now-clean dropdown via the existing projectKey prop.

### Batch 005.25 scoping — 5.19 sweep closure + Batch 005.25 entry — 2026-05-12

Docs-only commit. Two related changes shipped atomically.

**5.19 closure:** SPL multi-page presence sweep ran
2026-05-12, six surfaces verified. Four PASS, two FAIL
(dropdowns on /logs and /reports), all findings captured
for Batch 005.25 follow-up. Full sweep report appended to
the 5.19 §15 entry. 5.19 marked complete.

**Batch 005.25 scoped:** New §15 entry covers F1 (brand
dropdowns source from quality_logs DISTINCT, excluding
SPL) and F2 (legacy client_brand string duplicates from
pre-Phase-1 data). Five sub-tasks scoped including a
shared component decision and an idempotent backfill
script. Priority order updated: 005.25 lands between 5.19
and 009.

**Context:** SPL's audit log shows soft-deleted historical
quality_logs entries (SPLCRO-107, SPLCRO-108). These were
intentional test-cleanup deletions during Phase 1
verification, not real CRO work. Confirmed with Lacey
2026-05-12. Logged to CROSS_CLAUDE.md for future
reference.

Per §13 rule 23: docs-only commit, no code change.

### Batch 005.24 — Joint cross-project doc + R16/R17 — 2026-05-12

Docs-only commit. Two parts shipped atomically.

**NEW FILE /docs/CROSS_CLAUDE.md:** Joint coordination doc
for DC + AC. Six sections: Roster (DC, AC, Claudette,
agents); Handoff Conventions (7 conventions locked Monday-
Tuesday); Contract Surfaces (brands API live, SharePoint
proxy planned); Pending Rotations (mirrored from DC §15 + AC
§15); Cross-Project Priority Order; Append-Only Event Log
(covers 2026-04-23 forward). Replaces ad-hoc cross-project
state tracking that previously lived in chat memory and
asymmetric DC/AC CLAUDE.md sections.

**R16 + R17 added to CLAUDE_RULES.md** under new section
"Cross-project coordination." R16 codifies push-back on
mirror requests that don't map cleanly to DC's doc shape
(lesson from AC's 2026-05-12 mirror request). R17 formalizes
fetching the joint doc at session start.

**Why now:** AC's 2026-05-12 Phase 1.5 scope shift asked DC
to mirror Forge phasing into DC's CLAUDE.md, but DC's doc
shape doesn't have phase tracking — it describes Dashboard.
Asymmetric mirror requests like this would compound over
time if not addressed structurally. Joint doc + R16/R17
gives cross-project state its own home.

**AC side:** AC endorses the joint doc. AC CLAUDE_RULES.md
not yet drafted; AC will fetch joint doc manually until
AC's R1-equivalent lands. AC will append AC-relevant events
to the log starting with the Phase 1.5 scope shift.

Per §13 rule 23: docs-only commit, no code change.

### Batch 005.23 — §15 restructure + CLAUDE_RULES.md companion — 2026-05-12

Docs-only commit. Two related additions:

**§15 restructure:** "Awaiting external action" reorganized
into named subsections (Forge integration, SharePoint
integration, Pending rotations (live, both sides)). New
rotation item: CQIP_BRANDS_API_TOKEN — hygiene rotation,
not known compromised, lives on three surfaces (Worker,
DC .env, Forge dev + prod). Mirrors AC's parallel §15
restructure on cqip-qa-automation repo earlier today
(2026-05-12).

**CLAUDE_RULES.md companion file:** New file at repo root.
Companion to CLAUDE.md — project context lives in CLAUDE.md,
behavior rules live in CLAUDE_RULES.md. 15 rules covering
session opening, communication, state management, ship
discipline, drift prevention. Drafted Monday 2026-05-11 to
formalize practices that emerged from the cross-Claude
coordination day (drift incident, confabulation incident,
handoff principle development). Will be mirrored AC-side in
a separate Forge-repo commit by AC.

Per §13 rule 23: docs-only commit. No migration, no code,
no schema change. Per handoff convention 6 (cross-project
rule numbering): AC's §13 rules 9 + §12 rule 3 cited as
parallel-not-identical to DC §13 rule 27.

### Batch 005.21 — SharePoint integration groundwork docs — 2026-05-11
Docs-only commit. Records SharePoint integration groundwork
state ahead of Batch 009 design work. No code change, no
schema change, no migration. Per §13 rule 23: docs-only
commits are explicitly called out in the commit message —
this one is `docs: lock SharePoint architecture (Batch 009);
no code change`.

**What this batch captures:**
- §14 entry for SharePoint integration with the Postman
  verification dates (2026-05-02 / 2026-05-03) and Azure app
  identifier
- §15 "Awaiting external action" — two new checkbox lines
  for Owner-access reclaim and client-secret rotation; the
  pre-existing SharePoint line updated to remove the
  Carl-blocking framing now that Postman verification is
  complete
- §15 new Batch 009 entry — placeholder for the SharePoint
  integration batch, with prerequisites, pending decisions,
  and the two decisions actually locked at groundwork time
  (separate token, server-side proxy)
- §15 priority order updated: 006 → 009 → 007 → 008
  (was: 006 → 007 → 008, with 009 unplaced)

**What this batch deliberately does NOT capture:**
- SharePoint proxy endpoint shape (single vs multi)
- Microsoft Graph scope decisions
- Sync vs pass-through semantics
- Write scope for v1
These are real architectural decisions and deferred to the
Batch 009 design session itself. Sunday's claim that "Batch
009 architecture is locked" was overconfident; the only
thing actually locked at that point was the Postman win
plus the two auth-pattern decisions noted above. Recording
that truthfully is the point of this commit.

**Cross-project relay:** AC (Forge-side Claude) is the
downstream consumer of the eventual SharePoint proxy. Per
handoff convention principle 5 (contract-surface changes get
a 1-3 line relay on ship day): the SharePoint proxy contract
does not yet exist — AC continues with placeholder shape in
the Forge architecture doc until Batch 009 design lands.

### v1.0 — Foundation (pre-April 2026)
Initial schema, auth, Jira webhook, dashboard KPIs + charts, logs table,
reports with CSV/XLSX export, saved reports, projects/alerts/users settings,
RLS, CSP, rate limiting, session timeout, soft-delete, grouped logs with
sortable columns, mobile responsive, WCAG accessibility, easter eggs,
docs page, password-gated /array-of-sunshine dossier, Konami code,
logo rainbow, sun→clouds, moon→stars, loading messages, missing-info
tooltip, clean-streak badge, matrix rain, avatar slot machine, admin
badge titles, on-demand Jira sync, batch log deletion, soft-delete
individual log entries with confirm + audit trail, compact dashboard,
avatar photo upload, avatar pattern refresh (migration 007), docs
rewrite with Jira QA tab guide.

### Batch 001 — April 2026
- CSP `img-src` allows Supabase storage origin (photo uploads render)
- Logs page primary ticket label is the Jira summary; ticket ID + brand
  render as a chip below
- Sun-clouds effect: 6 clouds (was 3) + saturated sky tint (0.55 opacity)
- `SyncJiraButton` component shared across Dashboard, Logs, Reports pages
- `easter_egg_stats` table + `increment_easter_egg` RPC (migration 008);
  /array-of-sunshine counts successful unlocks
- F92 multi-pass shimmer easter egg: type `f92` / `fusion92` anywhere, or
  click the F92 atom in the sidebar (inline SVG, transparent bg)
- Admin-only change log viewer at `/dashboard/settings/audit`
- Brand bug diagnostic logging + `scripts/backfill-brands.ts` one-shot
- Logs page Option A refactor: main row columns slimmed to Date, Ticket
  (title + brand chip + ID), Severity, Status, Category, Sendbacks count,
  Actions. Brand and Owner moved into expanded detail. Checkbox column
  + batch-delete selection bar for admins.

### Batch 001.5 — April 2026
- F92 shimmer rebuilt as three explicit layer divs (pseudo-element
  approach wasn't rendering)
- Sunshine counter moved to only fire on successful password unlock
- Three-dot menu replaces inline Edit/Delete buttons on logs page

### Batch 002 — Client Coverage — April 2026
- Migration 009: `brands` + `test_milestones` tables + Client Coverage
  Drought alert rule seed; 16 NBLY brands seeded
- Migration 010: `brand_aliases` table; MRR-CA marked paused at seed;
  historical `test_milestones.brand_id` backfilled via aliases
- `jira-webhook` extended with a milestone branch — first-time entry
  into Dev Client Review inserts a `test_milestones` row (runs in the
  same invocation as the rework branch, independently)
- `scripts/backfill-milestones.ts` — historical Dev Client Review
  milestones; logs unmatched `brand_jira_value` for alias patching;
  uses `/rest/api/3/search/jql` (old `/search` endpoint returns 410)
- `/dashboard/coverage` — KPIs, drought flags, sparklines, brand
  detail drawer, per-column sort, paused-row visual treatment,
  Tests Delivered YTD + All-Time cards, dark-mode sparkline tooltip,
  leadership-ready CSV (title-case headers, drop paused, timestamp row)
- `/dashboard/settings/coverage` — admin pause/unpause brands + manage
  milestones dialog (add/edit/soft-delete; re-add restores soft-deleted
  rows)
- Navigation: Coverage entry in sidebar; sticky-bottom docs + F92 atom;
  staggered cloud entry left-to-right; shooting stars on moon hover;
  Deploy Cowgirl joins admin title rotation
- Dashboard: new "Tests This Week" KPI with week-over-week delta
- Pure helpers extracted for time windows, counts, and coverage rows

### Batch 002.5a/b — Audit generalization — April 2026
- Migration 011: `audit_log.log_entry_id` made nullable;
  `target_type`/`target_id` pair added with CHECK constraint; legacy
  rows back-filled with `target_type = 'quality_log'`
- Migration 012: admin-only INSERT policy on `audit_log` so
  browser-initiated audit writes for milestones + brands land; no
  UPDATE/DELETE policy (append-only from client)
- Deferred audit writes wired for milestone add/edit/delete and brand
  pause/unpause; failed audit writes surface via dev toast
- Coverage freshness: stale-read refetch, dropdown refresh, togglePause
  rollback; pause-brand form awaits submit and surfaces errors
- Long lists (settings, reports) capped with inline scroll

### Batch 003 — Sync diagnostics + branded exports + dashboard drill — April 2026
- `app/api/jira/sync/route.ts` — failure path surfaces actionable errors
  to admin, distinguishes missing env vs. 401 auth mismatch
- `components/dashboard/LogDrawer` — shared click-to-filter drawer;
  dashboard charts (severity bar, issue-category donut, top root-cause
  bar, rework weekly bar) open the drawer scoped to the clicked slice;
  a11y hints + cursor polish for clickable charts
- Log detail drawer opens on title click from the logs page
- Logs table height capped with inline scroll (40rem)
- F92 shimmer rewritten as a single diagonal sweep with blur
- Clouds: random top positions + entry delays for natural drift
- Branded XLSX + CSV for coverage and reports with F92 styling
  (`xlsx-js-style` dep added); XLSX sheet built directly rather than
  via `aoa_to_sheet` overlay
- `SplitButton` UI for reports export action + dropdown variants
- Admin-only `/dashboard/settings/system` — build stamp + system info
  (prebuild `scripts/gen-build-info.js` writes the manifest)

### Batch 003.5 — CQIP_SYNC_AUTH_KEY decoupling — 2026-04-24
- New env var `CQIP_SYNC_AUTH_KEY` — shared secret between Worker and
  `jira-sync` edge function. Set on both sides (Supabase secrets +
  Wrangler secrets) with matching values. Any random string.
- `jira-sync/index.ts` validates inbound requests against
  `CQIP_SYNC_AUTH_KEY` rather than `SUPABASE_SERVICE_ROLE_KEY`
- `app/api/jira/sync/route.ts` forwards the key as both `?apikey=...`
  and `Authorization: Bearer ...`; surfaces a specific "auth mismatch"
  hint on 401 so admins don't have to dig through logs
- `.env.example` documents the var with a generation hint
  (`openssl rand -hex 32`)
- **Motivation:** Supabase ECC-signing migration broke
  `SUPABASE_SERVICE_ROLE_KEY` parity between the Worker runtime and
  the edge-function runtime. Decoupling the handshake removes that
  failure mode permanently.

### Batch 004.0 — pg_cron jira-sync — 2026-04-26
Created the Supabase pg_cron job (`jira-sync-6h`) that fires the
`jira-sync` edge function every 6 hours. Configured via the
Supabase dashboard; includes the Bearer Authorization header for
CQIP_SYNC_AUTH_KEY. Replaced the old anon-apikey-based scheduling
that became invalid post-CQIP_SYNC_AUTH_KEY decoupling
(Batch 003.5). No code change — operational config only.

### Batch 004.1 — Milestone branch hardening — 2026-04-24
- **Incident driver:** on 2026-04-24 at 16:51:59, NBLYCRO-1452
  transitioned `Dev QA → Dev Client Review` while the Supabase-side
  `JIRA_API_TOKEN` was still the Apr 23-expired value. The milestone
  branch's broad try/catch swallowed `getIssue()`'s 401, no row was
  written, webhook returned 200 (via the rework-branch's
  "Invalid transition" path). The rework transition 10m41s later
  succeeded because the token was rotated in that window. Root-cause
  audit: see §13 rule 18.
- `supabase/functions/jira-webhook/index.ts`:
  - New `resolveBrandId(brandValue)` helper — brands → brand_aliases
    → null, centralized (also tidies the inline lookup duplication)
  - Milestone branch rewritten: payload-first brand/summary;
    `getIssue()` fallback wrapped in its own try/catch so a Jira
    outage degrades to a null-brand milestone rather than dropping the
    row entirely; the `test_milestones` INSERT now ALWAYS runs on a
    DCR transition (barring active-duplicate)
  - Response body surfaces both branch outcomes — format:
    `milestone: <outcome>; rework: <outcome>`. Milestone outcomes:
    `recorded`, `recorded-no-brand`, `skipped-duplicate`,
    `error-insert`, `skipped-not-applicable`. Scannable from the
    Supabase Invocations tab without opening Logs.
- **Contract preserved:** milestone failure never blocks the rework
  branch; status code stays 200 (Jira retries would duplicate).
- CLAUDE.md §13 rule 18 added documenting milestone independence +
  brand resolution order + payload-wins-on-conflict.
- **Ops carry-over:** missing milestone for NBLYCRO-1452 backfilled
  manually post-deploy via `scripts/backfill-milestones.ts`
  (source = 'backfill', reached_at = 2026-04-24T21:51:59Z).

### Batch 004.2 — Dependabot triage — 2026-04-26
- **xlsx package removed.** SheetJS pulled the npm package; high-CVE
  vulnerabilities had no fix path. Verified unused in the codebase
  (was listed in package.json but never imported). `npm uninstall
  xlsx`.
- **fast-xml-parser auto-fixed** via `npm audit fix`; transitive dep
  of an existing build tool.
- **postcss CVE deferred** — flagged but not exploitable in CQIP
  context. Requires breaking Next.js downgrade. Tracked but no
  action.
- **Cloudflare Workers Paid plan** — separate context: after Batch
  003 added xlsx-js-style, CQIP hit the 3MiB free-tier ceiling on
  deploys. Lacey upgraded to Paid plan on personal card; F92
  billing transfer pending Randy.

### Batch 004.3 — Audit-write security cleanup — 2026-04-26
Two existing-tech-debt fixes bundled. Sets a clean baseline before
Batch 004.4 (drought evaluator) starts emitting audit rows of its own.
- **Migration 014 — `014_audit_log_security_cleanup.sql`** drops and
  recreates the `audit_log_admin_insert` policy from migration 012 to
  use `public.is_admin()` instead of an inline `EXISTS` lookup against
  `user_profiles`. The helper additionally enforces
  `is_active = TRUE`, which the inline version did not — so a
  deactivated admin can no longer INSERT into `audit_log`. Originally
  planned as migration 013; that number was claimed by
  `013_brand_qa_config` first, so this migration takes 014. No other
  RLS policies touched.
- **`lib/audit/get-changed-by.ts`** — single canonical helper used by
  every audit-emitting route. Returns
  `user_profiles.email → auth.users.email → 'unknown'`; never throws
  on missing-profile rows. Pass the cookie-bound client
  (`createSupabaseRouteClient`); service-role clients return null
  from `auth.getUser()` and would be useless here.
- **Server-side `changed_by` retrofit completed for every audit
  writer:**
  - `app/api/admin/brands/qa-config/route.ts` — refactored from inline
    derivation to `getChangedBy()`. Already followed the rule; just
    points at the helper now.
  - `app/api/logs/edit/route.ts` (POST + DELETE branches, single + batch
    delete) — was using `display_name || email || id`. Now uses the
    helper, so audit rows display the email consistently across all
    sources. Note: existing audit rows written by this route before
    the cutover still show display names; new rows show emails.
  - `app/api/admin/brands/pause/route.ts` (NEW) — replaces the
    client-side `supabase.from('audit_log').insert(...)` that lived
    inside `togglePause` on `/dashboard/settings/coverage`.
  - `app/api/admin/milestones/route.ts` (NEW) — POST handles both
    create and restore-of-soft-deleted (the duplicate-detection
    SELECT stays client-side; only the mutation moves server-side).
  - `app/api/admin/milestones/[id]/route.ts` (NEW) — PATCH (edit
    `reached_at` + `notes`) and DELETE (soft-delete).
  - Each route forwards a `console.warn` with the attempted
    `changed_by` value + `auth.uid()` if a client passes one in the
    body, then discards it. Useful for forensics if a stale browser
    bundle is still in the wild after deploy.
- **Client-side dialogs refactored** to call the new server routes.
  `components/coverage/manage-milestones-dialog.tsx` no longer takes
  `currentUserEmail` (the prop is gone), and the parent settings page
  no longer tracks `userEmail` state. `togglePause` in
  `app/dashboard/settings/coverage/page.tsx` posts to the pause route
  instead of writing to `brands` and `audit_log` directly.
- **§13 rule 19 wording tightened** — was forward-looking when added
  in the QA-config branch; now states the rule is universally enforced
  and points at the canonical helper.
- **§14 `Planned but not yet shipped`** — removed the `is_admin()`
  consistency and `changed_by` derivation entries; both shipped here.
- **§15 Batch 004 list** — removed those two items; only the drought
  evaluator remains.

### Batch 004.4 — Drought rule evaluator — 2026-04-27
The seeded "Client Coverage Drought" rule was visible-only on the
Coverage page; it never wrote `alert_events` rows. Batch 004.4 wires
the daily evaluator + persistence so droughts are now recorded as
they begin and end. Unblocks Batch 006 (Teams dispatch), which will
read from `alert_events`.
- **Migration 015 — `015_alert_events_brand_id.sql`**:
  - Adds `alert_events.brand_id UUID REFERENCES brands(id)` (nullable)
    so events can be brand-scoped instead of log-scoped.
  - `alert_events_target_required` CHECK enforces that at least one
    of `log_entry_id` or `brand_id` is set — keeps existing log-scoped
    rows valid while admitting brand-scoped drought rows.
  - Partial index `idx_alert_events_brand_open` for the per-brand
    open-alert lookup.
  - Partial unique index `idx_alert_events_one_open_per_brand_rule`
    on `(brand_id, rule_id) WHERE resolved_at IS NULL` — race-protects
    the "INSERT new open alert" path. The drought evaluator catches
    23505 from this index and treats it as case-2 no-op.
  - Extends `audit_log_target_shape_chk` (originally migration 011)
    to allow `target_type='alert_event'` so the start/end audit rows
    pass the constraint. `target_id` references the
    `alert_events.id`.
- **`supabase/functions/drought-evaluator/index.ts`** (new edge fn):
  - Daily at 10:00 UTC (5am Central / 4pm Vietnam end-of-day) so the
    VN team's late-day milestone pushes are captured before the
    evaluator fires.
  - Auth pattern mirrors `jira-sync`: Bearer header / `apikey`
    header / `?apikey` query param, all timing-safe-compared against
    `CQIP_DROUGHT_AUTH_KEY`.
  - Reads threshold + window from `alert_rules.config` (so admin
    tweaks land without redeploys); falls back to documented defaults
    `threshold=2`, `window_days=28`.
  - 4-case reconciler per brand:
    1. drought + no open alert → INSERT (audit: CREATE
       `target_type='alert_event'`, `changed_by='system:drought-evaluator'`)
    2. drought + open alert → no-op
    3. healthy + no open alert → no-op
    4. healthy + open alert → UPDATE `resolved_at` (audit: UPDATE
       `field_name='resolved_at'`, same `changed_by`)
  - Per-brand try/catch isolates errors so one bad brand doesn't
    abort the loop; errors counter surfaces in the response summary.
  - 28-day cutoff is computed once at the top of the request as
    `Date.now() - windowDays*86400000` and reused for every brand
    to prevent drift across the loop.
  - Returns `{ evaluated, droughts_started, droughts_ended,
    skipped_paused, errors }` for log scannability.
  - Multiple active rule rows → warns and uses the earliest. Zero
    active rule rows → returns 200 with `{ skipped: true, reason }`
    so an admin can intentionally disable the rule without 500-ing
    cron.
  - Paused brands are deliberately skipped. Their pre-pause open
    alerts (if any) stay open — preserves the audit trail of when
    each drought began. Documented as part of §13 rule 20.
- **§13 rule 20 added** — cron-context audit writes use
  `changed_by = 'system:<cron-name>'` as the documented exception
  to rule 19's `auth.uid()`-derivation. First and currently only
  user: `system:drought-evaluator`.
- **§4 / `.env.example`** — `CQIP_DROUGHT_AUTH_KEY`. Supabase Edge
  Functions secret only; the Worker does not need this one.
- **§5 schema doc** updated with the new `alert_events.brand_id`
  column, both partial indexes, the CHECK constraint, and the
  expanded audit_log target-type list.
- **Spec deviation flagged in code comments:** the prompt referred to
  the rule as "Brand Coverage Drought"; the seeded row from migration
  009 is `'Client Coverage Drought'`. The function uses the seeded
  name (otherwise step 3 would never find the rule); the Batch 004.4
  spec language was colloquial.

### Batch 004.99 — Multi-Client Readiness Review — 2026-05-06
Discovery batch. No code shipped — produced a comprehensive
audit report at `docs/multi-client-readiness.md` (~1100 lines
post-addendum) identifying every NBLY-hardcoded assumption in
the codebase, verifying multi-tenant boundaries, and producing
onboarding + offboarding playbooks for future CRO clients
(SPL is the immediate downstream consumer).

**Same-day addendum (2026-05-06):** Section 8 (Onboarding
Playbook) was rewritten as canonical source content for a
future Dashboard Documentation Hub — every step now stands
alone without `CLAUDE.md` cross-references, and Step 1
expanded to include Jira workflow alignment quick-check, QA
tab + screen-scheme verification (the gap that surfaced for
SPLCRO during pre-audit prep), explicit `customfield_*` ID
inspection with REST-API guidance, and stakeholder
confirmation. New Step 5 "Configure project board automations"
replaced the previous SharePoint-only step and now covers
cloning the QA-clear automations, auditing other generic vs.
NBLY-specific CRO automation flows in the Neighborly space,
and SharePoint as a known dependency. §10 gained a Long-term
remediation row (L5) for the future hub batch — number TBD at
implementation time. §11 gained a Downstream Consumers
subsection mapping which audit sections flow into which
external surfaces (CLAUDE.md §15 backlog, future hub UI, future
re-audit reference).

**Pre-audit verified by Lacey** (incorporated as audit
assumptions):
- SPL Jira project key: `SPLCRO`
- SPL has a single brand named "SPL"
- SPL's QA tab is configured; field IDs match instance-global
  (`customfield_12906` Severity confirmed)
- SPL workflow uses the same status names as NBLY
- SharePoint integration in progress (Carl's Azure work) — known
  dependency, NOT a CQIP code blocker

**Audit methodology:** whole-repo grep for NBLY tokens (52 hits
in tracked source files outside `CLAUDE.md` / `package-lock.json`
/ the historical CSV); file-by-file review of edge functions,
migrations, settings UI, mutation routes; schema review against
§5; ops review of env vars / pg_cron / RLS / Teams / SharePoint.

**Top-line findings (better shape than expected):**
- Schema is multi-tenant ready from day one (`projects`,
  `brands.project_key` FK, `quality_logs.project_key` FK,
  `test_milestones`, `alert_events.brand_id` all FK-scoped).
- Edge functions, mutation routes, RLS policies, pg_cron jobs:
  zero NBLYCRO hardcoding in runtime code.
- 52 NBLY hits resolve to: 9 hardcode (mostly the `nbly_brand`
  key name in `JIRA_FIELD_MAP`), 5 seed (one-time SQL — already
  shipped, not multi-client blockers), 4 Medium UI copy strings
  (placeholder/error text mentioning `NBLYCRO`), 12 Low cosmetic.
- **Zero Critical findings in code.** The Critical
  operational item is the Jira-side webhook JQL (currently
  `project = NBLYCRO`); Lacey adds a second webhook for SPLCRO.

**Critical-path remediation for SPL onboarding (~30 min CQIP-side
+ 10 min Lacey-side in Jira):**
1. Confirm SPL's `customfield_12220` value on a real ticket (P2
   in §10).
2. Seed `projects` row for SPLCRO.
3. Seed `brands` row for SPL (SQL only — no admin UI for brand
   creation today; flagged as Q1 in §10 follow-up).
4. Configure Jira webhook for SPLCRO (Option A: separate
   webhook).
5. Update 5 UI placeholder strings (`'NBLYCRO-123'` →
   `'PROJECT-123'`) — Medium copy fix, ~15 min.

**Total SPL onboarding effort post-remediation:** 2–3 hours
human time end-to-end (CQIP work + Jira config + verification
ticket + post-onboarding QA). Of that, ~45 min is CQIP-side;
remainder is Jira automation + SharePoint dependency.

**Post-SPL polish (Batch 005.x):** brand-create admin UI on
`/dashboard/settings/coverage`, rename `nbly_brand` →
`client_brand_field`, decide single vs per-client Teams channel,
decide brand-resolution fallback approach for single-brand
clients. None block SPL going live.

**Long-term:** per-project `alert_rules` config (only when
per-client thresholds become needed), per-project
`JIRA_FIELD_MAP` (only when a future client lands on a different
Jira instance), `brand_aliases` admin UI.

The report is durable and intended for re-reading 6 months from
now during Client #3 / #4 onboarding. Update the §11 metadata
block on each subsequent audit.

### Batch 005.22 Phase 1 — Project-aware brand resolution — 2026-05-07

Schema + webhook + sync refactor that generalizes brand resolution
from "always read customfield_12220" to a per-project config column.
Closes audit doc §4.5 sub-cases (single-brand fallback approaches)
and the SPL ingestion gap. Pre-flighted by Jenny on 2026-05-07;
spec v2 incorporated 4 Critical + 6 High + 8 Medium findings before
implementation.

- **Migration 019** — `019_project_brand_model.sql`:
  - New enum `brand_model_type AS ENUM ('multi_brand','single_brand')`
    (wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object`
    for idempotency; CREATE TYPE doesn't support IF NOT EXISTS).
  - New columns on `projects`: `brand_model` (NOT NULL DEFAULT
    'multi_brand'), `brand_jira_field_id` (TEXT DEFAULT
    'customfield_12220'), `default_brand_id` (UUID FK with
    ON DELETE RESTRICT).
  - DEFAULT on `brand_jira_field_id` is the load-bearing piece —
    every existing multi-brand project (and every project added
    via the existing admin UI before Phase 5 lands) auto-satisfies
    the new CHECK constraint.
  - SPLCRO UPDATE: `brand_model='single_brand'`,
    `brand_jira_field_id=NULL`, `default_brand_id=<SPL brand uuid>`.
  - SPL brand UPDATE: `jira_value='SPL'` → `'SPL - Spotloan'`,
    aligning the single-brand format with the multi-brand
    `"CODE - Display Name"` convention. After this, every brand's
    jira_value follows the same shape regardless of brand_model —
    eliminating the writeback-vs-rework-count divergence Jenny
    flagged as Critical.
  - CHECK constraint: `multi_brand` requires `brand_jira_field_id`
    NOT NULL; `single_brand` requires `default_brand_id` NOT NULL;
    multi-brand may ALSO set `default_brand_id` as an escape-hatch
    fallback (NBLYCRO leaves it NULL today, preserving identical
    behavior to pre-Phase-1).
  - Conditional `quality_logs.client_brand='SPL'` → `'SPL - Spotloan'`
    UPDATE included as a commented-out block; uncommented only if
    the pre-migration verification's row-count query returned > 0.
- **Webhook** (`supabase/functions/jira-webhook/index.ts`):
  - New helpers `getProjectConfig(projectKey)` and
    `resolveBrandForTicket(payloadFields, fullIssueFields,
    projectConfig, ticketKey)`. The latter takes BOTH the payload
    and the optional `getIssue()` fallback so summary-backfill stays
    decoupled from brand resolution (rule 18 contract preserved on
    both models).
  - Single-brand path: skips field extraction; reads brand row by
    `default_brand_id`; writes `brand_id` + null `brand_jira_value`
    + `clientBrandString` from the brand row's `jira_value`.
  - Multi-brand path: reads `payloadFields[brand_jira_field_id]`
    (falling back to `fullIssueFields[brand_jira_field_id]`),
    extracts via existing `extractBrand()`, walks
    brands → aliases → default_brand_id → null. `client_brand`
    always sourced from the resolved brand row's `jira_value`
    (Option γ).
  - Project-config lookup replaced the standalone `is_active`
    short-circuit (net zero queries).
  - Inlined `JIRA_FIELD_MAP` lost its `nbly_brand` entry;
    `mapJiraFields()` no longer extracts brand.
  - `resolveBrandId()`'s no-match warn moved up into
    `resolveBrandForTicket()`'s aliases-miss path (now logs
    project + fieldId + extracted for debug-ability).
- **Sync** (`supabase/functions/jira-sync/index.ts`):
  - Inlined `getProjectConfig()` + new `resolveBrandForSync(issueFields,
    projectConfig)` helper. Project configs cached in a `Map` across
    the sync loop (low cardinality, ~1-3 projects).
  - Loop skips logs whose project is now inactive (no-op, not a
    failure).
  - `mapJiraFields()` no longer reads the brand field; brand
    resolution moves entirely into the new helper.
  - Inlined `JIRA_FIELD_MAP` lost its `nbly_brand` entry.
- **Scripts**:
  - `scripts/backfill-brands.ts` — per-log `getProjectConfig()`
    lookup with cache. Single-brand projects skipped (their brand is
    determined by the project, not a Jira field; null `client_brand`
    on a single-brand log is a Phase-1 migration artifact, not a
    backfill target).
  - `scripts/backfill-milestones.ts` — `loadProjectConfig()` once
    at start; per-issue branch on `brand_model`. The hardcoded
    `JQL = 'project = NBLYCRO'` stays (one-shot historical script;
    SPL has no pre-onboarding history). `PROJECT_KEY` is now a
    documented top-of-file constant for any future client-3 run.
- **`lib/jira/field-map.ts`**: `nbly_brand` entry removed (zero
  callers post-refactor). Closes audit Q2 incidentally.
- **`components/coverage/add-brand-drawer.tsx`**: helper text
  rewritten to guide admins to the `"CODE - Display Name"` format
  for `jira_value` regardless of `brand_model`. No behavior change
  (validation regex unchanged).

**Pre-migration verification** (operator runs in Supabase SQL editor
before applying 019):
- `SELECT * FROM projects` — expect 2 rows (NBLYCRO, SPLCRO).
- Confirm SPL brand row exists at SPLCRO/SPL.
- `SELECT COUNT(*) FROM quality_logs WHERE client_brand='SPL'` —
  expect 0 (SPL onboarded 2026-05-07; if > 0, uncomment the
  conditional `quality_logs.client_brand` UPDATE in the migration).

**What's deliberately NOT in this batch:**
- Filter pills for Coverage / Dashboard / Logs (Phases 2-4).
- Project-create UI hardening (Phase 5) — defaults on
  `brand_jira_field_id` + `brand_model` mean the existing UI keeps
  working as multi-brand-by-default. Single-brand creation still
  requires SQL until Phase 5.
- Brand-create drawer changes for single-brand projects (Phase 5).
- SPL milestone backfill (separate one-shot step after Phase 1
  deploys; uses the parameterized `backfill-milestones.ts` with
  `PROJECT_KEY` flipped to `SPLCRO`).

**Closes:** audit doc §4.5 sub-cases A/B/C decision; audit Q2
(field-map cleanup, NBLY-name removal); SPL ingestion ungated.
§13 rule 13 expanded; rule 18 expanded; new rule 28 added.

### Batch 005.20 — Brand admin UI: create-brand drawer — 2026-05-07
First post-multi-client-onboarding polish batch with real code
content. Closes audit Q1 (`docs/multi-client-readiness.md` §10
+ §6.5) — the biggest operational gap flagged by the multi-client
readiness review. Brand seeding has been SQL-only since
migration 009; this batch lifts that into the admin UI so future
client onboardings (client-3+) don't need a SQL detour.

- **New server route**: `app/api/admin/brands/route.ts` POST
  handler. Validates admin session via cookie-bound supabase
  client. Field-level validation: `project_key` must exist in
  `projects` and be active; `brand_code` matches
  `/^[A-Z0-9-]{1,32}$/` and is upper-cased before insert;
  `jira_value` and `display_name` non-empty after trim. Two
  duplicate checks: `(project_key, brand_code)` to prevent
  same-brand-twice on a project, and `jira_value` global
  uniqueness (matches the existing schema UNIQUE on
  `brands.jira_value`). Both surface as 409 with actionable
  error messages. Insert via service role; returns the inserted
  row so the client can optimistically render. Per §13 rule 19,
  this is the **third call site** of `getChangedBy()` (after
  qa-config and pause routes) — `changed_by` is server-derived;
  any client-supplied `changed_by` body key is `console.warn`'d
  and discarded.
- **Audit writes**: one `audit_log` row per submitted field
  (`project_key`, `brand_code`, `jira_value`, `display_name`,
  `is_active`, `is_paused`) with `target_type='brand'`,
  `target_id=<new brand id>`, `action='CREATE'`, `old_value=null`
  (row didn't exist before), `new_value=<serialized value>`,
  `changed_by` from the helper. If audit insert fails the brand
  row is preserved and the response surfaces `auditError` —
  same recovery shape as qa-config.
- **New component**: `components/coverage/add-brand-drawer.tsx`.
  Sheet-based drawer matching the `EditBrandQaConfigDrawer` /
  `BrandDetailDrawer` pattern. Form fields: project Select
  (populated from active projects), brand-code Input
  (`autoCapitalize="characters"`, font-mono), jira-value Input,
  display-name Input, two Switches for `is_active` (default ON)
  and `is_paused` (default OFF). Submit button reads "Add brand"
  / "Adding…" while in flight; gated by required-field validity
  + the brand-code regex check. On 4xx the drawer keeps state
  so the admin can adjust without re-typing; on success the
  drawer closes, a success toast confirms, and the parent's
  `loadBrands()` callback re-fetches. CSS tokens per §13 rule 25.
- **`/dashboard/settings/coverage` integration**: "Add brand"
  button in the page header card alongside the title. New
  state slots: `addDrawerOpen`, `projectOptions` (loaded
  alongside brands on admin init via `loadProjects()`).
  `AddBrandDrawer` is mounted at the bottom of the JSX next
  to `EditBrandQaConfigDrawer`. Successful create calls
  `loadBrands()` which propagates into the existing QA-config
  list and the paused-brands section.
- **No migration**, no schema change. The brand row inserts via
  service role per the existing pattern.

**What's deliberately NOT in this batch:**
- **Brand soft-delete or hard-delete** — tracked as backlog
  item 5.4 ("only if business need emerges"). Today's
  workaround for an unwanted brand is `is_active = FALSE` via
  the existing pause flow; that hides it from coverage and
  alerts while preserving historical data.
- **Coverage + Settings UX redesign** — tracked as backlog
  item 5.1. The unified brand-admin drawer planned there will
  consolidate the create + pause + edit-QA flows into a single
  drawer; this batch's standalone `AddBrandDrawer` is the
  minimal viable piece that unblocks Q1 without preempting that
  redesign.
- **Coverage page → Settings page link in the admin header** —
  deferred for the 5.1 unified-drawer landing instead of
  polishing the current split.

**Closes:** `docs/multi-client-readiness.md` §6.5 brand-create
gap row + §10 row Q1. `docs/multi-client-readiness.md` §11
metadata block updated with the Batch 005.20 ship line.

### Hotfix — drought-evaluator secret resync — 2026-05-07
Drought-evaluator edge function silently 401'd on every cron
invocation between 2026-05-01 and 2026-05-07 inclusive. Root
cause: `CQIP_DROUGHT_AUTH_KEY` value drifted between Supabase
Edge Functions secrets and the value baked into the pg_cron
command. pg_cron logs HTTP 4xx responses as `succeeded` (any
HTTP response is treated as success at the cron layer), so the
failure was silent — `cron.job_run_details` showed clean runs
daily, but the function never executed past its auth gate.
Function code, `config.toml`, deployed version, JWT-verification
toggle all verified correct.

Karen's first diagnostic pass blamed `verify_jwt` config drift on
Supabase's side, which would have manifested as gateway-level
rejection before the function ever ran. The `x-deno-execution-id`
header on the 401 responses ruled that out — its presence proved
the function executed; the 401 came from inside the function's
own auth gate. With the gateway hypothesis eliminated, the next
step was comparing the secret values themselves. SHA-256 of the
cron's Bearer token was `050ae193...`; the digest of
`CQIP_DROUGHT_AUTH_KEY` shown by `supabase secrets list` was
`3d448f33...`. The two values had drifted — the function's
timing-safe-compare correctly rejected a token that didn't equal
the stored secret.

Caught during SPL multi-page presence sweep (informal,
post-Batch 005.20) when SPL appeared as drought in the Coverage
page brand drawer (render-time computation against
`test_milestones`) but NOT in the active alerts panel (read from
`alert_events`). Investigation traced silent failure across
audit_log gap dates.

Fix: `supabase secrets set
CQIP_DROUGHT_AUTH_KEY=<value-matching-cron-command>`.
Config-only change; no code, no migration, no redeploy. Function
picks up new env on next cold start. Manual invocation 2026-05-07
17:08 UTC produced response `{"evaluated":13,"droughts_started":2,
"droughts_ended":0,"skipped_paused":4,"errors":0}` — wrote 2
drought CREATE rows for SPL and MOJ. Audit_log write contract
verified intact. Cron-driven verification: next scheduled tick
2026-05-08 10:00 UTC must produce a successful function execution
and audit-log activity if any state changes occurred.

Side discovery: MOJ silently slid back into drought during the
silent-failure window after recovering 2026-04-30. Surfaced as a
new drought during the catch-up run rather than a continuation
of the pre-recovery alert. Informational; no team action
required.

Followups added: §13 rule 27 (secret-rotation atomicity), §15
item 5.21 (cron-silence monitor).

**Lesson worth keeping:** when an edge function returns 401, look
at the response headers BEFORE diagnosing the auth path. Presence
of `x-deno-execution-id` means the function ran; the 401 came
from inside the code. Absence means the gateway rejected before
the function got a chance. Misreading that signal cost most of
the diagnostic effort on this incident.

### Batch 005.9 — UI copy: remove NBLY-coded examples — 2026-05-06
First post-SPL-onboarding polish batch. Closes audit Section 5
(all 5 findings) and audit Section 10 row P1. All copy fixes —
no behavior change, no schema change, no migration.

- `app/api/admin/milestones/route.ts` — error string updated to
  project-key-agnostic phrasing (`'jira_ticket_id must match
  PROJECT-123 format'`).
- `components/coverage/manage-milestones-dialog.tsx` — toast
  error + add-form input placeholder updated to PROJECT-style
  (`'❌ Ticket must match PROJECT-123 format'` and
  `placeholder="PROJECT-1234"`).
- `app/dashboard/settings/audit/page.tsx` — ticket-filter input
  placeholder updated (`placeholder="PROJECT-"`).
- `app/dashboard/settings/projects/page.tsx` — project-key input
  placeholder shows multi-client examples (`'e.g. NBLYCRO,
  SPLCRO'`) so the second client onboarding feels first-class
  rather than tacked-on.

The `TICKET_PATTERN = /^[A-Z]+-\d+$/` regex was already generic
in both call sites; only the human-readable copy was NBLY-coded.
Validation behavior is unchanged.

**Closes:** audit Section 5 (all 5 findings shipped) and §10 row
P1. `docs/multi-client-readiness.md` §2 / §5 / §10 marked with
"✅ Shipped 2026-05-06 (Batch 005.9)" notes per row.

**Backlog item carried forward:** §15 item 5.19 (SPL multi-page
presence sweep) — verify SPL renders correctly on every
dashboard surface that displays project/brand context. Most
surfaces auto-populate from the brands/projects tables and
should "just work," but a manual sweep confirms nothing was
missed. Pairs with audit Section 6.5 settings-UI gaps.

### Batch 005.3 — Remove diagnostic client_brand warns — 2026-05-06
Cleanup batch. Removed the `console.warn` blocks added during Batch
001 backfill diagnostics from `jira-webhook/index.ts` and
`jira-sync/index.ts`. The 1-2 week cleanup window flagged in §7
expired ~6 weeks ago; brand resolution path has been stable since
Batch 004.1's resolveBrandId hardening. The milestone-branch
warning (`[jira-webhook] milestone: no brand or alias match for ...`,
Batch 002) is intentionally preserved — it's part of the milestone
contract, not Batch 001 diagnostics. The "unexpected client_brand
shape" warn inside `extractBrand()` is also preserved — it's a
structural sentinel for unrecognized Jira data shapes (would catch
a silent Jira API field-format change), not a Batch 001 backfill
diagnostic.

No code path behavior changes; only logging removed. No migration,
no schema change, no UI change. §7's "Diagnostic logging
(temporary)" subsection deleted.

### Batch 005.10 — Sync with Jira pass/fail indicator — 2026-05-06
First Batch 005 item shipped post-demo. Adds persistent visibility
into jira-sync runs (both manual + cron) so admins no longer need
to check timestamps manually to confirm syncs succeeded — and so
silent cron failures stop being possible.

- **Migration 018 — `018_sync_runs.sql`**: new `sync_runs` cache
  table with start/completion timestamps, status, error category,
  error message, logs_updated count, logs_failed count,
  duration_ms. CHECK on `error_category` constrains values to the
  five documented categories. RLS: authenticated SELECT (read-only
  users see the indicator too — visibility is universally useful),
  no INSERT/UPDATE/DELETE policies for `authenticated`. Service-role
  writes from the edge function bypass RLS, matching the
  append-only pattern set by Batch 004.6's audit_log cleanup.
- **Edge function `jira-sync` instrumented**
  (`supabase/functions/jira-sync/index.ts`):
  - `recordRunStart()` inserts a `running` row at the top of every
    successful auth gate, capturing the row id.
  - `recordRunEnd()` updates the same row with `success` /
    `failed`, `completed_at`, `logs_updated`, `logs_failed`,
    `error_category`, `error_message` (capped at 2000 chars),
    `duration_ms`.
  - **Error categorization** via new `categorizeError()` helper:
    - `auth_mismatch` — inbound `CQIP_SYNC_AUTH_KEY` validation
      fails. Recorded as a one-shot `failed` row that never enters
      `running` (the function has no triggered_by signal at that
      point, so the row carries `triggered_by='unknown:auth_mismatch'`).
    - `jira_401` — Jira returns 401 / 403 (token expired / invalid).
      Per-log catch detects this on the FIRST occurrence and
      short-circuits the loop — every subsequent log would 401 too.
      Saves a 50× retry storm and gives the UI a tight signal.
    - `jira_500` — Jira returns 5xx.
    - `network` — fetch throws `TypeError` / `AbortError` (DNS,
      TLS, connection refused, timeout).
    - `unknown` — anything else.
  - New `JiraHttpError` class so `categorizeError()` can extract
    a status code without string-parsing error messages.
  - Per-log try/catch increments `logs_updated` on success and
    `logs_failed` on caught error so a partial outage records
    accurate counts. Function still returns 200 on partial
    failure — pg_cron retries would duplicate the work.
- **Server route `/api/jira/sync`**
  (`app/api/jira/sync/route.ts`): forwards
  `X-Triggered-By: manual:<email>` header to the edge function.
  Email is derived server-side via `getChangedBy()` per §13 rule
  19 — the client never supplies it. Edge function falls back
  to `cron:jira-sync-6h` when the header is absent, since the
  pg_cron job is the only other caller.
- **`SyncStatusPill` component**
  (`components/dashboard/sync-status-pill.tsx`): client component,
  reads the most recent `sync_runs` row on mount, polls every 30s,
  and re-renders relative-time labels every 30s independent of
  the data fetch. 4 display states: never synced (gray clock),
  running (blue spinner), success (green check + log count + time
  ago), failed (red x + time ago). Click opens a Dialog with
  full sync detail — triggered_by, absolute timestamps, duration,
  log counts, and on failure the error category + raw error
  message in a scrollable code block.
- **Stale `running` row handling**: pill fetches the top 2 rows
  by `started_at`. If the most recent row has `status='running'`
  and `started_at` is older than 5 minutes, the pill skips it and
  surfaces the next-most-recent row instead — the edge function
  exited abnormally (uncaught throw, container timeout, OOM,
  deploy mid-run) without recording the close. Heuristic only;
  no server-side janitor for v1. The orphan rows stay in the
  table and are visible in raw queries; only the pill papers
  over them. Documented in code comments on both the pill and
  the edge function.
- **TODO carried forward**: "View sync history" link inside the
  pill's detail dialog. Deferred until `/dashboard/settings/system`
  gains a sync history view. Code comment in the dialog body
  documents the intended query (last 50 rows of `sync_runs` ORDER
  BY `started_at` DESC) and rendering pattern (table: Time,
  Trigger, Status, Logs Updated/Failed, Duration, Error). Decide
  admin-only vs all-users at build time — the pill is universal,
  but the full trail may leak more than read-only users need.
- **Pill colors via per-theme CSS tokens**, NOT inline hex per §13
  rule 25. `app/globals.css` extended with `--pill-blue-*` and
  `--pill-green-*` triplets in both `:root` and
  `:root[data-theme="dark"]`. Light mode uses 50-stop tinted fill
  + 600-stop border + body-text color; dark mode uses deep
  900-stop fill + 600-stop border + lighter ramp text. Both
  modes hit WCAG AA on the warm cream / dark navy panel surfaces.
- **`SyncJiraButton` integration**
  (`components/dashboard/sync-jira-button.tsx`): pill rendered
  inline next to the button, ~8px gap. **Pill visible to all
  users**; the Sync button itself stays admin-only (existing
  behavior). Read-only users see the pill alone; admins see
  button + pill. Replaces the old localStorage-based
  "Last synced: ..." paragraph (`cqip-last-sync` key) — the
  database-backed pill is canonical now. After a manual click,
  `pillRefreshKey` bumps before and after the network call so
  the pill reflects `running` then `success`/`failed` without
  waiting for the 30s poll.
- **Surfaces**: `SyncJiraButton` is mounted on Dashboard, Logs,
  Reports, AND Coverage (CLAUDE.md §3 listed three; Coverage was
  already a fourth caller). Pill ships on all four since the
  change is in the shared component.
- **Pre-deploy ops checklist** (after this commit lands):
  1. Run migration 018 via Supabase dashboard
  2. `supabase functions deploy jira-sync`
  3. Manual sync click → pill goes blue → green
  4. Wait for next 6h cron tick → confirm pill updates with
     `cron:jira-sync-6h` triggered_by
  5. Force a 401 by temporarily setting wrong
     `CQIP_SYNC_AUTH_KEY` on the Worker → pill goes red with
     `auth_mismatch` category
  6. Log in as read-only guest → confirm pill renders (no
     button) and dialog opens

### Jira config — QA field auto-clear — 2026-05-06
Long-standing CLAUDE.md §15 ops item closed. Two Jira native
automation flows configured in Neighborly CRO space to clear all 13
QA tab custom fields on entry to Dev QA or Dev Client Review (auto)
or via manual button (manual). All 12 standard fields cleared via
Edit work item fields action; Who Owns The Fix? cleared via JSON
({"fields": {"customfield_13120": null}}) due to UI dropdown
limitation. No code change, no migration — Jira-side only.

### Batch 004.12 — Saturday dashboard accuracy + logs page count — 2026-05-02
Three small Saturday fixes ahead of the May 5 demo. No schema changes;
two of three are display-only. Atomic ship.
- **Dashboard charts now read all-time data**
  (`app/dashboard/page.tsx`) — the `allLogs` Supabase query was
  filtering with `gte('triggered_at', monthStart - 3)`, which silently
  excluded every CSV-imported historical log from every chart and made
  the Issue Category / Severity / Top Root Causes distributions
  under-count by months of activity. The 3-month filter is removed;
  the query now returns all non-deleted logs. **Why:** if the chart
  legend says "Top Root Causes" and the bars are aggregating only the
  trailing 3 months of webhook-driven data, the dashboard is lying to
  the user about which root causes are actually frequent in the
  history. CSV-imported rows make up the bulk of historical context
  and need to be included for the distributions to be accurate.
  **Rework Volume legibility decision:** rendering an all-time bar
  chart with weekly buckets would produce 100+ bars on data that goes
  back to 2024. The fetch is unchanged — `chartLogs` carries every
  log — but the volumeByWeek output is `.slice(-26)` (last 26 active
  weeks, ~6 months) for visual legibility. Click-drill on a bar still
  filters `chartLogs` by the displayed week, so the drawer shows the
  exact tickets in that week. The decision favors trend readability
  over "show every week ever" for the time-series chart while
  preserving total-fidelity counts on the three distribution charts.
  The `chartLogs` state-comment was updated to reflect the new
  contract.
- **"Total Logs" KPI relabeled "Logs This Month"**
  (`app/dashboard/page.tsx`) — the eyebrow read "TOTAL LOGS" with a
  subtle subtitle "This month"; on May 1 (the day the month resets to
  0) the big "0" looked broken to a guest viewer who skipped the
  6-pixel subtitle. Eyebrow now reads "LOGS THIS MONTH" so the scope
  lands in the prominent slot; subtitle changed to "Resets on the 1st"
  to actively explain a low/zero value rather than just labeling the
  scope. **Critically:** only the label moved — the underlying
  `kpi.totalLogsThisMonth` query (still scoped to `monthLogs`) is
  unchanged. Other "this month"-scoped KPIs (Top Root Cause subtitle)
  were left alone since their N/A render is already self-explanatory.
- **Reactive row count on /dashboard/logs filter bar**
  (`app/dashboard/logs/page.tsx`) — users had no way to validate that
  toggling pills / picking a brand was actually narrowing the result
  set, particularly when the table was scrolled or a filter narrowed
  to a small page-1 result. New `logCountLabel` derived from
  `filteredLogs.length` via `Intl.NumberFormat('en-US')` so commas
  appear at four-figure counts (`1,247 logs`); singular when count is
  exactly 1 (`1 log`). Renders in the filter card header on the right
  side, matching `text-xs font-medium text-[color:var(--f92-gray)]`
  typography (same as the existing "• 1 active" tag). Updates in
  lockstep with filter state — no debounce, no async fetch, just a
  `useMemo` over `filteredLogs.length`. **Edge case:** when the
  filtered count is 0, the count text becomes
  `0 logs · clear filters to see all` with the second half rendered
  as a button that calls `resetAllFilters()`. Catches the common
  "filters too narrow" mistake without forcing the user to scroll
  the table to find the empty-state row. `aria-live="polite"` on the
  span so screen readers announce updates as filters change.
- **Defensive `.range(0, 9999)` added to two queries** —
  `app/dashboard/logs/page.tsx` `loadData()` and
  `app/dashboard/page.tsx` `allLogs` both lacked an explicit range, so
  Supabase's PostgREST default 1000-row cap silently applied. Pre-004.12
  the dashboard chart query was 3-month-scoped (under cap) and the
  logs page list also fit comfortably under cap, so the limit was
  latent. Once charts go all-time AND the logs page surfaces a
  user-visible "1,247 logs" count, that cap turns into a silent lie:
  the count would top out at 1,000 even when the underlying table
  holds more. `.range(0, 9999)` is a defensive raise to 10k. If/when
  the table crosses that, both surfaces need real pagination, not a
  higher cap. **Why bundled into 004.12 and not deferred:** the new
  count feature LITERALLY CANNOT WORK CORRECTLY past 1k logs without
  this; without it, item 3 above would ship with a known-wrong-at-scale
  failure mode.
- **Decisions deliberately punted to backlog (5.16, 5.17):** the
  dashboard does NOT yet have user-controlled filter pills (5.16) —
  that's a real UI surface, not a Saturday polish item, and conflating
  it with this batch would have meant adding state plumbing across
  every chart. Tonight the dashboard is honestly all-time; users who
  need a windowed view go to `/dashboard/logs` and use the existing
  pills. Chart-drawer row grouping (5.17) was also left for Batch 005
  — same reason: scope discipline.

### Batch 004.11 — Saturday code pull-forward — 2026-05-01
Three small drawer-side polish items pulled forward from the Batch
005 backlog so they land before the May 5 demo. All three are
chart-drawer UX — no schema changes, no behavioral changes outside
the dashboard. Atomic ship.
- **Chart-name eyebrow on chart drawer**
  (`components/dashboard/log-drawer.tsx`,
  `app/dashboard/page.tsx`) — the chart drill-down drawer now
  renders a small eyebrow label above the title (e.g.
  "FROM: REWORK VOLUME (WEEKLY)"). Style:
  `text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]`
  with prefix "From: ". Without this, "Week of Apr 26, 2026" gives
  no indication which chart it came from once the drawer is open
  and the chart is occluded. New optional `chartName?: string` prop
  on `LogDrawer`; `openDrawer()` helper signature on the dashboard
  page extended to `(chartName, title, subtitle, logs)`. All four
  charts pass their canonical name: `Rework Volume (Weekly)`,
  `Issue Category Breakdown`, `Severity Distribution`,
  `Top Root Causes`. New `drawerChartName` state cleared in the
  onOpenChange close branch alongside the other defensive resets.
- **Sendback # replaces severity on rework-volume drawer rows**
  (`components/dashboard/log-drawer.tsx`,
  `app/dashboard/page.tsx`) — when the Rework Volume (Weekly)
  chart is the source, drawer rows now show a "Sendback #N" badge
  in place of the severity badge. Status badge stays. Severity
  isn't the relevant signal in a "tickets that came back this week"
  list — sendback count is. New `mode?: 'default' | 'rework-volume'`
  prop on `LogDrawer`; mode is derived on the dashboard page from
  `drawerChartName === 'Rework Volume (Weekly)'` rather than tracked
  separately (cleaner — one source of truth, no chance of mode +
  chartName drifting). `LogDrawerQualityLog` interface extended
  with optional `log_number?: number` (the dashboard's filtered
  `DashboardLog` already carries it from `quality_logs.*`). The
  badge only renders when `log_number` is actually present, so a
  consumer that doesn't supply it gets the default severity badge.
- **Chart drawer rows open `LogDetailDrawer` stacked on top**
  (`components/dashboard/log-drawer.tsx`,
  `app/dashboard/page.tsx`,
  `components/logs/log-detail-drawer.tsx`) — clicking a row in the
  chart drawer now opens the existing `LogDetailDrawer` over it.
  The chart drawer stays open behind. Closing the detail drawer
  returns the user to the chart drawer with their filtered list
  intact. Replaces the original Batch 005 plan (Option A:
  close-and-replace) with Option B (stacking) — the user can drill
  into a ticket, back out, drill into the next ticket without
  losing their place. Implementation:
  - `LogDrawer` row markup replaced the absolute-positioned
    `<Link href={...}>` row activator with an absolute-positioned
    `<button type="button">` that fires a new
    `onLogClick?: (logId: string) => void` callback. The button
    overlay (sibling to the chip's `relative z-10` lane) preserves
    the original a11y pattern: it gets native Enter / Space
    keyboard activation as a real `<button>`, the focus-visible
    orange ring stays on the activator, and the external Jira
    ticket chip is NOT nested inside an interactive parent (avoids
    the WCAG 4.1.2 nested-interactive violation that putting an
    `<a>` inside `role="button"` would create). Clicking the chip
    opens Jira in a new tab; clicking anywhere else on the row
    triggers `onLogClick`.
  - `app/dashboard/page.tsx` adds `detailLogId` + `detailOpen`
    state, passes `onLogClick` into `LogDrawer`, and renders
    `<LogDetailDrawer>` as a sibling. `isAdmin={false}` for now —
    see known limitation below. `onEdit` is `undefined` (no edit
    action from the chart drilldown; users go to the logs page for
    that).
  - Radix Dialog handles the stacking natively: ESC closes the
    topmost drawer first; overlay click on the detail drawer
    closes only the detail drawer. No coordinated state hiding
    required. New §13 rule 26 documents the pattern as
    intentionally supported.
- **Known limitation:** the dashboard-context `LogDetailDrawer`
  hides the Edit action because `isAdmin` is hardcoded `false` —
  the dashboard page does not currently fetch user role. Tracked
  as a `// TODO:` comment in `app/dashboard/page.tsx` next to the
  detail-drawer mount. Wire `isAdmin` from `user_profiles` in
  Batch 005 (matches the gating pattern used by other admin
  surfaces); for now, admins can still edit from `/dashboard/logs`.
- **Batch 005 §15 cleanup:** old item 5.13 (chart drawer →
  LogDetailDrawer reuse) shipped here, removed; old 5.14 (drought
  pill → BrandDetailDrawer) renumbered to 5.13; old 5.15 (log
  detail page density redesign) renumbered to 5.14.

### Batch 004.10 — Pre-demo UX polish — 2026-05-01
Pure dashboard-visible polish ahead of the May 5 demo. No schema
changes, no behavioral changes — six small fixes / refinements that
add up to a noticeably more solid first impression. Atomic ship.
- **Log detail page Next 16 fix** —
  `app/dashboard/logs/[id]/page.tsx` was destructuring `params`
  synchronously. In Next 16 production builds, dynamic-route
  `params` is a `Promise<{id}>` that must be unwrapped with
  `React.use()`; sync access silently resolved to `undefined`, the
  query ran with `id=undefined`, and the page rendered "Log entry
  not found" — but ONLY when reached via the dashboard chart
  drawer's "View →" link. Page refresh worked because Next happened
  to settle the promise during SSR. Fix: type `params` as
  `Promise<{ id: string }>` and unwrap with `use(params)`.
  Worth a grep for `params }: { params: {` in other client
  components with dynamic routes — same bug pattern is latent
  anywhere it appears.
- **KPI accuracy + new Aging KPI** (`app/dashboard/page.tsx`) —
  Open / In Progress / Critical KPIs were filtering against
  `monthLogs` (`triggered_at >= monthStart`), which silently
  dropped every still-open April log on May 1. The dashboard read
  "0 open" while several aged Open / In Progress logs from prior
  months were in flight. Fix: new `openLogs` query scoped to
  `log_status IN ('Open','In Progress')` regardless of date; Open /
  In Progress / Critical KPIs read from it. Total Logs This Month
  and Top Root Cause continue to read from `monthLogs`
  (intentionally month-scoped — those KPIs answer "this month",
  not "right now"). Added a 7th KPI card "Aging" — count of
  `openLogs` with `triggered_at >= 14 days old`. Orange when > 0,
  navy when 0. Aligns with the "Long-Running Open" alert rule
  from §10 — note the rule still has no evaluator wired (Batch
  005). Grid bumped `lg:grid-cols-6` → `lg:grid-cols-7`.
- **Alerts panel redesign** —
  `components/dashboard/active-alerts-panel.tsx` +
  `app/globals.css`. Replaced the full-width row layout with
  compact severity pills. Each pill shows brand code + descriptor
  + time ago (e.g. `MRR drought · 3d`). Brand code is dominant in
  both alert flavors — drought rows use `brand.brand_code`;
  log-scoped rows use a new `extractBrandCode()` helper that splits
  the `"MRR - Mr Rooter Plumbing"` `client_brand` format on the
  first `" - "`. Severity drives pill color via per-theme CSS
  tokens (see new §13 rule 25): light mode is 50-stop tinted fill
  + 600-stop border + body text; dark mode is 900-stop deep fill +
  600-stop border + 200-stop ramp text. WCAG AA in both modes.
  Drought pills are always amber (no severity dimension). Whole
  pill is clickable: brand-scoped → `/dashboard/coverage`,
  log-scoped → `/dashboard/logs/{log_entry_id}`. `role="button"` +
  `tabIndex={0}` + Enter/Space keyboard handlers + `aria-label` for
  accessibility; hover dims to 85% opacity; focus shows orange
  ring; pills wrap when count exceeds row width. Removed:
  per-row "View →" link (redundant when the whole card is
  clickable) and the top "View all logs →" header link. New
  `--f92-warm-hover` CSS var added (per-theme: `#FDFBF7` light,
  `rgba(255,255,255,0.04)` dark) for the panel-internal hover
  token. New pill color tokens added in `app/globals.css` for
  amber / red / coral / gray, each with `-bg` / `-border` / `-fg`
  triplets, light + dark variants.
- **Pointer cursors sweep** (`app/globals.css`) — Global CSS rule:
  `cursor: pointer` on `button:not(:disabled)`,
  `[role="button"]:not(:disabled)`, `a[href]`, `summary`,
  `label[for]`, and `select:not(:disabled)`; `cursor: not-allowed`
  on disabled. Catches every interactive element in one place
  rather than per-component sprinkles.
- **Default 60-day filter on Logs page** —
  `app/dashboard/logs/page.tsx`. `startDate` initial state seeded
  with `daysAgoISO(60)` via lazy init; `activePill` initial state
  `'60'` instead of `'all'`. All other filter logic untouched. Why:
  default page load was rendering 18 months of logs and felt slow
  + busy; 60 days matches the team's natural review window.
- **IdleTimeout removal** (`app/dashboard/layout.tsx`) — Removed
  the import and `<IdleTimeout />` mount. Sessions now persist for
  Supabase's default refresh-token lifetime (~7 days). The
  `cqip-remember-me` / `cqip-session-active` canary logic in
  `verifySession()` is intentionally separate (it controls
  "log out on browser close when Remember me unchecked") and
  stays in place. Component file at
  `components/layout/idle-timeout.tsx` left in place — can be
  deleted if `npm run build` confirms no remaining references.
- **§13 rule 25 added** documenting the per-theme CSS-token
  pattern for severity-coded UI (no inline hex in JSX).

### Batch 004.9 — audit_log target_type cleanup — 2026-04-29
Closes Finding 7 from the 2026-04-28 read-only permissions review,
the last pre-demo follow-up. Both Jira edge functions wrote audit
rows with `log_entry_id` set but `target_type` and `target_id`
unset — those rows passed `audit_log_target_shape_chk` only because
Postgres three-valued-logic treats the constraint expression as
NULL (not FALSE) when `target_type IS NULL`. Functionally fine, but
the audit page filters on `target_type='quality_log'` and was
silently missing every row written by the webhook or the auto-
advance sync. With this batch, every row in `audit_log` has both
shapes populated.
- **`supabase/functions/jira-webhook/index.ts`** — the
  "Created via Jira webhook" CREATE row now sets
  `target_type: 'quality_log', target_id: insertedLog.id` alongside
  the existing `log_entry_id`. Redundant for quality_log rows but
  consistent with every other audit writer in the codebase
  (Batch 004.3 / 004.4 / 004.5 all set both).
- **`supabase/functions/jira-sync/index.ts`** — the auto-advance
  STATUS_CHANGE row gets the same treatment with `target_id: log.id`.
- **Migration 017 — `017_audit_log_backfill_target.sql`** — single
  idempotent UPDATE backfilling
  `target_type = 'quality_log', target_id = log_entry_id` on every
  row where `target_type IS NULL AND log_entry_id IS NOT NULL`.
  No schema change; the columns and CHECK constraint were both
  added in migration 011 (Batch 002.5b).
- **Deploy required.** The migration is run via the Supabase
  dashboard; the two edge functions need to be redeployed via
  `supabase functions deploy jira-webhook` and
  `supabase functions deploy jira-sync` for the direct-write path
  to take effect on new rows. The migration handles every row
  written before the deploy lands; the direct-write path handles
  everything after.
- **CLAUDE.md §16 Batch 004.8 footer note** updated — Finding 7
  closed; no remaining follow-ups from the 2026-04-28 review
  ahead of the May 5 demo.
- **What's NOT in this batch:** Findings 2/3/6/9/13 from the review
  remain in the Batch 005 backlog (item 5.11 — server routes +
  audit for projects / alert_rules / users mutations; pre-deploy
  hardening for radara-sweep stays Batch 005 ops carry-over).

### Batch 004.8 — Middleware admin-route gating — 2026-04-29
Closes Finding 4 from the 2026-04-28 read-only permissions review.
Before this batch, `middleware.ts` only enforced authentication —
a read-only user could navigate directly to
`/dashboard/settings/users`, `/audit`, `/projects`, `/alerts`,
`/coverage`, or `/system` and see each page's client-side
"Admin access required" panel. Functional but awkward for a guest
demo, and a single layer of defense (page mount → fetch session →
fetch role → render gate). With a read-only guest credential being
handed out for the May 5 demo this becomes a hand-off-quality issue.
- **`middleware.ts`**:
  - New admin-gate block runs after the existing auth-or-login
    redirects, only on requests matching `/dashboard/settings/*`
    excluding `/dashboard/settings/profile`. Profile is carved out
    because every user (admin and read_only alike) edits their own
    theme / avatar / password / display-name there.
  - One `user_profiles.select('role, is_active')` per admin-page
    hit; zero overhead for non-admin paths. Reuses the existing
    cookie-bound supabase client created at the top of the file.
  - Non-admin or inactive → 302 to `/dashboard` (not `/login` —
    they're authenticated, just not authorized; sending them to
    /login would be misleading and produce an immediate
    /login → /dashboard bounce).
  - Comment block enumerates the six routing scenarios so the
    intent is obvious from the file.
- **CLAUDE.md §13 rule 24** added documenting the gate, the
  carve-out, and what to do when adding a new settings page (admin
  or self-service).
- **No client-side changes.** Page-level `isAdmin` checks stay as
  belt-and-suspenders. If the middleware matcher is ever
  misconfigured or a deploy regresses, the pages still won't render
  mutation UI to a non-admin.
- **Hand-verification post-deploy:** log in as the read_only guest
  in incognito, hit `/dashboard/settings/users` directly — should
  redirect to `/dashboard` without flashing the admin-gate panel.
  Then log in as an admin, hit the same URL — should render the
  user-management page normally. Also confirm
  `/dashboard/settings/profile` works for the read_only guest.
- **Follow-up:** the audit `target_type` cleanup for jira-webhook /
  jira-sync (Finding 7 / PROMPT C) shipped as Batch 004.9.

### Batch 004.7 — Active alerts panel: brand-scoped render path — 2026-04-28
Same-day fix: dashboard was crashing on load with
`TypeError: Cannot read properties of null (reading '0')`. The
`ActiveAlertsPanel` query joins `alert_events` to `quality_logs`,
and Batch 004.4 (drought evaluator, 2026-04-27) started writing
brand-scoped alert rows where `log_entry_id IS NULL` — supabase-js
returned `null` for the related `quality_logs` field on those rows,
and the existing `alert.quality_logs[0]?.field` access threw on
`null[0]`. Seven such rows existed in production at fix time.
- **`components/dashboard/active-alerts-panel.tsx`**:
  - **Relation-shape normalization.** A first cut of the fix replaced
    `quality_logs[0]?.x` with `quality_logs?.[0]?.x` on the
    assumption that supabase-js returns embedded relations as arrays.
    It crashed less but rendered every drought card with a generic
    `'Alert'` header and no brand info — because supabase-js v2
    actually returns embedded relations as **single objects** when
    the FK targets a unique column (e.g. `rule_id → alert_rules.id`,
    `brand_id → brands.id`, `log_entry_id → quality_logs.id`), and
    `obj[0]` is `undefined`. The shipped fix introduces a
    `pickFirst<T>(rel: T | T[] | null | undefined): T | undefined`
    helper that handles all four shapes uniformly. Render code reads
    one `rule = pickFirst(alert.alert_rules)`, etc., and stays
    shape-agnostic.
  - **Query extended** to fetch `brand_id` + a `brands(id, brand_code,
    display_name)` relation so brand-scoped rows have a render target.
  - **`isBrandScoped` branch** keyed on
    `alert.log_entry_id == null && alert.brand_id != null` — the
    FK on alert_events is the source of truth, not the joined data
    shape (protects against a stale brand row or a deleted log).
  - **Brand-scoped card layout**:
        Client Coverage Drought • Mr. Rooter Plumbing (MRR)
        Fewer than 2 milestones in last 28 days · 4h ago
        Brand: MRR
        View coverage →
    Threshold + window pulled from `alert_rules.config` with the
    same documented defaults (threshold=2, window_days=28) that the
    drought evaluator uses. Severity badge suppressed for brand
    rows (drought has no severity).
  - **Log-scoped path** unchanged in spirit — still ticket id,
    summary, severity badge, client / project chips, and a
    `View Details →` link to `/dashboard/logs/${log_entry_id}`.
  - **Hover contrast fix.** Card bg goes `warm → white` on hover;
    the orange link kept its base color and lost contrast against
    the lighter background because the link's own `hover:` modifier
    only fires when the cursor is on the *link*, not the card. Card
    wrapper gets a `group` class; both link variants get
    `group-hover:text-[color:var(--f92-navy)]` alongside the
    existing `hover:` rule. Either trigger now darkens the link.
- **No schema changes.** No drought-evaluator changes. Strictly a
  render-layer fix.
- **Why threshold-only and not "has 2 milestones":** the
  human-readable runtime count lives in `audit_log.notes` (written
  by the drought evaluator at alert creation), not on
  `alert_events`. Showing the live count truthfully would require
  either an N+1 re-query of `test_milestones` per card or
  string-parsing audit notes. Both rejected for same-day scope —
  the threshold-and-window phrasing is accurate without either.
  Cosmetic improvement queued as Batch 005 item 5.12
  (`alert_events.context jsonb`).
- **Lesson worth keeping:** any future supabase-js query that uses
  embedded relations on FK-to-unique-column links should assume the
  related data comes back as `T | null`, not `T[]`. If both shapes
  are possible across the same field (e.g., a hand-written cast that
  used to be array-shaped), use `pickFirst()` or equivalent.
  Considered codifying as §13 rule 24 — deferred until a second
  callsite needs it; one-shot in this file for now.

### Batch 004.6 — Pre-demo security batch — 2026-04-28
Bundles three RLS-layer fixes from the 2026-04-28 read-only
permissions review (Findings 1, 5, 11). All three land atomically
in one migration because they're related cleanup on the same
surface, and because a Tue May 5 demo is handing out a read-only
guest credential — the privilege-escalation fix in particular is a
demo blocker.
- **Migration 016 — `016_pre_demo_security.sql`**:
  - **Finding 1 fix — BEFORE UPDATE trigger on `user_profiles`.** New
    function `public.user_profiles_protect_privileged_columns()`
    (plpgsql, SECURITY INVOKER) wired to a
    `BEFORE UPDATE OF role, is_active` trigger. Raises
    `insufficient_privilege` when `auth.uid()` is set and the caller
    is not an admin. Closes the hole where a read-only user could run
    `supabase.from('user_profiles').update({ role: 'admin' })` from
    dev tools — the existing `user_profiles_self_update` RLS policy
    (migration 005) is row-level only and cannot constrain individual
    columns. The `auth.uid() IS NOT NULL` guard is critical: it lets
    service-role writers (used by `/api/admin/users`) through so
    legitimate admin role / deactivation toggles still work. See §13
    rule 22 for the durable contract.
  - **Finding 5 fix — drop `audit_log_admin_insert`.** Migration 012
    added an admin INSERT policy on `audit_log` so browser-initiated
    milestone / brand audit writes could land. Batch 004.3 retrofitted
    every writer to use a server route + service-role insert; the
    policy has been unreachable from production code since. Removing
    it closes the dev-tools tampering vector (an admin INSERTing
    fabricated rows with arbitrary `changed_by`). Service-role writes
    continue to bypass RLS exactly as before.
  - **Finding 11 fix — `audit_log_select_all` → `audit_log_select_admin`.**
    Renamed and tightened to `USING (public.is_admin())`. Read-only
    users can no longer exfiltrate the audit trail (which contains
    user emails in `changed_by`) via direct `supabase.from('audit_log')`
    SELECTs. The audit page was already gating its UI on `isAdmin`;
    this brings the wire protocol in line.
- **CLAUDE.md §5** updated with the new audit_log RLS posture and the
  user_profiles trigger-protection note.
- **CLAUDE.md §13 rule 22** added documenting the trigger contract
  and the service-role bypass.
- **No application code changes.** Trigger + policy work is the
  whole defense. Browser-side mutations of `role` / `is_active` will
  start failing with `insufficient_privilege` once the migration runs;
  no production code path makes those mutations from the browser
  today (verified via grep), so no fallout is expected.
- **Hand-verification snippets** included at the bottom of the
  migration as commented-out SQL templates: read-only self-promotion
  (expect rejection), read-only theme update (expect success), admin
  promoting another user (expect success), `audit_log` SELECT
  cardinality by role (0 vs full count), admin INSERT into
  `audit_log` (expect RLS rejection).
- **What's NOT in this batch:** the middleware admin-route gate
  (Finding 4) and the audit `target_type` cleanup for jira-webhook /
  jira-sync (Finding 7) are scheduled for separate follow-up batches
  ahead of the May 5 demo (review's PROMPT B and PROMPT C
  respectively; batch numbers assigned at land time — 004.7 was
  taken by an unplanned same-day dashboard fix). Findings 2/3/6/9/13
  are absorbed into the Batch 005 backlog (Batch 005 item 5.11 —
  server routes + audit for projects / alert_rules / users
  mutations; pre-deploy hardening for radara-sweep stays as Batch
  005 ops carry-over).
- **Run procedure:** Lacey runs migration 016 manually in the
  Supabase SQL editor, then walks through the five hand-verification
  snippets. No deploy required (RLS-only).

### Batch 004.5 — Brands QA-config extension — 2026-04-26
- **Migration 013 — `013_brand_qa_config.sql`** extends the existing
  `brands` table with QA-automation config columns: `live_url_base`
  (https-with-no-trailing-slash CHECK), `default_local_sub_areas`
  (TEXT[]), `client_contact_name`, `client_contact_jira_account_id`,
  `url_pattern` (CHECK in `convert-preview` | `live-qa`),
  `qa_automation_enabled` (NOT NULL DEFAULT FALSE — gates API
  exposure), `notes`, `updated_at`. Partial index on
  `qa_automation_enabled = TRUE`. New admin-only UPDATE RLS policy
  using `public.is_admin()` (additive — does not modify the existing
  `brands_admin_write` policy from migration 009).
- **Seed:** GUY and RBW UPDATEd to `qa_automation_enabled = TRUE`,
  `url_pattern = 'convert-preview'`, with their respective
  `live_url_base` (groundsguys.com / rainbowrestores.com). The other
  14 NBLY brands are untouched and stay at the FALSE default.
- **Admin UI:** `/dashboard/settings/coverage` extended with a "QA
  Automation Config" card that lists every brand and opens an "Edit
  QA Config" side drawer per brand (`EditBrandQaConfigDrawer`,
  matching the existing `BrandDetailDrawer` Sheet pattern). Save
  posts to `PATCH /api/admin/brands/qa-config`.
- **Admin route:** `app/api/admin/brands/qa-config/route.ts`. Validates
  admin session, fetches the current row, computes per-field diffs,
  UPDATEs the brand with the changed columns + `updated_at = NOW()`,
  and emits one `audit_log` row per changed field with
  `target_type = 'brand'`. **First call site to follow §13 rule 19:**
  `changed_by` is derived server-side from `user_profiles.email`
  (looked up via `auth.uid()`); any client-supplied `changed_by` in
  the request body is ignored.
- **Public read API for the Forge QA-automation app:**
  - `GET /api/brands/[projectKey]/[brandCode]` — single brand or 404.
    Returns 404 (not 403) for QA-disabled rows.
  - `GET /api/brands?projectKey=X` — list of QA-enabled brands.
  - Both validated with `Authorization: Bearer <CQIP_BRANDS_API_TOKEN>`
    via timing-safe compare (`lib/api/bearer-auth.ts`, `node:crypto`
    `timingSafeEqual`). Path params validated as `^[A-Z0-9-]{1,32}$`
    (allowing hyphens to keep MRR-CA queryable, even though MRR-CA is
    paused/QA-disabled today).
  - Response shape: `{ brand_code, project_key, display_name,
    live_url_base, default_local_sub_areas, client_contact_name,
    client_contact_jira_account_id, url_pattern, notes }`. No
    internal IDs, no coverage fields, no pause state. Read-only — no
    POST/PATCH/DELETE on these endpoints.
- **New env var:** `CQIP_BRANDS_API_TOKEN` — shared secret for the
  Forge integration. Documented in §4 + `.env.example`. Mirrors the
  `CQIP_SYNC_AUTH_KEY` pattern: must be set on the Cloudflare Worker
  via `wrangler secret put` and on the Forge side as an encrypted
  Forge variable, with matching values.
- **§13 rule 19 added:** audit log writes derive `changed_by` from
  `auth.uid()` server-side. The brand QA-config route is the first
  call site that follows it; the milestone + pause/unpause call
  sites were retrofitted in Batch 004.3.
- **Schema doc (§5)** updated with the new `brands` columns + the
  `qa_automation_enabled` exposure rule + the no-trigger
  `updated_at` convention.
- **Coverage page redesign deferred** — KPI consolidation, padding
  cleanup, and header-section moves for `/dashboard/coverage` were
  intentionally NOT bundled into this branch. Tracked as Batch 005
  item 5.1 in §15.
- **Note on chronological vs batch-number ordering:** 004.5 shipped
  on 2026-04-26 (calendar-prior to 004.3), but the Shipped Log is
  ordered by batch number, not calendar date.

---

*Last updated: 2026-07-21 | CQIP v2.5 — Docs-only §15.5→§16 reconcile (no code, no version bump): three shipped Batch 012 entries moved from §15.5 in-flight to §16 shipped per §13 r34, and the stale Phase A §15.5 drift cleared. **Batch 012 Pulse inline directive editing** SHIPPED (killed both matrix-page modals — inline create strip + row-expansion cell editor [the E3 seam], compacted to a single dense row per Lacey's request; reuses the two existing admin routes; Karen PASS-WITH-FINDINGS, LOW folded; commits `96a6e0a`→`705bd37`→`d7a44a1`; PUSHED + deployed 2026-07-21). **Batch 012 Pulse E1 follow-on (cross-project client nav)** SHIPPED (client list now spans all projects, single-brand clients collapsed to one entry, via the pure `toClientNavGroups` + the extracted `pulse:project` channel; Karen PASS across 3 rounds; commits `89c5e54`→`0da2a57`; PUSHED + deployed 2026-07-21). **Batch 012 Phase A (Directive Matrix MVP)** §16 entry written (late reconcile — shipped 2026-07-17 via `6f1dafb`→`001a70a`→`a6a5975`, Karen PASS, migration 024; its §15.5 in-flight entry had lingered). §15.5 is now empty of entries; §15 E-track + priority SHIPPED list + header current-deployed-state updated; all three are DC-internal (no CROSS_CLAUDE.md contract surface). This reconcile commit is docs-only. Prior (2026-07-21, v2.5): Batch 012 **Pulse E1 follow-on (cross-project client nav)** built, committed, NOT pushed (render/nav only — NO migration, NO new mutation route, NO new page route, NO schema change; no Jenny; no version bump). Two commits: `89c5e54` (docs: spec `docs/batch-012-pulse-clientnav-spec.md`) + the code commit. The E1 client nav was project-scoped (single-brand clients like SPL undiscoverable without switching the picker); the nav now lists EVERY active client cross-project — multi-brand clients as a group (header → matrix scoped to that client via the shared `pulse:project` handoff; brands underneath), single-brand clients (keyed on `projects.brand_model`) collapsed to ONE entry under the client name linking straight to its brand page. New pure `toClientNavGroups(projects, brands)` in `lib/client-library/pulse.ts` (groups alpha by project display name; brands alpha; paused kept + flagged; inactive projects/brands + zero-brand projects excluded; each node carries projectKey + brandCode). The E1 flat helper `toClientNavItems` (+ 2 now-unused types) REMOVED (superseded; would be a dead export; behavior preserved by the group tests). The `pulse:project` sessionStorage-key + CustomEvent + `broadcastPulseProject` extracted verbatim from the page-local E1 copy into a shared `lib/client-library/pulse-project-channel.ts` (+ `readStoredPulseProject`) so the page, nav, and brand page share ONE definition (removes E1's duplicated "keep in sync" constants) — reused, not reinvented. Karen E1 observation-B folded: the brand page broadcasts its URL `projectKey` on mount (side-effect useEffect) so "← Pulse" opens the matrix on the deep-linked client. Discipline kept: paused greyed-but-linked, inactive excluded, renders only under `/dashboard/pulse`, all setState after await with a `cancelled` guard. `tests/pulse-shell.test.ts` swapped the `toClientNavItems` cases for `toClientNavGroups` cases; tests 17/17; tsc clean; build green (`/dashboard/pulse` `○`, brand page `ƒ`); ESLint on all new/changed files zero findings. §15.5 in-flight entry added + §15 E-track note. DC-internal — no AC contract surface. DO NOT PUSH — Karen post-flight next, then Lacey smoke-tests + deploys. Prior (2026-07-21, v2.5): Batch 012 **Phase E1 (Pulse shell)** SHIPPED + PUSHED 2026-07-21 (Lacey pushed; app-code push triggers the auto-deploy — post-deploy smoke is Lacey's final bar). Per §13 r34 the §15.5 in-flight → §16 shipped move is landed in a docs-only reconcile: §15.5 E1 entry REMOVED, §16 shipped entry written, §15 phase-status E1 → SHIPPED, header current-deployed-state + priority SHIPPED list updated. Render/routing only (render/routing only — NO migration, NO new mutation route, NO schema change; no Jenny gate; no version bump). Two commits: `cfe374f` (docs: spec) + the code commit. Renamed the user-facing area **"Client Library" → "Pulse"** (nav label + page eyebrow; matrix keeps its "Directive Matrix" sub-title) — API routes (`/api/admin/directives`, `/api/monitoring/*`) and internal `lib/client-library/*` identifiers are deliberately NOT renamed (concern-named / not user-facing). `git mv app/dashboard/client-library → app/dashboard/pulse` (history preserved) + `next.config.ts redirects()` for `/dashboard/client-library(/:path*)` → `/dashboard/pulse(/:path*)` (307). New deep-linkable brand page `app/dashboard/pulse/[projectKey]/[brandCode]/page.tsx` (`ƒ`): header (name/code/project/paused badge) + this-brand-filtered directives (read-only, one source via the pure `brandDirectiveView`) + a framed "Convert configuration will sync here" placeholder (E2) + clean empty states. New contextual client nav `components/layout/pulse-client-nav.tsx` (renders only under `/dashboard/pulse`): current-project active brands, paused greyed-but-linked, inactive excluded, alpha-sorted; project source = URL projectKey on a brand page, else the matrix picker mirrored via a `pulse:project` sessionStorage+CustomEvent handoff (the shared nav can't use useSearchParams under statically-prerendered dashboard pages), else NBLYCRO. Pure logic in `lib/client-library/pulse.ts` + `tests/pulse-shell.test.ts` (4 cases). `tsc` clean; `npm run build` green (`/dashboard/pulse` `○`, brand page `ƒ`, old route gone, redirect registered); tests 15/15 (pulse-shell 4 + directives 4 + monitoring 7); ESLint on all new/changed files zero findings (the 2 `set-state-in-effect` in `nav.tsx` are the untouched theme-flip egg cleanup, pre-existing on HEAD). §15.5 Phase E1 in-flight entry added; §15 Batch 012 phase-status gains the E-track (E1 in flight; E2 Convert sync; E3 rich directive rows; C now after E1). DC-internal — no AC contract surface. **Karen post-flight PASS-WITH-FINDINGS**: LOW-1 (brand→brand stale-content flash) FOLDED via a render-time `loadedFor`/`ready` staleness gate; two informational observations left as-scoped (audit `notes` still say "via Client Library" per spec §1; "← Pulse" restores the matrix pick, not the deep-linked brand's project). Re-verified tsc/build/15-tests/ESLint green after the fold. PUSHED by Lacey + auto-deployed 2026-07-21 (2-commit chain cfe374f → d315c50). This docs-only reconcile is committed but not itself pushed — Lacey pushes it. Prior (2026-07-17, v2.5): Docs-only §16 reconciliation (no code, no version bump): Batch 012 Client Library **Phase B (Monitoring Ingest)** SHIPPED. The push to main was accidental (not Claudette-driven) but production is live + auto-deployed and Lacey ran the spec §5 live smoke — all invariants verified against prod incl. dismissed-stays-dismissed on re-post. Per §13 r34 the §15.5 in-flight → §16 shipped move didn't auto-happen (non-Claudette push), so it's landed now: §15.5 Phase B in-flight entry REMOVED, full §16 shipped entry written. What shipped (commits `d046820` spec + `7c9fec3` code, amended to fold Karen LOW-1): migration 025 (`monitoring_findings` table [partial-unique (source, external_ref) WHERE external_ref IS NOT NULL; brand FK ON DELETE SET NULL; RLS mirrors 009] + `audit_log_target_shape_chk` extended to admit `monitoring_finding`, reproducing 024's full set, nothing dropped); external Bearer ingest `POST /api/monitoring/findings` (vs `CQIP_CONVERT_MONITORING_TOKEN`; inbound brand field is `brand` = code OR jira value, resolved server-side brand_code→jira_value→null; batch-capable MAX_BATCH=500; upsert on (source, external_ref) leaving status untouched on re-post; no per-ingest audit; `/api/monitoring/*` carved out of the middleware matcher); admin `PATCH /api/admin/monitoring/findings/status` (session+admin, one `target_type='monitoring_finding'` audit row); "Needs action" panel on `/dashboard/client-library` (view-for-all, admin-only dismiss/action, single fetch, unresolved-brand findings under "Unassigned"); `lib/client-library/monitoring.ts` + `tests/monitoring-findings.test.ts` (11/11 incl. directives). **Karen PASS-WITH-FINDINGS**: LOW-1 (intra-batch dedupe) FOLDED into `7c9fec3`; LOW-2 (identity fields frozen on re-post → unresolved findings stay "Unassigned") as-scoped, self-heal + manual-reassign deferred to §15 backlog. New env var `CQIP_CONVERT_MONITORING_TOKEN` in §4 + `.env.example`. §15 Batch 012 phase-status updated (A + B SHIPPED; **Phase C = Jira ticketing NEXT, gated on §1 Jira-create-permission verify — a §13 r5 read-only-scope expansion**; Phase D public bug form after C) + Phase B deferred follow-ons added (self-heal, manual reassign, toast cleanup, Phase-A cell-backfill/target-picker LOW-1); §15 priority block + SHIPPED list + header current-deployed-state (migrations now 001-025) updated; CROSS_CLAUDE.md §6 event-log entry appended (008/Pulse consumes this surface; inbound brand field is `brand`; DC-internal, no §3 change). Commit only — Lacey pushes. Prior (2026-07-15, v2.5): Docs-only priority resequence (no code, no version bump): new Batch 012 "Client Library" inserted (cross-brand experimentation — directive × brand status matrix + monitoring ingest + Jira ticketing + public bug form; 4 phases A–D, Phase A = shippable MVP; number 012 provisional-confirmed). Open sequence resequenced (Lacey 2026-07-15): 012 Client Library → 008 Convert.com → 006 Teams dispatch → 010.1 Pipeline alerts → 007 Custom Jira Boards; ClickUp Client Archive Phase 2 ETL + Phase 3 stay behind 006; admin QA-URL editor removal HOLD. 006 drops below 008 (externally parked on the alerts-channel build); 010.1 stays behind 006 (dependency preserved). Per-brand config pages ABSORBED into Batch 012 (no longer a standalone 008 prereq); 008 consumes the 012 Phase B monitoring-ingest surface. §15 priority block + backlog updated; CROSS_CLAUDE.md §5 mirrors + §6 event-log entry appended; the `CQIP Batch Outline` project file mirrors both. DC-internal — no AC contract surface. DO NOT PUSH — Lacey reviews. Prior (2026-07-09, v2.5): Batch 005.5 (Reggie brand-detail drawer polish) PUSHED + auto-deployed 2026-07-09 (2-commit chain `9e3a458` spec+§15.5 → `deda4c1` build; Karen PASS; Lacey smoke-tested both themes). Read-only render/interaction on the all-user brand-detail drawer (`brand-detail-drawer.tsx`, brand-name click) + one admin ride-along — NO migration/route/mutation, NO Jenny. #1 static "Last 6 months" label → native range `<select>` (Last 6 Months default / Last 12 Months; 6 reads `row.monthly`, 12 reuses the 005.4 `row.monthly12` field, not re-aggregated). #2 month bars clickable (recharts `<Cell>` per month + `<Bar onClick>`) → scope the ticket list to that month's non-deleted milestones for the brand (client-side over held `milestones`, no new fetch); header "Tests in {Month YYYY} (N)"; selected bar = `var(--f92-orange)` fill + `var(--f92-navy)` outline, others dim 0.3; reset via re-click or a "← last 28 days" control; empty month → "No tests in {Month YYYY}."; selection resets on brand/open change via a render-time reset (prevKey pattern, no effect → no `set-state-in-effect`). #3 dropped the THIS MONTH KPI card (grid `grid-cols-2` → `grid-cols-3`: This Week / Last Week / Rolling 28d). #4 ride-along: `ManageMilestonesDialog` gained `hideBrandFilter?: boolean` (default false); `BrandAdminDrawer` passes it so the redundant "Filter by brand" control is hidden on the brand-scoped Milestones tab (list stays pinned to `initialBrandId`); **QA-URL-pattern editor + column UNTOUCHED (HOLD — AC gate RED)**. Token discipline: new bar colors are tokens; the commit removed a pre-existing inline `#F47920` bar fill (tokenized to `var(--f92-orange)`); only remaining hex is the pre-existing recharts axis `stroke="#6B7280"` (verbatim, matches sibling charts). Files: `brand-detail-drawer.tsx`, `manage-milestones-dialog.tsx`, `brand-admin-drawer.tsx`. tsc clean, build green (`/dashboard/coverage` prerenders), `coverage-kpis` 5/5, ESLint zero findings. NO version bump (render/interaction only; stays v2.5). This docs-only on-ship reconcile moved the 005.5 §15.5 entry → §16 per r34; header current-deployed-state + §15 priority SHIPPED list + backlog pointer updated (admin filter-by-brand item (b) marked SHIPPED, (a) QA-URL stays HOLD; 006 now leads NEXT). DC-internal, no AC contract surface. Prior (2026-07-09, v2.5): Batch 005.4 (Coverage Ledger polish pass 2) PUSHED + auto-deployed 2026-07-09 (built/committed 2026-07-08; 2-commit chain `ea5f8a5` spec+§15.5 → `b4acb4e` build; Karen PASS; Lacey smoke-tested both themes). Read-only render/copy + one data-source swap on the ledger — NO migration/route/mutation/token/dep, NO Jenny. #1 This-Wk numeral reverted to zero-vs-nonzero (Delivered-28d kept on status color — partial revert of 005.3 §2.7); #2 `DeliverySparkline` repointed from the ~always-flat `daily7` (7-day) to a NEW 12-month `monthly12` field (`monthlyCounts(…,12,now)`) for the growth read — `monthly` (6mo, Reggie drawer) untouched, `daily7`/`dailyCounts` KEPT (parked for a future daily surface, documented), `DeliverySparkline` unchanged (n-agnostic); #3 linked stage-name `<button>` + non-linked `<span>` share a `STAGE_NAME_TYPE` const (`appearance-none`/`leading-none`) so computed typography is identical (UA button-leak fix); #4 deleted the "Bold = ready …" pipeline legend caption; #5 pipeline column header "Pipeline · ready / WIP" → "Ready / Gated" + WIP caption "…held by tags" → "…gated"; #6a `min-w-[3.25rem]` right-aligned ready/total label so bars left-align across rows; L1 removed the dead `LedgerRow.live` field + assignment + stale comment (closes Karen's 005.3 deferral; presence card reads via `stages[…]`/`LIVE_STAGE`, unaffected). Files: `coverage-ledger.tsx`, `queries.ts`. tsc clean, build green (`/dashboard/coverage` prerenders), `coverage-kpis` 5/5, ESLint zero findings. NO version bump (render/copy only; stays v2.5). Also PUSHED alongside (docs-only, commit `443b7c0`): the 2026-07-09 §15/CROSS §5 priority reslot — 005.5 (Reggie drawer polish) now leads NEXT, then admin-drawer changes → 006 → 010.1 → 007 → per-brand config → 008; ClickUp Client Archive discovery-first behind 006; new §15 backlog entries (005.5, admin-drawer changes, ClickUp Archive) + a later/deferred bucket (#6b resizable cols, #7 alert palette, #8/#9 expanded-panel → Claude Design, add-milestone form polish, coverage true-all-time decision); CROSS §6 appended two owed AC confirmations (admin-drawer QA-URL Forge-ownership; ClickUp dedup-key Jira custom field). This docs-only on-ship reconcile moved the 005.4 §15.5 entry → §16 per r34; header current-deployed-state + §15 priority SHIPPED list + backlog pointer updated. DC-internal, no AC contract surface. Prior (2026-07-09, v2.5): Batch 005.3 (Coverage Ledger polish) PUSHED + auto-deployed 2026-07-09 (built/committed 2026-07-08; 3-commit chain `619a259` spec+§15.5 → `97513b9` §2/§3 build → `f41f4b0` card merge). Read-only render/UX on the 005.2 ledger — NO migration, NO route, NO new mutation surface, NO new token, NO new dep, NO Jenny. §2.1 dropped the standalone "Live · ready/total" summary column (5→4 cols: Brand · Delivered 28d · This Wk · Pipeline; freed width → pipeline bar) — a live test never carries a hold tag (it becomes a quality log and leaves Live) so Live's ratio is always N/N; this SUPERSEDES the 005.2 §3.4 five-sortable-column contract → sort contract is now FOUR. §2.2 Live stage card shows presence ("N live", no /N) when clean (`stage === PIPELINE_STAGES[last] && held === 0`) with a DEFENSIVE fallback to the normal ready/total+bar+chips render if a tag ever lands on Live (held > 0 — mid-sync/cron-lag/dirty-history), so the anomaly surfaces; not hardcoded. §2.3 stage NAME is the drawer link ("LABEL →", navy→orange, hover/focus underline) when total > 0, "view →" retired, empty stage = plain span no arrow. §2.4 drawer subheader "N ticket(s) gated in {stageLabel}". §2.5 "Full detail →" text link → secondary/outlined button. §2.6 all-collapsed on load (already the behavior, verified). §2.7 Delivered-28d + This-Wk numerals colored by status (one numeralColor: paused→--f92-lgray, droughtFlag→--ledger-drought, else→--ledger-active) [Karen 005.2 L2]. §2.8 Paused legend swatch (--ledger-paused) via new showPaused prop, shown only when show-paused [Karen 005.2 L3]. §3 Expand-all/Collapse-all header buttons on the existing open Set (new Set(rows.map(id)) / new Set()), disabled when loading or no rows, survive sort. Commit 3 (card merge, layout-only): combined the two stacked top cards on /dashboard/coverage into ONE — ProjectBrandFilter gained an optional `actions?: ReactNode` prop rendered right-aligned in the Project row alongside Clear; the page's control-bar Card was deleted and its three controls (admin-gated Add brand, Show paused, Export) pass through actions={…} verbatim (same handlers/gate/disabled), no logic/state change. Files: coverage-ledger.tsx, page.tsx, pipeline-stage-drawer.tsx, project-brand-filter.tsx. tsc clean, build green (/dashboard/coverage prerenders), coverage-kpis 5/5, ESLint zero findings. NO version bump (render/UX + layout only — mirrors 005.2 commit-3; stays v2.5). This docs-only on-ship reconcile moved the §15.5 in-flight entry → §16 shipped (recording the 5→4 sort-contract supersede + the card merge) per r34; header current-deployed-state + §15 priority SHIPPED list updated. DEFERRED (Karen 005.3 L1, non-blocking): dead `LedgerRow.live` field + stale comment — trivial prune for the next ledger-touching batch; plus the still-deferred Reggie fold-in + BW CTA re-home (spec §6). DC-internal, no AC contract surface, no CROSS_CLAUDE §6 entry. Prior (2026-07-08, v2.5): Batch 005.2 (Coverage Ledger redesign) PUSHED + auto-deployed 2026-07-08 (3-commit chain `924437a` → `c23bf0a` → `c09608b`; on-ship reconcile moved §15.5 → §16 per r34, no code, no version bump). Commits 2 + 3 (Commit 1 = `924437a`, spec + design bundle, docs-only). Read-only render redesign — NO migration, NO new mutation route, NO schema change, NO Jenny (spec §9). Merges the Batch 010 split Output + Pipeline tables on `/dashboard/coverage` into ONE accordion "Coverage Ledger" (one row/brand, collapsed summary + inline expandable detail). Data layer: new `dailyCounts()` in `lib/coverage/queries.ts` + `daily7` on `CoverageRow` (7-day per-day buckets off the existing `milestones` state; no new query). New components: `DeliverySparkline` (added to `sparkline.tsx`; 212×58, tokenized `--ledger-spark-*`), `coverage-gauge.tsx` (SVG donut, mount rAF animation ease-out cubic, count-up, reduced-motion snap, null→'—'), `coverage-ledger.tsx` (7-col grid: chevron·rail·Brand·Delivered 28d·This Wk·Live·Pipeline; five sortable columns, expand preserved across sorts, default status-desc; expanded = 7-day sparkline + delivery stats + 5 pipeline-stage cards with status chips or "✓ all clear"; exports pure `buildLedgerRow` merging CoverageRow+PipelineBrand → per-stage ready/held, `ready` from `tickets[]` so two-tag tickets aren't double-subtracted). Page: split tables → `<CoverageLedger>`; new KPI strip (connected gap-px strip: teal long-range pair · four rolling-window cards · Overall Health gauge · Brands Covered · Quality Score gauge) — ALL FULL-SCOPE (`crossBrand`/`healthKpi`/`qualityKpi` off full state, never the filter/paused-scoped `ledgerRows`; 005.22 boundary preserved); drought/covered via the shared `isInDrought` predicate (005.1 Path 1). Preserved affordances: SyncJiraButton (header, pass/fail pill), Export, showPaused (muted rail for paused), admin gear→BrandAdminDrawer, AddBrandDrawer, ProjectBrandFilter, PipelineStageDrawer (per-stage "view →"), both footers (orphan-milestone + unresolved-pipeline). Reggie drawer (spec §6, Lacey-confirmed): kept as-is, row-click=expand, "Full detail →" link in the expanded panel opens it; BW CTA stays inside the drawer (NOT moved/folded — deferred follow-up). Chips = LOCKED §15 set of FOUR (Needs Info·Troubleshooting·On Hold·Awaiting, verbatim `Awaiting client input`); §15 supersedes the mock's 3 (Troubleshooting amber wired, forward-safe). Theming: new `--ledger-*` token block in `globals.css` (§13 r25) — dark pixel-matches the mock, light F92-conformant/desaturated ≥3:1, chip fills bright both themes (README solid-fill+near-black-text, background-independent AA → single-value); no inline hex, no dark island. Deliberate deviations (flagged for Karen): global overlay TOGGLES + `OverlayCountBadge`/`UntaggedCountBadge` DROPPED (mock has none; per-stage chips replace them — those two exports now unused, `TagBadge` still used by PipelineStageDrawer, left un-pruned); old monthly `Sparkline` export now unused on the page (Reggie drawer draws its own bars), left un-pruned; no actual typo found in "Show paused brands" (spec §4.5), copy already correct, left verbatim. tsc clean, build green (`/dashboard/coverage` prerenders), `tests/coverage-kpis.test.ts` 5/5, ESLint on all changed/new files ZERO findings (the two introduced during build — gauge `set-state-in-effect` + sort-button `aria-sort` — fixed before commit). Version bump v2.4 → v2.5 (structural: new component surfaces + token block + query helper, §13 r23). §16 shipped entry written + §15.5 removed in this docs-only on-ship reconcile (r34) — 005.2 now lives in §16 only; §15 backlog entry collapsed to a one-line "SHIPPED (see §16)" pointer; header current-deployed-state + §15 priority order updated. DC-internal, no AC contract surface, no CROSS_CLAUDE §6 entry. **Commit 3 (pre-push fixes, 2026-07-08; no version bump — same-batch follow-up):** (1) header space — subtitle rendered "2or fewer" (JSX dropped the space around `{COVERAGE_THRESHOLD}`) → single template-literal expression, constant interpolation kept; (2) On Hold → gray to match the app's blue/amber/gray convention (loud-solid chip kept) — `--ledger-chip-oh` #FB7185→#9CA3AF (both themes, near-black text ≈6.9:1 AA), `--ledger-seg-oh` light #E11D48→#4B5563 (gray-600 ≥3:1 on white) / dark #FB7185→#94A3B8 (slate-400); (3) L4 prune — removed dead monthly `Sparkline` (+useState import) and the three overlay-toggle exports `OverlayCountBadge`/`UntaggedCountBadge`/`OVERLAY_ACTIVE_CLASS` (+unused `OVERLAY_LABELS` import), `TagBadge`/`OVERLAY_STYLE` kept; (4) L5 dedupe — one exported `formatReworkRatio()` in `queries.ts` replaces the page + ledger duplicates. Chip loudness / KPI scope / drought predicate / all other logic UNCHANGED. tsc clean, build green, `coverage-kpis` 5/5, ESLint zero findings. Karen PASS on commit 3; Lacey smoke-tested both themes + PUSHED the 3-commit chain (924437a → c23bf0a → c09608b), auto-deployed 2026-07-08. Prior (2026-07-07, v2.4): Docs-only reconcile (no code — paths-ignore skips deploy, no version bump, no Karen/smoke): (1) Brand Wellness (731e160 → 0a6022b → 6248727 → 2068886) is now PUSHED + deployed 2026-07-07 — the batch's "DO NOT PUSH" is cleared in the header current-deployed-state + the footer BW narrative below. (2) §15 BW v2 "export/share" stub concretized into a downloadable, styled Brand Wellness report (brand multi-select 1/2/5/all → one richly-formatted PDF/branded doc, on the existing branded-export infra; own batch; adjacent to but not the same as multi-brand compare = a view). (3) §15 Batch 005.2 landed the LOCKED v1 pipeline-hold chip set (Lacey 2026-07-07; AC-verified vs `customfield_12528` "CRO Labels"): HOLD CHIPS = Needs info · On hold · Awaiting client input · Troubleshooting; NOT chips = Go live + Deployment (forward states) · Needs strategy (unused) · Paused (redundant w/ is_paused + Troubleshooting); wire "Awaiting client input" VERBATIM (not the dead "Awaiting Client" string). DO NOT PUSH (Lacey pushes). Prior code state — Batch Brand Wellness v1 (read-only milestone-history proof). A "coverage table broken" report (MOJ "empty") was a misread of a CORRECT drought flag (MOJ genuinely had 0 milestones in rolling-28d); Brand Wellness lets that self-serve. New `components/reports/brand-wellness-report.tsx` (sibling of scorecard/root-cause/client), wired into `/dashboard/reports` as a SELF-CONTAINED card + panel — NOT folded into the `ReportKind` union / `reportCards.map` (its controls differ: brand picker + 30/60/90 toggle, not from/to), so Batch 005.2 re-homes it trivially. Brand picker sources from the brands table (id/display_name/jira_value/brand_code, is_active), NOT `<BrandSelector>` (client_brand-string-keyed → would break brand_id resolution). Fetches all active brands + all non-deleted test_milestones once client-side (mirrors the coverage page's fetch-all-then-filter), filters client-side so picker + range re-derive instantly. Resolution: brand_id primary, brand_jira_value fallback scoped to null-brand_id rows (§13 r18) — documented divergence: buildCoverageRows + the Reggie drawer match brand_id ONLY, the fallback only adds genuinely-belonging unresolved legacy rows and is identical for well-resolved brands in the recent window (so it never contradicts the drought flag there). Headline = ALL-TIME last milestone ("Last milestone: <date> · N days ago · <ticket>" linking jira_ticket_url; "No milestones on record" when none) so a drought brand proves "last delivery N days ago" instead of reading empty; range toggle zooms the timeline/list only (deviation from the spec's range-filtered fetch, chosen for a meaningful proof headline). Dot timeline = recharts ScatterChart on a real time X-axis (domain [now-range, now], scale=time) so gaps read visually, no new dep; milestone list = date · milestone_type · ticket link · source, newest first, range-scoped. Reggie-drawer CTA: `brand-detail-drawer.tsx` gains a loose `<Link>` to `/dashboard/reports?wellnessBrand=<id>` (report reads the param on mount + preselects); comment notes 005.2 re-homes it. v1 OUT OF SCOPE (TODO comments): rework overlay, export/share, multi-brand compare. Two commits (`731e160` report + this drawer-CTA). tsc clean, build green, ESLint zero NEW findings (reports-page pre-existing any/unused-var/exhaustive-deps are original code, untouched). No migration, no Jenny (read-only report, no write surface). Version bump v2.3 → v2.4 (new report component surface). Karen post-flight PASS-WITH-FINDINGS → follow-up commits 3 (`6248727`) + 4 (this docs commit) close the one MEDIUM: **commit 3** scopes `belongsToBrand`'s `brand_jira_value` fallback to milestones OLDER than the fixed 28-day drought window (inside 28d: brand_id ONLY, exact parity with `countInWindow` — so the proof view can't surface a recent milestone the flag doesn't count; cutoff is nowMs−28d, NOT the 30/60/90 range); **commit 4** adds an all-user Output-table orphan footer on `/dashboard/coverage` mirroring the Pipeline `unresolvedCount` footer ("{n} milestone(s) not counted toward coverage — no brand linked.", from a memo over the existing `milestones` state, no new query). Backlog added: 010.1 scheduled orphan alert; OPS confirm §13 r18 backfill cadence; BW v1.1 per-dot "unresolved" badge (deferred). Commits 3+4 stay at v2.4 (same-batch follow-up, no new surface). tsc clean, build green, ESLint zero new (the 8 `static-components` on coverage SortableHeader/SortIcon are pre-existing). Karen re-check of commits 3+4: PASS. **PUSHED + deployed 2026-07-07** — the 4-commit BW chain (731e160 → 0a6022b → 6248727 → 2068886) is live; Lacey smoke-tested MOJ. Prior (2026-07-07, v2.3): Batch create-flow (user creation on real emails; the last @cqip.local source retired) — PUSHED + auto-deployed 2026-07-07 as commit 9c476f6, the tip of the auth chain (every ancestor auth commit deployed with it; migrations 022 + 023 applied with that deploy). Closes the seam Karen flagged on af647a6: login went email-only but user creation still minted username@cqip.local with "sign in with username" copy. `settings/users/page.tsx` create form: "Username" field → "Email" field reusing the edit-email `@fusion92.com` smart-default (`toFusionEmail`: bare local → @fusion92.com, anything with `@` verbatim) + "Will create: …" preview; Password relabeled "Temporary password"; `display_name` derived from the email local part via new `displayNameFromEmail()`; client `EMAIL_RE` + `@cqip.local` validation; deleted the now-unused `Input` import. Server `/api/admin/users` POST: removed the `account_type:'local'` → `username@cqip.local` mint — now requires a real email (lowercased, `EMAIL_RE`, `@cqip.local` rejected), creates the auth user with `email_confirm:true` (sends nothing) + inserts profile with `must_change_password:true` (forced change on first login), writes the existing CREATE/`role`/`target_type='user'` audit row, 409 on duplicate; no more `resetPasswordForEmail` invite; deleted orphaned `sanitizeUsername`. Stale copy fixed (Karen finding) + §2 Auth detail / §5 user_profiles / §9 User Accounts rewritten off the retired `@cqip.local` username model. `@cqip.local` now survives only in defensive guards + migration history. tsc clean, build green, ESLint zero NEW findings (only the pre-existing `set-state-in-effect` on the untouched login rate-limit effect). No migration (must_change_password exists from 022). Version bump v2.2 → v2.3. (Karen post-flight PASS-WITH-FINDINGS (2 LOW, non-blocking); PUSHED + auto-deployed 2026-07-07 as 9c476f6.) Prior (2026-07-06, v2.2): Batch auth-cleanup (final auth commit; login is now EMAIL-ONLY). Precondition met: Lacey migrated all 7 accounts to real fusion emails 2026-07-05 (no @cqip.local left, drift check clean). Two code changes + a docs sweep, no migration, no Jenny (removes a path, no new surface). (1) `app/login/page.tsx`: `resolveIdentifierToEmail()` drops the legacy `@cqip.local` synthesis fallback → just `trim().toLowerCase()` the input as an email; deleted the orphaned `toEmail()`/`normalizeUsername()` helpers (`LOCAL_SUFFIX` kept — still used by the reset guard); field label "Email or username" → "Email" (`type=email`, placeholder `you@fusion92.com`), subtitle updated, failed-login username nudge removed → plain `error?.message ?? 'Invalid login credentials.'`. (2) `settings/users/page.tsx` edit-email: fixed `@fusion92.com` suffix adornment + new `toFusionEmail()` helper appends the domain to a bare local part BUT treats any input containing `@` as a full address verbatim (non-F92/correction accounts stay possible), with a "Will set: …" preview; also removed the "Created" column (header+cell, colSpans 6→5; Last active stays; `created_at` still returned, just not rendered). Docs sweep (r23): §15 priority reorder (auth DONE → Brand Wellness → 005.2 → 006 → 010.1 → 007 → per-brand config → 008, Lacey 2026-07-05) mirrored to CROSS_CLAUDE.md §5; new §15 Brand Wellness entry (v1 per own commit, rework overlay/export = v2 deferred) + login-activity read-side entry (recording LIVE via `21df742`, read side pending); Batch 005.2 expanded to the Coverage Ledger redesign (accordion merging Batch 010's split tables, mockup-bundle path placeholder, 4 scope forks [Awaiting-Client tag / per-day sparkline / theming-vs-F92-tokens / ≤2-copy-vs-sort], render-only coupling to the 005.1 gauges, re-homes the Brand Wellness drawer CTA); auth.1 §15 entry marked rollout-DONE + cleanup-SHIPPED; `docs/batch-outline-2026-07-03.md` Azure line → DELIBERATE HOLD (Lacey's call, not stale-rot, do not re-flag). tsc clean, build green, ESLint zero NEW findings (only the pre-existing `set-state-in-effect` on the unchanged rate-limit effect, now line 92). Version bump v2.1 → v2.2. **DO NOT PUSH — Karen review next; DC smokes + pushes.** Prior (2026-07-06, v2.1): Batch login-events (login-activity recording, PLUMBING ONLY — no UI). Separate commit from the auth chain. Migration `023_login_events.sql` (idempotent): append-only `login_events` table (`id`, `user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE`, `occurred_at`) + index `(user_id, occurred_at DESC)`; RLS ON with `login_events_admin_select` (`public.is_admin()`) + `login_events_insert_own` (`WITH CHECK (user_id = auth.uid())`), no UPDATE/DELETE, no anon. Write path in `app/login/page.tsx`: after `signInWithPassword` succeeds and a session exists, a fire-and-forget `insert({ user_id: data.session.user.id })` into `login_events` — not awaited, `console.warn`-on-error, never blocks/errors the login; success-tail only so a FAILED login records nothing; `resolveIdentifierToEmail` / failed-login hint / reset flow / rate-limit effect all untouched (purely additive). No column/count/heatmap this batch — the read side (per-user count + GitHub-style heatmap, admin-only, plus the all-admins-vs-owner-only visibility decision from spec §8) is a later read-only batch (§15 backlog "Login-activity read side"). tsc clean, build green, ESLint zero NEW findings (only the pre-existing `set-state-in-effect` on the unchanged rate-limit effect). No Jenny (small additive plumbing per spec §8). Version bump v2.0 → v2.1 (new table + migration = structural, r23). Migration 023 must be applied in Supabase before this code deploys. **DO NOT PUSH — Karen review next; Lacey runs migration 023 + smoke-tests (one real login → exactly one row; failed login → none) + pushes.** Prior (2026-07-06, v2.0): Batch auth.1 (email migration + email-primary login) + Karen-HIGH Approach-C fix. Separate commit chain after auth.2. Dual-mode login in `app/login/page.tsx`: `resolveIdentifierToEmail()` — `@` → email (`trim().toLowerCase()`), else legacy `@cqip.local` synthesis KEPT as the `// TODO(auth.1-cleanup)` fallback; label → "Email or username". **Approach-C fix (Karen HIGH):** the first cut did a `user_profiles.display_name` lookup here to map username→email, but that lookup is dead from the unauthenticated login screen (RLS is authenticated-only, migration 005) — it always returned null and fell through to synthesis, so the H3 anti-lockout guarantee was silently absent. Dropped the lookup entirely (no resolver endpoint, no anon RLS policy, no migration); migrated users sign in via the `@` branch, nudged by a static hint appended to the failed-login message ("Switched to email login? Enter your email address." — no lookup, no directory disclosure). Same fix repairs the pre-existing broken reset flow (`handlePasswordReset` had the same dead lookup and never reached `resetPasswordForEmail`): `@`-input now calls it directly; non-`@` keeps the `@cqip.local` refusal; reset copy/label → "Email". New `set_email` PATCH action on `/api/admin/users`: `assertTargetIsReadOnlyOrSelf` guard [H2] (admin self-edit allowed, other admins blocked), RFC-ish + non-`@cqip.local` validation, dup pre-check (`.eq` on the lowercased email, not `.ilike` — the `_` wildcard could false-match [Karen LOW]; `auth.users` unique is the backstop); ordered two-write [M3] — `auth.admin.updateUserById({email, email_confirm:true})` (sends nothing) FIRST, then `user_profiles.email` with ONE retry, loud-fail naming which side won on persistent profile failure, NO rollback (auth-first = recoverable failure-landing state); audit `action='UPDATE'` + `field_name='email'` (not a literal `email_change` — same `audit_log.action` CHECK reason as auth.2). New `GET /api/admin/users` (admin-gated, service role) → profiles + `last_sign_in_at` + `auth_email` + per-row `email_drift` via `listUsers()`; users page switches its list load to it, adds a "Last active" column (relative; "Never" if null), a red "⚠ email drift" badge, and a per-row "Edit email" inline editor (self or read_only). [Karen LOW fold-in] all six user-audit sites refactored onto a new `writeUserAudit()` helper that wraps `getChangedBy()` + insert in try/catch (matches `/api/account/password-changed`). TODOs (comments): `display_name` no UNIQUE (ambiguous lookup at scale); `listUsers()` pagination. tsc clean, build green (`GET /api/admin/users` registers), ESLint zero NEW findings (the one `set-state-in-effect` error on `login/page.tsx` is pre-existing — the unchanged rate-limit effect; confirmed identical on HEAD in-place). NO migration, NO schema change → no version bump (matches the Batch 010 new-route precedent). Rollout (Lacey, post-push): edit the 7 emails one at a time (self first), inform users out-of-band; a cleanup commit removes the legacy fallback after all 7 migrate. Karen auth.1 post-flight was PASS-WITH-FINDINGS: this commit resolves the one HIGH (dead login lookup) via Approach C + folds the `.ilike` LOW; DC independently confirmed the RLS root cause in migration 005 before fixing. **DO NOT PUSH — Karen re-review next.** Prior (2026-07-05, v2.0): Batch auth.2 (admin temp-password reset + account-recovery hardening). UI-only follow-up (`d5fae92`): the forced-change flow renders the change-password form as a centered, NON-dismissable modal (no close/click-outside/Esc) over a dimmed backdrop, suppressing the rest of `settings/profile` behind it; former banner copy is the modal header; form extracted to a shared `renderChangePasswordForm(layout)` helper (modal stacked / Card 3-col). Submit logic, middleware gate, flag-clear route, and all auth/constraint logic UNCHANGED. tsc clean, build green, ESLint clean. No version bump (UI-only). DO NOT PUSH. Karen post-flight on the prior two commits returned PASS-WITH-FINDINGS (one Medium: middleware fail-closed for admins if migration 022 isn't applied before deploy — mitigated by the documented migration-first sequence; three Lows, all latent/mitigated). Commits so far: (1) docs-only `8b5505b` saved `docs/batch-auth-spec.md` (v3, Jenny-folded); (2) code commit `23878d1` built auth.2 from spec §3; (3) this UI-only follow-up. Migration `022_auth2_recovery.sql` (idempotent, three parts): `user_profiles.must_change_password` column + `audit_log_target_shape_chk` extended to admit `target_type='user'` [Jenny C1] + r22 trigger extended to `BEFORE UPDATE OF role, is_active, must_change_password` [Jenny M1]. `app/api/admin/users/route.ts`: `requireAdmin()` returns the cookie-bound client for `getChangedBy()` [M4]; new `assertTargetIsReadOnly` guard on ALL state-changing surfaces (set_temp_password/reset_password/generic role+is_active PATCH/DELETE) → 403 on admin targets [H1]; new `set_temp_password` action (server-gen 20-char pw, one-time `{temp_password}` + `Cache-Control:no-store`, never logged/persisted, sets flag); create/role/deactivate/reset now write `target_type='user'` audit rows (closes Jenny finding 4). New `POST /api/account/password-changed` clears the flag via service role (trigger-protected browser can't). `middleware.ts` consolidates the auth-dashboard profile lookup to one round-trip serving the new forced-change gate (flagged user pinned to `/dashboard/settings/profile`) + the existing r24 admin gate. `settings/profile/page.tsx` (corrected from spec's "layout" per Jenny M2) calls the flag-clear route after `updateUser` succeeds then redirects to `/dashboard`; forced-change banner while flagged. `settings/users/page.tsx`: "Set temp password" + one-time copy callout; admin rows show disabled controls + "Managed out-of-band". **Second CHECK gap found during build (parallel to C1): `audit_log.action` CHECK excludes the spec's literal `password_reset`/`email_change` — followed the codebase convention (`UPDATE`/`CREATE` + descriptive `field_name`) instead of a 4th migration part, so migration 022 stays at exactly three parts.** `tsc` clean, `npm run build` green (both new routes register), ESLint on changed files clean. §13 r35 added (app never mutates an admin + user-mutation audit + forced-change lifecycle); r22 extended; §5 schema updated. Version bump v1.9 → v2.0: structural (new column, new trigger scope, new route surface). DC-internal — no AC contract surface, no CROSS_CLAUDE §6 entry. **DO NOT PUSH — Karen review next; Lacey runs migration 022 + smoke-tests + pushes. auth.1 (email migration + dual-mode login + Last active/drift) is the NEXT, separate commit — not pulled forward.** Prior (2026-07-03, v1.9): Batch 005.1 CLOSE-OUT (Coverage redesign + BrandAdminDrawer). Two commits after Karen's full-chain post-flight (PASS-WITH-FINDINGS). Commit A (`eefc9f0`, code): `buildCoverageRows` + the five time-window helpers + `monthlyCounts` gained an injectable `now: Date = new Date()` (default preserves the page call site exactly), re-greening the Jenny-Critical exactly-THRESHOLD boundary test that had aged RED as of 2026-07-03 (production never affected — pill + KPI read the same wall clock at render); closes Karen Findings 1 + 3; suite 5/5, tsc clean, build green. Commit B (docs-only, this commit): §15.5 Batch 005.1 entry deleted + full §16 shipped entry written (r34); §15 backlog 5.1 closed; §15 priority re-sequenced per `docs/batch-outline-2026-07-03.md` (auth.2/.1 → 006 EXPANDED → 005.2 → 010.1 MERGED → 007 → per-brand config → 008); four new backlog entries (auth.1/.2, Batch 005.2 Coverage visual redesign, dashboard polish cluster, per-brand config pages); Batch 006 EXPANDED (edge-fn dispatcher, single channel, forward-only, self-announcing overflow cap, absorbs 5.21 cron-silence monitor, + daily morning digest); Batch 010.1 MERGED (absorbs former 010.2 + Path 2 off-by-one; per-brand targets on the brand record, BrandAdminDrawer tab as UI home, `contract_status` ≠ `is_paused`); 5.21 / Path 2 / 010.2 tombstoned to their new homes; Batch 007 banked the 2026-07-03 decisions (saved views via `board_views`, Jira-parity filter bar, compact-default density, last-synced + manual-sync CTA); Karen Finding 2 fixed (§5 schema-doc QA-config edit path now names the BrandAdminDrawer); `docs/batch-outline-2026-07-03.md` created + status flipped to ENCODED (CLAUDE.md canonical); CROSS_CLAUDE.md §5 priority mirrored + "Read at" header fixed to the local connector path per CC9. Version bump v1.8 → v1.9: Batch 005.1 is structural (new BrandAdminDrawer component surface + deleted `settings/coverage` page/route) per §13 r23. DC-internal — no AC contract surface, so no CROSS_CLAUDE §6 entry. DO NOT PUSH — Lacey smoke-tests Commit A and pushes both. Prior (2026-06-10, v1.8): Batch 005.1 Phase 3 (Commit 3) PUSHED to `main` as commit `48ee281` (ef3ab04..48ee281), triggering the §13 r30 auto-deploy to production: Coverage KPI row reorged into one 9-card grid (teal long-range pair moved to front; three new non-teal cards — Overall Health, Brands Covered N/M, Quality Score — wired to the Phase 2 `computeCoverageHealth()`/`computeQualityScore()` exports, full-scope guard honored). First Batch 005.1 phase to reach prod. No version bump (no schema/structural change). Prior (2026-06-05, docs-only): new §15.5 In-Flight Batches section (seeded with Batch 005.1 — Coverage redesign + BrandAdminDrawer, spec at docs/batch-005.1-coverage-redesign-spec.md, Jenny PASS-WITH-FINDINGS folded), new §13 rule 34 (in-flight lifecycle: §15 backlog → §15.5 → §16, exactly-one-home), §15 backlog additions (Drought predicate off-by-one check / Path 2; Batch 010.2 expanded to Brand contract management). No version bump — no structural code change. Prior (v1.8, 2026-06-03): Batch 010 (Coverage pipeline visibility). New cookie-bound server route `app/api/coverage/pipeline` runs LIVE JQL per active project (token-paginated `/rest/api/3/search/jql`) for the union of five pipeline stages (Strategy · Design · Dev · Queued · Live; Done + Reporting excluded), buckets by brand + stage in-route via the §13 r13/r28 chain, returns per-brand counts + overlay per-stage subsets + ticket lists + `unresolved_count`. No `jira_tickets` cache (Batch 007 owns that); read-only against Jira (§13 r5). Stage→status map + overlay-tag defs are the single source of truth in `lib/coverage/pipeline-stages.ts` (prose companion `docs/batch-010-pipeline-stage-map.md`, committed first on its own). Overlays confirmed at impl to live on Jira multi-select `customfield_12528` "CRO Labels" (NOT `labels`), exact casing "Needs info"/"Troubleshooting"/"On hold" — verified vs prod 2026-06-03. New build-safe lazy JQL helper `lib/jira/search.ts`. Coverage page split into Output (unchanged, keeps its pill) + Pipeline tables (counts are click→`PipelineStageDrawer`), three visual-only overlay toggles producing stacking per-count badges, teal long-range KPI accent via new `--kpi-longrange-*` tokens (WCAG AA, §13 r25). No migration; §13 r33 added. Build green, tsc clean, route 401s unauthenticated, data path validated against live prod. DO NOT PUSH — Lacey smoke-tests + deploys manually. Prior (v1.7, 2026-05-29): Batch 009 (SharePoint integration LIVE). Read-only Microsoft Graph proxy: three GET routes under `/api/sharepoint/*` (`/folder` enumerate, `/xlsx` parse Preview Links, `/image` stream bytes), `Sites.Selected` scope, 60s in-memory cache, share-id folder resolution, 25 MB image cap; `lib/sharepoint/*` helpers + `lib/api/sharepoint-bearer-auth.ts` (CQIP_SHAREPOINT_API_TOKEN, separate blast radius from brands token); middleware carveout for /api/sharepoint + /api/brands; no DB migration (stateless). Six new env vars (CQIP_SHAREPOINT_API_TOKEN + 4 Azure/SharePoint config + SHAREPOINT_SITE_PATH). Four SHIP-day deviations from DESIGN: D1 share-id resolution (alias-drift robustness), D2 xlsx_not_found→422 hard-fail, D3 xlsx-js-style not xlsx (CVE-removed 2026-04-26), D4 token per logical request. Live-Azure smoke green (Test Task 001 / WDG 07: 12 screenshots, 6 Preview Links rows). Closes §14 Planned SharePoint entry + §15 Batch 009 pending. AZURE_CLIENT_SECRET hygiene rotation still queued (Worker-only, Fri/Mon target). Commits c7afede + 98a6133 (Step 2) + this SHIP docs commit. Advisor credit: AC (day-one needs), Jenny + Karen (five-finding review). DO NOT PUSH — three-commit chain pushed by Lacey after eyeball. Prior (v1.6, 2026-05-27): Batch 011 (Node 24 CI bump + public /api/health probe) — `app/api/health/route.ts` always-200 JSON, deploy.yml setup-node 20→24 + smoke check /login→/api/health; committed-not-pushed, handed to Lacey. Prior (v1.5, 2026-05-26):* Batch 005.31a + Azure prereqs verification + CC-namespace finalization, shipped same-day across three commits. 005.31a: SUPABASE_SERVICE_ROLE_KEY added to GH Actions build env so admin route module-eval imports succeed during page-data collection; §13 r31 documents workflow_dispatch as the only path to test workflow edits given paths-ignore: .github/**. Azure verification: end-to-end Graph curl (token/site/drive children all 200) confirmed admin consent on Sites.Selected + per-site CRO grant were already in place; "SHIP gated on Azure prereqs" framing removed from 4 doc surfaces (CLAUDE.md §14 + §15, CROSS_CLAUDE.md, batch-009 spec) as a phantom blocker that had carried 23 days. CROSS_CLAUDE.md CC-namespace finalized at CC1-CC8 (§2); three originally-proposed rules moved to DC-local CLAUDE_RULES.md R19 (stale-status re-verification) / R20 (last-verified timestamps) / R21 (blocker reality-check) per AC namespace-fit review. CROSS_CLAUDE section numbering settled: §3 contract surfaces, §4 pending rotations, §5 priority, §6 event log. §13 r32 reworked from a standalone rule into a discoverability hook pointing at R21 (canonical), so the §13 entry and the CLAUDE_RULES.md rule don't drift.*
