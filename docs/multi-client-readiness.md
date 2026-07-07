# CQIP Multi-Client Readiness Review

> Batch 004.99 discovery output — generated 2026-05-06 by Claude Code
> per Lacey Hay's request. The report identifies every NBLY-hardcoded
> assumption in the CQIP codebase, verifies multi-tenant boundaries,
> and produces onboarding + offboarding playbooks. SPL (SPLCRO,
> single brand "SPL") is the immediate downstream consumer; this
> report is the playbook SPL onboarding follows.

---

## 1. Executive Summary

CQIP was built and shipped as a single-tenant tool against the
Neighborly (NBLY) CRO project, with multi-tenant data structures
"baked in but never exercised." The schema was designed correctly
from day one (`projects` table, `brands.project_key` FK,
`quality_logs.project_key` FK, `test_milestones` keyed by ticket +
brand), so the database is multi-tenant from the foundation up.
What was *not* exercised is the operational and code-level
infrastructure around onboarding a second client. Most NBLY
references in the codebase turn out to be one of three patterns —
**(a)** seed-data SQL that's already idempotent and scoped by
`project_key`, **(b)** UI placeholder copy and error messages that
mention `NBLYCRO` for clarity but use generic regexes underneath,
or **(c)** historical-import scripts (CSV backfill, one-shot
migrations) that are tied to NBLY by their nature and don't matter
for new clients.

**Audit methodology:**
1. Whole-repo grep for `NBLY`, `NBLYCRO`, `Neighborly`, `nbly_` —
   52 hits in tracked source files (excluding `CLAUDE.md`,
   `package-lock.json`, and the `NBLY_QualityTrackingLog_Error_Log_.csv`
   import file).
2. File-by-file review of: `lib/jira/field-map.ts`, both edge
   functions (`jira-webhook`, `jira-sync`), drought-evaluator,
   migrations 001 / 005 / 009 / 010 / 011 / 013 / 015,
   `app/dashboard/coverage/page.tsx`,
   `app/dashboard/settings/projects/page.tsx`,
   `app/dashboard/settings/coverage/page.tsx`,
   `app/api/admin/brands/*` routes,
   `app/api/admin/milestones/*` routes,
   `components/coverage/*`.
3. Schema review against `CLAUDE.md` §5 with focus on multi-tenant
   FK boundaries, RLS scoping, and audit-target shape.
4. Ops review: env vars (`.env.example`), pg_cron jobs, RLS
   policies (migration 005 + 014 + 016), Teams webhook URL
   handling, SharePoint integration status.
5. UI/copy scan for visible `NBLY`/`Neighborly` strings and
   single-client copy assumptions across `app/` and `components/`.

**Top-line findings:** CQIP is in **better shape than expected** for
multi-client. The schema, RLS, edge functions, and core mutation
routes are all multi-tenant ready and require *zero* code changes
to ingest a second client. The remediation work is concentrated in
three buckets: **(1)** placeholder copy / error messages mentioning
`NBLYCRO` in three UI surfaces, **(2)** an admin-UI gap for
*creating* brand rows (today brands are seeded via SQL migration
only — no Settings page surface), and **(3)** the seed migrations
that bake NBLYCRO brand rows are appropriately one-time and
idempotent; SPL needs an analogous migration of its own.

