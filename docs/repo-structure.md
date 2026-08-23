<!-- Extracted from CLAUDE.md §3 by the CLAUDE.md split batch, 2026-08-22.
     This is CURRENT AUTHORITY, not archive: it carries no r40 non-authority
     banner, and CLAUDE.md §13 r23 names it as a required destination on
     every ship. Keep it updated atomically with the code, same as before. -->

# Repository Structure

```
cqip/
├── CLAUDE.md                    # Project context: rules, live TODOs, §16 index
├── CLAUDE_RULES.md              # Behavior rules companion (see CLAUDE.md §13 r32)
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
│       ├── telemetry/
│       │   └── ac/route.ts                # Batch telemetry-ac: POST, Bearer
│       │                                     (CQIP_TELEMETRY_TOKEN). AC pushes draft/post
│       │                                     events; DC stores + renders on System Info.
│       │                                     Middleware-carved-out. 202/401/400/500.
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
│   │   ├── 016_pre_demo_security.sql   # Batch 004.6: user_profiles privileged-column
│   │   │                                  trigger; audit_log SELECT tightened to admin
│   │   ├── 017_audit_log_backfill_target.sql # Batch 004.9: backfill target_type/target_id
│   │   ├── 018_sync_runs.sql           # Batch 005.10: jira-sync pass/fail history
│   │   ├── 019_project_brand_model.sql # Batch 005.22 P1: brand_model + per-project
│   │   │                                  brand field + default_brand_id (§13 r28)
│   │   ├── 021_client_request_taxonomy.sql # Batch 005.29: +8 taxonomy rows
│   │                                        (1 Client Request category + 6
│   │                                        client-change-request subtypes + 1
│   │                                        unannounced "Base: New Account
│   │                                        Support" category placeholder)
│   │   ├── 022_auth2_recovery.sql      # Batch auth.2: must_change_password + audit
│   │   │                                  target_type 'user' + r22 trigger extension
│   │   ├── 023_login_events.sql        # Batch login-events: append-only login history
│   │   ├── 024_client_library_phase_a.sql # Batch 012 A: directives +
│   │   │                                  directive_brand_status (the Pulse matrix)
│   │   ├── 025_monitoring_findings.sql # Batch 012 B: external monitoring ingest
│   │   ├── 026_ac_telemetry.sql        # Batch telemetry-ac: ac_telemetry +
│   │   │                                  ac_version_seen + ac_telemetry_rejects
│   │   ├── 027_prune_grant_fix.sql     # revoke EXECUTE from anon/authenticated BY NAME
│   │   │                                  (026's REVOKE FROM PUBLIC was insufficient)
│   │   ├── 028_ai_review_pending.sql   # Batch classifier-1: ai_review_pending +
│   │   │                                  ai_confidence_band
│   │   └── 029_directives_unique_title.sql # Batch 012 CRUD: UNIQUE (project_key,title)
│   │                                        spanning archived rows. APPLIED TO PROD.
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
│   ├── backfill-convert-reconciliation.ts # One-shot (Batch 012): flips existing
│   │                                   Pulse matrix cell statuses to match real
│   │                                   Convert config for the 13 ACTIVE NBLY brands
│   │                                   (207 todo→done, 8 done→todo). UPDATE-only —
│   │                                   creates no directives/brands/cells; hard-fails
│   │                                   if a (title, brand) pair has no existing cell.
│   │                                   Idempotent, audit-logged (one row per CHANGED
│   │                                   cell), --dry-run default-safe. Reads
│   │                                   scripts/data/convert-reconciliation-backfill.csv.
│   │                                   Pure helpers (classifyRow, auditNote) are
│   │                                   exported + covered by
│   │                                   tests/convert-reconciliation.test.ts; main() is
│   │                                   entry-point-guarded so importing it starts no run
│   ├── normalize-quality-log-fields.ts # One-shot (Batch 005.28): maps historical
│   │                                   drift on issue_category / issue_subtype /
│   │                                   root_cause_initial / root_cause_final /
│   │                                   resolution_type to Jira-verbatim canonicals.
│   │                                   Idempotent, audit-logged, --dry-run default.
│   ├── load-nbly-goal-directives.ts  # One-shot (2026-07-22): the 65-directive goal load
│   ├── normalize-client-brand.ts     # One-shot (Batch 005.25): client_brand → canonical
│   │                                   brands.jira_value ("CODE - Display Name")
│   ├── smoke-graph-token.ts          # Ad-hoc: Azure AD client-credentials smoke check
│   ├── gen-build-info.js             # Prebuild: stamps build metadata + warns on the
│   │                                   CLAUDE.md size ceiling (§13 r41)
│   └── gen-archive-index.js          # Regenerates CLAUDE.md §16's archive index
│                                       (npm run archive:index / archive:index:check)
│
├── docs/
│   ├── schema.md                      # §5 extracted here 2026-08-22 (current authority)
│   ├── repo-structure.md              # This file — §3 extracted here 2026-08-22
│   ├── claude-archive/                # §13 r40: append-only HISTORY, never authority
│   │   ├── ORACLE.md                  # pre-split invariants + char baseline
│   │   ├── oracle-pre-split.json
│   │   ├── CLAUDE-critical-history.md # the old CRITICAL deployed-state paragraph
│   │   └── CLAUDE-16-2026-{pre-04,04,05,06,07,08}.md   # §16 entries by ship date
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
