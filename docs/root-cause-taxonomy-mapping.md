# Root Cause + Taxonomy Field Mapping

**Date:** 2026-05-20
**Author:** DC + Lacey
**Status:** Draft — Lacey to review per-row mapping before
normalization runs
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

Populate the "Maps to" column for each row found in
production. The "Confidence" column indicates whether the
mapping is mechanical (obvious match) or semantic (requires
human judgment).

| Variant in database | Occurrences | Maps to                       | Confidence | Notes |
|---------------------|-------------|-------------------------------|------------|-------|
| `<pending audit data>` | – | – | – | Pull from Claudette's audit query 3 output |

**Pattern for filling in:**

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

| Variant in database | Occurrences | Maps to | Confidence | Notes |
|---------------------|-------------|---------|------------|-------|
| `<pending audit data>` | – | – | – | Pull from Claudette's audit queries 1 + 2 |

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

Per Claudette's audit, this field had zero drift in
post-Phase-1 data. Any historical drift comes from CSV import.
Likely few or none — but verify against audit query 4.

| Variant in database | Occurrences | Maps to | Confidence | Notes |
|---------------------|-------------|---------|------------|-------|
| `<pending audit data>` | – | – | – | Pull from Claudette's audit query 4 |

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

Per Claudette's audit, zero drift. Field locked.

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

1. **Variant table population.** This doc has placeholder rows
   for the variant → canonical mappings under each field.
   Once Claudette runs the audit queries with current data
   (already done in `docs/root-cause-audit-2026-05-20.md`),
   pull the exact distinct values into the tables and fill
   the "Maps to" column.

2. **`CRO - Frontend Issue` (11 occurrences).** Treat as
   cross-field pollution per the rule above? Or override and
   map directly to a Jira Root Cause (e.g., "CRO Code Error")?
   Recommend: pollution rule (null-out + needs_review).

3. **Process Gap default for ambiguous rows.** Some rows may
   genuinely warrant `Process Gap` and others `QA Gap` — both
   are correct in some context. Confirm: default to
   `Process Gap` and Lacey reclassifies, or sample-audit a
   few rows first to determine which is statistically more
   common?

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

*Last updated: 2026-05-20*
