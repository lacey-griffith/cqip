# AC → DC Telemetry Contract

**Status:** APPROVED-WITH-FINDINGS (Jenny + DC joint review, 2026-08-07) — all six
required revisions incorporated below. This document is the canonical spec and is
committed BEFORE the build session opens, per CLAUDE.md §15 PROCESS.

**Batch:** telemetry-ac · **Migration:** 026 · **Gates:** Jenny pre-flight DONE
(new route + new table + new mutation surface). Karen post-flight owed.

---

## 0. Purpose and shape

DC's System Info page gains a **"Jira QA Automation (AC)"** section.

AC is an Atlassian Forge app: its functions run only inside Jira and it exposes no
pollable surface. So the direction is inverted from every other AC↔DC contract —
**AC pushes events, DC stores and renders.** This is the first AC-authored *write*
into DC storage; every prior surface (`/api/brands`, `/api/sharepoint/*`) is AC
*reading* DC.

Consequence worth stating once: a leaked telemetry token creates rows rather than
merely reading config. That is why it is a dedicated token (§2) and why the route
carries a body-size bound (§4).

---

## 1. Endpoint

```
POST /api/telemetry/ac
```

Carved out of the `middleware.ts` matcher alongside `api/sharepoint`, `api/brands`
and `api/monitoring` (the negative lookahead at `middleware.ts:114`). Rationale is
the existing one documented at `middleware.ts:104-113`: a token-gated machine path
must not take a `supabase.auth.getUser()` round-trip, and must not acquire a
Supabase-availability dependency it does not need.

---

## 2. Auth

New dedicated bearer **`CQIP_TELEMETRY_TOKEN`**.

- 64-char hex, minted `openssl rand -hex 32`. Stored in Keeper.
- Worker secret binding via `wrangler secret put` — the **16th secret** (17th
  binding overall; `ASSETS` is the non-secret one). Measured 2026-08-06.
- AC side: `forge variables set --encrypt`, **dev + prod**.
- Timing-safe compare, `lib/api/telemetry-bearer-auth.ts`, byte-identical in shape
  to `lib/api/monitoring-bearer-auth.ts` — three-state result
  (`500 not_configured` / `401 missing_header` / `401 wrong_token`).

**Rationale (§13 r27):** per-integration blast radius. Rotating this token cannot
break drafting (SharePoint) or config reads (brands).

**Rotation surfaces — THREE, and they rotate atomically per §13 r27:**
Worker secret · Forge dev variable · Forge prod variable. Recorded in
`docs/CROSS_CLAUDE.md` §4.

---

## 3. Payload

```jsonc
{
  "app_version":  "5.2.0",         // Forge env at runtime
  "commit":       "43de652",       // baked at AC build time
  "event":        "draft_ok" | "draft_error" | "post_ok" | "post_error",
  "ticket":       "NBLYCRO-2354",
  "error_kind":   string | null,   // AC taxonomy: auth, sharepoint_404, xlsx_parse, …
  "error_detail": string | null,   // redacted + truncated at the DC boundary (§3.2)
  "ts":           "2026-08-07T…Z", // AC clock — DISPLAY ONLY
  "env":          "dev" | "prod"   // REQUIRED
}
```

All fields required; `error_kind` and `error_detail` may be `null` (they must be
*present*). Unknown extra keys are ignored, not rejected — see §4.

### 3.1 `env` is required and CHECK-constrained — REVISION 4

The token is provisioned to Forge **dev and prod**, and the rollout sequence puts
dev-side proof *before* AC prod. So dev events arrive first and would otherwise be
indistinguishable from prod.

**Render and liveness are scoped to `env = 'prod'`.** Without this, the failure
mode is not cosmetic: dev traffic keeps the liveness line quiet, so **a dead prod
reads as alive** — the same shape as the 7-day silent drought-evaluator failure and
the 9-day Pulse truncation. A health indicator that reads "fine" while the thing is
dead is worse than no indicator.

