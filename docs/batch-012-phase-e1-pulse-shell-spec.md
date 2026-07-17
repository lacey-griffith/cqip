# Batch 012 — Phase E1 (Pulse Shell: rename + brand pages + nav) — SPEC

**Author:** DC · **Date:** 2026-07-17 · **Repo:** `lacey-griffith/cqip`
**Status:** DRAFT → Claudette build (Jenny-light — see §6)
**Canonical on ship:** CLAUDE.md §15/§16.

---

## 0. Done definition (do not expand mid-build)

- "Client Library" is renamed **Pulse** everywhere users see it (nav label, page
  title/eyebrow, headings).
- Route moves `/dashboard/client-library` → `/dashboard/pulse`; the old path
  redirects; no dead links anywhere in the app.
- **Pulse main page** = the existing directive matrix, unchanged in content.
- **Contextual client nav:** while the user is anywhere under `/dashboard/pulse`,
  a client list appears in the side nav — active brands as links, paused brands
  greyed but still linked. App nav is otherwise unchanged.
- **Brand page** exists for every active AND paused brand: shows the brand's
  directives (filtered, read-only display) + a placeholder Convert-config section
  (empty; E2 fills it) + clean empty states.
- View-for-all; no new write surface in E1 (directive editing stays on the
  matrix via the existing PATCH route).

**Out of scope (later phases — placeholders/TODOs only):** Convert config sync
(E2), rich/expandable directive rows with comments + lifecycle dates (E3),
ticketing (C), bug form (D). No schema change in E1.

---

## 1. Rename — "Client Library" → "Pulse"

- Nav entry label (under Reports) → **Pulse**.
- Page eyebrow/title/headings on the main page → Pulse (keep "Directive Matrix"
  as the sub-title if desired; the *area* is Pulse, the main view is the matrix).
- Grep the repo for user-facing "Client Library" strings and swap them. Leave
  internal identifiers that aren't user-facing alone unless they're trivially
  co-renamed without risk.
- **API routes do NOT rename** — `/api/admin/directives`, `/api/monitoring/*`
  are named by concern, not by page. Untouched.

## 2. Route rename + redirect

- Move the page dir `app/dashboard/client-library` → `app/dashboard/pulse`.
- Add a redirect from `/dashboard/client-library` (and any sub-path) →
  `/dashboard/pulse` so bookmarks/links don't 404. Use the app's existing
  redirect approach (next.config redirect or a small redirecting page).
- Fix every internal link/ref to the old path (nav config, any `href`, any
  `router.push`). Grep `client-library` to find them all.
- Do the rename + redirect as a clean, self-contained part of the commit.

## 3. Brand page — `app/dashboard/pulse/[projectKey]/[brandCode]/page.tsx`

URL mirrors the existing `/api/brands/[projectKey]/[brandCode]` structure so
brand pages are deep-linkable and project-safe (brand_code isn't guaranteed
unique across projects). *(Alt: `/dashboard/pulse/[brandCode]` resolved within
the selected project — simpler, less robust. Recommend the projectKey form.)*

Contents (all read-only in E1):
- **Header:** brand display name + code, project, paused badge if paused.
- **Directives section:** the directives for this project, showing THIS brand's
  status + note per directive (filtered view of the same directive dataset the
  matrix uses — one source, not a per-brand copy). Newest/active first.
  Empty state: "No directives yet for this brand."
- **Convert config section:** a framed placeholder — "Convert configuration will
  sync here" (E2). Present but empty, so the page shape is real now.
- Reuse the matrix's existing per-project fetch; filter to the brand client-side
  (RLS already allows authenticated SELECT — no new read endpoint needed).

## 4. Contextual client nav

- When the route is under `/dashboard/pulse`, render a client list in the side
  nav (below or within the existing nav — match the app's nav component).
- List = brands for the **selected/!current project**, `is_active = true` and
  paused, each linking to its brand page. Sort sensibly (alpha by code or
  display name).
- **Paused brands greyed but still linked** (the page exists even if empty).
- Outside `/dashboard/pulse`, the nav is unchanged (no client list).
- Which project the list reflects: on the main page, the project picker; on a
  brand page, the `projectKey` in the URL.

## 5. Tests

E1 is render/routing — pure-logic tests are thin. At minimum
`tests/pulse-shell.test.ts`:
1. Brand-directive filter returns only the target brand's cells for a directive
   set (the filtered view is correct).
2. Client-nav list includes paused brands (greyed) and excludes inactive.

Verification bar = the running app: nav shows clients under Pulse, a brand page
loads for an active brand and a paused brand, empty states render, old
`/client-library` URL redirects.

## 6. Process / gates / commits

- **Jenny: not required** by the migration/mutation triggers — E1 is a rename +
  read-only render + new read-only page routes, no migration, no new mutation
  route (per the "not required for read-only render work" rule). New *routes*
  exist, so if Jenny wants a courtesy look, fine, but it's not a gated
  pre-flight. **Confirm with Lacey/Jenny before build if unsure.**
- Two-commit flow: **Commit 1** = this spec, docs-only. **Commit 2** = rename +
  route move/redirect + brand page + client nav + tests + atomic CLAUDE.md
  §15.5 (§16 on ship).
- **Karen post-flight.**
- **DO NOT PUSH** — Lacey smoke-tests, deploys.

**Downstream coupling:** the Convert-config placeholder (§3) is where E2 renders
synced Convert data; the brand-directives section is where E3 swaps read-only
rows for expandable comment/timeline rows. Build both sections as clean seams so
E2/E3 slot in without reworking the shell.

## 7. Claudette prompt (ready to send)

```
Batch 012 — Phase E1 (Pulse shell: rename + brand pages + nav). Build from
docs/batch-012-phase-e1-pulse-shell-spec.md (canonical). Two commits, no push.
Render/routing only — NO migration, NO new mutation route.

COMMIT 1 — docs only: land the spec doc (paths-ignore).

COMMIT 2 — code:
- Rename user-facing "Client Library" → "Pulse" (nav label, page title/eyebrow,
  headings). Grep for user-facing strings. API routes untouched.
- Move app/dashboard/client-library → app/dashboard/pulse; redirect the old path
  (+ sub-paths) to /dashboard/pulse; fix all internal links (grep client-library).
- Brand page app/dashboard/pulse/[projectKey]/[brandCode]/page.tsx: header
  (name/code/project/paused badge), this-brand-filtered directives (read-only,
  one source — filter the matrix's existing per-project fetch), and an empty
  "Convert config will sync here" placeholder section. Clean empty states.
- Contextual client nav: when route is under /dashboard/pulse, show a client
  list in the side nav — active brands linked, paused greyed-but-linked, scoped
  to the current project. Unchanged elsewhere.
- tests/pulse-shell.test.ts per §5.
- Atomic CLAUDE.md §15.5 in-flight (§16 on ship).

OUT OF SCOPE (placeholders/TODOs only): Convert config sync (E2), expandable
directive rows w/ comments+dates (E3), ticketing, bug form. No schema change.

No Jenny gate (read-only render + rename; confirm if unsure). DO NOT PUSH.
Report back → Karen.
```
