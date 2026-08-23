# CQIP Batch Priority Outline

**Updated:** 2026-08-22 (rev 8.1 — sequence reordered by DEPENDENCY with an agent-mode column; 006 UNBLOCKED; Change Log widget 47% decision MADE. Amends rev 8, same day: Q1 RE-LOCKED; CLAUDE.md split shipped but MISSED ITS GOAL; restyle batch 4 DISSOLVED; Convert direct read SUPERSEDES 012 E2)
**Supersedes:** rev 7 (2026-08-19). **Delete rev 7 from project knowledge — this file replaces it.**
**Canonical source:** CLAUDE.md §15/§16 wins; CROSS_CLAUDE.md §5 mirrors it; this file mirrors both.
**Current deployed state:** Worker **`ab70878`** — verified via `/api/health` 2026-08-22, matching the pushed tip · **v3.0** · edge function `jira-sync` deployed 2026-08-09 23:22 UTC · **migrations 001–029, ALL APPLIED** (029 verified by direct query in the prod Supabase SQL editor 2026-08-18).
**⚠ Rev 7's "DECLARED v3.0 ≠ DEPLOYED" headline is RETIRED.** Both halves were false and the whole framing is stale: **v3.0 is live and Settings → System Info renders `3.0.0`.** What survives is the mechanism, and it is worth keeping because it fired again on this very push: **`package.json` is NOT in `paths-ignore`** (`**.md` · `docs/**` · `.github/**`), so it is a deploy **TRIGGER**, and `gen-build-info.js` reads it, so it is also a build **INPUT**. A version bump is never inert on either axis. The 17-commit split chain moved `package.json` plus three files under `scripts/`, so CI fired as expected and the SHA advanced to `ab70878`.
**⚠ `/api/health` reports the WORKER ONLY** — it does not reflect Supabase edge-function deploys, so a matching SHA says nothing about `jira-sync`. This SHA has misled twice; see settled discrepancy 6.
**This revision (8.1):** the OPEN SEQUENCE is reordered **by DEPENDENCY rather than need** and gains an **agent-mode column** (auto / accept-with-edits / manual) governed by one rule — *auto where failure is LOUD, manual where it is SILENT or writes to prod, Jenny-gated manual regardless*; **006's alerts channel is NO LONGER an external block** (Lacey has a channel cleared for testing), which unblocks 010.1 and ClickUp 2/3; and the **Change Log widget's 47% question is DECIDED** — the 255 uncovered cells render as *"Resolved — date unknown"* with the directive-level date marked approximate. **Two of the seven open decisions are now closed.**
**Rev 8 (same day):** Q1 re-locked (wording not final, QMS 25/32 target VOID); the CLAUDE.md split recorded as shipped **and as having missed its primary goal**, with a second extraction pass owed; restyle batch 4 dissolved into two unrelated items; Convert direct read added, superseding 012 E2; data insights and bulk cell edit added; QMS Recs 1–3 demoted with the Rec 2 open flag preserved.

---

## ✅ DISCREPANCIES — ALL SIX SETTLED 2026-08-15

Settled against `CLAUDE.md` §15/§16 and, where the answer is a fact about
production rather than a fact about a document, **probed directly**. Answers are
recorded here rather than deleted, so the next reader can see what was checked.

1. **Version — SETTLED: v2.9.** `package.json` is `2.9.0`, the CLAUDE.md footer
   reads v2.9, prod is `5795a89`. Rev 4's v2.5 and the working notes' v2.6 are both
   stale. **The sync-guard batch did NOT bump** — it was a defect fix with no new
   structural surface. The bumps since: telemetry-ac v2.7 → **v2.8**, logs-page
   v2.8 → **v2.9**.
   > **⚠ SETTLING THIS EXPOSED AN ERROR IN `CLAUDE.md` §16, now corrected there.**
   > The classifier-1 shipped entry claimed "v2.7 → v2.8" — but telemetry-ac had
   > *already* taken v2.8, so two batches were recorded making the same bump.
   > classifier-1 shipped **at** v2.8 without bumping. A version line is exactly the
   > kind of claim that reads as verified and is never re-derived.
2. **Migration ceiling — SETTLED: 001–028, all applied.** Rev 4's 001–025 is stale.
   026 (`ac_telemetry`) + 027 (`prune_grant_fix`) belong to **Batch telemetry-ac**;
   028 (`ai_review_pending` + `ai_confidence_band`) belongs to **Batch
   classifier-1**. Neither batch was listed in rev 4. 028 verified applied by
   probing the columns, not by reading the migration file.
