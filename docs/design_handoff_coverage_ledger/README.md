# Handoff: CQIP Coverage Ledger (Client Coverage Dashboard)

## Overview
A single dashboard page tracking quality-test coverage across client brands. It shows top-line KPIs, project/brand filters, and an expandable "Coverage Ledger" — one accordion row per brand. Each row summarizes delivered tests, weekly throughput, live tests, and the live pipeline; expanding a row reveals a delivery trend sparkline, delivery stats, and a per-stage pipeline breakdown with status tags.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing the intended look and behavior. They are **not production code to copy directly.** The task is to **recreate this design in the target codebase's existing environment** (React, Vue, etc.) using its established component patterns, state libraries, and styling conventions. If no front-end environment exists yet, choose the most appropriate framework for the project and implement there.

Note on the source format: the prototype is authored as a "Design Component" (`.dc.html`) that depends on a `support.js` runtime. Treat the markup and the logic class as a **specification of structure, data shape, and styling** — do not port the runtime itself.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions are all specified below and should be recreated pixel-accurately using the codebase's libraries. Exact hex values, font sizes, and weights are given in Design Tokens.

## Screens / Views

There is **one screen** with two states per ledger row (collapsed / expanded).

### Screen: Client Coverage
- **Purpose:** Let an account/quality lead see which brands are under-tested ("drought"), monitor throughput, and inspect each brand's live pipeline and what's blocking it.
- **Page layout:** Centered column, `max-width: 1460px`, padding `34px 32px 64px`. Dark background `#070a12`. Font family `IBM Plex Sans` (with `IBM Plex Mono` for code/ticker bits). Vertical sections stacked with margins noted below.

#### 1. Header (margin-bottom 22px)
- Flex row, `space-between`, items aligned to top.
- Left block:
  - Eyebrow "COVERAGE" — `600 11px`, letter-spacing `.18em`, color `#6fb7c9`, margin-bottom 7px.
  - Title "Client Coverage" — `700 29px`, color `#f2f4f9`, line-height 1.
  - Subtitle — `400 13.5px`, color `#7a8398`, margin-top 9px. Copy: "Brands with ≤2 tests in the last 28 days are flagged. Expand a row for trend, rework & live pipeline detail."
- Right block (flex, gap 10px):
  - Primary button "⟳ Sync with Jira" — padding `9px 15px`, radius 9px, background `#f97316`, text color `#1a0c02`, `600 13px`. Hover background `#fb8a3c`.
  - Status chip "✓ 17 logs · 4h ago" — padding `9px 13px`, radius 9px, background `#0f2418`, border `1px solid #1d4d31`, color `#5fd68f`, `500 12px`.

#### 2. KPI strip (margin-bottom 18px)
- Outer container: border `1px solid #1b2436`, radius 12px, background `#0c111d`, `overflow:hidden`, flex row.
- **Long KPIs** (2 cells): padding `15px 22px`, right border `1px solid #14202e`, background `rgba(45,212,191,.06)`.
  - Label `600 10px`, letter-spacing `.1em`, color `#5fb9ad`, margin-bottom 6px.
  - Value `700 27px`, color `#2dd4bf`, tabular-nums.
  - Sub `400 10px`, color `#5d7a78`, margin-top 5px.
  - Data: `Tests This Year / 244 / Through Jun 25`, `Tests All Time / 314 / Since Nov 2025`.
- **Mid KPIs** (flex:1 container): 4 cells, each `flex:1`, padding `15px 20px`, right border `1px solid #14202e`.
  - Label `600 10px`, letter-spacing `.08em`, color `#7a8398`.
  - Value `700 23px`, color `#aab2ff`, tabular-nums.
  - Data: `This Week / 17`, `Last Week / 0`, `Rolling 28d / 37`, `This Month / 37`.
- **Overall Health gauge** (flex:1 cell): SVG donut, 56px box (viewBox 64×64), track circle r=26 stroke `#16202e` width 7; progress circle same geometry, `stroke-linecap:round`, rotated `-90`. Value 38%, color `#f59e0b`. Center label `700 14px` in gauge color.
- **Brands Covered** (flex:1 cell): label as mid; value `700 23px` color `#cfd5e6`, text `5/13`.
- **Quality Score gauge** (flex:1 cell): same donut pattern. Value 81%, color `#34d399`.
- Gauge animation: on mount, both gauges animate from 0 to their value over 1000ms with ease-out cubic (`1 - (1-t)^3`); the numeric label counts up in step.

