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

