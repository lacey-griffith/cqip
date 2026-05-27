# Root-Cause & Taxonomy Field Audit — 2026-05-20

**Scope:** Read-only audit of `quality_logs` free-text-array
fields with suspected drift: `root_cause_initial`,
`root_cause_final`, `issue_category`, `issue_subtype`,
`resolution_type`.

**Author:** Claudette (CLAUDETTE session, DC repo, batch-numbered
follow-up TBD).

**Status:** Findings only. No normalization, no schema change, no
code change outside this report. Awaiting DC + Lacey decision on
Option A / B / C in §5.

---

## 1. Executive Summary

**How bad is the drift?** Bad enough to invalidate every chart and
report that aggregates `root_cause_final`, `root_cause_initial`,
or `issue_category` by exact string equality. It is NOT an
emergency in the "production is broken" sense — every individual
row is intact — but every distribution chart on `/dashboard`,
every saved report grouped on these fields, and the "Repeat Root
Cause" alert rule (`lib/alerts/rules.ts:185-188`, which calls
`.overlaps('root_cause_final', ...)`) is currently silently
under-counting clusters. The "Top Root Causes" chart on
`/dashboard` is the most visible casualty: it splits the
team's largest real-world root cause (the
`Missing / Miscommunicated Info` family — 15 occurrences,
~31% of the data) across two distinct buckets that don't add up
in the UI. Same shape on the CRO Code family (6+6+1+1+1 = 15
occurrences across five spellings).

**Root cause of the drift:** the CSV historical import
(`scripts/import-csv.ts`, executed once at v1.0 launch) passed
free-text strings through verbatim with only `.trim()`. 37 of the
49 non-deleted rows (76%) were imported that way and account for
the bulk of the drift. The remaining 12 rows (24%) came from the
post-Phase-1 webhook / sync path, which sources values verbatim
from Jira select-list options (canonical at write time), but the
admin edit dialog at `components/logs/edit-log-dialog.tsx:191-196`
also exposes `root_cause_final` as a **free-text comma-separated
input** with zero validation against Jira's canonical list,
introducing a live (small but growing) second drift source.

**`issue_subtype` and `resolution_type` show zero drift** — both
have only 2-3 occurrences total, all from the post-Phase-1
webhook path, all matching Jira canonical exactly. They are not
yet polluted. Any taxonomy work should treat them as already
clean and lock them in before more data flows.

**Recommendation (preview of §5):** Option B — normalize-and-lock.
Half-day normalize-only fixes the symptom but the edit dialog
keeps re-introducing drift, and there's no mechanism preventing
Lacey from typo'ing `"CRO Code Eror"` into the dialog tomorrow.
A small taxonomy table + dialog refactor (multi-select sourced
from the taxonomy) closes both wounds. Option C (live Jira sync)
is over-engineering for a list that changes maybe once a quarter
— Lacey can run a refresh script when she adds a new option.

---

## 2. Data Findings

### 2.1 `root_cause_final` (TEXT[]) — 18 distinct values, 49 rows total

Jira canonical options for `customfield_12905` (Root Cause): **10**.

| Canonical Jira value | DB occurrences | DB variant(s) observed |
| --- | --- | --- |
| Missing or Miscommunicated Information | 15 | `Missing / Miscommunicated Info` (12, csv era) · `Missing or Miscommunicated Information` (3, system era) |
| Client Request | 6 | `Client Request` (6) ✓ canonical |
| CRO Code Error | 15 | `CRO Code / Config Error` (6) · `CRO Code / Configuration Error` (6) · `CRO Code` (1) · `CRO Code Error` (1) ✓ · `CRO Implementation` (1) [actually an issue_category value] |
| Process Gap | 3 | `Process / QA Gap` (2) [splits across two canonicals] · `Process Gap` (1) ✓ |
| QA Gap | 1 | `QA Gap` (1) ✓ |
| Requirement or Scope Change | 3 | `Requirement or Scope Change` (2) ✓ · `Requirement / Scope Change` (1) [slash vs "or"] |
| Client Side Code Issue | 2 | `Client Code / Backend Error` (1) · `Client Code` (1) |
| Third Party Tool Change | 2 | `External Dependency Change` (2) [different wording] |
| Experiment Setup Error | 0 | (not observed) |
| Client Data/ Feed Issue | 1 | `Data / Mapping Issue` (1) [actually an issue_subtype value] |
| *(no canonical match)* | 2 | `Design/Visual` (2) [actually an issue_category value] |