#### 3. Filter bar (margin-bottom 24px)
- Container: padding `14px 18px`, border `1px solid #1b2436`, radius 12px, background `#0c111d`, flex column, gap 12px.
- **Project row** (flex, gap 9px): label "PROJECT" `600 10px`, letter-spacing `.12em`, color `#6c7588`, width 54px. Two toggle pills `NBLY`, `SPL`:
  - Pill base: padding `5px 14px`, radius 8px, `600 12px`, cursor pointer.
  - Selected (single-select): background `#4f46e5`, color `#fff`, border `1px solid #4f46e5`, label prefixed "✓ ".
  - Unselected: transparent, color `#9aa3b6`, border `1px solid #2a3550`.
- **Brand row** (flex, gap 8px, wrap): label "BRAND" same style. A dashed "Clear all" pill (padding `5px 12px`, radius 999px, border `1px dashed #5a4326`, color `#d9943f`, `600 11px`) plus one toggle pill per brand code.
  - Brand pill base: padding `5px 13px`, radius 999px, `600 11px`.
  - On: background `#f97316`, color `#231203`, border `1px solid #f97316`, label `"✓ " + code`.
  - Off: transparent, color `#7a8398`, border `1px solid #2a3550`, label `code`.

#### 4. Ledger header + legend (margin-bottom 10px)
- Flex row space-between.
- Left: "COVERAGE LEDGER" `700 13px`, letter-spacing `.16em`, color `#aeb6c8`; caption `400 12px` color `#6c7588` "Delivered + live pipeline, one row per brand."
- Right legend (flex gap 14px): two items, each an 8×8 radius-2 swatch + `500 11px` color `#9aa3b6` label. Drought = `#ef4444`, Active = `#22c55e`.

#### 5. Column labels row
- CSS grid, `grid-template-columns: 22px 4px minmax(220px,1.3fr) 120px 92px 96px minmax(280px,1.5fr)`, `align-items:end`, padding `0 14px 11px 0`, bottom border `1px solid #1b2436`.
- Label type: `600 10.5px`, color `#7a8398`, uppercase, letter-spacing `.05em`.
- Columns in order: (empty chevron) · (empty rail) · "Brand" (padding-left 12px) · "Delivered 28d" (right) · "This Wk" (right) · "Live · ready / total" (right) · "Pipeline · ready / WIP" (padding-left 18px).
- **Sortable:** the five data/label cells (Brand, Delivered 28d, This Wk, Live, Pipeline) are clickable sort controls (`cursor:pointer; user-select:none;`, hover `color:#cfd5e6`). Each shows a trailing caret glyph in color `#5a6378`: `⇅` when not the active sort key, `↑` when sorting ascending, `↓` when descending. Clicking a column sets it as the sort key; clicking the active column flips direction. Default sort direction on first click: ascending for Brand (alphabetical), descending for all numeric columns. Sort keys: Brand = name lowercased; Delivered = `o[2]`; This Wk = `o[0]`; Live = `p[4].none`; Pipeline = `Σ p[].t`.

#### 6. Ledger rows (one per visible brand)
- Row wrapper: bottom border `1px solid #121a28`; when open also background `#0a0f1a`.
- **Summary row** (clickable, same 7-col grid as labels, `align-items:center`, padding `14px 14px 14px 0`, cursor pointer, hover background `#0e1421`):
  - **Chevron** cell: "▶" centered, color `#5a6378`, 12px, `transition: transform .18s`; rotate 90° when open.
  - **Rail** cell: 4px-wide, 32px-tall bar, radius 3px. Color = `#ef4444` if brand status is DROUGHT else `#22c55e`.
  - **Brand** cell (flex, gap 9px, padding-left 12px): brand name `500 15px` color `#e6e9f0`; code badge `600 9.5px` IBM Plex Mono, color `#8a93a6`, background `#161f30`, border `1px solid #232d40`, padding `2px 6px`, radius 5px.
  - **Delivered 28d** cell: right-aligned, tabular-nums, `700 22px`. Color: `#56607a` if 0; else `#f2f4f9` for drought, `#c7ccff` for active.
  - **This Wk** cell: right-aligned, tabular-nums, `500 15px`. Color `#3a4256` if 0 else `#cfd5e6`.
  - **Live** cell (right-aligned, nowrap, tabular-nums): ready number `700 18px` in the "ready" style (color `#a5b4fc` when ready>0, `#56607a` when ready=0, `#39435a` when stage total=0); then, when stage total>0, " / total" in `500 12px` color `#525c74`. Mirrors the Live stage figure shown in the expanded pipeline.
  - **Pipeline** cell (padding-left 18px, flex, gap 13px):
    - "ready / WIP": ready `700 18px` color `#a5b4fc`, then " / WIP" `500 12px` color `#525c74`.
    - Stacked bar: flex, height 7px, radius 4px, `overflow:hidden`, background `#0f1726`. Segments use status colors (see tokens), each `flex: <count> 1 0`. If WIP=0, single segment background `#141d2c`.
    - Caption below `400 10px` color `#5a6378`: "<ready> ready · <blocked> held by tags".
