# Batch G7 — grid tab-stop burden · skip-the-matrix link

**Board sequence:** #2 (head of the open sequence) · **Mode:** `auto` (Lacey, 2026-08-23)
**Gates:** no Jenny (render/interaction only) · Karen post-flight · Lacey pushes
**Depends on:** nothing. #1 (second extraction pass) shipped 2026-08-23; this ships
in a **separate push** — a shared chain means a G7 revert drags the restructure with it.
**Closes:** QMS finding **G7 — Grid tab-stop burden** (`REVIEW-cqip-qms-baseline-2026-08-02.md`),
interim half only. See §6 for what this batch deliberately does not close.

> **This file is the batch authority.** Per the PROCESS rule in `CLAUDE.md` §15,
> the spec is commit 1 and lands before the build starts. Cite it by section
> number; a spec paraphrased into bullets is not falsifiable.

---

## 0. Why this batch exists, in one paragraph

Restyle batch 3 removed `<button disabled>` from the matrix cells, because a
disabled control kills hover, focus and tooltip for exactly the read-only viewer
the cell readout exists for. That was correct and it is not being undone. Its
consequence is that read-only users went from **zero** tab stops on the matrix to
**one per rendered cell**. This batch gives every keyboard user a way past the
grid in one press. It does **not** convert the grid to `role="grid"` with a
roving `tabindex` — see §6.

---

## 1. Re-derived figures — probed 2026-08-23, NBLYCRO

**Per §13 r43 these are derived at write time, not transcribed.** Group by
`project_key` and filter on `status`; a cross-project product is meaningless
here.

| Quantity | Figure |
|---|---|
| Active directives | **84** |
| Archived directives | **4** |
| Active brands | 16 |
| Paused brands | 3 |
| **Visible brands (default view)** | **13** |
| **Cell tab stops, default view** | **1,092** |
| Brand-header tab stops, default view | **13** |
| **Total matrix tab stops, default view** | **1,105** |
| Cell tab stops, paused shown | 1,344 |
| Brand-header tab stops, paused shown | 16 |
| Total matrix tab stops, paused shown | **1,360** |
| Cells held by archived directives (not rendered) | 64 |

**G7's own `~1,300` is superseded.** It overstates the default view by ~200 and
was written against the 2026-07-31 grid (82 × 16 = 1,312) — a **paused-shown**
product, so it was never comparable to a default-view figure in the first place.

**⚠ THREE DIFFERENT QUANTITIES GET QUOTED AS "THE NUMBER". Name which one.**
Like for like, default view (`active directives × 13 visible brands`), the series
is **1,118 (08-14, 86 rows) → 1,092 (08-23, 84 rows)** — a net 26-stop drop worth
2 rendered rows, and **not monotonic**: 86 on 08-14, **87** on 08-18 (one
created), 84 on 08-23 (three archived). The `× 16` paused-shown products (1,312
on 07-31, 1,376 on 08-14) and the rendered-**cell** count (1,377 = 86 × 16 + 1 on
08-14) are the other two. **This spec's first draft spliced all three into one
series and read a 3-directive cause off a 2-row delta** — caught by Karen
post-flight, recorded here rather than quietly corrected, because it is the exact
r43 failure the rule exists to stop and it happened inside the batch that quotes
r43 four times.

**Two figures that moved since 2026-08-18 and are recorded here because nothing
else records them:** active directives went **87 → 84** and archived went
**1 → 4**. The 64 cells now held by archived directives are invisible to matrix
search and count 0 toward `hiddenByStatus` — the LOW-8 consequence, quadrupled.
**Out of scope for this batch**; filed so the board carries it.

**Admins have more stops than the figures above**, one extra per rendered row for
the directive-editor button. The G7 population is the read-only viewer, so the
figures are stated for that path; the skip link serves both.

---

## 2. The defect, framed correctly

**Promoted out of `docs/claude-archive/CLAUDE-16-2026-08.md` into live scope**,
because r40 makes the archive history and never authority, and §15's three-line
stub did not carry it.

- **This is a sighted-keyboard problem, not an assistive-technology one.** The
  cell note lives in the accessible name, and screen-reader browse mode does not
  use Tab. Do not write copy or tests that claim an AT benefit.
- **Each admin tab stop does something.** The stops are not junk; the problem is
  volume, not correctness.
- **The regression is relative.** A read-only keyboard user could previously Tab
  past the whole table in one step, because nothing in it was focusable. That is
  the capability being restored.
