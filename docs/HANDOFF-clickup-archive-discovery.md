# HANDOFF — ClickUp Client Archive · Discovery (v1)

**For:** DC/Claudette (discovery execution) · **Author:** DC · **Date:** 2026-07-10
**Supersedes:** v0 (2026-07-09) — v0 predates the effort/delivery metric model; this is a full revision.
**Repo:** `lacey-griffith/cqip` · **Intended path:** `docs/HANDOFF-clickup-archive-discovery.md`
**Status:** Discovery brief. **Discovery is read-only** — no importer, table, or page is
built until the gates in §8 clear. Sequence: **behind 006.**
**Read order:** this brief → `CLAUDE.md` §15 (ClickUp backlog entry) → CROSS_CLAUDE §6
(AC's dedup-key verification).

---

## 0. One-line
Prove out a **one-time, isolated, overview-only** historical backfill of CRO test *effort*
from ClickUp (the pre-Jira era) so all-time/growth counts are accurate — *without* touching
live coverage. Discovery measures feasibility (volume + dedup coverage + history
retrievability) before any build.

## 1. Goal & non-goals
**Goal:** a standalone "Client Archive" of historical CRO tests (title · client · brand ·
date · effort/delivery flags · maybe ClickUp url/id), counted for growth/all-time
reporting, admin-editable for sparse old rows.

**Non-goals (hard):**
- **NO** `test_milestones` or `quality_logs` rows written. Ever.
- **Does NOT feed live coverage KPIs, drought, or quality score.** The archive is a
  separate count surface.
- No rework/quality signal, no pipeline, no per-brand config coupling.

---

## 2. Metric model (LOCKED 2026-07-10) — the core of this revision

This page counts **effort**, not delivery. They are different questions asked of the same
Jira pipeline, and keeping them distinct is the whole point.

### The Jira pipeline (canonical workflow, Lacey-confirmed)
```
Strategy
Ready For Design
In Design ──► Active Design · Design QA
Design Client Review
Ready For Dev
In Development ──► Active Dev · Dev QA
Dev Client Review          ← DCR
Queued
Live
Reporting
Done ──► Completed (Won) · Completed (Lost) · Completed (Null) · Client Implementing · Done
```
The pipeline **branches** — some tasks skip design entirely and go straight to dev.
Workflow does **not** skip the Active status within a phase (Lacey-confirmed) — a ticket
cannot jump Ready → QA/Review without passing Active. That makes the Active trigger
gap-free.

### The three metrics

> **⚠️ SUPERSEDED (2026-07-11) — see §5 "Step B findings → FINAL METRIC MODEL" for
> the canonical definitions.** The three-way design/dev/delivered split below was
> written before the Step B probe proved ClickUp `orderindex` can't finely separate
> design vs dev effort historically. The model collapsed to a single **EFFORT** bucket
> (reached any Active phase) + **DELIVERED** (reached any Client Review). The pipeline
> diagram above and the Ready-for-X exclusion still hold; only the metric breakdown
> changed. Retained here for provenance.

```
Design effort = ticket EVER reached  Active Design
Dev effort    = ticket EVER reached  Active Dev
Delivered     = ticket EVER reached  Dev Client Review (DCR)   ← subset of dev effort
```
- **Ready For Design / Ready For Dev are EXCLUDED** — they're on-hold queues; sitting there
  is not effort. Effort begins when work actually starts (Active).
- The three are **overlapping, not nested by design** — a design-only task counts for design
  effort but not dev; a design-skipped task counts for dev but not design; most count for
  both. Delivered is strictly a subset of dev effort (everything delivered had dev work).
- **Total effort = UNION**: distinct tickets where (Active Design **OR** Active Dev) was ever
  reached, counted **once**. Never sum design + dev — that double-counts the tickets that did
  both. Each metric is a per-ticket yes/no flag; a ticket is counted once per metric.

### Why this can't contradict coverage
Coverage/delivery already = first DCR in a rolling 28-day window (live dashboard,
unchanged). The archive's "delivered" is the same DCR event read all-time. Same spine,
different lens — they physically cannot diverge.

---

## 3. Isolation contract (locked, with one amendment)
- **New isolated table** (e.g. `client_archive`), **no FK** into `test_milestones` /
  `quality_logs` / `brands`. It stands alone.
- **AMENDMENT (2026-07-10):** the archive PAGE may additionally read a **live aggregate**
  from Jira (effort/delivery counts for active clients, so the all-time total climbs as new
  work happens). This is one-directional and aggregate-only: the archive page reads live; the
  coverage page and its KPIs **never** read the archive; no row-level JOIN or FK. The
  guarantee that matters is intact — **a poisoned archive row can never move a live KPI.**
  This is a deliberate, bounded exception and a Jenny checklist item.
- **Active vs archived clients:** active clients' numbers update live (frozen archive rows +
  live Jira); old/inactive clients are static (frozen only). No new tickets from old clients,
  so their numbers don't move.
