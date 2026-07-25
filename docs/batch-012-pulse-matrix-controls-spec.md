# Batch 012 — Pulse: directive matrix controls (search · status filter · sort · hide paused) — SPEC

**Author:** DC · **Date:** 2026-07-25 · **Repo:** `lacey-griffith/cqip`
**Status:** DRAFT → Claudette build (no Jenny — see §9)
**Canonical on ship:** CLAUDE.md §15/§16.
**Sequencing:** builds on `main` at/after the pushed brand-page inline-editing
batch (`28f2faf`, an ancestor of current `main`) — same file
(`app/dashboard/pulse/page.tsx`), so branch from that HEAD or later. Current
`main` (`2308d95`) is a superset: `28f2faf` plus the brand-page MEDIUM folds,
the §15.5→§16 reconcile, and three data-only reconciliation-CSV commits. None
touch the matrix render path, so building on current `main` is safe and is what
this batch does.

---

## 0. Done definition (do not expand mid-build)

The NBLYCRO matrix holds **69 active directives × 16 brands = 1,104 cells**
(verified against prod 2026-07-25, zero gaps) and is post-backfill. It needs
find / filter / sort to stay usable, plus a way to drop paused-brand columns.

Four controls on the matrix page, **all client-side over already-loaded data**:

1. **Search** — live, case-insensitive filter on directive title.
2. **Status filter** — a single control (`Open` default / `Resolved` / `All`)
   driven by a *derived* per-directive resolve state, never a stored flag.
3. **Hide paused brands** — a toggle that removes paused brand **columns**.
4. **Sort** — Title (A–Z, default) or Outstanding (high→low).

All four **compose**. Empty result → a clean "no directives match" state.

**No migration · no route · no schema · no new fetch · no new mutation
surface.** Render/interaction only.

**Out of scope:**
- The **left-nav client list** (`components/layout/pulse-client-nav.tsx`) is
  **not touched**. Whether paused *clients* should be hidden from the nav is a
  separate, undecided question (Lacey 2026-07-25: "open to consider"). Do not
  fold it in.
- Persisting control state (see §6 — session-only, deliberately).
- Directive edit/archive UI, Phase C ticketing, Phase D bug form, E2/E3.

---

## 1. Search

- Single text input. Filters `directive.title` only (not description, not type)
  — the ask is find-by-name.
- **Case-insensitive substring** match. Query is trimmed; an empty/whitespace
  query matches everything (no filtering).
- A **clear affordance** (visible button when the query is non-empty) resets it.
- Live — filters on every keystroke. No debounce: the data is already in memory
  and 69 rows is trivial to re-derive.

## 2. Status filter — derived resolve semantics

The three-way resolve state is computed from **live cell data** for each
directive. There is no `resolved` column and this batch does not add one.

```
Outstanding > 0                    -> active
Outstanding == 0 AND Done >= 1     -> resolved
Outstanding == 0 AND Done == 0     -> unstarted   (empty / not-yet-started)
```

- **Outstanding** reuses `outstandingCount()` from
  `lib/client-library/directives.ts` — cells in `todo` / `in_progress` /
  `blocked` (`OWED_CELL_STATUSES`). `done` and `n_a` do not owe. One definition,
  already shared by both admin routes; this batch does not fork it.
- **Done** = cells with status exactly `done`.
- A directive with **zero cells** falls out as `unstarted` (outstanding 0,
  done 0) — that is correct and intended.

**Filter options:**

| Option | Shows |
|---|---|
| `Open` **(default)** | everything **not** `resolved` — i.e. `active` **and** `unstarted` |
| `Resolved` | `resolved` only |
| `All` | everything |

### 2.1 The verbatim guard — unstarted MUST stay visible under "Open"

> **`Open` is defined as NOT-resolved, never as "active".**
> An `unstarted` directive (outstanding 0, done 0 — e.g. a placeholder such as
> `[GTM] Submits Lead Combined`, or a directive whose every cell is `n_a`, or
> one with no cells at all) **must remain visible under `Open`**. It has work
> outstanding in the real world even though no cell owes it yet; hiding it
> behind the default filter would make it invisible to the people who need to
> start it.