- **The 13 brand-header buttons are real buttons and they do cost 13 stops.**
  They sit at the very top of the grid, so the skip link clears them in the same
  press.

---

## 3. Scope

### 3.1 The skip link — required

- Renders **immediately before** the matrix scroll region (PART B, the
  `max-h-[65vh] overflow-auto` container in `app/dashboard/pulse/page.tsx`).
- **Visually hidden until focused**, then visible with the standard
  `--f92-focus-ring` treatment. It must never be a permanently visible control;
  this is not a new piece of page furniture.
- Label: **"Skip the directive matrix"**.
- Moves focus to the **end-of-matrix anchor** (§3.2), not to a URL fragment
  alone — a fragment scrolls without moving focus in several browsers.

### 3.2 The end-of-matrix anchor — required

- A single element rendered **immediately after** the matrix `Card`, carrying
  `tabIndex={-1}` and a stable `id`.
- **Always rendered when the grid is rendered**, independent of `hasFindings`.
  The "Needs action" section is conditional, and a skip link whose target
  disappears when there are no open findings would send focus nowhere on the
  quiet path — which is the majority path.

### 3.3 Conditional rendering — required

The skip link renders **only when the grid renders**. It must not render:

- while `loading`
- on the empty state (PART A), which has its own buttons and no grid
- when no project is selected

### 3.4 Extraction for test — required

Focus-order logic moves into **`lib/client-library/focus-order.ts`** as pure
functions over plain inputs. The page imports them; the page itself stays
untested, as every other route does.

The module must expose enough to answer, from state alone:

- whether the skip link renders
- the ordered sequence of focusable regions on the page
- how many grid tab stops that state implies, given directive and brand counts
- what the skip link's target is, and that the target is always present when the
  link is

### 3.5 Out of scope, stated so it is not folded in

- `role="grid"` + roving `tabindex` (§6)
- Any change to the cell button's `disabled` / `aria-disabled` treatment (§7)
- Any change to the brand-header buttons
- The Change Log widget and its Gate 0 counts — **that is board #3.** Its
  284-of-539 / 52.7% figures do not belong to this batch.

---

## 4. Acceptance

> **✅ ALL SIX PASSED 2026-08-23.** Items 1-3 (the manual ones) run by **Lacey**
> by hand in the browser, **both themes**, against the dev server — link appeared
> on Tab, Enter moved focus to the anchor, the next Tab left the grid, and the
> focused link was legible in dark mode. Item 6: **399/399**, `npm test`, run by
> Lacey. Items 4-5 verified in source.
>
> **⚠ ITEMS 1-3 ARE A HAND-RUN OBSERVATION, NOT COVERAGE** — the same
> distinction §15 draws for the 409 runbook's Scenario A. Nothing in `tests/`
> re-checks them, and nothing can: the harness models focus ORDER, and a link
> that never appears passes all 23 tests (§5). **A future change to the
> `sr-only focus:not-sr-only` classes, the `--f92-surface`/`--f92-focus-ring`
> tokens, or the anchor's position will not be caught by any gate in this repo.**
> Re-run these three by hand when any of those change.

1. A keyboard user on `/dashboard/pulse` reaches the skip link **before** the
   first brand-header button, and one press moves focus past all 1,105 default
   stops.
2. Focus lands on the end-of-matrix anchor, which becomes visible and reads "End
   of the directive matrix". The next Tab from there leaves the grid.
   **⚠ Do not phrase this as "reaches the Needs action panel":** `FindingCard`
   renders its controls **admin-only**, so for the read-only viewer this batch is
   scoped to, that panel may hold nothing focusable at all. The first draft stated
   the criterion for the wrong population.
3. The skip link is invisible until focused, and visible when focused.
4. No skip link on the loading, empty, or no-project states.
5. Cell and brand-header behaviour is byte-for-byte unchanged. This batch adds
   two elements and removes none.
6. `npm test` passes, including the new `tests/focus-order.test.ts`.

---

## 5. Test harness

