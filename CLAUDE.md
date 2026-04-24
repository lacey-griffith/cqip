# CQIP — CRO Quality Intelligence Platform
## Claude Code Project Context File
### Fusion92 | CRO Department | v1.1

---

## CRITICAL: Read This First

This file is the single source of truth for this project. Every Claude Code session
starts here. Before writing any code, read this file completely. When in doubt about
a decision, check this file before asking the user. All major decisions are recorded
here so they don't need to be re-explained.

**Current deployed state:** Live at https://cqip.l-hay.workers.dev — Batch 001
has shipped. See §16 for the full shipped-features log.

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
- Client Coverage tracking (planned Batch 002 — brands table, test milestones,
  drought alerts)

---

## 2. Tech Stack — Simplified & Final

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 16 (React) | App Router, TypeScript |
| UI Components | shadcn/ui + Tailwind CSS | Use shadcn for all UI components |
| Charts | Recharts | All dashboard visualizations |
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
│   │   ├── page.tsx             # Home view (KPIs + charts + matrix rain)
│   │   ├── docs/
│   │   │   ├── page.tsx         # Docs home with QA tab guide
│   │   │   └── array-of-sunshine/page.tsx   # Password-gated egg dossier
│   │   ├── logs/
│   │   │   ├── page.tsx         # Log table view (title + batch actions)
│   │   │   └── [id]/page.tsx    # Log detail view
│   │   ├── reports/
│   │   │   └── page.tsx         # Saved report views + exports
│   │   └── settings/
│   │       ├── page.tsx         # Settings home
│   │       ├── profile/         # Avatar, photo upload, theme, password
│   │       ├── projects/        # Add/remove Jira projects
│   │       ├── alerts/          # Alert rule config
│   │       ├── users/           # User management (admin only)
│   │       └── audit/           # Admin change log viewer (Batch 001)
│   └── api/
│       └── jira/sync/route.ts   # Proxy to jira-sync edge function
│
├── components/
│   ├── ui/                      # shadcn components
│   ├── charts/                  # Recharts wrappers
│   ├── logs/                    # TicketLink, EditLogDialog, ConfirmDeleteDialog, MmiList
│   ├── dashboard/               # KPI cards, ActiveAlertsPanel, SyncJiraButton
│   ├── reports/                 # Scorecard, RootCause, Client reports
│   └── layout/                  # Nav, UserAvatar, EasterEggHost, ThemeProvider,
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
│   ├── easter-eggs/
│   │   ├── use-konami-code.ts
│   │   ├── use-loading-message.ts
│   │   └── use-typing-detector.ts
│   └── utils.ts
│
├── supabase/
│   ├── config.toml
│   ├── migrations/              # All SQL migrations, numbered
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_user_profile_updates.sql
│   │   ├── 003_admin_setup.sql
│   │   ├── 004_theme_and_patterns.sql
│   │   ├── 005_rls_all_tables.sql
│   │   ├── 006_radara_config.sql
│   │   ├── 007_avatar_patterns.sql     # Avatar patterns refresh + photo upload
│   │   └── 008_easter_egg_stats.sql    # Egg trigger counter + RPC
│   └── functions/               # Deno Edge Functions
│       ├── jira-webhook/index.ts       # Receives Jira webhook events
│       ├── jira-sync/index.ts          # On-demand + scheduled sync of open logs
│       └── radara-sweep/index.ts       # Radara's triage sweeps (not deployed yet)
│
├── scripts/
│   ├── field-discovery.ts       # One-time: maps Jira custom field IDs
│   ├── import-csv.ts            # One-time: imports historical CSV data
│   ├── fix-dates.ts             # One-time: backfills triggered_at from CSV
│   ├── seed-alert-rules.ts      # One-time: seeds default alert_rules
│   └── backfill-brands.ts       # On-demand: re-syncs null client_brand rows
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
Migrations 001–008 have all run against the production project.

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
  triggered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at         TIMESTAMPTZ
);
```

**Known gap:** alert rules evaluate and create `alert_events` rows, but Teams
webhook dispatch is NOT wired. See §14 and §15.

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

All accounts created and have logged in at least once.

**Account creation:** Admin-only. No self-registration. Supabase Auth handles
username/password. Admin invites users from the Settings → Users panel.

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

All rules notify: `["teams", "in_app"]`. In-app works; Teams dispatch is not
yet wired — alert_events rows are created but no Teams POST happens.

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

9. **Teams notifications** include: rule name, trigger reason, client brand,
   project key, log ID, and a direct link to the CQIP log detail page.
   Dispatch is NOT YET WIRED — alert_events rows are created but no Teams POST
   happens. See §15.

10. **Webhook security.** Validate incoming Jira webhooks against WEBHOOK_SECRET.
    Reject any request that fails validation with 401. Secret accepted via
    `?secret=` query param or `X-Webhook-Secret` header; timing-safe compare.

11. **Easter egg stats.** Egg triggers are counted in `easter_egg_stats`.
    Increment via `increment_easter_egg(p_name)` RPC (SECURITY DEFINER).
    Counts only fire on successful triggers, not page views.

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
- **Teams webhook dispatch** — in-app alerts fire, Teams POST does not. Planned
  as a dedicated batch after Client Coverage.
- **Client Coverage section** — new /dashboard/coverage route, brands table,
  test_milestones table, drought alert rule. Planned as Batch 002.
- **Radara Edge Function deploy** — code is committed at
  `supabase/functions/radara-sweep/index.ts` but not deployed.

---

## 15. Pending / Active TODOs

- [ ] **Teams alert dispatch** — biggest functional gap. Alert rules evaluate
      and write alert_events but no Teams webhook POST. Dedicated batch after
      Batch 002.
- [ ] **Radara Edge Function deploy** — run
      `npx supabase functions deploy radara-sweep` when ready.
- [ ] **Jira QA-tab clear automation** — configure in Jira UI as an Automation
      rule when ticket enters Dev Client Review.
- [ ] **Client Coverage** — Batch 002.
- [ ] **Remove diagnostic `client_brand` warn blocks** from jira-webhook and
      jira-sync edge functions after 1–2 weeks of clean operation (added Batch 001).
- [ ] **CQIP_SYNC_AUTH_KEY** — set via `npx supabase secrets set` AND
      `npx wrangler secret put`; values must match on both sides
      (Batch 003.5 hotfix — decouples Worker → jira-sync auth from
      Supabase-managed key rotations).
    - [ ] **Also re-point the existing Supabase pg_cron job** that fires
          jira-sync every 6 hours — it was configured manually in the
          dashboard with the old anon/service-role apikey and will
          401 silently after the auth flip. Edit the schedule's
          request URL to use `?apikey=<CQIP_SYNC_AUTH_KEY value>`
          (or unschedule + reschedule). No code path in this repo
          pins that schedule, so there's no migration to update.

### Recently completed (was pending, now done)
- [x] Supabase project (ID: hupklpjruveleaahufmw)
- [x] Cloudflare Worker deploy + all secrets set
- [x] `nbly_brand` Jira field ID confirmed as `customfield_12220`
- [x] Team user accounts created (Lacey, Xandor, Katy, Mark, Jacob, Randy, Zach)
- [x] Jira webhook registered
- [x] Jira sync cron scheduled

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

### Batch 001.5 — April 2026 (in progress)
- F92 shimmer rebuilt as three explicit layer divs (pseudo-element
  approach wasn't rendering)
- Sunshine counter moved to only fire on successful password unlock
- Three-dot menu replaces inline Edit/Delete buttons on logs page

---

*Last updated: April 2026 | Updated for CQIP v1.1 post Batch 001 + 001.5*
