# Root Cause + Taxonomy Field Mapping

**Date:** 2026-05-20
**Author:** DC + Lacey
**Status:** Variant tables populated 2026-05-20 by Claudette.
Open questions in §"Population notes" pending DC + Lacey
review before the normalization script runs.
**Pairs with:** `docs/root-cause-audit-2026-05-20.md` (Claudette's
audit findings) and `docs/qa-field-reference.md` (canonical
definitions)

---

## Purpose

This document maps every historical drifted value found in
`quality_logs` to its Jira-canonical equivalent. The
normalization script
(`scripts/normalize-quality-log-fields.ts`) consumes the
mappings below verbatim. Each mapping decision is documented
inline so future auditors can understand the reasoning.

Per the cross-Claude convention (DC §13 rule 28 / verbatim
brand strings precedent), `quality_logs` values are sourced
verbatim from Jira's option strings. This doc enforces that
contract historically.

---

## Field 1: `issue_category` (Jira customfield_12871)

### Canonical Jira options (10 after cleanup)

```
CRO Implementation
Experiment Configuration
Targeting / Audience
Client Website Code
Client Data / Feed
Third Party Tool
Process / Communication
Experiment Concept
Missing Information / Access
External Factor                          ← new, post-Phase-1
```

### Removed from Jira (post-cleanup, ship day)

```
Incorrect Traffic Allocation             → moved to Issue Subtype only
Analytics / Tracking                     → symptom, lives in Subtype
Design / Visual                          → symptom, lives in Subtype
```

### Variant → canonical mapping (historical drift)

Populated 2026-05-20 by Claudette from audit query 3
(`docs/root-cause-audit-2026-05-20.md` §2.3). The "Confidence"
column indicates whether the mapping is mechanical (obvious
match) or semantic (requires human judgment / Interpretation C
default).

| Variant in database | Occurrences | Maps to | Confidence | Notes |
|---------------------|-------------|---------|------------|-------|
| `CRO - Frontend Issue` | 11 | `CRO Implementation` | Mechanical | Legacy "Type of Issue" string; direct match in legacy table |
| `Convert Configuration` | 6 | `Experiment Configuration` | Mechanical | Legacy table; Convert is the experiment tool |
| `Process/Communication Issue` | 6 | `Process / Communication` | Mechanical | Legacy table; spacing + "Issue" suffix removed |
| `Client - Frontend Issue` | 5 | `Client Website Code` | Mechanical | Legacy table; frontend granularity preserved at Subtype |
| `Client - Data/Source File Issue` | 2 | `Client Data / Feed` | Mechanical | Legacy table; direct rename |
| `Design/ Visual` | 2 | `null` (+ needs_review) | Semantic | Removed canonical (per §6 Jira changes). Symptom lives in Subtype but the actual subtype value isn't determinable from this row alone. Per cross-field pollution rule: null + needs_review. Lacey picks correct Subtype value via dialog. |
| `External Dependency Change` | 2 | `External Factor` | Mechanical | Legacy table; new canonical absorbs legacy concept |
| `Client Website Code` | 1 | `Client Website Code` | – | Already canonical, no change |
| `CRO Implementation` | 1 | `CRO Implementation` | – | Already canonical, no change |

**Population summary (Field 1):**
- 9 distinct variants across 36 row-occurrences
- 7 variants map mechanically (34 occurrences, 94%)
- 1 variant (`Design/ Visual`, 2 occurrences, 6%) needs the
  cross-field-pollution rule + per-row review
- 2 variants are already canonical (no change)

**Pattern for filling in (kept for reference / future audits):**

- If variant is a casing/spacing/typo variant of a canonical
  value → mechanical, map directly
- If variant is a legacy "Type of Issue" string from the CSV
  era → see legacy taxonomy mapping below, apply
- If variant landed in this field by cross-field pollution
  (e.g., a root_cause string appearing here) → null out,
  log original in audit_log notes

### Legacy "Type of Issue" → Jira Category translation

For historical rows that used the pre-Phase-1 manual taxonomy.
Sourced from `NBLY_QualityTrackingLog_Tools___Definitions_.csv`.