**Drift clusters worth calling out:**

1. **Missing/Miscommunicated Info family — 15 occurrences,
   2 spellings.** Largest single root cause in the dataset.
   `Missing / Miscommunicated Info` was the CSV-era spelling
   (all 12 in 2025-11 → 2026-01); `Missing or Miscommunicated
   Information` is the post-Phase-1 webhook spelling and
   matches Jira canonical exactly.

2. **CRO Code family — 15 occurrences, 5 spellings.** This
   field has the worst drift. Both `CRO Code / Config Error`
   and `CRO Code / Configuration Error` predate Jira's current
   canonical `CRO Code Error` — they look like CSV-era
   spellings or a Jira option that was renamed at some point.
   `CRO Implementation` is actually an `issue_category`
   canonical value that someone pasted into `root_cause_final`.

3. **Cross-field pollution.** `Design/Visual` (2),
   `CRO Implementation` (1), and `Data / Mapping Issue` (1)
   are all canonical values for OTHER fields (issue_category
   and issue_subtype respectively). They landed in
   root_cause_final via the CSV import's free-text passthrough
   or via the admin edit dialog.

4. **Canonical-aligned rows: 14 of 49 (29%).** The other
   71% are drift.

### 2.2 `root_cause_initial` (TEXT[]) — 12 distinct values, 41 rows w/ data

Same canonical list as 2.1. Snapshot at log-creation time per §13
rule 3.

| Canonical Jira value | DB occurrences | DB variant(s) observed |
| --- | --- | --- |
| Missing or Miscommunicated Information | 12 | `Missing / Miscommunicated Info` (12) [csv era only] |
| CRO Code Error | 17 | `CRO Code / Configuration Error` (8) · `CRO Code / Config Error` (7) · `CRO Code Error` (2) ✓ |
| Third Party Tool Change | 2 | `External Dependency Change` (2) |
| QA Gap | 2 | `QA Gap` (2) ✓ |
| Process Gap | 1 | `Process / QA Gap` (1) [splits across two canonicals] |
| Requirement or Scope Change | 1 | `Requirement / Scope Change` (1) [slash vs "or"] |
| Client Request | 1 | `Client Request` (1) ✓ |
| Client Side Code Issue | 1 | `Client Code / Backend Error` (1) |
| Client Data/ Feed Issue | 2 | `Data / Mapping Issue` (2) [actually an issue_subtype value] |
| *(no canonical match)* | 2 | `Unknown / Needs Investigation` (2) |

**Canonical-aligned rows: 5 of 41 (12%).** Worse than `_final`
because `_initial` is set once at insert and only the CSV-era
rows used the abbreviated spellings — those never get re-edited
upward.

### 2.3 `issue_category` (TEXT[]) — 9 distinct, 36 rows w/ data

Jira canonical options for `customfield_12871`: **11**.

| Canonical Jira value | DB occurrences | DB variant(s) observed |
| --- | --- | --- |
| Design/ Visual | 2 | `Design/ Visual` (2) ✓ canonical |
| Client Website Code | 1 | `Client Website Code` (1) ✓ canonical |
| CRO Implementation | 1 | `CRO Implementation` (1) ✓ canonical |
| Experiment Configuration | 6 | `Convert Configuration` (6) [different wording] |
| Process/ Communication | 6 | `Process/Communication Issue` (6) [missing space, extra "Issue" suffix] |
| Client Data/Feed | 2 | `Client - Data/Source File Issue` (2) [different wording entirely] |
| Third Party Tool | 2 | `External Dependency Change` (2) [different wording — this value is more idiomatic to root_cause] |
| *(no canonical match)* | 11 | `CRO - Frontend Issue` (11) — most common DB value, not in Jira's current list |
| *(no canonical match)* | 5 | `Client - Frontend Issue` (5) — not in Jira's current list |

