# HANDOFF — Convert reconciliation backfill (Pulse / Batch 012)

**For:** Lacey (review) → Claudette (build loader) → Karen → Lacey approve + run
**Source:** `scripts/data/convert-reconciliation-backfill.csv` (**212 rows** as
corrected 2026-07-25; originally 215 — see addenda 6 + 7) from the
Convert goal reconciliation pass, 2026-07-25 (all 13 active NBLY brands, manually
cross-referenced against real Convert exports — not fuzzy-matched).
**Status:** Loader BUILT (`scripts/backfill-convert-reconciliation.ts`, 2026-07-25),
dry-run verified against prod, Jenny gate-confirmed, Karen-reviewed. Backfill
deliberately NOT run yet — Lacey approves + runs.

> **Addenda applied 2026-07-25 at build time.** The sections below are the
> as-written spec; these seven points supersede them where they conflict:
>
> 1. **Input filename** is `scripts/data/convert-reconciliation-backfill.csv`
>    (§2 named it `proposed_backfill.csv`). The reference-only siblings live in
>    `docs/convert-reconciliation-2026-07-25/` — `rename-cleanup.csv`,
>    `unmapped-active.csv`, `paused-brands-readiness.csv`, all reference-only
>    (committed in `83b876f`). None of the three is read by the loader.
> 2. **Write path is the DIRECT service-role write, not the PATCH route** (§1
>    left this open). The route requires a cookie-bound admin session and derives
>    `changed_by` via `getChangedBy()`, so a script cannot use it without
>    attributing every row to a human email instead of the §13 r20 system string.
> 3. **`old_value` is read from the live DB, not from the CSV's `our_status`**
>    (§2 said `our_status`). The inline cell editor has been live since
>    2026-07-21, so a cell can have moved since the 07-25 pass; recording the
>    CSV's claim would put a fiction in the audit trail. `old_value`/`new_value`
>    are the canonical `done`/`todo` values, not the CSV's `Done`/`To do`
>    labels, so these rows match UI-written rows for the same `field_name`.
>    `target_id` is the `directive_brand_status.id` (the CELL id), matching
>    `app/api/admin/directives/status/route.ts`.
> 4. **The downgrade audit note branches on data presence, not flip direction**
>    (§2 assigned the placeholder note to all downgrades). **One** downgrade
>    references a REAL but ARCHIVED Convert goal — MRA `Submits Form Lead -
>    Combined` (id 1004101324) — so writing "no real Convert goal" over it
>    would discard the archived id from the only forensic trail we keep. Both of
>    §2's note formats are still produced verbatim; the branch picks the truthful
>    one per row. (This addendum originally cited a second such row, MDG
>    `Step 1 | Contact Info | Validation Error Exposure` id 1004117395 — that row
>    was a resolver bug and has since been REMOVED entirely; see addendum 7. The
>    branch is still required for the MRA row, so nothing about the logic changes.)
> 5. **§5's verification arithmetic** ("215 cells updated" AND "`audit_log` == 215")
>    contradicts §2's own idempotency guarantee. The correct invariant is
>    `changed + already_at_target == <CSV row count>`, and `audit_log` rows ==
>    `changed`. Against prod on 2026-07-25, after both corrections, that is
>    **206 changed + 6 already correct = 212** (the 6 are `[Rev] Time Spent on
>    Site (15s)` ×5 and `[Rev] Time Spent on Financing (15s)` ×1, already `Done`
>    in prod). Do NOT read 206 as a shortfall against 212.
> 6. **Two MLY rows REMOVED — CSV regenerated to 213 rows / 205 upgrades / 8
>    downgrades** (was 215 / 207 / 8; commit `ec0438c`). Both removed rows were
>    upgrades: `MLY — FLF: Views Step #1 | Contact Info` and
>    `MLY — FLF: Views Step #2 | Service Details`. They mapped to the **same**
>    Convert goal, id `100480830` (`FLF: Step #1 Reached - Contact Info & Service
>    Details`), because **MLY genuinely tracks Contact Info + Service Details as
>    one combined event.** Neither directive can be flipped independently without
>    asserting something the underlying data does not measure — flipping both to
>    Done on one shared goal would claim per-step coverage MLY does not have.
>    **OPEN ITEM: MLY needs a second, separate Convert goal built before per-step
>    tracking is possible.** Until then these two cells stay as they are and are
>    deliberately out of this backfill's scope. Downgrades are unchanged at 8 —
>    MLY never appeared in the §3 downgrade list or in the loader's
>    `DOWNGRADE_REASONS` (verified explicitly, not assumed). MLY still
>    participates otherwise: 27 MLY rows remain. Verified after regeneration: no
>    remaining row cites goal `100480830`, and **no brand has two directives
>    sharing one `convert_id`** — MLY was the only shared-goal collision in the
>    pass. The loader's `EXPECTED_TOTAL` / `EXPECTED_UPGRADES` /
>    `EXPECTED_DOWNGRADES` were updated in the same change, per the shape-check's
>    own instruction to move CSV, spec, and constants together.
> 7. **MDG `Step 1 | Contact Info | Validation Error Exposure` REMOVED — a
>    RESOLVER BUG, not a judgement call. CSV now 212 rows / 205 upgrades / 7
>    downgrades** (was 213 / 205 / 8). **This supersedes §3's MDG
>    validation-error entry entirely — that row is gone, not re-reasoned.**
>
>    Root cause: MDG's Convert export contains **two goals with the
>    byte-identical name** `Step 1 | Contact Info | Validation Error Exposure` —
>    one **ACTIVE** (id `1004115396`) and one **ARCHIVED** (id `1004117395`). The
>    reconciliation tool's exact-match resolver keyed a plain dict by goal name,
>    so on a name collision the later array entry silently overwrote the earlier.
>    The archived duplicate won, and the pass concluded "archived → flip to
>    To do". **MDG's directive is genuinely Done via the real active goal;** the
>    archived twin is noise Convert never cleaned up.
>
>    So this is a **corrected non-entry**, categorically unlike the 7 intentional
>    downgrades: the cell needs NO change. It is absent from the CSV entirely —
>    neither an upgrade nor a downgrade — and its `DOWNGRADE_REASONS` key was
>    deleted in the same change rather than left to drift (a stale key would fire
>    the loader's `staleReasons` notice on every run, training the operator to
>    ignore the very signal that catches a genuinely-dropped downgrade).
>
>    Note the arithmetic: a DOWNGRADE was removed, so **upgrades stay 205** and
>    only the total and downgrade counts move (205 + 7 = 212).
>
>    A repo-wide scan for the same duplicate-goal-name collision found exactly
>    **one** other case — MOJ `Submits SF Lead - Footer [Contact API]` ×2 — but
>    **both copies are active**, so either resolution yields the same answer. No
>    data impact; deliberately untouched. Verified in the CSV: no
>    `brand + convert_name` pair maps to more than one `convert_id`.
>
> **Karen post-flight (2026-07-25) folded into the loader.** One HIGH: an
> `audit_log` insert failure printed a warning and then **exited 0**, so a run
> that flipped 209 cells and wrote zero audit rows looked green — it now exits
> non-zero, and post-verify asserts the audit row count for this run's cells
> rather than printing a cumulative total. Three MEDIUMs: a paused/inactive
> brand referenced by a regenerated CSV would have been written despite §4
> (now hard-fails); duplicate directive titles are possible (no unique
> constraint in migration 024, no duplicate check in
> `POST /api/admin/directives`) and a title→id map would silently flip the
> wrong cell while still passing post-verify (now hard-fails). Plus: the two
> legal transitions are asserted explicitly (counts alone don't pin direction),
> archived directives are refused (an invisible write), and a partial-update
> failure now prints the flipped cell ids with revert SQL. The two
> silent-failure helpers (`classifyRow`, `auditNote`) are exported and covered
> by `tests/convert-reconciliation.test.ts`.
>
> Karen also flagged one **mapping** judgment for Lacey — not a script defect:
> `MLY / FLF: Views Step #1 | Contact Info` and
> `MLY / FLF: Views Step #2 | Service Details` both map to Convert id
> `100480830`, one goal named `FLF: Step #1 Reached - Contact Info & Service
> Details`. It's the only place two directives are marked Done off a single
> goal. Plausible if Convert merged steps 1+2, but "Step #2" would then be Done
> on evidence measuring 1+2 combined. Worth a look before running.

---

## 0. One-line

Update existing `directive_brand_status` cells for 13 active brands where Convert's
real state disagrees with what's currently loaded — **205** upgrades (To do → Done,
confirmed live in Convert; was 207 before the addendum-6 MLY removal) and **7**
downgrades (Done → To do, false positives: dead
placeholder goals, an archived goal, and one pending design decision — three
categories covering seven rows, which is what this sentence always described).
*(Read `8` until 2026-08-22: addendum 7 removed the MDG resolver-bug row and this
opening summary was not updated, so §0 contradicted §3's explicit "7 downgrades,
not the 8 listed below" thirty-nine lines further down. Karen delta review
HIGH-2.)* **Status
flips only — no new directives, no new brands, no schema.** Lighter than the
original 65-directive bulk load: this is a targeted UPDATE pass, not a CREATE pass.