**Shape:** pure-function unit tests, `node:test` + `node:assert`, matching the
convention of the **22 pre-existing files** in `tests/` (23 with this batch's).
**No new dependency** — the harness itself needs none, since `tsx` is already a
devDependency. `package.json` IS still modified, for the `test` script; see the
CI note below and §8.

**What it asserts:** everything in §3.4, plus the §3.3 negative cases and the
§3.2 invariant that link and target are present or absent together.

**What it cannot catch, stated rather than implied:** browser-level focus
failure. The harness asserts the *model* of focus order, not that a browser moves
focus. A `sr-only` class that fails to un-hide on focus, or a target that is
`display: none`, passes these tests. **That residue is why acceptance items 1–3
are manual, and they must be run before the push.**

**It also cannot catch the invariant it most looks like it covers.** The first
draft exported a `shouldRenderSkipTarget()` and asserted over all 32 states that
it agreed with `shouldRenderSkipLink()`. Both reduced to the same expression, so
the test could not fail while appearing to prove §3.2. Karen caught it; the export
and the test are gone. What actually guarantees link and target render together is
**structural** — `page.tsx` computes one `showMatrixSkipLink` const and gates both
JSX sites on it — and no unit test in this repo can reach it, because the page is
untested by design.

**CI wiring — Lacey, 2026-08-23.** A `test` script plus a test job in
`.github/workflows/deploy.yml`, with `deploy` gaining `needs: test`, covering all
23 files rather than only the new one.

- The `npm test` script half touches `package.json` — **it does trigger a
  deploy.** Expect `gen-build-info.js` to re-read the file. **✅ LANDED.**
- The workflow half touches `.github/**`, which is in `paths-ignore` — it does
  not trigger a deploy. **❌ NOT LANDED.**

> **⚠ THE CI HALF IS NOT DONE, AND ACCEPTANCE §4.6 IS NOT GATED BY ANYTHING.**
> `.github/workflows/deploy.yml` is a **protected file** that the remote tooling
> refuses to write, so the job was authored but not applied. **State right now:
> `npm test` exists and passes, and CI does not call it.** All 23 test files still
> run only when someone remembers — which is the precise gap this half was added
> to close. **Lacey must paste the job in by hand.** Recorded loudly because a
> `test` script in `package.json` plus a spec section written in the imperative
> reads as delivered, and a half-wired gate that looks wired is worse than an
> unwired one.

---

## 6. The deferred decision — `role="grid"` + roving tabindex

**Still open. This batch does not decide it and must not.** A grid of this size
conventionally wants a roving `tabindex` over `role="grid"`, which would take the
default view from 1,105 stops to roughly 1. That is a large blast radius across
cell activation, the editor strip, brand-header highlight and the sticky
scrollport.

**Standing gate, promoted out of the archive:** *decide this before adding
another focusable surface to the same page.*

---

## 7. Corrections riding along

Each is a stale or false claim about this exact surface, found while scoping. All
are documentation or comment changes except where noted.

1. **`CLAUDE.md` §15** carries an unchecked item asserting *"the matrix renders
   `<button disabled>` to non-admins."* **False against shipped source** —
   removing that is what created G7. Strike it, recorded as fixed rather than
   regressed.
2. **`docs/batch-012-pulse-restyle-3-spec.md` §2.6** asks for
   `aria-disabled="true"`. Shipped code does **neither** `disabled` nor
   `aria-disabled`, per DC's 2026-08-03 call on Karen MEDIUM-2. The spec was
   never amended, so a reader citing §2.6 by number — which PROCESS instructs —
   gets the wrong instruction. Amend it in place, with the decision and its date.
3. **`app/dashboard/pulse/page.tsx`** comment reads *"out of scope (G7, recorded
   against restyle batch 4)."* Batch 4 was dissolved in board rev 8. Update to
   the board sequence number. The archive copy is left alone — it is history.
4. **G7's `~1,300`** replaced by §1, stamped and labeled.
5. **`CLAUDE.md`** says board rev 8.1 and still marks #1 as *"← this pass"*;
   footer reads 2026-08-22. The outline is rev 8.2, dated 08-23. CLAUDE.md is the
   declared-canonical board and is the stale one.
6. **`REVIEW-cqip-qms-baseline-2026-08-02.md`** — G7's own definition still reads
   *"RECORDED against restyle batch 4."* Project-knowledge doc, so it is brought
   to Lacey with the outline update rather than edited here.

**Still owed, not touched:** `CROSS_CLAUDE.md` — footer 2026-07-17, §6 entries
through 08-08, §5 order last locked 07-15, and its §5 board contains no G7 at
all. It has now missed three consecutive batches. AC-facing, so coordinated per
CC7, never unilateral.

---

## 8. Push discipline

Separate push from #1. Docs-only commits skip CI via `paths-ignore`
(`**.md`, `docs/**`, `.github/**`) — but **this batch is not docs-only**: it
touches `page.tsx`, `lib/`, `tests/` and `package.json`, so it deploys. Verify in
the Actions log rather than assuming; the commit message predicts nothing, the
file list does.