| Legacy value | Jira canonical | Reasoning |
|--------------|----------------|-----------|
| Client - Backend Issue | Client Website Code | Backend granularity preserved at Subtype level ("Client Backend Issue") |
| Client - Frontend Issue | Client Website Code | Frontend granularity preserved at Subtype level ("Client Frontend Conflict") |
| CRO - Frontend Issue | CRO Implementation | CRO-authored code |
| Convert Configuration | Experiment Configuration | Convert is the experiment tool |
| Missing Information | Missing Information / Access | Direct rename |
| Client - Data/Source File Issue | Client Data / Feed | Direct rename |
| Scope/Requirement Change | Experiment Concept | See note below — also maps to a Root Cause value |
| Process/Communication Issue | Process / Communication | Direct rename |
| External Dependency Change | External Factor | New category, see Field 3 |

**Note on "Scope/Requirement Change":** the legacy column "Type
of Issue" was operationally being used as both category and
root cause. When this value appears, the normalization script
populates BOTH `issue_category` ("Experiment Concept") AND
`root_cause_final` ("Requirement or Scope Change") on the same
row, following Decision A from the 2026-05-20 DC/Lacey
mapping session.

---

## Field 2: `root_cause_final` and `root_cause_initial` (Jira customfield_12905)

### Canonical Jira options (13 after cleanup)

```
Existing (10 kept):
  CRO Code Error
  Experiment Setup Error
  Process Gap
  QA Gap
  Client Side Code Issue
  Client Data / Feed Issue
  Third Party Tool Change
  Requirement or Scope Change
  Client Request

Removed (replaced by 3-way split):
  Missing or Miscommunicated Information   ← split, see below

Added (post-Phase-1, ship day):
  Unknown / Needs Investigation
  External Factor / Environment Change
  Missing Assets / Info
  Unclear / Conflicting Requirements
  Late Assets / Info
```

### The 3-way split of "Missing or Miscommunicated Information"

Single value in legacy taxonomy → three buckets in current
Jira taxonomy. Each has a distinct operational signal:

| New bucket | Meaning | Operational signal |
|-----------|---------|--------------------|
| Missing Assets / Info | Required assets, copy, or instructions were never provided. Work couldn't start or finish because something didn't exist yet. | Intake/handoff process needs hardening |
| Unclear / Conflicting Requirements | Information WAS provided but was ambiguous, incomplete, or led to a different outcome than intended. | Briefing/QA process needs review |
| Late Assets / Info | Information was provided eventually but past the point of usefulness. Often a timeline/sequencing issue. | Scheduling/handoff cadence issue |

**Default mapping for unaudited historical rows
(Interpretation C):**

The 15 historical rows with `"Missing or Miscommunicated
Information"` (and the variant spelling `"Missing /
Miscommunicated Info"`) are auto-mapped to
**`Missing Assets / Info`** as the most common case. The
`needs_review` flag is set TRUE on each row so Lacey can
reclassify per-row via the constrained edit dialog. Edits
clear the flag.

### The Process / QA Gap split

Legacy "Process / QA Gap" was a single value. Jira split into
two distinct options:

| Jira option | Meaning |
|-------------|---------|
| Process Gap | The workflow / process itself had a flaw — missing step, unclear ownership, no QA checkpoint where one was needed |
| QA Gap | A QA step existed but failed to catch the issue — reviewer missed it, test was incomplete, edge case not covered |

**Default mapping for unaudited historical rows
(Interpretation C):**

Historical rows with `"Process / QA Gap"` (3 spellings in
the audit) are auto-mapped to **`Process Gap`** (the broader,
safer default). `needs_review` flag set TRUE. Lacey
reclassifies to `QA Gap` per row when appropriate.

### Variant → canonical mapping (historical drift)

Populated 2026-05-20 by Claudette from audit queries 1 + 2
(`docs/root-cause-audit-2026-05-20.md` §2.1, §2.2). The
table merges both `root_cause_final` and `root_cause_initial`
since they share the same canonical option list. The
"Occurrences" column shows `final / initial` counts; a `–`
in either side means the variant didn't appear in that field.

