# Batch 012 — Pulse: brand-page parity + matrix paused default

**Status:** IN FLIGHT (2026-07-31). Render/interaction only.
**Profile:** NO migration · NO schema change · NO new route · NO new mutation
surface · NO new fetch · NO new dep. E-track → **no Jenny, no version bump.**
**Gates:** Karen post-flight required; verdict findable in the commit message or
§15.5 before any push (§13 r32 / R21). **DO NOT PUSH.**

Files:

| File | Change |
|---|---|
| `app/dashboard/pulse/[projectKey]/[brandCode]/page.tsx` | 1 + 2 |
| `app/dashboard/pulse/page.tsx` | 3 |
| `lib/client-library/pulse.ts` | 2 (pure logic) |
| `lib/client-library/directives.ts` | shared `CELL_STATUS_LABEL` |
| `components/client-library/cell-edit-strip.tsx` | label import only |
| `tests/pulse-shell.test.ts` | 10 new cases |

**No hardcoded counts anywhere.** Prod moved 76 → 82 active directives during
the V2.1 backport window and will move again. Every count renders from live data.

---

## 0. Definition of done

1. The brand page's edit trigger is the status pill, and it **looks** like a
   control (not like the read-only span).
2. A status filter scopes the brand-page list, defaulting to `Open`, with the
   hidden-row count and a reset visible in **both** the rows-listed and zero-row
   shapes.
3. The matrix's *Hide paused brands* checkbox defaults to checked — **only if**
   re-measured prod evidence says it is count-neutral.
4. `tsc` 0 · ESLint **zero** findings on every touched file · full suite green ·
   `npm run build` green with `/dashboard/pulse` still `○` and the brand page
   still `ƒ`, no new route entries.

---

## 1. Change 1 — brand-page edit trigger

### Correction to the ask, recorded rather than silently absorbed

The kickoff states *"today the whole row is the click target."* **That is not the
case at HEAD.** `c58364c` (2026-07-25) already made the status pill the only
interactive element in the row: the `<Card>` carries no `onClick`, and title /
type badge / description are already inert text. `editable = isAdmin && !!cell`
and the non-admin plain `<span>` were already in place too.

What is actually outstanding is the **third, unfolded Karen LOW** from that
batch — *edit-affordance discoverability: "a text button styled like the
read-only span."* The pill was already the trigger; it just did not read as one.
That is the real defect and the intent behind the ask, so it is what this change
addresses.

### What ships

- **Visible chip affordance** on the pill: `--pill-filter-bg` fill,
  `--f92-border` border (orange on hover/focus/open), navy text. Tokens only
  (§13 r25) — no inline hex.
- Non-admins keep the **plain `<span>`, never a disabled button**, so no
  interactive control leaks to a read-only user. A consequence worth stating:
  the chip treatment is therefore *itself* the "this row is editable" signal.
- **aria-label leads with the action and names the directive:**
  `Edit status for {title}: {status}` (+ `" (editing — activate to close)"` when
  open). `"To do"` repeated down 82 rows tells a screen-reader user nothing
  about which row they are on.
- Unchanged: `editable = isAdmin && !!cell` (cell-must-exist is **not**
  loosened) · `CellEditStrip` position and save path · the MEDIUM-1 `liveKeyRef`
  staleness guard · the render branch order
  (`!ready → notFound → loadError → rows`), which `52dc69d` documents as
  load-bearing.
- The page copy already read *"Click a status to edit it for this brand."* It is
  left verbatim — after this change it is discoverable as well as true.

---

## 2. Change 2 — brand-page status filter

Client-side over already-loaded cells. No refetch, no new query.

### Semantics — NOT the matrix's filter

The matrix filters on a **derived resolve state** computed across every brand of
a directive (`active` / `resolved` / `unstarted`). On a brand page each directive
has exactly **one** cell, so that classifier collapses to the cell's own status
and carries no information the status itself doesn't. **Different question,
different function.** Neither control is relabelled to match the other:

- Matrix `Open` = "this directive is not finished **anywhere**."
- Brand-page `Open` = "**this brand** still owes this directive."

### Options (order as rendered)

`Open` (default) · `To do` · `In progress` · `Done` · `Blocked` · `N/A` · `All`

- **`Open` is an EXCLUSION of the terminal statuses** (`done`, `n_a`) — written
  `!TERMINAL.has(status)`, never a whitelist of the owed three. Fail-safe
  direction: a sixth status added later defaults to **visible** rather than
  silently disappearing from the default view.