- **Expanded detail** (only when open): flex row, gap 24px, padding `6px 16px 26px 38px`, background `#080c15`, bottom border `1px solid #141d2c`.
  - **Delivery detail** (width 236px, flex:none):
    - Section label "DELIVERY DETAIL" `700 10px` letter-spacing `.14em` color `#8a93a6`, margin-bottom 14px.
    - Sparkline SVG 212×58 (overflow visible): baseline `line` at y=57 stroke `#16202e`; `polyline` of the 7-day test counts, stroke `#818cf8` width 2, round caps/joins; end dot `circle` r=3 fill `#a5b4fc`. Margin-bottom 16px.
    - Stats list: a single vertical column (flex-column, gap 1px on background `#16202e`, border `1px solid #16202e`, radius 9px, overflow hidden). Each row: background `#0c121e`, padding `9px 13px`, flex `space-between` align-center; label `600 9.5px` uppercase letter-spacing `.06em` color `#6c7588`; value `600 15px` tabular-nums, color `#dfe3ec` (or `#3a4256` when 0; Rework Ratio always `#9aa3b6`).
    - Stats: Last Week, This Month, Rework Ratio. (Note: "This Week" is intentionally omitted here — it already appears as the This Wk summary column, so repeating it in the detail panel was redundant.)
  - **Pipeline by stage** (flex:1):
    - Header row: "PIPELINE BY STAGE" `700 10px` letter-spacing `.14em` color `#8a93a6`; right caption `400 11px` color `#5a6378`: "Bold = ready (no tags) · remainder held: Needs Info · On Hold · Awaiting Client".
    - 5-column grid (gap 10px), one card per stage (Strategy, Design, Dev, Queued, Live). Card: background `#0c121e`, border `1px solid #16202e`, radius 10px, padding `12px 13px`.
      - Stage label `600 10px` uppercase letter-spacing `.04em` color `#7a8398`, margin-bottom 9px.
      - Count line (flex, align baseline, gap 5px): ready `700 21px` (ready style as above) and, when total>0, "/ total" `500 12px` color `#525c74`. Ready shows "—" when stage total=0.
      - Bar (only when total>0): flex, height 6px, margin-top 9px, radius 3px, overflow hidden, background `#0f1726`; segments `flex: <count> 1 0` in status colors.
      - Tag chips (only when there are held items): flex wrap, gap 5px, margin-top 10px. **See Tag Chips below.**
      - "✓ all clear" (only when total>0 and no tags): `500 10.5px` color `#4f7a6a`, margin-top 10px.

## Tag Chips (status tags) — important / recently revised
Three blocking statuses appear as chips inside each pipeline stage card. They were redesigned to be **bright and WCAG-AA accessible in both light and dark themes**. The accessible pattern is a **self-contained chip**: a solid bright fill with near-black text, so contrast (≥4.5:1) does not depend on the page background.

- Chip style: `display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:6px; font:700 10px 'IBM Plex Sans'; color:#0a0e16; background:<status color>; border:1px solid <status color>;`
- Dot inside chip: 6×6, `border-radius:50%`, background `rgba(10,14,22,.55)`.
- Chip content: dot + label + count (e.g. "● Needs Info 3").

Status → color → label:
- **Needs Info** — `#38bdf8` (sky)
- **On Hold** — `#fb7185` (rose)
- **Awaiting** (Client Awaiting Input) — `#c084fc` (violet)
- (Troubleshooting — `#f59e0b` amber — defined but currently unused in data.)

⚠️ Do NOT revert to colored text on a faint tinted background — that version failed WCAG on light backgrounds. Keep the solid-fill / dark-text approach.

The same three colors (plus "ready" = `#a5b4fc` periwinkle) are reused as the **segment colors** in all stacked bars (decorative, full opacity on dark). The ready color was brightened from an earlier dim indigo (`#7c89ff`) to `#a5b4fc` for better visibility on the dark background.

## Interactions & Behavior
- **Row expand/collapse:** clicking a summary row toggles its detail panel; chevron rotates 90° (`transition: transform .18s`). Multiple rows may be open at once. Default open: `Aire Serv` (code ASV).
- **Column sort:** clicking any of the five data column headers sorts the ledger by that column; clicking the active header again reverses direction. See Column labels row for keys/carets. (Row expand state is preserved across sorts.)
- **Project filter:** single-select toggle (NBLY / SPL); selected pill highlighted indigo.
- **Brand filter:** each brand pill toggles that brand's visibility in the ledger (multi-select; filtered-out brands are removed from the list). "Clear all" resets all brands back to visible.
- **Gauge mount animation:** Overall Health and Quality Score donuts + their numeric labels animate from 0 → value over 1000ms, ease-out cubic.
- **Hover states:** Sync button `#f97316 → #fb8a3c`; summary row background `→ #0e1421`.
- No loading/error/empty states are designed beyond the WIP=0 bar treatment (single muted segment `#141d2c`).
- Not explicitly responsive — fixed centered max-width layout; grid columns are partly fixed-px so plan a breakpoint strategy for narrow widths.

