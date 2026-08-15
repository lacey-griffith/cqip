# Batch 012 — Pulse: directive CRUD (edit · soft-delete · archive)

**Status:** SPEC, **rev 3** — Jenny pre-flight (rev 1, DO-NOT-BUILD-YET: 1
CRITICAL · 3 HIGH · 6 MEDIUM · 10 LOW) and her narrow re-gate (rev 2,
**APPROVE-WITH-FINDINGS**: 1 HIGH · 10 MEDIUM · 4 LOW) are both folded. She
confirmed no further gate is needed. §0.5 records what changed and what I
verified before accepting it. Rev 1 held Lacey's two decisions of 2026-08-15
(§4.4, §5). **Build may proceed.**
**Source:** `HANDOFF — Directive CRUD (edit · soft-delete · archive)`, Lacey via
Claudette, 2026-08-15. Every locked decision in §1 below is transcribed from that
handoff; nothing there was reinterpreted.
**Gate:** Jenny pre-flight **DONE** (two passes, all findings folded). Karen
post-flight. Lacey smoke + push.
**Follows:** the Pulse matrix filter/grid batch (`5795a89`). Same file.

This spec is committed **before the build opens**, per the §15 PROCESS note. Two
earlier Pulse batches opened against an authority that existed only outside the
repo; one of them cost a whole batch. Cite this file by section number.

---

## 0. Four findings that change the batch before it starts

All four were probed against production on 2026-08-15, not inferred. Each one
moves work that the handoff placed somewhere else.

### 0.1 The archive flag ALREADY EXISTS. Commit 2 shrinks.

The handoff's commit plan asks for a "soft-delete/archive flag". Migration 024
already ships one:

```sql
status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
```

That is decision **A** ("one flag") already satisfied by the schema, and
`DIRECTIVE_STATUSES` in `lib/client-library/directives.ts` already mirrors it.
**Soft-delete is `status = 'archived'`. No new column.** Adding one would create
the two-flag state decision A exists to forbid.

So COMMIT 2's migration carries **only** the unique constraint (§5).

### 0.2 The unique constraint can land cleanly — verified, not assumed.

A unique constraint added to a table that already violates it fails at apply
time, in production, halfway through a deploy. Probed 2026-08-15 across all 89
directive rows:

| Check | Duplicates found |
|---|---|
| `(project_key, title)` exact, all statuses | **0** |
| `(project_key, title)` exact, active only | **0** |
| `(project_key, lower(trim(collapse-ws(title))))`, all statuses | **0** |

The third row matters: it means we are not choosing between a constraint that
lands and a constraint that is strict enough to be useful. Both are available
today. §5 picks.

### 0.3 The directive count moved AGAIN. Do not write it down.

| As of | NBLY active | Global active | Total rows |
|---|---|---|---|
| 2026-07-31 | 82 | — | — |
| 2026-08-03 | 83 | — | — |
| 2026-08-14 | 86 | 87 | 1,393 cells |
| **2026-08-15 (this probe)** | **87** | **88** | **89 directives** |

Every single re-probe has moved. This spec therefore contains **no directive
count that any code may read**, and §8 requires the same of the implementation:
if a number is needed, derive it. The KPI strip already works this way and its
own comment says why.

Composition today: 88 active (87 NBLYCRO + 1 SPLCRO) + 1 archived (NBLYCRO).

### 0.4 ⚠ Editing `project_key` silently corrupts the KPI strip. This is the big one.

**The handoff does not mention it, and the locked "no special confirmation"
decision (§1 row B) was made without it on the table.**

`directive_brand_status` rows are keyed to `brand_id`. Move a directive from
NBLYCRO to SPLCRO and its 16 cells still point at **NBLY brands**. Then:

- `loadProject('SPLCRO')` loads the directive (its `project_key` now says SPL)
  and, because the cell read is scoped by `directive_id`, **loads its 16 NBLY
  cells too**.
- The matrix renders SPLCRO's brand columns. None of them match. The row renders
  **entirely hollow**.
- `computeMatrixKpis` scopes cells by *directive id*, not by brand — so those 16
  NBLY cells **are counted** into SPLCRO's outstanding-cell KPIs while rendering
  nowhere.

That is counted-but-invisible: the precise defect `countHiddenOwedCells` was
built to catch for paused brands, arriving through a door that guard does not
watch. And it is silent — no error, no warning, a plausible-looking number.

§4.4 specifies the fix. It is the reason `project_key` editing is the highest-risk
line in this batch, not the most convenient one.

**Jenny sharpened this one:** the KPI strip is the *less* visible symptom. The
per-row **Outstanding pill** is worse — `buildMatrixRows` → `summarizeDirectiveCells`
would render a non-zero Outstanding on a row that draws **entirely hollow**, which
is a visible contradiction rather than a quiet number.

### 0.5 What the Jenny pre-flight changed, and what I checked before accepting it

Rev 1 was returned **DO-NOT-BUILD-YET**. The design survived; three of its
load-bearing safety claims did not. Findings are folded at the section they
belong to rather than listed here, but the four that changed the *design* are:

- **CRITICAL-1 — the §4.4 block was specified only as a render-layer lock.**
  Every statement of it was about what *renders*. So the route's contract was
  "move → delete cells → re-fan-out" with **no precondition**, and §4.4's whole
  safety argument ("lossless by construction") existed only in the browser. Two
  admins, one stale page, and 16 cells including notes are gone — with no
  `old_value` anywhere in the audit trail, because §6 specified only a summary
  row. That is §13 r37's shape exactly. **Verified by reading rev 1: the claim
  was real. §4.4 now requires a server-side re-check.**

- **HIGH-1 — §4.2's mechanism was the phrase "filter at render."** That is a
  phrase, not a mechanism — and §2.1 is itself an argument that a phrase is not
  enough, applied to exactly one of eight consumers. **Verified against the
  page: there are eight, and rev 1 covered three.** §4.2 now carries a named
  mechanism and a per-consumer table; HIGH-2, HIGH-3, MEDIUM-1 and MEDIUM-2 are
  four different wrong answers to the question rev 1 left open.

- **HIGH-3 — the result-count denominator.** `matrixRows.length ===
  directives.length` at `page.tsx:1105`. **Verified verbatim.** Post-§4.2 that
  denominator becomes NBLY's *all-status* count — 88 — which is the exact number
  the comment thirteen lines above it exists to forbid on a per-project line.
  The line would flip to its `N of M` form on **every unfiltered page load** and
  contradict the KPI strip's `total` inches away.

- **MEDIUM-3 — the movability predicate.** Jenny said `n_a` can be human-set and
  that `updated_by IS NULL` is the exact discriminator. **I probed both against
  prod rather than accepting it, and the result is stronger than her framing in
  one direction and weaker in the other** — see §4.4, which now uses a
  conjunction of both clauses and says why neither alone is right.

