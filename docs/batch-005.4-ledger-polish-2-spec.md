# Batch 005.4 — Coverage Ledger polish, pass 2 (spec)

**For:** Claudette (build) · **Author:** DC · **Date:** 2026-07-09
**Repo:** `lacey-griffith/cqip` · `cqip.l-hay.workers.dev`
**Intended repo path:** `docs/batch-005.4-ledger-polish-2-spec.md`
**Status:** Draft for Lacey review → commit as 005.4 Commit 1 (docs-only).
**Number:** proposed 005.4 — clear on disk (no `batch-005.4` doc); confirm §15 before locking.
**Read order:** this spec → `components/coverage/coverage-ledger.tsx` → `lib/coverage/queries.ts`.

---

## 0. One-line
Second UX-polish pass on the Coverage Ledger, from Lacey's 2026-07-09 live review of
005.3. Read-only render/copy tweaks + one data-source swap (sparkline). **No migration,
no route, no new mutation surface, no new token, no new dep, no Jenny.**

## 1. Context — don't relitigate
005.3 (incl. the combined filter/control card) shipped + pushed 2026-07-08/09. This
pass adjusts what that review surfaced. Numbering matches Lacey's list (#1–#6a); #7–#9
are handled elsewhere (see §4).

## 2. LOCKED changes

Verified against shipped code 2026-07-09. Tokens only, no inline hex.

### #1 — revert the This-Wk summary numeral color; keep Delivered-28d
In the **summary row**, revert the **This-Wk** (`testsCurrentWeek`) numeral to its
original pre-005.3 color logic:
`color: row.testsCurrentWeek === 0 ? 'var(--f92-lgray)' : 'var(--f92-dark)'`.
**Leave the Delivered-28d** (`testsRolling28`) numeral on the §2.7 status coloring
(paused → `--f92-lgray`, drought `row.droughtFlag` → `--ledger-drought`, active →
`--ledger-active`) — Lacey is evaluating whether to keep that one. This partially
reverts 005.3 §2.7 (which colored both numerals).

### #2 — sparkline: 7-day daily → 12-month series
The `DeliverySparkline` is fed `row.daily7` (`dailyCounts`, trailing 7 calendar days).
At current milestone volume that series is almost always all-zeros → a flat line. It's
accurate, just the wrong granularity. Move it to a **12-month** series — the growth read
(ramp, seasonality, trajectory) Lacey cares about; brands <1yr old show leading zeros,
which visualizes the onboarding ramp rather than hurting anything.
- Feed the sparkline a **12-month** count series: `monthlyCounts(milestones, brand.id,
  12, now)`. `values={<12mo series>.map(m => m.count)}`.
- **Add a new `monthly12` field** (12-month series) rather than repurposing
  `row.monthly`. `monthly` (6mo) feeds the Reggie drawer's bar chart and stays exactly
  as-is. Building 12 as a reusable field now also serves the upcoming drawer 6/12 toggle
  (Batch 005.5), which will read both `monthly` and `monthly12`. Grep `.monthly` usages
  to confirm the drawer is undisturbed.
- **Keep `daily7` / `dailyCounts()` — do NOT remove.** Lacey wants the 7-day series
  parked for a possible future daily surface ("that's good info"); just stop feeding it
  to this sparkline.
- Adapt `DeliverySparkline` only if it hard-assumes 7 points (12 reads fine — more
  points, smoother shape). No caption/label change.

### #3 — stage-name typography cohesion (linked vs non-linked)
The linked stage-name `<button>` and the non-linked `<span>` **already share**
`text-[10px] font-semibold uppercase tracking-[0.04em]`. If they render at a different
size/family, it's a browser UA button-style leak. Normalize the button so its computed
typography is **identical** to the span (add `appearance-none` / explicit
`leading`/`font-family: inherit` if needed). The **only** intended visual differences
are color (navy link vs gray), the trailing "→", and the hover/focus underline. Verify
both themes.

