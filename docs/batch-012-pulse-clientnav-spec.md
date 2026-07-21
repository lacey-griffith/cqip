# Batch 012 — Pulse E1 follow-on: cross-project client nav — SPEC

**Author:** DC · **Date:** 2026-07-21 · **Repo:** `lacey-griffith/cqip`
**Status:** DRAFT → Claudette build (no Jenny — see §6)
**Canonical on ship:** CLAUDE.md §15/§16.

---

## 0. Done definition (do not expand mid-build)

- The Pulse side-nav client list shows **every active client across all
  projects**, not just the currently-picked project's brands.
- **Single-brand clients** (e.g. SPL/SPLCRO, and any future Sonrava/ADM once
  onboarded) appear as **one collapsed entry** under the client name, linking
  straight to that client's brand page — no project-picker switch required.
- **Multi-brand clients** (e.g. NBLYCRO) render a group: a header (the client
  name, which opens the matrix scoped to that client via the existing
  `pulse:project` handoff) + the client's brands underneath.
- Paused brands stay **greyed-but-linked**; inactive projects/brands excluded.
- Active-brand-page highlight preserved.
- Render/nav only — **no page build, no new page route, no migration, no new
  mutation route, no schema change.** The per-brand page is already generic and
  unchanged.

**Why:** E1 shipped a project-scoped nav that defaults to NBLYCRO, so
single-brand clients were undiscoverable without switching the picker. This is
purely a nav-discoverability fix.

---

## 1. Locked decisions

- **Cross-project client list.** Drop E1's single-project fetch/scoping. The nav
  fetches ALL active projects + ALL active brands and renders every client.
- **Single-brand collapse keyed on `projects.brand_model`** (migration 019:
  `'single_brand' | 'multi_brand'`), NOT on a brand count. `single_brand` →
  one collapsed entry under the client's `display_name`; `multi_brand` → header
  + brands. A project with zero active brands is skipped (nothing to link).
- **Logic in the pure lib layer.** All grouping/sort/collapse logic goes in a
  new pure `toClientNavGroups(projects, brands)` in
  `lib/client-library/pulse.ts`, returning an ordered, render-ready structure
  (groups alpha by project display name; brands alpha by display name; each node
  carries `projectKey` + `brandCode` so the renderer builds hrefs with no
  further logic). The nav is **reorganized to the top in a later batch** — keep
  the presentation thin so that reorg only re-skins the renderer, not the logic.
- **Reuse the existing project handoff — do NOT invent a new mechanism.** The
  `pulse:project` sessionStorage key + CustomEvent + `broadcastPulseProject`
  currently live privately in `app/dashboard/pulse/page.tsx`. Extract them
  verbatim into a shared client-side module
  `lib/client-library/pulse-project-channel.ts` (NOT pure — it touches
  window/sessionStorage — so it sits beside `pulse.ts`, not in it) so the page,
  the nav, and the brand page all import ONE definition. Behavior is identical;
  this only relocates the single source and removes the nav's
  "keep-in-sync" duplicated constants.
- **`toClientNavItems` (E1's flat per-project helper) is removed** — it is
  superseded by `toClientNavGroups` and, after this rework, has no app caller;
  keeping it would be a dead export. Its tested behavior (active-only, paused
  kept + flagged, alpha sort) is preserved by the group tests.
- **Observation-B ride-along** (Karen E1): on the brand page, broadcast the
  URL's `projectKey` on mount (an effect calling `broadcastPulseProject` — a
  side effect, not setState) so returning via "← Pulse" opens the matrix on the
  deep-linked brand's client, and the cross-project nav highlight is consistent.

---

## 2. Pure function — `lib/client-library/pulse.ts`

`toClientNavGroups(projects, brands)`:
- Inputs: active-project rows (`jira_project_key`, `display_name`,
  `brand_model`, `is_active`) + brand rows (`project_key`, `brand_code`,
  `display_name`, `is_active`, `is_paused`).
- Filters inactive projects/brands out. Groups active brands by `project_key`.
- Emits one node per active project **that has ≥1 active brand**, ordered alpha
  by project `display_name`:
  - `single_brand` → `{ kind: 'single', projectKey, label: <project display>,
    entry: <the brand> }`.
  - `multi_brand` → `{ kind: 'multi', projectKey, label: <project display>,
    brands: [<entries, alpha by display>] }`.
- Each brand entry: `{ projectKey, brandCode, displayName, paused }`.

## 3. Renderer — `components/layout/pulse-client-nav.tsx`

- Renders only under `/dashboard/pulse` (keep `isUnderPulse`).
- Fetch all active projects + all active brands (mirror the matrix page query
  patterns; RLS allows authenticated SELECT). All `setState` after the await,
  `cancelled` guard — keep E1's no-set-state-in-effect discipline.
- Multi-brand group header = a `Link` to `/dashboard/pulse` with
  `onClick={() => broadcastPulseProject(projectKey)}` so the matrix opens scoped
  to that client (sessionStorage carries across the navigation; the page seeds
  its initial pick from it).
- Brand + single-client entries = `Link` to
  `/dashboard/pulse/<projectKey>/<brandCode>`.
- Paused = greyed-but-linked; active highlight = `pathname === href`.

## 4. Brand page ride-along — `app/dashboard/pulse/[projectKey]/[brandCode]/page.tsx`

- Add `useEffect(() => { broadcastPulseProject(projectKey); }, [projectKey])`.
  Side effect only; imported from the channel module.

## 5. Tests — `tests/pulse-shell.test.ts`

Replace the `toClientNavItems` cases with `toClientNavGroups` cases:
- multi-brand grouping (header + brands, brands alpha),
- single-brand collapse (one entry, client display name, links to the brand),
- alpha sort of groups by project display name,
- paused kept + flagged / inactive brand dropped / inactive project dropped,
- project with zero active brands skipped,
- empty set → `[]`.
Keep the existing `brandDirectiveView` / `cellsForBrand` cases.

## 6. Process / gates / commits

- **No Jenny** — mirrors E1's gate profile (rename/render/nav only; no
  migration, no new mutation route, no new page route, no schema change).
- **No version bump** (render/nav only, mirrors E1) — per §13 r23.
- Two commits, docs-then-code. Atomic CLAUDE.md §15.5 in-flight entry + §15
  E-track note. **DO NOT PUSH** — Karen post-flight, then Lacey smoke + deploy.
- tsc clean, build green, tests pass, ESLint zero NEW findings.

**Downstream:** the future top-nav reorg re-skins the renderer only; the
`toClientNavGroups` structure + the channel module are the stable seams.