**Two claims I checked and did NOT fold as stated.** Jenny called `updated_by IS
NULL` "exact"; it is not — it is *strictly stronger*, and it over-blocks rows a
script populated at creation (§4.4). And she read §4.3's paging as a regression;
it is, but the merged read inherits `fetchAllPaged` rather than losing it, so the
discipline is preserved rather than accepted-as-lost.

Jenny independently confirmed §0.1, §0.2, §0.4's mechanism, §4.3's feasibility,
the audit shape (no constraint change needed), and that §9's commit ordering is
safe — commit 3 lands the archive-capable route while `loadProject` still filters
to active, so no window exists between commits 3 and 4.

---

## 1. Locked decisions (transcribed — do not relitigate)

| # | Question | Answer |
|---|---|---|
| 1 | Who may edit? | **All admins.** Not owner-only. |
| 2 | Which fields? | **All of them**, including `project_key`. |
| 3 | Where? | **In-place row editing** with a save button. |
| 4 | Create? | **Already works** — out of scope. |
| 5 | Delete? | **Soft.** Never hard-delete. |
| 6 | The 16 brand cells? | **Kept.** Never deleted. |
| 7 | Archived findable? | **Yes** — `Hide archived` checkbox, default on. |
| 8 | Duplicate titles? | **Blocked.** |
| 9 | Audit log? | **Yes**, same as quality logs. |
| 10 | Type changeable after creation? | **Yes.** Discovery changes classification. |
| A | Soft-delete and archive — one flag or two? | **One flag.** |
| B | `project_key` editable? | **Yes** — a wrong project must be correctable. |

**No bespoke confirmation dialog on `project_key`.** One prompt pattern for the
whole row; the dirty-state prompt (§3) is the only guard and the audit row (§6)
is the record.

**§4.4 honours this by removing the thing a confirm would have guarded.** Lacey
ruled 2026-08-15 that a `project_key` move is **blocked** whenever the directive
holds work, so the move is only ever available in the case where it destroys
nothing. No warning, no confirm, no second prompt — and no data loss to disclose.
Row 2 ("all fields editable") is therefore true with one measured exception:
`project_key` is editable on **6 of 89** directives as they stand today. Read
§4.4 before treating that as a contradiction; it is the consequence Lacey
priced, not a quiet narrowing.

---

## 2. Archived is NOT completed

**Load-bearing. Do not collapse it.**

- **Archived** — a lifecycle flag. "No longer tracked."
- **Resolved** — a *derived* state, computed across all brands per directive by
  `summarizeDirectiveCells` / `resolveStateFrom`.

If archive is treated as completion, coverage begins counting retired directives
as achievements. Finding **G1** in the QMS baseline already names a moving
denominator as the platform's most serious measurement weakness; this makes it
worse and harder to see.

### 2.1 The prohibition gets a MECHANISM, not a comment

`computeMatrixKpis(directives, cells, brands)` computes
`coveragePct = resolved ÷ directives.length`. Today the page hands it an
active-only array because `loadProject` filters `.eq('status','active')`. §4.2
removes that filter. From that moment, **a display toggle would move the
denominator** — archive counted as completion, exactly what §2 forbids, reachable
by clicking a checkbox.

Discipline is not enough here, and the batch has a repair pattern for this
already (`PANEL_MAX_HEIGHT`, `rulingWriteValues`): make it **unconstructable, not
watched**.

- `MatrixDirectiveLike` gains `status: DirectiveStatus`.
- **`DirectiveRow.status` must be narrowed from `string` to `DirectiveStatus`**
  (`page.tsx:115`). Until it is, `MatrixDirectiveLike` is not structurally
  satisfied and this will be the first thing that fails to compile.
- `computeMatrixKpis` **filters `status === 'active'` internally**, before any
  count. It cannot count an archived directive even when handed one — so it
  takes the **raw** `directives` array, deliberately, and is the one consumer in
  §4.2's table that does.

**⚠ The test rev 1 specified would have passed on a half-applied filter.**
`computeMatrixKpis` uses `directives` in **FOUR** places — the resolve-state loop
(`matrix-controls.ts:514`), the cell scoping `known` (`:523`),
`total: directives.length` (`:535`), and `coveragePct`'s denominator (`:542`).
Rev 2 named two. Filtering the loop but not `known` leaves `total`,
`openDirectives`, `resolved`, `unstarted`, `coveragePct` and every brand field
**correct**, corrupting only the three cell counts — which are identical either
way *unless the archived fixture carries cells in owed statuses*, which rev 1 did
not require. r38 mechanism (c), on the single assertion this batch calls
structural.

**Implement it so the half-versions are unconstructable, not merely tested:** one
`const active = directives.filter(d => d.status === 'active')` at the top, and
every subsequent use reads `active`. An in-loop `continue` gives four places to
forget; the single `const` gives none.

Then the test, specified concretely rather than by intent:

- The archived fixture directive carries **≥1 cell in each of `todo`,
  `in_progress`, `blocked`, `done`** — otherwise the fixture cannot discriminate.
- Assert **every** field of `MatrixKpis` equals the active-only subset's value.
- **Mutations that must each fail:** (a) delete the filter entirely; (b) filter
  the state loop only; (c) filter `known` only; (d) filter the loop and `known`
  but leave `total` / `coveragePct` on the raw length. If (b) or (d) passes, the
  test is decorative.

**⚠ POLARITY: `status === 'active'`, NOT `status !== 'archived'` — and this needs
a stated reason, because the sibling predicate 400 lines away says the opposite.**
The two are behaviourally identical on today's closed two-value set, so **every
fixture and every mutation passes under both**; they diverge only when a third
status exists. `matrix-controls.ts:81–100` documents the VERBATIM GUARD requiring
`state !== 'resolved'` — the *negative* form — precisely so a future state
defaults to visible. The polarity flips here because the fail-safe direction
flips: for a **visibility filter**, failing open shows a row; for a **coverage
denominator**, failing open silently inflates a percentage. Excluding an unknown
future status from the denominator is the conservative error.

No test can catch this — the same shape §16 records for `TERMINAL_CELL_STATUSES`
— so **the comment at the code IS the enforcement** and must say this, not merely
state the polarity.

---

## 3. Part A — in-place row editing

- Click a directive row into edit mode; fields become editable in place; a save
  button commits.
- **Dirty-state prompt on dismiss**, matching the shipped logs-page pattern
  (`HANDOFF-logs-page-batch.md` §1). Esc, outside-click and cancel all route
  through **one** `requestClose`. Pristine exits freely.
