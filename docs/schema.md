<!-- Extracted from CLAUDE.md §5 by the CLAUDE.md split batch, 2026-08-22.
     This is CURRENT AUTHORITY, not archive: it carries no r40 non-authority
     banner, and CLAUDE.md §13 r23 names it as a required destination on
     every ship. Keep it updated atomically with the code, same as before. -->

# Database Schema

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
  ai_suggested_root_cause     TEXT[],    -- AI suggestion (Batch classifier-1)
  ai_confidence_score         NUMERIC,   -- UNUSED in Phase 1 — see ai_confidence_band
  ai_confidence_band          TEXT       -- migration 028: high|medium|low, CHECK-constrained
                                CHECK (ai_confidence_band IS NULL OR
                                       ai_confidence_band IN ('high','medium','low')),
  ai_review_pending           BOOLEAN NOT NULL DEFAULT FALSE  -- migration 028
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

### ac_telemetry / ac_version_seen / ac_telemetry_rejects (migration 026 — Batch telemetry-ac)
AC (the Forge QA-automation app) runs only inside Jira and exposes no pollable
surface, so it PUSHES events to `POST /api/telemetry/ac` and DC renders them on
Settings → System Info. First AC-authored WRITE into DC storage; every prior
AC↔DC surface is AC reading DC. Spec: `docs/specs/telemetry-ac.md`.