| Variant in database | Occurrences (final / initial) | Maps to | Confidence | Notes |
|---------------------|-------------------------------|---------|------------|-------|
| `Missing / Miscommunicated Info` | 12 / 12 | `Missing Assets / Info` | Semantic (Interp C default) | + needs_review. 3-way split default; Lacey reviews per-row whether `Unclear / Conflicting Requirements` or `Late Assets / Info` fits better |
| `Missing or Miscommunicated Information` | 3 / – | `Missing Assets / Info` | Semantic (Interp C default) | + needs_review. Same family as above; this is the deprecated Jira canonical that's being removed per §6 |
| `CRO Code / Configuration Error` | 6 / 8 | `CRO Code Error` | Mechanical | Legacy table; direct match. (Experiment Setup Error is the alternative if the issue was setup/config not code — Lacey can reclassify per-row, no auto-flag since legacy table treats this as mechanical) |
| `CRO Code / Config Error` | 6 / 7 | `CRO Code Error` | Mechanical | Same family as above; abbreviated spelling |
| `Client Request` | 6 / 1 | `Client Request` | – | Already canonical, no change |
| `External Dependency Change` | 2 / 2 | `External Factor / Environment Change` | Mechanical | Legacy table; new canonical absorbs legacy concept (same mapping logic as Field 1) |
| `Process / QA Gap` | 2 / 1 | `Process Gap` | Semantic (Interp C default) | + needs_review. Process/QA split default; Lacey reclassifies to `QA Gap` per row when appropriate |
| `Requirement or Scope Change` | 2 / – | `Requirement or Scope Change` | – | Already canonical, no change |
| `Requirement / Scope Change` | 1 / 1 | `Requirement or Scope Change` | Mechanical | Legacy table; slash vs "or" |
| `Design/Visual` | 2 / – | `null` (+ needs_review) | Cross-field | Issue Category value (and being removed from Jira). Per pollution rule: null + needs_review. Original preserved in audit_log notes. |
| `CRO Implementation` | 1 / – | `null` (+ needs_review) | Cross-field | Issue Category canonical value mistakenly stored in root_cause. Per pollution rule. |
| `CRO Code` | 1 / – | `CRO Code Error` | Semantic | + needs_review. Ambiguous: could be `CRO Code Error` or `Experiment Setup Error` from a one-word free-text edit. Default to `CRO Code Error` (the broader canonical) and flag. **DC TO CONFIRM.** |
| `CRO Code Error` | 1 / 2 | `CRO Code Error` | – | Already canonical, no change |
| `Client Code` | 1 / – | `Client Side Code Issue` | Semantic | + needs_review. Ambiguous between root_cause `Client Side Code Issue` and Issue Category `Client Website Code`. Default to root_cause canonical since this row landed in root_cause_final. **DC TO CONFIRM.** |
| `Client Code / Backend Error` | 1 / 1 | `Client Side Code Issue` | Mechanical | Legacy table; direct rename |
| `Data / Mapping Issue` | 1 / 2 | `Client Data / Feed Issue` | Mechanical | Legacy table; direct rename |
| `Process Gap` | 1 / – | `Process Gap` | – | Already canonical, no change |
| `QA Gap` | 1 / 2 | `QA Gap` | – | Already canonical, no change |
| `Unknown / Needs Investigation` | – / 2 | `Unknown / Needs Investigation` | Mechanical | Re-added to Jira per §6. Direct match. |

**Population summary (Field 2):**
- 19 distinct variants across the two fields (49 row-occurrences
  in `root_cause_final`, 41 in `root_cause_initial`)
- 6 already-canonical variants (no change): `Client Request`,
  `Requirement or Scope Change`, `CRO Code Error`,
  `Process Gap`, `QA Gap`, `Unknown / Needs Investigation`
- 9 mechanical map (legacy table or direct rename)
- 2 Interpretation C defaults with needs_review:
  `Missing / Miscommunicated Info` family (15 + 12 = 27
  occurrences), `Process / QA Gap` family (3 occurrences)
- 2 cross-field pollution null-outs with needs_review:
  `Design/Visual` (2), `CRO Implementation` (1)
- 2 semantic single-row flags with needs_review:
  `CRO Code` (1), `Client Code` (1) — **DC review of
  defaults before run**

### Legacy "Root Cause - Final" → Jira translation

Sourced from CSV.