Implement the predicate as `state !== 'resolved'` — **not** `state === 'active'`.
That is the guard: the negative form cannot silently drop a third state, and a
future fourth state would default to visible rather than hidden.

**Provenance note (honest):** the batch directive cites
`docs/HANDOFF-goal-directives-load.md §7` for these semantics. **That file does
not exist in this repo and never has** (`git log --all --diff-filter=A` on the
path returns nothing); `docs/batch-012-convert-reconciliation-spec.md` §1 cites
the same handoff's §5 for the audit-trail requirement, so the document is real
but external / uncommitted. The semantics above are therefore transcribed from
the batch directive verbatim rather than quoted from a repo artifact. If the
handoff is ever committed, re-check this section against it.

## 3. Hide paused brands (new — Lacey 2026-07-25)

- A toggle, **default OFF = paused brands SHOWN** (preserves today's behavior
  exactly; opting in is the user's choice, the same posture as Coverage's
  `showPaused`).
- When ON, paused brands' **columns are removed entirely** — header cell and
  every body cell — reducing the horizontal scroll.
- `is_paused` is read **live from the loaded brand rows**. Brand codes are
  **never hardcoded** (today's paused set is MRR-CA / SHG / WDG, verified
  against prod 2026-07-25 — but that is data, not a constant).
- The editor row's `colSpan` must track the **visible** brand count.

### 3.1 Outstanding must not change when the toggle flips

The displayed Outstanding pill is computed from **all** of a directive's cells
and is **structurally independent** of which columns are visible — the
hide-paused flag is not an input to the count. This is guaranteed by
construction, not by convention: the count comes from the full `cells` array,
and the column filter is applied only to the brand list used for rendering.

**Confirmed against prod, not assumed (2026-07-25):** all **207** paused-brand
cells (3 paused brands × 69 directives) are `n_a`, and **zero** paused-brand
cells hold an owed status. So the page subtitle's claim ("Outstanding counts
exclude paused brands") is true on live data today, and flipping the toggle
changes no number on screen. This toggle is **purely visual column reduction,
not a data change.**

> Note for future work: paused-exclusivity holds *because* fan-out assigns
> paused brands `n_a` (`initialCellStatus`) and nothing has since edited one to
> an owed status. It is not enforced by a constraint — a brand paused *after* a
> directive was created keeps whatever status its cell had. If that ever
> happens, the Outstanding pill would legitimately include a hidden column's
> cell. Deliberately **not** "fixed" here: silently excluding paused brands from
> the count would change reported data, which is out of scope for a render batch.

## 4. Sort

- **Title (A–Z)** — default, `localeCompare`.
- **Outstanding (high→low)** — descending numeric.
- **Ties break by title (A–Z)** in both modes, so ordering is fully
  deterministic and does not depend on `Array.prototype.sort` stability or on
  the incoming `created_at` order.
- Sorting applies to the *filtered* set (§5).

## 5. Compose

Order of operations, one pure entry point:

```
group cells by directive_id
  -> classify each directive (outstanding + resolve state)
  -> filter: search AND status
  -> sort: sortKey, tie-break title
```

Brand-column filtering (§3) is a **separate, orthogonal** transform on the
brand list — never mixed into the row pipeline, so it cannot influence
Outstanding.

**Empty result** → a clean in-Card state: "No directives match these filters."
Distinct from the existing "No active directives for {project}" state, which
means the project genuinely has none. Both must remain reachable.

## 6. Preserved semantics (regression checklist)

Inline create strip · row-expansion cell editor (the E3 seam) · sticky left
directive column · horizontal scroll for ≥16 brands · `n_a`-with-no-cell dots
non-interactive · Outstanding recompute (incl. the optimistic path) · paused
column styling when shown · view-for-all with admin-only edit affordances
(routes + RLS enforce admin server-side regardless).

- Controls are **session-only React state — no `sessionStorage`, no
  `localStorage`, no URL params.** Reset on reload is explicitly fine. (This
  diverges from `ProjectBrandFilter`'s persistence on purpose: these are
  transient find-and-scan controls, and adding a fourth persisted key is scope
  this batch does not need.)