```sql
CREATE TABLE ac_telemetry (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_version   TEXT NOT NULL,
  commit        TEXT NOT NULL,
  event         TEXT NOT NULL CHECK (event IN
                  ('draft_ok','draft_error','post_ok','post_error')),
  ticket        TEXT NOT NULL,
  error_kind    TEXT,          -- deliberately NOT CHECKed (see below)
  error_detail  TEXT,          -- redacted + truncated at the DC boundary
  env           TEXT NOT NULL CHECK (env IN ('dev','prod')),
  ts            TIMESTAMPTZ NOT NULL,   -- AC clock, DISPLAY ONLY
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- DC clock, orders everything
);
CREATE UNIQUE INDEX idx_ac_telemetry_dedupe
  ON ac_telemetry(env, commit, event, ticket, ts);

CREATE TABLE ac_version_seen (        -- NEVER pruned
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  env TEXT NOT NULL CHECK (env IN ('dev','prod')),
  commit TEXT NOT NULL, app_version TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_ac_version_seen_unique ON ac_version_seen(env, commit);

CREATE TABLE ac_telemetry_rejects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason TEXT NOT NULL, detail TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`error_kind` is deliberately NOT CHECK-constrained.** AC owns that taxonomy; a
DC allowlist would turn an AC-side taxonomy addition into a DC migration PLUS a
hard ingest failure — the cross-project coupling §13 r27's blast-radius reasoning
exists to avoid. `event` and `env` ARE closed sets and are CHECKed.

**`ac_version_seen` exists because retention would eat the thing it derives.**
"First event per commit" is by definition the OLDEST row for that commit —
precisely what pruning deletes first — so a commit live past the window would
lose its own first row and the rendered date would silently jump FORWARD to the
oldest survivor. Always wrong, always more-recent, never an error.

**`ac_telemetry_rejects` makes shape drift visible.** AC swallows telemetry
failures by design, so a payload-shape regression would otherwise render as "no
events in 7 days" — which an operator reads as *AC is dead* when AC is fine.

**Retention:** `public.prune_ac_telemetry()` keeps rows within 90 days OR the
newest 500, whichever set is larger. Called **inline from the ingest route**, not
cron: no ops step to forget, no new cron surface (cf. the 2026-05-07 silent
drought failure), no edge function ⇒ no `verify_jwt` (r21) and **no fifth shared
secret** (r27). Prune failure is swallowed; it must never fail an ingest.

**RLS:** admin-only SELECT via `public.is_admin()` on all three (the
`login_events` posture); no INSERT/UPDATE/DELETE for `authenticated` — every
write is service-role from the route. **Load-bearing, not boilerplate:**
`app/dashboard/settings/system/page.tsx` is `'use client'` on the **anon key**,
so without a SELECT policy the AC section renders empty with no error.

**No audit rows on ingest** — r2 is scoped to `quality_logs`, and
`/api/monitoring/findings` sets the external-feed precedent.
`audit_log_target_shape_chk` needs no extension.

**Migration 027 — `prune_ac_telemetry()` EXECUTE grant.** 026's
`REVOKE … FROM PUBLIC` was **insufficient and was proven so against production**
right after it was applied: an anon-key RPC still returned 200. Supabase's
`ALTER DEFAULT PRIVILEGES` grants EXECUTE on new `public` functions to `anon` and
`authenticated` **explicitly**, and an explicit grant to a named role survives a
revoke from PUBLIC. 027 revokes from `anon` and `authenticated` by name. Harmless
while it lasted — invoker rights + RLS + no DELETE policy meant the call returned
`(0,0)`, exactly as predicted — but 026 claimed a lockdown it had not achieved.

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

### directives / directive_brand_status (migration 024 — Batch 012 Phase A)
The Pulse directive × brand status matrix. **Isolation contract: these tables
never touch the live coverage tables** (`brands` / `test_milestones` /
`quality_logs`) beyond FK references, and **no coverage KPI reads from them.**

```sql
CREATE TABLE directives (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key    TEXT NOT NULL REFERENCES projects(jira_project_key),
  title          TEXT NOT NULL,
  directive_type TEXT NOT NULL CHECK (directive_type IN
                   ('goal','trigger','site_area','audience')),
  description    TEXT,
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','archived')),
  created_by     TEXT NOT NULL,      -- server-derived via getChangedBy()
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE directive_brand_status (       -- the matrix cells
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  directive_id UUID NOT NULL REFERENCES directives(id) ON DELETE CASCADE,
  brand_id     UUID NOT NULL REFERENCES brands(id)     ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'todo'
                 CHECK (status IN ('todo','in_progress','done','blocked','n_a')),
  note         TEXT,
  updated_by   TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (directive_id, brand_id)
);

-- Migration 029 (Batch 012 directive CRUD):
CREATE UNIQUE INDEX idx_directives_project_title
  ON directives (project_key, title);
```

**`directives.status` IS the soft-delete flag** — there is no `is_deleted`
column and there must not be one. Delete sets `'archived'`; restore sets
`'active'`. `lib/client-library/directives.ts` mirrors the set as
`DIRECTIVE_STATUSES`. **Archived is a lifecycle flag, NOT a completion state** —
"resolved" is *derived* across a directive's cells by `summarizeDirectiveCells`,
and conflating the two makes retired directives count as coverage achievements.
`computeMatrixKpis` therefore filters `status === 'active'` internally so it
cannot count an archived directive even when handed one.

**Migration 029's unique index spans ALL statuses, not just active.** A partial
index would let a title be reused while the original is archived, after which
*restore* — the only undo path for a soft-delete — would fail at the database.
Verified before applying: 0 duplicates across all 89 rows at every strictness,
including case/whitespace-insensitive.

**Cells are keyed to `brand_id`, so they belong to a PROJECT implicitly.** Moving
a directive's `project_key` would strand them: they render nowhere (the new
project's columns don't match) yet `computeMatrixKpis` scopes cells by
`directive_id`, so they'd still be counted — counted-but-invisible, silently.
This is why `project_key` edits are blocked on any directive holding work; see
§15.5.

RLS mirrors migration 009 on both tables: authenticated SELECT, admin `FOR ALL`
via `public.is_admin()`. Migration 024 also extended
`audit_log_target_shape_chk` to admit `target_type` of `'directive'` and
`'directive_brand_status'`.

(**Doc gap, pre-existing:** `monitoring_findings` (migration 025, Batch 012
Phase B) is still absent from §5. Not this batch's table; recorded so it is
found rather than rediscovered.)

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
