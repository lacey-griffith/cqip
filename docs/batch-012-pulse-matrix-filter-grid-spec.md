# Batch 012 — Pulse directive matrix: filter reorg + grid ergonomics

**Status:** SPEC — committed as commit 1, before the build opened (§15 PROCESS).
**Source:** `HANDOFF — Pulse directive matrix: filter reorg + grid ergonomics` (DC, 2026-08-14).
**Design reference:** `Pulse_Filters_dc.html` + two screenshots, held by Lacey. **Behaviour in
this spec is authoritative where it and the design disagree** — that is the handoff's own rule.
**Gate:** no migration · no new route · no mutation surface · no schema change → **no Jenny**.
Karen post-flight. **Do not push.**

---

## 0. Scope

Three changes to `app/dashboard/pulse/page.tsx`, one batch because they touch one file:

- **Part A** — filter bar reorganised into two labelled rows; STATUS becomes multi-select.
- **Part B** — header row and directive column pinned inside a fixed-height scroll region.
- **Part C** — clicking a brand header highlights that column, full depth.

**Directive CRUD is NOT in this batch**, including a disabled affordance. It is a mutation
route and Jenny-gated; it follows as its own batch.

---

## 1. Part A — filter bar

### A1 Layout

Two rows inside one filter shell:

```
row 1   search · STATE · STATUS
row 2   TYPE · sort · hide-paused (+ paused warning) · result count
```

Each group carries a small muted label and brightens its border + label when it holds a
non-default value. `Clear filters` appears only when something is non-default.

### A2 STATE and STATUS are different functions — do not merge or relabel

Recorded in `CLAUDE.md` §15 and enforced by tests:

- **STATE** — the derived-resolve classifier across all 16 brands of a directive.
  Single-select: Open / Resolved / All. `Open` is `state !== 'resolved'`, **never**
  `=== 'active'`, so `unstarted` directives stay visible. Rewriting that predicate fails
  7 tests. Untouched by this batch.
- **STATUS** — one cell's own status. **Multi-select**, plus an `All` that clears the set.

They sit adjacent and their labels differ by one letter. Accepted. Neither is renamed —
the names are load-bearing elsewhere.

### A3 Cell-status vocabulary, verbatim

`To do` · `In progress` · `Done` · `Blocked` · `N/A`

Guaranteed by construction, not by discipline: the STATUS control renders from
`CELL_STATUSES` + `CELL_STATUS_LABEL`, the same two exports the editor dropdown uses.
The batch DELETES `MATRIX_CELL_FILTER_LABEL`, which was a second spelling of the same
five strings and therefore a thing that could drift.

### A4 The legend stays a legend

Definitional only. **Not clickable.** The STATUS group replaces the earlier
legend-as-filter idea and does the job better (multi-select, explicit `All`, already
designed). Two controls for one function drift. This is the decision, not an oversight.

### A5 TYPE

Filters on the real `directive_type` column: Goal · Trigger · Site area · Audience · All.
Every NBLY directive is currently `goal`, so this returns everything today — expected, not
a bug. Unchanged by this batch except for its position and active-state treatment.

### A6 Result count — the quantity, stated

The design reads "87 directives". **87 is the wrong quantity for this surface.**

| | |
|---|---|
| **86** | NBLYCRO **active** directives — the per-project figure the matrix needs |
| 87 | global active (86 NBLY + 1 SPLCRO); also, coincidentally, NBLY's all-status count (86 active + 1 archived) |

The count renders `N directives in {project}` / `N of M directives in {project}`, derived
from the already-project-and-status-scoped `directives` state. Never hardcoded — the number
has moved three times in six weeks.

**"active" is deliberately NOT in the visible string.** `active` is also a derived resolve
state in the STATE group, and a different number (`openDirectives`). Writing "86 active
directives" beside a STATE group whose tabs are Open/Resolved would re-create the A6 trap in
a new form. The project name states the scope that actually disambiguates 86 from 87; the
archived half is stated by A7 when it is relevant.

