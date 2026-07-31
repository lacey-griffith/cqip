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

## 0.5 Follow-on (2026-07-31, after the first three commits were pushed) — the edit target moved to the status DOT

The pill was the wrong element. The intent was **matrix consistency**, and on the
matrix the **dot** is the target — so the brand page's leading status dot is now
the control too: shorter travel from where the eye already scans, and one mental
model across both surfaces. §1 below records the pill version as shipped history;
this section supersedes its *target and styling*.

**Target and affordance moved together, as one change** — they cannot separate. A
chip that reads as clickable but isn't is worse than the flat label we started
with:

- The leading **status dot** is a real `<button>`. `editable = isAdmin && !!cell`
  unchanged; non-admins and cell-less rows get a plain inert `<span>` dot, never a
  disabled button.
- The right-hand pill **reverts to an inert `<span>`** and **loses** the
  bordered-chip styling from `3363629`.
- The action-leading aria-label **moved to the dot verbatim** — `Edit status for
  {title}: {status}`. The pill keeps **no accessible name of its own**: one control
  per row, not two, or a screen-reader user hears every row twice.
- Copy updated to stay true: *"Click a status **dot** to edit it for this brand."*

**Affordance mirrors the matrix, not invented:** `hover:ring-2` +
`focus-visible:ring-2` in `--f92-orange`, and while a row is being edited the dot
takes the matrix's orange ring so both surfaces read identically mid-edit
(`ring-offset-2` separates ring from dot the way the matrix's larger button does).

**Hit area — 24×24, verified by arithmetic not by eye.** The visual dot stays 12px.
`after:absolute after:-inset-1.5 after:content-['']` expands the *clickable*
region only: `--spacing` is `.25rem` = 4px, so `-inset-1.5` = **−6px** per side →
12 + 2×6 = **exactly 24×24 CSS px** (WCAG 2.5.8). The pseudo-element contributes
**nothing** to layout, so the dot does not move and the row height is untouched —
and the dot is *not* scaled up to fake a bigger target. A 24×24 button like the
matrix's would have shifted this row's text right; the matrix can afford that
because its dot sits alone in a table cell.

**No inline `style` on the dot at all.** The status→colour map became
`STATUS_DOT_CLASS` (classes, not a `style` object) specifically because the dot now
carries `hover:ring-*` / `focus-visible:ring-*`: an inline declaration beats an
author-stylesheet rule absent `!important`, so leaving a `style` prop here would be
one refactor away from re-creating the `3363629` dead-hover regression. (The matrix
still uses an inline style for its dots — untouched this commit, and its dot has no
colour-carrying hover rule to break.)

### Compiled-CSS verification — the check that caught `3363629`

Extracted from the built chunk, because a class-list review provably cannot see
this class of bug:

```
.hover\:ring-\[color\:var\(--f92-orange\)\]:hover          { --tw-ring-color:var(--f92-orange) }
.hover\:ring-2:hover                                       { --tw-ring-shadow:… ; box-shadow:… }
.focus-visible\:ring-\[color\:var\(--f92-orange\)\]:focus-visible { --tw-ring-color:var(--f92-orange) }
.ring-\[color\:var\(--f92-orange\)\]                       { --tw-ring-color:var(--f92-orange) }   ← the editing ring
.after\:content-\[\'\'\]:after                             { --tw-content:""; content:var(--tw-content) }
.after\:-inset-1\.5:after                                  { inset:calc(var(--spacing) * -1.5) }
.after\:rounded-full:after                                 { border-radius:… }
.ring-offset-2                                             { --tw-ring-offset-width:2px; … }
.ring-offset-\[color\:var\(--f92-surface\)\]               { --tw-ring-offset-color:var(--f92-surface) }
background-color:var(--f92-lgray|--status-in-progress|--status-resolved|--status-blocked)  ← 1 rule each
.border-dashed                                             { border-style:dashed }   ← the n_a hollow dot
```

`after:content-['']` mattering is not hypothetical: without it the pseudo-element
never renders and the 24×24 hit area would silently not exist.

`ring-offset-[color:var(--f92-surface)]` is correct in **both** themes — verified,
not assumed: `Card` is `bg-white`, `--f92-surface` is `#FFFFFF` in `:root`, and
`app/globals.css:307` maps `:root[data-theme="dark"] .bg-white` →
`var(--f92-surface)`. So the offset gap always matches the real card background.

### Contrast, both themes — stated including the one that falls short

| | ratio | |
|---|---|---|
| Orange ring vs card — **light** | **2.76:1** | **under 3:1** |
| Orange ring vs card — dark | 4.34:1 | ok |
| Dot fill `todo`/`n_a` (`--f92-lgray`) — light | 2.54:1 | under 3:1 |
| Dot fill `todo`/`n_a` — dark | 3.30:1 | ok |
| Inert status label (`--f92-gray`) — light / dark | 4.83:1 / 6.13:1 | ok |

Two shortfalls, both **pre-existing and deliberately not fixed here**:

1. **The orange focus/hover ring at 2.76:1 in light mode** is the app-wide focus
   ring (`focus-visible:ring-[color:var(--f92-orange)]` appears on buttons, filter
   controls, and the matrix dot). WCAG 1.4.11 covers focus indicators, so this is a
   real AA shortfall — but it is a **design-token decision**, and "fix it on this
   one dot" directly contradicts the requirement that both surfaces read
   identically. **Flagged for Lacey as a token-level call**, not changed
   unilaterally.
2. **The `--f92-lgray` dot fill at 2.54:1 light** is unchanged by this commit, and
   1.4.11 does not bite: the status is *also* rendered as text in the same row (the
   inert label), so the dot is never the sole carrier of that information.

### Unchanged, confirmed

`CellEditStrip` and everything in it · save / reconcile / toast · the `liveKeyRef`
staleness guard · the render branch order · the status filter and its hidden-count
hint · `countHiddenOwedCells` · **`app/dashboard/pulse/page.tsx` — 0-line diff in
this commit.**

---

## 1. Change 1 — brand-page edit trigger *(superseded by §0.5 — kept as shipped history)*

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
  `--f92-gray` border, `--pill-filter-fg` text; on hover the fill lifts to
  `--pill-filter-bg-hover` and border + text go orange. Tokens only (§13 r25) —
  no inline hex, **and no inline `style` for any color** (see §5, Karen
  MEDIUM-1/2/3).
  - The **border is the discriminator**: the inert `TYPE_LABEL` badge two lines
    up wears the same `--pill-filter-bg` fill, so fill alone cannot say
    "control". `--f92-gray` is a deliberate step up from the `--f92-border` the
    app's outline `Button` uses (1.4:1) — it clears the 3:1 non-text threshold
    in **both** themes (4.5:1 light / 5.9:1 dark).
  - Text is `--pill-filter-fg`, the fill's **matching** token, not `--f92-navy`:
    in dark mode `--f92-navy` is `#4A5AB9`, which lands at **2.42:1** on this
    fill — an AA failure and *worse* than the plain `--f92-gray` span it
    replaced. `--pill-filter-fg` is 11.0:1 light / 9.6:1 dark.
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
| Active projects | **3** — NBLYCRO, SPLCRO, HDCRO |
| NBLYCRO active brands | 16 |
| NBLYCRO active directives | **82** → 1,312 expected cells (table holds 1,313; 1 is SPLCRO's) |
| Paused **active** brands | **3** — SHG, MRR-CA, WDG |
| Their cells (active directives only) | **246** |
| Status breakdown | `n_a = 246` |
| **Non-`n_a`** | **0** |
| **Owed** (`todo`/`in_progress`/`blocked`) | **0** |

**Verdict: count-neutral.** Hiding those columns changes no Outstanding number on
screen. SPLCRO and HDCRO have 0 paused brands, so the toggle isn't rendered there
at all.

> **The projects row was already stale when first written** (Karen LOW-1, folded).
> The original probe ran 16:16Z and reported "2 — NBLYCRO, SPLCRO". `HDCRO` /
> *Heartland CRO* (`multi_brand`) was created **17:14:24Z** — an hour after the
> probe, 45 min before the commit. Re-verified: it has 0 brands and 0 directives,
> so `pausedBrandCount === 0` and the toggle is not rendered for it; the safety
> conclusion is unaffected. Recorded rather than quietly patched, because a batch
> whose whole discipline is *"the 2026-07-29 numbers are void, re-measure"* had a
> fact rot inside 45 minutes — the shelf-life of a prod measurement is shorter
> than one work session.

Had any paused cell been owed, the correct action was to **stop and report** — a
checked-by-default toggle would hide real work, and changing a visible
Outstanding count is outside a render-only profile.

### The precondition is now checked at RUNTIME, not just measured (Karen MEDIUM-4)

The measurement is a snapshot, and nothing in the app enforced it:
`PATCH /api/admin/directives/status` never consults `is_paused`, and the brand
page will set any status on a paused brand's cell. **One ordinary admin edit could
invalidate it** — after which a row would read `Outstanding 1` with no owed dot
visible anywhere in it, unreachable from the matrix until someone thought to
uncheck a box. Before this batch the user had to opt into that state; the flip
would have made it the landing state.

So the matrix now derives `countHiddenOwedCells(brands, cells, hidePaused)`
(`lib/client-library/matrix-controls.ts`, reusing `outstandingCount` so it cannot
fork the owed set) from already-loaded data and renders an amber warning +
**Show paused** when it is non-zero. Silent in normal operation; self-announcing
the moment the invariant drifts. Four tests, all three mutations caught (§5).

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

`tsc --noEmit` 0 · ESLint **zero** findings on all touched files · **112/112**
tests (98 pre-existing + 10 filter + 4 guard) · `npm run build` exit 0 with
`/dashboard/pulse` `○`, `/dashboard/pulse/[projectKey]/[brandCode]` `ƒ`, **no new
route entries**.

### Mutation-verified, because a test that passes on the broken version is not a test

| Mutation | Result |
|---|---|
| `open` rewritten as a **whitelist** of the owed statuses | **1 failure** — the fail-safe test, and *only* that test |
| `effectiveCellStatus` returns `todo` instead of `n_a` for a cell-less row | **4 failures** |
| `TERMINAL_CELL_STATUSES` rewritten as the **complement of `OWED`** | **0 failures** — see the honest limit below |
| `countHiddenOwedCells` always returns 0 (never warns) | **2 failures** |
| ...counts **all** paused cells, not just owed ones | **3 failures** |
| ...ignores `hidePaused` (warns when columns are visible) | **1 failure** |

### The CSS fixes were verified in the COMPILED stylesheet, not in the class list

That distinction is the entire content of Karen MEDIUM-2: the first cut set
`color` / `borderColor` in an inline `style`, and an inline declaration beats an
author-stylesheet rule regardless of specificity unless the stylesheet says
`!important`. Tailwind's `hover:` variants *are* author-stylesheet rules, so both
advertised hover effects were dead — while the commit message, this spec, and
CLAUDE.md all claimed "orange on hover." A class-list review cannot see that.

All colors moved into `className`; the pill's JSX now contains **no inline
`style`** at all. Extracted from the built chunk:

```
.hover\:bg-\[color\:var\(--pill-filter-bg-hover\)\]:hover { background-color:var(--pill-filter-bg-hover) }
.hover\:border-\[color\:var\(--f92-orange\)\]:hover       { border-color:var(--f92-orange) }
.hover\:text-\[color\:var\(--f92-orange\)\]:hover         { color:var(--f92-orange) }
.text-\[color\:var\(--pill-filter-fg\)\]                  { color:var(--pill-filter-fg) }
.border-\[color\:var\(--f92-gray\)\]                      { border-color:var(--f92-gray) }
```

Each `hover:` rule is `class + pseudo-class` (0,2,0) against the base utility's
(0,1,0), so hover wins with nothing inline to beat it. The idle and editing
border classes are **mutually exclusive branches** — emitting both would leave the
winner to CSS source order rather than to the class string.

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

### Accepted as-is from the Karen pass (not defects)

- **LOW-2 — the live region is silent on FIRST paint.** Content present when a
  live region is created is generally not announced, and this region mounts with
  its content, so the one moment that matters most — the default filter hiding
  rows nobody asked to hide — is not spoken. Every later filter change announces
  correctly and the text is visible in reading order. `aria-atomic="true"` was
  added so the count and correction read as one sentence. A real fix means
  hoisting the region above the `!ready` gate, which collides with the
  DO-NOT-hoist render-branch order from `52dc69d` — not worth that trade.
- **LOW-3 — "Show all" destroys itself and drops focus** to `<body>`. Identical to
  the matrix's own "Show all statuses" button, so this is a **shared pattern worth
  fixing once across both surfaces**, not this batch's invention. Fixing it here
  only would leave the two inconsistent.
- **LOW-4 — a cell-less row hidden by default.** Zero such rows exist on NBLYCRO
  today (verified). The case that can fire: add a 17th brand (Phase A has no cell
  backfill — already a §15 item) and its Pulse page shows an empty list plus
  `0 of 82 directives · 82 hidden`, where before it showed 82 visibly-hollow rows.
  The anomaly moves from "obvious on sight" to "one click away"; the readout still
  does its job. Makes the §15 cell-backfill / target-picker item marginally more
  pressing.
- **aria-label convention drift** — the brand pill leads with `Edit status for …`
  while the matrix dot kept its trailing ` (edit)`. Both name the row and the
  status; no information lost, two conventions now coexist.
- `id="brandStatusFilter"` on the `SelectTrigger` references no label — dangling,
  but exactly matches the matrix's `id="matrixStatus"`.

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
   and **no Outstanding number differs** from unchecking it. No amber warning
   should appear (it only shows if a paused brand holds owed work).
10. Reload → still checked (default), not persisted state.
11. SPLCRO / HDCRO → no hide-paused checkbox at all.
12. **Dark mode** (Karen MEDIUM-1) — view the brand page with the dark theme on
    and confirm the status pill's label is legible.
13. **Hover a status pill in BOTH themes** (Karen MEDIUM-2) — fill should lift and
    the border + text should go orange. This is the effect that was dead in the
    first cut, so it is the single most important item on this list.
