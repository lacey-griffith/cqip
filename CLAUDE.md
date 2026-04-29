# CQIP — CRO Quality Intelligence Platform
## Claude Code Project Context File
### Fusion92 | CRO Department | v1.5

---

## CRITICAL: Read This First

This file is the single source of truth for this project. Every Claude Code session
starts here. Before writing any code, read this file completely. When in doubt about
a decision, check this file before asking the user. All major decisions are recorded
here so they don't need to be re-explained.

**Current deployed state:** Live at https://cqip.l-hay.workers.dev.
All Batch 001-002.5b features shipped. Recent shipped (April 2026):
Batch 003 (branded exports + dashboard click-drill), Batch 003.5
(CQIP_SYNC_AUTH_KEY decoupling), Batch 004.0 (pg_cron jira-sync
setup), Batch 004.1 (milestone branch hardening), Batch 004.2
(dependabot triage + xlsx removal), Batch 004.3 (audit-write security
cleanup, Migration 014), Batch 004.4 (drought rule evaluator,
Migration 015), Batch 004.5 (Brands QA-config extension, Migration
013), Batch 004.6 (pre-demo security batch, Migration 016 — pending
manual run), Batch 004.7 (active alerts panel — brand-scoped render
path, fixes drought-event TypeError), Batch 004.8 (middleware
admin-route gate). All migrations 001-015 have run against
production; 016 lands separately ahead of the Tue May 5 demo. Batch
004.4.5 produced a UX discovery plan for Coverage + Settings reorg
(Batch 005 implementation). See §16 for full shipped log.

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
| Source + CI/CD | GitHub + GitHub Actions | Auto-deploy on push to main |

**No separate backend server.** All serverless logic runs in Supabase Edge Functions.
**No email alerts.** Teams + in-app only.
**No Render, Railway, or any other backend host.**

