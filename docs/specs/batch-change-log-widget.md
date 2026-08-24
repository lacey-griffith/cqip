# Batch #3 — Change Log widget

**Board sequence:** #3 (head of the open sequence) · **Mode:** `auto`
**Gates:** no Jenny (read-only, no migration, no mutation route) · Karen post-flight · Lacey pushes
**Depends on:** nothing. #2 (G7 tab-stops) shipped 2026-08-23 at `2ad78bb`.
**Origin:** the other half of "Pulse restyle batch 4", dissolved by board rev 8.

> **This file is the batch authority, and it is deliberately the ONLY place this
> batch's detail lives.** CLAUDE.md §15 gets a pointer and nothing else — route
> (b), decided 2026-08-24. G7 put 4,744 chars into CLAUDE.md, most of it
> narrative a later r42 pass would have relocated anyway, and that consumed 70%
> of the extraction pass's margin. **Post-mortem goes at the bottom of THIS file.
> Cite by section number.**

---

## 0. Gate profile

Read-only over existing tables. **NO migration · NO schema · NO route · NO
mutation surface → no Jenny** (E-track). One new `audit_log` read. No version
bump expected: no new structural surface.

---

## 1. Gate 0 RE-DERIVED 2026-08-24 — and three board figures are wrong

**§15 says "RE-PROBE, never scale an old ratio."** Done. The board's constraints
were written against a 2026-08-03 probe.

| Quantity | Board (08-03) | **Actual (08-24)** |
|---|---|---|
| `audit_log` rows, all | 1,438 | **1,690** |
| Done cells | 539 | **620** |
| With per-cell audit row | 284 (52.7%) | **368 (59.4%)** |
| **Degraded path** | 255 (47.3%) | **252 (40.6%)** |
| Per-cell rows (`directive_brand_status`) | 352 | **505** |

### 1.1 ⚠ THE DEGRADED PATH IS SHRINKING, AND ITS ABSOLUTE SIZE IS FROZEN

**This is the finding that changes how the batch is built.** Done cells grew
**539 → 620** (+81) while the uncovered set went **255 → 252** (−3). So
**essentially every new done cell gets a per-cell audit row**, and the gap is a
**fixed historical backlog** — not a growing one.

**Consequences, both real:**

- The board's *"the degraded path is the load-bearing half, not an edge case"* is
  **still directionally right at 40.6% but its trend is the opposite of what the
  phrasing implies.** It shrinks as a share of the widget forever, with nobody
  doing anything. Do not build elaborate machinery on the assumption it grows.
- **It never reaches zero either.** ~252 cells are permanently in that state
  unless someone backfills. **The degraded render is permanent UI, not a
  transitional state** — so it must look deliberate, not like a loading failure.

### 1.2 ⚠ THE GROWTH RATE IS WRONG BY ~3×

Board: *"growing ~100 per 3 days."* **Actual: 252 rows in 21 days ≈ 12/day**
(27 in the last 3 days ≈ 9/day). The board's figure implies ~33/day.

**This does not change the `fetchAllPaged()` requirement** — 1,690 is already
690 rows past the cap. It changes only how alarming the trajectory is: at 12/day
the table crosses 2,000 in about a month, not a week.

### 1.3 Provenance of these figures

Probed directly against prod Supabase 2026-08-24 via `execute_sql`. **Per §13
r43 they are derived at write time, and per the G7 post-mortem they NAME THEIR
QUANTITY** — "done cells" is `directive_brand_status.status = 'done'` across all
projects; "per-cell audit row" is `audit_log.target_type =
'directive_brand_status'` with a `target_id` matching that cell. **The G7 batch's
own HIGH was a correctly-dated figure attached to the wrong quantity.** Do not
repeat it here.

---

## 2. Population — settled by the schema, not by judgement

**IN: `audit_log WHERE target_type = 'directive_brand_status'` — 505 rows, from
2026-07-17.**

Two writers, and that is the whole set:

| `changed_by` | Rows | Span |
|---|---|---|
| `l.hay@fusion92.com` | **299** | 2026-07-17 → 2026-08-21 |
| `system:convert-reconciliation` | **206** | 2026-07-25 only |

**OUT: the 383 rows with `target_type IS NULL`.** All 383 carry a
`log_entry_id`, and **all 383 resolve to `quality_logs` — zero to a cell, zero to
a directive.** Their `field_name` values confirm it (`who_owns_fix`,
`root_cause_final`, `issue_subtype`, `severity`, `log_status`). They are
quality-log audits from before `target_type` existed, which migration 017's
backfill did not reach.

> **⚠ A SCOPING QUESTION WAS ASKED AND WITHDRAWN, RECORDED SO IT IS NOT
> RE-ASKED.** 336 of those rows are written by **`lacey@cqip.local`**, an
> identity that appears nowhere on the board — which looked like a legacy cell
> actor worth matching best-effort. **It is not: the hit rate would be 0% by
> construction.** A matching pass would have run, found nothing, and produced an
> empty result that reads like a bug. The 2026-08-03 archive probe had already
> settled this — *"filtering on `target_type` will silently exclude them; that is
> correct for a Pulse widget"* — and this probe independently confirmed it.
> **The exclusion needs no on-screen boundary note**, because it is not a
> judgement about scope: those rows were never in this widget's population.
>
> **What DOES need a note is §4.** That is where inference is real.