| Legacy value | Jira canonical | Reasoning |
|--------------|----------------|-----------|
| Client Code / Backend Error | Client Side Code Issue | Direct rename |
| CRO Code / Configuration Error | CRO Code Error | Direct match (Experiment Setup Error is the alternative if the issue was setup/config, not code — needs per-row read) |
| Data / Mapping Issue | Client Data / Feed Issue | Direct rename |
| Requirement / Scope Change | Requirement or Scope Change | Direct rename |
| Missing / Miscommunicated Info | Missing Assets / Info | Default per Interpretation C; needs_review flag set |
| Environment / External Factors | External Factor / Environment Change | New canonical option mirrors legacy concept |
| Process / QA Gap | Process Gap | Default per Interpretation C; needs_review flag set |
| Unknown / Needs Investigation | Unknown / Needs Investigation | Direct match (re-added to Jira) |
| External Dependency Change | External Factor / Environment Change | Conceptually same as legacy "Environment / External Factors"; new canonical absorbs both |

**Note — "CRO - Frontend Issue" (11 occurrences in audit):**
This is a legacy "Type of Issue" string that appears to have
been mistakenly stored in `root_cause_final` (cross-field
pollution from CSV import). Per the cross-field pollution
rule: null out `root_cause_final`, log the original value in
audit_log notes, set needs_review = TRUE. Lacey assesses each
row's notes to recover the actual root cause if possible.

---

## Field 3: `issue_subtype` (Jira customfield_12904)

### Canonical Jira options (29 after additions)

```
Existing 26 (locked, no changes):
  Javascript Error · CSS / Styling Issue · Layout Broken ·
  Element Not Loading · Content Missing · Page Flash / Flicker ·
  Variation Not Rendering · Event Not Firing ·
  Incorrect Event Values · Experiment Trigger not Firing ·
  Duplicate Event · Incorrect Traffic Allocation ·
  Variant Assignment Issue · Data Mismatch · Visual Overlap ·
  Mobile / Responsive Issue · Device Targeting Issue ·
  Location Targeting Issue · Audience Condition Issue ·
  Cookie / Session Logic Issue · Client Frontend Conflict ·
  Client Backend Issue · CMS Conflict · Data Mapping Issue ·
  Product / Service Data Missing · Feed Update Error ·
  Vendor Script Conflict · API Failure · External Tool Change ·
  Requirements Unclear · Missing Requirements ·
  Change not Communicated · Incorrect Instructions ·
  Missing Assets · Missing Access / Credentials

Added (post-Phase-1, ship day):
  Browser Update
  Network / CDN Issue
  OS or Device Update
```

### Variant → canonical mapping

Populated 2026-05-20 by Claudette from audit query 4
(`docs/root-cause-audit-2026-05-20.md` §2.4). As predicted in
DC's draft, this field has near-zero drift. Only 3 distinct
values across 3 rows; all are clean post-Phase-1 system writes.

