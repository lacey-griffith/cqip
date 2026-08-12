// Type-to-filter matching for components/ui/combobox.tsx.
//
// Spec: docs/HANDOFF-logs-page-batch.md §2 B2.
//
// Extracted to lib/ so it can be tested without loading the component tree. The
// filter IS the type-to-filter behaviour, and a false negative here reads to the
// user as "that option does not exist" — which is exactly how the shipped brand
// defect presented.

export interface ComboboxOption {
  value: string;
  label: string;
  /**
   * Extra text the filter should match, beyond the visible label.
   *
   * Exists because a label chosen to READ well and a string a user is likely to
   * TYPE are not the same string. The brand filter is the live case: the label is
   * `MRA · Mr. Appliance`, but Jira's own spelling — the one printed on the ticket
   * the user is looking at — is `MRA - Mr Appliance`, with no period. Matching the
   * label alone means typing what Jira shows you returns "No matching brand".
   *
   * Deliberately NOT "also match `value`": the brand filter's All-brands sentinel
   * is `__all__`, and matching values would make a query of "all" hit on a string
   * no user typed. An explicit opt-in field states what is searchable instead of
   * inferring it from an unrelated field.
   */
  keywords?: string;
}

// An empty query matches everything — the list should show all options before a
// user types, not none.
export function matchesComboboxQuery(option: ComboboxOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  if (option.label.toLowerCase().includes(needle)) return true;
  return option.keywords ? option.keywords.toLowerCase().includes(needle) : false;
}
