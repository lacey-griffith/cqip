# Batch 005.5 — Reggie brand-detail drawer polish (spec)

**For:** Claudette (build) · **Author:** DC · **Date:** 2026-07-09
**Repo:** `lacey-griffith/cqip` · `cqip.l-hay.workers.dev`
**Intended repo path:** `docs/batch-005.5-brand-detail-drawer-spec.md`
**Status:** Draft for Lacey review → commit as 005.5 Commit 1 (docs-only).
**Number:** proposed 005.5 — confirm §15 before locking.
**Read order:** this spec → `components/coverage/brand-detail-drawer.tsx`.

---

## 0. One-line
Read-only polish on the **Reggie** all-user brand-detail drawer (the one opened by
clicking a brand *name*, with the "View Brand Wellness" CTA, 6-month bars, KPI cards,
and recent-ticket list). Three tweaks from Lacey's 2026-07-09 review. **No migration,
no route, no new mutation surface, no Jenny.**

## 1. Dependency + adjacency (read before building)
- **Depends on 005.4** for #1: the 12-month series `row.monthly12` is added in 005.4.
  Build 005.5 **after** 005.4 lands `monthly12` (or confirm the field exists). Do not
  duplicate the 12-month aggregator — reuse `monthly12`.
- **Adjacency (not blocking):** a deferred 005.2 item re-homes this drawer's content
  into the ledger accordion + moves the Brand Wellness CTA (its own later batch). 005.5
  polishes the drawer as-is; keep the changes self-contained so that later fold-in stays
  cheap. Do NOT start the fold-in here.

## 2. LOCKED changes

Wire to existing drawer data; tokens only, no inline hex.

### #1 — "LAST 6 MONTHS" → a range dropdown (6 / 12 months)
Replace the static "LAST 6 MONTHS" label above the bar chart with a small dropdown:
**"Last 6 Months"** (default) / **"Last 12 Months."**
- 6-month view reads `row.monthly` (unchanged); 12-month view reads `row.monthly12`
  (from 005.4). Alternatively, if the drawer receives the full 12-month series, the
  6-view is `monthly12.slice(-6)` — Claudette picks whichever is cleaner given how the
  drawer gets its data.
- Local drawer state; default 6. The bar chart re-renders to the selected range; axis
  labels follow.

### #2 — click a month bar → scope the ticket list to that month
Today the list below is "TESTS IN LAST 28 DAYS." Make each **bar clickable**: clicking a
month filters the list to that month's non-deleted milestones (date · ticket [Jira
link] · source), and the list header changes to "TESTS IN {Month YYYY} (N)."
- A clear affordance returns to the default 28-day view (click the active bar again, or
  a small "← last 28 days" reset). Selected bar reads as selected (highlight/outline via
  token).
- Client-side filter over data the drawer already holds — **no new fetch**, read-only.
- Empty month → "No tests in {Month YYYY}."

### #3 — drop the THIS MONTH KPI (4 cards → 3)
Remove the **THIS MONTH** card. Keep **This Week**, **Last Week**, **Rolling 28D**.
- Rationale: Rolling 28D is the canonical drought window *and* the current month is
  already visible in the bar chart, so THIS MONTH duplicated both. This Week + Last Week
  stay as a momentum pair (This Week alone loses the trend read).
- Re-flow the card grid to 3 (even row, no orphaned cell).

### #4 — RIDE-ALONG: remove the redundant Filter-by-brand control (admin drawer)
Trivial admin cleanup folded in here (both are read-only drawer work). In the admin
"Manage —" drawer (`brand-admin-drawer.tsx`), remove the **Filter-by-brand** control on
the Milestones tab — the drawer is already scoped to a single brand, so the filter is
redundant; the milestone list always shows the current brand.
- Read-only (a display filter over an existing list); no mutation-surface change → no
  Jenny for this item.
- **Do NOT touch the QA-URL-pattern editor** — that removal is on HOLD (AC gate RED; it's
  the only writer for the config). Leave the editor and column exactly as they are.

