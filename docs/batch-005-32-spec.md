# Batch 005.32 — Root Cause Taxonomy Normalization + Lock

> **⚠️ SUPERSEDED 2026-05-27 — DO NOT EXECUTE.** This spec's implementation (taxonomy table, normalize script, constrained edit dialog, edit-route validation, §13 rule) already shipped as **Batch 005.28** (table `quality_log_taxonomy`, migration `020_quality_log_taxonomy.sql`) + **Batch 005.29**. A 2026-05-27 re-audit (see `docs/root-cause-audit-2026-05-20.md` §2.7) found zero non-canonical values in production. Note also that §3's canonical spellings (spaced slashes) contradict the shipped Jira-verbatim canonicals and must not be applied. Spec retained for history only.

**Author:** DC + Lacey
**Date:** 2026-05-27
**Status:** SUPERSEDED by Batch 005.28/005.29 (was: Ready for Claudette execution)
**Scope-locked:** Yes. No items move in or out without explicit decision.

**Pairs with:**
- `docs/root-cause-audit-2026-05-20.md` (Claudette's read-only audit)
- `docs/root-cause-taxonomy-mapping.md` (mapping doc — superseded by §3 below)

---

## Purpose

Normalize historical taxonomy drift in `quality_logs` and prevent
future drift by replacing the free-text edit dialog with a
constrained taxonomy-backed multi-select. Ship the full lock today
(Path 2 from the audit).

End state: every `quality_logs` row has canonical Jira values,
admin edits can only pick from the taxonomy, and the next time
someone (Lacey, DC, an agent) touches this code, the rule is
documented in CLAUDE.md.

---

## Scope (locked — do not expand)

1. Re-run audit queries against current production data
2. Migration: `root_cause_taxonomy` table, seeded
3. Normalize script with inline mapping table, dry-run default
4. Edit dialog refactor: free-text → MultiSelect from taxonomy
5. Edit route validation: reject non-canonical values
6. CLAUDE.md §13 new rule on taxonomy-backed array fields
7. Test, deploy, smoke

**Explicitly OUT of scope:**
- Taxonomy admin UI (direct SQL until justified — audit doc §5
  flagged this as optional v1)
- Live Jira sync (Option C in audit — overkill for v1.5)
- Hierarchy modeling for issue_subtype → issue_category
- Backfilling `audit_log` forensics (§6 Q6 in audit)

---

## Sequence

### Step 1 — Re-run audit (30 min)

Re-run the audit queries from `docs/root-cause-audit-2026-05-20.md`
§2.1 through §2.5 against current production data. The 2026-05-20
snapshot may be stale because Lacey has been working through the
`needs_review` queue (down from ~20 to 10 rows as of 2026-05-27).

**Output:** Append a §2.6 to the audit doc titled "2026-05-27
re-audit snapshot" with fresh counts per field. Do NOT overwrite
the original §2 sections — append only.

**If the re-audit surfaces variants not listed in §3 below:** STOP.
Surface to Lacey before proceeding. Do not guess at mappings.

---

### Step 2 — Mapping table (locked, see §3 below)

The full variant → canonical mapping is in §3 of this doc. It is
the contract for the normalization script. Hand-validated by Lacey
on 2026-05-27. Treat it as authoritative.

---

### Step 3 — Migration `020_root_cause_taxonomy.sql`

Create a single table:

```sql
CREATE TABLE root_cause_taxonomy (
  id           BIGSERIAL PRIMARY KEY,
  field_name   TEXT NOT NULL CHECK (field_name IN (
    'issue_category', 'root_cause', 'issue_subtype', 'resolution_type'
  )),
  canonical_value TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (field_name, canonical_value)
);

CREATE INDEX idx_taxonomy_field_active
  ON root_cause_taxonomy (field_name, is_active);
```

**Note:** `root_cause_final` and `root_cause_initial` share the same
canonical list, so `field_name = 'root_cause'` covers both. The
script applies the same taxonomy to both columns.

**Seed:** insert one row per canonical value per field, using the
canonical lists from `docs/root-cause-taxonomy-mapping.md` §1
(issue_category — 10 values), §2 (root_cause — 13 values), §3
(issue_subtype — 29 values), §4 (resolution_type — 9 values).

**Audit log:** standard `target_type='root_cause_taxonomy'`
INSERT rows per §13 rule 2, `changed_by='system:migration-020'`
per §13 rule 20.

---

### Step 4 — Normalize script `scripts/normalize-root-causes.ts`

Follow the `scripts/normalize-client-brand.ts` pattern (Batch
005.25, 2026-05-13). Specifically:

- `--dry-run` flag default TRUE. `--execute` flag required to write.
- Idempotent. Re-running with no new drift produces zero changes.
- Inline mapping table mirrors §3 of this doc verbatim. Do NOT
  read the mapping doc programmatically — copy the mapping into
  the script so the contract is in the code.
- For each `quality_logs` row, for each of the 5 fields, for each
  value in the array:
  - If value is canonical → no change
  - If value matches a variant → rewrite to canonical
  - If value is cross-field pollution (D5, D6 in §3) → null the
    array entry, set `needs_review = TRUE`, log original in
    `audit_log.notes`
  - If value is unmatched → log to console.error and skip (do NOT
    silently drop)
- One `audit_log` row per changed field per `quality_logs` row.
  `target_type='quality_log'`, `changed_by='system:normalize-root-causes'`.
- Per §3 flagging rules: set `needs_review = TRUE` for D1, D2, D3,
  D5, D6, plus all `Missing / Miscommunicated Info` rows and all
  `Process / QA Gap` rows.
- Final summary: rows changed, rows flagged for review, rows
  skipped, unmatched values seen.

**Run order:**
1. `npx tsx scripts/normalize-root-causes.ts --dry-run`
2. Lacey reviews the summary
3. `npx tsx scripts/normalize-root-causes.ts --execute`

---

### Step 5 — Edit dialog refactor

File: `components/logs/edit-log-dialog.tsx`

Currently lines 189-200 render `root_cause_final` as a free-text
comma-separated `<Input>`. Replace with a MultiSelect sourced from
`root_cause_taxonomy WHERE field_name='root_cause' AND is_active=TRUE`.

**Behavior:**
- Multi-select, same array semantics as today
- Existing values not in the taxonomy render as a `(legacy)` badge
  and are read-only — admin must clear and re-pick to change them
- Loading state while taxonomy fetches
- Fallback: if taxonomy fetch fails, fall back to the legacy text
  input with a console.warn (do NOT block editing — partial
  degradation is preferable to a broken admin surface)

**Extend to all 4 fields:** `issue_category`, `issue_subtype`,
`resolution_type`, `root_cause_final`. The dialog already shows
these — confirm whether they're free-text today and refactor all
of them, not just root_cause_final. If any are already
constrained, leave them alone.

---

### Step 6 — Edit route validation

File: `app/api/logs/edit/route.ts`

Currently whitelists field names but accepts any `string[]` for
values. Add validation:

- On UPDATE to any of the 4 taxonomy-backed fields, fetch the
  active canonical list from `root_cause_taxonomy`
- For each submitted value, check it exists in the canonical list
- If any value is non-canonical: return 400 with a clear error
  message identifying the offending field and value
- Exception: legacy values already present on the row pass through
  unchanged (so the dialog's read-only legacy badges don't break
  saves when admin edits a different field)

---

### Step 7 — CLAUDE.md §13 new rule

Add a new rule under §13 (database rules section) numbered per
the existing sequence. Suggested wording:

> **Rule [N]: Taxonomy-backed array fields are write-constrained.**
> Any `quality_logs` array field backed by `root_cause_taxonomy`
> (`issue_category`, `root_cause_final`, `root_cause_initial`,
> `issue_subtype`, `resolution_type`) must only accept values from
> the active canonical list at the time of write. Free-text inputs
> in admin UI are prohibited for these fields. Legacy non-canonical
> values present from before this rule may persist on existing rows
> until manually reclassified via the `needs_review` workflow, but
> no new non-canonical writes are permitted. Source of canonical:
> `root_cause_taxonomy WHERE field_name=<field> AND is_active=TRUE`.
> Source of truth for canonical contents: Jira select-list options
> (taxonomy table is a local cache, refreshed manually when Jira
> options change).

Bump CLAUDE.md to v1.6.

---

### Step 8 — Test + deploy

- TypeScript compile clean
- Run normalize script `--dry-run`, review output with Lacey
- Run normalize script `--execute` against production
- Verify charts on `/dashboard` now aggregate cleanly (the "Top
  Root Causes" chart should show the Missing/Miscommunicated and
  CRO Code families consolidated, not split)
- Verify `/admin/logs` edit dialog renders MultiSelect, can save,
  rejects non-canonical via direct API call
- Verify `needs_review` queue increased by the expected count from
  the normalize run
- Push commits, auto-deploy via existing workflow (Batch 005.31)

---

## §3 — Mapping table (LOCKED — hand-validated by Lacey 2026-05-27)

### Flagging key
- **🚩 FLAG** = set `needs_review = TRUE` on the affected row
- **OK** = no flag, mechanical rewrite only
- **POLLUTION** = null the array entry, log original to
  `audit_log.notes`, set `needs_review = TRUE`

### `issue_category` (customfield_12871) — 10 canonical

| Variant in DB | Maps to | Flag |
|---|---|---|
| `CRO - Frontend Issue` | `CRO Implementation` | 🚩 FLAG (D2) |
| `Client - Frontend Issue` | `Client Website Code` | 🚩 FLAG (D3) |
| `Convert Configuration` | `Experiment Configuration` | OK |
| `Process/Communication Issue` | `Process / Communication` | OK |
| `Client - Data/Source File Issue` | `Client Data / Feed` | OK |
| `External Dependency Change` | `External Factor / Environment Change` | 🚩 FLAG (D1) |
| `Design/ Visual` | `Design / Visual` (canonical Jira spelling) | OK |
| Any value matching a current canonical exactly | (no change) | OK |

### `root_cause_final` and `root_cause_initial` (customfield_12905) — 13 canonical

| Variant in DB | Maps to | Flag |
|---|---|---|
| `Missing / Miscommunicated Info` | `Missing Assets / Info` (Interpretation C default) | 🚩 FLAG |
| `Missing or Miscommunicated Information` | `Missing Assets / Info` (Interpretation C default) | 🚩 FLAG |
| `CRO Code / Config Error` | `CRO Code Error` | OK |
| `CRO Code / Configuration Error` | `CRO Code Error` | OK |
| `CRO Code` | `CRO Code Error` | OK |
| `Requirement / Scope Change` | `Requirement or Scope Change` | OK |
| `Client Code / Backend Error` | `Client Side Code Issue` | OK |
| `Client Code` | `Client Side Code Issue` | OK |
| `Process / QA Gap` | `Process Gap` (Q3 default) | 🚩 FLAG |
| `External Dependency Change` | `External Factor / Environment Change` | 🚩 FLAG (D1) |
| `Unknown / Needs Investigation` | (no change — valid canonical) | OK (D4) |
| `Design/Visual` (cross-field — issue_category value) | NULL | 🚩 POLLUTION (D5) |
| `CRO Implementation` (cross-field — issue_category value) | NULL | 🚩 POLLUTION |
| `Data / Mapping Issue` (cross-field — issue_subtype value) | NULL | 🚩 POLLUTION (D6) |
| Any value matching a current canonical exactly | (no change) | OK |

### `issue_subtype` (customfield_12904) — 29 canonical

Per audit §2.4, zero drift. Script should still walk the field
defensively in case the re-audit surfaces new variants. If any are
found, STOP and surface to Lacey.

### `resolution_type` (customfield_12908) — 9 canonical

Per audit §2.5, zero drift. Same defensive walk + STOP rule as
above.

---

## §4 — Pre-existing `needs_review` rows

10 rows currently have `needs_review = TRUE` from prior Lacey
cleanup. Decision: leave them as-is. The script touches what it
touches; if a row is already flagged and the script doesn't change
it, the flag persists. If the script changes a row that's already
flagged, the flag stays flagged (no demotion).

---

## §5 — Acceptance criteria

- [ ] §2.6 re-audit snapshot appended to audit doc
- [ ] Migration `020_root_cause_taxonomy.sql` applied, taxonomy
      table seeded
- [ ] `scripts/normalize-root-causes.ts` exists, idempotent,
      dry-run default
- [ ] Production normalize run complete, audit_log entries written
- [ ] Edit dialog renders MultiSelect for all 4 taxonomy fields
- [ ] Edit route rejects non-canonical values with 400
- [ ] CLAUDE.md bumped to v1.6 with new §13 rule
- [ ] Dashboard charts on `/dashboard` aggregate cleanly post-run
- [ ] Smoke: `cqip.l-hay.workers.dev/login` returns 200
- [ ] All commits pushed, auto-deploy triggered

---

## §6 — Out-of-scope but worth noting

These came up during planning and were explicitly deferred:

- **Taxonomy refresh-from-Jira button.** When Jira options change,
  Lacey runs a manual script or direct SQL. Build a button if the
  manual flow becomes painful. Not today.
- **Audit log forensics on edit dialog.** Audit §6 Q6 asks whether
  post-Phase-1 drift came from the dialog or from stale Jira
  syncs. Could be answered with a single query on
  `audit_log WHERE field_name='root_cause_final'`. Not blocking
  this batch.
- **Hierarchy modeling.** Issue subtypes naturally roll up to
  categories. Today both are flat. Audit §6 Q4. Deferred.

---

*End of spec. Ship it.*