### 3.2 `error_detail` — DC boundary is authoritative — REVISION 3

The redaction rule is enforced **at DC**, on receipt. It is not an instruction to
the sender. The point of a contract is that the receiver does not trust the sender.

This is not hypothetical. The path is traceable:

1. AC's taxonomy includes `sharepoint_404`.
2. DC's own SharePoint route echoes the caller's URL **verbatim** into its error
   envelope — `errorResponse('folder_not_found', …, { url: rawUrl })` in
   `app/api/sharepoint/folder/route.ts`.
3. CRO folder URLs carry a `?e=<token>` **sharing credential** (verified against the
   real URLs in `docs/`).

So the natural `error_detail` — forwarding DC's own error envelope — ships a
credential-bearing URL into 90-day storage.

**Rule:**
- Redact any substring matching the deny-patterns: `Bearer `, `eyJ` (JWT prefix),
  `access_token=`, SAS params `?sig=` / `sv=` / `se=`, and SharePoint share `?e=`.
  A match is replaced with `[REDACTED]`; the surrounding text survives.
- Then **hard-truncate to 200 chars.**
- **TRUNCATE, DO NOT 400.** A fire-and-forget sender cannot act on a 400, so
  rejecting an over-long detail would discard the whole event for a cosmetic reason.

### 3.3 `event` is CHECKed; `error_kind` deliberately is NOT

`event` is a closed four-value set and carries a CHECK constraint.

`error_kind` carries **no** CHECK. AC owns that taxonomy, and a CHECK would turn an
AC-side taxonomy addition into a DC migration plus a hard ingest failure — exactly
the cross-project coupling §13 r27's blast-radius reasoning exists to avoid.

### 3.4 Clocks

`ts` is AC's clock. `received_at` is DC's, stamped on receipt.

**`received_at` orders everything** — retention, "latest event", "first seen",
liveness. `ts` is display only. A skewed Forge clock must not be able to reorder
"latest event" or poison "first seen".

If `app_version` and `commit` disagree with the pair already recorded for that
commit, the render shows one line saying so. A mismatch is itself signal: the env
var moved without a rebuild.

---

## 4. Responses

| Status | When | Body |
|---|---|---|
| **202** | accepted | minimal JSON, `Cache-Control: no-store` |
| **401** | bad/missing bearer | `{ error: 'Unauthorized' }` |
| **500** | token not configured server-side | `{ error: 'Telemetry not configured' }` |
| **400** | shape violation only | `{ error: <reason> }` |

**Body-size bound:** the raw body is length-checked *before* `JSON.parse`. Over the
bound → 400. This is the Worker-memory guard `MAX_BATCH = 500` provides on
`/api/monitoring/findings`; this route takes a single event, so it bounds bytes.

**202 rather than 200** diverges from `/api/monitoring/findings` (implicit 200 with
a summary). Deliberate: DC accepts the event and does downstream work (dedupe,
version-seen upsert, prune) that the sender neither waits for nor can act on.

### 4.1 Rejected payloads must be VISIBLE, not silent

AC swallows telemetry failures by design. So if AC's payload shape drifts after a
refactor, DC 400s, AC swallows it, and System Info renders "no events in 7 days" —
which reads as **AC is dead** when AC is fine.

Every 400 therefore writes a row to `ac_telemetry_rejects` (reason + a redacted,
truncated excerpt), and System Info renders a 7-day reject count. A log line alone
does not satisfy this: Worker logs are not on the System Info page, and the whole
point is that the operator looking at the page sees the difference between "idle",
"unreachable" and "sending garbage".

---

## 5. Storage — migration 026

Three tables. All writes are service-role via `supabaseAdmin`.

### 5.1 `ac_telemetry`

Columns per §3, plus `id` and `received_at`.

