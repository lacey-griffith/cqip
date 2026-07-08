# SPEC — Batch 005.2, Coverage Ledger redesign

**For:** Claudette (builds from this) · drafted by DC
**Date:** 2026-07-07
**Repo:** `lacey-griffith/cqip` · `cqip.l-hay.workers.dev`
**Intended repo path:** `docs/batch-005.2-coverage-ledger-spec.md`
**Design source (commit alongside):** `design_handoff_coverage_ledger/` bundle
(README.md = authoritative on structure, tokens, data shapes, interactions;
`Coverage Accordion.dc.html` = exact color/ready-held logic; `support.js` =
reference only, DO NOT port).
**Read order on open:** this doc → the mock README → `CLAUDE.md` §15 (005.2
entry + locked chip set) via cqip-shared → then build.

---

## 0. One-line
Merge the current Coverage page's split Output + Pipeline tables into a single
**accordion "Coverage Ledger"** — one row per brand, collapsed summary + inline
expandable detail (delivery sparkline, delivery stats, per-stage pipeline with
status-tag chips). Read-only render redesign. No migration, no new mutation
surface, no Jenny.

---

## 1. Where this sits — don't re-litigate
- 005.2 is the **next open DC batch** (CROSS_CLAUDE §5 row 11; Brand Wellness
  shipped + pushed 2026-07-07).
- The **pipeline-hold chip set is LOCKED and committed** in `CLAUDE.md` §15
  (Lacey 2026-07-07, AC-verified vs `customfield_12528` "CRO Labels"). Do not
  reopen. See §4.4.
- All four scope forks are settled below (§3). One implementation decision
  remains open — the Reggie-drawer fate (§6) — flagged for Lacey, not for
  Claudette to decide.

---

## 2. What 005.2 is
Replace the two stacked tables on `/dashboard/coverage` (Output table + Pipeline
table, both from Batch 010) with **one accordion ledger**. The two tables'
data is unchanged; this is a presentation merge + KPI-strip refresh + theming,
wiring to functions that already exist.

**Reuses (do NOT rebuild):**
- `buildCoverageRows`, `computeCoverageHealth`, `computeQualityScore`,
  `countInWindow`, and the window helpers — all in `lib/coverage/queries.ts`.
- `components/coverage/sparkline` — already imported on the page.
- `/api/coverage/pipeline` route + `lib/coverage/pipeline-stages.ts`
  (`PIPELINE_STAGES`, `STAGE_LABELS`, `OVERLAY_KEYS`, `OVERLAY_TAG_VALUES`).
- `ProjectBrandFilter`, `SyncJiraButton`, `downloadBrandedXlsx`,
  `BrandAdminDrawer`, `AddBrandDrawer`.
- The page already fetches **full non-deleted `test_milestones` client-side**
  into `milestones` state (verified: `refetchAll()` Promise.all, no aggregation
  / no limit). All derivations below run off that array — no new route,
  no migration.

---

## 3. The four settled forks (LOCKED)

### 3.1 Per-day sparkline → reuse data AND component
The mock sparkline is a **fixed 7-day daily-count polyline** (`t: [7 daily
counts]`), not the 30/60/90 range. Bucket per-day over the trailing 7 days,
**client-side off the existing `milestones` array**, per brand (mirror the
per-day bucketing shipped in Brand Wellness). Reuse `components/coverage/
sparkline` — extend it if needed, do not add a new dep. No new table, no
route, no migration.

### 3.2 Theming → dark matches the mock, light matches F92, via the token layer
- **Dark mode:** pixel-match the mock's palette. The mock's hex values become
  **dark-theme token values** (extend the existing F92 token set — the
  `--kpi-longrange-*` tokens from Batch 010 are the precedent). NOT one-off
  inline colors, NOT a hardcoded dark island.
- **Light mode:** conform to the **existing F92 light specs**. Both themes flip
  through the token layer.
- **Semantic colors carry across as tokens:** drought red `#ef4444`, active
  green `#22c55e`, ready periwinkle `#a5b4fc`, teal long-range (existing
  `--kpi-longrange-*`), and the status-chip colors (§4.4).
- **Status-tag chips** are already authored background-independent + WCAG-AA for
  both themes (solid bright fill, near-black text `#0a0e16`) — port as-is; do
  NOT revert to tinted-background/colored-text (fails AA on light).
