# HANDOFF — Convert reconciliation backfill (Pulse / Batch 012)

**For:** Lacey (review) → Claudette (build loader) → Karen → Lacey approve + run
**Source:** `proposed_backfill.csv` (215 rows) from the Convert goal reconciliation
pass, 2026-07-25 (all 13 active NBLY brands, manually cross-referenced against
real Convert exports — not fuzzy-matched).
**Status:** Mapping complete. No code changes made. Backfill deliberately NOT run yet.

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