- **Admin-editable** for old/sparse rows (some historical tasks will be missing fields).

## 4. Schema (overview-only + effort flags)
Tentative columns; confirm field availability in the §5 probe:
```
title · client · brand · shipped_date (see §6 date question)
reached_design (bool) · reached_design_at (date, nullable)
reached_dev    (bool) · reached_dev_at    (date, nullable)
reached_dcr    (bool) · reached_dcr_at    (date, nullable)   ← "delivered"
clickup_task_id · clickup_url
source (clickup_import | manual) · needs_review (bool) · created_at · updated_at
```
The three flag+date pairs power the "designed X · developed Y · delivered Z" comparison
per client and over time. Design for this even if some old ClickUp cards can only populate a
subset (see §7 dependency).

**Date source is decoupled from dedup source (see §6 amendment, 2026-07-10):** for the
~1,153 ClickUp-linked tickets, the ROW is deduped/counted on the Jira side, but the
`*_at` dates should come from **ClickUp** (Jira holds only Sept–Nov 2025 migration
timestamps). v1 accepts the Jira migration dates as a bounded approximation; v2 backfills
the true ClickUp dates.

**V2 hooks (leave room, do NOT build):**
- Per-user "star the projects I worked on" (user writes, auth-scoped satellite table — not a
  JOIN into coverage, so isolation holds).
- Employee-per-project attribution — **manual in-app annotation by CQIP users**; this data
  does **NOT** come from ClickUp.

---

## 5. Discovery steps — READ-ONLY, in order

### Step A — Jira-first key-coverage scan — ✅ DONE (2026-07-10)
Read-only scan of migrated CRO tickets across NBLYCRO + SPLCRO + FPOO for a parseable
`app.clickup.com/t/<id>` in the Description free-text.

**Results:**
- **1,232** tickets reference ClickUp; **100.0%** carry a parseable id (0 unparseable).
- **1,153** unique ClickUp ids → the exact-dedup allowlist for Step C.
- Per project: NBLYCRO 930 · FPOO 268 · SPLCRO 34.
- Effectively 1:1 (1,200 tickets = one task; 32 = 2–5 distinct tasks; 108 ids appear on >1
  Jira ticket).
- Jira created-date range **2025-09-16 → 2026-05-25** — i.e. migration *into* Jira happened
  Sep–Nov 2025; Jira holds only the recent slice.

**Reframe (important):** Step A settled **dedup**, not **sizing**. Exact-key coverage is
perfect, so the fuzzy/manual pile ≈ 0. But because Jira only goes back to Sept 2025, Jira
cannot size the archive — the entire pre-2025 history lives only in ClickUp. **Step B is the
real go/no-go.**

### Step B — ClickUp sample-Space probe (needs token; handle out-of-band)
Sample: **DWH — David Weekley Homes**, board view
`https://app.clickup.com/1226028/v/b/6-3887174-2` (workspace/team `1226028`).
- Resolve board-view URL → underlying List/Space/View id; confirm the API fans out from one
  URL to all that board's tasks with pagination.
- Inspect task shape: where **brand** lives (field vs board/list name), which **date** = the
  effort/shipped date, whether title/client are directly available.
- **Map ClickUp statuses → the Jira phases in §2.** ClickUp's own status names differ; we need
  the ClickUp equivalents of Active Design / Active Dev / DCR to apply the effort model on the
  ClickUp side. (Lacey will supply ClickUp→Jira status equivalents; the probe enumerates the
  real ClickUp status set to map against.)
- **Estimate volume** for this one client → extrapolate scale.

