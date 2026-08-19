# CQIP Batch Priority Outline

**Updated:** 2026-08-19 (rev 7 — Batch 012 directive CRUD shipped + deployed; rev 6's backlog reconciled against its own DONE list; the CLAUDE.md size limit sequenced as a batch)
**Supersedes:** the 2026-08-15 rev-6 copy, which predates this entire batch. **Delete rev 6 from project knowledge — this file replaces it.**
**Canonical source:** CLAUDE.md §15/§16 wins; CROSS_CLAUDE.md §5 mirrors it; this file mirrors both.
**Current deployed state:** Worker `e518624` (verified via `/api/health` 2026-08-18) · **v3.0** · edge function `jira-sync` deployed 2026-08-09 23:22 UTC · **migrations 001–029, ALL APPLIED** — 029 (`idx_directives_project_title`, UNIQUE `(project_key, title)`, spanning archived rows) applied to **PRODUCTION** and verified by direct query in the prod Supabase SQL editor 2026-08-18.
**⚠ DECLARED v3.0 ≠ DEPLOYED `e518624`.** The version bump and the r34 reconcile were a docs-only commit, so the Worker SHA deliberately did not advance. A new version beside an unchanged SHA is correct here — see the `/api/health` warning below, which is the same confusion in a different direction.
**⚠ `/api/health` reports the WORKER ONLY** — it does not reflect Supabase edge-function deploys, so a matching SHA says nothing about `jira-sync`. This SHA has now misled twice; see settled discrepancy 6.
**This revision:** the sync skip-if-empty guard batch recorded as shipped + verified; the sync-overwrite defect recorded with its full blast radius; keep-both-and-flag scoped as a new Jenny-gated batch; QMS Recs 1–3 sequenced for the first time; AI root-cause classifier parked with a stated reason; two render-only UI defects captured.

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
   ergonomics** batch (08-14, prod `5795a89`). **Remaining: restyle batch 4 of 4,
   NOT STARTED** — its Gate 0 audit-coverage count is done and recorded in §15, and
   it carries the G7 tab-stop item, which must not be folded earlier.
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
                                                      15 commits 887f55e → e518624 · v2.9 → v3.0
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

## QMS RECOMMENDATIONS (from `REVIEW-cqip-qms-baseline-2026-08-02.md`)

Scored 17/32. **Q1 is locked: provability-to-client** — which makes Rec 1
mandatory rather than optional, and makes criterion validation a real obligation
rather than a nice-to-have. Recs 1–3 move the score to 24–25/32 with no new
headcount.

These were **not sequenced in rev 4**. They are sequenced here for the first time.

```
Rec 1   Bound the ticket-lag threat        closes G3 fully, G2 first instance
                                            ~30 tickets, one pass, no build, no gate
Rec 2   Version the requirement set        closes G1 + G4a. Small schema → Jenny.
                                            Sequence AHEAD of Phase E3.
Rec 3   Split 010.1 (target vs alerting)   closes G4. Forward-compat work already done.
```

**⚠ REC 1 STATUS (new in rev 7) — the `audit_log` evidence half is EXHAUSTED.**
**REPORTED BY LACEY, not derived here, and deliberately not re-probed:** the
`audit_log` route to bounding the ticket-lag threat is exhausted at **n=4** — too
few rows to carry a provability-to-client claim. **The remaining path is SharePoint
screenshot metadata, by hand.** Rev 6 does not record this, and it changes Rec 1
from "cheapest item on the board" to "cheapest *remaining* path is manual" — which
is still worth doing first under the locked Q1, but is no longer nearly free. The
figure is marked unverified on purpose: an unverified number labelled unverified is
correct, while the same number written as derived is the **G5a** failure this file
already tracks.

**Cheap, ride along on the next render batch:** ~~rename Quality Score → "Clean
delivery rate"~~ **✅ STRUCK — SHIPPED at `9088343`**, as rev 6's own DONE list
records; rev 6 nonetheless still said *"confirm and strike"*, which is the same
self-contradiction as the two backlog items above ·
answer Q6 (composite weights or separate the domains) · promote the claims-tense
rule (G5a) to a standing rule · specs cited by section number, never paraphrased.

**G6 (review independence) cannot be closed from inside the function.** It needs
one external human review. Do not bring another self-review as evidence against it.

---

## OPEN SEQUENCE

```
 1  CLAUDE.md SPLIT  §16 archive by month          ⚠ QMS FINDING G5, ARRIVING AS A HARD
                                                    FAILURE RATHER THAN A PREDICTION. The
                                                    file is 631,560 chars against a 150k
                                                    read limit, so it can no longer be read
                                                    whole by the tool that is instructed to
                                                    treat it as ground truth. The r34
                                                    reconcile was only completable by grep +
                                                    targeted replacement with uniqueness
                                                    assertions; a single truncating read
                                                    mid-commit would have been unrecoverable.
                                                    SCOPE CONSTRAINTS, all three load-bearing:
                                                    (a) split §16 BY MONTH — one archive file
                                                        fails the same limit on the same
                                                        trajectory;
                                                    (b) the archive is APPEND-ONLY HISTORY and
                                                        NEVER authority for current state —
                                                        wants a §13 rule, or it becomes a new
                                                        drift surface, which is trading one G5
                                                        for one G1;
                                                    (c) define WHERE NEW ENTRIES GO, not just
                                                        where old ones move. Growth is the
                                                        reason this is now urgent, so a batch
                                                        that only relocates history buys
                                                        months, not a fix.
                                                    Sequenced at #1 ahead of restyle batch 4:
                                                    every batch after this one pays the same
                                                    tax, and the tax is now a hard failure.
 2  QMS Rec 1        Ticket-lag sample analysis    No build, no schema, no gate. Cheapest
                                                    item with the highest review credibility
                                                    per hour. Q1 = provability makes it
                                                    mandatory. Do this first.
 ✅ UI defect batch  Logs page + edit modal        SHIPPED 2026-08-14 as Batch logs-page
                                                    (cdb2cc6, v2.9) + the portal fix
                                                    (9a65bb6 → 211e237). Shipped as ONE
                                                    batch as specified.
 3  012 ▸ PULSE      restyle batch 4 of 4          Discrepancy 3 settled: the parity +
                                                    restyle SERIES is otherwise complete.
                                                    Batch 4 NOT STARTED; Gate 0 done.
                                                    Carries G7 tab-stops — do not fold
                                                    that item earlier.
                                                    NOT an exhaustive Pulse claim: Phase C
                                                    and D are at #7/#8 below, E2 is BLOCKED
                                                    and E3 QUEUED.
 4  Keep-both-and-flag                             Jenny. Behind Rec 1 because it is larger
                                                    and Rec 1 is nearly free.
 5  QMS Rec 3        Split 010.1                   Unbundles the target half from alerting;
                                                    removes 006 from the critical path of
                                                    the most-cited measurement weakness.
 6  QMS Rec 2        Version the requirement set    Jenny. Sequence AHEAD of Phase E3.
 7  012 Phase C      Jira ticketing                GATED on Jira-create-permission verify.
 8  012 Phase D      Public bug form               after C. Jenny again (public surface).
 9  008              Convert.com automation        consumes 012 Phase B ingest
10  006              Teams dispatch (EXPANDED)     parked on alerts-channel build
11  010.1            Pipeline alerts remainder     behind 006 + Rec 3
12  007              Custom Jira Boards
13  ClickUp Archive  Phase 2 ETL + Phase 3 page    behind 006
```

**BLOCKED (not sequenced):** 012 Phase E2 (Convert config sync) — on Xandor confirming config-read scope + payload shape. Also open with Xandor: his 4 flag types (`srm`, `no_conversions_tracked`, `stalled`, `significance`) 400 against CQIP's `issue_type` CHECK constraint, and 2 of his 3 severity values (`warning`, `info`) don't match CQIP's `critical`/`medium`/`low`. Open decision: he maps onto CQIP's enums, or CQIP widens the constraints (migration + Jenny).

**QUEUED (not sequenced):** 012 Phase E3 (rich expandable directive rows). `CellEditStrip` is the designated seam. **Rec 2 should land first** — E3 adds lifecycle dates anyway, so effective-dating first means E3 builds on a versioned set instead of retrofitting one.

**PARKED (with a reason):** AI root-cause classifier — see below.

**HOLD (not sequenced):** Admin drawer change #4 (QA-URL-pattern editor removal) — AC gate RED, no Forge write path. Removing the editor strands the QA-URL config. Revisit only if a Forge write path lands.

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
- **012 E2:** blocked on Xandor — does not block anything else in 012.
- **ClickUp Phase 2 ETL:** Jenny-gated; behind 006.
- **Guard → keep-both-and-flag:** the guard is the floor; keep-both is the ceiling. Do not treat the guard as the finished design.

---

## BACKLOG

```
- ~~Logs page filter bar~~                 ✅ STRUCK — SHIPPED 2026-08-14 (cdb2cc6) +
                                           the portal fix (9a65bb6 → 211e237).
                                           ⚠ REV 6 CARRIED THIS IN BACKLOG WHILE ITS OWN
                                           DONE LIST RECORDED IT SHIPPED. An internal
                                           contradiction in one file is worse than a stale
                                           entry, because both halves look authoritative.
- ~~Edit-log modal dirty-state dismiss~~   ✅ STRUCK — SHIPPED 2026-08-14 (cdb2cc6),
                                           same batch as the filter bar, as rev 6's own
                                           DONE list records. Second half of the same
                                           contradiction.
                                           REJECTED alternative: 1-min autosave — partial
                                           writes to prod, audit-log noise in the exact
                                           trail the guard batch just started producing,
                                           and clears needs_review per §13 r29 on a
                                           half-filled row.
- Taxonomy drift audit                    "Client Request" sitting in issue_category;
                                           subtype values not in the 29-option doc. Confirm
                                           against live Jira options, then reconcile
                                           root-cause-taxonomy-mapping.md or the data.
- log_status system identity              Sync writes it under a bare identity, not
                                           system:*. Normalize, or every provenance query
                                           filtering system:% overcounts human writes.
- root_cause_initial capture gap           74/83 webhook logs empty. Jira-workflow decision:
                                           snapshot at a point where the QA tab still has
                                           content, or accept the field is dead for
                                           webhook-created logs.
- Guard-bypass denylist is not a proof     4 known-bad shapes covered. A 5th shape ships
                                           the bug with tests green. Consider a structural
                                           control (single write chokepoint) instead.
- badge.tsx AA contrast                    White text fails at all 3 severity levels, both
                                           themes (2.80 / 1.92 / 2.54 : 1). Pre-existing and
                                           APP-WIDE, not a Pulse problem. Needs a decision:
                                           darken the variant backgrounds, or move those
                                           variants off text-white.
- 6 orphan labels on /dashboard/reports    severity · status · issueCategory ·
                                           rootCauseFinal · testType · whoOwnsFix all render
                                           <Label htmlFor> above a <Select> whose
                                           SelectTrigger carries NO id, so each points at
                                           nothing. One word each to fix. clientBrand on both
                                           pages is already fixed. Pinned by a KNOWN_ORPHANS
                                           allowlist test that fails on a new orphan, on one
                                           of these six being fixed without updating the
                                           list, or on clientBrand regressing.
- Paused-brand marking in BrandSelector    3 paused brands (MRR-CA, SHG, WDG) list unmarked;
                                           2 of them have ZERO logs, so selecting either
                                           gives a bare "No logs found". Deferred as a DESIGN
                                           change: Coverage has showPaused and Pulse hides
                                           paused columns, so a third treatment should match
                                           one of them rather than invent a fourth.
- Double-audit row on an AI ruling         A ruling followed by "Save changes" writes TWO
                                           audit rows for one root_cause_final change, the
                                           second with a stale old_value, because
                                           applyEditedLog deliberately never refreshes
                                           editingLog. Pre-existing on the correct path since
                                           the strip shipped. Not data loss; not a `who`
                                           ambiguity (same changed_by). Four options costed
                                           in §15; keying the seeding effect on log.id is the
                                           most promising and is a design change.
- ~~Archived directives invisible to search~~ ✅ STRUCK — CLOSED by 012 directive CRUD
                                           2026-08-18. `loadProject` now loads ALL statuses
                                           and filters at render; archived rows are VIEWABLE
                                           behind a `Hide archived` toggle rather than merely
                                           counted, and the archived-search signal is gated on
                                           that toggle so its "…are not shown" wording cannot
                                           be false.
- G7 grid tab-stop burden                  ~1,300 tab stops for read-only users. Wants a
                                           roving tabindex over role="grid". Recorded
                                           against restyle batch 4 — do NOT fold earlier.
- ~~Duplicate-title check on POST /api/admin/directives~~  ✅ STRUCK — CLOSED 2026-08-18.
                                           Migration 029 UNIQUE (project_key, title) applied
                                           to PRODUCTION + a 409 from POST *and* PATCH. The
                                           POST half was missed by the build and caught by
                                           Karen round 1 — without it, 029 would have turned a
                                           retyped title into a raw Postgres constraint error.
- ~~LOW-8 archive-UI signal obligation~~   ✅ STRUCK — paid in full 2026-08-18 by the same
                                           batch. Standing lesson kept: a "no writer exists"
                                           claim must state WHICH SURFACES were checked — that
                                           audit read `app/api/` only, and direct SQL was
                                           outside its scope.
- MLY FLF dual-mapping                     Convert-side tracking, not a code fix.
- Unmapped-active goals → future CREATE batch
- Paused-brand reconciliation re-run
- Phase B follow-ons                       unresolved-brand self-heal · manual reassign ·
                                           toast cleanup · cell-backfill LOW-1
- Collapse-on-failure UX                   failed save discards the typed edit on BOTH
                                           surfaces. Fix together or neither. (Overlaps the
                                           modal dirty-state item — check before building.)
- Coverage "true all-time incl. pre-Jira"  parked: coverage surface, or archive-only?
- login_events read side                   count column + heatmap; all-admins-vs-owner-only
                                           still open
- ⚠ POSITIVE CASE UNRUN                    The movability guard has been observed REFUSING
                                           but NEVER PERMITTING. §8's "a freshly created
                                           directive is movable" was deliberately skipped: it
                                           writes a permanent directive to prod, and per §5.1
                                           archiving does not free the title. That half rests
                                           on unit tests, the fanOutCells-anchored one being
                                           the real evidence since it pins the predicate to
                                           its actual producer rather than to a fixture that
                                           agrees with it by construction. THE BATCH'S OLDEST
                                           OPEN ITEM — the two halves of the feature have
                                           asymmetric evidence.
- ⚠ clearAllFilters CORRECT BY ACCIDENT    It resets statusFilter to 'all', which strictly
                                           WIDENS and therefore cannot drop the row being
                                           edited — which is the only reason it is not a
                                           consumer of the filter guard. NOTHING PINS THAT. A
                                           "restore defaults" edit resetting it to 'open'
                                           reinstates the MEDIUM-1 silent-loss path in ONE
                                           LINE with every gate green. Wants a mutation test,
                                           or a comment at the reset site saying why the value
                                           is load-bearing.
- splitShownByLifecycle caller UNCOVERED   One call expression in page.tsx; one surviving
                                           mutation; all gates green. The extraction NARROWED
                                           the untested surface from three lines of logic to a
                                           single call — it did NOT make the caller covered.
                                           Do not record it as closing the caller.
- SAME-SHAPE DUPLICATION ×3 IN ONE BATCH   RULE CANDIDATE, not promoted. CELL_STATUS_LABEL
                                           (three private copies), the duplicate-title message
                                           (two literals under a comment asserting verbatim
                                           parity, WHOSE DRIFT MUTATION SURVIVED), and
                                           visibleForLifecycle (two character-identical
                                           filters, nothing pinning them). Operative clause:
                                           THE COMMENT IS THE TELL — all three carried a
                                           comment asserting parity and one was demonstrably
                                           FALSE with every gate green. That makes it a
                                           FALSIFIABILITY rule, not a DRY preference, which is
                                           the framing that would justify promoting it.
                                           Third instance ⇒ standing-rule candidate rather
                                           than a per-batch fix. §13 unchanged; propose only.
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

- **2026-08-19 (rev 7)** — **Batch 012 directive CRUD recorded as shipped, pushed and DEPLOYED** (15 commits `887f55e` → `e518624`, v2.9 → v3.0, migration 029 applied to **PRODUCTION** and verified by direct query — stated with its environment and method, because *deployed* and *migrated* are independent facts and `/api/health` reports the Worker only). **Five Karen rounds recorded with the finding progression rather than a total**, because the shape is the evidence: the build's HIGHs were round-one only, **every round-two HIGH was inside a FIX**, and rounds 3-5 found nothing above MEDIUM. **The CLAUDE.md size limit is now sequenced as batch #1, ahead of restyle batch 4** — QMS **G5** arriving as a HARD FAILURE, not a prediction: 631,560 chars against a 150k read limit, so the r34 reconcile was only completable by grep plus targeted replacement with uniqueness assertions. Three scope constraints recorded, all load-bearing: split §16 **by month** (one archive file fails the same limit on the same trajectory), the archive is **append-only history and never authority for current state** (wants a §13 rule, or it trades one G5 for one G1), and the batch must define **where new entries go**, not only where old ones move. **Growth DERIVED rather than estimated: ~6.1k chars/day since 2026-07-09 and ~6.8k/day over the last month — NOT the ~9k/day working figure — and the series is non-monotonic**, because r34 moves reclaim space, which is itself evidence the split works. **OPEN SEQUENCE renumbered:** rev 6 ran `1, ✅, 2, 4, 5` with no 3. **Six items struck from backlog**, and **two of them rev 6's own DONE list already contradicted** (logs-page filter bar, edit-modal dirty-state dismiss — both shipped at `cdb2cc6`), plus a third self-contradiction in the QMS block (*"confirm and strike"* on a rename shipped at `9088343`). An internal contradiction in one file is worse than a stale entry, because both halves read as authoritative. **Four items added:** the positive case unrun (**the guard has been observed REFUSING but never PERMITTING** — the batch's oldest open item) · `clearAllFilters` **correct by accident**, resetting `statusFilter` to `'all'` with nothing pinning it, so a "restore defaults" edit to `'open'` reinstates the silent-loss path in one line with every gate green · the `splitShownByLifecycle` caller **uncovered** · and same-shape duplication removed **three times in one batch**, recorded as a **rule CANDIDATE only** whose operative clause is *the comment is the tell* — all three carried a comment asserting parity and one was demonstrably false with every gate green, which makes it a falsifiability rule rather than a DRY preference. **Rec 1 downgraded from "nearly free":** the `audit_log` evidence half is **exhausted at n=4 (REPORTED BY LACEY, not derived, not re-probed)** and the remaining path is SharePoint screenshot metadata by hand — an unverified figure marked unverified is correct, whereas the same figure written as derived is the G5a failure. **The directive count is recorded as ONE STALE FIGURE PLUS ONE MISLABELLED COMPARISON, not a three-way disagreement:** "NBLYCRO active directives" = **87** (matrix header, correct) versus "directives holding cell work" = **88 of 89 rows** (the 409 runbook's figure — a *different quantity*, never in conflict once named); rev 6's 86/87 was stale 08-14 data, superseded before rev 6 shipped. **The label is the fix** — unlabelled, 88/89 reads as a contradiction again the next time someone opens the runbook. **`CROSS_CLAUDE.md` recorded as OWED and AC-facing:** its footer reads 2026-07-17 while its own §6 carries 08-07 and 08-08 entries, so it disagrees with itself and its footer is the line used as a state read; not written here, because an AC-facing mirror update is coordinated rather than unilateral.
- **2026-08-15 (rev 6)** — **All six rev-5 discrepancies SETTLED against CLAUDE.md §15/§16, with answers recorded rather than the questions deleted.** Settling #1 exposed an error in §16 itself: two batches were recorded making the same v2.7 → v2.8 bump, so classifier-1's entry was corrected to "shipped at v2.8, no bump" — a version line is exactly the kind of claim that reads as verified and is never re-derived. #4 answered as **86 per project / 87 global**, with the coincidence flagged as the trap: 87 is also NBLY's all-status count, and neither quantity is the per-project active figure the render-ceiling derivations need. #5 settled as **nothing to correct** — the "daily" claim was verbal, never written. #6 recorded in both this file and CLAUDE.md. Twelve batches added to DONE, closing the 07-29 → 08-09 gap. **The PARKED classifier section was superseded, not edited:** it shipped, the park reason changed from "no answer key" to "no credential / unresolved spend", and the free Rovo-by-hand alternative is recorded as the thing to try first. Defect record extended with **directive archiving reachable via direct SQL**, falsifying LOW-8's "verified unreachable" — plus the standing lesson that a "no writer exists" claim must state which surfaces were checked. Five items added to backlog.
- **2026-08-10 (rev 5)** — Sync field-guard batch recorded as shipped, deployed, and verified (`ae3e2f3` → `756c871`); guard observed holding against a live sync run. Sync-overwrite defect recorded with blast radius (27 field-values, 5 rows, all recovered) and with the four pre-ship catches. §13 r37 rule change recorded. Keep-both-and-flag scoped as a new Jenny-gated batch. QMS Recs 1–3 sequenced for the first time, with Rec 1 at #1 on the strength of the locked Q1 = provability-to-client. AI root-cause classifier parked with a stated unpark condition. Two render-only UI defects captured and paired. Six discrepancies against rev 4 flagged for settlement rather than silently resolved.
- **2026-07-29 (rev 4)** — Reconciled to CLAUDE.md §15/§16. Eight Pulse batches moved to DONE. Brand-page parity and restyle inserted ahead of Phase C. Cell-status vocabulary and the two-different-filters distinction recorded canonically.
- **2026-07-20 (rev 3)** — Phase A + B marked SHIPPED; rename to Pulse recorded; E-track added.
- **2026-07-15 (rev 2)** — Corrected DONE/OPEN split.
- **2026-07-15 (rev 1)** — Inserted Batch 012; resequenced 012 → 008 → 006; fork (A).
- 2026-07-09 — 005.2/005.3 shipped; ClickUp discovery-first behind 006.
