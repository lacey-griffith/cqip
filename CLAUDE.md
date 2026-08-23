# CQIP — CRO Quality Intelligence Platform
## Claude Code Project Context File
### Fusion92 | CRO Department | v2.8

---

## CRITICAL: Read This First

This file is the single source of truth for this project. Every Claude Code session
starts here. Before writing any code, read this file completely. When in doubt about
a decision, check this file before asking the user. All major decisions are recorded
here so they don't need to be re-explained.

**Prod right now:** Worker **`d5e5703`**, declared **v3.0** — verified via
`/api/health` 2026-08-20, re-probed 2026-08-21. Migrations 001–029 all applied.
The SHA moved on a **docs + version-bump** push — `package.json` was the trigger,
NOT a docs-only push, which is the very framing §16 records as wrong; that entry
(Batch 012 directive CRUD, block **⚠ 0**) carries the mechanism, and why
"declared ≠ deployed" no longer describes this repo. **This stanza is the ONLY
current-state claim in the file. Every other SHA anywhere in CLAUDE.md or the
archive is a dated ship record — read this line for current state.**
(That sentence used to say "every other SHA *in this section*", which the
2026-08-22 split falsified in the act of making it true: there are no other SHAs
in this section now, because the history that held them moved out.)

**Live measurement caveat (still current):** **Overall Health %** and **Brands
Covered** are **not comparable across 2026-08-03** — the drought bar moved from
`count <= 2` to `count < 4` that day, so a later drop is *not* evidence delivery
regressed. Kept here because it constrains how anyone reads those two metrics
today; the batch that caused it is in §16.

**Deployment history moved out.** The `Current deployed state:` running paragraph
— 24,792 characters, April–August 2026 — is now
[`docs/claude-archive/CLAUDE-critical-history.md`](docs/claude-archive/CLAUDE-critical-history.md).
It is **history, not authority** (§13 r40): read the `Prod right now` stanza
above for current state, and §16 for the shipped log. Per §13 r23 bullet 1,
**nothing appends to a running history here again** — that bullet is what grew
it, and it has been rewritten.

---

## 0.1 Priority Order — CANONICAL

**This is live sequencing authority.** It was promoted out of the CLOSED
`Batch 009` entry in §15 by the CLAUDE.md split batch (2026-08-22), where it had
been sitting inside a shipped batch — a live decision filed under finished work.
Nothing about the ordering changed in the move.

The roll-call of already-shipped batches that used to travel with this block was
history, not sequencing, and is now in
[`docs/claude-archive/CLAUDE-16-2026-07.md`](docs/claude-archive/CLAUDE-16-2026-07.md).
It made the block ~40% history; keeping it here would have shipped a new
authority section already four-tenths stale.

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
| Source + CI/CD | GitHub + GitHub Actions | **CI is the canonical deploy path** (Lacey, 2026-08-06). Auto-deploy on push to main via `.github/workflows/deploy.yml` (Batch 005.31). Docs-only commits skip via paths-ignore. Local `npm run deploy` is **emergency-only** — see §13 r30. |

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

**Moved to [`docs/repo-structure.md`](docs/repo-structure.md)** (CLAUDE.md split
batch, 2026-08-22). Still current authority — it simply does not live in this
file any more.

**Why this one moved and §13 did not:** lower authority density. The repository
tree restates what the filesystem already says, so a reader who doubts it can
settle the question with `ls`; §13 encodes judgement that exists nowhere else.
**Not because it is "regenerable"** — the annotations on that tree carry batch
provenance and design reasoning no regeneration would reproduce.

**Reading older citations:** §16 entries dated before 2026-08-22 refer to this
content as **"§3"** / **"the §3 file tree"** — dated records, deliberately not
rewritten (§13 r40). Read any pre-split `§3` in §16 as pointing here. Note that
**most `§3` and `§5` tokens elsewhere in this file point at OTHER documents**
(`CROSS_CLAUDE.md §3`, `spec §5.1`, `HANDOFF … §3`, the multi-client audit's
§5); those were classified individually during the split and left alone.

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
CQIP_TELEMETRY_TOKEN=            # Batch telemetry-ac — Bearer secret for the external POST /api/telemetry/ac ingest (the AC Forge QA-automation app pushes draft/post events; DC renders them on Settings → System Info). Timing-safe compare in lib/api/telemetry-bearer-auth.ts. Separate blast radius per §13 rule 27 — rotating this cannot break drafting (SharePoint) or config reads (brands). Generate with `openssl rand -hex 32`. Not a JWT. Rotates atomically across THREE surfaces: Worker (`wrangler secret put`), Forge dev + Forge prod (`forge variables set --encrypt`). Until minted the route answers 500 not_configured — deployable and inert.

CQIP_ANTHROPIC_API_KEY=          # Batch classifier-1 — Anthropic API key for the AI root-cause classifier route (POST /api/admin/logs/classify). Model is `claude-opus-5`, called over plain `fetch` (no SDK — every external call in this repo already works that way, and adding one would change the Worker bundle for a single endpoint). Read INSIDE the handler, never at module scope, so `next build`'s page-data collection cannot break on it. Worker-only rotation surface — one surface per §13 r27, unlike CQIP_SHAREPOINT_API_TOKEN's four — so rotating it cannot break sync, drafting, or config reads. **Until it is minted the route answers 500 `not_configured`: deployable and inert, the Batch telemetry-ac precedent.** Not a JWT.

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

### ⚠ `/api/health` REPORTS THE WORKER ONLY — it says nothing about edge functions

The `version` field is the **Worker** build SHA. It does **not** reflect Supabase
Edge Function deploys, so a matching SHA is not evidence that `jira-sync`,
`jira-webhook` or `drought-evaluator` shipped — those deploy on a separate path
(`supabase functions deploy`) with no version surface at all. **This has misled twice**
(recorded 2026-08-15). When a batch changes an edge function, the deploy must be
verified against the function's own behaviour — a `sync_runs` row, an invocation log —
never against this endpoint.

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

**Moved to [`docs/schema.md`](docs/schema.md)** (CLAUDE.md split batch,
2026-08-22). Still current authority — §13 r23 names it as a required
destination on every ship, exactly as §5 was.

**Why this one moved and §13 did not:** lower authority density, and its source
of truth is adjacent — `supabase/migrations/` holds all 29 migrations, heavily
commented, and those comments carry most of the reasoning (026 states the
anon-key RLS argument almost verbatim; 029 states the spanning-archived index
argument).

**It is NOT regenerable and must never be treated as generated output.** It
holds prose that exists nowhere in SQL — *"there is no `is_deleted` column and
there must not be one"*, the `updated_at` no-trigger convention, the
`ac_version_seen` retention reasoning. A regeneration would destroy all of it.
It is a curated document that now lives beside its sources, not a build artifact.

**Known pre-existing gap, carried across unchanged:** `monitoring_findings`
(migration 025) is still undocumented there.

**Reading older citations:** §16 entries dated before 2026-08-22 refer to this
content as **"§5"** / **"the §5 schema doc"**. Those are dated records of what
each batch updated at the time and were deliberately **not rewritten** — editing
a record to match today's layout falsifies the record (§13 r40). Read any
pre-split `§5` in §16 as pointing here.

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
   Re-fetches the full Jira ticket and updates the QA tab fields —
   **except that seven columns capable of holding human work are only written
   when Jira supplies a non-empty value (see rule 37).** This sentence used to read
   "updates all QA tab fields"; that was true until Batch sync-guard
   (2026-08-08) and is now false. Admins can also run an on-demand sync from
   the "Sync with Jira" button on Dashboard, Logs, and Reports pages.

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
    - Header **"Prod right now"** stanza — update the one-line
      current-state claim **in place. NEVER append to a running
      history.** (Amended by the CLAUDE.md split batch, 2026-08-22.)
      This bullet used to read *"Header 'Current deployed state' line —
      append the new batch"*, and **77 batches complied**: that
      paragraph reached **24,792 characters** and was the single
      largest reason this file outgrew the 150k read limit. It now
      lives at `docs/claude-archive/CLAUDE-critical-history.md`.
      **This bullet was the regrowth engine — appending restarts the
      growth the split existed to stop.**
    - **Schema — `docs/schema.md`**, not a CLAUDE.md section: any new
      table, column, RLS policy, trigger. (§5 moved out in the same
      batch; CLAUDE.md keeps a pointer stub.)
    - **Repo tree — `docs/repo-structure.md`**: any new route, script,
      component directory, migration or docs artifact. (§3 moved out in
      the same batch. **Added to this list 2026-08-22, Karen H4** — that
      file's header had *claimed* r23 named it when r23 did not, and with
      no obligation behind it the tree had already gone stale, omitting
      every artifact the split itself created. Making the claim true was
      chosen over deleting it: the file is current authority and needs a
      writer, not a disclaimer.)
    - §13 — new business rule if behavior changed.
    - §15 — remove anything that just shipped from Pending; add new
      backlog items. **§15 holds live obligations only**; the shipped
      or post-mortem half of a subsection belongs in the archive, per
      rule 41.
    - §16 — new batch entry with date, what shipped, why. **§16 holds
      the current window only.** A new entry always lands in §16; when
      rule 41's ceiling fires, the oldest month moves to
      `docs/claude-archive/`.
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

    **CI is the CANONICAL deploy path (Lacey, 2026-08-06).** Local
    `npm run deploy` is **emergency-only** — reach for it when CI is
    down or unavailable, not as a routine alternative. Rationale: two
    deploy paths producing two different artifacts is how the 2026-08-05
    incident happened (a locally-built bundle carried baked `.env.local`
    values that a CI bundle never has, so "works locally" stopped
    predicting "works in CI"). One canonical path means the artifact
    under test is the artifact that ships. Proven end-to-end 2026-08-06:
    a CI bundle with **zero** baked `CQIP_*`/Azure values served
    `/api/sharepoint/folder` (live Microsoft Graph call) and
    `/api/brands` correctly, because Worker secret bindings supply
    everything at runtime.

    **`keep_vars = true` is set in `wrangler.toml` and must stay set.**
    Wrangler's default treats the config file as the source of truth and
    **deletes every plaintext var not declared in it** before each
    deploy. `wrangler.toml` declares none, so without this flag any
    deploy — CI *or* local — silently wipes dashboard-set plaintext
    vars. It is set in `wrangler.toml` rather than as `--keep-vars` in
    `deploy.yml` deliberately: both paths shell out to the same
    `wrangler deploy` via `npm run deploy`, so a workflow-only flag
    would leave local deploys just as destructive. **Secrets are not
    affected** — `keep_vars` governs plaintext vars only, and wrangler
    never deletes secrets on deploy. That distinction is why the
    2026-08-05 incident never touched the 15 secret bindings.

    **Why:** the 2026-05-19 →
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
    **If the re-check resolves the blocker, the item stops being a
    live obligation** — record the outcome and move it to the archive
    under rule 41 rather than leaving a resolved gate sitting in §15.
    A resolved blocker left in place reads as live to the next
    session, which is the same failure this rule exists to catch.
    (Amended by the CLAUDE.md split batch, 2026-08-22.)
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
    **§16 is the current window, not the whole history** (rule 41):
    a shipped entry is always written to §16, and ages out to
    `docs/claude-archive/` on rollover. The archive is never a fourth
    lifecycle stage a batch can sit in — it is where §16 entries go to
    stop being read as current, per rule 40. (Amended by the CLAUDE.md
    split batch, 2026-08-22.)

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

