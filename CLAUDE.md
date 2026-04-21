# CQIP — CRO Quality Intelligence Platform
## Claude Code Project Context File
### Fusion92 | CRO Department | v1.0

---

## CRITICAL: Read This First

This file is the single source of truth for this project. Every Claude Code session
starts here. Before writing any code, read this file completely. When in doubt about
a decision, check this file before asking the user. All major decisions are recorded
here so they don't need to be re-explained.

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
| Frontend | Next.js (React) | App Router, TypeScript |
| UI Components | shadcn/ui + Tailwind CSS | Use shadcn for all UI components |
| Charts | Recharts | All dashboard visualizations |
| Backend + DB + Auth | Supabase | Edge Functions (webhook/sync logic), Postgres, Auth |
| Hosting | Cloudflare Workers (via @opennextjs/cloudflare) | Deployed with `wrangler deploy` from the repo. Workers + Assets supersedes Pages for Next 16 builds. |
| Notifications | Microsoft Teams Incoming Webhooks | In-app alerts + Teams only. NO email. |
| Source + CI/CD | GitHub + GitHub Actions | Auto-deploy on push to main |

**No separate backend server.** All serverless logic runs in Supabase Edge Functions.
**No email alerts.** Teams + in-app only.
**No Render, Railway, or any other backend host.**

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
├── components.json              # shadcn config
│
├── app/                         # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                 # Redirects to /dashboard or /login
│   ├── login/
│   │   └── page.tsx
│   ├── dashboard/
│   │   ├── page.tsx             # Home view (KPIs + charts)
│   │   ├── logs/
│   │   │   ├── page.tsx         # Log table view
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Log detail view
│   │   ├── reports/
│   │   │   └── page.tsx         # Saved report views + exports
│   │   └── settings/
│   │       ├── page.tsx         # Settings home
│   │       ├── projects/        # Add/remove Jira projects
│   │       ├── alerts/          # Alert rule config
│   │       └── users/           # User management (admin only)
│   └── api/
│       └── ...                  # Any Next.js API routes if needed
│
├── components/
│   ├── ui/                      # shadcn auto-generated components
│   ├── charts/                  # Recharts wrappers
│   ├── logs/                    # Log table, log detail, log form
│   ├── dashboard/               # KPI cards, alert panel
│   └── layout/                  # Nav, sidebar, header
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   └── server.ts            # Server Supabase client
│   ├── jira/
│   │   ├── client.ts            # Jira API calls
│   │   └── field-map.ts         # Custom field ID mappings (see §7)
│   ├── alerts/
│   │   └── rules.ts             # Alert rule evaluation logic
│   └── utils.ts
│
├── supabase/
│   ├── migrations/              # All SQL migrations, numbered
│   │   └── 001_initial_schema.sql
│   ├── functions/               # Edge Functions
│   │   ├── jira-webhook/        # Receives Jira webhook events
│   │   │   └── index.ts
│   │   └── jira-sync/           # Periodic sync of open logs
│   │       └── index.ts
│   └── config.toml
│
└── scripts/
    ├── field-discovery.ts       # One-time: maps Jira custom field IDs
    └── import-csv.ts            # One-time: imports historical CSV data
```

---

## 4. Environment Variables

### Required (set in Supabase Edge Function secrets AND .env.local for dev)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
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
```

### .env.example (committed to repo, no real values)
Create this file with all keys present but empty values.

---

## 5. Database Schema

All tables in Supabase Postgres. UUIDs for all IDs. RLS enabled on all tables.

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