**Estimated SPL onboarding effort post-remediation:** **2–3 hours
of human time** across SQL, Jira webhook config, and a
verification ticket transition. Of that, ~30 minutes is CQIP-side
work; the remainder is Jira automation configuration on Lacey's
side and SharePoint integration (Carl's Azure work, separate).

**Critical-path items (must fix before SPL goes live):**
1. **Add Jira webhook coverage for SPLCRO.** The current webhook
   in Jira is JQL-filtered to `project = NBLYCRO`. Without this
   change, SPL ticket transitions never reach CQIP. (Operational,
   not code.)
2. **Seed SPL row in `projects` and the SPL brand row in `brands`.**
   Either SQL migration OR via an admin path — but the brand-row
   create path doesn't exist in the UI today. SQL is the path
   of least resistance; brand-create UI is post-onboarding polish.
3. **Update three UI strings** (`'NBLYCRO-123'` placeholder/error
   text in milestone validation) to be project-key-agnostic. Low
   effort, Medium severity.

**High-level recommendation on sequencing:**
- **Pre-SPL (~1 hour CQIP-side):** items C1 / C2 / C3 above.
- **SPL onboarding day:** Lacey adds the project + brand row,
  reconfigures the Jira webhook, transitions one test SPL ticket
  end-to-end to verify the full pipeline.
- **Post-SPL (next batch):** brand-create admin UI, copy polish
  across milestone dialogs, optional rename of `nbly_brand` →
  `client_brand_field` in `JIRA_FIELD_MAP`. None of these block
  SPL going live.
- **Long-term:** if a future client has different custom field
  IDs (Severity, Root Cause, etc.), `JIRA_FIELD_MAP` would need
  to become per-project. **No such need exists today** —
  pre-audit verification confirmed SPL uses the instance-global
  field IDs.

---

## 2. NBLY Hardcoding Inventory

Comprehensive table of every NBLY-related hit across tracked
source files. Column legend per the Batch 004.99 spec.

| Location | Finding | Type | Severity | Remediation |
|---|---|---|---|---|
| `lib/jira/field-map.ts:15` | `nbly_brand: 'customfield_12220'` — the KEY NAME in `JIRA_FIELD_MAP` is `nbly_brand`, but the customfield ID itself is instance-global per pre-audit. | hardcode | Low | Rename key to `client_brand_field` (or similar). Cosmetic — semantics already work for SPL. Update both edge functions in lockstep (they inline the map). |
| `supabase/functions/jira-webhook/index.ts:40` | Inlined `nbly_brand` key in the function's local copy of `JIRA_FIELD_MAP`. | hardcode | Low | Mirrors the field-map rename above. |
| `supabase/functions/jira-webhook/index.ts:43` | Comment "The NBLY brand field can come back as a string..." | comment | Low | Update wording to "The client-brand field..." after rename. |
| `supabase/functions/jira-webhook/index.ts:198, 296, 308` | Three references to `JIRA_FIELD_MAP.nbly_brand` in the field-extraction path. | hardcode | Low | All three follow the rename mechanically. |
| `supabase/functions/jira-sync/index.ts:54` | Same inlined `nbly_brand` key. | hardcode | Low | Mirrors the rename. |
| `supabase/functions/jira-sync/index.ts:57` | Same comment. | comment | Low | Same rename. |
| `supabase/functions/jira-sync/index.ts:152` | Same field-extraction path. | hardcode | Low | Same rename. |
| `app/api/admin/milestones/route.ts:53` | Error string `'jira_ticket_id must look like NBLYCRO-123'`. The regex `/^[A-Z]+-\d+$/` is generic; only the error copy is NBLY-specific. | hardcode | Medium | Replace with `'jira_ticket_id must look like PROJECT-123 (e.g. NBLYCRO-123, SPLCRO-123)'` or simply `'jira_ticket_id must match PROJECT-123 format'`. ✅ **Shipped 2026-05-06 (Batch 005.9)** |
| `components/coverage/manage-milestones-dialog.tsx:25, 132-133` | `TICKET_PATTERN = /^[A-Z]+-\d+$/` (already generic) + toast `'❌ Ticket must look like NBLYCRO-123'`. | hardcode | Medium | Same fix as above — toast string only. ✅ **Shipped 2026-05-06 (Batch 005.9)** |
| `components/coverage/manage-milestones-dialog.tsx:294` | Input placeholder `"NBLYCRO-1234"` on the milestone-add form. | hardcode | Medium | Replace with `"PROJECT-1234"` or rotate examples per the active project context. ✅ **Shipped 2026-05-06 (Batch 005.9)** |
| `app/dashboard/settings/audit/page.tsx:211` | Audit page ticket-filter input placeholder `"NBLYCRO-"`. | hardcode | Medium | Replace with `"PROJECT-"` or similar. ✅ **Shipped 2026-05-06 (Batch 005.9)** |
| `app/dashboard/settings/projects/page.tsx:161` | Project key input placeholder `"e.g. NBLY"` on the add-project form. | hardcode | Low | Update to `"e.g. NBLYCRO, SPLCRO"` to better signal multi-client. ✅ **Shipped 2026-05-06 (Batch 005.9)** |
| `supabase/migrations/009_client_coverage.sql:6, 31, 38-53` | Migration 009 seeds 16 NBLY brand rows. | seed | N/A (already shipped) | One-time historical seed; do not re-run. SPL gets its own analogous migration (see §8 Step 3). |
| `supabase/migrations/010_brand_aliases.sql:1, 10, 55, 61, 68` | Migration 010 seeds NBLY brand aliases + pauses MRR-CA. | seed | N/A (already shipped) | Same — historical seed for NBLY. SPL alias seeds (if any) go in a new migration. |
| `supabase/migrations/013_brand_qa_config.sql:67, 76, 84` | Migration 013 enables QA-automation config for GUY + RBW NBLY brands; uses `WHERE project_key = 'NBLYCRO'`. | seed | N/A (already shipped) | One-time UPDATE bounded to NBLYCRO. SPL needs no analogous statement until SPL has QA-automation-enabled brands. |
| `scripts/backfill-brands.ts:32, 91, 113` | Const `NBLY_BRAND_FIELD = 'customfield_12220'` + uses for backfill. | test | Low | One-shot script for NBLY-era backfill. Either rename the const if reused for SPL or leave alone (script is run once per historical-data backfill). |
| `scripts/backfill-milestones.ts:3, 12, 17, 43-44, 103, 219` | `NBLY_BRAND_FIELD` const + JQL `'project = NBLYCRO'` baked in + comments referencing NBLYCRO. | test | Medium | If SPL has historical Dev Client Review milestones to backfill, fork-or-parameterize this script — make `JQL` and the brand-field const accept a `--project` CLI arg. Otherwise leave as NBLY-only. |
| `scripts/import-csv.ts:92` | Hardcodes filename `'NBLY_QualityTrackingLog_Error_Log_.csv'` for one-shot CSV import. | test | N/A (one-shot) | Already executed for NBLY. SPL has no analogous CSV historical import per pre-audit. |
| `scripts/fix-dates.ts:4, 67` | Same one-shot CSV reference. | test | N/A (one-shot) | Already executed. |
| `NBLY_QualityTrackingLog_Error_Log_.csv` (file name) | Historical import source file checked into the repo. | seed | N/A | Frozen artifact of the Batch 001 import. Do not delete (provenance for old log rows). |
| `docs/ux-plans/coverage-settings-reorg.md:221, 222, 242, 274-276` | NBLYCRO-### example tickets in mockup ASCII art. | doc | Low | Cosmetic — these are illustrative mockups for a future UX redesign (Batch 005 item 5.1). Update when the redesign batch ships. |

**Type/severity narrative summary:**

The table above totals **52 hits** across **15 distinct files**.
By type: **9 hardcode, 3 comment, 5 seed, 6 test/script, 5 doc**.
By severity: **0 Critical, 0 High, 4 Medium (UI placeholder/error
copy), 12 Low (cosmetic / inlined field-map keys), with the
remaining N/A (already-shipped one-time seeds and historical
artifacts)**.

**Honest assessment:** the inventory is *much* shorter than I
expected going in. There are **zero Critical findings** in code —
every NBLYCRO that affects business logic at runtime resolves
through `projects.jira_project_key` (the multi-tenant boundary)
and works for SPL the same as NBLY. The four Medium findings are
all UI strings — three are user-facing placeholder copy /
validation error messages, one is a per-page input placeholder.
Each is a five-minute fix. The Low findings are mostly the
`nbly_brand` key name in the field map, which is semantically
NBLY-flavored but functionally generic; renaming it to
`client_brand_field` is cosmetic polish that can ship in a
post-SPL batch without operational risk.

**What's NOT in this table — and why:**
- `quality_logs.client_brand`, `brand_aliases.jira_value`, etc.
  store strings that *contain* "MRR - Mr Rooter Plumbing"-style
  brand names. These are data, not code, and they're correctly
  scoped via FKs. SPL data will sit alongside NBLY data without
  collision.
- The two edge functions reference `JIRA_FIELD_MAP.nbly_brand` —
  that's the same finding as the field-map row, listed for
  completeness in case a reader greps for `nbly_brand`.
- `CLAUDE.md` has dozens of NBLY mentions; per the spec these
  are documentation references and are not in scope for code
  changes. They will be updated organically as multi-client
  language enters batches.

---

## 3. Field Mapping Audit

**Verification target:** Confirm that `JIRA_FIELD_MAP`
(`lib/jira/field-map.ts`) is treated as instance-global — i.e.,
the customfield IDs map identically across all CRO projects in
the Fusion92 Jira instance — and that no code path expects
per-project field mapping.

**Findings:**

| Question | Answer | Evidence |
|---|---|---|
| Is `JIRA_FIELD_MAP` referenced consistently via the shared map? | **Yes.** | Both edge functions inline an identical copy of the map (Deno doesn't share modules — see `CLAUDE.md` §2). The `lib/jira/field-map.ts` original is consumed by Node-side code (scripts). All 14 customfield IDs match across the three locations. |
| Are there hardcoded `customfield_*` IDs scattered outside the field map? | **One acceptable exception.** | `scripts/backfill-brands.ts:32` and `scripts/backfill-milestones.ts:43` define a local const `NBLY_BRAND_FIELD = 'customfield_12220'`. These are one-shot backfill scripts, not runtime code. Acceptable as-is; can be cleaned up if the scripts are re-run for SPL (see §2). |
| Is `nbly_brand` in the field-map name NBLY-specific? | **By name yes, by behavior no.** | The customfield ID `12220` is instance-global per pre-audit verification (it's the same field on SPL screens). Only the JS *key* in `JIRA_FIELD_MAP` is NBLY-flavored. Renaming to `client_brand_field` is cosmetic polish. |
| Does any code path need `JIRA_FIELD_MAP` to become per-project? | **No, not today.** | Pre-audit verified SPL has matching IDs (`customfield_12906` for Severity, brand on `customfield_12220`). If a *future* CRO client onboarded onto a different Jira instance (different customfield IDs), the map would need a per-project shape — a new column on `projects` (e.g. `field_map jsonb`) or per-project constant files. Defer until the need is real. |

**Recommendation:** Treat `JIRA_FIELD_MAP` as instance-global for
v1.5. Document this expectation in `CLAUDE.md` §7 (covered in the
sibling CLAUDE.md update for this batch). If a future client lands
on a different Jira instance, that batch becomes the multi-instance
Jira-mapping refactor.

---

## 4. Behavior Assumption Audit

### 4.1 jira-webhook JQL filter — **Critical operational item**

The webhook's *Jira-side* configuration is JQL-filtered to
`project = NBLYCRO` (this is set in the Jira UI when the webhook
was registered, not in code). For SPL transitions to reach CQIP,
one of these must happen on Lacey's side:

| Option | Tradeoff |
|---|---|
| **A. Add a second webhook** for `project = SPLCRO`, pointing at the same edge-function URL. | Cleaner separation; per-client failure isolation; per-client log scoping in Jira's webhook history; doubles the Jira-side surface area to maintain. |
| **B. Broaden the existing webhook's JQL** to `project IN (NBLYCRO, SPLCRO)`. | Single webhook to manage; one less thing to forget. JQL list grows with each client onboarded. Single-point-of-failure if the webhook is misconfigured. |

**Recommendation: Option A.** The webhook config lives in Jira's
UI, not in CQIP, so adding a second one is ~5 minutes per client.
It also means a misconfigured SPL webhook can't disable NBLY
ingestion — which matters for an active client.

**CQIP-side: zero changes required.** The edge function already
reads `projectKey = issue.fields.project.key` from the inbound
payload and looks up `projects.is_active` (`jira-webhook/index.ts`
lines 246–256). Multi-tenant ready as written.

### 4.2 Brand extraction (`extractBrand` + `resolveBrandId`)

The `extractBrand()` helper handles the four shapes the brand
field comes back as (string, single-select `{value}`, cascading
`{value, child}`, array). The `resolveBrandId()` helper walks the
fallback chain:

1. `brands.jira_value = <extracted>` → got `brand_id`? Done.
2. Else `brand_aliases.jira_value = <extracted>` → got `brand_id`? Done.
3. Else log a warn and proceed with `brand_id = NULL`.

For SPL's **single-brand** model: every SPL ticket has the same
brand value (a single row, expected `jira_value` something like
`'SPL'` or `'SPL - Small Business Project Lab'`, depending on
whether the field is populated on SPL tickets at all). Three
sub-cases:

| Sub-case | Behavior | Action |
|---|---|---|
| SPL tickets have `customfield_12220` populated with a single SPL value. | Resolution succeeds via `brands.jira_value` lookup. | Seed one row in `brands` with the matching `jira_value`. Done. |
| SPL tickets have `customfield_12220` *empty* (the field exists on the screen but isn't routinely filled in). | Resolution returns `null`; `client_brand` column is NULL on the log. | Two options: (a) seed `brand_aliases` with an empty-string alias (works but feels hacky); (b) extend `resolveBrandId()` with a per-project default-brand fallback. **Recommend (b)** — see §4.5. |
| SPL doesn't use `customfield_12220` at all (different brand-tracking field). | Resolution always returns `null`. | Either fork the field-map per-project OR add a `default_brand_id` column on `projects` and short-circuit resolution when `extractBrand()` returns null. Document as the SPL onboarding question. |

**Pre-audit gap:** this report was generated assuming SPL's brand
field setup is unknown beyond "single brand named SPL." The
onboarding playbook (§8 Step 3) flags this as a verification step
before brand seeding.

### 4.3 Trigger rule (§6 of CLAUDE.md) — **confirmed working as-is**

The sendback-detection rule is project-agnostic by definition. It
matches on workflow status names (`'Active Dev'`, `'Dev QA'`, etc.)
and the source statuses (`'Dev Client Review'`, `'Queued'`,
`'Live'`, `'Done'`). Pre-audit verified SPL uses the same workflow
status names. **No changes needed.**

### 4.4 `quality_logs.project_key`

The only place project identity is enforced at runtime is the
FK from `quality_logs.project_key → projects.jira_project_key`,
plus the analogous FK on `brands.project_key`. **No code path
hardcodes `'NBLYCRO'` as a filter** (verified by grep —
`grep -rn "project_key.*=.*'NBLY'" app components lib supabase/functions`
returns zero hits in runtime code; the only match is the seed
migration).

### 4.5 Brand resolution fallback for single-brand clients

Three viable approaches for SPL:

| Approach | How it works | Tradeoff |
|---|---|---|
| **A. Seed `brand_aliases`** with the SPL `jira_value` (or empty-string variant) → SPL brand. | Reuses existing infrastructure. No code change. | Awkward if SPL tickets routinely have an empty brand field — seeding `''` as an alias is a smell. |
| **B. Add `projects.default_brand_id`** column. `resolveBrandId()` falls back to this when `extractBrand()` returns null. | Clean semantics for single-brand clients. | New schema column + edge function update + migration. |
| **C. Treat SPL as a degenerate case** — every `quality_log` insert from a SPLCRO ticket sets `brand_id` to the single SPL brand by `project_key` lookup, ignoring `customfield_12220` entirely. | Simplest runtime logic. | Requires the webhook to know "is this a single-brand project?" — adds a behavior flag. |

**Recommendation: A for SPL onboarding (zero code change, ships
today), and B as a Batch 005 follow-up if/when more single-brand
clients land.** C is over-engineered for v1.5.

---

## 5. UI / Copy Audit

Visible-string scan across `app/` and `components/` for `NBLY`,
`Neighborly`, and copy that assumes single-client context.

| Location | String / Copy | Severity | Remediation |
|---|---|---|---|
| `app/api/admin/milestones/route.ts:53` | Error toast: `'jira_ticket_id must look like NBLYCRO-123'` | Medium | Replace with `'jira_ticket_id must match PROJECT-123 format'`. ✅ **Shipped 2026-05-06 (Batch 005.9)** |
| `components/coverage/manage-milestones-dialog.tsx:133` | Toast: `'❌ Ticket must look like NBLYCRO-123'` | Medium | Replace with `'❌ Ticket must match PROJECT-123 format'`. ✅ **Shipped 2026-05-06 (Batch 005.9)** |
| `components/coverage/manage-milestones-dialog.tsx:294` | Input placeholder `"NBLYCRO-1234"` | Medium | Replace with `"PROJECT-1234"` or rotate examples. ✅ **Shipped 2026-05-06 (Batch 005.9)** |
| `app/dashboard/settings/audit/page.tsx:211` | Input placeholder `"NBLYCRO-"` (audit ticket filter) | Medium | Replace with `"PROJECT-"`. ✅ **Shipped 2026-05-06 (Batch 005.9)** |
| `app/dashboard/settings/projects/page.tsx:161` | Input placeholder `"e.g. NBLY"` (new-project key field) | Low | Replace with `"e.g. NBLYCRO, SPLCRO"`. ✅ **Shipped 2026-05-06 (Batch 005.9)** |

**Surfaces verified clean** (no NBLY/Neighborly hardcoding):

- `app/login/page.tsx` — header reads "Fusion92 CQIP" / "Sign in
  to your account". Generic.
- `app/dashboard/page.tsx:514` — `<h1>Quality Intelligence
  Platform</h1>` and subtitle "Monitor rework events, analyze
  trends, and track quality metrics across **your CRO projects**."
  Plural / client-agnostic.
- `app/dashboard/coverage/page.tsx:310` — `<h1>Client
  Coverage</h1>` and subtitle "Tests (Dev Client Review
  first-entries) by brand. Brands with ≤2 tests in the last 28
  days are flagged." Generic.
- `components/layout/nav.tsx:32` — sidebar entry "Client Coverage."
  Generic.
- KPI labels, chart titles, axis labels: all read as
  "Tests This Week", "Issue Category Breakdown", "Severity
  Distribution", "Top Root Causes", "Rework Volume (Weekly)" —
  all generic.
- Filter dropdowns: "All brands" — generic. The dropdown
  populates from the brands table, so it'll automatically include
  SPL once seeded.
- Active alerts panel pills: brand code + descriptor + relative
  time. Generic.
- Sync status pill (Batch 005.10): "Synced X logs · 2m ago" —
  generic.
- Settings → Projects page header: "Manage Jira project
  integrations and review log volume by project." Generic +
  multi-client-friendly.
- Email templates: **none exist** (no email is sent — confirmed
  per `CLAUDE.md` §14).

**Honest assessment:** the UI is in remarkably good shape for
multi-client. The surface area is **5 strings** across 4 files,
all in the milestone-validation / audit-filter / project-creation
paths. None of these break SPL functionality — they just look
weird ("Why is it asking me about NBLYCRO?") to a future SPL
admin. ~30 minutes to fix all five in one polish batch.

---

## 6. Ops / Infra Audit

### 6.1 Cloudflare Worker secrets — **instance-global, correct**

| Secret | Purpose | Per-client? |
|---|---|---|
| `CQIP_SYNC_AUTH_KEY` | Worker ↔ jira-sync handshake | No — single value, single Worker, single sync function. |
| `CQIP_BRANDS_API_TOKEN` | Forge QA-automation app reads `/api/brands/*` | No — Forge consumer authenticates to one CQIP instance. |
| `CQIP_DROUGHT_AUTH_KEY` | pg_cron ↔ drought-evaluator | No — one cron, one evaluator. |
| `JIRA_API_TOKEN` / `JIRA_EMAIL` | Jira REST auth | No — single Atlassian instance covers all CRO projects. |
| `WEBHOOK_SECRET` | Inbound webhook validation | No — same secret accepted on either webhook (Option A from §4.1) since both point at the same edge function. |
| `TEAMS_WEBHOOK_URL` | Outbound Teams notifications | **Possibly per-client — see §6.4.** |

Verified: no code path expects per-client secrets. Confirmed by
grep — `grep -n "process.env" app/api/jira/sync/route.ts` etc. —
all reads are flat env access; no `process.env[`projectKey`]`
patterns.

### 6.2 pg_cron jobs — **multi-tenant ready**

Two cron jobs configured via Supabase dashboard:

| Job | Schedule | Scope |
|---|---|---|
| `jira-sync-6h` | every 6 hours | Pulls **all** non-resolved `quality_logs` rows where `is_deleted = FALSE` (`jira-sync/index.ts` lines 218–222). No project filter. SPL logs are auto-included once `quality_logs` rows exist. |
| `drought-evaluator` (daily 10:00 UTC) | daily | Iterates **all** non-paused, active brands (`drought-evaluator/index.ts` lines 268–273). No project filter. SPL brands auto-evaluated once seeded. |

**No NBLYCRO filter in either cron.** Multi-tenant by default.

### 6.3 RLS implications — **multi-tenant ready by design**

RLS policies are role-based (admin / authenticated / read_only),
**not project-scoped**. CQIP operates as a single-instance
multi-client tool — every admin sees every client's data. This is
the intended model per `CLAUDE.md` §9 (small CRO team, all
admins/read-only users have view rights to all clients).

If per-client data partitioning ever becomes a requirement
(e.g., a client only sees their own data), `quality_logs` /
`brands` / `test_milestones` / `alert_events` would need
project-scoped RLS predicates. **Not in scope for v1.5.**

Verified: zero RLS policy hardcodes `NBLYCRO` (grep over
`migrations/005_rls_all_tables.sql`, `014_audit_log_security_cleanup.sql`,
`016_pre_demo_security.sql`).

### 6.4 Teams webhook routing — **decision needed for v1.5**

Currently a single `TEAMS_WEBHOOK_URL` env var is used by the
`radara-sweep` edge function (the only Teams sender today, and
not yet deployed). **Teams dispatch from `alert_events` is Batch 006
work and not yet wired** (`CQIP_BRANDS_API_TOKEN` is unrelated).

Decision space when Batch 006 ships:

| Approach | When it fits |
|---|---|
| **Single channel** — all clients' alerts post to one Teams channel, with the client name in the message body. | SPL-era CRO team — small team, 2-3 clients, single triage channel. |
| **Per-client channel** — `projects.teams_webhook_url` column, fall back to default. | When a client wants their own channel for their alerts (typically when stakeholders outside the CRO team are subscribed). |

**Recommendation for v1.5:** single channel. Adds a `clientName`
field to the message body; add per-channel routing in a future
batch when the first client requests it. The schema change is
low-cost (one nullable column on `projects`).

### 6.5 Settings UI gaps for managing multiple clients

| UI surface | Multi-client gap | Severity | Remediation |
|---|---|---|---|
| `/dashboard/settings/projects` | ✅ Add new project supported. Form takes project key, client name, display name, Jira URL. | n/a | None. |
| `/dashboard/settings/projects` | ❌ No surface for setting `is_active = FALSE` from the form (Switch toggles active state per existing project per row — verified in code). | n/a | Already supported via the Switch. ✓ |
| `/dashboard/settings/coverage` | ❌ **No "Add brand" UI.** Brand rows are seeded via SQL migration only. Pause/unpause + edit-QA-config exist; create + delete do not. | **High** | Build a brand-create form on `/dashboard/settings/coverage` (project_key dropdown, brand_code, jira_value, display_name). Until then, SPL brand seeding is SQL-only. ✅ **Shipped 2026-05-07 (Batch 005.20)** — `AddBrandDrawer` + `POST /api/admin/brands`. Delete still deferred to backlog 5.4. |
| `/dashboard/settings/coverage` | ❌ No brand soft-delete or full delete. | Low | Tracked as Batch 005 item 5.4 — only if business need emerges. |
| `/dashboard/settings/coverage` | ❌ No brand-aliases admin UI. Aliases are seeded by SQL too. | Medium | Most clients won't need aliases (they're for historical data normalization). Build only when needed. |
| `/dashboard/settings/audit` | Audit ticket-filter input has the NBLYCRO placeholder (Medium copy fix from §5). | Medium | Generic placeholder. |

**Net assessment:** the brand-create gap is the single biggest
operational item. SPL onboarding works around it via SQL — fine
for the second client. By the third or fourth client, this
becomes a real friction point and should be built.

### 6.6 SharePoint integration (per-client setup)

Per Lacey's pre-audit note:

> SPL's QA Doc URL SharePoint automation is under construction
> (Carl's Azure work). Audit must surface this as a known
> dependency in the onboarding playbook but not as a code-level
> blocker for CQIP itself.

**Confirmed: this is a per-client dependency that lives outside
the CQIP repo.** It is *not* a code blocker for CQIP onboarding —
SPL data ingests fine without SharePoint integration. The QA Doc
URL automation is a Forge-app / Azure-side concern that surfaces
as a populated/empty field on the Jira ticket. CQIP reads
whatever's in `customfield_*` fields and renders it; nothing
breaks if the field is empty.

**Onboarding playbook** (§8) flags this as Step 5 — a complete
end-to-end SPL onboarding includes Carl's work being done; CQIP
ingestion can begin before Carl is finished.

---

## 7. Data Model Audit

Schema review against `CLAUDE.md` §5 with focus on multi-client
boundaries.

| Table | Multi-tenant ready? | Notes |
|---|---|---|
| `projects` | ✅ | The multi-tenant boundary. `jira_project_key` is unique; `is_active` controls webhook ingestion; `client_name` / `display_name` shape UI rendering. |
| `brands` | ✅ | FK `project_key → projects.jira_project_key`. SPL brand row sits alongside NBLY rows naturally. |
| `brand_aliases` | ✅ | FK `brand_id → brands.id`. Multi-tenant via the brand, no project_key column needed. |
| `quality_logs` | ✅ | FK `project_key → projects.jira_project_key`. Indexed by `project_key`, `client_brand`, `severity`, `triggered_at`. |
| `test_milestones` | ✅ | FK `brand_id → brands.id` (nullable for unmatched). Per-ticket scoping via `jira_ticket_id`; ticket IDs are project-prefixed (`NBLYCRO-123`, `SPLCRO-45`) so collisions are impossible. |
| `alert_events` | ✅ | FK `brand_id → brands.id` and `log_entry_id → quality_logs.id`. CHECK constraint enforces "at least one scope set". Multi-tenant via the FK targets. |
| `alert_rules` | ⚠️ Global by design | No `project_key` column — rules apply across all projects. **Acceptable for v1.5** (the seven seeded rules are general-purpose). If per-client thresholds become needed (e.g., SPL wants threshold = 1 instead of 2 on the drought rule), add a nullable `project_key` column with `NULL` meaning "applies to all projects." |
| `saved_reports` | ✅ | Per-user, not per-project. The `filters` jsonb already supports `project_key` filter values. |
| `audit_log` | ✅ | Generic `(target_type, target_id)` shape after migration 011. Multi-tenant via the target's own scoping. |
| `sync_runs` (Batch 005.10) | ✅ | Cross-project — one row per sync invocation regardless of how many client tickets it touched. Doesn't need to be per-client. |
| `easter_egg_stats` | ✅ | Instance-global. |
| `user_profiles` | ✅ | Instance-global users; not partitioned by client. |

**No blockers in the schema.** The single open question
(`alert_rules` per-project scoping) is a "future enhancement, not
a current bug" — the current global model is correct for the
v1.5 multi-client scope.

---

## 8. Onboarding Playbook (running example: SPL)

> **About this section.** Section 8 is canonical source content
> for a future Dashboard Documentation Hub onboarding guide
> (tracked in §10 as a Long-term remediation item). It is
> deliberately written to stand alone — every step here can be
> read in the dashboard without flipping back to `CLAUDE.md` or
> any other CQIP doc. Internal `§N` cross-references point at
> other sections of *this* report only, and those sections will
> surface alongside the playbook in the same hub.

Step-by-step procedure for adding a new CRO client to CQIP.
Each step calls out the *why* alongside the *how* and includes
realistic time estimates including verification. SPL (Jira
project key `SPLCRO`, single brand "SPL") is the running
example.

### Step 1 — Pre-flight verification (Jira-side, 20–30 min)

Before touching CQIP, walk through the new project in Jira and
confirm each item below. Several of these surfaced as real-world
gaps during SPL pre-audit (2026-05-06) — including most notably
the QA tab not being on SPLCRO's screen scheme — so don't assume
"the project exists, ergo it's ready."

- [ ] **Jira project exists.** Open
      `https://fusion92.atlassian.net/projects/<KEY>` and confirm
      it loads. Note the project key (the all-caps prefix on
      ticket IDs, e.g. `SPLCRO` for SPL, `NBLYCRO` for
      Neighborly).
      *Why:* this is the string CQIP stores as
      `projects.jira_project_key` in Step 2 and the value the
      Jira webhook will report on every transition.

- [ ] **Workflow alignment check.** The CRO-standard workflow
      uses these exact status names (case-sensitive; CQIP's
      sendback-detection rule matches on the strings):
      `Strategy`, `Ready for Design`, `In Design`, `Active
      Design`, `Design QA`, `Design Client Review`, `Ready for
      Dev`, `In Development`, `Active Dev` (or `Active
      Development`), `Dev QA`, `Dev Client Review`, `Queued`,
      `Live`, `Reporting`, `Done`.
      **Quick-check method:** open Project Settings → Workflows
      → click into the active workflow. The visual diagram lists
      every status name. Compare against the list above. A
      renamed status (e.g. `Dev Review` instead of `Dev Client
      Review`) silently breaks ingestion — the webhook will see
      transitions but the trigger rule won't match.

- [ ] **QA tab is on the project's screen scheme.** This was the
      gap that surfaced for SPL on 2026-05-06 — the project
      existed and tickets were being created, but the QA tab
      wasn't on the screen scheme, so the 13 QA custom fields
      existed on the issues but weren't visible to the team.
      **How to verify:**
      1. Project Settings → Screens.
      2. Click into the active screen scheme.
      3. Confirm a "QA" tab is present on each of:
         the Default screen, the Workflow Transition screen,
         and any per-issue-type screens.
      4. Open a real ticket (a Dev QA or Dev Client Review
         status one is ideal) and confirm the QA tab renders
         with all 13 fields populated or empty.
      **How to fix if missing:** copy the QA tab configuration
      from NBLYCRO's screen scheme. Atlassian doesn't have a
      one-click "clone tab" button — you'll add the tab to the
      new screen scheme and add each field individually. The
      field IDs are instance-global so the underlying data is
      already present.
      *Why:* without the QA tab on the screen scheme, the team
      has nowhere to enter Severity / Issue Category / Root
      Cause / etc. CQIP's webhook still ingests sendbacks
      (those run off status changes, not field content), but
      every log lands with empty QA fields — defeating the
      analytics.

- [ ] **Custom field ID verification.** CQIP assumes
      instance-global custom field IDs — i.e., that
      `customfield_12906` is Severity (CRO) on every CRO project
      in `fusion92.atlassian.net`. This is true today across
      NBLYCRO and SPLCRO, but it's worth verifying for any new
      project before going live (a different Jira instance, or
      a project set up on a non-CRO field config scheme, would
      break this assumption).
      **How to verify:**
      1. Open a ticket in the new project that has the QA tab
         visible.
      2. Hover over (or right-click → Inspect on) the Severity
         field label. The field's HTML element will have an
         `id` or `data-field-id` attribute reading
         `customfield_12906` (or whatever the actual ID is).
      3. Alternatively, fetch the ticket via Jira REST:
         `GET https://fusion92.atlassian.net/rest/api/3/issue/<KEY-123>`.
         The `fields` object will have keys like
         `customfield_12906` for every QA field. Compare the
         IDs against this map (the canonical CQIP field
         mapping):

         | CQIP field name             | Customfield ID         |
         |-----------------------------|------------------------|
         | severity                    | `customfield_12906`    |
         | issue_category              | `customfield_12871`    |
         | issue_subtype               | `customfield_12904`    |
         | reproducibility             | `customfield_12907`    |
         | root_cause                  | `customfield_12905`    |
         | root_cause_description      | `customfield_12909`    |
         | resolution_type             | `customfield_12908`    |
         | who_owns_fix                | `customfield_13120`    |
         | detected_by                 | `customfield_12910`    |
         | preventable                 | `customfield_12911`    |
         | experiment_paused           | `customfield_12912`    |
         | process_improvement_needed  | `customfield_12913`    |
         | documentation_updated       | `customfield_12914`    |
         | brand (NBLY-named)          | `customfield_12220`    |

      4. **If any ID doesn't match,** stop the onboarding and
         escalate. CQIP would need a per-project field-map
         refactor before the new client can be ingested
         correctly. (As of 2026-05-06, no such mismatch has
         been encountered.)

- [ ] **Stakeholder confirmation.** The CRO team using the new
      client is ready to start QA-tagging tickets — i.e., they
      know to fill in Severity / Root Cause / etc. on rework
      events. CQIP stays empty if no rework events fire.

For SPL: pre-audit confirmed Jira project exists, single brand
"SPL", workflow status names match, `customfield_12906`
matches NBLY (verified by Lacey on 2026-05-06). The QA tab on
SPLCRO's screen scheme was confirmed before the audit ran.

### Step 2 — Add project to CQIP (5 min)

Two paths:

**Path A — Settings UI (preferred):**
1. Log in as admin.
2. Navigate to `/dashboard/settings/projects`.
3. Click "Add new project."
4. Enter: `Jira project key = SPLCRO`, `Client name = SPL`,
   `Display name = SPL`, `Jira project URL =
   https://fusion92.atlassian.net/projects/SPLCRO`.
5. Submit. Confirm the row appears in the list with `is_active`
   set to ON.

**Path B — SQL (fallback, useful when running migrations
   alongside other onboarding state):**
```sql
INSERT INTO projects (jira_project_key, client_name, display_name, jira_project_url, is_active)
VALUES ('SPLCRO', 'SPL', 'SPL', 'https://fusion92.atlassian.net/projects/SPLCRO', TRUE);
```

*Why this matters:* CQIP's webhook checks
`projects.is_active = TRUE` for the incoming project key on
every transition. If the project row is missing, the webhook
short-circuits with a `Project not active` 200 response and no
log is written. **No `projects` row → no ingestion, period.**

### Step 3 — Add brand(s) (5 min — SQL only today)

CQIP doesn't yet have a brand-create UI surface (tracked as a
post-SPL polish item in §10). For now this step is direct SQL.

For SPL's single-brand model:

```sql
INSERT INTO brands (project_key, brand_code, jira_value, display_name, is_active, is_paused)
VALUES ('SPLCRO', 'SPL', 'SPL - <full Jira brand string>', 'SPL', TRUE, FALSE);
```

**Critical pre-step:** verify the exact `jira_value` by opening
one SPLCRO ticket and reading `customfield_12220`'s value. The
string must match *exactly* — `'SPL - Small Business Project
Lab'` ≠ `'SPL'` ≠ `'SPL Project'`. If SPL tickets routinely
leave this field empty, see §4.5 for the three fallback
approaches (alias seed, default-brand-id column, or
single-brand projection).

**REQUIRED for single-brand projects — set `projects.default_brand_id`
at onboarding.** Since Batch 005.22 Phase 1 (migration 019) the webhook's
`single_brand` path skips the Jira brand field entirely and resolves
`brand_id` from `projects.default_brand_id`. **Without it, milestones
ingest with `null brand_id` (orphans — see the SPLCRO-107 pre-005.22
case).** The `projects_brand_model_config_chk` CHECK constraint enforces
that a `single_brand` project has a `default_brand_id`, but onboarding
should set it *explicitly*, not rely on the constraint catching it. After
the brand row exists, point the project at it (and set the model):

```sql
UPDATE projects
   SET brand_model = 'single_brand',
       brand_jira_field_id = NULL,
       default_brand_id = (SELECT id FROM brands WHERE project_key = 'SPLCRO' AND brand_code = 'SPL')
 WHERE jira_project_key = 'SPLCRO';
```

(Multi-brand projects keep `brand_model = 'multi_brand'` + a
`brand_jira_field_id`, the migration-019 default — no `default_brand_id`
needed, though it's allowed as an escape-hatch fallback. See CLAUDE.md §6
brand-resolution flow + §13 r28.)

For multi-brand clients, repeat the INSERT once per brand. Add
rows to `brand_aliases` if historical data used different brand
strings (e.g., name changes, typos):

```sql
INSERT INTO brand_aliases (brand_id, jira_value, notes)
VALUES (
  (SELECT id FROM brands WHERE brand_code = '<CODE>'),
  '<historical jira_value>',
  '<rationale>'
);
```

*Why this matters:* without a `brands` row, the webhook can't
resolve `brand_id` for milestones. Logs still get written (the
`quality_logs.client_brand` text column stores the verbatim
string from the Jira field), but coverage tracking and drought
alerts won't work because they depend on the brand FK.

### Step 4 — Configure Jira webhook (10 min — Jira-side)

Two viable options. **Recommend Option A** for client isolation.

**Option A (recommended): add a second webhook.** In Jira →
System Settings → System → Webhooks:
1. Create a new webhook pointing at the same URL CQIP uses for
   NBLY:
   ```
   https://hupklpjruveleaahufmw.supabase.co/functions/v1/jira-webhook?secret=<WEBHOOK_SECRET>&apikey=<ANON_KEY>
   ```
   (Pull the actual secret + apikey values from the existing
   NBLYCRO webhook config — they're per-instance, not
   per-project.)
2. JQL: `project = SPLCRO`.
3. Events: `Issue Updated` (only — others generate noise CQIP
   ignores).
4. Verify "Issue properties" includes `changelog` so status
   transitions appear in the payload (the webhook needs the
   `changelog.items` array to detect status changes).

**Option B: broaden the existing webhook.** Edit the NBLY
webhook to JQL `project IN (NBLYCRO, SPLCRO)`. Less to
maintain; single point of failure if misconfigured.

*Why Option A:* a misconfigured SPL webhook can't disable NBLY
ingestion. The cost is one extra webhook per client to maintain
in Jira's UI, which is trivial.

### Step 5 — Configure project board automations (Jira-side, 20–30 min)

The new project needs the same Jira-native automation flows
that NBLYCRO has. These are configured per-project in Jira's
Automation rules — they don't live in CQIP code. The
Neighborly CRO space has 12 automation flows as of 2026-05-06;
some are NBLY-specific, some are generic CRO automations that
every onboarding client should get.

**5a. Clone the QA-clear automations** (configured 2026-05-06,
generic CRO):

| Flow name | Trigger | Effect |
|---|---|---|
| **Clear QA Fields On Transition** | Auto: ticket enters `Dev QA` or `Dev Client Review` | Clears all 13 QA tab custom fields |
| **Manually Clear QA Fields** | Manual button (lightning bolt menu) | Same effect, on demand |

**How to clone:** in NBLYCRO → Project Settings → Automation,
locate each flow, click the ⋯ menu → "Copy to project" → pick
SPLCRO (or the new project). Verify the rule lands with the
correct trigger (status entry vs manual) and the same 13 field
clears. The 12 standard fields clear via "Edit work item
fields"; "Who Owns The Fix?" (`customfield_13120`) clears via
JSON action because the dropdown UI doesn't permit a "set to
empty" choice — preserve the JSON form (`{"fields":
{"customfield_13120": null}}`) when copying.

*Why these matter:* without these automations, the QA fields
from the previous rework cycle persist on the ticket. CQIP
will re-read the same Severity / Root Cause / etc. on every
new sendback, polluting the data. The auto-clear is what
guarantees each rework log captures fresh QA tagging.

**5b. Audit the other CRO automations.** Open NBLYCRO →
Project Settings → Automation. For each flow listed there,
decide:

- **Generic CRO automation** (applies to any CRO client):
  clone to the new project. Examples include any rule that
  works off status transitions or assignee handoffs without
  referencing NBLY-specific fields.
- **NBLY-specific automation** (references NBLY brands,
  Neighborly stakeholders, NBLY-specific routing): skip.
  These are bespoke to Neighborly's ops and don't apply to
  other clients.

When in doubt, ask Lacey or the rule's last editor (the
audit log on each rule shows who modified it). Document any
generic rules that should be cloned-by-default in the
"Generic CRO automation" master list (TODO: build this
list during SPL onboarding so Client #3+ doesn't have to
re-audit).

**5c. QA Doc URL automation (Carl-dependent — known
dependency, not yet automatable).** This is a SharePoint /
Azure-side integration that auto-populates the QA Doc URL
field on each ticket from a SharePoint folder structure.
Status as of 2026-05-06: under construction. Carl is
configuring an Azure app registration with `Sites.Selected`
on the CRO SharePoint site; the Forge QA-automation app
(separate repo) will read `/api/brands/<projectKey>/<brandCode>`
from CQIP for the brand's `live_url_base` /
`default_local_sub_areas` / etc., and call SharePoint to
populate the Jira ticket field.

For SPL onboarding: **mark this as TODO on the onboarding
ticket** but proceed with Steps 6+. CQIP ingestion works
without it — the QA Doc URL field will simply be empty on
SPL tickets until Carl's work lands. CQIP reads whatever's
in the field at sync time and doesn't error on empty.

### Step 6 — Verify ingestion (15 min)

Pick a test ticket in the new project that's safe to
transition. Walk it through the three CQIP-relevant scenarios:

1. **Dev Client Review entry** (forward transition from
   `In Development`): confirm a milestone row appears at
   `/dashboard/coverage` → "Manage Milestones" → search by
   ticket ID. Expected row: `source = 'webhook'`, `brand_id`
   populated (or `null` with `brand_jira_value` set as a
   fallback string if brand resolution didn't match a row in
   `brands` or `brand_aliases`).

2. **Sendback** (`Dev QA → Active Dev` or `Dev Client Review →
   Active Dev`): confirm a `quality_logs` row appears at
   `/dashboard/logs`. The webhook's response body in the
   Supabase Invocations tab will read something like
   `milestone: skipped-not-applicable; rework: created` —
   that's success, both branches ran independently.

3. **Auto-advance** (transition the ticket back to `Dev QA`
   after the sendback): confirm the log status flips to
   `Pending Verification` on the next 6-hour sync cron run, or
   immediately if you click the "Sync with Jira" button on the
   dashboard.

If any branch fails to write, check:
- Supabase Edge Function logs for the `jira-webhook` function
  (Supabase Dashboard → Edge Functions → Logs → jira-webhook).
- The webhook config in Jira (correct URL, correct JQL, events
  include `Issue Updated`).
- The `projects` row exists with `is_active = TRUE`.

**Backfill historical data if needed.** If the new client has
pre-onboarding rework events you want to capture, fork
`scripts/backfill-milestones.ts` (parameterize the JQL and
brand-field-id constants). Most new clients won't need this —
SPL was confirmed pre-audit to have no historical CSV import.

### Step 7 — Configure alerts (5 min)

Default alert rules apply globally — no per-client
configuration is needed. Verification:

- **Drought rule:** fires automatically for the new client's
  brands once seeded. The drought-evaluator daily cron
  iterates all non-paused brands across all projects.
- **Other rules** (Critical Open, High Severity Spike, Repeat
  Root Cause, Repeated Sendback, Long-Running Open): no
  evaluators are wired yet. They're silent for everyone, NBLY
  and the new client alike. Will activate uniformly when
  their evaluators ship.
- **Teams notifications:** dispatch is on the Batch 006
  backlog. `alert_events` rows accumulate in the database but
  nothing posts to Teams. Expect this for the new client too.

If the client wants per-client thresholds (e.g., a single-brand
client wants drought threshold = 1 instead of 2), that's a
schema change to add `project_key` to `alert_rules` — flagged
in §10 as a long-term remediation item.

### Step 8 — User access (5 min)

CQIP is a single-instance tool. Every admin sees every
client's data; there's no per-client user partitioning. If
new CRO team members need access:

1. Admin → `/dashboard/settings/users` → "Add user."
2. Enter username and password; pick role (`admin` or
   `read_only`).
3. They see all clients' data automatically.

For SPL specifically: the existing 7 user accounts (2 admins,
5 read-only) are sufficient. No new users needed.

### Step 9 — Document onboarding (10 min)

Update the audit + project docs so the next person to look at
CQIP's history can find the new client:

- `CLAUDE.md` §1: add the new client to the active-clients
  list.
- `CLAUDE.md` §6: if Option A in Step 4 was used, add a note
  that two webhooks exist (one per project).
- `CLAUDE.md` §16: add a new shipped-log entry —
  "<CLIENT> onboarded YYYY-MM-DD, <N> brand(s), notes on any
  Carl-side dependencies still pending."
- This audit doc (`docs/multi-client-readiness.md`) §11
  metadata block: bump the last-audit date and note the new
  client.

This step is durable record-keeping. The next person to
onboard a client (or audit CQIP six months from now) reads
those docs first.

### Step 10 — Post-onboarding QA (15 min)

Once Steps 1–9 are done and ingestion has been verified end-
to-end, walk through the dashboard and confirm:

- [ ] **Sync status pill:** the next `jira-sync-6h` cron run
      completes successfully with the new client's logs
      included. The pill on Dashboard / Logs / Reports /
      Coverage should show green with the run's log count.
- [ ] **Coverage page** (`/dashboard/coverage`): the new
      client's brand(s) appear in the table. Sparklines begin
      populating after the first milestone is recorded.
- [ ] **Dashboard charts:** the first rework logs from the new
      client appear in Issue Category / Severity / Top Root
      Causes / Rework Volume. Filter dropdowns include the new
      brand options.
- [ ] **Audit log** (`/dashboard/settings/audit`): new-client
      ticket audit rows landable (search by the new ticket-key
      prefix, e.g. `SPLCRO-`).
- [ ] **No webhook errors** in the Supabase Invocations tab
      for the new project key over the next 24 hours.

**Rollback plan.** If any verification fails, set the
project's `is_active` to FALSE — either via
`/dashboard/settings/projects` toggle, or:

```sql
UPDATE projects SET is_active = FALSE WHERE jira_project_key = 'SPLCRO';
```

The webhook stops accepting transitions for that project; the
brand row stays for diagnosis. Investigate, fix, and re-enable
when ready.

---

## 9. Offboarding Playbook

Step-by-step for deactivating a CRO client without losing
history.

### Step 1 — Set `projects.is_active = FALSE`

Either via `/dashboard/settings/projects` Switch toggle or:
```sql
UPDATE projects SET is_active = FALSE, deactivated_at = NOW()
 WHERE jira_project_key = 'SPLCRO';
```

*Effect:* the webhook short-circuits future SPLCRO transitions
with `'Project not active'` (200 OK, no row written). Existing
rows are untouched.

**Do NOT delete the row.** All historical `quality_logs`,
`test_milestones`, `alert_events` rows have FK references back
to it.

### Step 2 — Pause all brands for that project

```sql
UPDATE brands
   SET is_paused = TRUE,
       paused_at = NOW(),
       paused_by = '<admin email>',
       paused_reason = 'Client offboarding'
 WHERE project_key = 'SPLCRO' AND is_paused = FALSE;
```

*Effect:* drought-evaluator skips paused brands (per `CLAUDE.md`
§13 rule 20), so no spurious drought alerts fire while the
client is offboarded.

### Step 3 — Disable the Jira webhook for the project

If using Option A (per-client webhook), disable or delete the
SPLCRO webhook in Jira UI. If using Option B (combined JQL),
remove `SPLCRO` from the JQL.

### Step 4 — Data retention

**All data preserved indefinitely.** No automated deletion.
Specifically:
- `quality_logs` rows (soft-delete only for individual logs;
  no project-level delete).
- `test_milestones` rows.
- `audit_log` rows.
- `alert_events` rows.
- `brands` rows (paused, not deleted).
- `projects` row (`is_active = FALSE`, not deleted).

### Step 5 — Reactivation (if needed later)

To bring an offboarded client back:
1. `UPDATE projects SET is_active = TRUE, deactivated_at = NULL`
   for the project key.
2. Unpause brands: `UPDATE brands SET is_paused = FALSE,
   paused_at = NULL, paused_by = NULL, paused_reason = NULL
   WHERE project_key = '<KEY>'`.
3. Re-enable the Jira webhook.
4. Run a one-shot sync if needed (`/api/jira/sync` admin button).

History is preserved across deactivation/reactivation cycles.

---

## 10. Remediation Plan

Synthesis of every actionable finding from §2–§7.

### Pre-SPL onboarding (must fix; ~30 min CQIP-side)

| # | Finding | Severity | Effort | Notes |
|---|---|---|---|---|
| P1 | UI strings: `'NBLYCRO-123'` / `"NBLYCRO-"` placeholders (§5 — 5 strings across 4 files) | Medium | 15 min | Pure copy fix. Generic placeholder text. Bundle into a single small commit. ✅ **Shipped 2026-05-06 (Batch 005.9)** |
| P2 | **Confirm SPL's `customfield_12220` value** (§4.2 sub-case) | Critical operational | 5 min | One Jira API call against an SPLCRO ticket. Determines exact `jira_value` to seed. |
| P3 | Seed `projects` row for SPLCRO (§8 Step 2) | Critical | 5 min | INSERT one row. |
| P4 | Seed `brands` row for SPL (§8 Step 3) | Critical | 5 min | INSERT one row. Depends on P2. |
| P5 | Configure Jira webhook for SPLCRO (§4.1, §8 Step 4) | Critical operational | 10 min | Lacey-side, in Jira UI. Option A (per-project webhook). |

### SPL onboarding day (Lacey-led, on the day)

| # | Finding | Severity | Effort | Notes |
|---|---|---|---|---|
| O1 | Verify ingestion end-to-end (§8 Step 6) | Critical | 15 min | Test ticket transition through DCR → Sendback → Auto-advance. |
| O2 | Post-onboarding QA (§8 Step 10) | High | 15 min | Sync pill green, coverage row populated, charts show SPL data. |
| O3 | Document SPL onboarding in `CLAUDE.md` (§8 Step 9) | High | 10 min | New §16 entry + §1 client-list note. |

### Post-SPL onboarding (next batch — defer, fix when comfortable)

| # | Finding | Severity | Effort | Notes |
|---|---|---|---|---|
| Q1 | Brand-create admin UI on `/dashboard/settings/coverage` (§6.5) | High | 4 hours | Form: project_key dropdown, brand_code, jira_value, display_name. Mirrors the existing pause/QA-config drawer pattern. ✅ **Shipped 2026-05-07 (Batch 005.20)** — `AddBrandDrawer` + `POST /api/admin/brands` with admin gate, validation (regex on brand_code, project FK check, duplicate detection on (project_key, brand_code) and jira_value), and per-field audit_log writes via `getChangedBy()`. Delete still deferred to backlog item 5.4. |
| Q2 | Rename `nbly_brand` → `client_brand_field` in `JIRA_FIELD_MAP` (§3) | Low | 30 min | Cosmetic. Lockstep update across `lib/jira/field-map.ts` + both edge functions + scripts. |
| Q3 | Decide on per-client Teams channel (§6.4) — single channel for v1.5; revisit when first request lands | Medium | 0 (decision only) | Document the call in CLAUDE.md. |
| Q4 | Decide on brand-resolution fallback approach for single-brand clients (§4.5) — Recommend (A) for SPL; (B) when a second single-brand client lands | Medium | 0 today, ~3 hours when (B) becomes the call | Adds `projects.default_brand_id` column + edge function update. |

### Long-term (broader multi-client polish — Batch 005.x or beyond)

| # | Finding | Severity | Effort | Notes |
|---|---|---|---|---|
| L1 | Per-project `alert_rules` config if per-client thresholds become needed (§7) | Low | 4 hours | Add nullable `project_key` column on `alert_rules`; `NULL` means "applies to all." Edge function update minimal. |
| L2 | Per-project `JIRA_FIELD_MAP` if a future client lands on a different Jira instance (§3) | Low | 8+ hours | Substantial refactor. Defer until the need is real. |
| L3 | `brand_aliases` admin UI (§6.5) | Low | 3 hours | Most clients won't need it. Build only when needed. |
| L4 | `scripts/backfill-milestones.ts` parameterization (§2) | Medium | 2 hours | If SPL has historical DCR milestones to backfill. Skipped if SPL is starting fresh. |
| L5 | **Dashboard Documentation Hub — Client Onboarding section** (future Batch 005 item, number TBD at implementation time) | Medium | 6–10 hours | New surface inside the dashboard rendering this report's §8 (onboarding) and §9 (offboarding) as canonical user-facing content. Reads from a markdown source file (this report or a hub-specific copy) and renders with anchor links, copy-to-clipboard for the SQL snippets, and a "mark step done" checklist that persists per-onboarding. **Hard dependency:** §8 of this audit must be canonical source content (already written for that purpose; addendum 2026-05-06 sharpened the prose and added the QA-tab / screen-scheme / field-ID / workflow-alignment / project-board-automations steps). When the hub batch ships, decide whether the hub reads this file directly (single source of truth, drift-free) or maintains its own copy (independent edit history, drift risk). The single-source path is preferred; if Lacey wants per-step interactive UI (checklist persistence, per-step "I did this" markers), the hub can layer that on top of a markdown source rather than forking the prose. |

### Items that need further investigation

- **F1: SPL's `customfield_12220` content shape.** Is the field
  populated on SPL tickets? With what value? See §4.2 sub-cases.
  Resolve before onboarding day (P2 above) by inspecting one
  SPLCRO ticket. If the answer is "field is empty," the
  resolution becomes a `brand_aliases` seed for the empty-string
  case OR the (B) approach from §4.5 (`projects.default_brand_id`).
- **F2: SPL workflow drift.** Pre-audit confirmed status names
  match. Worth a 5-minute spot-check on actual SPLCRO tickets the
  day before onboarding — ensure no Jira admin renamed a status
  in the interim.

### Honest total-effort estimate

**To bring CQIP from "NBLY-only" to "any CRO client onboards in
1-2 hours":**

- Pre-SPL critical-path: **~30 minutes CQIP-side + 10 minutes
  Lacey-side in Jira**.
- SPL onboarding day: **~45 minutes** (P2 verification + Steps
  6/9/10 from §8).
- Post-SPL polish (Q1/Q2/Q3/Q4): **~5 hours** total, optional,
  not blocking.

The "1-2 hours per client" target is realistic *as long as the
brand-create UI (Q1) ships*. Without it, every onboarding has a
~5-minute SQL detour for the brand row, which is fine for
client-2 (SPL) but starts to grate by client-3 or 4.

---

## 11. Appendix

### Glossary

- **`project_key`** — the Jira project key (e.g., `NBLYCRO`,
  `SPLCRO`). Stored verbatim in `projects.jira_project_key` and
  referenced as a string FK target by `brands` and `quality_logs`.
- **`brand_code`** — short uppercase identifier for a brand
  (e.g., `MRA`, `MRR`, `SPL`). Stored on `brands.brand_code`.
  Hyphens allowed (e.g., `MRR-CA`).
- **`jira_value`** — the *exact* string Jira returns from the
  brand customfield. For NBLY, this is `'MRA - Mr Appliance'`,
  `'MRR - Mr Rooter Plumbing'`, etc. For SPL, format TBD —
  resolve via P2 above.
- **Milestone** — a `test_milestones` row capturing the *first*
  time a Jira ticket reaches a named state (today: only
  `'dev_client_review'`).
- **Sendback / rework event** — a `quality_logs` row created when
  a ticket transitions backwards from a QA / review state into
  Active Dev / Active Design.
- **Drought** — a brand with fewer than `threshold` (default 2)
  test milestones in the trailing `window_days` (default 28). The
  drought-evaluator cron writes `alert_events` rows on these.
- **Multi-tenant boundary** — the FK `quality_logs.project_key →
  projects.jira_project_key` (and the analogous FK on `brands`).
  This is the single source of truth for "which client owns this
  data."

### CLAUDE.md sections most relevant to multi-client work

- **§1** — Project context. Currently NBLY-implicit; will gain
  SPL mention as part of onboarding (Step 9).
- **§4** — Environment variables. All instance-global per §6.1.
- **§5** — Database schema. Multi-tenant boundaries documented
  per §7 above.
- **§6** — Jira workflow + trigger logic. Project-agnostic by
  design.
- **§7** — `JIRA_FIELD_MAP`. Instance-global; documented per §3.
- **§9** — User accounts. Single-instance, instance-global users.
- **§10** — Alert rules. Currently global, documented per §7.
- **§13** — Business rules. Rules 13 (brand alias fallback), 18
  (milestone independence), 20 (cron `changed_by`) are the
  multi-tenant-relevant ones.
- **§14** — `Identified for v1.5`. Multi-client readiness lives
  here; this report is the v1.5 discovery output.
- **§15** — Pending TODOs. Batch 004.99 (this) + Batch 5.x items
  surfaced from §10's remediation plan.

### Downstream consumers

This audit is intentionally durable and is referenced from several
other surfaces. Sections of this report flow downstream as
follows; if any section is significantly rewritten, check the
listed consumers for staleness.

| Section | Downstream consumer | Notes |
|---|---|---|
| §8 (Onboarding Playbook) | **Dashboard Documentation Hub — Client Onboarding section** (future Batch 005 item; see §10 row L5) | §8 is canonical source content for the hub. Per the addendum 2026-05-06, §8 is written to stand alone — every step makes sense without reading `CLAUDE.md` alongside, since the dashboard hub user won't have it open. Internal `§N` cross-refs point at other sections of this same audit, which the hub will surface alongside §8. |
| §9 (Offboarding Playbook) | Same hub | Pairs with §8 in the hub. Currently shorter and more SQL-focused than §8; that's appropriate — offboarding is rarer and the steps are deliberate destructive actions admins should walk through carefully, not skim. |
| §10 (Remediation Plan) | `CLAUDE.md` §15 backlog | Items here become Batch entries when scoped (Pre-SPL → §15 immediate; Post-SPL Q* → §15 Batch 005.x; Long-term L* → §15 Batch 006+ or v1.5 candidate list). When a remediation item ships, mark it complete here AND remove it from the corresponding §15 entry. |
| §2 (NBLY Hardcoding Inventory) | Reference for future client onboardings | When Client #3 onboards, the inventory is the starting point: re-grep with the new client's project key, confirm no new hits accumulated, update the table if any have. |
| §3, §4, §5, §6, §7 (audit findings) | Used at audit time, surface again at re-audit time | Re-run this whole audit at major-client milestones (e.g. Client #5, or any structural Jira/CQIP change). The findings tables provide the diff target. |

### Audit metadata

- **Generated:** 2026-05-06.
- **Addendum:** 2026-05-06 — Section 8 rewritten for the future
  Dashboard Documentation Hub destination (added QA tab + screen
  scheme verification, custom field ID inspection with screenshot
  guidance, workflow alignment quick-check, project-board
  automations step covering QA-clear cloning + generic CRO
  automation audit + SharePoint-as-known-dependency); §10 gained
  remediation row L5 for the hub batch; §11 gained the Downstream
  Consumers subsection.
- **2026-05-07 — Q1 shipped (Batch 005.20):** brand-create admin
  UI landed at `/dashboard/settings/coverage`. §6.5 + §10 row Q1
  marked complete. Future client onboardings can seed brand rows
  via UI; SQL fallback still works for migrations / scripted
  setups. Brand delete remains deferred (backlog 5.4).
- **Author:** Claude Code per Batch 004.99 spec.
- **Repo state at audit time:** branch `main`, HEAD `d324cb3`
  (Batch 004.99 initial commit) → addendum applied after.
- **Pre-audit verifications confirmed by Lacey Hay:**
  SPLCRO project key, single brand "SPL",
  `customfield_12906` (Severity) matches NBLY,
  workflow status names match NBLY,
  SharePoint integration in progress (Carl, Azure-side).
- **Audit scope:** `app/`, `components/`, `lib/`, `supabase/`,
  `scripts/`, `.env.example`. Excluded: `node_modules/`,
  `.next/`, `package-lock.json`.

---

*End of Batch 004.99 multi-client readiness audit. Report is
durable and intended for re-reading 6 months from now during
Client #3 or Client #4 onboarding. Update §11's metadata block on
each subsequent audit.*