- **Reuse `lib/logs/edit-dirty.ts`'s SHAPE, not its types.** That module is
  log-specific (`EditFormSnapshot` is the nine log fields). Do not widen it to
  serve two callers. Write `lib/client-library/directive-edit-dirty.ts` with the
  same contract, and carry its load-bearing rule verbatim:

  > **The snapshot and the form's initial values come from ONE function.** The
  > editor seeds its fields FROM the snapshot it stores. Two transcriptions of
  > one mapping drift the moment a field is added, after which the form opens
  > dirty — or opens clean and never notices a change — with tsc clean and every
  > test green.

- The confirm is a **nested Dialog** (§13 r26). Radix routes Esc to the topmost
  layer only, so Esc at the prompt keeps editing, free.
- **Editable fields, enumerated against migration 024 — not inferred:**
  `project_key` · `title` · `directive_type` · `description` · `status`.
  `id`, `created_by`, `created_at` are not editable. `updated_at` is set
  server-side.
- `directive_type` values come from `DIRECTIVE_TYPES`; labels from
  `MATRIX_TYPE_FILTER_LABEL`. **Do not spell the four types again** — a second
  spelling of a closed set is the defect `CELL_STATUS_LABEL` and
  `MATRIX_CELL_FILTER_LABEL` were both consolidated to remove.
- **Autosave is rejected**, same reasoning as the logs batch: partial writes
  become real data, and every keystroke would emit audit rows into a trail §6
  makes load-bearing.

---

## 4. Part B — soft delete + archive

One flag (§0.1). One control.

### 4.1 Delete

Sets `status = 'archived'`. The directive leaves the default matrix view.
**Its cells are untouched** — decision 6. Verified reachable today: the one
archived directive in prod still holds all 16 of its cells.

**Restore is IN SCOPE.** `status` is one of the editable fields (§3), so an
archived directive can be set back to `active` from the same editor. This is not
scope creep — without it, an all-admins soft-delete has no undo path through the
UI, and "soft delete" that cannot be undone is a hard delete with extra steps.

**Two affordances write `status`, and that is deliberate** (Jenny LOW-6): the row
editor's field, and the delete control. Two write paths to one column is normally
the shape `clearAllFilters`' comment warns about — it is accepted here because
the delete control is a shortcut for the overwhelmingly common case, and both
paths go through the **same** PATCH route and emit the **same** audit row, so
they cannot diverge in behaviour or in the trail. If they ever stop sharing the
route, this stops being acceptable.

### 4.2 `Hide archived`

Checkbox beside `Hide paused`, **default on**, mirroring its placement and
markup. Unchecking reveals archived directives, visibly marked.

**Load both sets, always; filter at render.** `loadProject` drops
`.eq('status','active')` and loads every directive for the project, plus cells
for all of them. Rationale:

- Toggling must not trigger a refetch, or the row appears before its cells and
  renders **hollow** — the pagination-hotfix symptom, manufactured on purpose.
- The archived set is tiny and grows only by archiving.
- The cell read is already `fetchAllPaged`, so it absorbs the extra rows.
- **The merged directive read INHERITS `fetchAllPaged`.** Today the archived read
  is paged (`page.tsx:367`) and the main directive read at `:337` is not. Merging
  them must page, not un-page: the archived read's own docblock explains it was
  paged from the outset because archived directives only ever accumulate. 89 rows
  is enormous headroom; the discipline is the point.

### ⚠ "Filter at render" is a phrase, not a mechanism — here is the mechanism

Rev 1 said "filter at render" and left it there. **Eight things read the
`directives` slot**, and every finding in this subsection is a different wrong
answer to *which array each of them gets*. The mechanism is two derived memos and
one scoped cell array:

```ts
const visibleDirectives = useMemo(
  () => (hideArchived ? directives.filter((d) => d.status === 'active') : directives),
  [directives, hideArchived],
);
const visibleCells = useMemo(() => {              // for countHiddenOwedCells only
  const ids = new Set(visibleDirectives.map((d) => d.id));
  return cells.filter((c) => ids.has(c.directive_id));
}, [cells, visibleDirectives]);
```

**The correct answer is NOT uniform. Two consumers must keep the raw array:**

| # | Consumer | Line | directives arg | cells arg | Why |
|---|---|---|---|---|---|
| 1 | `computeMatrixKpis` | `:672` | **raw** | **raw** | Its internal `status === 'active'` filter IS the guarantee (§2.1). Pre-filtering would make the filter dead code in the default state — on raw, every render exercises it, so deleting it fails §8 immediately. |
| 2 | archived count | `:663` | **raw, filtered to `status === 'archived'`** | — | See the ⚠ below — "raw" alone inverts this helper. |
| 3 | cells load `ids` | `:387` | **raw** | — | Archived cells must load or an archived row renders hollow. |
| 4 | `buildMatrixRows` | `:541` | `visibleDirectives` | **raw** | The rendered set. Cells may be raw: it builds a map then reads only `byDirective.get(d.id)` for directives it was passed, so an archived directive's cells sit **unread**. |
| 5 | `countHiddenByFilters` | `:649` | `visibleDirectives` | **raw** | Same structure as row 4. **HIGH-2** below. |
| 6 | `countByType` | `:1340` | `visibleDirectives` | — | **MEDIUM-1** below. |
| 7 | `directives.length` ×6 | `:818 :839 :911 :1105–1107 :1324` | `visibleDirectives` | — | **HIGH-3** below. |
| 8 | `countHiddenOwedCells` | `:638` | — | **`visibleCells`** | **The only consumer with no directive parameter at all**, so it is the only one needing pre-scoped cells. **MEDIUM-2** below. |

The `cells` column exists because three of these take two arrays and rev 2's table
assigned one — leaving a builder to make exactly the judgment the table promised
to remove. There is no correctness difference on rows 4 and 5; the column records
*why* there isn't.

#### ⚠ Row 2 — "raw" alone would invert the archived signal

`countArchivedMatchingSearch(archived, search)` (`matrix-controls.ts:447`) takes
an array that is **already archived-only** and counts title matches. Hand it the
raw all-status array and it counts every match, **active ones included**: search
`"chat"` on NBLYCRO and the line renders *"5 archived directives match your search
and are not shown"* when zero do — flatly false, on the one surface whose whole
job is preventing a false conclusion, and the surface §4.3 exists to repair.

**Fix it inside the helper**, not at the call site: it takes the full array and
filters `status === 'archived'` itself. Then it cannot be mis-fed, which is worth
more than the call-site version being one character shorter.

#### HIGH-3 — the result count's denominator

`page.tsx:1105` reads `matrixRows.length === directives.length ? … : "N of M"`.
On the raw array that denominator becomes NBLY's **all-status** count — **88** —
which is precisely the quantity the comment at `:1088–1103` exists to forbid on a
per-project line ("*two different quantities at one number*"). Three consequences,
on **every unfiltered page load**: the line flips to its `N of M` form implying a
filter is active when none is; the denominator is wrong; and it contradicts the
KPI strip's `total` (87) inches away, both labelled as directives in this project.
It takes `visibleDirectives`.

