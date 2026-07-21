# Batch 012 — Pulse: inline directive editing (kill both modals) — SPEC

**Author:** DC · **Date:** 2026-07-21 · **Repo:** `lacey-griffith/cqip`
**Status:** DRAFT → Claudette build (no Jenny — see §5)
**Canonical on ship:** CLAUDE.md §15/§16.
**Sequencing:** builds on `main` AFTER the E1 follow-on (`0da2a57`) is pushed —
same file (`app/dashboard/pulse/page.tsx`), so branch from the pushed HEAD.

---

## 0. Done definition (do not expand mid-build)

- Both modals on the matrix page are gone: the "+ New directive" create dialog
  and the click-a-dot cell editor. Both become inline (no overlay).
- **Create** = a pinned inline strip at the top of the matrix, collapsed behind
  the existing "+ New directive" button, expanding in place.
- **Cell edit** = a single-row inline expansion strip spanning the full table
  width directly under the directive's row; one open at a time; re-click the
  open dot (or Cancel / Esc) collapses.
- Same API routes (`POST /api/admin/directives`,
  `PATCH /api/admin/directives/status`), no schema, no new route.
- All existing semantics preserved exactly: n_a hollow dots with no cell stay
  non-interactive; Outstanding recompute; paused brand columns; sticky left
  column; horizontal scroll for ≥16 brands; view-for-all with admin-only edit
  affordances (routes enforce admin server-side regardless).

**Out of scope:** the row-expansion strip is the **E3 surface** — built minimal
here (status + note), enriched later with comments / timeline / lifecycle dates.
No Jira ticketing (C), no bug form (D), no schema change.

---

## 1. Inline create (admin only)

- Remove `CreateDirectiveDialog`. The header "+ New directive" button becomes a
  toggle (`aria-expanded`, label flips to "Close").
- When open, render an inline form as a **pinned strip at the top of the matrix
  Card, above the horizontal-scroll region** so it never scrolls out of view —
  this realizes the "pinned / sticky-left" intent without the colSpan+sticky+
  scroll fragility of an in-table row. No overlay.
- Fields: title (input, autofocus), type (`DIRECTIVE_TYPES` select), optional
  description (input), Add + Cancel. Mounted fresh on open, so `useState`
  initializers reset the fields — no seeding effect.
- Reuse `POST /api/admin/directives` unchanged. On success: collapse + reload
  via `loadProject(projectKey)`. Keep the existing toast handling
  (`fanOutError` / `auditError` / success cell count). Esc collapses.
- The matrix Card must render when `createOpen` even with zero directives (so
  the form shows); the standalone empty-state Card shows only when
  `directives.length === 0 && !createOpen`.

## 2. Inline cell edit — row expansion (admin only)

- Remove `EditCellDialog`. Replace `editCell` state with
  `expandedCell: { directiveId, brandId } | null` (one open at a time).
- Clicking an editable dot toggles: same dot again → collapse; another dot →
  move the expansion. n_a hollow dots with **no cell** stay non-interactive
  (only real cells set `expandedCell`).
- Render the editor as a second `<tr>` after the directive's row, one
  `<td colSpan={brands.length + 2}>`, with the strip in a `sticky left-0`
  inner container so it stays visible when a ≥16-brand row is scrolled right.
- The strip (`CellEditStrip`, keyed by `cell.id` → fresh mount per cell, so
  `useState` seeds from the cell — no seeding effect) shows: brand name +
  directive title, a status control (`CELL_STATUSES`), a note textarea, and
  Save / Cancel.
- Save via `PATCH /api/admin/directives/status` unchanged. **Optimistic update +
  reconcile-on-error**, mirroring `handleFindingStatus`: update the cell in
  local state (dot + Outstanding recompute immediately) and collapse, then
  PATCH; on failure `loadProject` to reconcile. Keep existing toasts (Updated /
  No changes / audit warning).
- **Keyboard/a11y:** the dot is a real `<button>` with `aria-expanded`; the
  strip's controls are focusable; focus moves into the strip on open (ref focus,
  not setState); Esc collapses; the strip has an `aria-label`.
- **E3 seam:** the expansion container is what E3 enriches — build it so E3
  extends it, don't rebuild.

## 3. Preserved semantics (regression checklist)

n_a-no-cell non-interactive · Outstanding recompute (now also on the optimistic
local update) · paused brand columns · sticky left directive column · horizontal
scroll for ≥16 brands · admin-only affordances, server-enforced.

## 4. Tests

No new pure function (this is UI + fetch), so the existing suite is unchanged:
`tests/pulse-shell.test.ts` + `tests/directives.test.ts` +
`tests/monitoring-findings.test.ts` stay green (17/17). **The real
verification bar is Lacey clicking through the running app** — create a
directive inline; edit a cell (status + note) and watch the dot + Outstanding
update optimistically; re-click to collapse; Esc; a paused-brand column; a
≥16-brand horizontal scroll with the editor open. Build-green is necessary, not
sufficient.

## 5. Process / gates / commits

- **No Jenny** — render/interaction only; no migration, no new mutation route,
  no new page route, no schema change (reuses the two existing admin routes).
  Mirrors the E-track gate profile.
- **No version bump** (render/interaction) — per §13 r23.
- Two commits, docs-then-code. Atomic CLAUDE.md §15.5 in-flight entry.
- **Karen post-flight.** **DO NOT PUSH** — Lacey clicks through + deploys.
