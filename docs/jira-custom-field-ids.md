# Jira Custom Field ID Mapping

**Relocated whole from `CLAUDE.md` on 2026-08-23** by the second extraction
pass, under §13 r41 remedy 3. **This file is live reference — it is NOT the
archive, and r40 does not apply to it.** CLAUDE.md keeps the section heading and
a pointer so existing `§7` citations still resolve.

---


**Source:** fusion92.atlassian.net

```typescript
// lib/jira/field-map.ts
export const JIRA_FIELD_MAP = {
  who_owns_fix:               'customfield_13120',  // Select List (cascading)
  detected_by:                'customfield_12910',  // User Picker (single)
  documentation_updated:      'customfield_12914',  // Checkboxes
  experiment_paused:          'customfield_12912',  // Checkboxes
  issue_category:             'customfield_12871',  // Select List (multiple)
  issue_subtype:              'customfield_12904',  // Select List (multiple)
  preventable:                'customfield_12911',  // Checkboxes
  process_improvement_needed: 'customfield_12913',  // Checkboxes
  reproducibility:            'customfield_12907',  // Select List (single)
  resolution_type:            'customfield_12908',  // Select List (multiple)
  root_cause:                 'customfield_12905',  // Select List (multiple)
  root_cause_description:     'customfield_12909',  // Paragraph (text)
  severity:                   'customfield_12906',  // Select List (single)
} as const;
```

Brand field is per-project (`projects.brand_jira_field_id`); no
longer in `JIRA_FIELD_MAP`. NBLYCRO uses `customfield_12220`;
SPLCRO is single-brand and reads no field. See §6 brand resolution
flow and §13 rule 28.

### Field Type Notes
- `who_owns_fix` is a **cascading select** — returns parent/child object.
  Extract: `field?.child?.value ?? field?.value ?? null`
- `detected_by` is a User Picker — extract: `field?.displayName ?? null`
- Checkbox fields return an array — check `field?.length > 0` for boolean conversion
- Multi-select fields return arrays of `{value, id}` objects — map to `value` strings
- Brand field (per-project, NBLYCRO uses `customfield_12220`) is a
  single select returning `{ value: "CODE - Display Name", id }` —
  e.g. `{ value: "MRA - Mr Appliance", id: "13743" }`. NOT cascading.
  The `quality_logs.client_brand` column stores the resolved brand
  row's `jira_value` verbatim (Option γ writeback per §13 rule 28).

---

