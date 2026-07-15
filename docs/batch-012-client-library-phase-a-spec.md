# Batch 012 — Client Library, Phase A (Directive Matrix MVP) — SPEC

**Author:** DC · **Date:** 2026-07-15 · **Repo:** `lacey-griffith/cqip`
**Status:** DRAFT for Jenny pre-flight → Claudette build
**Canonical on ship:** CLAUDE.md §15/§16. This doc is the build spec; Claudette builds from it.

---

## 0. Done definition (do not expand mid-build)

- New route renders a directive × brand matrix for a selected project.
- Any authenticated user can VIEW it; only admins see edit affordances, and the
  server enforces admin on every write.
- Admin can (a) create a directive, (b) set any cell's status + note.
- The "Outstanding" count per directive is correct and excludes paused brands.
- Reads/writes ONLY the two new tables. NEVER touches live coverage tables.
- The Claude Design reskin drops in against `globals.css` with correct corners,
  shadows, and status colors (token pass below).

**Out of scope (B/C/D — do NOT build, TODOs only):** monitoring ingest, Jira
ticketing, public bug form, per-cell ticket links, brand-target picker UI.

---

## 1. Data model — migration `024_client_library_phase_a.sql`

Idempotent (IF NOT EXISTS / DO-block enum guards / DROP POLICY IF EXISTS before
CREATE). RLS mirrors migration 009: authenticated SELECT, admin `FOR ALL` via
`public.is_admin()`.

### `directives`
```
id             uuid PK default gen_random_uuid()
project_key    text NOT NULL REFERENCES projects(jira_project_key)
title          text NOT NULL
directive_type text NOT NULL CHECK (directive_type IN
                 ('goal','trigger','site_area','audience'))
description    text
status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','archived'))
created_by     text NOT NULL          -- server-derived via getChangedBy()
created_at     timestamptz NOT NULL DEFAULT now()
updated_at     timestamptz NOT NULL DEFAULT now()
```
Indexes: `(project_key)`; partial `(status) WHERE status='active'`.

### `directive_brand_status`  (the matrix cells)
```
id           uuid PK default gen_random_uuid()
directive_id uuid NOT NULL REFERENCES directives(id) ON DELETE CASCADE
brand_id     uuid NOT NULL REFERENCES brands(id)     ON DELETE CASCADE
status       text NOT NULL DEFAULT 'todo'
               CHECK (status IN ('todo','in_progress','done','blocked','n_a'))
note         text
updated_by   text
updated_at   timestamptz NOT NULL DEFAULT now()
UNIQUE (directive_id, brand_id)
```
Indexes: `(directive_id)`; `(brand_id)`.

**RLS (both tables):** `ENABLE ROW LEVEL SECURITY`; `SELECT TO authenticated
USING (TRUE)`; `FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK
(public.is_admin())`.

No seed data.

---

## 2. Cell fan-out rule (locked — prevents the paused-brand trap)

On directive create, auto-insert one `directive_brand_status` row per **active**
brand in the directive's project:
- `is_paused = FALSE` → initial status `'todo'`
- `is_paused = TRUE`  → initial status `'n_a'`

Rationale: matrix is complete on creation (every brand visible), and paused
brands read `n_a` (not owed) so they don't inflate the outstanding count — same
paused-exclusion principle the 005.1 coverage KPIs use. No unpause-backfill
mechanism needed in Phase A; flip a cell manually if a brand returns.

**Outstanding count** per directive = cells where status ∈
{`todo`,`in_progress`,`blocked`}. `done` and `n_a` do not owe.

---

## 3. Routes — 2 admin mutation routes

Both mirror the `app/api/admin/brands/qa-config/route.ts` pattern exactly:
`createSupabaseRouteClient()` validates session → check `user_profiles.role ===
'admin' && is_active` (403 otherwise) → `supabaseAdmin` performs the write →
`changed_by` from `getChangedBy(supabase)` server-side; any client-supplied
`changed_by` ignored with a `console.warn`. One `audit_log` row per changed
field (`target_type`, `target_id`, `action`, `field_name`, `old_value`,
`new_value`, `changed_by`, `notes`).

### 3.1 `POST /api/admin/directives` — create + fan-out
Body: `{ project_key, title, directive_type, description? }`.
- Validate: project exists + active; `directive_type` in the allowed set;
  `title` non-empty.
- Insert the `directives` row.
- Fan-out per §2: fetch active brands for `project_key`, bulk-insert
  `directive_brand_status` rows.
- Audit: one row per directive field (`action='CREATE'`, `target_type=
  'directive'`, `target_id=<new id>`) + a single summary row for the fan-out
  (`field_name='directive_brand_status'`, `new_value='fanned out to N brands'`)
  — do NOT write N audit rows for the fan-out.
- Returns `{ ok:true, directive, cells_created:N }`.

### 3.2 `PATCH /api/admin/directives/status` — set one cell
Body: `{ directive_id, brand_id, status, note? }`.
- Validate `status` in the allowed set.
- Upsert the `(directive_id, brand_id)` cell (must already exist from fan-out;
  404 if not). Update `status`, `note`, `updated_by`, `updated_at`.
- Audit one row per changed field (`action='UPDATE'`, `target_type=
  'directive_brand_status'`, `target_id=<cell id>`).
- Returns `{ ok:true, changed:<n> }`; no-op when nothing changed (`changed:0`).

*(Directive edit/archive is a small follow-on, not Phase A. Leave a TODO.)*

---

## 4. Page + nav

