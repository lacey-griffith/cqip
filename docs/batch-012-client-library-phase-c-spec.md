# Batch 012 — Client Library, Phase C (Jira Ticketing) — SPEC

**Author:** DC · **Date:** 2026-07-17 · **Repo:** `lacey-griffith/cqip`
**Status:** DRAFT for Jenny pre-flight → Claudette build (build AFTER Phase B ships)
**Canonical on ship:** CLAUDE.md §15/§16. This doc is the build spec.

---

## 0. Done definition (do not expand mid-build)

- An admin can turn a monitoring finding OR a directive into a Jira issue with
  one click; the created ticket's key + URL are stored on that row and shown as
  a link.
- Ticket creation is **admin-triggered only** — never auto-on-ingest (that would
  spam Jira). Read-only users see ticket links, no create button.
- **Idempotent:** a row that already has a ticket won't create a second one.
- **All-or-nothing:** if the Jira call fails, no partial state is written (no
  orphan key, no status flip) and the admin sees the error.
- Reuses the existing Jira credential + a new shared `createIssue` helper that
  Phase D's public bug form will also call.

**Out of scope (D — TODOs only):** the public bug form, per-cell (per-brand)
ticketing, auto-ticketing on ingest, two-way Jira status sync back into CQIP.

---

## 1. PREREQ — verify BEFORE build (this is the Jenny gate)

The app's Jira auth (`lib/jira/client.ts`) is Basic auth with a **user** token
(`JIRA_EMAIL` / `JIRA_API_TOKEN`) — it inherits that user's permissions, so
writes are mechanically possible. Confirm two things first:

1. **Create permission:** the `JIRA_EMAIL` account can create issues in the
   target project (NBLYCRO). If it can't, this needs a permission grant
   (Carl/Xandor) or a service account — do not start the build until resolved.
2. **Required fields / issue type:** pull the project's create-meta
   (`/rest/api/3/issue/createmeta` or the Rovo `getJiraIssueTypeMetaWithFields`)
   for the chosen issue type (default **Task**) and confirm which fields are
   REQUIRED. If the project mandates fields beyond summary/description
   (components, etc.), the helper must supply them. Record the required-field
   list in the spec before Claudette builds the payload.

**Target project + issue type (decide + record here before build):**
`_______________` (project key) · `_______________` (issue type).
Default assumption pending Lacey: file into the finding's/directive's
`project_key`-mapped Jira project as a **Task**.

---

## 2. Data model — migration `026_ticketing_columns.sql`

Idempotent `ADD COLUMN IF NOT EXISTS`. No new tables.

Add to **`monitoring_findings`** and to **`directives`**:
```
jira_ticket_key text        -- e.g. "NBLYCRO-1284"; NULL until ticketed
jira_ticket_url text        -- deep link; NULL until ticketed
```

**No audit_log CHECK change.** Ticket creation audits as an UPDATE on the
existing row (`target_type` stays `monitoring_finding` / `directive`,
`field_name='jira_ticket_key'`, `old_value=NULL`, `new_value=<key>`) — both
target types are already admitted by migration 025's constraint. Verify, don't
re-ADD.

---

## 3. Shared helper — `lib/jira/createIssue.ts`

Sits alongside `lib/jira/client.ts`; reuses its `jiraHeaders` + `baseUrl`.

```
createIssue({ projectKey, summary, description, issueType='Task', labels=[] })
  → POST {baseUrl}/rest/api/3/issue
  → returns { key, url: `${baseUrl}/browse/${key}` }
  → throws on non-2xx (caller handles; never swallow)
```

- **Description MUST be Atlassian Document Format (ADF)**, not a plain string —
  Jira REST v3 create rejects string descriptions. Include a minimal
  `stringToADF()` that wraps text in a valid ADF doc (paragraph nodes).
- **Labels for triage/origin:** always include `cqip`; callers add
  `cqip-finding` / `cqip-directive`. (Phase D adds `cqip-public-report` — the
  label scheme is how public-reported tickets stay distinguishable, so lock it
  now.)
- No retries in v1; a failure surfaces to the admin to retry manually.

---

## 4. Routes — 2 admin mutation routes

Both session+admin-gated, mirroring the Phase A/B admin routes exactly
(`createSupabaseRouteClient` → role check → `supabaseAdmin` write →
`getChangedBy` → audit row).

### 4.1 `POST /api/admin/monitoring/findings/ticket`  — body `{ finding_id }`
- **Idempotency guard:** if the finding already has `jira_ticket_key`, return
  `200 { ok:true, already:true, key, url }` — do NOT create a second issue.