3. **Pulse — SETTLED.** Shipped since rev 4: brand-page parity + matrix paused
   default (07-31), the cell-pagination hotfix (07-31), restyle core batch 2 of 4
   (08-02), restyle batch 3 of 4 (08-03), and the **matrix filter reorg + grid
   ergonomics** batch (08-14, prod `5795a89`). ~~**Remaining: restyle batch 4 of 4,
   NOT STARTED** — its Gate 0 audit-coverage count is done and recorded in §15, and
   it carries the G7 tab-stop item, which must not be folded earlier.~~
   **⚠ STRUCK IN REV 8 — "restyle batch 4" NO LONGER EXISTS.** It was dissolved
   into two unrelated items that share no dependency: **G7 tab-stops (sequence
   #2)** and the **Change Log widget (sequence #7)**. Gate 0 is still done and
   still applies — to the widget. Struck, not deleted: this discrepancy was
   settled 2026-08-15 against a batch that has since been dissolved, and the
   settlement itself remains correct for the series it described.
4. **Directive count — rev 6's answer (86 / 87) IS NOW STALE. RE-DERIVED
   2026-08-18**, grouped by `project_key` **and** filtered on `status`:

   | Quantity | Figure |
   |---|---|
   | **NBLYCRO active directives** | **87** |
   | NBLYCRO archived | 1 |
   | SPLCRO active | 1 |
   | Global active | 88 |
   | All rows | 89 |

   > **⚠ THE APPARENT THREE-WAY DISAGREEMENT WAS ONE STALE FIGURE PLUS ONE
   > MISLABELLED COMPARISON — not three readings of one number.**
   > · **"NBLYCRO active directives" = 87** — the live matrix header. **Correct.**
   > · **"directives holding cell work" = 88 of 89 rows** — the 409 runbook's
   >   figure. **A DIFFERENT QUANTITY**, and never in conflict once named: 88 of the
   >   89 rows hold cell work, which is why exactly **1** is movable.
   > · rev 6's **86 / 87** — genuinely **stale 2026-08-14 data**, superseded before
   >   rev 6 shipped.
   >
   > **THE LABEL IS THE FIX.** Unlabelled, "88 of 89" reads as a contradiction again
   > the next time someone opens the runbook — which is exactly what happened here.
   > Rev 6's own warning still stands and is now sharper: 87 is *also* NBLYCRO's
   > all-status count was true on 08-14 and is not today (all-status is 88), so even
   > the coincidence has moved. **Group by `project_key` AND filter on `status`, and
   > stamp the date** — this count has moved on every single probe, and every figure
   > written into a doc has been wrong by the next one.
   >
   > **The matrix result count now renders the per-project figure**, so the number
   > is visible in the UI rather than only derivable — which is the dated-series
   > gap G1 names, partially closed.
5. **Cron cadence — SETTLED: no doc says "daily".** `jira-sync` is
   `cron:jira-sync-6h` (00:00 / 06:00 / 12:00 / 18:00 UTC) and CLAUDE.md records it
   correctly in both places it appears. Grepped `CLAUDE.md` and all of `docs/`: the
   only "daily" claim was **verbal, in the 08-09 session**, and the only surviving
   written instance was this file's own discrepancy note. **Nothing to correct** —
   recorded so it is not re-hunted.
6. **`/api/health` scope — SETTLED and now RECORDED.** It reports the **Worker
   only** and does not reflect Supabase edge-function deploys, so a matching SHA
   says nothing about whether `jira-sync` shipped. It was **not** recorded in
   CLAUDE.md; it is now, and it is in this file's header. This SHA has misled
   twice.

---

## DONE (recent, for context)

```
✅ 012 directive CRUD (edit·soft-delete·archive)      SHIPPED + PUSHED + DEPLOYED 2026-08-18
                                                      15 commits 887f55e → e518624 (prod stamp as of 2026-08-18) · v2.9 → v3.0
                                                      migration 029 APPLIED TO PRODUCTION
                                                      Jenny ×2 · FIVE Karen rounds:
                                                        2H/7M/5L → 2H/1M/4L → 0/2M/2L
                                                        → 0/1M/2L → 0/0/3L
                                                      Read the SHAPE: the build's HIGHs were
                                                      round-one only; EVERY round-two HIGH was
                                                      in a FIX; rounds 3-5 found nothing above
                                                      MEDIUM. Core machinery re-confirmed at
                                                      three separate trees — what kept failing
                                                      was the CLAIMS.
✅ 005.1  Coverage redesign + BrandAdminDrawer        SHIPPED 2026-07-03
✅ auth chain + login-events + create-flow            SHIPPED + PUSHED 2026-07-06/07
✅ Brand Wellness (report + Reggie CTA)               SHIPPED + PUSHED 2026-07-07
✅ 005.2  Coverage Ledger redesign                    SHIPPED + PUSHED 2026-07-08
✅ 005.3  Coverage Ledger polish                      SHIPPED + PUSHED 2026-07-08/09
✅ 005.4  Coverage Ledger polish 2                    SHIPPED + PUSHED 2026-07-09 (deda4c1)
✅ 005.5  Reggie brand-detail drawer polish           SHIPPED + PUSHED 2026-07-09
✅ Admin drawer change #5 (remove redundant filter)   SHIPPED 2026-07-09
✅ ClickUp Client Archive — discovery + data-lock     DONE 2026-07-12 (51cfb03, 944ebd7)
✅ 012 Phase A  Pulse directive matrix (MVP)          SHIPPED 2026-07-17 (migration 024)
✅ 012 Phase B  Pulse monitoring ingest               SHIPPED + PUSHED 2026-07-17 (migration 025)
✅ 012 Phase E1 Pulse shell (rename + brand page)     SHIPPED + PUSHED 2026-07-21
✅ 012 E1 follow-on  cross-project client nav         SHIPPED + PUSHED 2026-07-21
✅ 012 Pulse inline directive editing (matrix)        SHIPPED + PUSHED 2026-07-21
✅ 012 Goal-directive bulk load                       DONE — zero gaps
✅ 012 Convert reconciliation backfill                RUN against prod 2026-07-25 (206 cells)
✅ 012 Pulse inline editing — BRAND PAGE              SHIPPED 2026-07-25
✅ 012 Pulse directive matrix controls                SHIPPED + PUSHED 2026-07-29 (72bb2a0)
✅ SYNC FIELD GUARD  skip-if-empty + audit rows       SHIPPED + PUSHED + DEPLOYED + VERIFIED
                                                       2026-08-09 (ae3e2f3 → 0bb2882 → 1b34ea3
                                                       → 4ec827c → 756c871)
✅ 012 Pulse brand-page parity + paused default       SHIPPED + PUSHED 2026-07-31 (5870dae)
✅ 012 Pulse cell-pagination HOTFIX                   SHIPPED + PUSHED 2026-07-31 (fdf367f)
✅ 012 Pulse restyle core (batch 2 of 4)              SHIPPED + PUSHED 2026-08-02 (2826f4b) v2.6
✅ 012 Pulse restyle batch 3 of 4                     SHIPPED + PUSHED 2026-08-03 (dc377df) v2.7
✅ Coverage metric honesty (target 4 + rename)        SHIPPED + PUSHED 2026-08-03 (9088343)
✅ Deploy unfreeze (keep_vars + CI canonical)         SHIPPED + PUSHED 2026-08-06 (d21ceea)
✅ telemetry-ac  AC → DC telemetry + System Info      SHIPPED (migrations 026 + 027) v2.8
✅ classifier-1  AI root-cause classifier Phase 1     SHIPPED + PUSHED (migration 028) — at v2.8,
                                                       SURFACE ONLY, never run (see PARKED)
✅ logs-page  dismiss guard + filter bar + AI strip   SHIPPED + PUSHED 2026-08-14 (cdb2cc6) v2.9
✅ logs-page  Combobox portal fix (clipped dropdown)  SHIPPED + PUSHED (9a65bb6 → 211e237)
✅ 012 Pulse matrix filter reorg + grid ergonomics    SHIPPED + PUSHED 2026-08-14 (5795a89)
```

*(Discrepancy 3 is settled — the 2026-07-29 → 2026-08-09 gap is filled above.)*

---

## DEFECT RECORD — sync erased human classifications

**Status:** FIXED + DEPLOYED + VERIFIED IN PROD · **Found:** 2026-08-09 · **Batch:** sync field guard

### What happened

The Jira sync wrote the QA-tab field block into `quality_logs` unconditionally.
When the Jira QA tab was empty — which it routinely is, because a ticket sent
back for rework has its QA tab cleared — the sync wrote empty values over
whatever a human had entered in CQIP. It ran every six hours, so any
classification entered in the dashboard survived at most six hours.

It also wrote **without an audit row**, which is why it went unnoticed from at
least 2026-05-26 until 2026-08-09.

### Confirmed loss

**27 field-values across 5 rows.** All recovered from `audit_log` and restored
manually 2026-08-10.

```
b77c1d57  NBLYCRO-1380  RBW 08   6 fields
a6111337  NBLYCRO-1432  MOJ 57   6 fields
a57c357c  NBLYCRO-1137  JUK 16   6 fields
bf5fc1d7  NBLYCRO-178   MRE 42   6 fields
67079106  NBLYCRO-1087  PDS 28   3 fields (never had category/subtype/res-type)
```

Affected fields: `issue_category` · `issue_subtype` · `resolution_type` ·
`root_cause_final` · `severity` · `who_owns_fix`.

The at-risk population was precisely the **open** logs (Blocked / Pending
Verification), because those are the rows still inside the sync's working set.
Closed rows were never re-synced and so kept their values.

### The fix

Sync skips a field when the incoming Jira value is empty. Non-empty Jira values
still overwrite. Seven fields guarded.

**The rule, as amended (§13 r37):** *can this column hold human work the sync can
destroy?* — with two sources, **editable in CQIP** (six fields) and
**authored by import** (`root_cause_description`, 32 rows of CSV-imported prose).
The original rule was `ALLOWED_FIELDS ∩ updateData`, which was a proxy for the
real question and missed the imported prose entirely. **Do not reduce r37 back to
source 1** — that reduction is what missed those rows.

Guarded set is also the audited set: §13 r2 coverage went 6/16 → 7/16.

### Verification

- Worker `756c871` live; edge function deployed and booted clean (closes the "never bundled or run" gap)
- 7 consecutive sync runs `success`, `logs_failed = 0` — 4 manual + cron at 00:00, 06:00, 12:00 UTC
- **Guard observed holding:** one row restored, manual sync triggered, all six fields survived. Then the remaining four restored.

### Caught before shipping (do not lose these)

- **Karen** — `addGuardedSyncFields()` followed by `updateData.severity = ...` reinstated the full data loss with 23/23 tests passing.
- **Karen** — three further guard-bypass shapes that passed 27/27: `Object.assign`, spreading `...mappedFields` into the literal, and a second `quality_logs` update. The last is live-adjacent: the loop already does a second update for auto-advance. All three now covered; the comment is a denylist of known-bad shapes, **not** a proof.
- **Karen** — the batch's own mitigation didn't exist: the pill gated audit-failure rendering on `status === 'failed'`, so an audit-write failure would have shown green. The ten-week silence the batch exists to end, reproduced inside its own fix.
- **Jenny** — the batch falsified §13 r7 ("sync updates all QA tab fields"). Left stale, a later batch would read r7 and reinstate the bug with every test green. Amended, plus new r37.

### Still open from this batch

- **ADF hazard.** `isEmptyForSync` treats any non-array object as non-empty. If Jira returns a cleared Paragraph field as an empty ADF doc rather than `null`, the guard's protection of `root_cause_description` does not apply. It **fails safe** — object into TEXT errors, the run counts `failed`, the prose survives — so the claim is qualified at every site rather than patched with a speculative ADF-shape heuristic. A `failed` run with an ADF error is the guard working, not a regression.
- **`root_cause_initial` is empty on 74/83 webhook-created logs** (vs 0/38 CSV-imported). Not a sync bug — the sync never writes it. §13 r3 snapshots it at log creation, and the Jira QA tab is already cleared at sendback time, so the snapshot captures nothing. **This is a Jira-workflow decision, not a code fix.** Filed, not fixed.
- **A second system identity writes `log_status`.** Audit rows at cron timestamps (12:00:04–12:00:08 UTC) passed a `changed_by NOT LIKE 'system:%'` filter, so sync writes that field under a bare identity. Consequence: provenance queries that filter on `system:%` **overcount human writes**.
- **Directive archiving IS reachable — via direct SQL — falsifying a "verified unreachable" claim.** §15 carried Karen's LOW-8 finding, dated **2026-07-29**, that archiving could not happen: no archive writer anywhere in `app/api/`, create never sets `status`, archive UI still an open TODO. **Prod contains `Submits Form Lead - Combined`, archived**, beside a replacement `Remove Submits Form Lead - Combined`. **The 07-29 audit only looked at `app/api/`, so direct SQL was outside its scope.** The consequence LOW-8 predicted is therefore live, not hypothetical: `loadProject` loads `status='active'` only, so **archived directives are invisible to matrix search and count 0 toward `hiddenByStatus`** — an exists-but-archived title reads as "found nothing", which is the duplicate-creation hazard `countHiddenByStatus` was built to mitigate. It also keeps its 16 cells, which is why total cells (1,393) exceed rendered cells (1,377).
  > **STANDING LESSON: a "no writer exists" claim must state WHICH SURFACES WERE CHECKED.** "Verified unreachable" is only ever true of the surfaces in scope. This audit was correct about `app/api/` and wrong about the system, and nothing in its wording said so. Scope the claim or it will be read as absolute.
- **Taxonomy drift found in the restored values.** `issue_category = "Client Request"` is a root-cause value, not a category. `"Styling Change Request"` and `"Copy Change Request"` are not among the 29 subtypes in `root-cause-taxonomy-mapping.md`. Either Jira gained options after that doc, or this is older cross-field pollution. Values were restored **as recorded**, uncorrected.

---

## NEW BATCH — Keep-both-and-flag (sync/human misalignment)

**Gate:** Jenny (migration + write-path change) · **Size:** MED · **Sequenced:** below

The guard stops the *blanking* case. It does not address the case where Jira has
a value and it disagrees with the human's. Today, Jira wins silently.

**Decided (Lacey, 2026-08-09):** human entry should survive a Jira overwrite, and
ideally **both values are kept with the misalignment flagged**.

Scope to define at spec time:
- Jira-sourced value stored alongside the human value (new columns, per guarded field or a single JSONB sidecar — undecided)
- A misalignment flag + a surface that shows it
- What "resolve the misalignment" means as a user action
- Whether the flag reuses `needs_review` or gets its own column (`needs_review` clears on any row save per §13 r29, which makes it a poor fit)

**Do not bundle** with the render-only UI batch.

---

## QMS RECOMMENDATIONS — RE-TIERED under the new Q1 (rev 8)

Baseline score 17/32, from `REVIEW-cqip-qms-baseline-2026-08-02.md`.

**⚠ Q1 WAS RE-LOCKED 2026-08-22 (Lacey), and this section is downstream of that.**

- **Was:** provability-to-client.
- **Now:** **operator load reduction · quantitative data for leadership · insight
  into the CRO department.**

**⚠ The wording is NOT FINAL.** Lacey was still revising when the session ended.
The consequences below were applied to the board regardless, because they change
sequencing today:

- G2 criterion validation drops to **optional**.
- Rec 1 and Rec 3 **demote** to nice-to-have.
- Rec 2's *case* gets **stronger** — leadership reporting is month-over-month by
  nature — **but Rec 2 was demoted anyway.** See the open flag.

**⚠ THE 25/32 SCORE TARGET IS VOID.** It was derived from the old Q1. **No
replacement target has been set, and a rescore is owed.** Do not quote 25/32.

| Rec | Was | Now | Note |
|---|---|---|---|
| **Rec 1** — ticket-lag sample | #2 | **BACKLOG, nice-to-have** | Trigger: required before any delivery-timing figure goes in a leadership deck. The `audit_log` path is **exhausted at n=4**; the remaining path is SharePoint screenshot metadata **by hand**. Still the classifier's free unpark path. |
| **Rec 2** — version the requirement set | #6, then required | **BACKLOG** | ⚠ See the open flag below. |
| **Rec 3** — split 010.1 | #5 | **BACKLOG, nice-to-have** | Per-brand contracted targets are a client-contract artifact. Genuinely optional under the new root. |
| **Path 2 boundary** (`≤ 2` vs `< 2`) | inside Rec 2 | **OWN BACKLOG LINE** | One sentence plus a review date. Open since early June. Closes G4a. |

> **⚠ OPEN FLAG — NOT RESOLVED. Rec 2 vs the new Q1.**
> Rec 2 closes **G1**. G1 says coverage % is not trendable against a moving
> denominator — **and that is precisely the leadership number the new Q1 asks
> for.** Demoting Rec 2 may therefore be inconsistent with the re-lock. Lacey
> demoted it knowingly, mid-revision. **Recorded so it is not silently inherited
> as settled.**

**G6 (review independence) cannot be closed from inside the function.** It needs
one external human review. Do not bring another self-review as evidence against
it.

---

## OPEN SEQUENCE — reordered by DEPENDENCY, 2026-08-22 (rev 8.1)

**Rev 8 ordered this by NEED. Rev 8.1 reorders it by DEPENDENCY** — need is a
judgement that moves every session; a dependency is a fact about what cannot
start until something else finishes. Ordering by the fact makes the parallelism
visible: **six of the thirteen have no dependency at all.**

The **MODE** column is the agent-autonomy setting, not a difficulty rating.

```
     BATCH                     MODE     DEPENDS ON
 1   SECOND EXTRACTION PASS    manual   —
 2   G7 TAB-STOPS              auto     —
 3   CHANGE LOG WIDGET         auto     —          47% DECIDED (see below)
 4   DATA INSIGHTS             accept   —
 5   006 TEAMS DISPATCH        accept   —          NO LONGER BLOCKED
 6   010.1 REMAINDER           accept   #5
 7   CLICKUP PHASE 2/3         manual   #5 · Jenny
 8   CONVERT DIRECT READ       accept   —
 9   008 CONVERT AUTOMATION    accept   #8 — may fold in
10   KEEP-BOTH-AND-FLAG        manual   Jenny
11   012 PHASE C               accept   Jira-permission verify
12   012 PHASE D               manual   #11 · Jenny · public surface
13   007 JIRA BOARDS           auto     —
 —   BULK CELL EDIT (backlog)  manual   Jenny
```

**THE MODE RULE, and it is about the failure mode, not the risk:**

> **`auto` where failure is LOUD. `manual` where failure is SILENT or where the
> batch writes to production. Jenny-gated is `manual` regardless.**
> `accept-with-edits` is the middle: review each edit, but the blast radius is
> bounded and a mistake surfaces.

Why that rule and not "manual for the scary ones": this file's whole defect
record is **silent** failure — a sync that erased human classifications with no
audit row, a paginated read that truncated at 1,000 with no error, a live hazard
archived because its bullet was `[x]` on the half that was done. **Loud failure
is safe to automate; a green run that is wrong is not.** So `007 Jira Boards` is
`auto` despite being the largest item on the board (it is read-only against a
cache, and a wrong board is visibly wrong), while the **second extraction pass is
`manual` despite being docs-only** — its failure mode is dropping a live
obligation into an archive where r40 makes it stop existing, which is exactly
what the split's own oracle caught twice.

**#1 and #2 ship back-to-back but in SEPARATE PUSHES.** Sharing a chain means a
G7 revert drags the restructure with it. *(Note the rev-7 assumption that a
CLAUDE.md batch is "docs-only and skips CI" proved WRONG in execution — the split
moved `package.json` and three `scripts/` files, so it deployed. The second pass
should stay genuinely docs-only, and that is now something to check rather than
assume.)*

**#1 detail — the second extraction pass.** Re-derived at write time: CLAUDE.md
is **163,228 chars**, still **13,228 over** the 150,000 tool limit and **43,228
over** the 120,000 r41 ceiling. §15 (**69,331**) and §13 (**50,212**) are the
loads; **§16 is index-only at 12,812 and r41's remedy #1 is spent**, and r41
explicitly rules §13 out as a candidate. That leaves **§15 via r42** and the §16
archive index.

---

## STRUCTURAL CHANGES TO THE BOARD (rev 8)

### DISSOLVED — "Pulse restyle batch 4 of 4"

Not restyle work, and not one batch. **Two unrelated items sharing a name**,
split because they share no dependency:

- **G7 tab-stops** → sequence **#2**
- **Change Log widget** → sequence **#7**

**Change Log widget facts, for whoever scopes it:**

- New `audit_log` read. **Must use `fetchAllPaged()` from the outset** — 1,438
  rows on 2026-08-03 against the 1,000-row PostgREST cap, growing ~100 per 3
  days. Well past it now.
- **Gate 0 verdict:** only **284 of 539 done cells (52.7%)** hold a per-cell
  audit row; 255 have directive-level summaries only. **The degraded path is the
  load-bearing half, not an edge case.**
- **Attribution ceiling: script vs human only — NOT which human pass.** Every UI
  edit writes `changed_by = l.hay@fusion92.com`. Any copy claiming finer
  provenance is unsupported by the data.
- **✅ DECIDED 2026-08-22 (Lacey) — THE BATCH IS UNBLOCKED.** The 255 cells with
  no per-cell audit row render as **"Resolved — date unknown"**, showing the
  **directive-level date marked approximate**. This is the right shape: it shows
  the row rather than hiding it, and it labels the date's provenance instead of
  presenting a summary date as a per-cell fact. **Do not silently substitute the
  directive-level date without the marker** — that would make 47% of the widget
  quietly wrong in the same direction, which is the G5a claims-tense failure this
  file already tracks.

### NEW — Convert direct read (sequence #4) · SUPERSEDES 012 E2

Xandor is **both slow and unavailable**. CQIP reads Convert directly. ConvertX is
not a foundation to build on — this is ground-up.

- **012 E2 is SUPERSEDED, not blocked. It is removed from BLOCKED.**
- **The enum decision is now unilateral.** CQIP defines `issue_type` and severity
  at the source. No mapping negotiation, and no widening migration forced by
  someone else's schema. That is a real simplification, not just a reassignment.
- **Unresolved:** whether **008 Convert.com automation** folds into this batch or
  becomes its phase 2. 008 automates against Convert; #4 builds the reader.
  **Check for collision before scoping either.**
- Scope after the split's second pass lands.

### NEW — Data insights (sequence #3)

For **Lacey and the CRO team internally** — not leadership decks, not
client-facing. **That scoping is what keeps it small.**

- **Period-over-period distribution shifts** on taxonomy fields that already
  exist: `issue_category`, `root_cause_final`, `severity`, `who_owns_fix`.
- **Every insight names its denominator and its date.** G1 says coverage % is not
  comparable period to period; an insight silently comparing two populations is
  worse than no insight.
- **Small-n suppression.** Below a threshold, show the count and no percentage.
  Percentages on n=6 are how a team talks itself into a pattern.
- **Facts, not conclusions.** *"Client Website Code 40%, was 22%"* is supportable.
  *"Client code quality is declining"* is not.
- **Reports page first.** Extend elsewhere only where someone asks.
- Read-only over existing columns → **no migration, no new mutation route, no
  Jenny.**

---

## BLOCKED / QUEUED / PARKED / HOLD (rev 8)

**BLOCKED (not sequenced):** *(none)* — **012 Phase E2 was removed from this list
in rev 8.** It is **SUPERSEDED** by Convert direct read (#4), not blocked: the
Xandor dependency it was waiting on is exactly what #4 routes around, and the
enum/severity mismatch that made it a negotiation is now a unilateral CQIP
decision.

**QUEUED (not sequenced):** 012 Phase E3 (rich expandable directive rows).
`CellEditStrip` is the designated seam. Rec 2 was previously sequenced ahead of
it; **Rec 2 is now BACKLOG**, so E3 no longer waits on it — but E3 adds lifecycle
dates, so if Rec 2 is ever revived it should still land first.

**PARKED (with a reason):** AI root-cause classifier — see the section below,
retained from rev 7. **The draft for rev 8 supplied no replacement for that
section, so it was kept rather than deleted**; its one rev-8 change is that
Rec 1, its free unpark path, is now BACKLOG rather than sequence #2.

**✅ NO LONGER BLOCKED — 006 Teams dispatch (DECIDED 2026-08-22).** The alerts
channel was an external block for months and nobody had re-verified it. **Lacey
has a channel cleared for testing**, so the block is gone and **006 moves to
sequence #5 with no dependency.** It **unblocks 010.1 (#6) and ClickUp Phase 2/3
(#7)** with it — two items that had been parked behind it. *Struck from the open
questions below.* This is §13 r32 / R21 working: a blocker carried past 7 days
was re-checked and turned out not to be real, which is the second time in this
file's history (Batch 009's phantom Azure gate ran 23 days).

**HOLD (not sequenced):** Admin drawer change #4 (QA-URL-pattern editor removal)
— AC gate RED, no Forge write path. Removing the editor strands the QA-URL
config. Revisit only if a Forge write path lands.

---

## BATCH #1 — CLAUDE.md SPLIT · OUTCOME

**17 commits. Two Jenny rounds, four Karen rounds. PUSHED 2026-08-22; prod
`ab70878`.**

### ⚠ IT MISSED ITS PRIMARY GOAL

All three figures re-derived at write time (r43) at `ab70878` — **the rev-8 draft's
numbers were taken before the final fold and are all superseded**:

```
CLAUDE.md   163,228 chars
            150,000  tool limit    109%   ⚠ STILL OVER by 13,228
            120,000  r41 ceiling   136%   ⚠ STILL OVER by 43,228
```

- **§15 — 69,331** against a ~34,000 budget. Overshot; reported, not tightened,
  per instruction.
- **§13 — 50,212.** Grew by design this batch (r40, r41, r42, r43, r38 inlining).
- **§16 — 12,812, index-only.** Fully rolled. **It cannot give more, so r41's
  remedy #1 is spent** — the rule was amended to say so rather than leaving an
  exhausted prescription reading as actionable.

**A second extraction pass is owed. §15 and §13 are the remaining loads, and
r41 explicitly rules §13 out as a candidate** — which leaves §15 (r42) and the
§16 archive index as the only levers.

### New standing rules this batch produced

- **r40** — the archive is append-only history, **never authority** for current
  state. Contract in the rule; **mechanism** in a banner at the top of every
  archive file, because *proximity is not protection*.
- **r41** — rollover triggers on a **size ceiling, not the calendar**. Month is a
  15× spread (7,737 to 118,698) and is not a size unit. **Unit stated in the rule
  text**; bytes run ~+1.0% over chars in this file.
- **r42** — a §15 sentence that does not name an action must name **where its
  substance now lives** (a §13 rule number or an archive filename). Neither an
  action nor a citation = violation. **Relocates, never deletes.**
- **r43** — **every figure must be re-derived at the moment it is written, never
  transcribed** — including from your own verification output in the same
  session. Three instances in one fold prompted it.

### What the controls caught — the batch's real value

- **Two live obligations swept into the May archive** (005.22 Phases 4 and 5).
  Every slice stayed valid Markdown; **the only signal was the checkbox count
  going 49 → 47.** Recovered.
- **An archive block dragged back into §15** — *inside the fix for the first
  defect.* Surfaced by per-section measurement, not by reading.
- **A live production hazard erased by a docs batch.** The ADF hazard's bullet
  was `[x]` on its first half and headed **STILL OPEN** on its second, and was
  archived whole. The `[ ]`-only oracle left **22 archived `[x]` bullets
  unaudited**; exactly one hid a live obligation. Restored — and the
  **"Eight items"** header sitting above 7 bullets is its own regression test.
- **The size assertion validated its own design on first run**, naming §15 as the
  largest section — so the reflex remedy (roll §16 over) would have moved nothing.
- **Jenny caught CRITICAL-1: r23 bullet 1 was the regrowth engine.** That 25k
  header paragraph grew because a rule ordered 77 batches to append to it.
  Unamended, the extraction would have been a one-time reclaim by construction.
- **Scope was too small twice** — §16-only leaves ~256k; (a)–(h) leaves ~266k.
  **Both misses came from reading sizes off the inventory instead of re-deriving
  them**, which is what produced r43.

### Standing constraint, extended

> The inventory (`5265227`) is authority for **WHAT EXISTS**. Never WHERE, never
> HOW BIG. **Re-derive line numbers AND sizes at execution time.** State units.

---

## PARKED — AI root-cause classifier

**Status:** PARKED, not dropped · **Re-parked:** 2026-08-14 · **Reason:** NO CREDENTIAL — and the spend question is unresolved at F92

> ### ⚠ THIS SECTION'S ORIGINAL REASON IS SUPERSEDED — READ THIS FIRST
>
> Rev 5 parked this for **"no viable answer key"** at n≈15, unparking at ~40
> verified classifications. **That reasoning no longer applies and the batch
> SHIPPED.** It unparked on a reframe: the classifier suggests, a human confirms or
> corrects on rows she was already touching, and **the correction rate IS the
> validation** — it builds its own answer key as it runs. Do not reintroduce a
> score-against-history step; at the available n it cannot distinguish a good
> classifier from a lucky one.
>
> **What shipped:** migration 028, `lib/classifier/*`, two admin routes, and the
> review surface — which moved from a standalone Reports queue into the edit-log
> modal, because `/dashboard/reports` has no middleware admin gate.
>
> **What did NOT ship: a single classified row.** `ai_review_pending` is true on
> **0 of 122**, and the route answers **500 `not_configured`** by design until a key
> exists. **The blocker is now commercial, not technical.**
>
> - **Blocker:** `CQIP_ANTHROPIC_API_KEY` unminted. API usage is **paid** and the
>   spend question is **unresolved at F92**. Nothing in the codebase waits on code.
> - **FREE ALTERNATIVE, NOT YET TRIED — do this BEFORE paying for anything:** use
>   **Rovo in the Jira UI** to classify **~10 logs by hand**, entered through the
>   existing edit modal. No build, no credential, no spend. It tests exactly what
>   the money would buy, because the correction rate is the only validation either
>   way.
> - **Unparks on EITHER:** the credential being minted, **or** that manual pass
>   showing suggestion quality good enough to justify automation.
>
> Everything below is the original 2026-08-10 rationale, kept because its design
> locks (suggester-not-writer, blinding, set-overlap scoring) all shipped intact.

The proposal: use Rovo (Jira/Confluence) and Copilot (Teams/M365) to read ticket
summaries, descriptions, comments and channel context, and suggest
`root_cause_final` on open quality logs.

**The idea holds up.** `resolution_notes` on four of the five damaged rows state
the root cause in plain prose — "Client requested copy change after
development", "sat for awhile causing the page to have shifted". That is real
feedstock, and it is already in the database.

**Locked design decisions:**
- **Suggester, not writer.** It proposes into `ai_suggested_root_cause` with `ai_confidence_score` (both columns already exist in `quality_logs`). A human confirms into `root_cause_final`. An AI writing the canonical field directly is G5a at scale — inference recorded as verified.
- **`needs_review = TRUE` on every AI-written row.** The column and the constrained edit dialog already exist for exactly this.
- **Rovo for Jira, Copilot for Teams.** Copilot has no write path into CQIP, so the Teams half is human-relayed by construction. That reinforces suggester-not-writer rather than limiting it.
- **Blind the classifier.** It must not read the existing `root_cause_final` when scoring, or it is copying rather than classifying and the match rate is meaningless.
- **Scoring is set overlap, not string equality.** `root_cause_final` is an array; exact match, partial match, and miss are three different outcomes.

**Why it's parked:** validating the classifier needs an answer key of
human-verified values. The count came in at 20 rows, then 15 once the 5 damaged
rows were excluded, and lower still now that a second system identity is known to
inflate the `system:%` provenance filter. **At n≈15 the test cannot reliably
distinguish a good classifier from a lucky one** — it can barely catch a bad one.

**Unparks when either:** the verified-classification count reaches ~40, or Rec 1's
pass produces a hand-labelled set that doubles as an answer key.

**Note on framing:** the backlog case is weak — ~66 unclassified rows is an
afternoon of manual work. The real case is **forward-looking**, every log from
here on. Scope it that way or it won't justify itself.

---

## COUPLINGS / DEPENDENCIES

- **Rec 1 → classifier:** Rec 1's ~30-ticket pass can double as the classifier's answer key. Same sample, two outputs. **But not the same artifact** — if the classifier supplies Rec 1's evidence, the check is satisfiable by the thing that produced the value, which violates S5.
- **Rec 2 → Phase E3:** effective-date the requirement set before E3 adds lifecycle dates.
- **Rec 3 → 010.1 → 006:** splitting the target half off removes the external 006 dependency from the measurement fix.
- **006 → 010.1 (alerting half):** stays behind 006.
- ~~**012 E2:** blocked on Xandor — does not block anything else in 012.~~ **STRUCK in rev 8 — E2 is SUPERSEDED, not blocked.** Convert direct read (#4) routes around the Xandor dependency entirely. Struck rather than deleted so the coupling's disappearance is traceable.
- **ClickUp Phase 2 ETL:** Jenny-gated; behind 006.
- **Guard → keep-both-and-flag:** the guard is the floor; keep-both is the ceiling. Do not treat the guard as the finished design.

---

## BACKLOG

**Added or re-tiered in rev 8:**

```
- BULK CELL EDIT              NEW. Jenny-gated (new mutation route) and it MUST
                              keep per-cell audit_log writes. Evidence: the MRR
                              v2.3 trigger ship, 2026-08-22 — 18 directive cells
                              needed a status flip from ONE file ship (7 Done,
                              10 In progress, 1 N/A, all one brand), ~4 clicks
                              each = ~70 clicks of paperwork for one deploy.
                              Cost scales with DIRECTIVE COUNT, not work done, so
                              every trigger ship now carries a manual matrix pass.
                              Lacey offered the MRR cell list as a test case —
                              take it.
                              ⚠ Confirmed absent from §15, §15.5 and every
                              backlog list before rev 8. §16 mentions it only as
                              "out of scope" for the restyle batches — a record
                              that it wasn't done, NOT a commitment that it will
                              be.
- QMS Rec 1                   DEMOTED to nice-to-have. Trigger: required before
                              any delivery-timing figure goes in a leadership
                              deck. audit_log path exhausted at n=4; remaining
                              path is SharePoint screenshot metadata by hand.
- QMS Rec 2                   DEMOTED. ⚠ See the open flag in the QMS section —
                              this demotion may be inconsistent with the new Q1.
- QMS Rec 3                   DEMOTED to nice-to-have. Per-brand contracted
                              targets are a client-contract artifact.
- Path 2 boundary decision    <=2 vs <2. One sentence plus a review date. Open
                              since early June. Closes G4a.
- Second extraction pass      OWED. The split missed its goal. §15 and §13 are
                              the loads; r41 rules §13 out, leaving §15 (r42)
                              and the §16 archive index.
- Stale prod-SHA claims       8 of 10 RESOLVED BY RELOCATION during the split —
                              the entries carrying them moved to the archive,
                              where r40 makes them history rather than current
                              claims. Only the v2.8 title-line half is still
                              actionable.
- Addendum 7 resolver bug     The reconciliation tool's exact-match resolver
                              keyed a plain dict by goal NAME, so on a collision
                              the ARCHIVED duplicate silently won and produced a
                              FALSE DOWNGRADE. Same hazard class as LOW-8 and
                              migration 029. ⚠ STATUS AT SOURCE: UNKNOWN — the
                              tool is not in this repo. The output is corrected;
                              the generator is unverified. Do not regenerate
                              that CSV until it is established.
- Convert 08-07 directory     CHECKED and INCONCLUSIVE, not empty — 4 rows, all
                              convert_name values distinct, but TWO SHARE A
                              TITLE. Its Claudette handoff section is the
                              strongest in-repo lead on tool ownership, so it is
                              the first place a future session should look.
- repo-structure.md r23 debt  r23 now names the file as a per-ship destination.
                              Migrations and scripts paid off 2026-08-22; API
                              routes (~16 of 24) and docs/*.md (~9 of 39) are
                              still short.
```

---

## OPEN THREADS (not sequenced — hygiene / external)

**⚠ OWED, AC-FACING — `CROSS_CLAUDE.md` is stale against its OWN content.** Its
footer reads **2026-07-17** while its §6 event log already carries **2026-08-07**
and **2026-08-08** entries. So it is not merely behind the August run: **the file
disagrees with itself**, and its footer is the line a reader uses as a state read.
A mirror that cannot be trusted as a state read by its own reader is worse than an
absent one, because it is consulted with confidence. It has also missed this entire
batch — a contract-surface-free batch, so no §3 change is owed, but the §6 event log
and the footer both are. **NOT written in this revision, deliberately:** it is the
joint DC/AC doc, and per CC1–CC8 an AC-facing mirror update is coordinated rather
than unilateral. Flagged here so it is owed on the record rather than remembered.


```
- Azure client secret re-rotation      DELIBERATE HOLD (Lacey's call) + blocked on Carl.
                                        Not stale-rot — do not re-flag.
- Microsoft Entra SSO                   Organizationally blocked on Carl. Open engineering
                                        question: identity keyed on auth.uid() or email.
- CQIP_BRANDS_API_TOKEN rotation        hygiene; 4-surface atomic
- Dependabot vulnerabilities            open
- Supabase CLI is v2.90.0, v2.113.0 available
- CROSS_CLAUDE.md §6 hygiene flag       Teams DM as v1 token handoff. Revisit if a third
                                        party joins cross-Claude work OR F92 adopts a
                                        password manager.
- Xandor enum reconciliation            see BLOCKED above — decision owed
- /api/health tracks the Worker only    Not the Supabase edge function. Record it; this SHA
                                        has now misled twice.
```

---

## CHANGE LOG

- **2026-08-22 (rev 8.1)** — **Amends rev 8 the same day with three additions the rev-8 draft was missing.** **(1) OPEN SEQUENCE reordered by DEPENDENCY, not need**, and given an **agent-mode column**. Need is a judgement that moves every session; a dependency is a fact about what cannot start until something else finishes — and ordering by the fact makes the parallelism visible: **six of thirteen have no dependency at all.** The mode rule is about the FAILURE MODE, not difficulty: **`auto` where failure is LOUD, `manual` where failure is SILENT or the batch writes to production, Jenny-gated `manual` regardless**, with `accept-with-edits` as the bounded middle. That is why `007 Jira Boards` is `auto` despite being the largest item (read-only against a cache; a wrong board is visibly wrong) while the **second extraction pass is `manual` despite being docs-only** — its failure mode is dropping a live obligation into an archive where r40 makes it stop existing, which the split's own oracle caught twice. This file's entire defect record is silent failure, so the rule follows the record. **(2) 006 Teams dispatch is NO LONGER BLOCKED** — the alerts channel had been an external block for months with nobody re-verifying it; **Lacey has a channel cleared for testing**, so 006 moves to **#5 with no dependency and unblocks 010.1 (#6) and ClickUp Phase 2/3 (#7)**. That is §13 r32 / R21 working, and the **second** phantom gate this file has recorded (Batch 009's Azure block ran 23 days). **(3) The Change Log widget's 47% question is DECIDED** — the **255 of 539 done cells** with no per-cell audit row render as **"Resolved — date unknown"**, showing the **directive-level date marked approximate**. It shows the row instead of hiding it and labels the date's provenance instead of passing a summary date off as a per-cell fact; **substituting that date without the marker would make 47% of the widget quietly wrong in one direction**, the G5a failure this file tracks. The widget moves to **#3, unblocked**. **Two of rev 8's seven open decisions are closed by this amendment.** Figures re-derived at write time per r43: CLAUDE.md **163,228**, §15 **69,331**, §13 **50,212**, §16 **12,812** — unchanged from rev 8, which is expected: 8.1 is docs-only and touches no CLAUDE.md section.
- **2026-08-22 (rev 8)** — **Q1 RE-LOCKED, the CLAUDE.md split shipped but MISSED ITS GOAL, restyle batch 4 dissolved, and Convert direct read supersedes 012 E2.** **Q1 is now operator load reduction · quantitative data for leadership · insight into the CRO department** — ⚠ **wording NOT final** (Lacey was mid-revision), and the **QMS 25/32 score target is VOID with no replacement; a rescore is owed.** Consequences applied anyway: G2 criterion validation → optional, **Recs 1 and 3 demoted to nice-to-have, Rec 2 demoted** — with the **open flag preserved intact**, because Rec 2 closes G1 and G1 is exactly the moving-denominator problem the new leadership-reporting Q1 depends on. **THE SPLIT MISSED ITS PRIMARY GOAL:** 163,228 chars against the **150,000 tool limit (13,228 over)** and the **120,000 r41 ceiling (43,228 over)**, so the file §0 tells every session to read completely still cannot be. **A second extraction pass is owed;** §15 (69,331) and §13 (50,212) are the loads, **§16 is index-only at 12,812 and r41's remedy #1 is therefore spent** — the rule was amended to say so rather than leave an exhausted prescription reading as actionable. Four new standing rules landed: **r40** (archive is history, never authority), **r41** (size ceiling, not calendar), **r42** (a §15 sentence names an action or names where its substance went), **r43** (re-derive every figure at write time, never transcribe). **Restyle batch 4 DISSOLVED** — it was two unrelated items sharing a name: **G7 tab-stops → #2**, **Change Log widget → #7**, which is blocked on Lacey deciding what the **255 of 539 done cells with no per-cell audit row** render as. **Convert direct read (#4) SUPERSEDES 012 E2 — E2 removed from BLOCKED**, and the enum decision becomes unilateral rather than a negotiation. **Data insights (#3)** added, scoped internally to Lacey and the CRO team so it stays small; **bulk cell edit** added to BACKLOG, Jenny-gated, evidenced by ~70 clicks of matrix paperwork for one MRR trigger ship. **Rev 7's "DECLARED v3.0 ≠ DEPLOYED" headline is RETIRED** — both halves were false, v3.0 is live, and the durable mechanism is that **`package.json` is a deploy TRIGGER and a build INPUT**, which is why this 17-commit chain deployed. **Prod is `ab70878`**, verified against the pushed tip. Every figure in this revision was re-derived at write time per r43; **the rev-8 draft's own numbers predated the final fold and were superseded**. KEPT from rev 7: the DONE list, the DEFECT RECORD, and the PARKED classifier section (the draft supplied no replacement, so it was retained rather than deleted).
- **2026-08-19 (rev 7)** — **Batch 012 directive CRUD recorded as shipped, pushed and DEPLOYED** (15 commits `887f55e` → `e518624` — the prod stamp as of 2026-08-18 — v2.9 → v3.0, migration 029 applied to **PRODUCTION** and verified by direct query — stated with its environment and method, because *deployed* and *migrated* are independent facts and `/api/health` reports the Worker only). **Five Karen rounds recorded with the finding progression rather than a total**, because the shape is the evidence: the build's HIGHs were round-one only, **every round-two HIGH was inside a FIX**, and rounds 3-5 found nothing above MEDIUM. **The CLAUDE.md size limit is now sequenced as batch #1, ahead of restyle batch 4** — QMS **G5** arriving as a HARD FAILURE, not a prediction: 631,560 chars against a 150k read limit, so the r34 reconcile was only completable by grep plus targeted replacement with uniqueness assertions. Three scope constraints recorded, all load-bearing: split §16 **by month** (one archive file fails the same limit on the same trajectory), the archive is **append-only history and never authority for current state** (wants a §13 rule, or it trades one G5 for one G1), and the batch must define **where new entries go**, not only where old ones move. **Growth DERIVED rather than estimated: ~6.1k chars/day since 2026-07-09 and ~6.8k/day over the last month — NOT the ~9k/day working figure — and the series is non-monotonic**, because r34 moves reclaim space, which is itself evidence the split works. **OPEN SEQUENCE renumbered:** rev 6 ran `1, ✅, 2, 4, 5` with no 3. **Six items struck from backlog**, and **two of them rev 6's own DONE list already contradicted** (logs-page filter bar, edit-modal dirty-state dismiss — both shipped at `cdb2cc6`), plus a third self-contradiction in the QMS block (*"confirm and strike"* on a rename shipped at `9088343`). An internal contradiction in one file is worse than a stale entry, because both halves read as authoritative. **Four items added:** the positive case unrun (**the guard has been observed REFUSING but never PERMITTING** — the batch's oldest open item) · `clearAllFilters` **correct by accident**, resetting `statusFilter` to `'all'` with nothing pinning it, so a "restore defaults" edit to `'open'` reinstates the silent-loss path in one line with every gate green · the `splitShownByLifecycle` caller **uncovered** · and same-shape duplication removed **three times in one batch**, recorded as a **rule CANDIDATE only** whose operative clause is *the comment is the tell* — all three carried a comment asserting parity and one was demonstrably false with every gate green, which makes it a falsifiability rule rather than a DRY preference. **Rec 1 downgraded from "nearly free":** the `audit_log` evidence half is **exhausted at n=4 (REPORTED BY LACEY, not derived, not re-probed)** and the remaining path is SharePoint screenshot metadata by hand — an unverified figure marked unverified is correct, whereas the same figure written as derived is the G5a failure. **The directive count is recorded as ONE STALE FIGURE PLUS ONE MISLABELLED COMPARISON, not a three-way disagreement:** "NBLYCRO active directives" = **87** (matrix header, correct) versus "directives holding cell work" = **88 of 89 rows** (the 409 runbook's figure — a *different quantity*, never in conflict once named); rev 6's 86/87 was stale 08-14 data, superseded before rev 6 shipped. **The label is the fix** — unlabelled, 88/89 reads as a contradiction again the next time someone opens the runbook. **`CROSS_CLAUDE.md` recorded as OWED and AC-facing:** its footer reads 2026-07-17 while its own §6 carries 08-07 and 08-08 entries, so it disagrees with itself and its footer is the line used as a state read; not written here, because an AC-facing mirror update is coordinated rather than unilateral.
- **2026-08-15 (rev 6)** — **All six rev-5 discrepancies SETTLED against CLAUDE.md §15/§16, with answers recorded rather than the questions deleted.** Settling #1 exposed an error in §16 itself: two batches were recorded making the same v2.7 → v2.8 bump, so classifier-1's entry was corrected to "shipped at v2.8, no bump" — a version line is exactly the kind of claim that reads as verified and is never re-derived. #4 answered as **86 per project / 87 global**, with the coincidence flagged as the trap: 87 is also NBLY's all-status count, and neither quantity is the per-project active figure the render-ceiling derivations need. #5 settled as **nothing to correct** — the "daily" claim was verbal, never written. #6 recorded in both this file and CLAUDE.md. Twelve batches added to DONE, closing the 07-29 → 08-09 gap. **The PARKED classifier section was superseded, not edited:** it shipped, the park reason changed from "no answer key" to "no credential / unresolved spend", and the free Rovo-by-hand alternative is recorded as the thing to try first. Defect record extended with **directive archiving reachable via direct SQL**, falsifying LOW-8's "verified unreachable" — plus the standing lesson that a "no writer exists" claim must state which surfaces were checked. Five items added to backlog.
- **2026-08-10 (rev 5)** — Sync field-guard batch recorded as shipped, deployed, and verified (`ae3e2f3` → `756c871`); guard observed holding against a live sync run. Sync-overwrite defect recorded with blast radius (27 field-values, 5 rows, all recovered) and with the four pre-ship catches. §13 r37 rule change recorded. Keep-both-and-flag scoped as a new Jenny-gated batch. QMS Recs 1–3 sequenced for the first time, with Rec 1 at #1 on the strength of the locked Q1 = provability-to-client. AI root-cause classifier parked with a stated unpark condition. Two render-only UI defects captured and paired. Six discrepancies against rev 4 flagged for settlement rather than silently resolved.
- **2026-07-29 (rev 4)** — Reconciled to CLAUDE.md §15/§16. Eight Pulse batches moved to DONE. Brand-page parity and restyle inserted ahead of Phase C. Cell-status vocabulary and the two-different-filters distinction recorded canonically.
- **2026-07-20 (rev 3)** — Phase A + B marked SHIPPED; rename to Pulse recorded; E-track added.
- **2026-07-15 (rev 2)** — Corrected DONE/OPEN split.
- **2026-07-15 (rev 1)** — Inserted Batch 012; resequenced 012 → 008 → 006; fork (A).
- 2026-07-09 — 005.2/005.3 shipped; ClickUp discovery-first behind 006.