### A7 Signal obligations

**Paused** — the existing `countHiddenOwedCells` amber warning + `Show paused`. Unchanged.

**Hidden-by-filter** — the existing `countHiddenByFilters` correction, kept, and now also
offered as a standing `Clear filters` control whenever anything is non-default.

**Archived — NEW, and its recorded premise is falsified.** Karen's LOW-8 recorded archiving
as *verified unreachable* on 2026-07-29: no archive writer in `app/api/`, create never sets
`status`, archive UI still a TODO. Prod now holds one `archived` directive
(`Submits Form Lead - Combined`), written by **direct SQL** — a path that audit did not
consider. `loadProject` loads `status='active'` only, so an archived directive is invisible
to matrix search and counts **0** toward `hiddenByFilters`: an exists-but-archived title
reads as "found nothing", which is the duplicate-creation hazard `countHiddenByFilters`
exists to prevent, with `POST /api/admin/directives` still carrying no duplicate check and
no unique constraint on `(project_key, title)`.

Surfaced, because a bare count would not answer the question the user is actually asking.
The batch loads archived directives' `id + title` into their **own** state slot and reports
how many **match the current search**. A count of archived directives tells you nothing
about whether *your* term exists; a count of archived directives *matching your term* is the
signal.

**The isolation is the load-bearing part:** archived rows are never passed to
`buildMatrixRows`, `computeMatrixKpis`, or `countHiddenByFilters`. Feeding them in would
inflate every KPI and every denominator on the page. Pinned by test.

### A8 Out of scope in Part A

- **VIEW Grouped / Flat list** — in the design HTML, absent from the later screenshot.
- Anything requiring a schema change.

---

## 2. Part B — sticky header + directive column

A fixed-height scroll region. The header row pins on vertical scroll; the directive column
pins on horizontal scroll; the top-left intersection outranks both.

Stacking: intersection `z-30` > header `z-20` > sticky body cells `z-10`.

**Height: `65vh`.** Chosen, not magic: on a 900px laptop viewport that is ~585px, about
13 body rows at the current ~44px row height, while leaving the KPI strip, filter bar and
legend reachable above without the filter controls being pushed off-screen. It is a `vh`
unit so it can never exceed the viewport on a short screen, and a `max-height` so a
three-row project does not render 65vh of empty box.

**Borders travel as `box-shadow`, not `border`.** A sticky cell's collapsed border does not
reliably paint with it while scrolling under `border-collapse: collapse`; an inset
box-shadow is unaffected by border collapsing and is drawn by the cell itself.

**Every sticky cell needs an opaque background** or rows scroll through it. That collides
with the Part C highlight and the existing crosshair band — see §3.

---

## 3. Part C — brand-header column highlight

| Action | Result |
|---|---|
| Click a brand header | that column highlights |
| Click the same header again | highlight clears |
| Click a different brand header | highlight moves |
| Click anywhere else in the grid | highlight clears |

Background treatment on the header and every cell in the column, full depth. Not a filter,
not a selection; persists across scrolling.

### C1 It collides with an existing feature, and the precedence is a decision

The matrix **already** bands a column — batch 3's hover/focus crosshair, driven by
`inspected`, painting `--f92-tint`. Reusing that token would make a deliberate persistent
highlight indistinguishable from transient pointer feedback, and the crosshair would appear
to erase the highlight as the pointer moved.

So the highlight gets its **own token**, and the precedence is:

```
highlighted column  >  crosshair band  >  no background
```

Deliberate persistent state beats transient pointer feedback. The crosshair passing through
a highlighted column simply does not override it.

**Exactly one background class is emitted per cell, always.** This is not stylistic: every
candidate is a plain `bg-*` utility at specificity (0,1,0), so if two were ever present the
winner would be decided by Tailwind's **emission order** rather than by the order they
appear in the `className`. A chained ternary is the only order-independent form. The
existing code already carries this constraint and its reasoning; this batch extends the
chain rather than layering onto it.

