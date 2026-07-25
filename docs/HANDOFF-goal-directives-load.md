# HANDOFF — NBLY goal directives bulk load (Pulse / Batch 012)

**For:** Lacey (review mapping) → Claudette (build loader) → Karen → Lacey smoke + run
**Source:** `NBLY_Goal_Tracker_All_Brands_Sheet1_.csv` (uploaded 2026-07-21)
**Prep by:** DC · **Status:** mapping DONE, awaiting Lacey sign-off on the one flag below, then loader build.

---

## 0. One-line

Bulk-load 65 goal directives × 16 NBLY brands into the Pulse directive matrix, with per-brand status derived from the goal tracker. There is no CSV-import in the app, so this loads via a one-off Claudette loader as a **plain data write** (backfill-style). **Review model: `To do` = the review queue** (Lacey 2026-07-21) — no separate `needs_review` flag, no schema change. Lacey works the To-dos down and flips to Done as verified. **DO NOT auto-run — Lacey approves the mapping + smoke-tests after.**

---

## 1. Locked mapping (Lacey, 2026-07-21)

Per-brand cell status derives from the sheet value **and** the brand's active/paused state.

**Active brands (13):**
```
TRUE  → Done     (goal is live)
FALSE → To do    (needs verification — Lacey: "prob more completed but need verification")
?     → N/A      (does not apply to this brand)
blank → N/A
```

**Paused brands (3) — MRR-CA · SHG · WDG:**
```
ALL cells → N/A   (not to-dos now; if they return they'll need these goals — sheet is the record)
```
> When a paused brand reactivates, its cells sit at N/A — flip the real work to To do at that point. Nothing auto-reactivates.

---

## 2. Volume (what lands in prod)

```
Directives (goals):   65
Brands:               16   (13 active + 3 paused)
Cells:              1,040

Status totals:      Done 262 · To do 496 · N/A 282
```

**To do (verify) load per brand:**
```
MRA   4     MLY  58 *      MRR   58 *
ASV  14     FSP  18        MRR-CA 0  [paused → all N/A]
MDG  16     GUY  58 *      MRE   58 *
PDS  19     JUK  58 *      SHG    0  [paused → all N/A]
RBW  19     MOJ  58 *      WDG    0  [paused → all N/A]
            MRH  58 *
```
`*` = the 7 all-FALSE active brands. Each gets ~58 To-do cells = the verification checklist Lacey asked for ("go confirm and flip to Done"). This is intended, but it's ~406 of the 496 To-dos. **If that checklist is more noise than value on those 7 brands, say so and we hold them at N/A instead** — trivial to change before the loader runs.

---

## 3. Dupe / typo resolutions (Lacey-confirmed)

| Sheet | Resolution |
|---|---|
| "Clics Offer Section Scheduler CTA" | Typo → merged into **"Clicks Offer Section Scheduler CTA"** via TRUE-union (row was a superset; no marks lost). One directive. |
| "[Rev] Time Spend on Financing (15s)" | Typo → **"Time Spent on Financing"**. |
| "[Upsell] Selects Offer 1 / Advantage Plan / MDG Cross Sell" | Brand-specific → Done for the tagged brand, N/A elsewhere (the "?" cells map there automatically). |
| "GTM Submits Lead Combined" vs "Submits Form Lead - Combined" | **Two distinct goals** (GTM-triggered client-managed vs Convert-native). Both kept. GTM row had no brand marks → loads all-N/A placeholder. |
| "SF into S&C (All/Footer/Hero)" + "SF Lead (All/Footer/Hero)" | **6 distinct goals.** S&C = submit-and-continue into lead flow; SF Lead = inline short-form. No merge. |

---

## 4. ⚠ ONE thing needing Lacey's eye before load