**Canonical-aligned rows: 4 of 36 (11%).** All 4 from the
post-Phase-1 webhook era. The `CRO - Frontend Issue` and
`Client - Frontend Issue` values look like a deprecated Jira
taxonomy from the CSV-era spreadsheet that was retired before
Phase 1. Lacey should confirm — these may be values intentionally
removed when the option list was redesigned.

### 2.4 `issue_subtype` (TEXT[]) — 3 distinct, 3 rows w/ data

Jira canonical options for `customfield_12904`: **35**.

| Canonical Jira value | DB occurrences | DB variant(s) observed |
| --- | --- | --- |
| API Failure | 1 | `API Failure` (1) ✓ canonical |
| CSS/ Styling Issue | 1 | `CSS/ Styling Issue` (1) ✓ canonical |
| Change not Communicated | 1 | `Change not Communicated` (1) ✓ canonical |

**Zero drift.** All 3 are post-2026-04 (system-era). The CSV
import deliberately did not map this field (see
`scripts/import-csv.ts:259` — `issue_subtype: undefined`), so
the field is uncontaminated by the historical drift source.
Locking this one down now is essentially free.

### 2.5 `resolution_type` (TEXT[]) — 2 distinct, 2 rows w/ data

Jira canonical options for `customfield_12908`: **9**.

| Canonical Jira value | DB occurrences | DB variant(s) observed |
| --- | --- | --- |
| CRO Code Fix | 1 | `CRO Code Fix` (1) ✓ canonical |
| Design Adjustment | 1 | `Design Adjustment` (1) ✓ canonical |

**Zero drift.** Same story as 2.4 — CSV import skipped this
field, both observed rows are system-era. Lock-friendly.

### 2.6 Provenance — `created_by` breakdown

| created_by | logs | earliest triggered_at | latest triggered_at |
| --- | --- | --- | --- |
| `csv_import` | 37 (76%) | 2025-11-20 | 2026-01-14 |
| `system` | 12 (24%) | 2026-04-21 | 2026-05-19 |

The two cohorts are temporally disjoint — the CSV import captured
everything through mid-January, then the webhook took over in
late-April. **The CSV cohort is the dominant drift source on all
three drifty fields** (`root_cause_initial`, `root_cause_final`,
`issue_category`). The system cohort accounts for the small
amount of post-Phase-1 drift in `root_cause_final` only (via the
free-text edit dialog).

---

### 2.7 — 2026-05-27 re-audit snapshot

> Appended per Batch 005.32 spec Step 1. The spec asked for a
> "§2.6" but that number was already taken by the Provenance
> subsection above, so this is filed as §2.7. **Append-only — the
> original §2.1–§2.6 figures above are the 2026-05-20 snapshot and
> are left untouched.**

**Headline: the drift documented in §2.1–§2.5 is gone.** A fresh
read-only pull of all non-deleted `quality_logs` rows on 2026-05-27
(service-role supabase-js, JS aggregation matching the original
methodology) found **zero non-canonical values across all five
fields**. Every value present in the data matches an `is_active`
row in `quality_log_taxonomy`.

This is the expected end-state of **Batch 005.28** (shipped
2026-05-20), which the original §5 recommendation (Option B)
became: it created the `quality_log_taxonomy` table (migration
`020_quality_log_taxonomy.sql`), ran
`scripts/normalize-quality-log-fields.ts` against production,
refactored the edit dialog to constrained `MultiCombobox` inputs,
and added server-side validation in `app/api/logs/edit/route.ts`
(CLAUDE.md §13 rule 29). Batch 005.29 added the Client Request
category + client-change-request subtypes. The combination
normalized the historical drift and closed the live drift source.

**Re-audit counts (54 non-deleted rows; was 49 on 2026-05-20):**

| created_by | rows | window |
| --- | --- | --- |
| `csv_import` | 37 | 2025-11-20 → 2026-01-14 |
| `system` | 17 | 2026-04-21 → 2026-05-27 |

The `system` cohort grew 12 → 17 since 2026-05-20. **None of those
five new rows introduced drift** — confirming the constrained
dialog + edit-route validation are holding the line.

| Field | distinct | rows w/ data | non-canonical |
| --- | --- | --- | --- |
| `root_cause_final` | 10 | 44 | 0 |
| `root_cause_initial` | 10 | 39 | 0 |
| `issue_category` | 8 | 39 | 0 |
| `issue_subtype` | 12 | 15 | 0 |
| `resolution_type` | 3 | 13 | 0 |