| Variant in database | Occurrences | Maps to | Confidence | Notes |
|---------------------|-------------|---------|------------|-------|
| `API Failure` | 1 | `API Failure` | – | Already canonical, no change |
| `Change not Communicated` | 1 | `Change not Communicated` | – | Already canonical, no change |
| `CSS/ Styling Issue` | 1 | `CSS / Styling Issue` | Mechanical (spacing) | DB stores `CSS/ Styling` (no space before slash, Jira's current live spelling); doc canonical is `CSS / Styling Issue` (spaces both sides). **DC TO CONFIRM** whether this row gets rewritten to the doc-spaced form, or whether the taxonomy seed adopts Jira's exact verbatim spelling. See spacing open question in §"Population notes" below. |

**Population summary (Field 3):**
- 3 distinct variants across 3 row-occurrences
- 2 already-canonical (no change)
- 1 spacing mismatch — **policy question pending DC review**
  (this is the same call as Issue Category `Process/ Communication`
  → `Process / Communication` etc. — needs to be made consistently
  across all four fields)

---

## Field 4: `resolution_type` (Jira customfield_12908)

### Canonical Jira options (9, no changes from previous)

```
CRO Code Fix
Experiment Configuration Update
Analytics Tracking Fix
Design Adjustment
Client Code Fix
Client Data Fix
Process Improvement
Documentation Update
No Fix Needed
```

### Variant → canonical mapping

Populated 2026-05-20 by Claudette from audit query 5
(`docs/root-cause-audit-2026-05-20.md` §2.5). As predicted,
zero drift. Field locked.

| Variant in database | Occurrences | Maps to | Confidence | Notes |
|---------------------|-------------|---------|------------|-------|
| `CRO Code Fix` | 1 | `CRO Code Fix` | – | Already canonical, no change |
| `Design Adjustment` | 1 | `Design Adjustment` | – | Already canonical, no change |

**Population summary (Field 4):**
- 2 distinct variants across 2 row-occurrences
- 2 already-canonical (no change)
- Zero drift; no normalization work needed for this field

---

## Cross-field pollution recovery rules

When normalization detects a value in the wrong field, the
script:

1. Sets the target field to `null`
2. Writes an `audit_log` entry with:
   - `field_name` = the polluted field
   - `old_value` = the misplaced value
   - `new_value` = `null`
   - `notes` = `"Cross-field pollution: '<value>' belongs in
     '<correct_field>'. Original value preserved here for
     forensic recovery. needs_review = TRUE."`
3. Sets `quality_logs.needs_review = TRUE`
4. Does NOT auto-write the correct field — Lacey decides
   per-row whether the misplaced value should populate the
   correct field or be dropped entirely

This prevents the normalization from making a second guess on
top of a first guess.

---

## Open questions remaining for Lacey

1. ~~**Variant table population.**~~ Populated 2026-05-20 by
   Claudette. See per-field tables above.

2. **`CRO - Frontend Issue` (11 occurrences).** ~~Cross-field
   pollution?~~ Resolved by the audit: this variant appeared
   in `issue_category` (Q3), not in `root_cause_final`, so
   the legacy table's `→ CRO Implementation` mapping applies
   cleanly. The pollution-rule case mentioned in §Field 2's
   note doesn't apply to these 11 rows because they're in the
   right field. Field 2's pollution rule still applies if any
   `CRO - Frontend Issue` row ever shows up in root_cause; the
   audit found none.

3. **Process Gap default for ambiguous rows.** Default to
   `Process Gap` per DC's existing draft, with `needs_review`
   flag set so Lacey reclassifies per-row. 3 total occurrences
   (`Process / QA Gap` x2 in final, x1 in initial) — small
   enough that Lacey can review all of them in minutes.

---

## Population notes (Claudette, 2026-05-20)

Items I encountered while filling in the variant tables that
DC + Lacey should resolve before the normalization script
runs. Listed in priority order.

### N1 — DC TO CONFIRM: ambiguous single-row variants (Field 2)

Two variants in `root_cause_final` are single-occurrence and
not on the legacy translation table. Defaults applied but
flagged for review:

- **`CRO Code` (1 occurrence, 2026-05-11).** Likely a one-word
  free-text edit via the unconstrained dialog. Plausibly maps
  to either `CRO Code Error` (broader) or `Experiment Setup
  Error` (if the issue was setup/config rather than code). I
  defaulted to `CRO Code Error` since the legacy translation
  for the `CRO Code / Configuration Error` family lands there,
  and flagged `needs_review = TRUE`. If DC prefers
  `Experiment Setup Error` as the default — or wants to
  null-out + needs_review instead — say so.

- **`Client Code` (1 occurrence, 2026-05-19).** Likely a
  one-word free-text edit. Could mean root_cause
  `Client Side Code Issue` (most natural reading), Issue
  Category `Client Website Code` (cross-field pollution), or
  something else. I defaulted to `Client Side Code Issue`
  since the value landed in root_cause_final and flagged
  `needs_review = TRUE`. If DC prefers null-out + needs_review,
  say so.

Both have audit_log timestamps from the system era (2026-05),
so they came through the admin edit dialog rather than CSV
import. The needs_review flag will surface them to Lacey
naturally in the new worklist UI.

### N2 — DC + Lacey: spacing normalization policy

DC's docs use the spaced form `X / Y` (e.g., `Process /
Communication`, `Client Data / Feed`, `CSS / Styling Issue`),
but Jira's current option strings use the unspaced-before-slash
form `X/ Y` (e.g., `Process/ Communication`, `CSS/ Styling
Issue`, `Design/ Visual`, `Page Flash/ Flicker`,
`Mobile/ Responsive Issue`).

Per §13 rule 28 (verbatim brand strings), `quality_logs`
values are sourced verbatim from Jira's option strings. Two
options:

**Policy A — Taxonomy matches Jira's live spelling.** Seed
the taxonomy table with `X/ Y` strings exactly as Jira returns
them. Future webhook + sync writes pass validation without
re-string-rewriting. Doc canonical lists become the
"intent" version; taxonomy stores the live string.

**Policy B — Jira renames to match doc spelling.** Add the
spacing-normalization to the §6 Jira change list:
`Process/ Communication` → `Process / Communication`, etc.
Taxonomy seed uses the doc spelling. Re-fetch the Jira
option list after Lacey renames to confirm before seeding.

Policy A is lower-risk (no Jira changes needed beyond §6's
existing list). Policy B is more aesthetic but adds Jira-side
work and a re-fetch step before the migration ships.
**Recommend Policy A** for this batch; if DC wants Policy B,
add the renames to §6 and re-run the audit's Jira-options
fetch before I seed.

This affects the `CSS/ Styling Issue` row in Field 3
(spacing-mismatch flag) and the `Process/Communication
Issue` mapping in Field 1 (the no-space variant in audit
is a casing difference, not pollution — but the canonical
to map TO depends on which policy we pick).

### N3 — DC: canonical-count inconsistencies in source docs

While populating, I noticed a few internal counting
inconsistencies in DC's draft and §6 of the Option B
directive. Not blocking my work; flagging for cleanup before
shipping:

- **Field 1 Issue Category** — section header says "10 after
  cleanup" and the bullet list shows 10 items ✓. Matches §6
  ("final 10"). Matches qa-field-reference.md (10 items in
  the table). **OK.**

- **Field 2 Root Cause** — section header says "13 after
  cleanup" and the bullet list shows 14 (9 existing kept + 5
  added). §6 says "final 13" (9 - 1 + 5 = 13 ✓ matches §6
  math). qa-field-reference.md table has 14 entries (matches
  the bullet list, not the header). Possibly the doc's header
  "13" is the final count after the "Missing or
  Miscommunicated Information" removal, while the bullet
  list above accidentally still includes it (it's listed
  under "Removed" but the math is off by one). **Recommend:**
  DC reconciles to 13 or 14. The mapping I produced treats
  the audit's `Missing or Miscommunicated Information` rows
  as already-removed (mapping to `Missing Assets / Info`
  with needs_review), consistent with §6.

- **Field 3 Issue Subtype** — section header says "29 after
  additions" and the bullet list itemizes 35 "Existing"
  entries + 3 "Added" = 38. qa-field-reference.md tables
  total 38 entries. §6 says "final 29" but lists 3 additions
  with 0 removals (starting from a baseline of 35 in my
  pre-change Jira fetch, that yields 38, not 29). Either
  (a) the "29" / "26" labels are stale from an earlier draft
  and the canonical count is actually 38, or (b) some
  removals are implied but not listed in §6. **Recommend:**
  DC clarifies. The mapping I produced doesn't depend on
  this — Field 3 has zero drift in the data, so the
  variant table is trivial. But the taxonomy seed count
  has to match reality.

- **Field 4 Resolution Type** — 9 in all sources ✓. **OK.**

### N4 — Heads-up: `Browser Update` and friends won't appear in legacy audit data

The 3 new Issue Subtype options (`Browser Update`,
`Network / CDN Issue`, `OS or Device Update`) and the 5 new
Root Cause options (`Unknown / Needs Investigation`,
`External Factor / Environment Change`, `Missing Assets /
Info`, `Unclear / Conflicting Requirements`, `Late Assets /
Info`) are post-Phase-1 additions. They WILL appear in
qa-field-reference.md and in the taxonomy seed, but won't
show up in the variant tables above because no historical
row has them yet. Listing here only to confirm this is
expected (not an audit gap).

---

## Implementation contract

The normalization script reads this doc programmatically
(or, more practically, ingests a hand-validated TypeScript
mapping object that mirrors these tables). The script:

- Is idempotent (re-running produces zero changes)
- Writes one `audit_log` row per changed field per quality_log
- Sets `needs_review = TRUE` on rows where the mapping was
  auto-defaulted rather than mechanical
- Logs unmatched values to console.error and skips them
  (does not silently drop)
- Reports a summary at completion: rows changed, rows flagged
  for review, rows skipped

---

*Last updated: 2026-05-20 | Variant tables populated by Claudette; open questions N1-N4 await DC + Lacey review*