---

## 1. What this touches

- Table: `directive_brand_status` (existing rows only — every (directive, brand)
  pair in `proposed_backfill.csv` already has a row from the original load).
- No `directives` table changes, no new brands, no schema, no new route.
- Reuses the SAME update path as the inline cell editor
  (`PATCH /api/admin/directives/status`) OR a direct backfill write — Claudette's
  call, but **either way must emit an `audit_log` row per changed cell** (per the
  hard requirement locked in the original goal-load handoff §5 — the resolve
  timestamp for the eventual E3 lifecycle work depends on this trail existing).
  That handoff was uncommitted when this spec was written; it now lives at
  `docs/HANDOFF-goal-directives-load.md` (the requirement is **§5 item 3**, and
  §7 is why it is load-bearing: no `resolved_at` column ships, so `audit_log` is
  the only record of *when* a cell resolved).

## 2. Input file

`proposed_backfill.csv` columns: `brand, title, our_status, suggested_status,
convert_name, convert_id, convert_status`. Loader matches on `(brand, title)` →
finds the directive_id + brand_id → updates `status` to `suggested_status` →
writes the audit row (`old_value` = `our_status`, `new_value` = `suggested_status`,
`notes` = "Convert reconciliation 2026-07-25 — {convert_name} (id {convert_id},
Convert status: {convert_status})" or "no real Convert goal — placeholder/absent"
for the downgrade rows without one). **Precisely: 6 of the 7 downgrades take the
placeholder note; MRA "Submits Form Lead - Combined" carries a real archived goal
(`1004101324`) and takes `auditNote`'s other branch. The branch keys on whether
`convert_id` is present, NOT on the direction of the flip.** *(Read "the 8
downgrade rows" until 2026-08-22 — stale after addendum 7, and imprecise before
it. Karen delta review HIGH-2.)*

