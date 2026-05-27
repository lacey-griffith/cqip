# Batch 011 — Node 24 upgrade + /api/health endpoint

**Author:** DC + Lacey
**Date:** 2026-05-27
**Status:** Ready for Claudette execution
**Scope-locked:** Yes
**Time pressure:** Node 20 EOL deadline 2026-06-02 (6 days)

---

## Purpose

Two paired CI hygiene items that both touch `deploy.yml`:

1. Bump GitHub Actions Node runtime from 20 → 24 before the
   2026-06-02 deadline
2. Add `/api/health` endpoint so the auto-deploy workflow's smoke
   check has a real health signal instead of pinging `/login`

End state: deploy workflow runs on Node 24, smoke check hits a
purpose-built endpoint that reports actual app health, and we're
ahead of the deadline by 5+ days.

---

## Scope (locked)

1. Bump `actions/setup-node` to Node 24 in `.github/workflows/deploy.yml`
2. Create `app/api/health/route.ts` returning lightweight health JSON
3. Update workflow smoke check to hit `/api/health` instead of `/login`
4. Local verification before push
5. CLAUDE.md updates

**Explicitly OUT of scope:**
- Deep health checks (DB connection probes, Supabase pings, etc.)
  — v1 is just "app responds, env loaded"
- Health dashboard UI
- Alerting on health check failures
- Multi-environment health (preview deploys, etc.)

---

## Sequence

### Step 1 — Local Node 24 verification

Before touching any files:

```bash
nvm use 24    # or fnm use 24 / install if needed
node --version    # confirm v24.x
npm ci
npm run build
```

If build fails on Node 24:
- STOP, surface the error to Lacey
- Common failure modes: deprecated API in a dep, native module not
  yet compiled for Node 24
- Do NOT push a workflow change that hasn't built locally

If build passes → proceed.

---

### Step 2 — Create `/api/health` endpoint

File: `app/api/health/route.ts`

Minimal Next.js route handler. No auth, no Bearer token —
intentionally public so the workflow can hit it without credentials.

**Response shape (200):**

```json
{
  "status": "ok",
  "timestamp": "2026-05-27T15:30:00.000Z",
  "version": "<commit-sha-or-build-id-if-available>",
  "environment": "production"
}
```

**Implementation notes:**
- Set cache headers to prevent edge caching: `Cache-Control: no-store`
- `version`: try `process.env.CF_PAGES_COMMIT_SHA` first, fall back to
  `process.env.GIT_COMMIT_SHA`, fall back to `"unknown"`. Don't crash
  if neither is set.
- `environment`: read from `process.env.NODE_ENV` or
  `process.env.ENVIRONMENT`. Default `"unknown"` if neither set.
- No DB query. No Supabase call. No Graph call. This endpoint must
  stay fast and dependency-free so smoke checks have meaningful signal.
- Always returns 200. If the route handler itself fails to execute,
  the workflow's HTTP fetch fails — that's the health signal.

**Audit-log:** none. This is a read-only health probe with no state
changes. §13 rule 2 doesn't apply.

---

### Step 3 — Update `.github/workflows/deploy.yml`

Two edits in this file:

**Edit A — Node version bump:**

Find:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
```

Replace with:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '24'
```

**Edit B — Smoke check endpoint:**

Find the existing smoke check step (currently hits `/login` per
Batch 005.31 setup). Replace the URL path with `/api/health`.

Update any assertion logic — if the current check is just "status
200," that's fine. If it's checking response body, switch the
assertion to verify `{"status":"ok"}` is in the body.

---

### Step 4 — CLAUDE.md updates

- **§3 Repository Structure** — add `app/api/health/` to the route
  listing
- **§4 Environment Variables** — note that `/api/health` reads
  `CF_PAGES_COMMIT_SHA`, `GIT_COMMIT_SHA`, `NODE_ENV`,
  `ENVIRONMENT` (all optional, none required)
- **§13 rule check** — confirm rule 30 (auto-deploy workflow
  paths-ignore) still excludes docs. No new rule needed.
- **§15** — note Batch 011 shipped, remove Node 20→24 from
  "On the radar"
- **§16** — new Batch 011 entry

Bump CLAUDE.md version (v1.5 → v1.6 if this is the first version
bump after 005.32 supersede).

---

### Step 5 — Test + deploy

1. TypeScript compile clean (`npm run build` on Node 24)
2. Commit and push — workflow runs on the push
3. **First workflow run is the real test.** Watch it. If Node 24
   breaks the build in CI despite passing locally, roll back the
   workflow change immediately and surface to Lacey.
4. Verify smoke check passes against `cqip.l-hay.workers.dev/api/health`
5. Curl the deployed endpoint:
   ```bash
   curl -i https://cqip.l-hay.workers.dev/api/health
   ```
   Expect 200, `Content-Type: application/json`, body matching the
   response shape.

---

## §3 — Acceptance criteria

- [ ] `npm run build` passes locally on Node 24
- [ ] `app/api/health/route.ts` exists, returns 200 with JSON body
- [ ] `deploy.yml` uses Node 24
- [ ] `deploy.yml` smoke check hits `/api/health`
- [ ] Auto-deploy workflow runs green after push
- [ ] `https://cqip.l-hay.workers.dev/api/health` returns 200
- [ ] CLAUDE.md updated, version bumped if needed
- [ ] Node 20→24 removed from "On the radar"

---

## §4 — Rollback plan

If Node 24 breaks production deploy:

1. Revert the `deploy.yml` Node bump only (keep `/api/health`)
2. Push the revert
3. Workflow re-runs on Node 20
4. Investigate the Node 24 failure separately
5. Try again before 2026-06-02

`/api/health` is independently shippable and doesn't depend on the
Node bump — it works on Node 20 too.

---

*End of spec. Ship it.*