- `TERMINAL_CELL_STATUSES` is declared **independently** of
  `OWED_CELL_STATUSES`, not as its complement, even though the two partition
  today's five statuses. A complement-of-whitelist inverts the fail-safe: a
  status added to `CELL_STATUSES` and left out of `OWED` would be auto-classified
  terminal and hidden. The sets encode opposite intents — `OWED` must not
  over-*count*, this must not over-*hide*.
  **See §5 for the honest limit on how well that is enforced.**
- Per-status labels come from the shared `CELL_STATUS_LABEL`, so the filter and
  the editor dropdown beside it **cannot** spell a status two ways.

### Pure logic — `lib/client-library/pulse.ts`

`TERMINAL_CELL_STATUSES` · `BRAND_STATUS_FILTERS` ·
`BRAND_STATUS_FILTER_LABEL` · `effectiveCellStatus` ·
`matchesBrandStatusFilter` · `filterBrandDirectiveRows`.

It lives in `pulse.ts` rather than a sibling `brand-controls.ts` because it is a
projection of `brandDirectiveView`'s output directly above it — one module for
the brand page's pure logic, tested by `tests/pulse-shell.test.ts`.

`effectiveCellStatus(cell)` (`cell?.status ?? 'n_a'`) is **one** definition
consumed by the row render, the filter, and the count, so the three cannot
disagree about a cell-less row.

**Accepted consequence:** a cell-less directive (brand added after the directive;
Phase A has no backfill) reads `n_a` and is therefore **hidden under the default
filter**. Nothing actionable is lost — such a row is non-interactive anyway
(`editable = isAdmin && !!cell`) — and it is included in the hidden count, so its
existence is never silent.

### Readouts — load-bearing, not decoration

Because the default **hides** rows the user never asked to hide, the count is the
only thing that stops the first paint from reading as "this brand has 18
directives."

- `N of M directives` (or `M directives` when nothing is hidden). **M is derived
  from the loaded row list, never a literal.**