### Step B′ — status-history retrievability (THE SHARP DEPENDENCY)
Because effort/delivery are **"ever reached"** questions, they require **status history**, not
current status.
- **Jira side:** history is in the changelog — reliable. Confirm the changelog exposes
  Active-phase transitions for migrated tickets.
- **ClickUp side:** confirm old cards preserve enough **status/activity history** to detect
  they ever hit Active Design / Active Dev / DCR-equivalent. This is deeper in the card
  timeline than a simple DCR check, so it's the more demanding version of the question.
- **Fallback if ClickUp history is thin:** the pre-migration effort number falls back to
  current-status approximation ("whatever status the card sits in now"), which **undercounts**
  built-then-sent-back tasks. Knowing this before build decides whether pre-migration effort is
  "accurate" or "best-effort."

### Step B findings (2026-07-11) — READ-ONLY probe DONE

Live read-only probe of the Fusion92 ClickUp workspace (team `1226028`), token from
`.env.local`. Sample entry was the DWH board view; the probe expanded to map the full
CRO archive footprint. No build, no migration, no commit.

**Entity resolution + the list-vs-view gotcha.** Board-view URL `…/v/b/6-3887174-2` →
view `6-3887174-2` (type `board`) whose parent is **list `3887174`**. The board view is
**filtered** (`status NOT IN ('setup','experiment plan')`, `show_closed:false`, plus a
search) — fanning out from the *view* silently undercounts. **Fan out from LIST ids**
(`GET /list/{id}/task?include_closed=true&subtasks=false&page=N`, 100/page) for the true
complete set.

**Task shape.**
- **Brand / client = the LIST NAME** (`DWH - David Weekley Homes`, `FPOO - Fresh Pressed
  Olive Oil`, …; same `CODE - Name` convention as `brands.jira_value`; some archive lists
  are name-only). There is **no brand custom field** — client identity = which list the
  task lives in.
- **Title = `task.name`** (directly available).
- **DATE SOURCE confirmed:** `date_created` is 100% populated and is a **true historical
  date** — DWH spans 2019→2025 evenly, with **no Sept–Nov 2025 migration clustering** (that
  clustering is Jira's tell, not ClickUp's). **Validates the §6 decision: ClickUp holds the
  real work dates; no plan upgrade needed for dates.** `date_done` (~34% populated,
  historically present) is a reasonable *delivered/completed* proxy. `start_date` 0%,
  `due_date` ~1% — unusable.

**Raw ClickUp status set (~22, verbatim, one shared workflow):**
`Open · setup · experiment plan · draft strategy · strategy · creative queue · creative ·
qa (creative) · needs approval (creative) · dev queue · development · qa (dev) ·
needs approval (dev) · queued experiments · live · troubleshooting · reporting ·
(reporting backlog) · implement · completed (won) · completed (lost) · completed (null) ·
Closed`. Each status carries a numeric **`orderindex` (0→21)** — **the one usable historical
signal** (see B′). Phase anchors for Lacey to confirm: Active Design ≈ `creative`; Active
Dev ≈ `development`; Client Review ≈ `needs approval (creative/dev)` / `queued experiments`.

**Volume / scale (precise, gate 1) — full crawl of all 270 lists, top-level only
(`subtasks=false`, `include_closed=true`), 530 API calls, 0 errors:**

| Container | Lists | Top-level | Real* | Done-type |
|---|---:|---:|---:|---:|
| `CRO Projects` space (DWH, FPOO, LF, Conversion Fanatics, SPL) | 5 | 1,039 | 988 | 541 |
| `Neighborly` space (NBLY brand lists) | 14 | 2,869 | 2,733 | 1,236 |
| `Sonrava` space | 5 | 344 | 229 | 160 |
| `CRO Internal Projects` → **`Client Archive` folder** | 246 | 34,720 | 29,837 | 12,212 |
| **TOTAL** | **270** | **38,972** | **33,787** | **14,149** |

\* *real* = top-level minus `setup`/`experiment plan` scaffolding (ClickUp's own board-view
exclusion). Subtasks (per-experiment checklist scaffolding, à la the Batch 010 sub-task
exclusion) are **excluded entirely**. Earliest real test **2019-01-09** — clears the
2020/21 floor. By year: 2019 ≈ 2.7k · 2020 ≈ 3.6k · **2021 ≈ 7.7k · 2022 ≈ 9.8k (peak)** ·
2023 ≈ 6.1k · 2024 ≈ 3.0k · 2025 ≈ 1.0k (taper as clients moved to Jira / ClickUp winds
down). Of the ~34k, only the **~1,232** Step-A Jira-linked tickets have a live twin; the
rest (~32.5k) are **pre-Jira, ClickUp-only → the actual archive yield**. **Import = a
rate-limited multi-hundred-call ETL crawl (~7–8 min just for top-level counts; full detail
pull is larger), not a weekend script — scope accordingly.**