**⚠ But `visibleDirectives` only fixes the toggle-ON state, and rev 2 stopped
there.** With `Hide archived` **OFF**, `visibleDirectives` is all 88, so the line
reads *"88 directives in NBLYCRO"* while the KPI strip's `total` reads **87** —
HIGH-3's original complaint, preserved verbatim in the one state the fix does not
reach. Two numbers on one screen, both meaning "directives in NBLYCRO".

**Decision: the result line names both quantities when archived rows are shown**,
so neither number has to be wrong and the first figure always matches the KPI:

| `Hide archived` | Result line |
|---|---|
| ON (default) | `87 directives in NBLYCRO` |
| OFF | `87 directives + 1 archived in NBLYCRO` |
| ON, filtered | `12 of 87 directives in NBLYCRO` |
| OFF, filtered | `12 of 87 directives + 1 archived in NBLYCRO` |

Both figures derived. The archived count is the row-2 helper with an empty query.

**Flagged for Lacey — a copy call, not a correctness one.** The alternative is to
scope the KPI card's label instead. Either works; leaving it unstated does not,
because it is the exact §A6 ambiguity one toggle-click away. Default if
unanswered: the table above.

#### HIGH-2 — `countHiddenByFilters` and the button that would lie

That helper counts directives matching the **search** but failing a filter group,
and offers **Clear all filters** — which by deliberate design does *not* touch
`hidePaused` (`:678–682`). On the raw array it produces two dishonest outcomes:
an archived row that matches the search and passes every group contributes **0**,
so the correction stays silent (the exact false negative the helper exists to
prevent); and an archived row that fails a group *is* counted, so the page offers
**Clear all filters** — which **reveals nothing**, because the row is hidden by
`hideArchived`. The second is strictly worse than the pre-batch state.

**Resolution: exclude archived rows from its input** (`visibleDirectives`), and
let the §4.3 archived signal be the sole channel for "it exists, archived".

**The rejected alternative, and why:** folding `hideArchived` into
`hasClearableFilters`/`clearAllFilters` would also work, but `hideArchived` is a
**view preference**, the same class as `hidePaused` — which `clearAllFilters`
deliberately excludes. Folding one in and not the other is incoherent, and
folding both in changes what "Clear filters" means. **Do not do both**; that
recreates the two-competing-reset-paths hazard `clearAllFilters`' own comment
forbids.

#### MEDIUM-1 — `countByType` suppresses the copy it exists to produce

`:1340` gates the "no directives of this type yet" empty state on
`countByType(directives, typeFilter) === 0`. On the raw array, a type whose only
directives are archived reports `> 0`, so it falls through to the generic
no-match copy — which its own comment says "reads as a bug on a type Lacey simply
has not started using."

#### MEDIUM-2 — the paused-brand warning gains a false positive AND false text

`countHiddenOwedCells(brands, cells, hidePaused)` takes **all** cells with no
directive scoping. Post-§4.2 that includes archived directives' cells — the prod
archived directive holds all 16. An owed cell on a paused brand belonging to an
*archived* directive would fire:

> ⚠ N outstanding cells on paused brands are hidden but still counted.

The offered fix, *Show paused*, reveals nothing — the row is hidden by
`hideArchived`. A guard built to catch counted-but-invisible cells, reporting
invisible-and-not-counted ones. It takes `visibleCells`.

**⚠ Rev 2 gave the right fix with the WRONG REASON, and the reason is what a
maintainer follows.** It argued "*still counted* is false because §2.1 removes
archived cells from the KPI scoping" — under which the correct scope would be
**active-only**, not `visibleDirectives`, since §2.1 excludes archived cells from
the KPI *regardless of the toggle*. Following that reason, a later maintainer
re-scopes to active-only and reintroduces a false negative in the toggle-off
state.

The warning is **not about the KPI strip**. Its own docblock
(`matrix-controls.ts:135–145`) says: *"One such edit makes a row read 'Outstanding
1' with no owed dot visible anywhere in it."* It is about the **per-row
Outstanding pill** — and on that reading `visibleDirectives` is exactly right:
toggle off, the archived row renders, its pill counts the cell, the warning is
true; toggle on, there is no row, so it must be silent. Keep the code; this
paragraph is the fix.

#### An archived directive's CELLS become editable — decided, not inherited

With the toggle off the archived row renders, and the grid's
`editable = isAdmin && !!cell` has **no status dimension** — so an admin could
change statuses and write notes on a directive §2 defines as "no longer tracked".
Previously unreachable, because archived rows never rendered. **This batch
creates it**, so it is decided here rather than discovered later.

**Archived rows render their cells READ-ONLY:**
`editable = isAdmin && !!cell && directive.status === 'active'`.

Two reasons. §2's own definition — a retired directive is not being worked, so an
editor on it is an affordance without a meaning. And it would move the per-row
Outstanding pill on a row the KPI strip deliberately does not count (§2.1), which
is a fresh instance of exactly the counted-vs-shown mismatch MEDIUM-2 above is
about. Cells stay **intact** either way (decision 6), so a restore still finds
them as they were — which is the actual reason to keep them, and it does not
require them to be editable while archived.

**Flagged for Lacey:** if editing an archived directive's cells turns out to be
wanted, restore-then-edit is the two-click path and it leaves an audit trail of
the restore. Default: read-only.

#### LOW — empty states and the control's own visibility

`:820` and `:1326` read *"No **active** directives for {project}"* while gated on
a length that post-§4.2 means "no directives of any status"; on
`visibleDirectives` the copy is true again when the toggle is on and must be
reworded when off. And **the `Hide archived` checkbox renders only when the
project has ≥1 archived directive**, mirroring `Hide paused`'s
`pausedBrandCount > 0` gate — so it appears the first time something is archived.
Stated because "mirroring its placement" was ambiguous about exactly this.

The safety this whole subsection trades away is what §2.1's structural filter
buys back.

### 4.3 The existing archived-search signal must not contradict the new view

The previous batch added `archivedTitles` + `countArchivedMatchingSearch`,
rendering *"N archived directives match your search and are not shown."*

Once archived rows CAN be shown, that sentence is false whenever `Hide archived`
is off. So:

- Delete the separate `archivedTitles` fetch; derive the count from the single
  directive load. **One fetch, one source** — two reads of the same fact is the
  divergence hazard this module exists to prevent. Feasible as written:
  `DirectiveRow.status` is already selected (`page.tsx:339`).
- The merged read **inherits `fetchAllPaged`** (§4.2) rather than dropping to the
  main read's unranged form.
- Render the signal **only when `hideArchived` is true**. Gating it there leaves
  no state in which "…are not shown" is false — Jenny confirmed the enumeration.