## 3. Files touched
- `components/coverage/brand-detail-drawer.tsx` — #1/#2/#3.
- `components/coverage/brand-admin-drawer.tsx` — #4 (remove the Filter-by-brand control only).
- Possibly the drawer's bar-chart subcomponent (if separate) — #1/#2.
- No `lib` change (reuses 005.4's `monthly12`); no `globals.css`, route, or migration.

## 4. Explicitly NOT in scope
- Admin QA-URL-pattern editor — **HOLD** (AC gate RED; keep editor + column). #4 above
  removes ONLY the redundant Filter-by-brand control, nothing else in the admin drawer.
- The add-milestone form — with Claude Design.
- The Reggie→accordion fold-in / BW CTA re-home (deferred 005.2 item, its own batch).
- No rework overlay, export, or multi-brand compare (Brand Wellness v2 territory).

## 5. Process
- **No Jenny** — read-only render/interaction on an all-user drawer; no mutation, route,
  or migration.
- Commits: spec (docs-only, §15.5 in-flight r34) → build (atomic `CLAUDE.md`). Version:
  no bump (render/interaction only) unless a reason appears.
- `tsc` clean, build green, ESLint zero new.
- **DO NOT PUSH.** Karen → Lacey smokes both themes → Lacey pushes → on-ship reconcile
  (§15.5 → §16, r34).

## 6. Smoke (Lacey, post-Karen)
- Range dropdown toggles the bars between 6 and 12 months; 12-month view shows the fuller
  growth shape; default is 6.
- Clicking a month bar scopes the list to that month (header + count update); reset
  returns to the 28-day default; selected bar reads selected.
- KPI row shows 3 cards (This Week / Last Week / Rolling 28D); no THIS MONTH; grid
  re-flows cleanly.
- Admin "Manage —" drawer: Filter-by-brand control gone (list still shows the current
  brand); QA-URL editor + column untouched.
- Both themes clean; BW CTA still present and working.

---

## 7. Claudette prompt (ready to send)
```
Batch 005.5 — Reggie brand-detail drawer polish (components/coverage/brand-detail-
drawer.tsx). Read-only render/interaction on the all-user brand drawer (brand-name
click; has the View Brand Wellness CTA, 6-month bars, KPI cards, recent-ticket list).
No migration, no route, no new mutation surface, no Jenny. Canonical spec:
docs/batch-005.5-brand-detail-drawer-spec.md.

DEPENDENCY: #1 uses row.monthly12 (12-month series) added in Batch 005.4 — build this
after 005.4 lands it; reuse it, don't re-aggregate.

COMMIT 1 — docs: save the spec; CLAUDE.md §15.5 in-flight entry (r34) + §15 pointer.

COMMIT 2 — build
- #1 Replace the static "LAST 6 MONTHS" label above the bars with a dropdown: "Last 6
  Months" (default) / "Last 12 Months". 6 reads row.monthly, 12 reads row.monthly12
  (or slice monthly12[-6:] for the 6-view — your call by how the drawer gets data).
  Local state, default 6; bars + axis re-render to the range.
- #2 Make each month bar clickable: clicking scopes the list below from "last 28 days"
  to that month's non-deleted milestones (date · ticket jira link · source); header →
  "TESTS IN {Month YYYY} (N)". Provide a reset to the 28-day default (re-click active
  bar or a small reset control); selected bar reads selected (token highlight). Empty
  month → "No tests in {Month YYYY}." Client-side filter over data already in the
  drawer — no new fetch.
- #3 Remove the THIS MONTH KPI card; keep This Week, Last Week, Rolling 28D; re-flow the
  grid to 3 (no orphaned cell).
- #4 RIDE-ALONG (components/coverage/brand-admin-drawer.tsx): remove the redundant
  Filter-by-brand control on the Milestones tab (drawer is already brand-scoped). Read-
  only, no Jenny. DO NOT touch the QA-URL-pattern editor — it's on HOLD (AC gate RED,
  only writer for the config); leave editor + column intact.

Tokens only, no hex. Atomic CLAUDE.md per r23. Version: no bump unless you see a reason.
tsc clean, build green, ESLint zero new. Separate commits. DO NOT PUSH. Report → Karen.
```
