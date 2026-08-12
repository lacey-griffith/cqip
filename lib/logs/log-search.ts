// Free-text search for the Quality Logs filter bar.
//
// Spec: docs/HANDOFF-logs-page-batch.md §2 B1 — "free-text search across ticket
// key, ticket title, and brand. Client-side over already-loaded rows, consistent
// with the Pulse matrix controls pattern."
//
// Deliberately the SAME shape as lib/client-library/matrix-controls.ts
// `matchesSearch` (trim → lowercase → substring), extended from one field to
// three. Not a fuzzy match, not tokenised, not regex:
//
//   - Tokenising ("MRA copy" → all terms must hit) is a different contract and
//     the spec did not ask for it. Adding it silently would mean a query that
//     works on the Pulse matrix behaves differently here, on the same page furniture.
//   - Regex would let a user type `(` and get a thrown error instead of results.
//
// If multi-term is wanted later it is a deliberate change to this one function
// with its own tests, not an accident of implementation.

export interface SearchableLog {
  jira_ticket_id: string;
  jira_summary: string | null;
  client_brand: string | null;
}

// An empty or whitespace-only query matches EVERYTHING rather than nothing. This
// is the direction that matters: the search is AND-ed with every other filter, so
// returning false on an empty query would empty the table the moment the box is
// focused and cleared. It also keeps `activeFilterCount` honest — a blank box is
// not a filter.
export function matchesLogSearch(log: SearchableLog, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  if (log.jira_ticket_id.toLowerCase().includes(needle)) return true;
  if (log.jira_summary && log.jira_summary.toLowerCase().includes(needle)) return true;
  if (log.client_brand && log.client_brand.toLowerCase().includes(needle)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// B5 — when a review chip is rendered at all
// ---------------------------------------------------------------------------
//
// Spec §2 B5, resolved with Lacey 2026-08-12. Measured that day: BOTH review
// populations were zero (`needs_review` 0 rows, `ai_review_pending` 0 rows), so
// without a rule the filter bar carries two permanently-empty controls.
//
// THE `active` HALF IS THE LOAD-BEARING HALF, and it is why this is not simply
// `count > 0`. If a chip vanished the instant its count hit zero, then clearing
// the last flagged row WHILE FILTERED BY IT would remove the only control that
// can turn that filter off — leaving the user looking at an empty table with no
// way back except Reset, and no explanation. Keeping the chip while it is active
// also preserves the existing "All caught up — no reviews pending" state at
// app/dashboard/logs/page.tsx, which is written for exactly that moment.
//
// Shared by both chips on purpose: two chips with two visibility rules is how
// they drift into looking like they mean different things.
export function shouldShowReviewChip(count: number, isActive: boolean): boolean {
  return count > 0 || isActive;
}