- Give it the same one-click escape the paused warning has: *"Show archived"*.
- It reads the **raw** directive array (§4.2 row 2): its whole job is to count
  what the view is hiding, so a filtered input would zero it out.

This closes the live defect the handoff names — `Submits Form Lead - Combined`
is archived in prod right now (added by direct SQL) and reads as "found nothing"
to anyone searching for it.

**And it closes a falsified claim, which is the more durable half.** Karen's
LOW-8 recorded archiving as *verified unreachable* on 2026-07-29. That audit
examined `app/api/` only, so the direct-SQL path was outside its scope. Standing
lesson, already recorded: **a "no writer exists" claim must state which surfaces
were checked.**

### 4.4 ⚠ Changing `project_key` — BLOCKED when the directive holds work

**DECIDED by Lacey 2026-08-15: block the move.** The alternatives offered were an
inline warning or a confirm step; both were declined in favour of the option
where **no data can be lost**, accepting that some corrections become impossible.

#### The rule — a CONJUNCTION, and rev 1's version was wrong

```
movable  ⟺  ∀ cell:  cell.updated_by IS NULL
                   ∧ cell.status ∈ {todo, n_a}
                   ∧ isBlank(cell.note)
```

Rev 1 omitted the first clause and justified it with *"`todo` and `n_a` are the
only two statuses `fanOutCells` produces, and **neither encodes anything a human
entered**."* **The second half of that sentence is false**, and Jenny caught it:
`app/api/admin/directives/status/route.ts:66` accepts any `isCellStatus` value
**including `n_a`**, with no paused-brand check. An admin deliberately marking
"this brand does not run this test" produces a cell rev 1 classified as
disposable. Same for a deliberate `done → todo` reopen.

**Measured against prod, 2026-08-15 — the gap was not theoretical:**

| | |
|---|---|
| Cells whose `updated_by` is NULL (never written since fan-out) | 191 of 1,409 |
| Writers of the rest | `system:nbly-goal-load` 746 · `l.hay@fusion92.com` 267 · `system:convert-reconciliation` 205 |
| **Cells rev 1's predicate called disposable that a human or script had written** | **620** — 313 `todo`, 307 `n_a` |
| Cells never written that rev 1 called held | **0** |
| Directives movable under rev 1's predicate | 6 of 89 |
| Directives movable under the corrected predicate | **1 of 89** |
| **Directives rev 1 would have wrongly allowed moving** | **5** |

`fanOutCells` (`directives.ts:78`) writes only `{directive_id, brand_id, status}`,
leaving `updated_by` **NULL**; the status PATCH route always sets it
(`status/route.ts:109`), as does the reconciliation backfill. So `updated_by IS
NULL` means "untouched since creation" and, as the zero-false-negatives row above
shows, **implies** the other two clauses on today's data.

**But it is NOT "exact", as Jenny called it — it is STRICTLY STRONGER, and it
over-blocks.** The 5 directives it newly blocks are the chat goals inserted by
**direct SQL** on 2026-08-12, whose `updated_by` was populated *at creation*
rather than by any edit. Nothing about them was worked. That is an artifact of
how they were created, not evidence of work — and it does not matter, because
nobody needs to move them.

**Why keep all three clauses when one implies the others today — and this is the
argument to keep, because it does not go stale.** Every clause can only **shrink**
the movable set. Adding one therefore can never introduce data loss; it can only
reduce a convenience. **The predicate is fail-safe in one direction by
construction**, which is why requiring all three costs nothing and why adding a
fourth later would also cost nothing.

That asymmetry — not the measurement — is what makes "1 of 89" acceptable without
further argument, and it is the durable guard against a future reviewer
"simplifying" the redundant clauses away. The measurement will be stale next
week; the asymmetry will not. Secondarily, the three fail independently: if a
future writer forgets `updated_by`, the status and note clauses still catch worked
cells; if a future fan-out gains a third default status, `updated_by` still
catches edits.

Deliberately **independent of the brand's current pause state**: `is_paused` can
flip after fan-out, so "is this cell at *its* default" is ambiguous and this is
not.

#### Where it is enforced — BOTH layers. The route is the real one.

**⚠ Rev 1 specified this block only as a render-layer lock, and that was the
CRITICAL finding.** Every statement of it described what *renders*, so the
route's contract was "move → delete cells → re-fan-out" with **no precondition**
— and §4.4's whole safety argument existed in the browser only.

**The failure is ordinary two-admin concurrency, not a race you have to
engineer.** Admin A opens the matrix; `loadProject` snapshots cells **once**
(`page.tsx:388`), and directive `D` renders movable. Admin B works `D` from the
brand page, or the reconciliation script runs. A never reloads, changes
`project_key`, saves. The route deletes 16 cells including B's notes. **And the
audit trail would not record what was lost** — §6 specified a single summary row
with no `old_value`, and cells have no soft-delete (§13 r1 is scoped to
`quality_logs`). The trail shows B's write, then a move, then nothing. That is
§13 r37's shape precisely: the destructive write is the one that leaves no mark.

So:

- **The route re-evaluates the predicate server-side against freshly-read cells**
  and returns **409** with the derived reason when it fails. It does not trust
  the request, and it does not trust the client's view of the cells.
- **⚠ ONLY when `project_key` actually changes** —
  `body.project_key !== stored.project_key`. Checking unconditionally makes
  **every title, description or type edit on any of the 88 blocked directives
  return 409**, killing the feature on 99% of the data on day one. Same shape as
  §5.0's self-collision bug: a guard firing on an unchanged field. §8 pins it.
- **UI and route call ONE shared pure predicate** exported from
  `lib/client-library/directives.ts` — `isDirectiveMovable(cells)` — so the two
  cannot drift. This is the `snapshotFromLog` shape: one mapping, no second
  transcription to be wrong.
- **The REASON STRING comes from the same module too.** §4.4 requires the lock to
  name the failing clause and the 409 to carry "the derived reason" — that is two
  derivations of one message, the second-spelling defect §3 forbids for
  `CELL_STATUS_LABEL`. `isDirectiveMovable` returns the reason alongside the
  verdict, so the inert `<span>` and the 409 body cannot disagree about *why*.
- **⚠ `updated_by` IS NOT CURRENTLY SELECTED.** `loadProject`'s cell select is
  `id, directive_id, brand_id, status, note` (`page.tsx:393`) and `CellRow`
  (`:119–124`) mirrors it. Both gain `updated_by`, **in the same commit as the
  predicate**, and the predicate's parameter field is **non-optional**
  (`updated_by: string | null`, never `?`). With `?`, today's `CellRow` satisfies
  it structurally, every cell reads `undefined` → treated as null → **every
  directive renders movable**, tsc clean, with only the route's 409 standing
  between that and loss. One word decides whether the failure is loud or silent.