### #4 — remove the pipeline legend caption
Delete the `<span>` reading "Bold = ready (no tags) · remainder held by status tags"
from the "Pipeline by Stage" header. Leave the "Pipeline by Stage" label; the
`justify-between` header just left-aligns it once the caption's gone.

### #5 — rename the pipeline column + unify "gated" vocabulary
- Summary column header (`SORT_COLUMNS` pipeline entry): **"PIPELINE · READY / WIP" →
  "Ready / Gated"**.
- For consistency with the new name + the §2.4 drawer copy ("gated in [status]"),
  change the row/summary bar captions **"{n} ready · {n} held by tags" → "{n} ready ·
  {n} gated"** everywhere they appear (summary WIP caption + any stage-card caption).
  Vocabulary is now uniformly ready / gated.

### #6a — align pipeline bar left edges across rows
The "N / M" ready/total label before each bar has variable width, so bars start at
different x per row. Give that label a **fixed-width, `tabular-nums`, right-aligned**
container (e.g. `min-w-[3.25rem] text-right tabular-nums`) so the bar's `flex-1` track
always begins at the same x on every row. Alignment-only; no data change.

### L1 — prune the dead `LedgerRow.live` field (Karen deferral from 005.3)
005.3 §2.1 removed the Live summary column and its sort case, orphaning the
`LedgerRow.live` field + its stale comment. This is the next ledger-touching batch, so
prune it here. **Grep `.live` usages first** — §2.2's Live-stage presence card reads the
live stage via `stages[…]` / `LIVE_STAGE` inside `stages.map`, NOT via `lr.live`, so
`lr.live` should be safely removable; confirm before deleting. Remove the field, its
assignment in `buildLedgerRow`, and the stale comment.

## 3. Files touched
- `components/coverage/coverage-ledger.tsx` — #1, #2 (values prop), #3, #4, #5, #6a;
  L1 (the `LedgerRow` type + stale comment, if the type lives here).
- `lib/coverage/queries.ts` — #2: add `monthly12` (12-month series) for the sparkline,
  leave `monthly` (6mo) untouched; **keep** `daily7` / `dailyCounts`. L1: drop the
  `live` assignment in `buildLedgerRow` (+ the field on the row type wherever it's
  declared).
- `components/coverage/delivery-sparkline.tsx` (if that's where `DeliverySparkline`
  lives) — #2, only if it hard-assumes a 7-point series.

No `globals.css`, no `lib` KPI changes, no route, no migration.

## 4. Explicitly NOT in scope
- **#8 + #9 (Full detail placement + equal-height / bottom-aligned expanded panel)** →
  routed to **Claude Design** as a layout iteration. Folds into 005.4 as a later commit
  (or its own batch) once Design returns — decide then.
- **#6b resizable columns** → a real feature (width state + drag + persistence +
  survive-sort), not polish. Do #6a first; reassess whether resize is still wanted.
  Size separately if so.
- **#7 alert colors** → Lacey researching a palette; becomes a `globals.css` token swap
  when delivered.
- No change to chip loudness, KPI scope, drought predicate, or any locked 005.2/005.3
  behavior beyond the #1 partial revert.

## 5. Process
- **No Jenny** — read-only render/copy + one existing-field data swap; no mutation,
  route, migration, or new surface.
- **Commits (committed, NOT pushed):**
  1. Docs — this spec + §15.5 in-flight entry (r34); §15 backlog pointer.
  2. Build — #1–#6a + L1 + atomic `CLAUDE.md` (§15.5 status). **Version: no bump**
     (render/copy only) unless you see a reason.
- `tsc` clean, build green, `tests/coverage-kpis.test.ts` 5/5 (KPI calc untouched),
  ESLint zero new.
- **DO NOT PUSH.** Karen → Lacey smokes both themes → Lacey pushes → on-ship docs
  reconcile (§15.5 → §16, r34), mirroring 005.3.

