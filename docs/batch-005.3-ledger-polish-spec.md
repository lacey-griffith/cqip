# Batch 005.3 — Coverage Ledger polish (spec)

**For:** Claudette (build) · **Author:** DC · **Date:** 2026-07-08
**Repo:** `lacey-griffith/cqip` · `cqip.l-hay.workers.dev`
**Intended repo path:** `docs/batch-005.3-ledger-polish-spec.md`
**Status:** Draft for Lacey review → commit as 005.3 Commit 1 (docs-only).
**Read order:** this spec → `components/coverage/coverage-ledger.tsx` (the file
most of this touches) → `docs/HANDOFF-batch-005.3-ledger-polish.md` (origin).

---

## 0. One-line
UX polish on the 005.2 Coverage Ledger (shipped 2026-07-08, `324677a`). Read-only
render/interaction fixes surfaced in 005.2 smoke. **No migration, no new route, no
new mutation surface, no new token, no new dep, no Jenny.** Reuses the 005.2 ledger
components + `--ledger-*` tokens.

## 1. Context — do NOT relitigate
005.2 merged Output + Pipeline into one accordion ledger (summary row + inline
expand: 7-day sparkline, delivery stats, 5 pipeline-stage cards, locked §15
four-chip set). Chip loudness (bright-solid fills, On Hold gray), KPI full-scope,
shared `isInDrought` predicate, no hardcoded threshold, Reggie drawer + BW CTA —
all **locked from 005.2 and out of scope here.**

## 2. Scope — LOCKED changes

All changes verified against the shipped code (`coverage-ledger.tsx`,
`app/dashboard/coverage/page.tsx`, `pipeline-stage-drawer.tsx`) on 2026-07-08.
Colors come from existing `--ledger-*` / `--f92-*` tokens — **no inline hex.**

### 2.1 Remove the top-level "Live · ready / total" summary column
Summary column set drops **5 → 4**: Brand · Delivered 28d · This Wk · Pipeline.

`coverage-ledger.tsx`:
- `LedgerSortKey`: drop `'live'` → `'brand' | 'delivered' | 'thisWk' | 'pipeline'`.
- `SORT_COLUMNS`: remove the `{ key: 'live', label: 'Live · ready / total', ... }` entry.
- `GRID`: remove the Live column's `96px` track.
  `'22px 4px minmax(220px,1.3fr) 120px 92px 96px minmax(280px,1.5fr)'`
  → `'22px 4px minmax(220px,1.3fr) 120px 92px minmax(280px,1.5fr)'`.
  Give the freed width to the Pipeline ready/WIP bar — bump the pipeline track's
  minmax floor (e.g. `minmax(320px,1.7fr)`); tune at smoke.
- Delete the summary-row `{/* live */}` cell (the `live.total === 0 ? '—' : live.ready`
  block with its `/ {live.total}`).

`app/dashboard/coverage/page.tsx`:
- Remove `case 'live': cmp = a.live.ready - b.live.ready;` from the sort `switch`.
  (Dropping `'live'` from `LedgerSortKey` makes tsc flag this case — it MUST go.)
- `SortKey = LedgerSortKey | 'status'` stays; the union narrows automatically.