- **Carry the predicate into the DELETE's `WHERE`** — `directive_id = $1 AND
  updated_by IS NULL AND status IN ('todo','n_a') AND note IS NULL` — and compare
  the deleted count to what the check saw. A cell written inside the window then
  **survives** instead of being destroyed, and the mismatch is reportable. This
  degrades the residual failure from *silent loss* to *partial apply with a
  signal*, the same trade insert-first and `cellError` already make, and it is
  what lets "lossless by construction" be literally true rather than nearly true.
- The read-then-write window still exists in principle. **Accepted and recorded:**
  closing it entirely needs a single RPC or an advisory lock, disproportionate to
  a two-admin tool where the guard plus the DELETE predicate reduce the exposure
  from "the whole session" to "one request, and even then nothing is destroyed".

The client-side lock stays, because a 409 the user could have been shown up front
is a bad experience — but it is now the *convenience*, and the route is the
guarantee.

#### The locked control

When not movable, `project_key` renders as an inert `<span>` plus the derived
reason, never `<button disabled>`. **The reason names the clause that actually
failed** — rev 1's single message ("*N brand cells hold status beyond their
defaults*") is false for a `todo` cell that blocks only because it carries a
note, or only because it was edited:

> Cannot move — 9 brand cells have been edited or hold a note.

Counts derived, never literal (§0.3). Every other field stays editable; only
`project_key` locks.

#### What this buys, and it is more than it looks

The move is still a re-fan-out, via the same `fanOutCells` create uses so the two
paths cannot drift. **But the block makes that re-fan-out lossless BY
CONSTRUCTION** — every cell it deletes was untouched since fan-out and carries no
information. §0.4's silent miscount is fixed *and* nothing can be destroyed, so
the two goals stop trading against each other. *Given* the server-side re-check
above; without it the phrase is false, which is what CRITICAL-1 was about.

**The `directives.project_key` UPDATE goes LAST — after the cell work.** Rev 2
ordered the cells and said nothing about the row itself, which leaves the half
that reproduces §0.4: update the row first, have the cell work fail, and you land
in exactly the state this subsection exists to prevent — directive in the new
project, old cells intact, loaded by `directive_id`, counted, rendering hollow.
The defect produced by its own repair path. Row last means a cell failure leaves
cells for both projects with the directive still in the old one: a transient
over-count that is visible and clears on a re-run.

**Cell write order: INSERT FIRST, then delete.** Rev 1 said "delete the old cells,
insert fresh ones" and specified no transaction, no ordering rationale and no
failure response — and that is the destructive order. Delete-then-insert, with
the insert failing, leaves a directive in the new project with **zero cells**:
renders `unstarted`, all hollow, Outstanding 0, and **there is no re-fan-out
affordance anywhere in the UI to repair it.** Insert-first cannot collide —
the new cells carry different `brand_id`s, so `UNIQUE (directive_id, brand_id)`
is not in play — and its worst case is a transient double-count that the next
statement removes. On partial failure the route returns the directive as moved
with an explicit `cellError`, mirroring the create route's fan-out failure shape
(`route.ts:134–140`), which leaves a *recoverable* state and says so.

Audit: one summary row, `field_name = 'directive_brand_status'`, `new_value =
're-fanned to N brands on project move'`.

The lock in §1 row B also survives untouched: there is no new prompt, because
there is nothing left to warn about.

#### ⚠ The honest cost — measured, not estimated

Probed 2026-08-15 across all 89 directives and 1,409 cells:

| | |
|---|---|
| **Movable today** (`project_key` editable) | **1 of 89 — about 1%** |
| Blocked | 88 |
| Cell statuses | `done` 586 · `todo` 451 · `n_a` 371 · `in_progress` 1 |
| Cells carrying a note | 23 |
| Cells never written since fan-out | 191 of 1,409 |

**So `project_key` editing is a create-time correction, not a general repair —
and on existing data it is close to inert.** That is not a defect: every
directive created **from now on** goes through `POST /api/admin/directives` →
`fanOutCells`, which leaves `updated_by` NULL, so a newly created directive **is**
movable until someone works it. The feature works exactly when it is needed —
minutes after a mis-filed create — and is unavailable afterwards, which is the
trade Lacey chose.

**Do not describe this to anyone as "project can be edited."** It can be edited
*until someone touches the directive*, which in practice means the same session.
**83 of the 88** blocked directives are blocked because the goal load, the
reconciliation backfill or Lacey wrote their cells — the predicate working. The
other **5 are over-blocked**, per the paragraph above: the direct-SQL chat goals,
whose `updated_by` was populated at creation rather than by an edit. That
concession stands; it is not quietly reversed here.

**Escape hatch, deliberately not built:** an admin who genuinely must move a
worked directive archives it (§4.1) and creates a replacement in the right
project. That path is lossy too, but it is visible, audited, and chosen.

---

## 5. Part C — duplicate title blocking

Enforce at **both** layers. The constraint is the guarantee; the route check is
the message.

- **Migration (COMMIT 2):** `CREATE UNIQUE INDEX IF NOT EXISTS
  idx_directives_project_title ON directives(project_key, title);`
- **Routes:** both `POST /api/admin/directives` and the new PATCH pre-check and
  return a usable 409. Blocking creation closes the standing backlog item the
  create route has carried since Phase A — it performs **no** duplicate check
  today, which is why `countHiddenByFilters` had to mitigate on the render side.

### 5.0 Three route behaviours rev 1 left unspecified — one is the classic bug

- **Self-exclusion.** The PATCH pre-check MUST carry `.neq('id', <directive id>)`.
  Without it, **saving a row whose title is unchanged 409s against itself** — and
  since editing title is optional, that breaks nearly every save. §8 pins it with
  a "save with an unchanged title succeeds" case, which rev 1's test plan lacked,
  so this would have shipped.
- **Destination scoping.** On a project move the pre-check runs against the
  **new** `project_key`, not the current one. Checking the old project would
  permit a move that collides at the destination and then fails at the index.
- **Map `23505` to the same 409.** A pre-check is not a lock: two concurrent
  creates both pass it and the index catches one.
  `POST /api/admin/directives:120–123` returns **500 with the raw Postgres
  message**, so post-029 a create race would surface
  `duplicate key value violates unique constraint "idx_directives_project_title"`
  to the user. Both routes map `error.code === '23505'` to the pre-check's 409;
  the precedent is `app/api/admin/milestones/route.ts:126`.

- **PATCH must `trim()` the title exactly as POST does** (`asTrimmedString`,
  `route.ts:27–31`). Without it `" Chat Started"` coexists with `"Chat Started"`
  under an exact index, defeating §5.1 through a door §5.2 never decided — §5.2
  ruled on *case and internal* whitespace; leading/trailing is a different thing
  that POST already eliminates. Also reject an empty-after-trim title: `NOT NULL`
  admits `''`.
- **PATCH must validate the destination project exists AND is active**, as POST
  does (`route.ts:87–101`). Otherwise a nonexistent key surfaces as a raw 500 on
  the FK, and — worse — **a move to an INACTIVE project succeeds**, after which
  the directive is unreachable through the UI entirely: `initialLoad` selects
  `is_active = true` projects only (`page.tsx:429`), so no picker can reach it,
  while its cells have already been re-fanned. Unrecoverable through the UI, from
  a one-character typo.
- **`old_value` comes from the route's own re-read, never the client.** §6's
  "diff against the row as loaded" is ambiguous between the route's load and the
  browser's; the cell PATCH already sets the precedent (`status/route.ts:78–90`).
  Trusting a client `old_value` is §13 r19's shape one field over.
- **404 on a missing directive id.**

The violation **is** distinguishable: `directives` carries only its PK and this
index — 024's other two (`idx_directives_project`, `idx_directives_active`) are
non-unique — and a PK violation is unreachable on an UPDATE that does not touch
`id`.

### 5.1 Scope: across ALL statuses — DECIDED

**DECIDED by Lacey 2026-08-15: all statuses, exact match.** Both halves below are
settled; neither is an open question.

Uniqueness spans archived rows. **Why, and it is not the obvious reason:** a
partial index on `status='active'` would let a duplicate title exist while
archived, and then **restore (§4.1) would fail at the database** with a
constraint error on an operation the user has every reason to expect to work.
Full uniqueness makes restore always safe — which matters more here than
elsewhere, because §4.1 made restore the only undo path for a soft-delete.

The accepted cost: archiving `X` no longer frees the name `X`. An admin retiring
a directive and creating a same-named replacement must rename. Prod already
shows that workaround in use — `Submits Form Lead - Combined` (archived) sits
beside `Remove Submits Form Lead - Combined` (active), so the rename convention
predates the constraint rather than being imposed by it.

### 5.2 Exact match — DECIDED

The index is on the raw `title`. Case/whitespace variants are **not** blocked:
`"Chat Started"` and `"chat  started"` can coexist. §0.2 confirms zero such
near-duplicates exist today, so the stricter functional index
(`lower(regexp_replace(title,'\s+',' ','g'))`) would also have landed cleanly and
remains available later against the same clean data.

Recorded so that "we only blocked exact duplicates" reads as a decision rather
than an oversight — and so a future near-duplicate is understood as in-scope for
a follow-up, not as this constraint failing.

---

## 6. Part D — audit rows

Every directive mutation writes `audit_log` rows on the quality-logs convention:
`field_name` / `old_value` / `new_value` / `changed_by`, one row per changed
field. Diff against the row as loaded; unchanged fields emit nothing.

- `target_type = 'directive'`, `target_id = <directive id>`. **No constraint
  change is needed** — but cite migration **025**, not 024: `025_monitoring_findings.sql:109–118`
  is the LIVE definition of `audit_log_target_shape_chk`, having re-DROPped and
  re-ADDed 024's full set plus `monitoring_finding`. 024's version is superseded.
  The conclusion is unchanged and Jenny re-verified it; only the citation was
  dangling, which is a failure mode this file has paid for before.
- `action`: reuse `'UPDATE'` with a descriptive `field_name`. The
  `audit_log.action` CHECK has its own closed set; do not invent a value.
- `changed_by` is **server-derived** via `getChangedBy()` on the **cookie-bound**
  client (§13 r19). A client-supplied `changed_by` is warned and discarded, as
  both existing directive routes already do.
- **`project_key` especially.** That field silently moves which project's
  coverage denominator the directive lands in, and the audit row is the only
  record it happened — the `alert_rules` edit of 2026-08-03 is the standing
  example of a change with no trail.
- Archive/restore writes `field_name = 'status'`, `'active' → 'archived'`.

**Do not copy the sync's identity defect.** `jira-sync` writes its auto-advance
row under a bare `'system'` rather than `system:*`, so provenance queries
filtering `system:%` miss it. Anything non-interactive here uses `system:`.

---

## 7. Out of scope

- Directive **creation** — shipped and working. Touched only for §5's duplicate
  check.
- Any change to the derived-resolve predicate, or to the verbatim
  `state !== 'resolved'` guard.
- Restyle batch 4 of 4.
- **G7 grid tab-stop burden.** Recorded against batch 4 — but this batch's
  addition is stated in §8.
- Bulk edit or bulk delete. One directive at a time.
- Hard delete. Ever.
- **The BRAND PAGE keeps `.eq('status','active')`**
  (`app/dashboard/pulse/[projectKey]/[brandCode]/page.tsx:252`) and gets no
  archived toggle. **This batch therefore CREATES an asymmetry:** an archived
  directive becomes visible on the matrix (toggle off) while remaining silently
  absent from the brand page. Deliberate — the brand page is a per-brand working
  view, not an inventory — but recorded as created-here rather than discovered
  later, and it is the natural first item if the asymmetry turns out to confuse.
- A **re-fan-out affordance** for a directive left with zero cells. §4.4's
  insert-first ordering means the state is not reachable by the specified path;
  if it is ever reached another way, repair is SQL.

---

## 8. Verification

Behavioural, in the order a reviewer can actually run them.

**Permissions**
- All admins can edit — not owner-only.
- Non-admins get plain inert markup, **never `<button disabled>`** (standing
  rule; the matrix's own pre-existing `disabled={!clickable}` is out of scope but
  do not add a second instance).
- The PATCH route enforces admin server-side regardless of what renders.
  **RLS is NOT the backstop for the route** — rev 1 said it was, and that is
  wrong: the route writes via `supabaseAdmin` (service role), which **bypasses**
  RLS entirely. `directives_admin_write` backstops the direct browser-client path
  only. The route's own session→profile check is the sole gate on the route.

**Editing**
- Dirty prompt fires on all three dismiss paths; pristine exits freely; Esc at
  the prompt keeps the editor open.
- `directive_type` persists and the TYPE filter reflects it immediately.
- `description` and `title` persist.

**`project_key` (§4.4) — the highest-risk area, test it hardest**
- A directive with **any** cell that has a non-null `updated_by`, or a status
  outside `{todo, n_a}`, or a note, renders `project_key` **locked** with a
  reason naming the clause that failed. Inert markup, never `<button disabled>`.
- A freshly created directive **is** movable — create one and move it.
- Moving it inserts the new project's cells and removes the old ones —
  **verify by direct query, not by the UI or the response body.**
- **⚠ THE CRITICAL-1 TEST, and it is a ROUTE test, not a UI test.** `PATCH` a
  project move on a directive holding one `done` cell → **409**, *and the cells
  are unchanged*, asserted by direct query. Without this the block is UI-only in
  practice no matter what the prose says. A UI test cannot substitute: the whole
  finding is that the UI's view can be stale.
- **The §0.4 regression test, stated so it is runnable.** Rev 1 asked that "the
  destination project's KPI strip contains no cell belonging to a brand outside
  that project" — **not assertable**, because `MatrixCellLike` is
  `{directive_id, status}` and carries no brand identity. Assert instead, by
  direct query: after a move, every `directive_brand_status` row for that
  directive references a brand whose `project_key` is the destination.
- **`isDirectiveMovable` is unit-tested with fixtures that isolate each clause**
  — a cell in `in_progress`; a `todo` cell **with a note**; a `todo` cell with a
  **non-null `updated_by`** and no note; a whitespace-only note (must NOT block).
  A fixture where two clauses fail together cannot discriminate them (r38
  mechanism (c)).
- **Mutations that must each fail a test:** drop the `updated_by` clause; drop
  the note clause; widen the status set to include `done`. If dropping the
  `updated_by` clause passes, the fixture set is rev 1's and is under-constrained.

**Filter/consumer wiring (§4.2)**
- With `Hide archived` **ON** (the default) and no filters set, the result line
  reads `N directives in {project}` — **not** `N of M` — and its number equals the
  KPI strip's `total`. **Rev 2 wrote OFF here and the assertion would have FAILED
  on a correct build** (88 vs 87), whose natural "fix" is to point the count at
  active-only and introduce a count that excludes rows visibly on screen. Run it
  ON.
- With `Hide archived` **OFF**, the line names both figures
  (`87 directives + 1 archived`), and the first still equals the KPI `total`.
- The archived-count helper returns **0** for a search matching only ACTIVE
  directives — the row-2 inversion. Search a term hitting several active
  directives and no archived one; the "…are not shown" line must not render.
- An archived directive's cells are **not editable** while archived; after
  restore they are.
- `countHiddenByFilters` never counts an archived row, so **Clear all filters**
  can never be offered for a row it cannot reveal.
- A type whose only directives are archived still shows the "no directives of
  this type yet" empty state, not the generic no-match copy.
- The paused-brand amber warning does not fire for an owed cell belonging to an
  archived directive.

**Duplicate titles (§5.0)**
- **Saving a directive with its title UNCHANGED succeeds** — the self-collision
  case; this one is the reason §5.0 exists.
- **Editing the TITLE of a directive holding `done` cells succeeds** — the
  movability check must fire only on a `project_key` change. Without this the
  feature is dead on 88 of 89 directives.
- A title differing only by leading/trailing whitespace is rejected.
- A move to an **inactive** project is rejected, not silently accepted.
- A create colliding with an **archived** title is rejected (§5.1's scope).
- A project move whose title collides **at the destination** is rejected.
- The route returns **409 with a usable message**, not a 500 carrying a Postgres
  constraint name — verify by forcing the `23505` path, not only the pre-check.

**Archive**
- Delete archives; the row leaves the default view; **all 16 cells survive** —
  by direct query.
- `Hide archived` defaults on. Unchecking reveals archived rows, marked.
- `Submits Form Lead - Combined` becomes findable.
- Restore returns it to active.

**§2 — the prohibition**
- KPI totals, `coveragePct` and every count are **identical** with `Hide
  archived` on and off. This is the batch's single most important assertion.
- The §2.1 mixed-array unit test passes, with an archived fixture carrying ≥1
  cell in each of `todo`/`in_progress`/`blocked`/`done`, and **fails under all
  three** specified mutations — including "filter the state loop but not
  `known`", which rev 1's test would have passed.

**Duplicates**
- Blocked at the route with a usable message, and by constraint (verify the
  constraint independently — a route check alone would pass this test).
- Migration applies against prod-shaped data without violation (§0.2).

**Counts and a11y**
- No literal directive count anywhere in the shipped code (§0.3).
- **State the tab stops this batch adds**, measured, not estimated: one edit
  affordance per visible row, plus the `Hide archived` checkbox, plus the fields
  of at most one open editor. Report the number against a derived row count.
- The archived signal and its "Show archived" escape share the existing single
  polite live region — do not add a second.

**Both themes.** Every contrast figure computed by the repo's script, which
first reproduces four already-documented values before being trusted. The last
batch's estimated figures were all wrong.

---

## 9. Commits

```
1  this spec, docs only                                              [DONE 887f55e]
2  migration — unique (project_key, title)          [§0.1]           [DONE d4a3283]
   … Jenny pre-flight → DO-NOT-BUILD-YET → folded as rev 2           [DONE]