**General upsell goals on non-upsell brands.** "[Upsell] Selects Any" and "[Upsell] Presented" are marked FALSE (→ **To do**) for MDG/PDS/RBW/FSP and the 7 all-FALSE brands. If those brands simply don't run upsells (you said upsells are brand-specific), those should be **N/A**, not To do. Left as To-do/verify by default (safer than silently hiding). Tell me to N/A the upsell block on the non-upsell brands and I'll adjust.

---

## 5. Open items for the loader build (Claudette / Jenny)

1. **`directive_type` value** — mapped as `goal`. Confirm the exact enum in the `directives` schema (couldn't read migration during prep). If the goal type string differs, swap it in the load file.
2. **Brand-code match** — the load keys on `brand_code`. Sheet headers normalized ("MRR- CA" → `MRR-CA`). **Verify all 16 codes match `brands.brand_code` in prod exactly** before running — a mismatch silently drops cells. This is a load-time smoke check.
3. **Load path (light / backfill-style)** — `To do` is the review queue, so NO `needs_review` flag and NO schema change. Bulk-create the 65 directives + set the 1,040 cell statuses directly. Idempotency: guard against double-run (match on title+project so a re-run doesn't duplicate directives).
   - **HARD REQUIREMENT — `audit_log` row on every status change.** Both the loader AND the inline-edit path must write an `audit_log` entry per cell transition (mirror the `quality_logs` normalization backfill). This is load-bearing, not just traceability: with no interim `resolved_at` column (see §7), the audit trail is the **only** store of *when* a goal resolved until the Convert/Jira date sync lands. A missed audit write = a permanently unrecoverable resolve date. If a raw insert is used for the bulk load, it must still emit the audit rows.
4. **Gate** — no schema change, no new route → likely no Jenny (Claudette confirms). Karen reviews the loader + a mapping-parity spot-check; **Lacey approves this mapping + smoke-tests after the run.** Same gate profile as the historical `quality_logs` backfill.
5. **Naming** — "GTM Submits Lead Combined" kept verbatim. If you want the `[GTM]` bracket convention applied for consistency with client-managed goals, flag it.

---

## 6. Files

- `NBLY_goal_directives_mapped.csv` — wide matrix (goals × brands, cells = Done/To do/N/A). **Review this** — it mirrors your sheet with the mapping applied.
- `NBLY_goal_directives_load.csv` — long form (directive_title, directive_type, brand_code, status). The loader consumes this.

---

## 7. Resolve semantics + resolved-date (decided 2026-07-21)

**"Resolved" is derived, not stored.** A directive is resolved when it has zero
outstanding cells — computed from live cell data, never a stored flag (same
anti-divergence reasoning as 005.1 covered = `!droughtFlag`). A regressed goal
(paused brand returns, a Done cell flips back to To do) reappears automatically.

Table default HIDES resolved; a "Show resolved" toggle brings them back. Retrievable
always — nothing is moved or archived; stays in the same table (NOT a separate
archive — resolved directives are live and can regress).

**Guard (do not skip):** zero-outstanding alone falsely catches all-N/A placeholders
(e.g. GTM Combined). Definition:
```
Outstanding > 0                 → active (show)
Outstanding == 0 AND Done >= 1  → resolved (hide; toggle to view)
Outstanding == 0 AND Done == 0  → empty/unstarted (stays visible — GTM case)
```

**Resolved-DATE is deferred, no interim column.** Displaying "resolved on <date>" is
NOT built now and gets NO `resolved_at` column (a column = migration + Jenny, and a
hand-rolled capture would be thrown away when dates arrive from Convert/Jira via API).
The resolve *moment* is already preserved in `audit_log` (§5 #3) from day one. When the
Convert/Jira date sync lands (E2/E3), the lifecycle view reads authoritative dates and
**backfills historical resolve-dates by reconstructing from `audit_log`** for anything
closed before the sync existed. Resolved-date = E3 lifecycle-dates work, not a bolt-on here.

**Gate for the declutter filter:** render-layer only (reuses the Outstanding count),
no schema, likely no Jenny. Reworks `page.tsx` → queues behind the inline-edit push,
do not stack on unpushed code.