- An open cell editor whose directive is filtered out simply stops rendering
  (the editor row renders inside the row's `Fragment`). Collapse `expandedCell`
  on project change as today; **also** collapse it when the visible row set
  stops containing it is *not* required — the guarded render already makes it
  inert, matching how the project-switch guard already behaves.

## 7. Pure logic + tests

New module `lib/client-library/matrix-controls.ts` (mirrors the
`directives.ts` / `pulse.ts` / `monitoring.ts` split — logic in `lib`,
page/tests import it). Exports:

- `DIRECTIVE_RESOLVE_STATES` + `DirectiveResolveState`
- `MATRIX_STATUS_FILTERS` + `MatrixStatusFilter`, `MATRIX_SORT_KEYS` + `MatrixSortKey`
- `classifyDirectiveCells(cells)` → the 3-way resolve state (§2)
- `matchesStatusFilter(state, filter)` → the verbatim guard (§2.1)
- `matchesSearch(title, query)` → §1
- `visibleMatrixBrands(brands, hidePaused)` → §3 (generic over the brand row)
- `buildMatrixRows(directives, cells, controls)` → §5 compose; each row carries
  `{ directive, outstanding, resolveState }` so the page renders the pill from
  the row and **cannot** compute Outstanding a second, divergent way.

`tests/matrix-controls.test.ts` covers, at minimum:

1. `classifyDirectiveCells` — all three states, incl. **zero cells → unstarted**
   and **all-`n_a` → unstarted**.
2. `matchesStatusFilter` — every (state × filter) pair, with an explicit case
   asserting **`unstarted` is visible under `Open`** (the guard).
3. `matchesSearch` — case-insensitivity, substring, trim, empty-matches-all.
4. `visibleMatrixBrands` — paused dropped when ON, all kept when OFF, and that
   it does not mutate the input.
5. Sort — title A–Z; outstanding high→low; **tie-break by title** in both.
6. **Compose** — search + status + sort together on one fixture.
7. **Outstanding independence** — a paused brand's owed cell still counts toward
   `row.outstanding`, and filtering the brand columns does not change it
   (pins §3.1 structurally).

**The real verification bar is Lacey clicking through the running app.**
Build-green is necessary, not sufficient. Click list: type a partial title;
clear it; flip to `Resolved` (expect ~19 of 69 on NBLYCRO today) and back to
`Open` (expect ~50); toggle hide-paused and confirm **3 columns disappear and
no Outstanding number changes**; sort by Outstanding; combine search + hide-paused
+ sort; open the cell editor and confirm it still spans the table correctly with
paused columns hidden; confirm inline create still works.

> **Known latency in click-verification:** prod currently has **0 unstarted**
> directives (50 active / 19 resolved / 0 unstarted, measured 2026-07-25), so
> the §2.1 guard is **defensive and cannot be observed by clicking today**. It
> is pinned by test 2 instead. Do not "simplify" `!== 'resolved'` to
> `=== 'active'` on the grounds that it makes no visible difference — it will,
> the first time an all-`n_a` or cell-less directive exists.

## 8. Explicitly NOT in this batch

- `pulse-client-nav.tsx` (paused *clients* in the nav) — undecided, separate.
- Persisting control state across reloads / URL-shareable filters.
- Filtering or sorting the **brand** axis beyond the paused toggle.
- Any change to what Outstanding counts (§3.1 note).
- Server-side search/pagination — 69 rows does not need it. Revisit if a project
  ever crosses a few hundred directives (cf. §15 item 5.18's `.range()` lesson).

## 9. Process / gates / commits

- **No Jenny** — render/interaction only: no migration, no schema change, no new
  route, no new mutation surface, no new fetch. Same gate profile as the E-track
  render batches (E1, the client-nav follow-on, inline editing).
- **No version bump** — per §13 r23 (render/interaction only).
- `tsc --noEmit` clean · `npm run build` green · full test suite green · ESLint
  zero findings on every changed/new file.
- Two commits, **docs-then-code**. Atomic CLAUDE.md §15.5 in-flight entry.
- **Karen post-flight.** **DO NOT PUSH** — Lacey clicks through, then pushes.