- **Decorative stacked-bar segments** are dark-tuned at full opacity. AA-check
  or desaturate them for **light** mode.
- **Verification gate:** Karen/Lacey confirm both themes render clean; light
  mode is an explicit smoke item (§10).

### 3.3 "≤2" drought copy → no hardcoded literal
The header subtitle ("Brands with ≤2 tests in the last 28 days are flagged…")
must NOT bake in the literal. Source the threshold from the **shared THRESHOLD
constant** the drought pill + KPI already use (005.1 shared-predicate
discipline), or phrase target-agnostic ("below their coverage target"). This
keeps Batch 010.1 (per-brand targets) a **one-touch change** — see §8. Do NOT
build per-brand targets here.

### 3.4 Sortable columns → in scope for 005.2
Build sort into the ledger (the current page already has `sortKey`/`sortDir` +
`statusRank` — rework, not net-new). Sortable summary columns per the mock:
**Brand · Delivered 28d · This Wk · Live · Pipeline.** Row expand state is
preserved across sorts. Default: status-desc (drought floats to top), matching
current behavior. Carets/keys/directions per the mock README §5.

---

## 4. CQIP mappings (mock → this codebase)

### 4.1 KPI strip → existing computes, full-scope
Wire the mock's KPI strip to functions that already exist; the mock's numbers
are static placeholders.
- **Long-range teal pair** (Tests This Year / Tests All Time) — existing.
- **Mid KPIs** (This Week / Last Week / Rolling 28d / This Month) — via
  `countInWindow` + the window helpers.
- **Overall Health gauge + Brands Covered (N/M)** — `computeCoverageHealth`.
- **Quality Score gauge** — `computeQualityScore`.
- **CRITICAL — full-scope:** all KPIs compute from the **full** brands/
  milestones arrays, **NEVER `visibleRows`** (filter- and paused-scoped). This
  is the known 005.1 trap; do not reverse the 005.22 boundary.

### 4.2 Drought / covered → shared predicate, never re-implemented
Row rail color, Delivered-28d color, and any "covered" count derive from the
**shared `!droughtFlag`** the pill uses — do not re-implement the `count > 2`
comparison. (005.1 Path 1, locked.)

### 4.3 Pipeline stages → reuse Batch 010
5 stages: Strategy · Design · Dev · Queued · Live (`PIPELINE_STAGES`). Live
summary column = stage `p[4]` ready/total. Merge pipeline counts onto the
shared `CoverageRow` brand set so ledger + KPIs share filter + paused scope
(as Batch 010 already does).

### 4.4 Status-tag chips → the LOCKED §15 set (mock is stale here)
Use the **committed §15 chip set** — four hold chips:
```
Needs info · On hold · Awaiting client input · Troubleshooting
```
Wire **"Awaiting client input" verbatim** (NOT "Awaiting Client" — dead string).
NOT chips: Go live, Deployment (forward states) · Needs strategy (unused) ·
Paused (redundant w/ is_paused + Troubleshooting).

⚠ **Discrepancy to respect:** the mock README shows only 3 chips and calls
Troubleshooting "defined but currently unused in data." The **§15 locked set
supersedes the mock** — include the Troubleshooting chip (amber `#f59e0b`); it
renders when data is present and is forward-safe (the pipeline route already
returns all four subsets; `OVERLAY_KEYS` already has all four). Chip colors:
Needs Info `#38bdf8`, On Hold `#fb7185`, Awaiting `#c084fc`, Troubleshooting
`#f59e0b` — as dark-theme tokens per §3.2.

### 4.5 Preserve existing affordances not shown in the mock
The mock is the **all-user** layout; it omits admin + utility affordances that
must survive:
- **Admin:** per-brand gear → `BrandAdminDrawer`, `AddBrandDrawer` (admin-gated,
  unchanged).