**Why (Lacey's workflow rule):** a live test never carries a hold tag — if a live
test develops an issue it becomes a quality log and leaves Live. So for Live,
`held` is structurally 0 and `ready === total` always. A column whose ratio is
always N/N carries no information.

**Consequence:** this drops a sort key that 005.2 §3.4 locked (five sortable
columns incl. Live). **The sort contract is now four columns.** The on-ship §16
entry records this supersede. Expand-state-survives-sort is unaffected (the open
Set is keyed by `brand.id`, order-independent).

### 2.2 Live stage card — show presence, not a fraction — but stay defensive
In the expanded detail (`stages.map`), the **Live** stage card renders **presence**,
not `ready / total`.

- Identify Live as the last pipeline stage — `lr.live` is `stages[4]`; inside the
  map, `const isLive = st.stage === <Live literal from pipeline-stages.ts>`
  (confirm the literal; it is the `PIPELINE_STAGES[4]` / `STAGE_LABELS` key for Live).
- **Clean case** (`isLive && st.held === 0`): big number = `st.total`, caption
  **"live"** (no `/N`, no ready/total split). If `st.total === 0`, render the
  existing `—`.
- **CRITICAL — do NOT hardcode `held === 0` for Live.** Three paths can still put a
  tag on a live row: tag-applied-before-status-transition caught mid-sync, 5am
  cron/sync lag, dirty historical data. In every one, a tag on Live is exactly the
  anomaly to SURFACE. So: **if `isLive && st.held > 0`, fall back to the normal
  stage-card render** (ready/total + segment bar + chips), identical to the other
  four stages. Clean in the 99%, honest in the 1%. This defensiveness is the point —
  do not optimize it away.
- Stage-name link (§2.3) still applies to the Live card: clickable when `st.total > 0`.

### 2.3 Stage name becomes the drawer link (retire "view →")
In each stage card header, make the **stage name itself** the clickable target that
opens `PipelineStageDrawer` via `onStage(row, st.stage)`. Retire the separate
`view →` button.

- `st.total > 0`: stage name is a `<button>` reading `STRATEGY →` / `DESIGN →` / etc.
  (label + " →"), hover + focus-visible underline, `--f92-navy` → hover `--f92-orange`.
- `st.total === 0`: plain non-clickable span, **no arrow, no link** (no dead drawer).
- Remove the old `view →` button block entirely.

### 2.4 Pipeline-stage drawer subheader reword
`pipeline-stage-drawer.tsx`, `SheetDescription`:
`{tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'} in stage`
→ `{tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'} gated in {stageLabel}`
(`stageLabel` is already a prop, e.g. "Dev" → "1 ticket gated in Dev").

### 2.5 "Full detail →" — button, not text link
In the expanded delivery-detail column, restyle the `onFullDetail(row)` affordance
from a text link to a **secondary/outlined button** (border `--f92-border`, padding,
rounded, `--f92-navy` text, hover `--f92-orange`). Keep the "→" and its placement at
the bottom of the delivery column. It was too easy to miss in smoke.

### 2.6 Default state: all collapsed on load — ALREADY SATISFIED
The ledger inits `open` to an empty `Set` and the page never force-opens a row.
**No code change.** Claudette: confirm no regression (no auto-expanded top row on
load); do not add auto-open.

### 2.7 Numeral color-coding by drought/active state
Color the **Delivered-28d and This-Wk** summary numerals by brand status instead of
the current zero-vs-nonzero logic. Source from tokens:
- paused (`brand.is_paused`) → keep muted `--f92-lgray` (paused is neither
  drought nor active; row is already `opacity-75`).
- drought (`row.droughtFlag`) → `--ledger-drought`.
- active (else) → `--ledger-active`.

Applies to **both** numerals (Delivered-28d `text-[22px]` cell + This-Wk
`text-[15px]` cell), replacing both current `=== 0 ? var(--f92-lgray) : var(--f92-dark)`
inline conditions.

### 2.8 Paused legend swatch
When "Show paused brands" is on, add a **Paused** swatch to the ledger legend
(currently only Drought + Active show), using `--ledger-paused`.
- Add `showPaused: boolean` to `CoverageLedgerProps`.
- Pass it from the page (`showPaused` state already exists there):
  `<CoverageLedger ... showPaused={showPaused} />`.
- Render the Paused legend item only when `showPaused` is true, matching the
  existing Drought/Active swatch markup (2px rounded square + `--ledger-paused`).

## 3. Collapse-all / expand-all — FOLDED IN (Lacey confirmed 2026-07-08)
Near-free given the shipped architecture. The `open` state is a single
`useState<Set<string>>` in `CoverageLedger`; no state lift is needed (the handoff's
cost estimate assumed per-row state — it is not).

- Two small text buttons in the ledger header (right side, alongside the legend):
  **Expand all** / **Collapse all**. Style like the sort-header buttons (text,
  `--f92-gray` → hover `--f92-dark`).
- Handlers on the existing state:
  - Expand all → `setOpen(new Set(rows.map(lr => lr.row.brand.id)))`
  - Collapse all → `setOpen(new Set())`
- Operates on the `rows` prop = the currently filter/paused-scoped set, so
  "expand all" expands exactly what's visible. Survives sort (Set keyed by id).
- Disable/hide both when `loading` or `rows.length === 0`.

## 4. Files touched
- `components/coverage/coverage-ledger.tsx` — §2.1, §2.2, §2.3, §2.5, §2.7, §2.8, §3.
- `app/dashboard/coverage/page.tsx` — §2.1 (sort case), §2.8 (pass `showPaused`).
- `components/coverage/pipeline-stage-drawer.tsx` — §2.4.

No other files. No `globals.css` change (all tokens exist). No `lib/` change.

## 5. Explicitly NOT in scope
- No change to chip loudness, KPI scope, drought predicate, sparkline data, or any
  005.2-locked behavior.
- No migration, no new route, no new mutation surface, no schema change, no new token.
- Reggie drawer / BW CTA untouched (still awaiting their own re-home batch).
- No new charting/other dep.

## 6. Process
- **No Jenny.** Read-only render/UX; the stage-name link reuses the existing
  `PipelineStageDrawer` (no new surface); no mutation, migration, or route.
- **Commits (committed, NOT pushed):**
  1. **Docs** — this spec at `docs/batch-005.3-ledger-polish-spec.md` + a §15.5
     in-flight entry (r34) + collapse the §15 backlog pointer to "005.3 in flight →
     §15.5".
  2. **Build** — §2.1–§2.8 + §3, with an atomic `CLAUDE.md` update (§15.5 status
     per r34). **Version:** recommend **no bump** — render/UX only, no new
     structural surface / schema / route (mirrors the 005.2 commit-3 no-bump
     rationale); confirm at commit time.
- `tsc` clean, `npm run build` green (`/dashboard/coverage` prerenders),
  `tests/coverage-kpis.test.ts` still 5/5 (this batch doesn't touch KPI calc — the
  Live-column removal is render-only), ESLint zero new findings.
- **DO NOT PUSH.** Karen post-flight → Lacey smokes both themes → Lacey pushes.
- **On ship (after push):** docs reconcile commit — §15.5 removed, full §16 entry
  written (records the 5→4 sort-contract supersede of 005.2 §3.4), per r34.
  Mirrors 005.2's `324677a`.

## 7. Smoke (Lacey, post-Karen)
- Live column gone; 4 summary columns; sort works on all four; expand state
  survives a sort.
- Expand a row: Live card shows presence ("N live"), no `N/N`. (If any brand shows
  a tag on Live, confirm the card renders it — the defensive path working.)
- Stage name opens the stage drawer; empty stage name is non-clickable, no arrow.
- Drawer subheader reads "N ticket(s) gated in [status]" with correct plural.
- "Full detail →" reads as a button, easy to find; opens the Reggie drawer (intact,
  BW CTA present).
- All rows collapsed on load.
- Delivered-28d / This-Wk numerals color-differentiate drought vs active (paused muted).
- Show-paused on → "Paused" legend swatch appears.
- Expand all / Collapse all work; expand-all expands only the visible (filtered) set;
  state survives a sort after using them.
- Both themes clean (dark: F92 chrome, accents matched).

---

## 8. Claudette prompt (ready to send)
```
Batch 005.3 — Coverage Ledger polish. Read-only render/UX on the 005.2 ledger.
Canonical spec: docs/batch-005.3-ledger-polish-spec.md (build from it; this is
orientation). No migration, no route, no new mutation surface, no new token, no
new dep, no Jenny.

Files: components/coverage/coverage-ledger.tsx (most of it),
app/dashboard/coverage/page.tsx (sort case + one prop),
components/coverage/pipeline-stage-drawer.tsx (subheader).

COMMIT 1 — docs
- Save the spec to docs/batch-005.3-ledger-polish-spec.md.
- CLAUDE.md: add a §15.5 in-flight entry for 005.3 (r34); collapse the §15
  backlog pointer to "005.3 in flight → §15.5". Docs-only.

COMMIT 2 — build (all from spec §2 + §3)
- §2.1 Remove the top-level "Live · ready/total" summary column: drop 'live' from
  LedgerSortKey, from SORT_COLUMNS, from the GRID (the 96px track), delete the
  summary-row live cell, and remove the `case 'live'` in the page sort switch. Give
  freed width to the pipeline bar (bump its minmax floor). Sort contract is now 4
  columns.
- §2.2 Live stage card = presence ("N live", no /N) when clean (held === 0); if a
  hold tag is ever present on Live (held > 0), fall back to the normal stage-card
  render (ready/total + bar + chips). DO NOT hardcode held === 0 — the anomaly must
  surface. Identify Live as PIPELINE_STAGES[4] / the Live STAGE_LABELS key.
- §2.3 Stage NAME becomes the PipelineStageDrawer link (label + " →", hover/focus
  underline) when st.total > 0; retire the separate "view →" button; empty stage =
  plain non-clickable span, no arrow.
- §2.4 Drawer subheader: "{n} ticket(s) in stage" → "{n} ticket(s) gated in
  {stageLabel}" (pluralize on count).
- §2.5 "Full detail →": text link → secondary/outlined button, same placement.
- §2.6 All-collapsed on load is ALREADY the behavior — no change; just verify no
  regression, do not add auto-open.
- §2.7 Color Delivered-28d + This-Wk numerals by status: paused → --f92-lgray,
  drought (row.droughtFlag) → --ledger-drought, active → --ledger-active. Both
  numerals. Replace the current zero-vs-nonzero conditions. Tokens only, no hex.
- §2.8 Paused legend swatch: add showPaused:boolean to CoverageLedgerProps, pass it
  from the page, render a Paused swatch (--ledger-paused) in the legend only when
  showPaused is true.
- §3 Expand all / Collapse all: two small header buttons operating on the existing
  `open` Set — expand = new Set(rows.map(lr => lr.row.brand.id)), collapse = new
  Set(). Disable when loading or rows.length === 0. No state lift.

Atomic CLAUDE.md per r23 (§15.5 status). Version: no bump (render/UX only, no new
surface) unless you see a reason — flag if so. tsc clean, build green,
coverage-kpis 5/5, ESLint zero new. Separate commits. DO NOT PUSH. Report → Karen.
```