## State Management
- `brandsOff`: map of brand code → boolean (true = hidden). Drives the brand filter and which rows render.
- `project`: currently selected project string (`'NBLY' | 'SPL'`).
- `open`: map of brand code → boolean (row expanded). Defaults `{ ASV: true }`.
- `anim`: 0→1 progress value for the gauge mount animation (drive with rAF or a spring/transition in the target framework).
- No remote data fetching in the prototype — all data is static (see Data Model). In production this would come from the test-logging / Jira sync backend.

- `sort`: `{ key: 'brand'|'delivered'|'thisWk'|'live'|'pipeline'|null, dir: 1|-1 }`. Null key = default file order. Clicking a header sets the key (flips `dir` if already active).

### Data Model
Each brand record: `{ b: name, c: code, st: 'DROUGHT'|'ACTIVE', o: [thisWk, lastWk, delivered28, thisMonth, ?], r: reworkRatioString, t: [7 daily counts for sparkline], p: [5 stage objects] }`.
Each stage object `p[i]`: `{ t: totalInStage, none: readyCount, ni?, oh?, aci?, ts? }` where `ni/oh/aci/ts` are counts held by each status tag. Stage order: Strategy, Design, Dev, Queued, Live. "ready" = `none`. "blocked/held" = total − none.
Derived per row: `roll28 = o[2]`, `thisWk = o[0]`, pipeline `wip = Σ t`, `wipReady = Σ none`; **Live column = stage p[4]'s ready / total.**

## Design Tokens
**Colors**
- Page bg `#070a12`; panel bg `#0c111d`; expanded detail bg `#080c15`; card bg `#0c121e`; open-row bg `#0a0f1a`; row-hover bg `#0e1421`.
- Borders: `#1b2436` (panels), `#14202e` / `#16202e` (inner), `#121a28` (row), `#141d2c`, `#232d40`, `#2a3550` (pill).
- Bar track `#0f1726`; empty-WIP segment `#141d2c`.
- Text: primary `#f2f4f9`, `#e6e9f0`; secondary `#cfd5e6`, `#c7ccff`, `#aab2ff`; muted `#7a8398`, `#6c7588`, `#5a6378`; faint/zero `#56607a`, `#3a4256`, `#39435a`, `#525c74`.
- Accents: orange `#f97316` (hover `#fb8a3c`), indigo `#4f46e5`, teal `#2dd4bf`/`#34d399`, health amber `#f59e0b`, sparkline `#818cf8` / dot `#a5b4fc`.
- Status / segment: ready/none `#a5b4fc` (brightened from `#7c89ff`); Needs Info `#38bdf8`; On Hold `#fb7185`; Awaiting `#c084fc`; Troubleshooting `#f59e0b` (unused).
- Status semantics: Drought `#ef4444`, Active `#22c55e`.
- Chip text `#0a0e16`; chip dot `rgba(10,14,22,.55)`.

**Typography** — `IBM Plex Sans` (400/500/600/700), `IBM Plex Mono` (500/600) for code badge & brand-code ticker. Sizes range 9.5px (labels) → 29px (page title); KPI values 22–27px; numeric cells use `font-variant-numeric: tabular-nums`. Letter-spacing on eyebrows/labels `.04–.18em`.

**Radius** — pills 999px; buttons/panels 8–12px; cards 9–10px; chips 6px; badge 5px; bars 3–4px.

**Spacing** — section gaps 18–24px; card padding 11–15px; consistent grid gaps 1px/10px.

**Bars / gauges** — bar heights 6px (stage) / 7px (summary); donut 56px box, stroke width 7, r=26.

## Screenshots
Reference renders are in `screenshots/`:
- `01-overview-expanded.png` — header, KPI strip, and filter bar.
- `02-ledger-expanded-detail.png` — an expanded row: delivery sparkline + stats, pipeline-by-stage cards, the accessible status tag chips, and the new Live column ("2 / 2").
- `03-ledger-collapsed-rows.png` — multiple collapsed ledger rows showing the summary columns and pipeline bars.

## Assets
No image or icon assets. All glyphs are inline unicode characters (`⟳ ✓ ▶ ●`) and SVG is hand-drawn (gauges, sparkline). In production, substitute the codebase's icon system for the unicode glyphs and render gauges/sparklines with the team's charting approach.

## Files
- `Coverage Accordion.dc.html` — the full design: template markup (the page structure & inline styles) plus a logic class (`Component`) holding the static data, derived values, and interaction handlers. Read this for exact data shapes, color logic, and the ready/held computations.
- `support.js` — the prototype runtime that renders the `.dc.html`. Reference only; **do not port.**