The top buckets the original audit flagged as split are now
consolidated: `CRO Code Error` (16 in `_final`, 17 in `_initial`)
and `Missing Assets/ Info` (15 / 12) each aggregate to a single
canonical. The cross-field pollution values (`Design/Visual`,
`CRO Implementation`, `Data / Mapping Issue` in `root_cause_*`)
are no longer present.

**`needs_review` queue: 10 rows** (matches the Batch 005.32 spec's
note). All 10 are already canonical on every taxonomy field — the
flag is a manual-review marker from the 005.28 normalization run,
not a sign of remaining drift. Per the spec's §4, these are left
as-is.

**Canonical spelling note (important for any future normalization):**
the live `quality_log_taxonomy` canonicals are **Jira-verbatim**
per Batch 005.28's locked "N2 Policy A" — e.g. `Missing Assets/ Info`,
`Process/ Communication`, `Unknown/ Needs Investigation`,
`External Factor/ Environment Change`, `Client Data/ Feed Issue`
(no space *before* the slash). The webhook/sync write path depends
on this exact spelling so Jira-sourced values pass the edit-route
validation. Any future taxonomy work must preserve these strings;
do not "tidy" the slash spacing without re-seeding the table and
updating the write-path expectations in lockstep.

**Conclusion:** no normalization is needed as of 2026-05-27. The
Batch 005.32 spec's implementation steps (migration, normalize
script, dialog refactor, route validation, §13 rule) were already
delivered by Batch 005.28/005.29; that spec has been marked
superseded.

---

## 3. Code Findings — Write-Path Audit

Every write path that touches the 5 fields:

| # | Write path | Field(s) | Constrained? | Source / Notes |
| --- | --- | --- | --- | --- |
| 1 | `supabase/functions/jira-webhook/index.ts:333-344` (`mapJiraFields`) | all 5 | Yes (by Jira) | Pulls `item.value` verbatim from multi-select fields. Jira's select-list constrains the option strings at *write time*. If Lacey renames an option in Jira, existing tickets retain the old label until re-synced. Service-role INSERT. |
| 2 | `supabase/functions/jira-sync/index.ts:142-151` (`mapJiraFields`) | issue_category, issue_subtype, resolution_type, root_cause_final, root_cause_description | Yes (by Jira) | Same shape as webhook — pulls `item.value` verbatim. Service-role UPDATE. Note: does NOT update `root_cause_initial` (snapshot rule §13 rule 3). |
| 3 | `app/api/logs/edit/route.ts` (POST) | root_cause_final ONLY | **NO** | Whitelists field names but does NOT validate values. Accepts any `string[]` the client sends. RLS-bound to admin. **Live drift source.** |
| 4 | `components/logs/edit-log-dialog.tsx:189-200` | root_cause_final ONLY | **NO** | Single `<Input>` text field, comma-separated. Helper text says "Comma-separated. Each item is stored as a separate entry." Admin can type anything. **Live drift source.** |
| 5 | `scripts/import-csv.ts:256-263` (one-shot, 2025-11) | issue_category, root_cause_initial, root_cause_final | **NO** | Free-text passthrough with `.trim()` only. `issue_subtype` + `resolution_type` deliberately set to `undefined` (CSV had no columns for them). **Dominant historical drift source. Not re-runnable safely.** |

**Summary of attack surface:**
- The webhook + sync paths (1, 2) are constrained as long as
  the source-of-truth Jira options match the dashboard's
  expectations. No client-side validation; trust pinned to Jira.
- The admin edit dialog (3, 4) is a free-text loophole that
  bypasses Jira entirely and can introduce values that no Jira
  ticket ever had. It's small today (visible in the 2026-04 →
  2026-05 system rows: `Design/Visual`, `CRO Code`, `CRO
  Implementation`) but grows linearly with admin edits.
- The CSV import (5) is a one-time legacy artifact. Even though
  it's a script and could in principle be re-run, in practice
  it won't be — the CSV file was a snapshot, not a live source.

**Cross-field pollution path:** the edit dialog edits
`root_cause_final` only, but ANY string can be typed including
canonical values from OTHER fields (`Design/Visual` is a valid
`issue_category`, not a `root_cause`). The DB has zero schema
enforcement that an `issue_category` value can't appear in
`root_cause_final`. Same problem at the CSV import.