3  lib: isDirectiveMovable + status on MatrixDirectiveLike
      + computeMatrixKpis internal filter + tests    [§2.1, §4.4]
4  PATCH route — edit / archive / restore / move + audit rows [§4.4, §5.0, §6]
5  in-place row editing UI + dirty guard             [§3]
6  Hide archived control + the §4.2 consumer wiring  [§4.2, §4.3]
7  Karen fold
```

**Commit 3 splits off from the old commit 4 and moves AHEAD of the route.** Rev 1
had the route first. But §4.4's server-side re-check calls `isDirectiveMovable`,
and §2.1's filter is what keeps archived rows out of the KPIs — so both pure
pieces must exist, and be tested, before anything imports them. Building the
route first would mean writing the guard inline and extracting it later, which is
how two copies of a predicate get created.

Atomic `CLAUDE.md` per r23 on each.

**The Jenny gate moved from before commit 2 to after it, and it earned its
place.** The handoff gated the migration because that commit was to carry a new
column plus a constraint; §0.1 removed the column, leaving a single index on data
proven non-violating (§0.2). The privileged surface worth pre-flighting is the
**PATCH route** — which can move a directive between projects and destroy cells.
**Jenny's CRITICAL-1 is the vindication:** it is a route-level finding that a
migration-stage gate would have had nothing to say about. She independently
agreed the ordering was right.

**The pure layer lands before the UI on purpose.** §2.1's filter must exist
before any code path can hand `computeMatrixKpis` an archived directive; building
the toggle first would put the defect in the tree between two commits.

**Re-gate done.** Jenny's narrow second pass returned APPROVE-WITH-FINDINGS on
rev 2 and confirmed no third gate is needed — the remaining items were folded
into rev 3 and none changed a design decision. She closed CRITICAL-1 as genuinely
fixed and confirmed the consumer table's two contested rows.

**Do not push.** Report back → Karen.

---

*Rev 1 committed 2026-08-15 before the build opened; rev 2 folds the Jenny
pre-flight the same day. Prod figures throughout (89 directives · 1,409 cells ·
87 NBLY active · 191 untouched cells) were probed 2026-08-15 and **will be
stale** — this table has moved on every single probe. Re-probe; do not cite.*