- **Sync:** `SyncJiraButton` (mock's "⟳ Sync with Jira").
- **Export:** existing `downloadBrandedXlsx` button — keep it.
- **Show-paused toggle:** preserve `showPaused`; give paused brands a rail
  treatment (mock rail is drought-red / active-green only — add a muted paused
  variant; `statusRank` already ranks paused). Fix the known "Show paused
  brands" copy typo while here.

---

## 5. Data derivations (all client-side, off existing state)
- **7-day sparkline series** per brand: bucket `milestones` by day over
  trailing 7d.
- **Live column:** stage `p[4]` ready/total from the pipeline merge.
- **Pipeline ready/WIP + held-by-tags:** ready = Σ `none`; WIP = Σ stage totals;
  held = total − none, split by the four tags.
- **Delivery stats** (expanded panel): Last Week, This Month, Rework Ratio
  (This Week is intentionally omitted from the panel — it's the summary column).
- Everything full-scope; visible filtering happens at render only.

---

## 6. ⚠ OPEN — Reggie-drawer fate + BW CTA re-home (Lacey decides before build)
The accordion expands **inline** on row click. That collides with the current
interaction where clicking a **brand name** opens the all-user **Reggie drawer**
(`components/coverage/brand-detail-drawer.tsx`) — which is also where the
**Brand Wellness CTA** lives (shipped this week). In the accordion, the row-click
trigger is taken by expand, so the drawer loses its entry point.

**DC recommendation (low-risk, mirrors 005.1 Phase 5 discipline):**
- **Keep the Reggie drawer for v1.** Do NOT delete it in this batch.
- Row click = expand (match the mock). Add a small **"Full detail →" link inside
  the expanded panel** that opens the Reggie drawer for that brand. The BW CTA
  stays where it is (inside the drawer) — nothing breaks, nothing re-homes yet.
- Defer any fold-in of the drawer's unique content (28d ticket list, 6-month
  bars) into the accordion — and any drawer deletion + CTA move — to a
  **separate follow-up**, only after the accordion is verified live to cover
  the drawer's job (exactly how 005.1 deleted `settings/coverage` in its own
  commit after the drawer was proven).

**Alternative (bigger, not recommended for v1):** fold the drawer's content into
the expansion, deprecate the drawer, re-home the BW CTA into the expanded panel.
More scope, rips out a working all-user view mid-redesign.

→ **Lacey: confirm the recommended path (keep drawer + "Full detail" link,
defer fold-in) or pick the alternative.** Spec assumes the recommended path
unless changed.

---

## 7. Scope boundaries

**In v1:**
- Accordion ledger replacing the split tables (summary + inline detail).
- KPI strip wired to existing computes (§4.1), gauges with mount animation.
- Sort (§3.4), filter (`ProjectBrandFilter`), chips (§4.4), theming (§3.2).
- 7-day sparkline (§3.1). Preserved affordances (§4.5).
- "Full detail →" link to the (unchanged) Reggie drawer (§6, pending confirm).

**NOT in v1:**
- No Reggie-drawer deletion or content fold-in; no BW CTA move (follow-up).
- No per-brand targets — that's Batch 010.1 (§8).
- No new migration, no new mutation route, no schema change.
- No new charting dep.
- Responsive: mock is fixed max-width; add a sane narrow-width breakpoint but
  full responsive polish is out.

---

## 8. Forward-compat for Batch 010.1
010.1 (MERGED: per-brand milestone/pipeline targets on the brand record;
absorbs 010.2 + Path 2 off-by-one) will swap the flat THRESHOLD for per-brand
targets. Write 005.2 so that swap is **one line inside the per-brand loop**:
read the threshold per-brand in the loop, not once at top; source the subtitle
copy from that same value (§3.3). Do NOT hardcode the number anywhere. Coupling
verified live (CROSS_CLAUDE §5 row 13).

---

## 9. Process
- **No Jenny.** Read-only render redesign; no new mutation surface, no migration,
  no privileged path. (Discrepancy: §15/batch-outline note "Jenny-likely" — DC
  assessment is **no Jenny** as scoped. Only trigger would be a genuinely new
  mutation/route, which this batch does not introduce.)
- **Commits:**
  - **Commit 1** — this spec (docs-only; paths-ignore skips deploy).
  - **Commit 2** — the ledger redesign (§2–§5, §4, the settled forks). Atomic
    `CLAUDE.md`: §15.5 in-flight entry per r34 while building; §16 shipped entry
    written on ship, not now; §15 005.2 forks marked resolved. Version bump
    (new component surface = structural, r23).
  - Split Commit 2 into 2a (derivations + accordion data layer) / 2b (UI +
    theming) only if it aids review — Claudette's call; keep atomic if clean.
- **DO NOT PUSH.** Karen post-flight → Lacey smoke-tests both themes + pushes.
- Docs-only commits skip auto-deploy via paths-ignore.

---

## 10. Smoke (Lacey, post-Karen)
- Ledger renders one row per brand; MOJ (or current drought brand) shows the
  **red rail + drought styling**; an active brand shows green.
