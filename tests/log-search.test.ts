import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesLogSearch, shouldShowReviewChip, type SearchableLog } from '../lib/logs/log-search';
import { brandOptionLabel } from '../lib/filters/brand-option';
import { matchesComboboxQuery } from '../lib/ui/combobox-filter';

// Batch logs-page — Part B (filter bar).
// Spec: docs/HANDOFF-logs-page-batch.md §2 B1, B2, B5.

const LOG: SearchableLog = {
  jira_ticket_id: 'NBLYCRO-1452',
  jira_summary: 'Hero copy reverted after client review',
  client_brand: 'MRA - Mr Appliance',
};

// ── B1 — search ──

test('an empty or whitespace query matches everything', () => {
  // The direction that matters: search is AND-ed with every other filter, so
  // returning false here would empty the table the moment the box is focused
  // and cleared.
  assert.equal(matchesLogSearch(LOG, ''), true);
  assert.equal(matchesLogSearch(LOG, '   '), true);
});

test('matches on ticket key, title, and brand — all three fields', () => {
  assert.equal(matchesLogSearch(LOG, 'NBLYCRO-1452'), true, 'ticket key');
  assert.equal(matchesLogSearch(LOG, 'hero copy'), true, 'title');
  assert.equal(matchesLogSearch(LOG, 'Appliance'), true, 'brand');
});

test('matching is case-insensitive and trimmed, like the Pulse precedent', () => {
  assert.equal(matchesLogSearch(LOG, '  nblycro-1452  '), true);
  assert.equal(matchesLogSearch(LOG, 'HERO'), true);
});

test('a substring of the ticket key matches — partial keys are the common case', () => {
  assert.equal(matchesLogSearch(LOG, '1452'), true);
});

test('a non-matching query matches nothing', () => {
  assert.equal(matchesLogSearch(LOG, 'zzzz'), false);
});

test('null summary and null brand do not throw and do not match', () => {
  const sparse: SearchableLog = { jira_ticket_id: 'SPLCRO-1', jira_summary: null, client_brand: null };
  assert.equal(matchesLogSearch(sparse, 'anything'), false);
  assert.equal(matchesLogSearch(sparse, 'SPLCRO'), true);
  assert.equal(matchesLogSearch(sparse, ''), true);
});

test('search is substring, NOT tokenised — recorded so a change is deliberate', () => {
  // "MRA copy" would match under an all-terms-must-hit rule. It does not here,
  // and that is the documented contract: the same query must behave the same way
  // on the Pulse matrix, which is single-substring.
  assert.equal(matchesLogSearch(LOG, 'MRA copy'), false);
});

// ── B2 — brand option label and search keywords ──

test('the brand label is code · display_name, using display_name not jira_value', () => {
  // The shipped defect: display_name was fetched and discarded, so the list read
  // "MRA - Mr Appliance" (Jira's spelling, no period) instead of the brand's own
  // "Mr. Appliance". The period is the tell.
  assert.equal(
    brandOptionLabel({ brand_code: 'MRA', display_name: 'Mr. Appliance' }),
    'MRA · Mr. Appliance',
  );
  assert.equal(
    brandOptionLabel({ brand_code: 'MRR-CA', display_name: 'Mr. Rooter Plumbing (CA)' }),
    'MRR-CA · Mr. Rooter Plumbing (CA)',
  );
});

test("the label separator is a middot, not the hyphen jira_value uses", () => {
  // Distinguishes the rendered label from the raw jira_value at a glance, which
  // is what makes a regression visible in a screenshot.
  const label = brandOptionLabel({ brand_code: 'MRA', display_name: 'Mr. Appliance' });
  assert.ok(label.includes(' · '));
  assert.ok(!label.includes(' - '));
});

test('combobox search matches the label AND the keywords', () => {
  // The live case this exists for: with label "MRA · Mr. Appliance", typing the
  // brand exactly as JIRA spells it — "Mr Appliance", no period — matches only
  // via keywords. Without it the user gets "No matching brand" for a brand that
  // is right there.
  const option = { value: 'MRA - Mr Appliance', label: 'MRA · Mr. Appliance', keywords: 'MRA - Mr Appliance' };
  assert.equal(matchesComboboxQuery(option, 'MRA'), true, 'code');
  assert.equal(matchesComboboxQuery(option, 'Mr. Appliance'), true, 'display name, with period');
  assert.equal(matchesComboboxQuery(option, 'Mr Appliance'), true, "Jira's spelling, no period");
  assert.equal(matchesComboboxQuery(option, 'Window'), false);
});

test('an option without keywords still matches on its label alone', () => {
  const sentinel = { value: '__all__', label: 'All brands' };
  assert.equal(matchesComboboxQuery(sentinel, 'all br'), true);
  assert.equal(matchesComboboxQuery(sentinel, ''), true);
  // And the sentinel VALUE is not searchable — matching `value` would make a
  // query of "all" hit on "__all__", a string no user typed. This is why the
  // opt-in keywords field exists instead of "also match value".
  assert.equal(matchesComboboxQuery({ value: '__zzz__', label: 'Nothing' }, 'zzz'), false);
});

// ── B5 — review chip visibility ──

test('a chip with work is shown; an empty inactive chip is hidden', () => {
  assert.equal(shouldShowReviewChip(3, false), true);
  assert.equal(shouldShowReviewChip(0, false), false);
});

test('an ACTIVE chip stays visible at zero — the anti-stranding rule', () => {
  // Clearing the last flagged row while filtered by it must not remove the only
  // control that can turn the filter off. This is the half of the rule that is
  // easy to drop and impossible to notice until someone is stuck.
  assert.equal(shouldShowReviewChip(0, true), true);
  assert.equal(shouldShowReviewChip(5, true), true);
});

// ── Page wiring ──
//
// The page cannot be rendered here (no React test infrastructure). These assert
// that the pure helpers above are actually CALLED — a correct predicate that
// nothing invokes is the failure mode these catch, and it is invisible to tsc,
// to ESLint and to every unit test above.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = readFileSync(join(process.cwd(), 'app/dashboard/logs/page.tsx'), 'utf8');

test('the logs page filters through matchesLogSearch', () => {
  assert.ok(/matchesLogSearch\(log, debouncedSearch\)/.test(PAGE), 'search is not wired into the filter');
  // The DEBOUNCED value, not the raw input: filtering on every keystroke re-runs
  // four chained memos over the full log set.
  assert.ok(!/matchesLogSearch\(log, search\)/.test(PAGE), 'search must filter on the debounced value');
});

test('the review chip renders through shouldShowReviewChip', () => {
  assert.ok(
    /shouldShowReviewChip\(needsReviewCount, needsReviewFilter\)/.test(PAGE),
    'the chip visibility rule is not applied',
  );
});

test('resetAllFilters clears BOTH search values', () => {
  const body = PAGE.slice(PAGE.indexOf('function resetAllFilters'));
  const fn = body.slice(0, body.indexOf('\n  }'));
  assert.ok(/setSearch\(''\)/.test(fn), 'Reset must clear the input');
  assert.ok(/setDebouncedSearch\(''\)/.test(fn), 'Reset must clear the debounced value too');
});

test('the logs query destructures its error', () => {
  // Before this batch it did not, so any failure rendered as an empty table
  // reading "No logs found for the selected filters."
  assert.ok(/const \{ data: logsData, error: logsError \}/.test(PAGE));
  assert.ok(/setLoadError\(logsError\.message\)/.test(PAGE));
});