**Idempotency:** re-running is safe — an update to the same value is a no-op
(the existing PATCH route already reports `changed: 0` in that case; a direct
write should check current value first and skip/log rather than blindly write).

## 3. The downgrades — know these before running

**7 downgrades, not the 8 listed below.** The MDG validation-error entry is
SUPERSEDED and REMOVED — see addendum 7 (resolver bug: it matched an archived
duplicate goal; the directive is genuinely Done and needs no change).

```
MRA  Submits Form Lead - Combined       -> goal exists but is ARCHIVED in Convert
MRA  Submits LF Lead + Contact Us       -> no combined variant exists for MRA
MDG  Step 1 Validation Error Exposure  -> REMOVED, NOT A DOWNGRADE (addendum 7)
MDG  [Upsell] Clicks Submit CTA         -> V1 placeholder goal, not real (confirmed)
PDS  [Upsell] Clicks Submit CTA         -> same placeholder pattern
RBW  Clicks Learn More on Tiles        -> Local/National split pending rollout
                                          decision (Lacey: roll out everywhere,
                                          not yet built -- stays To do until then)
RBW  [Upsell] Clicks Submit CTA         -> dead goal ID (confirmed via separate
                                          upsell-backport handoff doc)
FSP  [Upsell] Clicks Submit CTA         -> FSP has no upsell module at all
```

These are all currently live as "Done" in prod and are wrong. Flipping them to
To do is a correction, not a regression -- flag to whoever smoke-tests that a
"downgrade" appearing in the diff is expected and intentional here.

## 4. Explicitly OUT of scope for this script

- **Rename cleanup** (`rename_cleanup.csv`, 110 rows) -- Convert-side goal renames,
  executed in Convert itself (or by Xandor), not a CQIP write. Separate, no code.
- **Paused brands** (`paused_brands_readiness.csv` -- MRR-CA 17 / SHG 16 / WDG 16
  pre-resolved) -- informational only. Do NOT write these; the pause rule forces
  N/A regardless, and these brands aren't live. Re-run this same reconciliation
  logic against them when/if they reactivate.
- **New directive creation** ("Chat Interaction to Lead Submitted" -- a real MRA
  goal with no directive yet, brand-wide rollout once the V2 trigger ships --
  prereq not yet met) -- separate future batch, not a backfill.
- **Matrix "hide paused" filter** -- separate render-layer batch (queued behind
  the already-in-flight matrix-controls work), not part of this data script.

## 5. Verification

- Row count check: `changed + already_at_target` == the CSV row count (**212**
  after both corrections), per addendum 5 — NOT "212 cells updated". Against prod
  on 2026-07-25 the expected split is **206 changed + 6 already correct**. A plan
  reporting 206 is CORRECT, not a shortfall.
- Spot-check a sample of both upgrades and all 7 downgrades against the live
  matrix UI post-run.