## 6. Smoke (Lacey, post-Karen)
- This-Wk numerals back to gray/dark (zero vs nonzero); Delivered-28d still
  drought/active colored.
- Sparkline now shows a 12-month growth shape, not a flat line; the Reggie drawer's
  6-month bars are unchanged.
- Linked and non-linked stage names read identically except color/arrow/underline.
- Pipeline legend caption gone.
- Column header reads "Ready / Gated"; bar captions read "N ready · N gated".
- Pipeline bars left-align across every row.
- L1: `LedgerRow.live` gone, tsc still clean (nothing referenced it), Live-stage
  presence card still renders.
- Both themes clean.

---

## 7. Claudette prompt (ready to send)
```
Batch 005.4 — Coverage Ledger polish pass 2. Read-only render/copy on the ledger +
one data-source swap. Canonical spec: docs/batch-005.4-ledger-polish-2-spec.md. No
migration, no route, no new mutation surface, no new token, no dep, no Jenny.

Files: components/coverage/coverage-ledger.tsx (most), lib/coverage/queries.ts
(monthly12 + L1 prune), the DeliverySparkline component (only if it assumes 7 pts).

COMMIT 1 — docs
- Save the spec to docs/batch-005.4-ledger-polish-2-spec.md.
- CLAUDE.md: §15.5 in-flight entry for 005.4 (r34); §15 backlog pointer. Docs-only.

COMMIT 2 — build
- #1 Summary row: revert the This-Wk (testsCurrentWeek) numeral color to the original
  `=== 0 ? var(--f92-lgray) : var(--f92-dark)`. LEAVE Delivered-28d (testsRolling28)
  on the current status coloring (paused→--f92-lgray, drought→--ledger-drought,
  active→--ledger-active).
- #2 Sparkline: repoint <DeliverySparkline> from row.daily7 to a NEW 12-month field
  monthly12 (monthlyCounts(milestones, brand.id, 12, now)). Do NOT change row.monthly
  (6mo) — it feeds the Reggie drawer bars and stays as-is; grep .monthly to confirm.
  Building monthly12 as its own field also serves the coming drawer 6/12 toggle (005.5).
  values={row.monthly12.map(m => m.count)}. Adapt DeliverySparkline only if it
  hard-assumes 7 points. KEEP daily7/dailyCounts — do NOT remove (parked for a future
  daily view); just stop feeding it here.
- #3 Make the linked stage-name <button> typography computed-identical to the
  non-linked <span> (both are text-[10px] font-semibold uppercase tracking-[0.04em] —
  fix any UA button-font leak with appearance-none / font:inherit / matching leading).
  Only intended diffs: color, the "→", hover/focus underline.
- #4 Delete the "Bold = ready (no tags) · remainder held by status tags" caption span
  in the Pipeline-by-Stage header.
- #5 Rename the pipeline summary column header "PIPELINE · READY / WIP" → "Ready /
  Gated" in SORT_COLUMNS. Change every "{n} ready · {n} held by tags" caption to
  "{n} ready · {n} gated".
- #6a Give the "N / M" ready/total label before each pipeline bar a fixed-width,
  tabular-nums, right-aligned container so every bar's left edge aligns across rows.
- L1 (Karen deferral from 005.3): remove the dead LedgerRow.live field + its stale
  comment + the `live:` assignment in buildLedgerRow. GREP .live usages first — the
  §2.2 Live presence card reads the live stage via stages[…]/LIVE_STAGE inside
  stages.map, not via lr.live, so it should be safe; confirm before deleting.

Atomic CLAUDE.md per r23 (§15.5 status). Version: no bump (render/copy only) unless you
see a reason — flag if so. tsc clean, build green, coverage-kpis 5/5, ESLint zero new.
Separate commits. DO NOT PUSH. Report → Karen.
```
