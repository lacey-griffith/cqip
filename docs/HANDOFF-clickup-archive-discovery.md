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