**⚠ `target_type`-filtered counts will NEVER sum to the table total** (505 of
1,690). Anything that reconciles them will look broken. Do not build a total-row
check.

---

## 3. The read — `fetchAllPaged()` from the outset, no local copy

**Required.** `audit_log` is at 1,690 against PostgREST's 1,000-row cap, and a
capped read **returns short WITHOUT an error.**

**Reuse `fetchAllPaged()` from `lib/client-library/paged-fetch.ts`. Do not write
a local pager.** That file's own header records why: this repo learned the lesson
twice and both times fixed only the caller in front of it, and *"a local copy per
caller is how this drifted apart the first two times."*

**Also from that header, and it is the reason a short read is not merely
incomplete but MISLEADING:** there is no `ORDER BY` on an unranged select, so
rows come back in **physical heap order**, and Postgres MVCC writes an updated
row's new version to the heap tail. **The rows past the cap are the RECENTLY
EDITED ones.** A change-log that silently truncates therefore drops *the newest
changes first* — the exact opposite of what a reader assumes a change log is
showing them. **Count-verify against a separate `count:'exact', head:true` and
abort rather than render a short read**, which is the method Gate 0 itself used.

---

## 4. The degraded path — DECIDED 2026-08-22 (Lacey), unchanged

The **252 done cells with no per-cell audit row** render as:

> **"Resolved — date unknown"**, showing the **directive-level date** with the
> date **marked approximate**.

**⚠ NEVER substitute the directive-level date without the marker.** That would
make 40.6% of the widget quietly wrong in one direction — the G5a claims-tense
failure this project already tracks five instances of.

**Why this shape:** it shows the row rather than hiding it, and it labels the
date's provenance instead of passing a summary date off as a per-cell fact.

**Per §1.1 this is PERMANENT UI.** ~252 cells stay in this state indefinitely.
Style it as a deliberate state, not as an error or a loading skeleton.

---

## 5. Attribution ceiling — script vs human ONLY

**Every UI edit writes `changed_by = l.hay@fusion92.com`.** The widget can
distinguish **script from human**. It **cannot** distinguish *which human pass*.

**Any copy naming a finer provenance is claiming something the data cannot
support.** The archive records the specific trap: there is **no
`system:v21-trigger-backport` writer in `audit_log` at all** — that loader was
abandoned and never run, and its 8 items became UI hand-entry. So "V2.1 entries"
are **not separable from any other UI edit.**

**Two labels. That is the vocabulary.** `system:convert-reconciliation` → script;
`l.hay@fusion92.com` → human.

---

## 6. Placement — RECOMMENDED, and this is the one open decision

**Recommendation: `/dashboard/reports`, as a standalone read-only panel.**
Not on the Pulse matrix page. Two reasons, and the first is a hard gate:

1. **G7's standing gate forbids the alternative.** *"Decide the `role="grid"`
   roving-tabindex question before adding another focusable surface to that
   page."* The Pulse matrix page carries **1,105 tab stops** in the default view.
   A widget there adds more, and that decision is explicitly deferred. **Putting
   this on the matrix page would trip a gate shipped two days ago.**
2. **It avoids colliding with E3.** `CellEditStrip` is the designated seam for
   **012 Phase E3** (rich expandable directive rows), which is QUEUED. A change
   log in the row expansion would occupy the seam E3 needs.

**Reports page is also where Data insights (#4) is scoped**, and for the same
reason — read-only over existing columns, internal audience, "Reports page
first, extend elsewhere only where someone asks."

**⚠ Note the route's known gap, inherited not introduced:** `/dashboard/reports`
**has no middleware admin gate** — that is why the classifier's review surface
moved out of it into the edit-log modal. **This widget is read-only and shows no
data a Pulse viewer cannot already see**, so the gap does not bite here. Do not
add a mutation to this panel later without revisiting it.

**If Lacey rejects Reports:** the fallback is the directive row expansion, and
**then §6.1 becomes a blocker** — the `role="grid"` decision has to be made
first.

---

## 7. Acceptance

1. The widget renders every one of the **505** per-cell rows reachable by the
   read, verified against a separate `count:'exact', head:true`.
2. A deliberately capped read (page size forced to 100) **aborts visibly** rather
   than rendering a short list.
3. All **252** degraded cells render "Resolved — date unknown" with the
   directive-level date **visibly marked approximate**.
4. No copy anywhere distinguishes two human passes.
5. `target_type IS NULL` rows appear nowhere.
6. `npm test` passes, including new cases for the degraded-path classifier and
   the label vocabulary.
7. Both themes, per the G7 finding that a contrast defect was invisible in light
   mode.

**Extraction for test:** the degraded-path decision and the label vocabulary are
pure functions over rows — put them in `lib/client-library/`, not in the
component, so `node:test` can pin them. **The component itself stays untested, as
every other route does.** Say so rather than implying coverage.

---

## 8. Post-mortem

*(Written at ship. Stays HERE, per route (b) — CLAUDE.md §15 gets a pointer.)*