-- Index for common query patterns
CREATE INDEX idx_quality_logs_ticket ON quality_logs(jira_ticket_id);
CREATE INDEX idx_quality_logs_project ON quality_logs(project_key);
CREATE INDEX idx_quality_logs_brand ON quality_logs(client_brand);
CREATE INDEX idx_quality_logs_status ON quality_logs(log_status);
CREATE INDEX idx_quality_logs_severity ON quality_logs(severity);
CREATE INDEX idx_quality_logs_triggered_at ON quality_logs(triggered_at DESC);
CREATE INDEX idx_quality_logs_not_deleted ON quality_logs(is_deleted) WHERE is_deleted = FALSE;
```

### audit_log
Every create/update/delete on quality_logs is recorded here.

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

### users
Managed by admin. Auth handled by Supabase Auth (users table auto-created).
This table extends Supabase auth.users with role info.

```sql
CREATE TABLE user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'read_only'
                  CHECK (role IN ('admin','read_only')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
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
  config                JSONB NOT NULL,  -- rule-specific parameters
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

### saved_reports

```sql
CREATE TABLE saved_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  created_by    TEXT NOT NULL,
  filters       JSONB NOT NULL,  -- serialized filter state
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

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

---

## 7. Jira Custom Field ID Mapping

**Source:** fusion92.atlassian.net

```typescript
// lib/jira/field-map.ts
export const JIRA_FIELD_MAP = {
  // QA Tab fields
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

  // Details section
  nbly_brand:                 'PENDING',            // ← USER TO PROVIDE
} as const;
```

**⚠️ PENDING:** The `nbly_brand` field ID has not yet been confirmed.
When the user provides it, update 'PENDING' with the actual customfield_XXXXX value.

### Field Type Notes
- `who_owns_fix` is a **cascading select** — the API returns a parent/child object.
  Extract the value as: `field?.child?.value ?? field?.value ?? null`
- `detected_by` is a User Picker — extract as: `field?.displayName ?? null`
- Checkbox fields return an array — check `field?.length > 0` for boolean conversion
- Multi-select fields return arrays of `{value, id}` objects — map to `value` strings

---

## 8. Jira API Integration

### Authentication
```typescript
const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
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
- User 1 (primary admin) — to be set up by user
- Xandor — admin

### Read-Only
- Katy
- Mark
- Jacob
- Randy
- Zach

**Account creation:** Admin-only. No self-registration. Supabase Auth handles
email + password. Admin invites users from the Settings → Users panel.

---

## 10. Alert Rules — Default Configuration

Seed these into alert_rules on first deploy:

| Rule | Type | Config |
|------|------|--------|
| Critical Issue Open | severity_threshold | severity = 'Critical' |
| High Severity Spike | severity_threshold | severity = 'High', count >= 3, window = 7 days |
| Repeat Root Cause | frequency_pattern | same root_cause_final, count >= 5, window = 30 days |
| Client Rework Spike | frequency_pattern | same client_brand, count >= 4, window = 14 days |
| Repeated Sendback | per_ticket | log_number >= 3 |
| Long-Running Open | aging | log_status IN ('Open','In Progress'), age >= 14 days |

All rules notify: `["teams", "in_app"]`

---

## 11. Historical Data Import

**Source file:** `NBLY_QualityTrackingLog_Error_Log_.csv`
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

### Severity Color Coding
```
Critical → red-600   (#DC2626)
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
   must write a corresponding row to audit_log.

3. **Root cause snapshot.** At log creation time, save the current value of
   `customfield_12905` (Root Cause CRO) as BOTH `root_cause_initial` AND
   `root_cause_final`. As Jira syncs update `root_cause_final`, `root_cause_initial`
   never changes.

4. **test_type default.** If no test type tag exists on the Jira ticket, default to 'A/B'.
   'Deployment' is set when the Jira ticket has a 'Deployment' tag/label.

5. **No writes to Jira.** CQIP is read-only against Jira. Never POST/PUT/DELETE to Jira API.

6. **Admin-only mutations.** Only users with role = 'admin' can create, edit,
   delete, or update status on log entries. read_only users can only read and export.

7. **Periodic sync frequency.** Every 6 hours. Syncs all logs WHERE
   log_status NOT IN ('Resolved') AND is_deleted = FALSE.
   Re-fetches full Jira ticket and updates all QA tab fields.

8. **Log number is per-ticket.** Count non-deleted logs for the same
   jira_ticket_id to determine the next log_number.

9. **Teams notifications** include: rule name, trigger reason, client brand,
   project key, log ID, and a direct link to the CQIP log detail page.

10. **Webhook security.** Validate incoming Jira webhooks against WEBHOOK_SECRET.
    Reject any request that fails validation with 401.

---

## 14. What Is NOT In Scope for V1

- Email notifications (Teams + in-app only)
- AI root cause classification (data model is ready; feature is not built)
- Cost analysis
- Jira write operations
- Self-registration (admin creates all accounts)
- Convert.com integration
- Mobile app

---

## 15. Pending / Blockers

- [ ] `nbly_brand` Jira custom field ID — user to provide (searching custom fields for "NBLY")
- [ ] Supabase project URL and anon key — user to create project and provide
- [ ] Cloudflare Worker — run `npm run deploy` to publish (creates the worker named `cqip` per wrangler.toml). Set `SUPABASE_SERVICE_ROLE_KEY`, `JIRA_API_TOKEN`, `JIRA_EMAIL`, `WEBHOOK_SECRET`, `TEAMS_WEBHOOK_URL` via `wrangler secret put`.
- [ ] Teams webhook URL — user to create #cqip-alerts channel and Incoming Webhook
- [ ] JIRA_API_TOKEN — user to create at id.atlassian.com (NEVER put in this file)
- [ ] Jira webhook registration — user to register in Jira Settings after Edge Function is deployed

---

*Last updated: April 2026 | Generated for CQIP v1 build*