36. **Request-path retention (inline prune) is a legitimate pattern here, and
    it is the DEFAULT for small machine-fed tables.** `ac_telemetry` prunes by
    calling `public.prune_ac_telemetry()` fire-and-forget from the ingest route
    after each insert, rather than from pg_cron or an edge function. **Why:** a
    cron is an ops step someone must create and can forget, and this project
    has already paid for a silent cron failure once (the 2026-05-01 → 05-07
    drought-evaluator incident, §13 r27) — pg_cron logs an HTTP 4xx as
    "succeeded". An edge function would additionally need `verify_jwt = false`
    (r21) and a **fifth shared secret** with its own atomic-rotation burden
    (r27). Inline prune has none of those surfaces. **How to apply:** use it
    when the table is machine-fed, the retention rule is expressible as one
    SQL statement, and the delete is cheap relative to the write. Three
    obligations come with it: (a) the prune must NEVER fail the ingest — swallow
    and log, because the consequence (unbounded growth) is benign and visible as
    row count, while a failed ingest is not recoverable; (b) the SQL function
    must `REVOKE ALL … FROM PUBLIC` and grant only `service_role`, since
    Postgres defaults EXECUTE to PUBLIC and Supabase exposes functions as
    PostgREST RPCs; (c) do not justify it with a table-size claim you have not
    derived — the first version of this rule's own justification said
    "≤~500-row table" when 500 was the retention FLOOR and steady state is 90
    days of volume. For genuinely large tables, or a rule needing a global view
    that a single statement cannot express, prefer plain-SQL pg_cron (still no
    edge function, still no new secret).

37. **An empty Jira value NEVER overwrites a human-entered CQIP value; a
    non-empty Jira value always wins.** (Batch sync-guard, 2026-08-08.) The
    guarded set is defined structurally, not by taste. The test is **"can this
    column hold human work the sync can destroy"**, and it has TWO sources:

    1. **Human-EDITABLE** — `ALLOWED_FIELDS` (`app/api/logs/edit/route.ts`)
       INTERSECT the sync's `updateData`: `issue_category`, `issue_subtype`,
       `root_cause_final`, `resolution_type`, `severity`, `who_owns_fix`.
    2. **Human-AUTHORED but not editable** — `root_cause_description`, which
       holds prose imported from the CSV's "Issue Details" column (§11).

    **Do not reduce this to source 1.** It was originally written as
    `ALLOWED_FIELDS ∩ updateData` alone, and that missed 32 non-deleted rows of
    human prose: editability is a *proxy* for "holds human work", and an
    incomplete one. Those rows sit outside the sync's working set only because
    they are `Resolved` — and `log_status` is itself in `ALLOWED_FIELDS`, so
    reopening one (a supported action) pulls it straight in.

    For all seven, `supabase/functions/jira-sync/index.ts` **omits the key from
    the update** when Jira supplies `null` / `[]` / an empty string. It does
    not write `null` — omitting and null-writing look identical to a naive
    "did the value change" check, and only one of them preserves the data.
    Everything else the sync writes stays unconditional; `client_brand` in
    particular MUST, because §13 r28 depends on it.

    **Why:** the Jira QA tab is empty for most synced tickets *by design* —
    the Jira-side automation clears those fields on entry to `Dev QA` /
    `Dev Client Review` (§6). So the sync's unconditional write meant the
    normal path silently erased human classifications. Five production rows
    lost all six fields between 2026-05-26 and 2026-08-08. It went unnoticed
    for ten weeks because the sync wrote them with **no `audit_log` row**: the
    trail showed the human's write and nothing after it, which reads as "the
    value is still there."

    **How to apply:** if you add a column to the sync's `updateData`, apply
    BOTH tests — is it in `ALLOWED_FIELDS`, *and* can it hold content a human
    authored by any other route (import, backfill, a future ingest)? Either one
    means guarded. Do not reintroduce an unconditional write for such a column,
    and note that assigning onto `updateData` after the guard call bypasses it
    entirely — a test bans that outright for guarded columns, in both dot and
    bracket notation, because it silently reinstates the whole defect. The guard body is inlined verbatim into the Deno
    function from `lib/sync/sync-field-guard.ts` because that function is
    self-contained and `tsconfig.json` excludes `supabase/functions` (so it is
    never type-checked and cannot import); `tests/sync-field-guard.test.ts`
    asserts the two copies are identical, and **that drift assertion is the
    only gate reaching the deployed code** — if you edit one copy, edit both.
    Note the same `?? []` coercion exists in `jira-webhook/index.ts:333–344`;
    it is harmless there only because the webhook runs at row creation, where
    there is no prior value to destroy. Do not assume it stays harmless.

38. **A passing test can ENCODE a defect instead of catching it. Assume yours
    might, and use the fix itself as the probe.** (Promoted 2026-08-14 from four
    instances in a single session — it is no longer a run of incidents.)

    **The tell, and it is cheap:** *when you fix a defect, a test should FAIL.*
    If applying a correct fix turns a green suite red, the test that broke was
    encoding the bug. **A test that must be deleted or rewritten to make the code
    correct was never testing the right question.** Conversely, if a real fix
    changes nothing in the suite, nothing was covering that behaviour.

    **THREE DISTINCT MECHANISMS, because naming only one under-covers the rule.**
    The originating instances were described as "tests written against source
    shape rather than behaviour" — true of (a) and (c), but **not of (b), which
    was a behavioural test over a pure function**. A rule that names only the
    source-shape cause would have missed the one that cost a CRITICAL:
    - **(a) Source-shape assertion.** A regex over source cannot distinguish the
      part you meant to protect from a wrong thing sitting beside it. *Instance:*
      a check that `...log,` was PRESENT in an `onSaved` call passed when a
      mutation kept the spread and appended `...{ notes: notes }`. *Instance:* a
      regex pinning a WHOLE ternary froze the wrong `confirm` branch alongside the
      right `reject` branch, so applying the fix failed it.
    - **(b) Wrong oracle.** A behavioural test whose expected value encodes a
      mistaken belief about the domain. *Instance:* `suggestionAction(['QA Gap'],
      []) === 'correct'` — "clearing the field is a correction" is true in the
      abstract and false for the only reachable state, where `[]` is the row's
      PRISTINE value and nothing was cleared. It locked in a CRITICAL in which
      every accepted AI suggestion would have been filed as a human rejection.
    - **(c) Under-constrained fixture.** Right oracle, but inputs that cannot
      discriminate. *Instance:* a flip-boundary test whose fixture made the second
      half of an `&&` false either way, so `>` versus `>=` was never exercised and
      the off-by-one mutation survived.

    **Why:** every one of these was GREEN. tsc, ESLint, the build and the rest of
    the suite were all green too. None of the ordinary gates can see this class,
    which is what makes it worth a rule rather than a habit.

    **How to apply.** Prefer behaviour through a **pure exported function** over
    matching the source that produces it — that is the repair that worked in every
    instance above. Where a source assertion is genuinely the only reach (wiring,
    "this route is never called from here"), keep it NARROW: assert the one token
    that matters, never a whole expression, and pair it with a behavioural test of
    the value. **Mutate to confirm**, and count a survivor only after verifying the
    patch actually applied.

    **The sibling rule this generalises — inlined here 2026-08-22 by the CLAUDE.md
    split batch, because it used to live in §15 prose and was cited from three
    places.** Both halves are needed and only one used to be quoted:

    - **The mechanism.** When the reference value and the value under test share a
      **common ancestor**, agreement is guaranteed regardless of correctness —
      *the oracle is not independent.*
    - **The test.** *If a check can only be satisfied by the same artifact that
      produced the value, it is not a check.* Anchor mapping assertions to the
      external source of truth, or state plainly that they are unanchored.

    Quoting only the test left this rule drawing its distinction against
    **"a shared oracle"** — a term the quoted sentence never uses and the
    mechanism is what defines. **That** rule covers a shared oracle; **this** one
    covers a test that is independent and still wrong.

