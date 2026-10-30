# Environment Variables

**Relocated whole from `CLAUDE.md` on 2026-08-23** by the second extraction
pass, under §13 r41 remedy 3. **This file is live reference — it is NOT the
archive, and r40 does not apply to it.** CLAUDE.md keeps the section heading and
a pointer so existing `§4` citations still resolve.

---


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
CQIP_DROUGHT_AUTH_KEY=           # Shared secret between the daily pg_cron job and the drought-evaluator edge function. Generate with `openssl rand -hex 32`. Not a JWT. Set on Supabase Edge Functions secrets only — Worker does not need this one.
CQIP_CONVERT_MONITORING_TOKEN=   # Batch 012 Phase B — Bearer secret for the external POST /api/monitoring/findings ingest (Convert 008 + any monitoring tool post through it). Timing-safe compare in lib/api/monitoring-bearer-auth.ts. Separate blast radius from the other tokens per §13 rule 27. Generate with `openssl rand -hex 32`. Not a JWT. Set on the Worker via `wrangler secret put` and wherever the monitoring tool runs.

CQIP_ANTHROPIC_API_KEY=          # Batch classifier-1 — Anthropic API key for the AI root-cause classifier route (POST /api/admin/logs/classify). Model is `claude-opus-5`, called over plain `fetch` (no SDK — every external call in this repo already works that way, and adding one would change the Worker bundle for a single endpoint). Read INSIDE the handler, never at module scope, so `next build`'s page-data collection cannot break on it. Worker-only rotation surface — one surface per §13 r27, so rotating it cannot break sync. **Until it is minted the route answers 500 `not_configured`: deployable and inert, the Batch telemetry-ac precedent.** Not a JWT.

# Retired 2026-10-30 (branch retire-ac-surfaces) — the AC-facing surfaces
# /api/sharepoint/*, /api/brands/* and /api/telemetry/ac were deleted, so DC no
# longer reads CQIP_BRANDS_API_TOKEN, CQIP_SHAREPOINT_API_TOKEN,
# CQIP_TELEMETRY_TOKEN, AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
# SHAREPOINT_SITE_HOSTNAME or SHAREPOINT_SITE_PATH. Remove them from .env.local.
# The Worker copies survive deploys (wrangler.toml keep_vars = true) until
# deleted by hand — see "Retired AC-facing keys" below.
```

### Retired AC-facing keys (2026-10-30)

**The Azure app registration `6aa464c1-4eb9-4d94-b087-6eebe4fa8cb6`
("CQIP Dashboard - SharePoint Integration") is now AC's.** AC (the Forge
QA-automation app) authenticates to Microsoft Graph with it directly, from Forge
dev and Forge prod, since 2026-10-28. DC no longer uses it.

- **Two client secrets exist on that one app.** In October 2026 Carl issued AC
  a NEW client secret, held only in Forge dev + prod (`AZURE_CLIENT_SECRET`,
  encrypted). The OLD secret — the one exposed in 2026-06-01's chat paste — is
  the **Worker's**, and is now dead weight.
- **Never rotate or delete AC's secret without AC.** Doing so breaks
  SharePoint drafting and posting in production. Coordinate through
  CROSS_CLAUDE §4.
- **Deleting the OLD secret is pending Carl:** he confirms from the Azure
  sign-in logs, by key ID, that the old key has stopped authenticating, then
  deletes that key only.
- **Worker cleanup:** after this branch deploys, `wrangler secret delete` each
  retired key (`CQIP_BRANDS_API_TOKEN`, `CQIP_SHAREPOINT_API_TOKEN`,
  `CQIP_TELEMETRY_TOKEN`, the three `AZURE_*`) and remove the
  `SHAREPOINT_SITE_*` dashboard vars. `keep_vars = true` keeps them otherwise.
  Deleting the Worker's `AZURE_*` copies does not touch AC.

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