---

## 4. Provenance (per Query 6)

37 of 49 rows (76%) came from the CSV import (created_by =
`csv_import`, 2025-11-20 → 2026-01-14). The CSV-era spreadsheet
was free-text with abbreviated headers (`Missing /
Miscommunicated Info`, `CRO Code / Config Error`, `CRO -
Frontend Issue` etc.) that have NEVER been canonical in the
current Jira option list. Some of these labels also evolved
WITHIN the CSV era — e.g., both `CRO Code / Config Error` and
`CRO Code / Configuration Error` show up in csv_import rows
across different date windows. Best guess: the team typed
slightly different abbreviations into the spreadsheet over
time.

12 of 49 rows (24%) came from the webhook + sync path
(created_by = `system`, 2026-04-21 → 2026-05-19). These rows
are *mostly* canonical at write time, but two distinct sources
of post-Phase-1 drift are visible in this cohort:
1. **Stale Jira options.** Even within the system cohort,
   `CRO Code Error` (2 occurrences) coexists with the seemingly
   broader `CRO Code` (1) and the cross-field `CRO Implementation`
   (1). One plausible reading: the Jira option list was
   re-organized at some point and the dashboard's stored values
   don't get refreshed unless the ticket re-syncs (sync only
   runs on logs WHERE log_status != 'Resolved').
2. **Admin edit dialog free-text.** Most likely culprit for the
   non-canonical `Design/Visual` and `CRO Code` strings on
   recent rows. Hard to prove without checking `audit_log` for
   `field_name='root_cause_final'` UPDATE rows — see Open
   Questions §6.

**Fix-priority implication:** any normalization script must
target the CSV cohort first (high volume, high duplication) and
the system cohort second (small but live). Source-of-drift
remediation (admin dialog refactor) should be a separate piece
that prevents NEW drift from accumulating after normalization.

---

## 5. Recommendations

### Recommended: **Option B — Normalize + canonical reference table.**

Estimated effort: 1-2 days.

**Why B over A:** Option A (one-shot normalization) fixes the
symptom and matches a known precedent (Batch 005.25
`scripts/normalize-client-brand.ts`), but the admin edit dialog
keeps producing new drift the moment it ships. Within a month
we'd be back here. Option B closes the underlying wound by
giving the edit dialog a constrained source.

