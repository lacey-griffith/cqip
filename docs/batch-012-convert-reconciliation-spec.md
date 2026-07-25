# HANDOFF — Convert reconciliation backfill (Pulse / Batch 012)

**For:** Lacey (review) → Claudette (build loader) → Karen → Lacey approve + run
**Source:** `scripts/data/convert-reconciliation-backfill.csv` (215 rows) from the
Convert goal reconciliation pass, 2026-07-25 (all 13 active NBLY brands, manually
cross-referenced against real Convert exports — not fuzzy-matched).
**Status:** Loader BUILT (`scripts/backfill-convert-reconciliation.ts`, 2026-07-25),
dry-run verified against prod, Jenny gate-confirmed, Karen-reviewed. Backfill
deliberately NOT run yet — Lacey approves + runs.

> **Addenda applied 2026-07-25 at build time.** The sections below are the
> as-written spec; these five points supersede them where they conflict:
>
> 1. **Input filename** is `scripts/data/convert-reconciliation-backfill.csv`
>    (§2 named it `proposed_backfill.csv`). The reference-only siblings live in
>    `docs/convert-reconciliation-2026-07-25/` — `rename-cleanup.csv`,
>    `unmapped-active.csv`, `paused-brands-readiness.csv`, all reference-only
>    (committed in `83b876f`). None of the three is read by the loader.
> 2. **Write path is the DIRECT service-role write, not the PATCH route** (§1
>    left this open). The route requires a cookie-bound admin session and derives
>    `changed_by` via `getChangedBy()`, so a script cannot use it without
>    attributing 215 rows to a human email instead of the §13 r20 system string.
> 3. **`old_value` is read from the live DB, not from the CSV's `our_status`**
>    (§2 said `our_status`). The inline cell editor has been live since
>    2026-07-21, so a cell can have moved since the 07-25 pass; recording the
>    CSV's claim would put a fiction in the audit trail. `old_value`/`new_value`
>    are the canonical `done`/`todo` values, not the CSV's `Done`/`To do`
>    labels, so these rows match UI-written rows for the same `field_name`.
>    `target_id` is the `directive_brand_status.id` (the CELL id), matching
>    `app/api/admin/directives/status/route.ts`.
> 4. **The downgrade audit note branches on data presence, not flip direction**
>    (§2 assigned the placeholder note to all 8 downgrades). Two downgrades
>    reference a REAL but ARCHIVED Convert goal — MRA `Submits Form Lead -
>    Combined` (id 1004101324) and MDG `Step 1 | Contact Info | Validation Error
>    Exposure` (id 1004117395) — so writing "no real Convert goal" over those
>    would discard the archived id from the only forensic trail we keep. Both of
>    §2's note formats are still produced verbatim; the branch picks the truthful
>    one per row.
> 5. **§5's verification arithmetic** ("215 cells updated" AND "`audit_log` == 215")
>    contradicts §2's own idempotency guarantee. The correct invariant is
>    `changed + already_at_target == 215`, and `audit_log` rows == `changed`.
>    Against prod on 2026-07-25 that is **209 changed + 6 already correct = 215**
>    (the 6 are `[Rev] Time Spent on Site (15s)` ×5 and `[Rev] Time Spent on
>    Financing (15s)` ×1, already `Done` in prod).
>
> One §3 entry needs two corrections. The MDG row's title is abbreviated —
> it reads `Step 1 Validation Error Exposure` there, but the CSV and the live
> directive are `Step 1 | Contact Info | Validation Error Exposure` (the CSV
> spelling is authoritative; titles must be byte-exact to resolve). Its stated
> reason, "goal doesn't exist", is also superseded: the CSV shows the goal DOES
> exist but is **archived** in Convert (id `1004117395`), same shape as the MRA
> `Submits Form Lead - Combined` row. The flip to To do is correct either way —
> only the reasoning changes.
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
real state disagrees with what's currently loaded — 207 upgrades (To do → Done,
confirmed live in Convert) and 8 downgrades (Done → To do, false positives: dead
placeholder goals, an archived goal, and one pending design decision). **Status
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

## 2. Input file

`proposed_backfill.csv` columns: `brand, title, our_status, suggested_status,
convert_name, convert_id, convert_status`. Loader matches on `(brand, title)` →
finds the directive_id + brand_id → updates `status` to `suggested_status` →
writes the audit row (`old_value` = `our_status`, `new_value` = `suggested_status`,
`notes` = "Convert reconciliation 2026-07-25 — {convert_name} (id {convert_id},
Convert status: {convert_status})" or "no real Convert goal — placeholder/absent"
for the 8 downgrade rows).

**Idempotency:** re-running is safe — an update to the same value is a no-op
(the existing PATCH route already reports `changed: 0` in that case; a direct
write should check current value first and skip/log rather than blindly write).

## 3. The 8 downgrades — know these before running

```
MRA  Submits Form Lead - Combined       -> goal exists but is ARCHIVED in Convert
MRA  Submits LF Lead + Contact Us       -> no combined variant exists for MRA
MDG  Step 1 Validation Error Exposure  -> goal doesn't exist
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

- Row count check: 215 cells updated, matching `proposed_backfill.csv` exactly.
- Spot-check a sample of both upgrades and all 8 downgrades against the live
  matrix UI post-run.
- `audit_log` row count == 215 (one per changed cell).
- Same post-run self-verify pattern as the original loader (assert actual DB
  state matches expected, loud failure on mismatch -- don't trust build-green).

## 6. Gate

No schema change, no new route -> likely no Jenny (Claudette confirms). Karen
reviews the loader logic + spot-checks mapping parity against this doc. Lacey
approves + runs, same as the original goal-directive bulk load. DO NOT auto-run.