39. **Check for a concurrent session at session open, before touching the tree.**
    (Recorded 2026-08-14, after it cost a clean gate run.)

    **What happened:** two sessions committed into this checkout on the same day.
    Mid-batch, `lib/client-library/matrix-controls.ts`, `matrix-controls.test.ts` and
    `tab-group.tsx` appeared modified and uncommitted — another session mid-build,
    renaming exports that `pulse/page.tsx` still referenced. That broke `tsc` and 15
    tests **repo-wide**, so the batch in progress could not run a clean project gate
    and had to verify around the breakage: per-file `tsc` error attribution, the test
    suite minus the affected file, and **no `build` at all**, because a red build
    would have said nothing about the change under review.

    **Why it needs a rule rather than care:** the failure is silent and looks like
    your own. A red `tsc` on a shared tree reads as "I broke something", and the
    honest response — investigate, stash, re-verify — costs more than the check that
    prevents it. It also makes `git add -A` actively dangerous: staging is no longer
    "my work", and a wide add captures someone else's half-finished edit into your
    commit.

    **How to apply.** At session open, and again before any commit: `git status`,
    `git log --oneline -5`, and `git rev-list --left-right --count origin/main...HEAD`.
    If the tree carries changes you did not make, **say so before proceeding**, stage
    by explicit path only, and state in the commit which files were deliberately left
    out. If a gate cannot be run clean, **report which gate and why** rather than
    reporting the subset as if it were the whole.

    **And the symmetric obligation, which the first version of this rule omitted:
    when YOU are the concurrent session, do not leave the tree broken between
    commits.** The cost above was not paid by whoever left `matrix-controls.ts`
    half-renamed — it was paid by the session that arrived afterwards and could not
    tell whose breakage it was. If you must pause mid-rename, either commit a
    compiling intermediate or stash, and if you cannot, say so where the other
    session will see it. A rule that only tells you how to react to someone else's
    mess describes half the problem.