**Why B over C:** Option C (live Jira sync) is the "correct"
long-term answer but is overkill for v1.5. Jira option lists
change maybe once per quarter (the audit shows the CRO Code
option has been stable as `CRO Code Error` long enough to be
the canonical, with deprecated variants `CRO Code / Config
Error` predating it). Lacey running a refresh script or a
small admin UI button when she updates Jira is acceptable.
The added complexity (sync job, conflict resolution between
"option Lacey deleted from Jira" vs "rows still referencing
it", scheduled invalidation) is not justified by the change
frequency.

**What Option B looks like:**
1. New migration: `020_root_cause_taxonomy.sql` (or
   appropriately numbered) — single table
   `root_cause_taxonomy(id, field_name, canonical_value,
   is_active, created_at)`, plus per-field
   sibling tables OR a discriminated single table keyed on
   `field_name`. Seeded from the Jira canonical lists
   captured in this audit.
2. One-shot script `scripts/normalize-root-causes.ts`
   following the `normalize-client-brand.ts` pattern —
   maps known variants to canonical, idempotent, audit-logged
   via `target_type='quality_log'` UPDATE rows with
   `changed_by='system:normalize-root-causes'` per §13 rule 20.
   Includes a `--dry-run` default and `--execute` flag.
3. Edit dialog refactor: replace the comma-separated text
   input with a `MultiSelect` sourced from
   `root_cause_taxonomy WHERE field_name='root_cause' AND
   is_active`. Existing values that aren't in the table render
   as "(legacy)" badges and are read-only — admin must clear
   and re-pick if they want to change them.
4. Edit route validation: reject any value not in the
   taxonomy on UPDATE. (Soft-reject via warning toast, or
   hard-reject 400. Decide at impl.)
5. CLAUDE.md §13 new rule about taxonomy-backed array
   fields + the no-free-text constraint.

**Quick wins that can ship independently of the larger
batch (without committing to Option A/B/C):**

- **Q1: Edit dialog is free-text — easy fix.** Even before
  picking A/B/C, the dialog could be hardened to reject values
  containing the `/` character followed by a space + word (heuristic
  for "is this a CRO Code / Config Error style spelling?") and
  surface a warning. Half-hour change, surfaces drift early
  without normalizing yet. Trade-off: warning is brittle, but
  it's a stop-gap to slow the bleed if Option B takes a week
  to land.

- **Q2: Lock down issue_subtype and resolution_type now.** Both
  fields are pristine (zero drift). Even if Option B is rejected
  in favor of Option A, these two fields should be locked first
  because they're the cheap case — small canonical lists, no
  existing data to clean. A schema-level CHECK constraint
  (`CHECK (issue_subtype <@ ARRAY[...]::TEXT[])`) is technically
  feasible but brittle to Jira option additions. Lower-friction:
  add a foreign-key-style constraint via the taxonomy table from
  Option B.

- **Q3: Surface the drift visually before fixing it.** Add a
  small admin-only "Data quality" page that runs Queries 1-5
  client-side and flags variants. Lets Lacey see what's about
  to be merged before normalization runs. Could ship in 2-3
  hours if there's appetite. Trade-off: extra surface to
  maintain.

### Option A — Normalize-only (~half day)

Pattern: `scripts/normalize-root-causes.ts` modeled on
`scripts/normalize-client-brand.ts` (Batch 005.25,
2026-05-13). Variant→canonical mapping hard-coded in the
script. Idempotent. Audit-logged per row. Dry-run by default.

**Strengths:** smallest scope, fastest to ship, matches
existing precedent, gets the charts honest immediately.

**Weaknesses:** doesn't close the edit dialog wound. Within
weeks, new drift accumulates. We'd run this script
periodically forever, or eventually graduate to Option B.

### Option C — Live Jira-sourced taxonomy (~3-5 days)

Same as B, plus:
- Sync job (edge function or cron-triggered Worker route) that
  pulls Jira's current option list once per day or on demand.
- Conflict resolution: if Lacey removes an option from Jira,
  rows referencing it stay but the taxonomy marks it
  `is_active=false`.
- "Refresh from Jira" button on the taxonomy admin page.

**Strengths:** zero manual sync overhead, captures Jira
renames automatically.

**Weaknesses:** real complexity (which Jira context wins?
What about disabled options vs deleted? What if the Jira API
is down on the schedule tick?). Not worth it for a
quarterly-or-less rate of change.

---

## 6. Open Questions for DC + Lacey

These need decisions before implementing Option A/B/C:

1. **Are any "drift" values intentional taxonomy distinctions?**
   The 005.25 audit found drift was mechanical; this one might
   contain semantic disagreements. Specifically:
   - `Design/Visual` (no space) vs `Design/ Visual` (Jira's canonical
     with a space) — same thing, or did the team use the no-space
     form to mean something different?
   - `Process / QA Gap` vs `Process Gap` + `QA Gap` (now two
     separate canonicals in Jira) — was the combined form an
     intentional "either/both" annotation?
   - `External Dependency Change` (5 occurrences across two
     fields) doesn't match Jira's canonical `Third Party Tool
     Change`. Was "external dependency" a deliberately broader
     term?
   - `Unknown / Needs Investigation` (2 occurrences in
     `root_cause_initial`) — should this become a real canonical
     ("Unknown" is a useful initial classification before triage)
     or be normalized to NULL?

2. **What to do with values that are canonical for OTHER fields?**
   `Design/Visual` appears in `root_cause_final` but is an
   `issue_category` canonical. `CRO Implementation` and
   `Data / Mapping Issue` show similar cross-field landings.
   Three options:
   a. Map to the closest root-cause canonical (`Design/Visual` →
      `CRO Code Error`? unclear).
   b. Move the value to its correct field if there's a sibling
      row open (much more complex — multi-column UPDATE).
   c. Map to NULL and let the team re-classify via the dialog.

3. **Should soft-deleted Jira options be honored?**
   `CRO - Frontend Issue` (11 occurrences) and `Client -
   Frontend Issue` (5) are not in Jira's current options
   but were *probably* canonical when the CSV-era spreadsheet
   was being typed. Three options:
   a. Hard-delete: normalize to closest current canonical.
   b. Soft-delete: keep the original strings, mark as legacy
      in the taxonomy, deprioritize on charts.
   c. Restore: ask Lacey to re-add them to Jira, then they're
      canonical again.

4. **Hierarchy needs?** The Issue Subtype canonical list has 35
   options that map naturally to Issue Category parents (e.g.
   "Javascript Error" under "Client Website Code"). Today both
   fields are flat. Should the taxonomy table model that, or
   stay flat?

5. **What to do about the 12 mystery `Convert Configuration`
   rows?** They correspond to Jira's `Experiment Configuration`
   one-for-one in date pattern — likely a CSV-era abbreviation
   where the team called their A/B testing tool "Convert"
   (which is the actual tool name, see `field-map.ts` comment
   about "Convert tab"). Confirm before normalizing.

6. **Audit-log forensics — was the edit dialog really used?**
   This audit guesses that some post-Phase-1 drift came from
   the admin edit dialog, but I didn't query `audit_log` to
   confirm. A quick read of
   `SELECT * FROM audit_log WHERE field_name='root_cause_final'
   ORDER BY changed_at DESC` would either confirm or rule out
   that source.

---

## 7. Next Steps (proposed sequence, after DC review)

This is a sequencing proposal, not a decision — DC + Lacey to
confirm.

1. **DC + Lacey review this report.** Decide A vs B vs C. Decide
   on the §6 open questions (especially Q1 and Q3 — those drive
   the variant→canonical mapping in any of the three options).

2. **If Option B (recommended):**
   - Lock the variant→canonical mapping in a follow-up doc
     (1-2 hours, paired with Lacey).
   - Ship Batch 005.28-ish (numbering TBD by DC) with the
     `root_cause_taxonomy` migration, normalize script,
     edit-dialog refactor, validation.
   - Ship taxonomy admin UI (small, optional v1 — could be
     done via direct SQL until justified).

3. **If Option A:**
   - Lock the variant→canonical mapping (same as above).
   - Ship `scripts/normalize-root-causes.ts` only (~half day).
   - Add the edit-dialog hardening (§5 Q1) as a separate
     small batch to slow future drift.
   - Track the dialog-refactor + taxonomy work as a deferred
     Batch 006-or-later item.

4. **Either way: lock `issue_subtype` and `resolution_type`
   first.** These are uncontaminated and locking them down is
   essentially free. Could ship before the larger normalization
   if there's appetite for an immediate small win.

5. **Pair with §15 backlog item 5.11** (server routes + audit
   for projects / alert_rules / users mutations). The
   taxonomy admin surface, if built, naturally pairs with
   that batch's server-route pattern.

---

## Appendix A — Methodology

**SQL queries** in Part 1 of the audit directive were executed
via a one-shot TypeScript script that pulled raw rows via
supabase-js (service role, read-only) and aggregated in JS to
match the SQL semantics. Script location: `/tmp/cqip-audit-2026-05-20.ts`
(outside repo, not committed per the directive's "no code
changes outside the new docs/ report file" guardrail). Output
in `/tmp/cqip-audit-output.txt`.

**Jira canonical fetch** used a second one-shot TypeScript
script at `/tmp/cqip-jira-options.ts` against the Jira Cloud
`/rest/api/3/field/{fieldId}/context/{contextId}/option`
endpoints. Output in `/tmp/cqip-jira-options-output.txt`.
Each field returned a single global context with the listed
options; all 4 fields use `Default Configuration Scheme` (no
project-specific overrides).

**Both scripts are read-only.** Service-role key used for the
Supabase script; Jira basic auth for the Jira script. No
mutations executed.

**Row counts:** 49 non-deleted `quality_logs` rows in
production at audit time. Of those, 37 are `csv_import` and
12 are `system`. Numbers in §2 use these denominators.

**Caveat:** `audit_log` was not queried for this audit. If
DC wants to confirm the edit-dialog drift hypothesis (§6
question 6), that's the next read-only step.

---

*Report end. No production changes were made. No CLAUDE.md
updates were made. No new code was committed.*