### C2 Clear-on-outside-click

One rule: the scroll container's `onClick` clears the highlight; the header button toggles
and stops propagation. Cell clicks bubble to the container and therefore clear it, which is
what row 4 of the table asks for. Clicking inside the open editor strip also clears it —
that is "anywhere else in the grid", stated rather than special-cased.

### C3 Tab stops — the handoff's question, answered honestly

The handoff asks to confirm the clickable headers **do not add tab stops**, and to say so.

**They do add tab stops: one per visible brand header — 13 under defaults, 16 with paused
columns shown.** A keyboard-operable control needs a tab stop; the alternatives are a
mouse-only feature (excludes keyboard users entirely) or a script-focusable control that
Tab cannot reach (worse). The only way to add a keyboard-operable header without adding
stops is a roving `tabindex` over `role="grid"`, which is explicitly out of scope (G7).

Reported rather than papered over: ~13 on top of ~1,118 existing cell stops is ~1%, they sit
at the very top of the grid where the already-recorded skip-the-matrix link would bypass
them in one keystroke, and the header row is the natural first thing a future roving-tabindex
pass would absorb. G7 stays where it is recorded, against restyle batch 4.

### C4 Token

New `--pulse-col-highlight`, light + dark, defined in `globals.css` per §13 r25 — no inline
hex. It must be distinguishable from `--f92-tint` at a glance in both themes, and it sits
behind header text and status-cell marks, so both are measured, not eyeballed.

---

## 4. Out of scope — do NOT build

- Directive create / edit / archive / delete, including a disabled affordance.
- Any change to the derived-resolve predicate.
- Legend click behaviour (A4).
- Directive "family" grouping — it does not exist in the data model; the earlier mockup
  invented 9 families by client-side title matching. It is a schema decision, not a filter.
- **G7** grid tab-stop burden / roving tabindex — recorded against restyle batch 4. C3
  answers the narrow question asked of this batch and changes nothing about where G7 lives.

---

## 5. Implementation constraints

- All filtering is client-side over already-loaded data. No new route, no server round-trip.
- Any list that could exceed 1,000 rows uses `fetchAllPaged()` from the outset — including
  the new archived-directive read. PostgREST's cap has caused one silent truncation here
  already, and it returns the short result with **no error**.
- `globals.css` is deliberately unlayered and must not be moved into a layer — 194 Tailwind
  utility call sites depend on it winning.

---

## 6. Verification

1. STATE single-select; `Open` still shows `unstarted` directives.
2. STATUS multi-select; `All` clears the set; two statuses selected = OR within the group.
3. TYPE filters; `All` clears.
4. Result count derives, states its quantity, reads the per-project number.
5. `Clear filters` appears only when something is non-default and resets everything it claims to.
6. Paused banner, hidden-by-filter correction, and archived-match signal each appear only in
   their own condition.
7. Archived directives never reach the rows, the KPIs, or `hiddenByFilters`.
8. Header row survives vertical scroll; directive column survives horizontal scroll; the
   intersection cell is never overrun.
9. Column highlight: toggle · move · clear-on-outside-click · survives scroll.
10. Highlight and crosshair are distinguishable, and the highlight wins on overlap.
11. Both themes.
12. Legend is not clickable.

Gates re-run per commit, never inherited: `tsc --noEmit` · ESLint at exactly the measured
baseline on every touched file · full suite · `npm run build` with `/dashboard/pulse` still
`○` and no new route entries · mutation run on every new pure function.

---

## 7. Commits

```
1  this spec, docs only
2  Part A — filter bar
3  Part B — sticky header + directive column
4  Part C — column highlight
5  Karen fold
```

Atomic `CLAUDE.md` per §13 r23 on each.