- Build `summary` (e.g. `"[<brand>] <issue_type> — <summary>"`) and an ADF
  description from the finding fields (+ a deep link back to the finding if
  practical). Labels: `['cqip','cqip-finding']`.
- Call `createIssue`. **On success:** store `jira_ticket_key`/`url`, optionally
  set `status='actioned'`, write one audit row. **On failure:** write NOTHING
  (no key, no status change); return `502 { ok:false, error }`.
- Returns `{ ok:true, key, url }`.

### 4.2 `POST /api/admin/directives/ticket`  — body `{ directive_id }`
- Same pattern for a directive (directive is the whole cross-brand work item →
  one ticket). Labels: `['cqip','cqip-directive']`. Same idempotency +
  all-or-nothing rules. Audit row on the directive.

---

## 5. UI — ticket affordances on `/dashboard/client-library`

- **Finding card (admin, no ticket yet):** "Create ticket" button → 4.1 →
  optimistic → renders the key as a link on success; on error, revert + toast.
- **Finding card (has ticket):** show the `NBLYCRO-xxxx` link badge, no button.
- **Directive row (admin):** same pattern via 4.2; badge/link on the row.
- Read-only users: badges/links only, never the create button.
- Folded into the existing single per-project fetch (the new columns ride along).

---

## 6. Tests — `tests/jira-ticketing.test.ts`

Pure logic only; **mock the HTTP** (never hit real Jira in tests):
1. `stringToADF` produces a valid ADF doc structure.
2. Summary + label construction differs correctly for finding vs directive.
3. Ticket URL built as `${baseUrl}/browse/${key}`.
4. Idempotency guard: a row with an existing key does not call `createIssue`.
5. All-or-nothing: a thrown `createIssue` leaves the row unchanged (no key, no
   status flip).

Verification bar = the running app: create a ticket from a real finding →
confirm it appears in Jira with the right labels → the badge links to it → a
second click does not make a duplicate.

---

## 7. Process / gates / commits

- **Jenny pre-flight REQUIRED** — migration + mutation routes + a new **external
  write to the company Jira**. Jenny scrutinizes: create-permission verified
  (§1), idempotency, all-or-nothing, label scheme.
- Two-commit flow: **Commit 1** = this spec, docs-only. **Commit 2** = migration
  026 + `createIssue` helper + the two routes + UI + tests + atomic CLAUDE.md
  §15.5 (§16 on ship).
- **Karen post-flight.**
- **DO NOT PUSH** — Lacey applies migration 026, smoke-tests (create a ticket
  from a finding → verify in Jira → idempotency), deploys.

**Phase D coupling:** `createIssue` is the helper the public bug form reuses;
the `cqip-public-report` label is what keeps public-reported tickets triageable.
Build the helper standalone/reusable (no session assumptions inside it).

---

## 8. Claudette prompt (ready to send after Jenny passes AND §1 is filled in)

```
Batch 012 Client Library — Phase C (Jira ticketing). Build from
docs/batch-012-client-library-phase-c-spec.md (canonical). Two commits, no push.
Phase B must already be on main. §1 prereqs (create-permission + required fields
+ target project/issue type) are confirmed and recorded in the spec.

COMMIT 1 — docs only: land the spec doc (paths-ignore).

COMMIT 2 — code:
- Migration 026_ticketing_columns.sql: add jira_ticket_key + jira_ticket_url
  (nullable) to monitoring_findings AND directives, idempotent. NO audit_log
  CHECK change (verify migration 025 already admits both target types).
- lib/jira/createIssue.ts: reuse client.ts jiraHeaders/baseUrl; POST
  /rest/api/3/issue; ADF description via stringToADF; labels always include
  'cqip'; return {key,url}; throw on non-2xx.
- POST /api/admin/monitoring/findings/ticket and
  POST /api/admin/directives/ticket per §4: admin-gated, idempotency guard,
  all-or-nothing (Jira failure writes nothing), one audit row field_name=
  'jira_ticket_key'. Mirror the Phase A/B admin routes exactly.
- UI per §5: admin-only Create-ticket buttons on finding cards + directive rows;
  link badges when a ticket exists; read-only sees badges only. Ride the
  existing single fetch.
- tests/jira-ticketing.test.ts per §6, HTTP mocked.
- Atomic CLAUDE.md §15.5 in-flight (§16 on ship).

OUT OF SCOPE (TODOs only): public bug form, per-cell ticketing, auto-ticketing
on ingest, Jira→CQIP status sync.

Jenny already pre-flighted. DO NOT PUSH. Report back → Karen.
```
