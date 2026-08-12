// Brand dropdown option formatting.
//
// Spec: docs/HANDOFF-logs-page-batch.md §2 B2.
//
// Lives in lib/ rather than beside the component for the same reason every other
// pure helper in this repo does: components/filters/brand-selector.tsx imports
// lib/supabase/client, which THROWS at module scope when the env vars are absent
// — so a test importing the component to reach one pure function cannot even load.
// Pure logic in lib/, components import it.
//
// ⚠ THIS FORMATS THE LABEL ONLY. The value a BrandSelector emits is still
// brands.jira_value verbatim, and that contract is load-bearing: §13 r28 has
// callers comparing it to quality_logs.client_brand by literal string equality,
// and Batch 005.25 normalised historical rows to match. Changing what is DISPLAYED
// must never change what is EMITTED.

export interface BrandOptionSource {
  brand_code: string;
  display_name: string;
}

// Before this batch the dropdown labelled every option with the raw jira_value,
// and display_name was fetched and thrown away. jira_value is Jira's internal
// string and drops the periods the display name carries — so the list read
// "MRA - Mr Appliance" for a brand whose own name is "Mr. Appliance".
//
// The separator is a middot, deliberately NOT the hyphen jira_value uses. It
// makes the rendered label distinguishable from the raw value at a glance, so a
// regression back to jira_value is visible in a screenshot rather than needing a
// character-level diff.
export function brandOptionLabel(brand: BrandOptionSource): string {
  return `${brand.brand_code} · ${brand.display_name}`;
}