40. **`docs/claude-archive/` is append-only HISTORY. It is NEVER authority for
    current state.** (CLAUDE.md split batch, 2026-08-22.) Every state read —
    what is deployed, what is pending, what a rule requires, what a table looks
    like — resolves against **CLAUDE.md**, and against `docs/schema.md` for
    schema. An archive file records what was true on a ship date and is correct
    *as a record* while being stale *as a claim*; those are different things and
    the archive only ever offers the first.

    **Why:** this file has been misled twice by exactly that confusion — a dated
    ship record read as a current-state claim (`e518624` re-asserted as prod;
    §16's own ⚠ 0 block). Splitting history into its own files makes the
    distinction physical instead of a matter of the reader noticing a date.

    **How to apply:** every archive file opens with a non-authority banner, and
    **the banner is the mechanism while this rule is only the contract** — §16
    already records that *proximity is not protection*, so a rule the reader may
    never reach cannot be the only guard. Do not cite an archive file as evidence
    for a present-tense claim. If you find yourself needing to, the fact belongs
    in CLAUDE.md and has not been carried across — fix that instead. Never edit
    an archive entry to make it current; write the current fact where current
    facts live.

41. **Rollover triggers on a SIZE CEILING, never on the calendar.**
    (CLAUDE.md split batch, 2026-08-22.)

    - **CLAUDE.md: 120,000 characters.** Hard rule.
    - **The remedy is whichever section actually grew — read the breakdown
      first.** (Amended 2026-08-22, Karen H1.) This bullet used to say only
      *"move §16's oldest month to the archive until it clears"*, and **that
      prescription is now spent: §16 holds zero entries.** A rule whose sole
      remedy is exhausted while its ceiling is permanently tripped is worse than
      no rule — it reads as actionable and is not. The ordered remedies are:
      (1) roll §16's oldest month out, **if §16 has entries**; (2) apply **r42**
      (clause 3) to §15 — relocate post-mortem narrative, keep the actions;
      (3) extract a whole low-authority-density section, as the split did with
      §3 and §5. **§13 is not a candidate** — highest authority density, and it
      is the thing r40 exists to protect.
    - **Archive files: 150,000 characters, advisory.** They are never read whole
      by the ground-truth reader, so size is only a tool-convenience concern.
    - **Unit is CHARACTERS, stated here because it matters:** this file's bytes
      run **~+1.0%** over its characters (it is dense with `—`, `§`, `⚠`, `·`),
      so an unqualified number is wrong by over a thousand at the boundary.
    - **Measure CLAUDE.md alone — never the sum of CLAUDE.md plus the archive.**
      The sum only ever grows, so an assertion on it fires forever and gets muted.

    **Why not "current month only":** month is not a size unit. Shipped months
    in this repo span **7,737 to 118,698 characters — a 15× spread** — so a
    calendar rule bounds the file somewhere in a range an order of magnitude
    wide, depending only on which month it happens to be.

    **How to apply:** `scripts/gen-build-info.js` measures at every prebuild and
    **warns loudly; it must never fail the build.** Docs-only commits skip CI via
    `paths-ignore` (r30/r31), so a gate is unreachable on exactly the commits that
    grow this file, and destructive on the ones it does catch. The check records a
    **per-section breakdown alongside the total**, so a tripped ceiling routes to
    the section that actually grew — without it the reflex is to roll §16 over,
    which does nothing when the growth was in §15 or the header.

42. **§15 holds ACTIONS. A sentence that does not name an action must name where
    its substance now lives.** (Karen post-flight on the CLAUDE.md split,
    2026-08-22 — the cut rule's **clause 3**.)

    - **The rule:** a §15 sentence either names a thing someone must do, or it
      carries a pointer — a §13 rule number or an archive filename. **Neither an
      action nor a citation is a violation.**
    - **It relocates, never deletes.** If the substance generalises beyond its
      batch it becomes a §13 rule; if it is batch-specific narrative it goes to
      the archive. §15 keeps the action plus a one-line citation.
    - **The check a non-cutter can run**, which is the whole point: for each
      retained §15 paragraph ask *"does this name a thing someone must do?"* If
      no, look for the pointer. No pointer, no action → violation. That needs no
      re-reading of source material and no trust in whoever made the cut, which
      is the property clauses 1 and 2 have and a bare "cut harder" would not.

    **Why:** clauses 1 and 2 catch obligations and stale status lines. Neither
    can see **post-mortem narrative** — a batch's measurements, lessons and
    process notes carry no checkbox and no status claim, so both clauses pass
    over them silently. The split's first pass left §15 at **74,120 characters**
    against a 34,000 budget, and Batch 012's live subsection alone held
    **15,483 characters** of exactly that material with zero unchecked boxes.

    **Precedent:** step 7 of the split is this rule working — it pulled the
    shared-oracle lesson out of §15 prose into **r38** and left §15 citing it.

43. **Re-derive every figure at the moment you write it. Never transcribe one —
    including from your own verification earlier in the same session.**
    (CLAUDE.md split batch, Karen re-review, 2026-08-22.)

    **The rule:** if a number is going into a document, measure it at write time.
    A figure copied from earlier output is a **record of a past state presented
    as a present claim** — the same confusion r40 exists to stop, at the scale of
    a single number.

    **Why it needed a rule and not care: THREE instances in ONE fold, by someone
    already watching for it.**
    - The conservation delta went into `ORACLE.md` as **+42,837** when the
      correct **+64,048** was already in that session's own verification output
      *and had been quoted in the handoff*. Not a measurement error — a
      transcription of a superseded number into the one document whose entire
      job is measurement.
    - §15 was written as **59,172** in two places, measured one commit earlier,
      when it was **61,267**.
    - "Exactly 4,510" for two files that were **5,144**.

    **The trap that makes it worse: a figure can be part of what it measures.**
    Recording CLAUDE.md's own size changed CLAUDE.md's size, three times in a
    row (151,142 → 152,830 → 153,051). **Two escapes, and both are legitimate:**
    - **Date it.** `+64,048 as measured at <sha>` is a stable, true record.
    - **Point at a live measurement** instead of writing the number, e.g. the
      `[claude-md]` prebuild line, which measures at run time.

    **What does NOT work:** correcting the figure. Each correction moves it
    again. That is a fixed point, and chasing it is how a stale number gets
    written down with extra confidence.

    **How to apply:** do the non-numeric edits first, measure last, write the
    figures last. If a figure is self-referential, date it or replace it with a
    pointer — do not iterate.

---

## 14. What Is NOT In Scope for V1

- Email notifications (Teams + in-app only)
- ~~AI root cause classification (data model is ready; feature is not built)~~ —
  **SUPERSEDED 2026-08-10: Phase 1 SHIPPED as Batch classifier-1 (see §16) — and
  has never run; see the §15 "AI root-cause classifier — PARKED" entry.**
  Note what is and is not in scope: the classifier *suggests* into separate AI
  columns and **never writes `root_cause_final`** — a human confirm is the only
  path into the canonical field. Rovo, Copilot, auto-confirm-above-a-threshold,
  cron, and classifying the other three taxonomy fields all remain out of scope.
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


### Batch 005 (post-demo) — Backlog cleanup, scope-locked
Strict rule: only items already in scope at lock time. No new
additions.

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
**Discovery is COMPLETE; the importer is the open work.** The full discovery
record — Step A/B/B′, the freezer crawl, the corrected scope rules and the
locked headline — is in `docs/claude-archive/CLAUDE-16-2026-07.md` (r42), with
the machine-readable source of truth in `docs/clickup-archive/`.
- **🔒 LOCKED HEADLINE — 14,785 worked-on / 13,858 delivered** (Lacey-confirmed
  2026-07-12). **NOT 15,681** (wrong scope) and **NOT 16,761** (transcribed,
  wrong scope). This is the number that goes to the page.
- **Authoritative scope rules:** `scope_rules_authoritative` in
  `docs/clickup-archive/crawl-manifest-corrected-2026-07-12.json`. Any future
  crawl must reproduce the footprint exactly.
- [ ] **Phase 2 ETL** — reads the committed 1,153-id twin allowlist at
      `docs/clickup-archive/jira-twin-allowlist.json` directly; **no re-scan**
      (it is the recovered 2026-07-10 extraction and is NOT re-derivable from
      today's drifted Jira). Jenny-gated: migration + mutation + new route.
- [ ] **Phase 3** — the Client Archive page. Isolation contract: the page may
      read a live Jira aggregate; **coverage KPIs never read the archive.**
- [ ] **⚠ PRE-DECOMMISSION, IRREVERSIBLE — request the ClickUp workspace export
      while the workspace still exists.** It is the only way to obtain
      **per-task status history**: the API exposes only current status and
      `orderindex`, and `time_in_status` returns 403 on this plan, so the
      freezer crawl **cannot** capture it. Owner-run, non-blocking, not yet
      attempted. **Restored to §15 2026-08-22 (Karen re-review MEDIUM-2)** — the
      clause-3 pass carried it into the archive with its narrative, where §13
      r40 makes it history rather than a live obligation. It is the one item on
      this list with a deadline set by someone else.
- [ ] **Move the gitignored raw crawl** (~464 MB, descriptions + assignee PII)
      to durable storage. It must never be committed.
Both phases stay sequenced behind Batch 006.

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
- **Phase E — Pulse shell/UX track** (distinct from the C/D feature track):
  - **V2.1 trigger backport — LOADER ABANDONED 2026-07-30; 8 items move to UI
    hand-entry.** Not an E-phase and no longer a scripted load at all — see the
    §15 backlog entry for why (superseded brief, inverted polarity) and for the
    encoding-fidelity-vs-mapping-correctness lesson. The 8 titles are NOT in the
    repo yet.
  - **Convert reconciliation backfill — BUILT 2026-07-25, NOT YET RUN** (see §16).
    One-off data pass flipping existing matrix cells to match real Convert config
    for the 13 active NBLY brands. **212 CSV rows = 205 todo→done + 7 done→todo**
    (Lacey-confirmed 2026-08-22 as what executes; re-derived from
    `scripts/data/convert-reconciliation-backfill.csv` at write time per r43, and
    matching the script's `EXPECTED_TOTAL/UPGRADES/DOWNGRADES` guards exactly).
    **This line read `215 / 207 / 8` until 2026-08-22** — the original CSV shape,
    left stale when spec addenda 6 and 7 corrected it on 2026-07-25 (two MLY rows
    removed; one MDG row removed as a resolver bug). Data-only; no
    migration/route/app-code. **Run procedure — the batch spec
    `docs/batch-012-convert-reconciliation-spec.md`, sections `## 5. Verification`
    and `## 6. Gate`** (cited by their real names; an earlier repoint invented a
    `§Pre-run` section that does not exist — Karen re-review HIGH-1). The
    6-step operator checklist also survives verbatim in
    `docs/claude-archive/CLAUDE-16-2026-07.md`, but that is an r40 history file
    and **must not be the cited procedure for a production UPDATE**; it also
    carries the superseded 215/209/8 counts. Lacey approves + runs. Not an
    E-phase — a data correction riding alongside the E track.
  - **Restyle batch 4 — NOT STARTED. Gate 0 (MEDIUM-6 audit-coverage count) DONE
    2026-08-03**; the probe figures are in
    `docs/claude-archive/CLAUDE-16-2026-08.md` (r42). Three actions come out of it:
    the Change Log widget needs a NEW `audit_log` read and **`audit_log` is already
    over the PostgREST 1,000-row cap**, so it must use `fetchAllPaged()` **from the
    outset**; only **52.7%** of done cells hold a per-cell audit row, so the
    honest-degradation path is the load-bearing half of the widget, not an edge
    case; and **attribution can distinguish script vs human, NOT which human pass**
    — do not write copy claiming finer provenance.

    **VINTAGE — the counts have moved on EVERY re-probe (three times running), so
    RE-PROBE, never scale an old ratio.** Figures as of 2026-08-14 and the
    "87 is ambiguous" trap are in `docs/claude-archive/CLAUDE-16-2026-08.md` (r42).
    **The actions they imply:** use the **per-project active** figure and group by
    `project_key` *and* filter on `status` before computing anything — a
    cross-project product is meaningless and one pass of it reported "98 missing
    cells" against two complete grids. Judge the memoized-row follow-on against a
    freshly probed `active directives × visible brands`, not a written-down number.
    Two obligations still ride here: a **skip-the-matrix link** as the cheap interim
    for the ~1,300 read-only tab stops (the `role="grid"` roving-tabindex decision
    stays with batch 4), and the **memoized-row follow-on** from batch 3 MEDIUM-4.
  - **E2 (Convert config sync)** — fills the brand-page "Convert configuration"
    placeholder with synced Convert data. Couples to Batch 008.
  - **E3 (rich directive rows)** — swaps the read-only brand-page directive rows
    for expandable rows with comments + lifecycle dates. **Seam is live:** the
    `CellEditStrip` container on both the matrix and the brand page is what E3
    enriches — extend it, don't rebuild.
- **Phase C (Jira ticketing) — after E1.** Create/track Jira tickets from a finding
  / a directive cell. **Gated on §1 Jira-create-permission verify** (confirm the
  CQIP Jira credential can POST issues; §13 r5 is read-only today, so a Jira
  WRITE path is a deliberate scope expansion needing its own decision). Jenny
  pre-flight required (new write surface). Per-finding + per-cell ticket links
  land here (the Phase B TODOs).
- **Phase D (Public bug form) — after C.** New public-facing submission surface;
  needs Turnstile (unlike the token-gated Phase B feed). Jenny pre-flight again.

**Convert-reconciliation deferred follow-ons (backlog, from the 2026-07-25 pass):**
- [ ] **⚠ Convert reconciliation RESOLVER BUG (spec addendum 7) — STATUS AT
      SOURCE IS UNKNOWN. Do not regenerate that CSV until it is established.**
      Captured 2026-08-22 on Lacey's instruction; it had no §15 entry before.
      **The bug:** MDG's Convert export holds **two goals with byte-identical
      names** — `Step 1 | Contact Info | Validation Error Exposure`, one ACTIVE
      (`1004115396`) and one ARCHIVED (`1004117395`). The reconciliation tool's
      exact-match resolver keyed a plain dict by goal **name**, so on a collision
      the later array entry silently overwrote the earlier. The archived twin
      won and the pass concluded *"archived → flip to To do"* — while MDG's
      directive is genuinely Done via the real active goal. It produced a
      **false downgrade**: a wrong production write, caught only by review.
      **ESTABLISHED by inspection of this repo, 2026-08-22:**
      - **The bug is NOT in any code in this repository.**
        `scripts/backfill-convert-reconciliation.ts` never resolves goals by
        name — it reads `convert_id` straight from the CSV — and no other file
        under `scripts/`, `lib/` or `app/` resolves a Convert goal by name.
      - **The one known output is corrected.** The row was removed, the CSV
        regenerated to 212/205/7, and its `DOWNGRADE_REASONS` key deleted in the
        same change so it could not drift. `DOWNGRADE_REASONS` holds 7 keys,
        matching the CSV (re-counted at write time).
      - **One other name collision exists** — MOJ `Submits SF Lead - Footer
        [Contact API]` ×2 — and **both copies are active**, so either resolution
        yields the same answer. No data impact.
      **UNKNOWN — stated as unknown, NOT inferred:** whether the resolver itself
      was ever fixed. **The tool that produced this CSV is not in this
      repository**, so nothing here can answer it. The 2026-07-25 change
      corrected the *output*; this repo holds no evidence either way about the
      *generator*.
      **Why this matters even though the CSV is now correct:** the spec instructs
      that a regenerated CSV be re-verified, and the script hard-fails on a shape
      change. If the resolver is still name-keyed, the next regeneration
      reintroduces the same class of false downgrade **silently** — a name
      collision produces a plausible row, not an error.
      - [ ] Ask whoever owns the reconciliation tool whether the resolver keys on
            `convert_id` (or `(name, status)`) rather than name alone, and record
            the answer here.
- **Unmapped active Convert goals → new directives** — `docs/convert-reconciliation-2026-07-25/unmapped-active.csv`
  lists real, live Convert goals that have NO directive yet (so the backfill
  couldn't touch them). Creating them is a CREATE pass, not a backfill: needs
  title/type decisions per goal and a fan-out. Own batch.
- **Paused-brand reconciliation** — `paused-brands-readiness.csv` (MRR-CA 17 /
  SHG 16 / WDG 16 pre-resolved) is informational only while those brands are
  paused (the pause rule forces `n_a`). Re-run the same reconciliation logic
  if/when they reactivate.
- **Stale §15.5 zero-cell note** — the brand-page inline-edit entry claims
  `Chat Appointment Made` / `Chat Started` / `Chat Lead Submitted` have zero
  `directive_brand_status` cells. The 2026-07-22 goal load populated them; prod
  is now 69 directives × 16 brands = 1,104 cells with zero gaps (verified
  2026-07-25). Trim that note when that entry is next touched.

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

**PROCESS — the spec is commit 1, and commit 1 lands before the build starts.**
Twice a Pulse batch opened against an authority that existed only outside the repo.
Both narratives are in `docs/claude-archive/CLAUDE-16-2026-08.md` (r42); the
transferable half is: **a spec cited by section number is falsifiable, a spec
paraphrased into bullets is not.** Cite specs by section so absence is detectable.

**Restyle-core follow-ons (backlog, from the 2026-08-02 ship):**
- **Sweep the remaining 32 `ring-[color:var(--f92-orange)]` call sites onto
  `--f92-focus-ring`.** The token fix is already app-wide for KEYBOARD focus — the
  unlayered `:focus-visible` outline was repointed, and it beats the layered Tailwind
  ring utilities — but those 32 utilities (across 24 files: coverage, logs, dashboard,
  settings, ui primitives) still paint a SECOND ring at 2.76:1 on top of the compliant
  outline. 13 in-scope Pulse sites were done. Purely mechanical; kept out of the restyle
  so a token commit wouldn't carry two dozen unrelated files.
- **`components/ui/badge.tsx` fails WCAG AA for white text in BOTH themes** on three of
  four severity variants — `high` 2.80:1, `medium` 1.92:1, `low` 2.54:1 (`critical`
  passes at 4.83:1). Pre-existing and app-wide, surfaced while reverting this batch's
  `--severity-*` dark overrides (Karen HIGH-2). Needs its own decision: darken the
  variant backgrounds, or switch those variants off `text-white`. Not a Pulse problem.
- **The Phase A token / Tailwind-v4 collision (194 utility call sites).** `--radius-*`,
  `--shadow-sm` and `--tracking-wide` shadow Tailwind's own theme tokens, and the app
  depends on `globals.css` being UNLAYERED to win. Works, shipped since 2026-07-17, but
  moving that file into a layer would silently flip `rounded-sm` (5), `rounded-md` (27),
  `rounded-lg` (10), `rounded-xl` (25), `rounded-2xl` (24), `rounded-3xl` (27),
  `shadow-sm` (75) and one `tracking-wide` at once. Karen ruled leaving it alone correct;
  recorded so nobody "tidies" globals.css into a layer without knowing the blast radius.
- **The matrix renders `<button disabled>` to non-admins**, so the "never a disabled
  control" contract holds on the brand page but has never held on the matrix
  (`disabled={!clickable}`, byte-identical pre-batch). Worth aligning; not a regression.
- **"Largest gap" KPI card** — omitted from the strip rather than rendered inert,
  because it is a per-FAMILY number and family grouping does not exist. Revisit if/when
  a real family column lands (the mockup's nine families are invented client-side).

**Matrix-controls deferred follow-ons (backlog, from the 2026-07-29 ship):**
- **Archive-UI signal obligation (Karen LOW-8)** — `loadProject` only loads
  `status='active'` directives, so an ARCHIVED directive is invisible to the
  matrix search and counts 0 toward `hiddenByStatus`: an exists-but-archived title
  reads as "found nothing", the same duplicate hazard the above mitigates.
  Currently **unreachable** — verified 2026-07-29 that no archive writer exists
  anywhere in `app/api/`, create never sets `status` (relies on 024's
  `DEFAULT 'active'`), and directive edit/archive UI is still an open TODO. When
  that UI is built it **owes this surface a signal** (include archived titles in
  the duplicate-risk count, or land the route check above first).
  **⚠ THE "unreachable" CLAIM ABOVE IS FALSIFIED — left in place, not deleted,
  because the way it failed is the lesson.** Prod holds an archived directive
  (`Submits Form Lead - Combined`), written by **direct SQL** — a surface that
  audit did not consider, because it examined `app/api/` only. **A "no writer
  exists" claim must state which surfaces were checked.** See the dedicated §15
  entry below, and **✅ SHIPPED 2026-08-18 — Batch 012 directive CRUD (see §16)**,
  which paid the signal obligation in full: archived rows are now **viewable**
  behind a `Hide archived` toggle rather than merely counted, and the
  archived-search signal is gated on that toggle so its "…are not shown" wording
  cannot be false. This item is CLOSED.

**V2.1 trigger backport — 8 items, HAND-ENTERED via the UI (loader ABANDONED
2026-07-30):**
- **The work:** 8 outstanding items from Lacey's 2026-07-30 list, entered through
  the Pulse **inline-create strip**. **This is NOT a scripted load, now or later.**
  No loader exists for it, none is parked on a branch, and no corrected mapping is
  to be attempted — the decision is that directive entry moves to the UI.
- **⚠ THE 8 ITEMS ARE NOT IN THIS REPO — this entry is not yet executable.** It
  records *why* and *how*, but not *what*. The titles live only in Lacey's 7/30
  list, which was never committed. **A future session cannot do this work from the
  repo and must get the list from Lacey first.** This is the same
  out-of-repo-authority gap that killed the loader, so the corrective that follows
  directly from the lesson below is: **commit the 7/30 list — or at minimum the 8
  titles and their intended `directive_type` — the next time it is to hand.**
  Deliberately NOT reconstructed from memory here: inventing eight plausible titles
  is precisely the failure mode being documented.
- **Why the loader was abandoned.** A loader was built (spec + script + 20 tests,
  Karen-reviewed, never run) against an earlier brief that Lacey's 7/30 list
  **superseded**. Reconciliation against the new list found the mapping was wrong
  in four independent ways: **3 items had no directive**, **1 directive was an
  orphan**, **4 were mismapped**, and — the killer — **the polarity was INVERTED**:
  the loader's `DONE_DIRECTIVES` encoded *completed* work while the 7/30 list is
  *outstanding* work. Its `EXPECTED` totals (112 / 18·61·33) are **void**. Prod was
  never touched: it holds no `[Trigger]` directives and 0 rows under
  `system:v21-trigger-backport`.
- **⚠ THE DURABLE LESSON.** `EXPECTED`-totals assertions verify ENCODING
  FIDELITY, not mapping CORRECTNESS — every wrong mapping still summed to
  112 / 18·61·33, so no in-script guard could have caught it. **When the
  authority for a mapping lives outside the repo, no in-repo verification
  reaches it.** The generalised rule is now **§13 r38** (shared oracle); the four
  worked instances behind it — including the Pulse cell truncation, where a
  DB-level check overturned a correct render-layer bug report for nine days —
  are in `docs/claude-archive/CLAUDE-16-2026-07.md` (r42).
- **Entry gotcha for the hand-entry (do NOT skip):** the create form defaults to
  `directive_type: 'goal'` (`app/dashboard/pulse/page.tsx:977`,
  `useState<DirectiveType>('goal')`). **All eight of these are `[Trigger]`
  directives**, so every single hand-entry must change the type picker or it ships
  a **"Goal"** badge against a `[Trigger] …` title — precisely the user-visible
  mismatch the abandoned batch's MEDIUM-4 was about. **Worth considering whether
  that default should be unset/required rather than `'goal'`** — deliberately NOT
  changed as part of the abandonment; it needs its own decision.

**Unranged-select audit — the ACTION; measurements relocated.** PostgREST caps an
unranged select at 1,000 and returns the short result with **no error**. Full
per-table row counts as measured 2026-07-31 are in
`docs/claude-archive/CLAUDE-16-2026-07.md` (r42) — **re-probe rather than trusting
them**; every figure in this file has moved on re-probe.
- [ ] **Page the `/dashboard/logs` sendback-count badge** (`app/dashboard/logs/page.tsx`,
      `.in('log_entry_id', ids)`, unranged) with `fetchAllPaged()`. `audit_log` is
      already over the cap; nearest to firing by row count.
- [ ] **Watch `monitoring_findings`** — nearest by *step-function* growth, not by
      count: `POST /api/monitoring/findings` accepts `MAX_BATCH=500`, so it can go
      0 → over-cap in two API calls the day Batch 008 starts posting.
- [ ] **Add a "showing most recent 500" note to `/dashboard/settings/audit`.**
      It uses `.limit(500)` against an `audit_log` well over that, which is
      deliberate (a newest-first event view) but **silent**: an admin searching
      for an older event gets "not found" rather than "truncated". A different
      class from the others here — a signal gap, not a data bug. **Restored to
      §15 2026-08-22 (Karen re-review MEDIUM-2)**; the clause-3 pass kept this
      list's three checkboxes and carried this fourth item off with the prose.
- [ ] **Fix `test_milestones` at ALL FOUR unranged call sites** when it next crosses
      — coverage page, brand-wellness report, dashboard KPI, manage-milestones dialog.
      An earlier draft named only two, which is how half a fix ships.

**Convert historical-data remediation — 5 misnamed goals (from the 7/30 list,
item 2):** historical data on these five Convert goals is **misnamed**:
`ASV 100496074` · `RBW 1004117356` · `MDG 1004101060` · `FSP 100425378` ·
`PDS 1004118956`. This is a **Convert-side data problem, NOT a matrix cell** —
recorded as its own backlog item precisely so it does not vanish along with the
abandoned loader it arrived beside. Needs a decision on whether the rename happens
in Convert (like the Batch 012 `rename-cleanup.csv` pass, executed in Convert
itself) and whether anything in CQIP references the old names.

**Prod directive-count drift (recorded 2026-07-29, independent of the above):**
NBLYCRO went **69 → 75** directives when Lacey created six goals through the matrix
UI on 2026-07-29 (4 scroll-depth + 2 MRE upsell). Unrelated to any batch; noted
because the count is a **moving target**, not a constant to re-baseline — anything
reading it should re-probe rather than trust a figure written into a doc. Side
observation from that pass: one of those titles is **`Srolled 100% - Sitewide`**,
missing the `c` its three siblings (`Scrolled 25/50/75% - Sitewide`) have — a typo
in a live title, same class as the handoff §3 typo resolutions. Not corrected here;
Lacey's data, Lacey's call.

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

IMPLEMENTATION SKETCH — relocated to `docs/claude-archive/CLAUDE-16-2026-07.md`
(r42). It is an unbuilt design sketch, not an obligation; **re-derive it against
the codebase as it stands when 007 actually starts** rather than treating a
2026-05-06 sketch as a plan. The parts that bind are the locked decisions above,
not the sketch. Effort was estimated at 3-5 weeks for read-only v1, +2-4 for the
read-write follow-on — an estimate, never validated.

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




### Batch 010.1 — Pipeline alerts (MERGED: 010.1 + 010.2 + Path 2)
Sequenced after Batch 006. Collapses the three formerly-separate items
(pipeline drought alerting, brand contract management, and the Path 2
off-by-one) into one coherent build.

- **Per-brand targets on the brand record** — milestone targets AND
  pipeline-stage thresholds, replacing the flat **4/28d** constant
  (`COVERAGE_TARGET`; it was 2/28d until the 2026-08-03 coverage-honesty
  batch — do NOT go looking for a `2`). Driven by the fact that contracts
  already vary per brand (the old "gated on a real contract" trigger for
  010.2 is moot).
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
- **Path 2 off-by-one — SETTLED 2026-08-03 on both sides; the parity narrative is
  relocated** to `docs/claude-archive/CLAUDE-16-2026-08.md` (r42). **No parity work
  is owed.** What 010.1 still owns is STRUCTURAL, and it is an action:
  - [ ] **Collapse the drought threshold to ONE per-brand target compared with
        strict-less-than, in one place.** It is currently two spellings that happen
        to coincide — `COVERAGE_TARGET = 4` with `count < target` in
        `lib/coverage/queries.ts`, and `alert_rules.config.threshold = 3` with
        `count <= threshold` in the cron — **plus a third value**, the evaluator's
        unused `DEFAULT_THRESHOLD = 2` fallback, which would **silently** reopen the
        divergence if that config row were ever deleted, deactivated or stripped of
        its `threshold` key. Removing that fallback is the load-bearing half.
        **Do not reintroduce a threshold-and-`<=` shape** in `queries.ts`: writing 4
        into the old spelling makes 4 read as DROUGHT.
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

### Sync-guard deferred follow-ons (from the 2026-08-08 batch — see §16)

Eight items the skip-if-empty batch deliberately did NOT do. Each is recorded with
its reason so nobody re-derives the analysis.

- [ ] **Recover the 5 damaged rows.** `b77c1d57` · `a6111337` · `a57c357c` ·
      `bf5fc1d7` · `67079106` each lost `issue_category`, `issue_subtype`,
      `root_cause_final`, `resolution_type`, `severity`, `who_owns_fix`. **The prior
      values are all recoverable from `audit_log`** (each has a human `UPDATE` row
      carrying the old value). Not bundled into the code fix — restoring them is a
      production data write and Lacey's call; it would be its own reviewed,
      dry-run-first script like the Convert reconciliation. Note the guard does NOT
      restore them: it only stops future loss.
- [ ] **§13 r3's root-cause snapshot is structurally a no-op.**
      `root_cause_initial` is written once, by the webhook at log creation — but the
      Jira QA tab is *already cleared* at sendback time by the Jira automation (§6),
      so the "snapshot" captures nothing. Measured 2026-08-08: **74 of 83**
      webhook-created logs have it empty, versus **0 of 38** CSV-imported. The only
      writer of a `root_cause_initial` audit row in the entire table is
      `system:normalize-quality-log-fields` (36 rows). Fixing this means changing
      *when* the snapshot is taken — a Jira-workflow decision, not a code guard, so
      it needs Lacey + a workflow call rather than a batch.
- [ ] **Full §13 r2 closure for the sync.** The batch audits **7 of 16** written
      columns (up from 0 of 16). `client_brand`, `jira_summary`, `detected_by`,
      `reproducibility` and the four booleans still change with no audit row. Deferred *with a reason, not overlooked*: `audit_log` is at
      **1,557 rows (2026-08-08)**, already over the PostgREST 1,000 cap, and
      `/dashboard/logs` reads it **unranged** for the sendback badge. Land this with
      that pagination fix, not before.
- [ ] **`supabase/functions/_shared/`.** `mapJiraFields` and `resolveBrandForSync`
      are duplicated between `jira-sync` and `jira-webhook`, held together only by a
      comment (`jira-sync/index.ts:218`). The guard block is now a *third* such copy,
      but it is at least drift-tested. `_shared/` is the real structural fix and is
      officially supported by Supabase; it was not done in a data-loss fix because no
      such directory exists yet and it cannot be bundle-tested locally (no Deno,
      `supabase functions serve` needs Docker). Do it as its own batch, where a
      deploy failure is diagnosable.
- [ ] **The webhook has the same `?? []` coercion**
      (`jira-webhook/index.ts:333–344`). Harmless *today* only because the webhook
      runs at row creation, where there is no prior value to destroy. It is the same
      shape as the defect that cost five rows; do not assume it stays harmless if the
      webhook ever updates an existing row.
- [ ] **The latent ADF hazard on `root_cause_description` — STILL OPEN.**
      **Restored to §15 on 2026-08-22 by Karen's H2**: the CLAUDE.md split batch
      archived this whole bullet on the strength of its `[x]` FIRST half
      (*"Nothing is owed here now; the guard covers it"*) and carried its
      still-open SECOND half out with it. `grep ADF CLAUDE.md` returned 0 for
      several commits; the closed half is at
      `docs/claude-archive/CLAUDE-16-2026-08.md`, and under §13 r40 an archive
      file is never authority — so a live production hazard had formally ceased
      to exist as a live fact. **The `Eight items` count above IS the regression
      test for this bullet; it is not reworded to seven.**
      **TWO faces.** **(i) The write:** an ADF object into a `TEXT` column —
      `mapJiraFields` does `fields[customfield_12909] ?? null` with **no ADF
      extraction**, while §7 documents that field as a Jira **Paragraph** (API v3
      returns an ADF *object*). **(ii) The guard's blind spot:**
      `isEmptyForSync` treats any non-array object as non-empty, so a field
      *cleared in Jira* returning an empty ADF doc
      (`{type:'doc',version:1,content:[]}`) rather than `null` reads as a real
      value and is written — which is why the r37 guard's protection on this
      column is **contingent on Jira sending literal `null`**.
      Both fail SAFE (the TEXT write errors, the log counts failed, the prose
      survives) and both are latent: probed 2026-08-08, 0 of 33 working-set
      tickets return a non-empty `customfield_12909`. Deliberately **not**
      patched with a speculative ADF-shape heuristic — that buys sync
      throughput, not data safety.
- [ ] **§13 r29 — the sync writes taxonomy values unvalidated.** The edit route
      validates every value against `quality_log_taxonomy`
      (`app/api/logs/edit/route.ts:86–137`); the sync validates none. Post-guard a
      non-empty Jira value still overwrites a validated human value with an
      unvalidated one. r29 says "constrained at every write surface" — this surface
      is not. Left alone deliberately.
- [ ] **The auto-advance audit row still uses bare `'system'`**
      (`jira-sync/index.ts`, predates §13 r20, and r20 explicitly carves it out).
      Left as-is on purpose: changing it would split one event type across two
      `changed_by` values, so an operator filtering `'system'` would silently stop
      catching new auto-advance rows. Only worth changing alongside a backfill.

### AI root-cause classifier — PARKED, not dropped (2026-08-14)

**The surface shipped; the path has never run.** Batch classifier-1 and the
logs-page suggestion strip are both in production, so the columns, routes, review
UI and the whole confirm/reject/correct flow exist and are tested. **Not one row
has been classified** — `ai_review_pending` true on **0 of 122**,
`ai_suggested_root_cause` non-null on **0 of 122**, and the route answers **500
`not_configured`** by design until a key exists. Full rationale in
`docs/claude-archive/CLAUDE-16-2026-08.md` (r42). The two actions:
- [ ] **Run the FREE test first — do this BEFORE paying for anything.** Classify
      **~10 logs by hand with Rovo in the Jira UI**, entering results through the
      existing edit modal. No build, no credential, no spend. It tests the thing
      the money would buy — *are the suggestions good enough to be worth
      confirming?* — and produces real correction-rate data, which spec §2 makes
      the batch's ONLY validation.
- [ ] **Blocked on a commercial decision, not an engineering one:**
      `CQIP_ANTHROPIC_API_KEY` is unminted and the spend question is unresolved at
      F92. Nothing in the codebase is waiting.
**Unparks on EITHER** the credential being minted **or** the manual pass showing
quality good enough to justify automation.

**Why this framing and not "blocked":** the classifier spec's §2 makes the correction
rate the batch's ONLY validation, and a manual pass generates exactly that signal at
zero cost. Parking it behind a spend decision while an unpaid test of the same
hypothesis is available would be waiting for the wrong gate.

**Do not read the shipped surface as evidence the classifier works.** §16 records it
as UNEXERCISED for this reason, and that wording should survive until a real run
exists.


### ⚠ Directive archiving is REACHABLE after all — a recorded claim is falsified

**The lesson, kept; the narrative relocated** to
`docs/claude-archive/CLAUDE-16-2026-08.md` (r42). A 2026-07-29 audit recorded
archiving as *verified unreachable* on the strength of `grep` over `app/api/`
alone; prod then turned out to hold an archived directive written by **direct
SQL**. **A "no writer exists" claim must state which surfaces were checked** —
that half generalises and is why this stays in §15 rather than leaving entirely.

- [ ] **Give the matrix a signal for archived directives.** Either include them in the
      duplicate-risk count, or land the `POST /api/admin/directives` duplicate-title
      check first (already a §15 item). **A `status` filter that hides rows a user is
      searching for needs to say so** — the same lesson as B5's hidden-count readout.
      **✅ SHIPPED 2026-08-18 — Batch 012 directive CRUD (see §16), which did BOTH** and went past the
      signal: archived rows become *viewable* behind a `Hide archived` toggle, so the
      answer to "does it exist?" stops being a count and becomes the row itself. Note
      the count signal shipped 2026-08-14 (`countArchivedMatchingSearch`) and its
      wording — *"…are not shown"* — becomes FALSE the moment the toggle is off, so
      that batch must gate it on `hideArchived` rather than leave it standing.

### Logs-page deferred follow-ons (from the 2026-08-12 batch, Lacey's scope call)

Both were FOUND and CHARACTERISED during the B2 investigation and deliberately left
open — recorded so they are not re-discovered from scratch.

- [ ] **A ruling followed by "Save changes" writes TWO `audit_log` rows for one
      `root_cause_final` change, the second carrying a stale `old_value`.**
      `applyEditedLog` deliberately never updates `editingLog` — that is what keeps
      the seeding effect from re-firing and clobbering unsaved edits — so after a
      ruling the dialog's `log.root_cause_final` stays at its pre-ruling value while
      the dropdown holds the confirmed one. A later Save therefore diffs against the
      stale prop and emits a second row for a change
      `app/api/admin/logs/ai-review/route.ts:227` has already audited.
      **PRE-EXISTING on the `correct` path since COMMIT 4** — the Karen fold extended
      it to `confirm`, it did not create it.
      **Not data loss and not a `who` ambiguity** — both rows carry the same
      server-derived `changed_by`; what is duplicated is the *transition*, and
      what is stale is `old_value` on the second row. Neither row was false when
      written. **Four candidate fixes, each with a real cost, none free** — the
      analysis is in `docs/claude-archive/CLAUDE-16-2026-08.md` (r42). The one to
      start from is **keying the seeding effect on `log.id` rather than `log`
      identity**, which allows a refresh without clobbering but needs a companion
      reset on the `open` transition or close/reopen of the same row keeps stale
      form state. It is a design change, so it belongs in its own batch, and
      **nothing accrues meanwhile**: the strip is unexercised in prod (0 pending
      rows, no credential).
- [ ] **SIX MORE orphaned labels on `/dashboard/reports`** — `severity`, `status`,
      `issueCategory`, `rootCauseFinal`, `testType`, `whoOwnsFix`. Found while
      investigating the brand one, **verified independently by Karen**. All six
      render `<Label htmlFor="…">` above a `<Select>` whose `SelectTrigger` carries
      no `id`, so each label points at nothing. **Pre-existing, unrelated to
      `BrandSelector`, and one word each to fix** (`<SelectTrigger id="severity">`,
      matching what the logs page already does). Left out of the fold deliberately —
      it would widen a Karen-fold commit onto a page this batch otherwise only
      deletes from. **`tests/ai-suggestion.test.ts` now pins them in a
      `KNOWN_ORPHANS` allowlist**, so the audit fails three ways: a NEW orphan
      appears, one of these six is fixed without updating the list, or `clientBrand`
      regresses. That test is the thing that would have caught the original defect.
- [ ] **Paused brands are listed in the dropdown with no indication.** Measured
      2026-08-12: MRR-CA, SHG and WDG are `is_paused`, and **MRR-CA and WDG have
      ZERO non-deleted logs**, so selecting either yields a bare "No logs found for
      the selected filters" with nothing explaining why. `BrandSelector` already
      fetches `is_paused`. Deferred as a **design** change rather than a fix: the
      Coverage page has an explicit `showPaused` toggle and Pulse hides paused
      columns by default, so a third treatment here should match one of them rather
      than invent a fourth. Decide alongside Batch 005.22 Phase 4 (project-aware
      logs dropdown), which touches the same component.

### ⚠ The CLAUDE.md split did NOT reach the read limit on its first pass

**Recorded explicitly rather than left implicit (Karen H1, 2026-08-22).** The
batch existed to make this file readable whole by the tool that treats it as
ground truth. **It did not achieve that on the first pass.**

- **Before:** 631,268 characters. **After the split + the Karen fold + the
  clause-3 (r42) pass: ~153,000.** A **~76% reduction**, every invariant intact —
  and still **over the 150,000-character tool limit**, and well over the 120,000
  ceiling this batch set for itself in r41.
  **The exact figure is deliberately NOT written here.** This paragraph is part
  of what it would measure, so every correction moved the number it quoted — a
  fixed point, and chasing it is how a stale count gets written down. **The live
  number is the `[claude-md]` line from `npm run build` (prebuild, r41), which
  measures at run time and also names the section that grew.** Read that, not a
  figure in prose.
- **Jenny's round-2 projection was ~106,490.** It assumed §15 would reach a
  34,000-character budget. §15 finished the first pass at **74,120** and the
  clause-3 pass at **63,551 as measured at `f374676`** — dated per r43, because
  this paragraph sits inside §15 and is part of what it measures. The budget was
  never reached and, on the evidence, was never reachable under the cut rule.
  (Two earlier drafts said **59,172**, taken one commit before the text quoting
  it existed — the r43 error, committed inside the entry about it.)
- **r42 is NOT exhausted — an earlier draft of this entry claimed it was, and
  that claim was false.** It said the last three relocations netted "~36
  characters each" and concluded further reduction needed a different mechanism.
  Measured per relocation, the range is **−36 to −848 characters (3% to 66%)**;
  "~36" was true of **exactly one**, and that one had *added two new checkbox
  actions* — r42 restructuring narrative into actions, which is the rule working,
  not failing. **r42 remains available as r41 remedy #2.** (Karen re-review
  HIGH-4, 2026-08-22.)
- [ ] **Decide the second pass.** **Scope it off the live `[claude-md]` prebuild
      breakdown, not off any figure written here** — every number in this
      subsection is part of what it measures (r43). At `f374676` the loads were
      §15, then §13 (which r41 explicitly rules out), then the §16 archive index.
      The index is the only untouched candidate; trimming it trades "find a batch
      by name without grepping six files" for roughly its own size. **That is a
      real trade and it is Lacey's call, not a cleanup.**

**Do not let this entry be deleted when the file next comes under the limit.**
It is the record that the ceiling in r41 was set by a batch that did not meet it.

### Ops / deferred

- [ ] **Finish paying off `docs/repo-structure.md`'s r23 obligation.**
      §13 r23 was amended 2026-08-22 to name that file as a per-ship destination
      (Karen H4 — its header had *claimed* r23 named it when r23 did not). The
      same fold paid off the parts that were countable against a source of
      truth: **all 29 migrations** (11 were missing, including **029**, applied
      to production by that very chain) and three absent scripts. **Still short:
      API routes (~16 of 24 present) and `docs/*.md` (~9 of 39).** Recorded as an
      obligation rather than left silent, because the failure mode changed with
      the amendment: before, the claim was false and *visibly* so; now the rule
      is true and the file quietly fails it, which reads as maintained.
- [ ] **Stale present-tense prod-SHA claims — 8 of 10 RESOLVED BY RELOCATION
      2026-08-22; only the version-line half is still actionable.** (Rewritten
      per Karen H5: the CLAUDE.md split invalidated this item and it still said
      "remain in CLAUDE.md".) The eight — `dc377df`, `9088343`, `d21ceea`,
      `5795a89`, `cdb2cc6`, `d03f319`, `2826f4b`, `72bb2a0` — each read
      `prod /api/health reports version: <sha>` in the present tense inside a
      months-old batch entry. Every one of those entries moved to
      `docs/claude-archive/`, where §13 r40 makes the whole file history rather
      than a current-state claim, which is the fix this item asked for. Verified
      2026-08-22: each SHA now appears **exactly once in CLAUDE.md — in this
      list** — and **§0 holds none**, so the specific hazard named below (a
      dated SHA read as current because §0 was titled "Current deployed state")
      is gone: that paragraph is now
      `docs/claude-archive/CLAUDE-critical-history.md`.
      **Still actionable:** the title block at line 3 reads
      `### Fusion92 | CRO Department | v2.8` while the repo declares **v3.0** —
      same class, one line, fix it with these.
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

(The Convert reconciliation backfill is NOT here — it lives in §16: it is BUILT
and reviewed, awaiting only Lacey's run, so it is not in-flight work.)

(Batches logs-page, classifier-1 and sync-guard moved to §16 on 2026-08-14 in the same
commit that wrote their shipped entries, per r34. The sync-guard move was **six days
overdue** — its §15.5 entry still read "BOTH COMMITS BUILT, Karen post-flight next"
while its own body already recorded Karen done and a COMMIT 4 widening, and no §16
entry existed. That is exactly the drift r34 exists to prevent, and it happened anyway
because the reconcile was never the same commit as the ship.)

## 16. Shipped Features Log

Every entry has rolled over to `docs/claude-archive/` under §13 **r41** — the
size ceiling, not the calendar. **§16 is where new entries land**: per §13 r23
a batch still writes its shipped entry *here*, and it ages out to the archive
only when the ceiling next trips.

**The archive is HISTORY, never authority (§13 r40).** Every entry below was
true on its ship date. For current state read the `Prod right now` stanza at
the top of this file, and `docs/schema.md` for schema — never an archive entry.

**Index generated, not hand-maintained** — `npm run archive:index` rewrites it
from the archive files; `npm run archive:index:check` fails if it is stale. A
hand-kept index would be a third copy of state and would drift from the two it
indexes, which is the failure this batch existed to remove.

**It lists 87 items, not 77.** 77 are the shipped §16 entries; the other 10 are
whole §15 subsections that were closed and archived by the same batch. Both live
in the month files, so both are indexed — the count is of items in the archive,
not of shipped batches.

### Archive index

**[`CLAUDE-16-2026-pre-04.md`](docs/claude-archive/CLAUDE-16-2026-pre-04.md)** — 1 item

- v1.0 — Foundation (pre-April 2026)

**[`CLAUDE-16-2026-04.md`](docs/claude-archive/CLAUDE-16-2026-04.md)** — 16 items

- Batch 001 — April 2026
- Batch 001.5 — April 2026
- Batch 002 — Client Coverage — April 2026
- Batch 002.5a/b — Audit generalization — April 2026
- Batch 003 — Sync diagnostics + branded exports + dashboard drill — April 2026
- Batch 003.5 — CQIP_SYNC_AUTH_KEY decoupling — 2026-04-24
- Batch 004.0 — pg_cron jira-sync — 2026-04-26
- Batch 004.1 — Milestone branch hardening — 2026-04-24
- Batch 004.2 — Dependabot triage — 2026-04-26
- Batch 004.3 — Audit-write security cleanup — 2026-04-26
- Batch 004.4 — Drought rule evaluator — 2026-04-27
- Batch 004.9 — audit_log target_type cleanup — 2026-04-29
- Batch 004.8 — Middleware admin-route gating — 2026-04-29
- Batch 004.7 — Active alerts panel: brand-scoped render path — 2026-04-28
- Batch 004.6 — Pre-demo security batch — 2026-04-28
- Batch 004.5 — Brands QA-config extension — 2026-04-26

**[`CLAUDE-16-2026-05.md`](docs/claude-archive/CLAUDE-16-2026-05.md)** — 31 items

- Pre-demo / immediate
- Batch 004.99 (post-Batch-004) — Multi-Client Readiness Review — shipped 2026-05-06
- Batch 005.25 — Brand dropdown fix + client_brand normalization
- Batch 009 — SharePoint integration — SHIPPED 2026-05-29
- Batch 009 — SharePoint integration LIVE — 2026-05-29
- Batch 011 — Node 24 upgrade + /api/health endpoint — 2026-05-27
- Azure prereqs verification + docs cleanup — 2026-05-26
- Batch 005.31a — Auto-deploy build-secret hotfix — 2026-05-26
- Batch 005.31 — GitHub Actions auto-deploy to Cloudflare Workers — 2026-05-22
- Batch 005.29 — Client Request category + 6 client-change-request subtypes — 2026-05-22
- Batch 005.28 — Taxonomy hardening + normalization + docs hub — 2026-05-20
- Batch 005.22 Phase 3 — Dashboard mount + layout reorder + chart re-scope — 2026-05-20
- Batch 005.22 Phase 2.1 polish round 1 — pill redesign + UX trim — 2026-05-19
- Batch 005.22 Phase 2.1 — Paused-brand hide + single-brand row skip — 2026-05-19
- Batch 005.22 Phase 2 — Shared project+brand filter + Coverage mount — 2026-05-19
- Batch 005.25 — Brand dropdown fix + client_brand normalization — 2026-05-13
- Batch 005.25 scoping — 5.19 sweep closure + Batch 005.25 entry — 2026-05-12
- Batch 005.24 — Joint cross-project doc + R16/R17 — 2026-05-12
- Batch 005.23 — §15 restructure + CLAUDE_RULES.md companion — 2026-05-12
- Batch 005.21 — SharePoint integration groundwork docs — 2026-05-11
- Batch 004.99 — Multi-Client Readiness Review — 2026-05-06
- Batch 005.22 Phase 1 — Project-aware brand resolution — 2026-05-07
- Batch 005.20 — Brand admin UI: create-brand drawer — 2026-05-07
- Hotfix — drought-evaluator secret resync — 2026-05-07
- Batch 005.9 — UI copy: remove NBLY-coded examples — 2026-05-06
- Batch 005.3 — Remove diagnostic client_brand warns — 2026-05-06
- Batch 005.10 — Sync with Jira pass/fail indicator — 2026-05-06
- Jira config — QA field auto-clear — 2026-05-06
- Batch 004.12 — Saturday dashboard accuracy + logs page count — 2026-05-02
- Batch 004.11 — Saturday code pull-forward — 2026-05-01
- Batch 004.10 — Pre-demo UX polish — 2026-05-01

**[`CLAUDE-16-2026-06.md`](docs/claude-archive/CLAUDE-16-2026-06.md)** — 1 item

- Batch 010 — Coverage pipeline visibility — 2026-06-03

**[`CLAUDE-16-2026-07.md`](docs/claude-archive/CLAUDE-16-2026-07.md)** — 25 items

- auth.1 / auth.2 — Identity migration + admin password reset (scoped 2026-07-03)
- Batch 005.2 — Coverage Ledger redesign — SHIPPED 2026-07-08 (see §16)
- Batch 005.5 — Reggie brand-detail drawer polish — SHIPPED 2026-07-09 (see §16)
- Batch 010.2 — Brand contract management — MERGED into Batch 010.1
- Batch 012 — Pulse: brand-page parity + matrix paused default — 2026-07-31
- HOTFIX — paginate the Pulse cell reads (PostgREST 1,000-row cap) — 2026-07-31
- Batch 012 — Pulse: directive matrix controls (search · status filter · sort · hide paused) — 2026-07-29
- Batch 012 — Pulse: admin inline directive editing on the brand page — 2026-07-25
- Batch 012 — Pulse: Convert reconciliation backfill — 2026-07-25 (BUILT, NOT YET RUN)
- Batch 012 — Pulse: inline directive editing (kill both modals) — 2026-07-21
- Batch 012 — Pulse E1 follow-on: cross-project client nav — 2026-07-21
- Batch 012 — Phase E1 — Pulse shell (rename + brand pages + nav) — 2026-07-21
- Batch 012 — Client Library, Phase B — Monitoring Ingest — 2026-07-17
- Batch 012 — Client Library, Phase A (Directive Matrix MVP) — 2026-07-17
- Batch 005.5 — Reggie brand-detail drawer polish — 2026-07-09
- Batch 005.4 — Coverage Ledger polish, pass 2 — 2026-07-09
- Batch 005.3 — Coverage Ledger polish — 2026-07-08
- Batch 005.2 — Coverage Ledger redesign — 2026-07-08
- Batch Brand Wellness (v1) — read-only milestone-history proof — 2026-07-07
- Batch create-flow — user creation on real emails (last @cqip.local source) — 2026-07-07
- Batch auth-cleanup — login is email-only; the auth chain is complete — 2026-07-06
- Batch login-events — login-activity recording (plumbing only) — 2026-07-06
- Batch auth.1 — Email migration + email-primary login — 2026-07-05
- Batch auth.2 — Admin temp-password reset + account-recovery hardening — 2026-07-05
- Batch 005.1 — Coverage redesign + BrandAdminDrawer — 2026-07-03

**[`CLAUDE-16-2026-08.md`](docs/claude-archive/CLAUDE-16-2026-08.md)** — 13 items

- Drought predicate off-by-one check (Path 2) — DISSOLVED into Batch 010.1
- ⚠ Brand dropdown panel CLIPPED — FIXED, committed, NOT YET PUSHED
- Batch 012 — Pulse: directive CRUD (edit · soft-delete · archive) — 2026-08-18
- Batch 012 — Pulse matrix: filter reorg + grid ergonomics — 2026-08-14
- Batch logs-page — dismiss guard + filter bar + AI suggestion strip — 2026-08-14
- Direct-SQL directive add — five NBLY chat goals — 2026-08-12
- Batch classifier-1 — AI root-cause classifier, Phase 1 — 2026-08-14
- Batch sync-guard — skip-if-empty guard + sync audit rows — 2026-08-08
- Batch telemetry-ac — AC → DC telemetry + System Info AC section — 2026-08-07
- Deploy unfreeze — `keep_vars` + CI as canonical path — 2026-08-06
- Coverage metric honesty — target 4 + metric rename — 2026-08-03
- Batch 012 — Pulse: restyle batch 3 of 4 — hover-inspect + note surfacing — 2026-08-03
- Batch 012 — Pulse: restyle core (batch 2 of 4) — 2026-08-02
---

*Last updated: 2026-08-22 | CQIP v3.0 — **BATCH 012 PULSE DIRECTIVE CRUD (edit · soft-delete · archive) — SHIPPED + PUSHED + DEPLOYED 2026-08-18; prod `/api/health` now reports `version: d5e5703`** — the docs-only rev-7 outline commit. **No application code changed** (no `.ts`/`.tsx` moved from `e518624`), but the bundle is NOT identical: `package.json` is a build input as well as a deploy trigger, so `gen-build-info.js` stamped the bump into `NEXT_PUBLIC_APP_VERSION` and **v3.0 IS live — Settings → System Info renders `3.0.0`**, which retires the entry's own "declared ≠ deployed" framing rather than patching it. **The §16 entry's ⚠ 0 predicted the SHA would hold at `e518624` and that was WRONG**: `deploy.yml`'s `paths-ignore` is `**.md` / `docs/**` / `.github/**` and does NOT cover `package.json`, so the version bump itself triggered CI, which stamped the pushed tip — struck in place there, not deleted. Migration 029 (`idx_directives_project_title`, UNIQUE `(project_key, title)`, spanning archived rows) is **APPLIED TO PRODUCTION**, verified by direct query in the prod Supabase SQL editor 2026-08-18 — stated with its environment and method because *deployed* and *migrated* are independent facts and `/api/health` reports the **Worker only**. **Jenny pre-flight ×2** (rev 1 DO-NOT-BUILD-YET: 1 CRITICAL · 3 HIGH · 6 MEDIUM · 10 LOW → rev 2 APPROVE-WITH-FINDINGS: 1 HIGH · 10 MEDIUM · 4 LOW), **FIVE Karen rounds** (2H/7M/5L → 2H/1M/4L → 0/2M/2L → 0/1M/2L → 0/0/3L). **Read that progression, not the total:** the original build's HIGHs were found in round one and never recurred, **every HIGH in round two was in a FIX**, and rounds three-to-five found nothing above MEDIUM — the core machinery was re-confirmed three times against three different trees, while what kept failing was the *claims*. Jenny's CRITICAL changed the design: the `project_key` block was specified only as a render-layer lock, so ordinary two-admin concurrency would have destroyed 16 cells including notes **with no `old_value` anywhere in the trail** (§13 r37's shape); the route now re-runs the **same shared predicate** against freshly-read cells. The predicate is a **three-clause conjunction** — the two-clause version would have wrongly allowed moving **5 of its 6 "movable"** directives, because `n_a` is not machine-only and **620 prod cells** that looked like fan-out output had in fact been written. It is kept fail-safe **by construction**: every clause can only SHRINK the movable set, so `project_key` being editable on **1 of 89** directives is the predicate working, not failing — and every directive created from now on is movable until someone works it. **⚠ My own audit caused a HIGH:** COMMIT 7 claimed "exactly ONE `setEditingDirectiveId(null)` remains" on a grep for that **literal string**, which cannot match the **ternary** form the row's Edit/Close toggle uses — §13 r38 mechanism (a), a count stated on an instrument that could not see the case. Karen later re-derived it by **AST**. Three defects in this chain were created **by** the fix before them, and each was closed with a **mechanism rather than a longer list**: clear-on-unmount over a ninth enumeration entry, then its prop-identity dependency **removed** rather than documented, and a prompt that fires only when the click would actually drop the edited row — because a dialog that is usually wrong trains the user to click through, which is how a guard stops working without breaking. **Same-shape duplication removed THREE times in one batch** (`CELL_STATUS_LABEL`, the duplicate-title message whose drift mutation *survived*, `visibleForLifecycle`) — recorded as a rule CANDIDATE, **not promoted**: *the comment is the tell*, since all three carried a comment asserting parity and one was demonstrably false with every gate green. **Directive count re-derived 2026-08-18 grouped by `project_key` AND `status`:** NBLYCRO active **87** · archived **1** · SPLCRO active **1** · global active **88** · all rows **89**. The apparent three-way conflict was **one stale figure plus one MISLABELLED comparison** — "NBLYCRO active" = 87 (matrix header, correct) versus "directives holding cell work" = 88 of 89 (the runbook's, a *different quantity*); rev 6's 86/87 was stale 08-14 data. **The label is the fix.** Gates at five trees: tsc 0 · ESLint 0 · **376/376** (from 333) · build 0 · **44 mutations run, 42 caught**, both survivors verified equivalent mutants. **⚠ NOT VERIFIED, carried forward: there is NO route-level test harness** — Lacey's Scenario A result (`a059d078`, 409 with `blocking_cells: 16`, hash `a2808d54…`, SPLCRO 0, still `NBLYCRO`, zero audit rows) is a **HAND-RUN OBSERVATION, NOT COVERAGE**; **the guard has been observed REFUSING but never PERMITTING**, since the positive case was deliberately skipped (it writes a permanent prod directive and archiving does not free the title) — **the batch's oldest open item**; the `splitShownByLifecycle` **caller remains UNCOVERED** (one call expression, one surviving mutation, all gates green — the extraction narrowed the surface, it did not close the caller); and **`clearAllFilters` is correct BY ACCIDENT**, resetting `statusFilter` to `'all'` which strictly widens — nothing pins that, and a "restore defaults" edit to `'open'` reinstates the silent-loss path in one line.*