**B′ — status-HISTORY retrievability: FAIL for fine detail (ACCEPTED best-effort).**
- `GET /task/{id}/time_in_status` → **403 `TIS_027` "not available on your plan"** (tested
  2019 / 2022 / 2025 tasks). No other v2 endpoint exposes a task activity/status-change
  timeline.
- **Export path is equally barren.** The exportable/list-view columns are
  `assignee · dueDate · priority · status · name · startDate · dateCreated · dateUpdated ·
  dateClosed · timeLogged · timeEstimate · id · tag · + custom fields` — **current status +
  standard dates only, zero status-history / "date-entered-status" column**. The task object
  has no `history`/`activity`/`status_history` key. ClickUp *does* record a UI "Activity"
  feed (status changes with timestamps), but it is **not API-readable and not an export
  column**. The only untested escape hatch is the **owner-run full workspace data export**
  (Settings → Import/Export) — whether its JSON carries a per-task activity/history object is
  plan-dependent and needs a human to run + eyeball (I can't trigger it via API). Worth
  attempting before the account lapses, but **do not block on it.**
- QA-style custom fields (Code Summary / QA Doc / Passed QA) are **2024–25-only** (literally
  0 before 2023) — useless for the 2019–2023 bulk.
- **Consequence — ACCEPTED, no ClickUp spend (tool is being decommissioned company-wide):**
  pre-Jira effort/delivered are computed **best-effort from current status `orderindex`** — a
  monotonic lower bound (a done-type task, orderindex 16–21, definitively passed
  effort+delivery; a task sitting at an early status after a sendback is undercounted).

**FINAL METRIC MODEL (canonical — supersedes the §2 three-way split):**
- **EFFORT** = reached **any Active phase** (Active Design ∪ Active Dev). **One team-wide
  bucket.** Design and dev both count as effort; they are **not** reported as separate lines
  (`orderindex` can't finely split them, and we don't need it to).
- **DELIVERED** = reached **any Client Review** (Design Client Review ∪ Dev Client Review) —
  the client received work. No longer dev-specific.
- **Relationship:** DELIVERED ≤ EFFORT always (no client review without active work first).
- **INTENTIONAL DIVERGENCE from the live dashboard (document, don't "fix"):** live coverage
  counts delivered = **Dev Client Review ONLY** (operational truth, unchanged). The archive
  counts delivered = **either** client review (growth story). So **archive-delivered reads
  higher than coverage-delivered for the same client — by design.** The archive page must
  **state what it counts inline** so the gap reads as intentional, not a bug.

**Dedup notes (ClickUp-internal — new, beyond the Step-A Jira dedup):**
- Clients can appear in >1 ClickUp location — e.g. `[Archive] Spotloan` (Client Archive
  folder) **and** `SPL - Spotloan` (CRO Projects space). Likely **left-and-returned stints**
  = real work in both eras → **MERGE timelines, don't collapse to one**; dedup only
  genuinely-identical tasks across locations. *(Lacey to confirm the Spotloan left/returned
  theory.)*
- **Active vs archived maps to location:** `Neighborly` + `Sonrava` spaces (+ some
  `CRO Projects` lists) = active clients (update live from Jira); the **246-list
  `Client Archive` folder = frozen historical** (the isolation target).

**Gate status after Step B:** gate 1 (volume) = **PASS, scoped** (~34k real tests / 270
lists / rate-limited ETL); gate 2 (history) = **best-effort accepted** (orderindex floor);
gate 3 (dedup) = **cleared** (Step A) + ClickUp-internal merge rule above. Remaining human
inputs: phase-anchor status map, Spotloan left/returned confirmation, and (optional,
non-blocking) the owner workspace-export history check before decommission.

### Step B — final reclassification & recount (2026-07-11)

Applies Lacey-confirmed status→bucket mappings to the full 270-list top-level crawl.
**This recount supersedes the "~33,787 real" figure above** — that number only stripped
`setup`/`experiment plan`; the confirmed map also excludes `test ideas` (9,188) and the rest
of ideation, roughly halving the worked-on count.

**Final bucket map (canonical):**
- **NEVER-STARTED** (pre-work / ideation — NOT counted as worked-on): `open · setup ·
  strategy* · test ideas · experiment plan · creative queue · draft strategy · backlog ·
  dev queue`.
- **LIMBO** (in-flight; scan-not-worth-it → orderindex floor): `creative · qa (creative)
  [+ variant qa(creative)] · needs approval (creative) · development · qa (dev) ·
  needs approval (dev)`.
- **DONE** (delivered): `queued experiments · live · reporting · reporting backlog ·
  troubleshooting · implement · completed (won/lost/null) · closed · push live ·
  nbly content team · nbly product dev · approval (dev) [→ Dev Client Review]`.

**STRATEGY EXCEPTION (importer title-rule):** `strategy`-status tasks are pre-work
**EXCEPT** those whose title matches `^[A-Z]{2,3}\s?\d+` (a test number, e.g. `CF 33`,
`MLY 34`) — those are worked tests (mostly historic CF) and count as worked-on. Volume is
small: **216 match** (155 in Client Archive, 45 Neighborly, 11 Sonrava, 5 CRO Projects) vs
3,837 strategy pre-work.

**needs_review rule (STANDING):** any status not explicitly in the three buckets →
`needs_review`. **Never force-bucket an unknown status into a default.** `bucket` (73) is the
canonical example. This rule carries into the importer.

**Recounted headline (top-level, subtasks excluded, 270 lists, 530 calls, 0 errors):**

| Bucket | Count |
|---|---:|
| **WORKED-ON (tests built)** = LIMBO + DONE + strategy-CF## | **16,761** |
| — of which DELIVERED (DONE-type) | 15,827 |
| — of which in-flight (LIMBO, orderindex floor) | 718 |
| — of which strategy-CF## title matches | 216 |
| NEVER-STARTED / ideation (excluded) | 22,112 |
| NEEDS_REVIEW (unmapped status) | 99 |
| **GRAND TOTAL top-level** | 38,972 |

**Effort-vs-delivered pair for the archive: 16,761 worked-on / 15,827 delivered**
(delivered ≤ worked-on ✓, per the FINAL METRIC MODEL above).

**Per-space:**

| Space | never | limbo | done | strat-CF## | review | worked-on |
|---|---:|---:|---:|---:|---:|---:|
| CRO Projects | 465 | 14 | 555 | 5 | 0 | 574 |
| Neighborly | 1,526 | 42 | 1,255 | 45 | 1 | 1,342 |
| Sonrava | 168 | 5 | 156 | 11 | 4 | 172 |
| Client Archive | 19,953 | 657 | 13,861 | 155 | 94 | 14,673 |
| **TOTAL** | 22,112 | 718 | 15,827 | 216 | 99 | **16,761** |

**needs_review — complete unmapped-status dump (nothing force-bucketed):**
`bucket` 73 · `pending strategy approval` 5 · `complete` 4 · `direct implementation` 4 ·
`launch queue` 3 · `losses` 2 · `null` 2 · `wins` 2 · `client priority strategy` 2 ·
`completed` 1 · `approval (cre)` 1 — **99 total across 11 statuses**. Several read done-ish
(`complete`/`completed`/`wins`/`losses`/`null`) but stay `needs_review` per the standing rule
— the importer maps or flags them, never guesses.

**Status-history scan verdict (from the histogram):** LIMBO = 718 (1.8% of top-level) is the
only slice whose delivery is genuinely unknown, so the best-effort orderindex floor is
bounded-wrong by ≤1.8%. A limbo-only history scan is tiny in size but still has **no API
retrieval channel** (`time_in_status` 403; no activity endpoint) → **not worth pursuing**;
take the orderindex floor. (Owner workspace-export JSON is the only untested history source;
optional, pre-decommission, non-blocking.)

### Step C — dedup dry-run on the sample
For the sample client's ClickUp tasks, match against Jira:
- **Primary:** exact ClickUp-id match (from Step A's 1,153 allowlist).
- **Fallback:** fuzzy title + brand + date-window for id-less tasks.
- Output: exact-match rate, fuzzy residue, and count of **net-new** (in ClickUp, not in
  Jira) — the actual archive yield vs. duplicates already counted live.

**Dedup is now perpetual, not one-time.** Because the all-time total = frozen archive + live
Jira, dedup is the mechanism that keeps the running total correct forever: only ClickUp cards
with **no Jira twin** enter the archive, so migrated tickets are counted once (on the live
side). Step A's 100% exact-key result means this is clean.

---

## 6. Open inputs / to determine

**AMENDMENT — DATE SOURCE (decision 2026-07-10).** For tickets with a ClickUp link
(the 1,153 overlap): dedup counts them on the **JIRA** side, but their
effort/delivery **DATES must come from CLICKUP**, not Jira. Jira's dates for these
are migration timestamps (Sept–Nov 2025), not when the work happened — using them
would bucket old work into 2025 and distort the year-over-year growth chart.
- **v1:** accept Jira migration dates as approximation for the overlap (recent work
  lands in 2025 buckets; known, bounded, only affects the ~1,153 migrated tickets).
  Ship without date reconciliation.
- **v2:** backfill true ClickUp dates for the overlap tickets for accurate
  year-over-year placement.

This splits **which system counts it** (Jira) from **which date it uses** (ClickUp) —
they were previously treated as unified in §4.

- **Brand mapping** — from the probe (field vs board name). Confirm with Lacey if ambiguous.
- **Effort/shipped-date field** — from the probe; Lacey confirms the canonical one. Note the
  schema now wants per-phase dates (reached_design_at / dev / dcr) where history allows.
- **ClickUp status → Jira phase map** — Lacey supplies equivalents; probe enumerates real
  ClickUp statuses to map.
- **Full Space/board URL list** — Lacey provides per-client URLs when the backfill runs.
- **Date floor** — Lacey: ~2020 ideal / 2021 min. Confirm after the probe shows how far the
  sample data reaches. (Mockup currently hardcodes 2023 — make the since-year data-driven.)
- **ClickUp API token** — Lacey has one. Handle out-of-band (never over chat); `.env.local`
  canonical.

## 7. Dedup approach (settled, AC-verified + Step A-confirmed)
Description-regex **exact-id (primary)** + **fuzzy title/brand/date (fallback)**. Step A: 100%
of ClickUp-linked Jira tickets carry a clean id, so the exact path carries the overlap and the
fuzzy pile is minimal. Fuzzy matches and id-less rows set `needs_review = TRUE`.

## 8. Decision gates BEFORE any build
1. **Volume acceptable** (Step B) — is the scale sane for a one-time import + a table? **This
   is the primary go/no-go** (Step A already cleared dedup).
2. **History retrievable** (Step B′) — can we compute effort/delivery from ClickUp history? If
   not, accept current-status approximation for pre-migration rows, or narrow scope.
3. **Dedup coverage** (Steps A + C) — ✅ effectively settled by Step A (100% exact-key).
4. **Date floor confirmed** against real data reach.
5. **PARKED:** whether "true all-time incl. pre-Jira" surfaces on the **coverage page** or
   stays **archive-only**. Default lean: archive-only (preserves isolation). Decide at build.

## 9. Sequencing & gating
- **Discovery (this brief) = read-only, no Jenny.** Jira scan (done) + ClickUp read probe.
- **The eventual importer batch is NOT read-only:** new table (migration) + import mutation +
  new "Client Archive" route/page → **Jenny-gated** when scoped. Isolation contract (§3),
  including the live-aggregate amendment, is a Jenny checklist item.
- Sits **behind 006** on the board. Discovery can run in a gap; the build waits its turn.

## 10. Mockup status
Standalone mockup reviewed (`Client_Archive__standalone_.html`). Structure is good (animated
hero count-up, cumulative growth-by-year bars, all-time client directory + brand codes, v2
star/team corner gated "coming soon"). Claude Design revision drafted — three changes:
(1) drop "shipped" language, this page is **effort** not delivery; (2) surface the **three
counts** (design effort · dev effort · delivered) in hero + per client; (3) make the
since-year **data-driven**, not hardcoded 2023.

## 11. Smallest next physical action
Discovery Step A is done. Next physical action is **Step B** (ClickUp sample-Space probe +
Step B′ history-retrievability check) — gated on the token being in place out-of-band, and
sequenced behind 006. Until then, no build.