- Hidden correction: `N directives hidden by this filter.` + **Show all**.
- Both live in **ONE polite live region** with the count (the matrix's LOW-7
  lesson: a bare announced count lets "0 directives" *affirm* a false "there's
  nothing here" reading).
- Unlike the matrix, the correction is **not** gated behind a search — there is
  no search box here, and the hiding is a default rather than a user action. Copy
  is search-neutral: it never claims a "match."

**Judgment call, submitted for scrutiny:** there is **one** *Show all* button,
in the live region, which renders in **both** shapes — the zero-row card points
at it instead of rendering a second copy. This follows the matrix's LOW-7
precedent verbatim (*"don't duplicate the button here"*). The alternative — a
second button in the empty card — is closer to the letter of the ask ("offer a
reset in both shapes") and easier to spot when the list is empty. Flagged rather
than buried; trivially changed.

### Zero-row state

Filter-aware, naming the active filter, distinct from "this brand has no
directives at all" (both stay reachable — on a brand with dozens of rows a
filtered-out view otherwise reads as a data-loading bug).

### Interaction

- **Filter change closes the open edit strip** — never leave a strip mounted for
  a row that just left the DOM.
- The filter is **not** reset on brand→brand nav, mirroring the matrix (whose
  search/status/sort survive a project switch) and making "walk the brands
  looking at everything Blocked" work.
- **Saving to `Done` or `N/A` under the default filter EJECTS the row.** Kept —
  matches the matrix's accepted LOW-5 and the `/dashboard/logs` needs-review
  precedent. The save toast is emitted by `saveDirectiveCell`, independent of
  whether the row still renders, so the edit does not read as lost.

---

## 3. Change 3 — matrix *Hide paused brands* defaults to checked

Initial state only. The hide-paused **logic is untouched** — it still hides
**columns** and `buildMatrixRows` still takes no `hidePaused` argument.

### Safety precondition — RE-MEASURED, not inherited

The 2026-07-29 batch justified this as count-neutral on numbers that are now
**void** (prod has since grown 76 → 82 active directives). Probed directly
against prod **2026-07-31**:

| | |
|---|---|
| Active projects | 2 — NBLYCRO, SPLCRO |
| NBLYCRO active brands | 16 |
| NBLYCRO active directives | **82** → 1,312 expected cells (table holds 1,313; 1 is SPLCRO's) |
| Paused **active** brands | **3** — SHG, MRR-CA, WDG |
| Their cells (active directives only) | **246** |
| Status breakdown | `n_a = 246` |
| **Non-`n_a`** | **0** |
| **Owed** (`todo`/`in_progress`/`blocked`) | **0** |

**Verdict: count-neutral.** Hiding those columns changes no Outstanding number on
screen. SPLCRO has 0 paused brands, so the toggle isn't rendered there at all.

Had any paused cell been owed, the correct action was to **stop and report** — a
checked-by-default toggle would hide real work, and changing a visible
Outstanding count is outside a render-only profile.

### Not persisted

No `sessionStorage`, no channel. A reload shows every column again, same as the
other three controls.

### Consequence to state, not to fix

With hide-paused ON by default, the previously-accepted **LOW-3** behaviour is
now the **default** path rather than an opted-into one: the editor lookup goes
through `visibleBrands`, so a paused brand's cells cannot be opened without
unchecking first, and toggling discards an unsaved note in one. Karen verified no
lock-up (a stale `expandedCell` is inert; another dot re-targets cleanly) and
endorsed keeping it on the brand axis, which spec §6 of that batch never covered.
It stays as-is — but it is now reachable without the user choosing it. Named here
so the next reviewer does not rediscover it.

---

## 4. Ride-along — one `CELL_STATUS_LABEL`

The status→label map existed as **three** identical private copies (matrix page,
brand page, `CellEditStrip`). The brand page now renders a status **filter** and
an editor **dropdown** side by side, and two spellings of one status on a single
page is a defect — so the guarantee is made **structural** (`CELL_STATUS_LABEL`
in `directives.ts`, the canonical status module) rather than conventional. Pure
const move; no behaviour change. A test pins that
`BRAND_STATUS_FILTER_LABEL[status] === CELL_STATUS_LABEL[status]`.

---

## 5. Verification

`tsc --noEmit` 0 · ESLint **zero** findings on all six touched files ·
**108/108** tests (98 pre-existing + 10 new) · `npm run build` exit 0 with
`/dashboard/pulse` `○`, `/dashboard/pulse/[projectKey]/[brandCode]` `ƒ`, **no new
route entries**.

### Mutation-verified, because a test that passes on the broken version is not a test

| Mutation | Result |
|---|---|
| `open` rewritten as a **whitelist** of the owed statuses | **1 failure** — the fail-safe test, and *only* that test |
| `effectiveCellStatus` returns `todo` instead of `n_a` for a cell-less row | **4 failures** |
| `TERMINAL_CELL_STATUSES` rewritten as the **complement of `OWED`** | **0 failures** |

### The honest limit — recorded because the third row above matters

**No test in this suite can catch the complement refactor.** The complement form
keeps all 16 pulse tests green, *including* the fail-safe test — an unknown
status is absent from the derived list too, so it still reads non-terminal. The
two forms diverge only once a sixth status is added **to `CELL_STATUSES`** and
omitted from `OWED`, and a test cannot construct that: `CELL_STATUSES` is a
compile-time const.

So the independent declaration is a **review-level invariant**, and the comment
on `TERMINAL_CELL_STATUSES` is its *only* enforcement. This is stated in both the
lib and the test file. Do not read the green suite as proof it is protected —
that is exactly the shape §15 records as *"if a check can only be satisfied by
the same artifact that produced the value, it is not a check."* An earlier draft
of the test comment asserted that the fail-safe test *did* catch it; mutation
run 3 disproved that, and the claim was corrected rather than left standing.

---

## 6. Out of scope — not built, not snuck in

Search box or sort control on the brand page · KPI strip · hover-inspect readout
· Change Log widget · family/grouping · hiding paused **clients** from the Pulse
nav (`pulse-client-nav.tsx` diff is **0 lines**) · anything else from the restyle
handoff. The restyle is the **next** batch and touches these same files — the
diffs are kept separable.

---

## 7. Post-deploy click list (Lacey — the real bar)

1. **Brand page:** the status pill reads as a control (fill + border) and only
   the pill is clickable — clicking the title or description does nothing.
2. Read-only user: statuses render as **plain text**, no chip, no button.
3. Default filter is `Open`; the readout says `N of M directives` with
   `… hidden by this filter · Show all`, on a **one-row** control bar.
4. **Show all** reveals the Done / N-A rows and the count settles to
   `M directives` with no correction line.
5. Pick `Done` → only Done rows. Pick `N/A` → includes any hollow cell-less rows.
6. Open an editor, then change the filter → the strip closes.
7. Save a row to `Done` under `Open` → the row leaves the list **and the toast
   still appears**.
8. A filter with no matches → filter-aware empty card, and *Show all* above is
   still reachable (**judgment call in §2** — say if you want a button in the
   card instead).
9. **Matrix:** *Hide paused brands (3)* is **checked** on load, 3 columns absent,
   and **no Outstanding number differs** from unchecking it.
10. Reload → still checked (default), not persisted state.
11. SPLCRO → no hide-paused checkbox at all.