- New route: `app/dashboard/client-library/page.tsx`. Add a nav entry in the
  dashboard layout ("Client Library", under Reports or top-level per Lacey's
  nav preference).
- **Viewable by any authenticated user** (do NOT admin-gate the URL in
  middleware — matches coverage/reports). Edit controls render only when the
  client sees `role === 'admin'`; the routes enforce it server-side regardless.
- Client component. Single fetch on load of `{ directives (active, for project),
  cells, brands }` for the selected project — mirror the coverage page's
  existing single-fetch pattern; add a read endpoint only if genuinely needed
  (RLS allows authenticated SELECT, so a direct query is fine).
- Controls: project picker (default NBLYCRO), "+ New directive" (admin only).
- Matrix: directives as rows (type pill + title), active brands as columns,
  status dot per cell, Outstanding pill per row (§2). Clicking a cell (admin)
  opens a small status/note editor → calls 3.2 → optimistic update.
- Brand resolution is trivial here — cells store `brand_id` directly (FK). No
  alias/jira_value fallback needed.
- ≥16 brands need horizontal scroll or a brand filter; the mockup caps visible
  columns with a "+N more" hint — keep the scroll container.

---

## 5. `globals.css` token pass (fold into the code commit)

The Claude Design reskin (`Client_Library.html`) is built on real F92 tokens
except for a scale layer the app lacks. Add to `app/globals.css`:

**Add to `:root` (theme-agnostic):**
```
--radius-sm: 6px;  --radius-md: 8px;  --radius-lg: 10px;
--radius-xl: 12px; --radius-2xl: 14px; --radius-3xl: 18px;
--radius-full: 9999px;
--shadow-sm: 0 1px 2px rgba(26,26,46,.06), 0 1px 3px rgba(26,26,46,.10);
--tracking-eyebrow: .16em;
--tracking-wide: .12em;
--f92-on-orange: #FFFFFF;
--f92-orange-hover: #DA6A17;
```
**Add to `:root[data-theme="dark"]`:**
```
--shadow-sm: 0 1px 2px rgba(0,0,0,.4);
--f92-orange-hover: #C05E17;   /* darker step from dark-mode --f92-orange #D4681A */
```
**Fix in the component (not globals):** the reskin's `--status-resolved-border`
and `--status-blocked-border` are misnamed — use the existing `--status-resolved`
(#22C55E) and `--status-blocked` (#EF4444). Keep blocked cells visibly RED (the
signal is load-bearing).

Component styling should live in the app's CSS approach (Tailwind + the token
vars), not a standalone `styles.css`; drop the `styles.css`/`assets/cqip-logo.svg`
external refs from the mockup when porting.

---

## 6. Tests

Repo has no test runner — use `node:test` + `node:assert/strict` via
`npx tsx --test`, mirroring `tests/errors.test.ts`. New `tests/directives.test.ts`:
1. Outstanding count = cells in {todo,in_progress,blocked}; done/n_a excluded.
2. Paused brand fan-out lands `n_a`, not `todo` (and so doesn't add to owed).
3. Status CHECK rejects an out-of-set value (validation guard).

Verification bar = clicking through the running app (create a directive → cells
fan out → set statuses → count updates), not build-green alone.

---

## 7. Process / gates / commits

- **Jenny pre-flight REQUIRED** — migration + mutation routes + new route (all
  three triggers). Build does not start until Jenny passes.
- Two-commit flow: **Commit 1** = this spec, docs-only (`paths-ignore`).
  **Commit 2** = migration 024 + the two routes + page/nav + globals token pass
  + tests, with atomic CLAUDE.md §15.5 in-flight update (r34; §16 entry is
  written on ship/push, not now).
- **Karen post-flight** after build.
- **DO NOT PUSH** — Lacey applies migration 024, smoke-tests, deploys manually.

---

## 8. Claudette prompt (ready to send after Jenny passes)

```
Batch 012 Client Library — Phase A (directive matrix MVP). Build from
docs/batch-012-client-library-phase-a-spec.md (canonical). Two commits, no push.

COMMIT 1 — docs only: land the spec doc (paths-ignore).

COMMIT 2 — code:
- Migration supabase/migrations/024_client_library_phase_a.sql: tables
  `directives` + `directive_brand_status` per spec §1, idempotent, RLS mirroring
  migration 009 (authenticated SELECT, admin FOR ALL via public.is_admin()).
- POST /api/admin/directives (create + fan-out per §2/§3.1) and
  PATCH /api/admin/directives/status (set one cell, §3.2). Mirror the
  brands/qa-config route exactly: session→admin gate, supabaseAdmin write,
  getChangedBy() server-side, ignore client changed_by with warn, audit_log
  row per changed field. Fan-out audited as ONE summary row, not N.
- Page app/dashboard/client-library/page.tsx + nav entry. Viewable by any
  authenticated user; edit affordances admin-only (server enforces). Single
  fetch mirroring the coverage page. Matrix per §4; Outstanding count per §2.
- globals.css token pass per §5 (radius scale, shadow-sm, tracking, on-orange,
  orange-hover; dark variants). Port the reskin off standalone styles.css onto
  the app's tokens; fix the two misnamed status tokens; keep blocked = red.
- tests/directives.test.ts per §6 (node:test via npx tsx --test).
- Atomic CLAUDE.md §15.5 in-flight entry (r34). §16 on ship, not now.

OUT OF SCOPE (TODOs only): monitoring ingest, Jira ticketing, public bug form,
brand-target picker, directive edit/archive UI.

Jenny already pre-flighted. DO NOT PUSH. Report back → Karen.
```
