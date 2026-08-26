# CQIP Batch Priority Outline

**Updated:** 2026-08-25 (rev 8.7 — **#5 006 TEAMS DISPATCH RE-BLOCKED: its dispatch mechanism was RETIRED BY MICROSOFT 2026-05-22.** ⚠ The 08-22 un-blocking was recorded against the WRONG ARTIFACT. #6 and #7 re-block with it. Sequence head is now **#8 Convert direct read**)
**Previous:** rev 8.6 (2026-08-24 — #4 Data insights deferred, its premise does not hold on current data)
**Previous:** rev 8.5 (2026-08-24 — batch #3 change log widget shipped + deployed, prod `e58cf7b`, run #49; Karen's two CRITICALs were both verification claiming more than it had)
**Previous:** rev 8.4 (2026-08-24 — r41's ceiling amended to 150,000, §16-index trade rejected; the amendment bought no room)
**Previous:** rev 8.3 (2026-08-23 — **BATCH #2 G7 TAB-STOPS SHIPPED + DEPLOYED**; CI now runs the tests and gates the deploy; the directive count moved again and DOWN)
**Supersedes:** rev 8.3, 8.2, 8.1 (2026-08-22) and rev 7 (2026-08-19). **Delete rev 7, 8.1, 8.2 and the rev-8 DRAFT from project knowledge — this file replaces all of them.**
**Canonical source:** CLAUDE.md §15/§16 wins; CROSS_CLAUDE.md §5 mirrors it; this file mirrors both.
**Current deployed state:** Worker **`2ad78bb`** — verified via `/api/health` 2026-08-23 23:51 UTC, matching the pushed tip. Run **#48** is the G7 batch and it is **the first run in this repo's history to execute a test job**: `deploy` now carries `needs: test`, so a deployed SHA is itself proof the suite passed. **The G7 spec's own commit (`f8d5f28`) did NOT deploy, correctly** — one `.md` under `docs/`, so `paths-ignore` held; #48 fired on the second commit, which carried `package.json`. **⚠ THE PUSH WAS MIS-READ ONCE AND THAT IS WHY THIS LINE IS LONG:** the first push looked successful — clean `git push`, green Actions page — while the code commit had **silently never been made**. 47 runs plus a green page meant *docs-only skip*, not *shipped*. **The reflog caught it; the SHA could not.** As of #48, prod standing still has THREE possible causes — tests red, nothing fired, still building — and **`/api/health` cannot distinguish them.** The Actions log is no longer optional. · **v3.0** · edge function `jira-sync` deployed 2026-08-09 23:22 UTC · **migrations 001–029, ALL APPLIED** (029 verified by direct query in the prod Supabase SQL editor 2026-08-18); **G7 added no migration.**

**✅ ROUTE (b) IS WORKING. `CLAUDE.md` IS AT 147,918 — 2,082 UNDER THE CEILING, AND IT WENT DOWN ACROSS A SHIPPED BATCH.** Batch #3's ~23k of spec and post-mortem went to `docs/specs/`; §15 carries a five-line pointer and two standing lessons. Net effect on CLAUDE.md across the whole batch: **+50 chars.** Compare G7, which put **4,744** in and consumed 70% of the extraction pass's margin. **Do this for #4.** ⚠ **The discipline is not automatic — it failed twice inside these two days and both times the fix was to relocate:** the r41 amendment's first draft landed **271 chars** from the ceiling it was setting, and this batch's first §15 pointer was narrative that left only **620**. Write the pointer, then check the number.

**⚠ HISTORICAL, KEPT: `CLAUDE.md` WAS AT 148,205 — 1,795 UNDER THE CEILING. THIS IS THE BOARD'S TIGHTEST CONSTRAINT AND THE r41 AMENDMENT DID NOT LOOSEN IT.**

**DECIDED 2026-08-24 (Lacey): amend r41, do not take the §16 trade.** r41 now
records **150,000 as the WORKING ceiling** and retires 120,000 as unreachable —
everything outside §13/§15/§16 was **29,798** at `ab70878`, so extracting every
remaining section whole still left the file over it. Two passes ran against that
figure and both were recorded as misses. **A ceiling no permitted remedy can reach
is a standing failure report, not a bound**, and it was generating extraction
passes rather than limiting growth. 150,000 is the **tool read limit**, so
breaching it makes §0's "read this file completely" inexecutable — the actual
failure the rule exists to prevent. The §16 archive-index trade was **considered
and rejected**: it costs *find a batch by name without grepping six files* for
roughly its own size back.

> **⚠ READ THIS BEFORE SCOPING #3. THE AMENDMENT MADE THE RULE HONEST. IT DID NOT
> CREATE ROOM.** The file was 147,921 before the amendment and **148,205 after** —
> the edit that set the ceiling cost 284 chars net, and **its first draft came
> within 271 chars of tripping the ceiling it was setting.** That is not a joke at
> the rule's expense; it is the measurement. **Headroom is ~1,795 and G7's doc
> obligations were 4,744.** The Change Log widget is a LARGER batch than G7 — new
> `audit_log` read, `fetchAllPaged()` from the outset, a degraded path covering 47%
> of the data. **On current rates #3 trips the ceiling mid-batch.**
>
> **So the space problem is still open and is now the FIRST thing #3 has to
> answer**, with three honest routes: (a) a third extraction pass before #3
> starts; (b) #3's spec and post-mortem live entirely in `docs/specs/` with §15
> carrying only pointers — r42's discipline applied *pre*-emptively rather than as
> cleanup; (c) revisit the §16 trade after all. **(b) is the cheapest and is what
> G7 should have done** — G7 put 4,744 chars into CLAUDE.md when most of it was
> narrative that r42 would have relocated at the next pass anyway.

**Refill rate, stated as a number because it keeps being guessed:** the 08-23 pass
bought **6,823** chars; the next batch spent **4,744**. **A pass buys about one and
a half batches.**
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
   #2)** and the **Change Log widget (sequence #3)**. Gate 0 is still done and
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
✅ #3 Change log widget (reports panel)               SHIPPED + PUSHED + DEPLOYED 2026-08-24
                                                      2 commits 9c69454 → e58cf7b · run #49
                                                      NO migration · NO Jenny · no version bump
                                                      430 tests · typecheck script added
                                                      Karen: 2 CRITICAL + 4 HIGH + 11 MEDIUM,
                                                      ALL FIXED PRE-PUSH. BOTH CRITICALs WERE
                                                      VERIFICATION, NOT CODE — see spec §8.2.
✅ G7 tab-stops  skip-the-matrix link + focus harness  SHIPPED + PUSHED + DEPLOYED 2026-08-23
                                                      2 commits f8d5f28 → 2ad78bb · run #48
                                                      NO version bump (render/interaction only,
                                                      no new structural surface) · NO migration
                                                      NO Jenny · Karen post-flight
                                                      Karen: 4 HIGH + 6 MEDIUM, ALL FIXED PRE-PUSH.
                                                      TWO OF THE HIGHs WERE THE BATCH'S OWN CLAIMS,
                                                      not its code — G5a instances 4 and 5.
                                                      FIRST CI RUN EVER TO EXECUTE TESTS: 399/399,
                                                      and `deploy` now `needs: test`.
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
 ✅  SECOND EXTRACTION PASS    manual   —          SHIPPED 2026-08-23
 ✅  G7 TAB-STOPS              auto     —          SHIPPED + DEPLOYED 2026-08-23 (2ad78bb)
 ✅  CHANGE LOG WIDGET         auto     —          SHIPPED + DEPLOYED 2026-08-24 (e58cf7b)
 ⏸  DATA INSIGHTS             accept   —          DEFERRED 08-24 — premise fails on data
 ⛔  006 TEAMS DISPATCH        manual   BLOCKED    dispatch mechanism retired 05-22
 ⛔  010.1 REMAINDER           accept   #5         re-blocked with #5
 ⛔  CLICKUP PHASE 2/3         manual   #5 · Jenny re-blocked with #5
 8   CONVERT DIRECT READ       accept   —          ← HEAD OF THE OPEN SEQUENCE
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

**#1 — ✅ SHIPPED 2026-08-23. Target was 150,000, the tool limit; CLAUDE.md
went 163,228 → 143,177 chars (144,725 bytes), 6,823 under.** §15 went
**69,332 → 57,239**; §13 and §16 were not touched. Verified on disk after the
drop, not from the build log alone. Docs-only: eleven files, all `CLAUDE.md` or
under `docs/`.

**What it took, and this is the finding to carry forward: r42 clause 3 was NOT
ENOUGH ON ITS OWN.** Applied across the whole of §15 it landed the file at
**149,929 — 71 characters under the limit**, which is inside the noise of a
single edit and is not a margin. **r41 remedy 3** (relocating §4, §7, §11 and
§12 whole to `docs/`, headings and pointers kept so `§n` citations still
resolve) is what bought the headroom. **Do not scope a future pass on r42
alone.**

**16,714 chars of post-mortem narrative went to `docs/claude-archive/`
(history, r40 applies). 31,257 chars of live scope went to `docs/` and
`docs/specs/` (authority, r40 does NOT apply)** — the distinction is stated in
every stub, because archiving a live obligation is this batch's failure mode and
the split's own oracle caught it twice.

**Oracles that ran:** ten exact line-content boundary assertions before any cut ·
verbatim conservation on every relocated block (slices are programmatic, no prose
retyped) · 31 named obligation tokens re-checked present · every untouched line
over 60 chars verified still present · **62 of 64 §15 checkbox items survive
byte-identical**, the two exceptions deliberate (the resolver-bug item reflowed
onto one line; `[ ] Decide the second pass` closed by this pass). Unchecked boxes
file-wide went **65 → 94** — r42 turning narrative into actions, which is the
rule working.

---

## BATCH #2 — G7 TAB-STOPS · OUTCOME

**2 commits, `f8d5f28` → `2ad78bb`. Run #48. No Jenny, Karen post-flight, no
migration, no version bump.** Spec: `docs/specs/batch-g7-tab-stops.md` — cite it
by section number.

### What shipped

A **skip-the-matrix link** above the grid's scroll region and an
**end-of-matrix anchor** below the Card, both gated on **one shared const** in
`app/dashboard/pulse/page.tsx`. Focus-order logic extracted to
`lib/client-library/focus-order.ts` with **23 `node:test` cases**.
`role="grid"` + roving `tabindex` was **explicitly NOT decided** and stays open;
its gate holds: *decide it before adding another focusable surface to that page.*

**The CI test gate is the batch's second deliverable and arguably the larger
one.** Before run #48, 22 test files ran only when someone remembered — CI was
install → build → deploy → smoke with no test step at all. Now `npm test` exists
and `deploy` carries `needs: test`.

### Figures re-derived 2026-08-23 — and the grid SHRANK

| Quantity | Figure |
|---|---|
| NBLYCRO active directives | **84** (was 87 on 08-18) |
| NBLYCRO archived | **4** (was 1) |
| Visible brands, default | **13** of 16 active, 3 paused |
| **Cell tab stops, default view** | **1,092** |
| Brand-header tab stops | **13** |
| **Total matrix tab stops, default** | **1,105** |
| Paused shown | 1,344 + 16 = **1,360** |
| **Cells held by archived directives** | **64** (was 16) |

**G7's own `~1,300` is RETIRED** — a `× 16` paused-shown product from 07-31, never
comparable to a default-view figure.

**⚠ NAME THE QUANTITY OR THIS BREAKS AGAIN.** Three numbers get quoted as "the
number": default-view stops (`× 13`), paused-shown stops (`× 16`), and rendered
*cells* (`× 16 + 1`). Like for like, default view: **1,118 (08-14, 86 rows) →
1,092 (08-23, 84 rows)** — a 26-stop drop worth 2 rendered rows, and **not
monotonic**: 86 on 08-14, **87** on 08-18, 84 on 08-23.

### ⚠ NEW, UNRECORDED ANYWHERE BEFORE THIS: 64 archived-invisible cells

Archived directives went **1 → 4** between 08-18 and 08-23, taking the cells they
hold from **16 to 64**. `loadProject` loads `status='active'` only, so all 64 are
**invisible to matrix search and count 0 toward `hiddenByStatus`** — an
exists-but-archived title reads as "found nothing", which is precisely the
duplicate-creation hazard `countHiddenByStatus` was built to mitigate.

**Karen's LOW-8 consequence, quadrupled — and it grew with NO CODE CHANGE.**
Someone archived three directives; that was the whole cause. Nothing on this board
noticed. Out of scope for G7, filed rather than fixed.

### Karen post-flight: 4 HIGH + 6 MEDIUM, all fixed pre-push

**Two of the four HIGHs were defects in the batch's own claims, not its code** —
G5a instances 4 and 5, recorded in the QMS review the same day:

1. **A fabricated series.** `1,377` — the 08-14 rendered-*cell* count — spliced
   into a default-view series it did not belong to, with a "three directives
   archived" cause read off what is really a 2-row delta. **Inside the batch whose
   own comments cite r43 four times.**
2. **The new control failed WCAG AA.** `focus:bg-white` never receives
   globals.css's dark override — that rule matches the literal class, while the
   generated selector is `.focus\:bg-white:focus` — so the focused link was a
   white box on a `#1E2235` card in dark mode; and `--f92-orange` on white is
   **2.76:1**, the exact ratio globals.css names as the reason
   `--f92-focus-ring` exists. **An AA-failing control inside an accessibility
   batch.** Now tokens: 5.18:1 light / 5.80:1 dark.

The other two HIGHs: the CI half was unwritten while the spec read as delivered,
and **a test that could not fail** — a `shouldRenderSkipTarget()` helper plus a
32-state exhaustive assertion that it agreed with `shouldRenderSkipLink()`, both
reducing to the same expression while presenting as proof of the batch's headline
invariant. **Export and test deleted rather than kept as ceremony**, and the spec
now states plainly that the real guarantee is structural — one const, two JSX
sites — and unreachable from a unit test.

### The verification residue, stated because nothing re-checks it

**Acceptance items 1–3 passed by hand, both themes, 2026-08-23 (Lacey).** That is
a **HAND-RUN OBSERVATION, NOT COVERAGE** — the same distinction §15 draws for the
409 runbook's Scenario A. The harness models focus **order**; a link that never
appears passes all 23 tests. **Change the `sr-only` / `focus:` classes, the
`--f92-surface` / `--f92-focus-ring` tokens, or the anchor's position and no gate
in this repo will tell you it broke.** Re-run by hand.

### Ride-alongs landed

- **CLAUDE.md §15's unchecked *"the matrix renders `<button disabled>` to
  non-admins"* — STRUCK. It was FALSE and asserted the INVERSE of shipped
  source**; removing that `disabled` is what created G7. An unchecked box reads as
  outstanding work, and this one would have sent a reader to undo G7's own cause.
- **`docs/batch-012-pulse-restyle-3-spec.md` §2.6 AMENDED** with DC's 2026-08-03
  "neither `disabled` nor `aria-disabled`" decision. PROCESS tells readers to cite
  specs by section number, and §2.6 was issuing an instruction the codebase had
  already rejected — with a comment in the source calling that section wrong and
  no trace of it on the spec side.
- **That spec's §1 STRUCK too** — a second copy of the same falsified claim,
  sitting under a heading reading *"What is true today — verified against
  source."*
- The `"recorded against restyle batch 4"` pointer in `page.tsx` corrected to the
  board sequence number. The archive copy left alone; r40 makes it history.

---

## STRUCTURAL CHANGES TO THE BOARD (rev 8)

### DISSOLVED — "Pulse restyle batch 4 of 4"

Not restyle work, and not one batch. **Two unrelated items sharing a name**,
split because they share no dependency:

- **G7 tab-stops** → sequence **#2** — ✅ **SHIPPED + DEPLOYED 2026-08-23 (`2ad78bb`)**
- **Change Log widget** → sequence **#3**

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

### NEW — Convert direct read (sequence #8) · SUPERSEDES 012 E2

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

### ⏸ DEFERRED 2026-08-24 — Data insights. THE PREMISE DOES NOT HOLD ON CURRENT DATA.

**Decision: Lacey, 2026-08-24. Not dropped, not blocked — DEFERRED, and it gets
cheaper and better by waiting.** Probed before any spec was written; nothing was
built.

**The batch's whole premise is period-over-period distribution shifts. There are
not two comparable periods.** 100 live logs (131 total, 31 deleted), of which
**68** carry `issue_category`:

```
month     logs   classified          quarter    logs   classified
2025-11      5      5                2025-Q4      31      28
2025-12     26     23                2026-Q1       6       6
2026-01      6      6                2026-Q2      37      18
2026-02      —      —   no logs      2026-Q3      26       4   ←
2026-03      —      —   no logs
2026-04      5      4
2026-05     12      9
2026-06     20      5
2026-07     15      1   ←
2026-08     11      3   ←
```

**⚠ QUARTERLY AGGREGATION DOES NOT RESCUE IT — CHECKED, NOT ASSUMED.** The most
recent quarter is **n=4** against ten categories. The spec's own small-n
suppression rule would suppress every recent period, so the widget would render
counts and no percentages for exactly the months anyone wants to compare. **The
best month in the entire series is 2025-12 at 23**, and nothing else exceeds 9.

**⚠ AND THE VALUES ARE THIN EVEN IN AGGREGATE.** Ten `issue_category` values
across 68 classified logs: `CRO Implementation` 20 · `Process/ Communication` 10 ·
`Experiment Configuration` 8 · `Client Website Code` 8 · `Experiment Concept` 7 ·
`Client Request` 7 · `Client Data/Feed` 2 · `External Factor` 2 ·
`Third Party Tool` 1 · `Missing Information / Access` 1. Split by period, most
cells are 0–2.

### ⚠ THE CAUSE IS A QUEUE, NOT A DATA PROBLEM — AND THAT IS THE USEFUL FINDING

Classification coverage tracks `log_status` almost exactly:

| `log_status` | Logs | Classified | |
|---|---|---|---|
| Resolved | 63 | **54** | 86% |
| Pending Verification | 33 | **2** | 6% |
| Open | 3 | 0 | — |
| Blocked | 1 | 0 | — |

**Classification happens at RESOLUTION, and 37 of 100 live logs are unresolved —
every one of them since 2026-06-03.** So the recent months are not showing a
distribution shift; they are showing work that has not been classified yet.
**Any insight built today would read a queue as a trend**, which is precisely the
failure the batch's own "every insight names its denominator" rule exists to
prevent.

**UNPARKS ON A REACHABLE TRIGGER — deliberately not a volume threshold.** *The
Pending Verification backlog falls below 10.* That yields ~30 newly classified
logs and makes 2026-06/07/08 comparable for the first time. **A
"≥25 classified per month" style trigger was considered and REJECTED as
unreachable** — recent volume is 11–20 logs/month total, so it would need volume
to roughly double, and an unreachable trigger reads as actionable and is not,
which is exactly how r41's 120,000 ceiling failed.

**COUPLING — this is the AI classifier's case, restated in data.** The classifier
section already records that its real value is forward-looking and that the **free
Rovo-by-hand path has never been tried**. Hand-classifying ~35 logs would clear
the backlog AND supply #4's missing denominator in one pass. Same upstream cause
as the filed-not-fixed item that `root_cause_initial` is empty on 74/83
webhook-created logs because the Jira QA tab is cleared at sendback.

**THE BUILDABLE-TODAY ALTERNATIVE, offered and not taken:** an **all-time
distribution with no period comparison**, honest about n. Genuinely small and
real, but it is not what this batch was scoped for, and shipping it would consume
the name.

---

### NEW — Data insights (ORIGINAL SCOPE, retained — see the deferral above)

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
in rev 8.** It is **SUPERSEDED** by Convert direct read (#8), not blocked: the
Xandor dependency it was waiting on is exactly what #8 routes around, and the
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

### ⛔ RE-BLOCKED 2026-08-25 — 006 Teams dispatch. THE DISPATCH MECHANISM NO LONGER EXISTS.

**Decision: Lacey, 2026-08-25. Keep blocked; verify the replacement before moving
on it.** Nothing was built and no spec was written.

**Microsoft completed the retirement of Office 365 Connectors in Teams on
2026-05-22** (rollout 05-18 → 05-22; all connector webhooks had to migrate to
**Workflows** before 05-18). The `*.webhook.office.com` **Incoming Webhook this
batch is specced against cannot be created any more.** That is three months
before this entry, and the batch's expanded scope was locked 2026-07-03 —
**after** the mechanism had already gone.

**⚠ THE 08-22 UN-BLOCKING WAS RECORDED AGAINST THE WRONG ARTIFACT.** It read:
*"Lacey has a channel cleared for testing, so the block is gone."* **The block was
never the channel.** A Teams channel with no POST endpoint gives dispatch nothing
to send to. Confirmed 2026-08-25: the sandbox channel **exists** (`Webhook
Sandbox | CRO`), and what was supplied was a `teams.microsoft.com/l/channel/…`
**deep link — a client-open link, not an endpoint.**

> **THIS IS THE THIRD MIS-RECORDED GATE ON THIS BOARD, AND THE FIRST OF ITS
> KIND.** Batch 009's Azure block ran 23 days as fiction; 006's own alerts-channel
> block ran months as fiction; and now an **UN-blocking** was recorded as real
> against an artifact that had already stopped existing. **The standing rule was
> "re-verify a blocker carried past 7 days." The missing half is: RE-VERIFY AN
> UN-BLOCKING TOO, AND NAME THE ARTIFACT IT TURNS ON.** "The channel exists" and
> "we can POST to it" are different claims, and only the second one unblocks
> anything.

**LACEY'S READ (2026-08-25), recorded as a HYPOTHESIS, not a finding:** Workflows
is probably a viable path. **Unverified.** The research task below is what turns
it into a finding.

### ⚠ THREE LOCKED SPEC ITEMS ARE INVALIDATED, NOT MERELY DELAYED

1. **"Adaptive Card / message card formatting per rule type."** Workflows webhooks
   do not support interactive cards with MessageCard payloads, and an Adaptive
   Card posted through a Workflow behaves differently from one posted through a
   connector. **Re-decide, do not port.**
2. **"Detect 401/403 from Teams webhook (rotation grace handling)."** Wrong
   failure mode entirely. Workflows fail on **SAS signature expiry, a disabled
   flow, or Power Automate throttling (429)** — different codes, different
   remedies, different grace semantics.
3. **"Global rate cap with self-announcing overflow."** Power Automate imposes
   **its own throttling upstream**, which CQIP does not control and cannot count.
   So an alert can be suppressed by a limiter above ours — which is exactly the
   silent-swallow this item exists to prevent, relocated out of reach.

Smaller, but it changes the copy: Workflows webhooks **cannot customize bot icon
or name**, so posts appear as the flow owner rather than as "CQIP".

### THE RESEARCH TASK — do this before any 006 scoping

Concrete, in the sandbox channel, and it answers all three invalidations:

- [ ] Create a **Workflows** webhook on `Webhook Sandbox | CRO` ("Post to a
      channel when a webhook request is received"). Confirm the URL shape
      (`*.logic.azure.com` / `*.azure.com/workflows/…` with a SAS signature).
- [ ] `curl` a plain text payload. **Does it post at all?** This is the gate — if
      no, 006 is externally blocked on a Teams admin, not on design.
- [ ] `curl` an **Adaptive Card** payload. Does it render, and does it render
      *interactively*? Answers invalidation 1.
- [ ] Record the **failure codes**: expired signature, disabled flow, malformed
      body. Answers invalidation 2.
- [ ] Find the **Power Automate throttle limits** for the tenant's licence tier.
      Answers invalidation 3, and it bounds the rate-cap design.
- [ ] Decide whether posting as the flow owner is acceptable, or whether 006 needs
      a Graph/bot path instead.

**⚠ WHEN A URL IS OBTAINED IT IS A SECRET.** A Workflows webhook URL carries its
own SAS signature — anyone holding it can post to the channel. It goes in
`wrangler secret put` / Supabase env, **never in the repo, never in a doc, never
in a commit message.** Note that `/api/health` reports the **Worker only**, so it
will not verify an edge-function dispatch either way.

### ⚠ KNOCK-ON: TWO MORE ITEMS RE-BLOCK

Rev 8.1 recorded that un-blocking 006 also unblocked **010.1 remainder (#6)** and
**ClickUp Phase 2/3 (#7)**. That un-blocking was wrong, so **both go back to
blocked.** The board lost three items in one correction, and the honest read is
that it never had them.

**Historical, kept — the 08-22 entry this supersedes:**

**~~✅ NO LONGER BLOCKED — 006 Teams dispatch (DECIDED 2026-08-22).~~** The alerts
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
- ~~**012 E2:** blocked on Xandor — does not block anything else in 012.~~ **STRUCK in rev 8 — E2 is SUPERSEDED, not blocked.** Convert direct read (#8) routes around the Xandor dependency entirely. Struck rather than deleted so the coupling's disappearance is traceable.
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
- Second extraction pass      ✅ DONE 2026-08-23. 163,228 → 143,177. See the
                              BATCH #1 section for the outcome and its oracles.
- 64 ARCHIVED-INVISIBLE CELLS NEW, and it GREW WITHOUT A CODE CHANGE. Archived
                              directives went 1 -> 4 between 08-18 and 08-23,
                              taking the cells they hold from 16 to 64. All
                              invisible to matrix search, all counting 0 toward
                              hiddenByStatus, so an exists-but-archived title
                              reads as "found nothing" — the duplicate-creation
                              hazard countHiddenByStatus was built to mitigate.
                              Karen's LOW-8 consequence, QUADRUPLED, and nothing
                              on this board noticed it happen. Cheapest honest
                              fix is surfacing the count the way
                              countHiddenByStatus already does for filters.
- CI TEST GATE, FIRST RED RUN `deploy` now `needs: test` (run #48 onward). A red
                              suite blocks every deploy, which is the point — but
                              prod staying put now has THREE causes (tests red /
                              nothing fired / still building) and /api/health
                              cannot tell them apart. The Actions log is no longer
                              optional. This ambiguity is PERMANENT.
- NO GATE COVERS THE SKIP LINK Acceptance 1-3 are manual and nothing re-runs them.
                              Touch the sr-only/focus classes, the --f92-surface /
                              --f92-focus-ring tokens, or the anchor position and
                              it breaks SILENTLY. A DOM or e2e harness is the only
                              real fix; both were declined as wrong-sized for this
                              batch, correctly.
- r41's ceiling               ✅ DECIDED 2026-08-24: amended to 150,000 working,
                              120,000 retired as unreachable, §16 trade rejected.
                              ⚠ BUT THE SPACE PROBLEM IS NOT SOLVED. 148,205 now,
                              ~1,795 of headroom, and G7's doc obligations were
                              4,744. #3 is LARGER than G7. Route (b) — spec and
                              post-mortem in docs/specs/, §15 gets pointers only —
                              is the cheapest fix and is what G7 should have done.
                              Decide it as part of scoping #3, not after.
                              Everything outside §13/§15/§16 was 29,798 at
                              ab70878, so extracting every remaining section
                              whole still leaves the file over 120,000. Either
                              take the §16 archive-index trade (Lacey's call —
                              it costs "find a batch by name without grepping
                              six files" for roughly its own size) or amend r41
                              to record 150,000 as the working ceiling. An
                              unreachable hard rule reads as actionable and is
                              not, which is exactly how r41's own remedy #1
                              failed.
- The 34,000 §15 budget       MISSED THREE TIMES: 74,120 → 63,551 → 57,239.
                              Each pass cut real weight and none came close.
                              Three misses is evidence about the BUDGET, not
                              about the cutters: either it is wrong or §15 needs
                              a mechanism other than cutting. Do not re-attempt
                              it unamended a fourth time.
- CLAUDE-16-2026-08.md size   The second pass appended to it and it is now
                              ~163,400 — past r41's 150,000 ADVISORY ceiling for
                              archive files. Advisory, not hard (r40 means
                              nobody reads an archive whole), but it is the same
                              trajectory §16 was on. Filed as a §15 Ops checkbox
                              to split it BY SIZE, not by month.
- 007 prereq disagreement     THREE conflicting claims, none reconciled: §15 read
                              "post-006, hard prereq: 004.99 + SPL onboarding",
                              §0.1 put 007 behind 010.1, and this board's rev 8.1
                              lists #13 with NO dependency. The board is the
                              newer claim; the prereq is the older one. Filed as
                              an action in §15 rather than silently resolved.
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

- **2026-08-25 (rev 8.7)** — **#5 006 TEAMS DISPATCH RE-BLOCKED (Lacey): ITS DISPATCH MECHANISM WAS RETIRED BY MICROSOFT ON 2026-05-22.** Office 365 Connectors in Teams completed retirement 05-18 → 05-22, with all connector webhooks required to migrate to **Workflows** before 05-18 — so the `*.webhook.office.com` **Incoming Webhook this batch is specced against cannot be created any more.** That is three months before this entry, and **006's expanded scope was locked 2026-07-03, AFTER the mechanism had already gone.** **⚠ THE 08-22 UN-BLOCKING WAS RECORDED AGAINST THE WRONG ARTIFACT:** it read *"Lacey has a channel cleared for testing, so the block is gone"*, but **the block was never the channel.** Confirmed 08-25 — the sandbox channel exists (`Webhook Sandbox | CRO`) and what was supplied was a `teams.microsoft.com/l/channel/…` **deep link, a client-open link and not an endpoint.** **THIS IS THE THIRD MIS-RECORDED GATE AND THE FIRST OF ITS KIND:** Batch 009's Azure block ran 23 days as fiction, 006's own alerts-channel block ran months as fiction, and now an **UN-blocking** was recorded as real against an artifact that had already stopped existing. **NEW STANDING LESSON — the existing rule was "re-verify a blocker carried past 7 days"; the missing half is RE-VERIFY AN UN-BLOCKING TOO, AND NAME THE ARTIFACT IT TURNS ON.** *"The channel exists"* and *"we can POST to it"* are different claims and only the second unblocks anything. **THREE LOCKED SPEC ITEMS ARE INVALIDATED, NOT DELAYED:** (1) *Adaptive Card / message card formatting per rule type* — Workflows do not support interactive cards with MessageCard payloads and an Adaptive Card through a Workflow behaves differently; **re-decide, do not port**; (2) *Detect 401/403 with rotation grace* — **wrong failure mode**, Workflows fail on SAS signature expiry, a disabled flow, or Power Automate throttling (429); (3) *Global rate cap with self-announcing overflow* — **Power Automate throttles upstream**, outside CQIP's control and uncountable, so an alert can be suppressed by a limiter above ours, which is the silent-swallow this item exists to prevent, relocated out of reach. Also: Workflows **cannot customize bot icon or name**, so posts appear as the flow owner, not as "CQIP". **LACEY'S READ, RECORDED AS A HYPOTHESIS AND NOT A FINDING:** Workflows is probably viable. **A named research task now gates 006** — create a Workflows webhook in the sandbox, POST plain text (the real gate), POST an Adaptive Card, record the failure codes, find the tenant's throttle limits, and decide whether posting as the flow owner is acceptable. **⚠ A Workflows URL IS A SECRET** — it carries its own SAS signature, so it goes in `wrangler secret put` / Supabase env and **never** into the repo, a doc, or a commit message; and `/api/health` reports the **Worker only**, so it will not verify an edge-function dispatch either way. **⚠ KNOCK-ON — TWO MORE ITEMS RE-BLOCK:** rev 8.1 recorded that un-blocking 006 also unblocked **010.1 remainder (#6)** and **ClickUp Phase 2/3 (#7)**; that un-blocking was wrong, so **both return to blocked.** The board lost three items in one correction, and the honest read is that it never had them. **Sequence head moves to #8 Convert direct read** (accept-with-edits, no dependencies) — which carries its own unresolved prereq: **check for collision with 008 Convert automation before scoping either.**
- **2026-08-24 (rev 8.6)** — **#4 DATA INSIGHTS DEFERRED (Lacey). Its premise does not hold on current data, and this was found by probing BEFORE a spec was written — nothing was built.** The batch is period-over-period distribution shifts, and **there are not two comparable periods.** Of 100 live logs, 68 carry `issue_category`, but the recent months run **20→5, 15→1, 11→3**, and **quarterly aggregation does NOT rescue it — checked, not assumed: 2026-Q3 is n=4** against ten categories. The best month in the whole series is 2025-12 at 23 and nothing else exceeds 9; ten category values across 68 logs leave most per-period cells at 0–2. So the spec's own small-n suppression rule would suppress every period anyone wants to compare. **⚠ THE CAUSE IS A QUEUE, NOT A DATA PROBLEM, AND THAT IS THE USEFUL FINDING:** coverage tracks `log_status` almost exactly — **Resolved 54/63 classified (86%) vs Pending Verification 2/33 (6%)** — so classification happens at resolution, and **37 of 100 live logs are unresolved, every one since 2026-06-03.** The recent months are not a distribution shift; they are unclassified work. **An insight built today would read a QUEUE as a TREND** — exactly the failure the batch's own "every insight names its denominator and its date" rule exists to prevent. **UNPARKS ON A REACHABLE TRIGGER: the Pending Verification backlog falls below 10** (~30 newly classified logs, making 06/07/08 comparable). **A "≥25 classified per month" trigger was CONSIDERED AND REJECTED as unreachable** — recent volume is 11–20 logs/month total, so it needs volume to double, and an unreachable trigger reads as actionable and is not, which is how r41's 120,000 ceiling failed. **COUPLING: this is the AI classifier's case restated in data** — the free Rovo-by-hand path has never been tried, and hand-classifying ~35 logs would clear the backlog and supply #4's denominator in one pass; same upstream cause as `root_cause_initial` being empty on 74/83 webhook-created logs. **The buildable-today alternative — an all-time distribution with no period comparison — was offered and NOT taken**, because it is not what the batch was scoped for and shipping it would consume the name. **Sequence head moves to #5, 006 Teams dispatch** (accept-with-edits, no dependencies).
- **2026-08-24 (rev 8.5)** — **BATCH #3, THE CHANGE LOG WIDGET, SHIPPED + PUSHED + DEPLOYED. Prod `e58cf7b`, run #49.** A read-only panel on `/dashboard/reports` — **not** the matrix page, because G7's standing gate forbids adding a focusable surface there until `role="grid"` is decided, and `CellEditStrip` is E3's seam. Two commits, no migration, no Jenny, no version bump, **430 tests**, and a **`typecheck` script** added. **⚠ KAREN POST-FLIGHT: 2 CRITICAL + 4 HIGH + 11 MEDIUM, ALL FIXED PRE-PUSH — AND BOTH CRITICALs WERE VERIFICATION CLAIMING MORE THAN IT HAD, NOT CODING MISTAKES.** That is the second consecutive batch to produce G5a instances at post-flight, and the QMS review was amended for it. **C1: a FABRICATED 0% PRESENTED AS VERIFIED FACT.** `audit_log`'s only SELECT policy is `is_admin()` and there are three active read-only users; RLS filtered the `count:'exact'` query and the paged read **identically to zero with no error**, so the completeness check PASSED and the panel rendered *"0 of 639 finished cells (0.0%) have an exact resolve date"* with 639 rows reading "no audit trail" — every one of which has one. **Three things the batch was proud of had to line up:** the spec's §6 asserting the panel "shows nothing a Pulse viewer cannot already see" (false — `audit_log` is the one table they cannot see); §4's instruction to make the degraded state *look deliberate rather than like a failure*, which is what hid it; and **a test — "zero rows verified against zero is a valid complete read" — that encoded the bug as intended behaviour.** **NEW STANDING LESSON: "read-only" is NOT "readable by everyone" — ask the permission question per TABLE, not per route**, and a completeness check comparing two numbers from the same filtered source cannot detect that the filter is the problem. **C2: `npm test` IS NOT THE GATE.** Five strict-null errors in the new test file; `tests/` IS typechecked by `next build`, but `npm test` runs under `tsx` **which strips types**, so CI would have gone **green on the test job and red on deploy** — the gate added in the G7 batch does not cover the gate that blocks a push. `typecheck` script added; **CI wiring still OWED** (one line, `.github/**` is in `paths-ignore` so it does not deploy). Deliberately NOT folded into `npm test`: a full-repo `tsc` could not be verified from the authoring environment, and a red `npm test` behind `needs: test` blocks every deploy. **H1 — NEW STANDING LESSON, the most transferable finding: A GUARD ON PRESENTATION IS NOT A GUARD ON CLASSIFICATION.** §4's structural guard made an approximate date unrenderable as exact, and a later **note** edit still became the exact resolve date because it was mislabelled upstream of the guard — real row `ea9cd7c5`, resolved **2026-07-25 by a script**, rendered **"Jul 29, 2026", exact, no qualifier, By: "Manual"**. Wrong date, wrong actor, no marker, inside the module whose own header called that unreachable. **H2** — the UI stated a false cause as fact ("cells resolved before per-cell history existed"); per-cell history began 07-17 and all 252 degraded cells sit in a **0.4-second window on 07-22** — a bulk load that wrote no audit rows, and there is **no trigger** on `directive_brand_status`. **H4 — THE G7 HIGH, REPEATED IN FORM, TEN LINES AFTER THE SPEC WARNED AGAINST IT:** §1.2 said "27 in the last 3 days" when **08-21 alone is 27**, understating the rate ~3×. **A specific, present warning did not prevent it.** **H5** — 252 used for two unrelated quantities in adjacent sections. **SILENT-FAILURE FIXES WORTH KEEPING:** an over-read killed the whole panel on one ordinary mid-load save, with a message describing a *short* read; `count` is **NaN, not null**, when the content-range header is absent, so the fail-closed branch was **dead against the real client** and users saw "the exact count is NaN"; a `head:true` error carries an **empty message**, rendering "count failed — "; the 60vh scroll region had **zero focusables and no tab stop**, leaving hundreds of rows keyboard-unreachable; and the sticky `<th>` lacked the inset-box-shadow header rule the matrix page documents. **NOT COVERED, STATED RATHER THAN IMPLIED:** `readAllVerified` is untested and cannot be unit-tested without a live PostgREST — **C1, the NaN bug and the over-read bug all lived in that one function**, while `actorLabel()`, dead in production, sat in `lib/` with tests around it. **The extraction rule was applied backwards; it caught the trivial half.** Also filed not fixed: `--f92-navy` on a card fails AA in dark at **2.59:1** (pre-existing, three prior instances on the page). **RIDE-ALONG: §0's `Prod right now` stanza was TWO BATCHES STALE at `ab70878`** while G7 and this batch had both shipped — the same stanza, the same defect the 08-23 pass caught. It is the file's self-declared only current-state claim. **FIGURES RE-DERIVED TWICE IN ONE DAY** and both re-derivations are recorded rather than overwritten, because the rate of staleness is itself the finding: `audit_log` 1,690 → **1,743**, done cells 620 → **639**, per-cell coverage → **387 (60.6%)**, degraded path **252 (39.4%)**, and the **`directive`-target count (278) was missing from the first draft entirely** despite being the whole basis of the degraded path.
- **2026-08-24 (rev 8.4)** — **r41's CEILING DECIDED (Lacey): amend to 150,000 as the WORKING ceiling; the §16 archive-index trade was considered and REJECTED.** 120,000 is **retired as unreachable, not softened** — everything outside §13/§15/§16 totalled **29,798** at `ab70878`, so extracting every remaining section whole still left the file over it, and two passes ran against that figure with both recorded as misses. **A ceiling no permitted remedy can reach is a standing failure report rather than a bound**, and its practical effect was to generate extraction passes instead of limiting growth. 150,000 is the **tool read limit**, so breaching it makes §0's own "read this file completely" inexecutable — the failure the rule actually exists to prevent. **⚠ AND THE AMENDMENT BOUGHT NO ROOM, WHICH CORRECTS WHAT WAS IMPLIED WHEN THE OPTION WAS OFFERED:** 147,921 → **148,205**, so headroom is **~1,795** against G7's **4,744** of doc obligations. **The first draft of the amendment came within 271 chars of tripping the ceiling it was setting** — recorded because it is the cleanest available measurement of the refill problem, and because the fix was to relocate its own rationale here, which is r42 applied to the amendment itself. **THE SPACE PROBLEM IS THEREFORE STILL OPEN AND IS NOW #3's FIRST QUESTION,** with three routes: a third extraction pass before #3 starts; **#3's spec and post-mortem living entirely in `docs/specs/` with §15 carrying pointers only** (r42 applied pre-emptively rather than as cleanup — cheapest, and what G7 should have done, since most of G7's 4,744 was narrative a later pass would relocate anyway); or revisiting the §16 trade. **Refill rate, as a number because it keeps being guessed: the 08-23 pass bought 6,823 chars and the next batch spent 4,744 — a pass buys about one and a half batches.** Also recorded: the rev-8 DRAFT should be **deleted from project knowledge** — four revisions stale and internally wrong (it places the Change Log widget at #7 where every current doc says #3).
- **2026-08-23 (rev 8.3)** — **BATCH #2, G7 TAB-STOPS, SHIPPED + PUSHED + DEPLOYED. Prod `2ad78bb`, run #48.** Two commits (`f8d5f28` spec, `2ad78bb` code); no migration, no Jenny, no version bump. A **skip-the-matrix link** plus an **end-of-matrix anchor**, gated on **one shared const**; focus-order logic extracted to `lib/client-library/focus-order.ts` with 23 `node:test` cases. **`role="grid"` + roving tabindex was explicitly NOT decided** and its gate stands: *decide it before adding another focusable surface to that page.* **THE SECOND DELIVERABLE IS ARGUABLY THE LARGER ONE — CI NOW RUNS THE TESTS.** Before run #48, 22 test files ran only when someone remembered; `deploy` now carries `needs: test`, so a deployed SHA is itself proof the suite passed. **399/399.** **FIGURES RE-DERIVED, AND THE GRID SHRANK:** active directives **87 → 84**, archived **1 → 4**, giving **1,092 cell stops + 13 brand-header stops = 1,105** in the default view (1,360 paused-shown). **G7's own `~1,300` is RETIRED** — it was a `× 16` product from 07-31 and never comparable to a default-view figure. **NAME THE QUANTITY OR THIS BREAKS AGAIN:** default-view stops (`× 13`), paused-shown stops (`× 16`) and rendered *cells* (`× 16 + 1`) are three different numbers; like for like the series is **1,118 (08-14) → 1,092 (08-23)**, a 2-row delta, **non-monotonic** (87 on 08-18). **⚠ NEW AND PREVIOUSLY UNRECORDED: 64 cells are held by archived directives, up from 16** — invisible to matrix search, counting 0 toward `hiddenByStatus`. Karen's LOW-8 consequence quadrupled, and **it grew with no code change at all**; nothing on this board noticed. Filed, not fixed. **KAREN POST-FLIGHT: 4 HIGH + 6 MEDIUM, ALL FIXED PRE-PUSH — AND TWO OF THE HIGHs WERE THE BATCH'S OWN CLAIMS, NOT ITS CODE.** (1) A **fabricated series**: `1,377`, the 08-14 rendered-*cell* count, spliced into a default-view series, with a 3-directive cause read off a 2-row delta — **inside the batch whose own comments cite r43 four times.** (2) **The new control failed WCAG AA**: `focus:bg-white` never receives globals.css's dark override (that rule matches the literal class; the generated selector is `.focus\:bg-white:focus`), so the focused link was a white box on a `#1E2235` card, and `--f92-orange` on white is **2.76:1** — the exact ratio globals.css names as the reason `--f92-focus-ring` exists. **An AA-failing control inside an accessibility batch.** Both are G5a instances 4 and 5; see the QMS review, amended the same day. The remaining two HIGHs: the CI half was unwritten while the spec read as delivered, and a **test that could not fail** — a `shouldRenderSkipTarget()` helper plus a 32-state exhaustive assertion that it matched `shouldRenderSkipLink()`, both the same expression, presenting as proof of the batch's headline invariant. **Deleted rather than kept as ceremony**, and the spec now states that the real guarantee is structural (one const, two JSX sites) and unreachable from a unit test. **THE PUSH WAS MIS-READ ONCE, AND THAT IS THE PROCESS ENTRY WORTH KEEPING:** the first push looked successful — clean `git push`, green Actions page — while the code commit had **silently never been made**, so 47 runs and a green page meant "docs-only skip", not "shipped". **The reflog caught it; the SHA could not.** As of run #48 `/api/health` can no longer distinguish *tests red* from *nothing fired* from *still building* — **the Actions log is not optional any more.** **RIDE-ALONGS:** CLAUDE.md §15's unchecked *"the matrix renders `<button disabled>` to non-admins"* **STRUCK — it was FALSE and asserted the INVERSE of shipped source**, and removing that `disabled` is what created G7; `batch-012-pulse-restyle-3-spec.md` §2.6 **amended** with DC's 2026-08-03 "neither `disabled` nor `aria-disabled`" decision, because PROCESS tells readers to cite specs by section number and §2.6 was issuing an instruction the codebase had rejected; **that spec's §1 struck too**, a second copy of the same falsified claim sitting under *"What is true today — verified against source"*; and the `"recorded against restyle batch 4"` pointer in `page.tsx` corrected to the board sequence number. **⚠ THE VERIFICATION RESIDUE, STATED BECAUSE NOTHING RE-CHECKS IT:** acceptance items 1–3 passed **by hand, both themes, by Lacey** — a **HAND-RUN OBSERVATION, NOT COVERAGE**, the same distinction §15 draws for the 409 runbook's Scenario A. The harness models focus **order**; a link that never appears passes all 23 tests. **⚠ `CLAUDE.md` IS AT 147,921 — 2,079 UNDER THE TOOL LIMIT.** The second pass left 6,823 of headroom this morning and **G7 spent 4,744 of it**, which is the honest measure of that pass's durability: one ordinary batch consumed 70% of the margin. **r41's ceiling decision is now the nearest thing on this board to a hard blocker.** **`CROSS_CLAUDE.md` STILL OWED and now THREE batches behind** — footer 2026-07-17, §6 entries through 08-08, §5 last locked 07-15, and **its §5 board contains no G7 at all**, so a session told by R17 to read it at start sees a board this item never existed on. Per CC7, coordinated and not unilateral.
- **2026-08-23 (rev 8.2)** — **BATCH #1, THE SECOND EXTRACTION PASS, SHIPPED. CLAUDE.md 163,228 → 143,177 chars, 6,823 under the 150,000 tool limit;** §15 **69,332 → 57,239**, §13 and §16 untouched. Sizes verified on disk after the drop rather than from the build log alone, and the exact total is deliberately NOT written into CLAUDE.md itself per r43 — that file points at the `[claude-md]` prebuild line instead, because the paragraph would be part of what it measures. **THE FINDING WORTH CARRYING: r42 clause 3 alone was not enough.** Applied across the whole of §15 it landed at **149,929 — 71 characters under the limit**, inside the noise of a single edit; **r41 remedy 3** (§4, §7, §11, §12 relocated whole to `docs/`, headings and pointers retained so `§n` citations still resolve) is what bought the margin. **Do not scope a future pass on r42 alone.** Post-mortem narrative (16,714 chars) went to `docs/claude-archive/` where r40 applies; live scope (31,257 chars) went to `docs/` and `docs/specs/` where it does NOT, and every stub says which — archiving a live obligation is this batch's failure mode and the split's own oracle caught it twice. **Oracles:** ten boundary assertions before any cut, verbatim conservation on every relocated block, 31 obligation tokens re-checked, every untouched line over 60 chars verified present, and **62 of 64 §15 checkbox items surviving byte-identical** (the two exceptions deliberate). Boxes went 65 → 94, which is r42 turning narrative into actions. **RIDE-ALONGS, all three flagged before they shipped:** §0's `Prod right now` stanza still read **`d5e5703`** dated 08-20 — **two days stale, and it is the file's self-declared ONLY current-state claim**, so the one line the file tells every reader to trust was the wrong one; §0.1 still carried the rev-6-era five-item need-ordered list **while calling itself CANONICAL**; and the title line still read **v2.8** against a repo declaring v3.0. **THIS REVISION ALSO FIXES A CONTRADICTION IN REV 8.1 ITSELF:** the OPEN SEQUENCE table said Change Log widget **#3**, Data insights **#4**, Convert direct read **#8**, while four prose passages still said **#7**, **#3** and **#4** from rev 8's need-ordering — the table was renumbered and the prose was not. An internal contradiction in one file is worse than a stale entry because both halves read as authoritative, which this file already says about rev 6. **Four new open items recorded, three of them decisions rather than tasks:** r41's 120,000 ceiling (take the §16 index trade or amend the rule), the 34,000 §15 budget now **missed three times** (74,120 → 63,551 → 57,239 — evidence about the budget, not the cutters), the August archive file past its advisory ceiling, and 007's **three-way** prereq disagreement. **`CROSS_CLAUDE.md` is STILL OWED and is now further behind** — footer 2026-07-17, §6 entries through 08-08, §5 order last locked 07-15, and it has now missed two consecutive batches. Recorded in CLAUDE.md §0.1 as owed; per CC7 an AC-facing mirror update is coordinated, not unilateral. **CI VERIFIED for this push:** the Actions log shows no run for HEAD `00084ef` — the newest is #47 (`ab70878`, 08-22 22:59 CDT) — so prod is unchanged at `ab70878` and the deployed-state line above needed no correction. **The two preceding docs-titled commits both deployed** (#46 `d5e5703` 08-19, #47 `ab70878` 08-22), each carrying a non-`.md` file, which is the empirical version of the rev-7 lesson: the commit message predicts nothing, the file list does.
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