- Expand a row: sparkline (7-day), delivery stats (Last Week / This Month /
  Rework Ratio), 5 pipeline stage cards with correct ready/total, **all four**
  hold chips render where data exists, "✓ all clear" where none.
- **KPI parity:** Overall Health / Brands Covered / Quality Score match the old
  page's numbers (full-scope, not affected by active filters).
- **Drought↔KPI consistency:** an exactly-2 brand reads drought on rail AND is
  excluded from Covered (shared predicate holds).
- Sort each of the 5 columns; expand state survives a sort.
- Filter (project single-select, brand multi-select, clear-all) hides/shows rows
  without changing KPI numbers.
- **Both themes:** toggle light/dark — chips stay AA, bars readable in light,
  dark matches the mock.
- Export still downloads; admin gear opens `BrandAdminDrawer`; "Full detail →"
  opens the Reggie drawer with the BW CTA intact.

---

## 11. Claudette prompt (paste after the spec is committed)
```
Batch 005.2 — Coverage Ledger redesign. Build from the committed spec
docs/batch-005.2-coverage-ledger-spec.md (canonical) + the
design_handoff_coverage_ledger bundle (README = design source of truth;
support.js reference only, do NOT port). Read the spec + mock README + CLAUDE.md
§15 (005.2 + locked chip set) before starting.

Merge the /dashboard/coverage split Output + Pipeline tables into ONE accordion
"Coverage Ledger": one row per brand, collapsed summary + inline expandable
detail. Read-only redesign — NO migration, NO new mutation route, NO Jenny.

REUSE, don't rebuild: buildCoverageRows / computeCoverageHealth /
computeQualityScore / countInWindow + window helpers (lib/coverage/queries.ts);
components/coverage/sparkline; /api/coverage/pipeline + lib/coverage/
pipeline-stages.ts; ProjectBrandFilter; SyncJiraButton; downloadBrandedXlsx;
BrandAdminDrawer; AddBrandDrawer. The page already fetches full non-deleted
test_milestones client-side — derive everything off that array.

SETTLED:
- Sparkline: fixed 7-day per-day buckets off the existing milestones array,
  per brand; reuse the sparkline component; no new dep.
- Theming: dark mode pixel-matches the mock's palette AS DARK-THEME TOKENS
  (extend the F92 token set; --kpi-longrange-* is the precedent — no inline
  colors, no dark island). Light mode conforms to existing F92 light specs.
  Status-tag chips are background-independent + WCAG-AA both themes (solid fill,
  near-black text) — port as-is, never tinted-bg/colored-text. Decorative bar
  segments: AA-check / desaturate for light.
- ≤2 subtitle copy: NO hardcoded literal — source the threshold from the shared
  THRESHOLD constant the pill/KPI use (or target-agnostic copy). Read threshold
  per-brand inside the loop so Batch 010.1 is a one-line swap. Do NOT build
  per-brand targets.
- Sort: in scope. Sortable summary columns Brand · Delivered 28d · This Wk ·
  Live · Pipeline; expand state preserved across sorts; default status-desc.

MAPPINGS:
- KPIs wire to the existing computes above; FULL-SCOPE, never visibleRows.
- Drought/covered from the shared !droughtFlag predicate — do NOT re-implement
  the comparison.
- Status chips = the LOCKED §15 set: Needs info · On hold · Awaiting client
  input · Troubleshooting. "Awaiting client input" VERBATIM. Include the
  Troubleshooting chip even though the mock shows 3 — §15 supersedes the mock.
- Preserve admin gear (BrandAdminDrawer) + AddBrand, SyncJiraButton, export,
  and the showPaused toggle (fix the "Show paused brands" typo; muted rail for
  paused).

DRAWER (per spec §6, Lacey-confirmed path): keep the Reggie drawer
(brand-detail-drawer.tsx) as-is; row click = expand; add a "Full detail →" link
inside the expanded panel that opens the Reggie drawer for that brand. Do NOT
delete the drawer, fold in its content, or move the Brand Wellness CTA — that's
a later follow-up after the accordion is verified live.

Two commits: (1) this spec docs-only [already committed]; (2) the redesign.
Atomic CLAUDE.md — §15.5 in-flight per r34 now, §16 on ship. Version bump
(structural, new component surface). tsc clean, build green, ESLint zero NEW
findings. DO NOT PUSH. Report back → Karen.
```