**Auth detail:** usernames only. Under the hood auth uses `username@cqip.local` fake
emails, but the login form only asks for a username (e.g. `lacey`, `xandor`).

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
│   │   │   └── page.tsx         # Client Coverage table (Batch 002): KPIs, drought flags,
│   │   │                          sparklines, brand detail drawer, paused-row treatment,
│   │   │                          per-column sort, leadership-ready CSV/XLSX export
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
│   │       ├── coverage/        # Admin: pause/unpause brands, manage milestones (Batch 002)
│   │       └── system/          # Admin: build stamp + system info (Batch 003)
│   └── api/
│       ├── admin/
│       │   ├── brands/
│       │   │   ├── pause/route.ts          # Batch 004.3: server-side pause/unpause
│       │   │   └── qa-config/route.ts      # Batch 004.5: brand QA config UPDATE
│       │   ├── milestones/
│       │   │   ├── route.ts                # Batch 004.3: create + restore-soft-deleted
│       │   │   └── [id]/route.ts           # Batch 004.3: edit + soft-delete
│       │   └── users/route.ts              # Admin user create/manage (server-only)
│       ├── brands/
│       │   ├── [projectKey]/[brandCode]/route.ts # Batch 004.5: Bearer-auth, single-brand read
│       │   └── route.ts                    # Batch 004.5: Bearer-auth, list-by-project
│       ├── logs/edit/route.ts              # Server-side edit endpoint
│       └── jira/sync/route.ts              # Proxy to jira-sync edge function (forwards CQIP_SYNC_AUTH_KEY)
│
├── components/
│   ├── ui/                      # shadcn components + SplitButton (Batch 003)
│   ├── charts/                  # Recharts wrappers
│   ├── logs/                    # TicketLink, EditLogDialog, ConfirmDeleteDialog, MmiList,
│   │                              LogDetailDrawer (Batch 003), three-dot action menu
│   ├── coverage/                # BrandDetailDrawer, ManageMilestonesDialog, Sparkline (Batch 002),
│   │                              EditBrandQaConfigDrawer (Batch 004.5 — sheet drawer for
│   │                              editing per-brand QA-automation config; opens from
│   │                              /dashboard/settings/coverage)
│   ├── dashboard/               # KPI cards, ActiveAlertsPanel, SyncJiraButton, LogDrawer
│   │                              (shared click-to-filter drawer, Batch 003)
│   ├── reports/                 # Scorecard, RootCause, Client reports
│   └── layout/                  # Nav (sticky-bottom docs + F92 atom + clouds + shooting stars),
│                                  UserAvatar, EasterEggHost, ThemeProvider,
│                                  F92Logo (inline SVG atom), IdleTimeout, Toaster
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   └── server.ts            # Server Supabase client
│   ├── jira/
│   │   ├── client.ts            # Jira API calls (Node/Next)
│   │   └── field-map.ts         # Custom field ID mappings (see §7)
│   ├── alerts/
│   │   └── rules.ts             # Alert rule evaluation logic
│   ├── audit/
│   │   └── get-changed-by.ts    # Batch 004.3: canonical helper for server-side
│   │                              `changed_by` derivation (see §13 rule 19)
│   ├── api/
│   │   └── bearer-auth.ts       # Batch 004.5: timing-safe Bearer compare for
│   │                              /api/brands/* routes (CQIP_BRANDS_API_TOKEN)
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
│   │   └── 015_alert_events_brand_id.sql # Batch 004.4: alert_events.brand_id +
│   │                                        CHECK + indexes; audit_log target-shape
│   │                                        CHECK extended to allow 'alert_event'
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
│   └── gen-build-info.js             # Prebuild: stamps build metadata for Settings → System
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
```

### Where they're set
- **Local dev:** `.env.local` at repo root (gitignored)
- **Cloudflare Worker:** `npx wrangler secret put SECRET_NAME` for each
- **Supabase Edge Functions:** set in Supabase dashboard → Edge Functions → Secrets

### .env.example
Committed to repo with all keys present but empty values.

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
  is_deleted                  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_quality_logs_ticket ON quality_logs(jira_ticket_id);
CREATE INDEX idx_quality_logs_project ON quality_logs(project_key);
CREATE INDEX idx_quality_logs_brand ON quality_logs(client_brand);
CREATE INDEX idx_quality_logs_status ON quality_logs(log_status);
CREATE INDEX idx_quality_logs_severity ON quality_logs(severity);
CREATE INDEX idx_quality_logs_triggered_at ON quality_logs(triggered_at DESC);
CREATE INDEX idx_quality_logs_not_deleted ON quality_logs(is_deleted) WHERE is_deleted = FALSE;
```

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
Active and inactive Jira projects being monitored.

```sql
CREATE TABLE projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_project_key  TEXT UNIQUE NOT NULL,   -- e.g. 'NBLYCRO'
  client_name       TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  jira_project_url  TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at    TIMESTAMPTZ
);
```

### user_profiles
Extends Supabase auth.users with role info. Auth uses `<username>@cqip.local`
fake email under the hood.

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
  avatar_url          TEXT        -- profile photo URL (Supabase Storage)
);
```

**`role` and `is_active` are trigger-protected** (migration 016, Batch
004.6). A `BEFORE UPDATE OF role, is_active` trigger raises
`insufficient_privilege` when `auth.uid()` is set and the caller is
not an admin, even if RLS would otherwise permit the row update. The
existing `user_profiles_self_update` policy (migration 005) is still
row-level only, so the trigger is the sole defense against a read-only
user mutating their own role / is_active via supabase-js. Service-role
calls (auth.uid() IS NULL) bypass the trigger so `/api/admin/users`
can still toggle these columns. See §13 rule 22.

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

The QA columns are edited from `/dashboard/settings/coverage` via the
`EditBrandQaConfigDrawer`, which calls `PATCH /api/admin/brands/qa-config`.
That route writes the brand row with the service role and emits one
audit_log row per changed field with `target_type = 'brand'` and
`changed_by` derived server-side from `auth.uid()` per §13 rule on
audit-write attribution.

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

### audit_log generalization (migrations 011 + 012 — Batch 002.5b)
Original `audit_log` had `log_entry_id NOT NULL` with FK to
`quality_logs`, so milestone and brand mutations had no place to land.
Migration 011 made `log_entry_id` nullable, added a generic
`(target_type, target_id)` pair, and a CHECK constraint that enforces:

- `target_type = 'quality_log'` requires `log_entry_id IS NOT NULL`, OR
- `target_type IN ('test_milestone','brand','alert_event')` requires `target_id IS NOT NULL`

(Migration 015 added `'alert_event'` to the allowed list so the
drought evaluator's start/end audit rows can reference an
`alert_events.id`.)

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

### Brand Resolution Flow (used by webhook + backfill + coverage UI)
For a Jira `customfield_12220` value (e.g. `"MRA - Mr Appliance"`):

1. `extractBrand()` normalizes the raw shape (string, single-select
   `{value}`, cascading `{value, child:{value}}`, or array of those).
2. Look up `brands.jira_value = <extracted>` → got `brand_id`? Done.
3. Otherwise, look up `brand_aliases.jira_value = <extracted>` → got
   `brand_id`? Done.
4. Otherwise, log a warning (`[jira-webhook] milestone: no brand or
   alias match for ...`) and proceed with `brand_id = NULL`.
   `test_milestones.brand_id` is nullable, and `brand_jira_value` is
   stored verbatim so a later alias seed can backfill the FK.

The backfill (`scripts/backfill-milestones.ts`) follows the same flow
and surfaces unmatched strings so we can patch `brand_aliases`.

### Webhook registration
Webhook URL format (live):
```
https://hupklpjruveleaahufmw.supabase.co/functions/v1/jira-webhook?secret=<WEBHOOK_SECRET>&apikey=<ANON_KEY>
```
Jira can't send custom headers — we pass `secret` as query param (with timing-safe
comparison) and `apikey` as query param. See `supabase/functions/jira-webhook/index.ts`.

### Jira-side automation (TO DO — manual config in Jira UI)
When a ticket enters `Dev Client Review`, clear all QA tab custom fields on that
ticket so the next rework cycle starts clean. Configure as a Jira Automation rule
in Project Settings → Automation. CQIP stays read-only against Jira (see §13 rule 5).

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
  nbly_brand:                 'customfield_12220',  // Select List (single)
} as const;
```

### Field Type Notes
- `who_owns_fix` is a **cascading select** — returns parent/child object.
  Extract: `field?.child?.value ?? field?.value ?? null`
- `detected_by` is a User Picker — extract: `field?.displayName ?? null`
- Checkbox fields return an array — check `field?.length > 0` for boolean conversion
- Multi-select fields return arrays of `{value, id}` objects — map to `value` strings
- `nbly_brand` is a single select returning `{ value: "CODE - Display Name", id }`
  — e.g. `{ value: "MRA - Mr Appliance", id: "13743" }`. NOT cascading. The
  `client_brand` column stores the full "CODE - Display Name" string.

### Diagnostic logging (temporary)
Both `jira-webhook/index.ts` and `jira-sync/index.ts` currently log a warning
when `client_brand` resolves to null. Leave this in place for 1–2 weeks after
the Batch 001 backfill, then remove the warn block from both functions.

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
Supabase Auth handles username/password under the hood; usernames map
to `<username>@cqip.local` fake emails.

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
    follow `brands.jira_value → brand_aliases.jira_value → null`.
    Never invent a brand row. Unmatched strings get logged and stored
    verbatim in `brand_jira_value` so an alias seed can backfill later.

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
    insert. Order of attempts for brand value:
    (1) webhook payload's `customfield_12220`,
    (2) `getIssue()` fallback (wrapped in its own try/catch),
    (3) `null`.
    Payload wins on conflict — it is the authoritative snapshot of the
    transition that just happened, and matches the state Jira fired the
    webhook from. Null `brand_id` rows are recoverable via
    `scripts/backfill-milestones.ts`. Reason: losing the milestone fact
    because an unrelated Jira call failed (token expiry, transient
    outage) is unacceptable. Batch 004.1 hardening; incident
    2026-04-24 NBLYCRO-1452.

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

22. **`user_profiles.role` and `user_profiles.is_active` are
    trigger-protected; cron / service-role writers bypass via the
    `auth.uid() IS NOT NULL` guard.** Migration 016 (Batch 004.6)
    adds a `BEFORE UPDATE OF role, is_active` trigger on
    `user_profiles` that raises `insufficient_privilege` when the
    caller has `auth.uid()` set and is not an admin. This closes the
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
    Any future code that toggles `role` or `is_active` from the
    browser must go through a server route that uses the service
    role; cookie-bound clients will hit the trigger. The trigger is
    intentionally tight — only those two columns; benign self-updates
    (theme, avatar, color) continue to use the existing self-update
    RLS policy.

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

### Identified for v1.5 (post-v1)
- **Multi-client readiness** — extending CQIP from NBLY-only to support
  arbitrary CRO clients without manual code changes per onboarding.
  Batch 004.99 (post-Batch-004) is the discovery exercise that produces
  the remediation plan.
- **Test milestone count exclusion flag** — admin-set
  `excluded_from_count` boolean with required reason; admin restore;
  Coverage queries respect the flag. Tracked as Batch 5.8.

---

## 15. Pending / Active TODOs

### Pre-demo / immediate
(Empty — all demo-prep items shipped via Batch 004 series.)

### Awaiting external action
- [ ] **Forge consumer integration** — dashboard side of the brands
      API is shipped; Forge app (separate repo, Atlassian Forge
      platform) is drafting v0.0.4 spec. No production traffic on
      `/api/brands/*` until Forge consumer goes live. Tracked
      cross-project; not actionable on dashboard side.
- [ ] **SharePoint integration** — Carl is configuring Azure
      application registration with `Sites.Selected` scope on the
      CRO site. Blocked on his timeline. Not actionable on
      dashboard side until Azure is ready.

### Batch 004.99 (post-Batch-004) — Multi-Client Readiness Review
Discovery batch. Identifies all NBLY-hardcoded assumptions in CQIP
and produces a remediation plan. Doesn't ship code itself — produces
a markdown report (similar to Batch 004.4.5).

- [ ] Audit `JIRA_FIELD_MAP` for NBLY-specific fields (e.g.,
      `nbly_brand`)
- [ ] Audit jira-webhook JQL filter (currently `project = NBLYCRO`)
- [ ] Audit brand extraction logic in jira-webhook (uses
      `customfield_12220`, NBLY-specific)
- [ ] Audit Coverage page filters/labels for hardcoded NBLY
      assumptions
- [ ] Audit CSV import script for NBLY-specific column mappings
- [ ] Document onboarding playbook (how to add a new CRO client)
- [ ] Document offboarding playbook (deactivate without losing
      history)
- [ ] Identify any UI labels/copy that say "NBLY"

### Batch 005 (post-demo) — Backlog cleanup, scope-locked
Strict rule: only items already in scope at lock time. No new
additions.

- [ ] **5.1 Coverage + Settings UX redesign** — implement per Batch
      004.4.5 plan. Decision locked: tabs (Details / QA Config /
      Milestones / Pause) inside a unified `BrandAdminDrawer`,
      not multi-drawer. Phased: Phase 1+2 (admin actions to
      Coverage) + Phase 3 (delete settings page). Phase 4 cosmetic
      polish optional.
- [ ] **5.2 Jira token-expiry monitoring** — Teams alert when Jira
      API returns 401/404 from sync or webhook. Calendar-style
      early warning. Prevents silent breakage like the 2026-04-23
      token-expiry incident.
- [ ] **5.3 Remove diagnostic `client_brand` warns** — jira-webhook
      and jira-sync edge functions log warnings when client_brand
      resolves to null. Was added during Batch 001 backfill
      diagnostics. Has been clean for ~2 weeks; safe to remove.
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

### Batch 006 (post-demo) — Teams webhook dispatch (dedicated)
Wires `alert_events` rows to actually fire Teams notifications.
Until this batch ships, alerts accumulate silently in the database.

- [ ] Dispatch service (edge function or server route)
- [ ] Rate limiting
- [ ] Retry with exponential backoff
- [ ] Adaptive Card / message card formatting per rule type
- [ ] Test mode toggle in Settings → Alerts
- [ ] Mark `notification_sent = TRUE` on success
- [ ] Detect 401/403 from Teams webhook (rotation grace handling)

### Ops / deferred
- [ ] **Radara Edge Function deploy** — code committed at
      `supabase/functions/radara-sweep/index.ts` but not deployed.
- [ ] **Jira QA-tab clear automation** — configure as Jira UI
      Automation rule when ticket enters Dev Client Review.
      Manual config; CQIP stays read-only against Jira.

### Randy items (Cloudflare org-level — when he's back)
- [ ] Cloudflare Workers Paid billing transfer (currently Lacey
      personal card)
- [ ] Worker ownership transfer to F92 Cloudflare org
- [ ] Demo date confirmation (Sammy's slot, otherwise next week)
- [ ] CQIP success metrics check-in
- [ ] Guest account setup for demo

---

## 16. Shipped Features Log

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
- **What's NOT in this batch:** the audit `target_type` cleanup for
  jira-webhook / jira-sync (Finding 7 / PROMPT C) is the last
  pre-demo follow-up batch; will land as Batch 004.9.

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

*Last updated: 2026-04-29 | CQIP v1.5 — comprehensive sync after
Batches 004.0, 004.1, 004.2, 004.3, 004.4, 004.5, 004.6, 004.7, 004.8*