- `audit_log` row count == `changed` (one per CHANGED cell — skipped
  already-at-target cells write none), so **206** on a clean first run, scoped to
  `changed_by = 'system:convert-reconciliation'`.
- Same post-run self-verify pattern as the original loader (assert actual DB
  state matches expected, loud failure on mismatch -- don't trust build-green).

## 6. Gate

No schema change, no new route -> likely no Jenny (Claudette confirms). Karen
reviews the loader logic + spot-checks mapping parity against this doc. Lacey
approves + runs, same as the original goal-directive bulk load. DO NOT auto-run.

## 7. Run procedure (operator checklist)

**Lacey runs this. It is the sanctioned procedure for the production UPDATE —
cite THIS section, not the archive.**

Lifted into the spec 2026-08-22 (Karen delta review HIGH-1). It previously
existed only inside a `docs/claude-archive/` file, which §13 **r40** makes
history and never authority — so a production write had no citable procedure at
all.

**TWO repoints failed before this one, and the archive was not one of them** —
it is where the procedure lived before any pointer existed. Re-derived from git
2026-08-22: **(1)** commit `36b7573` cited a **`§Pre-run`** section that has
never existed in this spec; **(2)** commit `7b8fc21` cited `## 5. Verification`
+ `## 6. Gate`, which do exist but are post-run assertions and approval policy,
with **no runnable command anywhere in this document** before §7; **(3)** commit
`43ad41f` lifted the procedure here. *(An earlier version of this paragraph also
said "two" but named the archive and `§Pre-run`, dropping `§5`+`§6` — while
CLAUDE.md named the archive and `§5`+`§6`, dropping `§Pre-run`. Two documents,
two different wrong pairs. Karen delta review MEDIUM-1; this wording is now
identical in both so they cannot diverge again.)*

**Every figure below was re-derived from
`scripts/data/convert-reconciliation-backfill.csv` at the moment of writing, per
CLAUDE.md §13 r43 — nothing was transcribed from the archived copy, which
carries seven stale tokens across four numbers (`215`×2, `209`, `207`,
`8 downgrades`×2).**

**Figures, and where each comes from — the two kinds are not interchangeable:**

| Figure | Value | Source |
|---|---:|---|
| CSV rows | **212** | re-derived from the CSV, 2026-08-22 |
| Upgrades (To do → Done) | **205** | re-derived from the CSV, 2026-08-22 |
| Downgrades (Done → To do) | **7** | re-derived from the CSV, 2026-08-22 |
| Active brands in scope | **13** | re-derived from the CSV, 2026-08-22 |
| `changed` / `already at target` | **206 / 6** | **NOT CSV-derivable** — depends on live prod state; measured 2026-07-25 (§5). Treat as an expectation, not an invariant: if `already at target` has grown, someone flipped cells in the UI since, and that is fine. |

1. **Dry run.**
   ```
   npx tsx --env-file=.env.local scripts/backfill-convert-reconciliation.ts --dry-run
   ```
   Confirm the parsed shape is **212 rows / 205 upgrades / 7 downgrades** — the
   script hard-fails on any other shape against its `EXPECTED_TOTAL` /
   `EXPECTED_UPGRADES` / `EXPECTED_DOWNGRADES` constants. Expect
   **206 to change + 6 already at target = 212** and **0 drifted**. Read the
   7 downgrades it prints with their reasons.
   **STOP CONDITION:** if anything reports as **drifted**, a cell was edited
   after 2026-07-25. Re-verify those cells against Convert before considering
   `--allow-drift`. Do not pass that flag to get past a surprise.
2. **Run for real** — same command without `--dry-run` — and answer `yes` at the
   prompt.
3. **Confirm BOTH post-verify lines**, not just the first:
   `✓ Post-verify: all N cells hold their expected status` **and**
   `✓ Post-verify: N audit row(s) present`.
   Any non-zero exit means do **not** trust the matrix yet. The script exits
   non-zero if the cells land but the audit trail does not (Karen 2026-07-25
   HIGH — it previously warned and exited 0).
4. **Smoke the live matrix** on `/dashboard/pulse`: spot-check a few upgrades,
   then confirm **all 7 downgrades** now read **To do**. That is expected, not a
   regression — see §3 for each one's reason.
5. **Re-run the dry run.** It must report `Nothing to change` (idempotency).
6. **~~Before running, check the MLY `FLF: Views Step #1` / `Step #2` pair
   sharing Convert id `100480830`.~~ RESOLVED by addendum 6 — struck, not
   deleted, so nobody re-opens it.** Both MLY rows were removed from the CSV on
   2026-07-25. Verified again at write time, 2026-08-22: **0 rows in the CSV
   cite `100480830`**, and MLY still participates with **27** other rows. There
   is nothing left to check here.