- `event` CHECK-constrained; `env` CHECK-constrained; `error_kind` unconstrained.
- **Index** `received_at DESC` — mirrors `idx_monitoring_findings_detected_at`.
- **Unique index** `(env, commit, event, ticket, ts)` with `ignoreDuplicates` on
  write. Protects the 7-day error count from retry inflation (§7 Q3).
  **Deliberate widening:** the review said `(commit, event, ticket, ts)`; `env` is
  included so a dev and a prod event that coincide exactly cannot collide and
  silently drop the prod one. A retry always shares its own `env`, so dedupe is
  unweakened.

**Retention:** keep rows that are within 90 days **OR** among the newest 500 —
whichever set is larger. Expressed as: delete where older than 90 days AND not in
the newest 500.

**Prune mechanism — INLINE ON INSERT, not cron (DC's call under revision 6).**
A `prune_ac_telemetry()` SQL function is invoked fire-and-forget after each insert.
Rationale over plain-SQL pg_cron (the review's preference, also acceptable):
- Zero ops steps. A cron job is a thing Lacey must create and could forget; if
  forgotten the table grows forever with nothing surfacing it.
- No new cron surface at all, so no new silent-failure class (cf. §15 backlog 5.21
  and the 2026-05-01→05-07 drought incident).
- No edge function ⇒ no `verify_jwt` (§13 r21) and **no fifth shared secret**
  (§13 r27) — the same win pg_cron-with-plain-SQL gets, without the ops step.
- Volume is a handful of events per QA draft against a ≤~500-row table, so the
  delete is negligible. The function early-returns when the table is under the
  row floor.

Prune failure is swallowed and logged: it must never fail an ingest. Failure is
benign (the table grows) and observable as row count.

### 5.2 `ac_version_seen` — REVISION 1 / finding H4

`(env, commit)` unique, plus `app_version` and `first_seen_at`. **NEVER pruned.**

**Why it exists:** "first event per commit" is by definition the *oldest* row for
that commit — precisely what pruning deletes first. AC deploys infrequently (that is
the premise for inferring deploys from version change at all), so a commit live
beyond 90 days loses its own first row and the derived date would **silently jump
forward** to the oldest survivor. Always wrong, always in the more-recent direction,
never an error. A handful of rows kept forever removes the contradiction.

Written with `ignoreDuplicates` so the **first** write wins and `first_seen_at` is
immutable.

### 5.3 `ac_telemetry_rejects`

`id`, `received_at`, `reason`, `detail` (redacted + truncated). Pruned by the same
function on the same rule. Feeds §4.1.

### 5.4 RLS — REVISION 2 / finding H1

**Admin-only SELECT via `public.is_admin()`** on all three tables (the
`login_events` posture, migration 023). **No INSERT/UPDATE/DELETE policy** for
`authenticated` — service-role writes bypass RLS, matching the append-only
convention in migrations 016 and 018.

**This is load-bearing, not boilerplate.** `app/dashboard/settings/system/page.tsx`
is `'use client'` and reads through `lib/supabase/client` — the **anon key**, RLS-bound.
`supabaseAdmin` covers the write side only. Without an explicit SELECT policy the
section renders **empty with no error**.

### 5.5 No audit rows

No `audit_log` row per ingest. This is not an §13 r2 violation: r2 is scoped to
`quality_logs`, and `/api/monitoring/findings` sets the explicit precedent for
external fire-and-forget feeds. `audit_log_target_shape_chk` needs **no** extension.

---

## 6. Render — System Info, "Jira QA Automation (AC)"

All reads are `.range()`-bounded. A fetch-then-filter 7-day count is the
silent-truncation shape documented in `lib/client-library/paged-fetch.ts` — and it
**fails toward "everything's fine"**, which is the worst direction for a health panel.

Scoped to `env = 'prod'` throughout.

| Line | Source | Note |
|---|---|---|
| Version + commit | latest prod `ac_telemetry` by `received_at` | one extra line if `app_version`/`commit` disagree with `ac_version_seen` |
| **First seen** | `ac_version_seen.first_seen_at` | **NOT "last deploy"** — see below |
| Last activity | latest prod `received_at` | |
| 7-day **error events** | count of `*_error` in 7d | labelled "error events", not "errors" |
| Last error | most recent `*_error` — kind + redacted detail | |
| Liveness | no prod events in 7d | "idle or unreachable" |
| Rejected payloads (7d) | `ac_telemetry_rejects` | §4.1 |

**"First seen", not "last deploy".** The value is the first time DC *observed* that
commit, which lags the real deploy by however long until someone drafts — and never
appears at all if nobody drafts. Labelling it "last deploy" would be the same
overclaiming shape as the "Total Logs" → "Logs This Month" relabel in Batch 004.12.

**Liveness copy says "idle or unreachable".** With only draft/post events, absence
cannot distinguish "AC is broken" from "nobody ran a QA draft this week", and those
demand opposite responses. There is no heartbeat event in v1; the copy states the
ambiguity rather than implying a fault. Recorded as a v1 limitation.

**Token-age field: DROPPED — REVISION 5.** A hand-maintained constant that renders
as live data is structurally the `COVERAGE_TARGET_EFFECTIVE` finding (mechanism
weaker than the claim) and the `alert_rules.config.threshold` scar (an edit whose
only record is a §16 prose block). Nothing forces it to be updated, and its entire
purpose is to tell you when to rotate. Rotation dates live in
`docs/CROSS_CLAUDE.md` §4.

---

## 7. The three review questions, settled

1. **Event set sufficient?** Yes for draft/post health, *given* §5.2 fixes the
   deploy-inference contradiction and §6 labels the liveness ambiguity. No heartbeat
   in v1.
2. **Redaction strong enough as written?** **No** — hence §3.2, enforced at the DC
   boundary with a traceable leak path closed.
3. **Idempotency needed?** No nonce scheme — but the stated reason ("duplicates are
   harmless") is wrong for one rendered value: the 7-day error **count** is a count,
   and error paths are where retries happen. Closed cheaply by the unique index +
   `ignoreDuplicates` (§5.1), so the metric is honest without a protocol change.

---

## 8. Ride-along — the DC version is a lie

`app/dashboard/settings/system/page.tsx:8` hardcodes `APP_VERSION = 'v1.2'` and
renders it at `:78`. CLAUDE.md's footer says **v2.7**. `package.json` says `0.1.0`.
There is no truthful machine source for the DC version today.

This batch adds a *truthful, derived* AC version display directly beside it, so the
lie becomes conspicuous. Fix in the same pass: `package.json` becomes the single
source (`2.7.0`), `scripts/gen-build-info.js` stamps it as
`NEXT_PUBLIC_APP_VERSION` alongside the existing commit/time stamps, and the page
renders the stamped value. Converts a hardcoded literal into a derived one — the
same move the coverage-honesty batch made when it derived drought copy from the
constant.

Residual: `package.json` vs the CLAUDE.md footer still drift by hand. That is one
documented coupling instead of a silent literal, and §13 r23 already requires the
footer bump.

---

## 9. Sequencing

1. **This spec, committed standalone (commit 1).**
2. Migration 026 + endpoint + RLS + prune + tests.
3. System Info UI + the §8 ride-along.
4. **Report BEFORE the token mint.** The mint/seed is Lacey's runbook across three
   surfaces (Worker, Forge dev, Forge prod) per §13 r27; Claudia then builds the AC
   emitter; dev-side proof precedes AC prod.

Until the token exists, the route answers **500 `not_configured`** — deployable and
inert, which is the intended pre-mint state.

## 10. Docs owed on ship (§13 r23)

CLAUDE.md §3 file tree · §4 + `.env.example` · §5 schema + RLS · §13 if a rule
changes · §16 entry · footer. **Plus, because this is a live AC↔DC contract:**
`docs/CROSS_CLAUDE.md` §3 Contract Surfaces (with Last-verified, siblings at
`/api/brands` and `/api/sharepoint/*`), §4 Pending Rotations (three surfaces), and a
§6 event-log entry.
