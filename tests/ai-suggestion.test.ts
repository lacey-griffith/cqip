import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFIDENCE_BAND_LABEL,
  isPrimaryRulingDisabled,
  isRulingBlocked,
  proseBlocks,
  rulingWriteValues,
  suggestionAction,
} from '../lib/logs/ai-suggestion';

// Batch logs-page — Part C (AI suggestion strip).
// Spec: docs/HANDOFF-logs-page-batch.md §3 C1–C4, plus the classifier spec's §6
// (outcome shapes), §13.1 (confirm must not destroy) and §13.2 (one writer).

function src(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

const DIALOG = src('components/logs/edit-log-dialog.tsx');
const PAGE = src('app/dashboard/logs/page.tsx');

// ── C4 — which outcome a click files ──
//
// This matters beyond UI tidiness: §6 makes the outcome shape the batch's ONLY
// validation, so a correction filed as a confirm reports the classifier as exactly
// right on a row where the human changed the answer.

// ⚠ THE COMPARAND IS THE PRISTINE SNAPSHOT, NOT THE SUGGESTION.
//
// The first version of these tests asserted `suggestionAction(['QA Gap'], [])` is
// 'correct' — "clearing the field is a correction" — which is true in the abstract
// and FALSE for the only reachable state, where `[]` is the row's PRISTINE value
// and nothing has been cleared. That test locked in Karen CRITICAL-1: applying the
// fix made it fail. A test that has to be deleted to make the code correct was
// never testing the right question.

test('an UNTOUCHED selection files confirm — the only reachable opening state', () => {
  // §13.6 selection admits only rows whose root_cause_final is null or '{}', so
  // the dropdown opens EMPTY on every eligible row. This is the case the whole
  // feature runs through.
  assert.equal(suggestionAction([], []), 'confirm');
  // And the sync-moved case, where the row already carries a value.
  assert.equal(suggestionAction(['QA Gap'], ['QA Gap']), 'confirm');
});

test('any edit away from the pristine value files correct', () => {
  assert.equal(suggestionAction(['QA Gap'], []), 'correct', 'picking a value on an empty row');
  assert.equal(suggestionAction([], ['QA Gap']), 'correct', 'clearing a populated row');
  assert.equal(suggestionAction(['A', 'B'], ['A']), 'correct', 'adding');
  assert.equal(suggestionAction(['A'], ['A', 'B']), 'correct', 'removing');
});

test('reordering files correct — array order persists in Postgres', () => {
  assert.equal(suggestionAction(['A', 'B'], ['B', 'A']), 'correct');
});

test('the suggestion is NOT a comparand — the signature cannot see it', () => {
  // Regression pin for CRITICAL-1. The decision is "has the human touched the
  // field", and only the pristine value answers it. If a future edit reintroduces
  // the suggestion as an argument, this arity check fails first.
  assert.equal(suggestionAction.length, 2, 'suggestionAction takes (current, pristine) only');
});

// ── The other half of CRITICAL-1: an empty correction is a rejection ──

test('the primary button is disabled when there is no suggestion to act on', () => {
  assert.equal(isPrimaryRulingDisabled('confirm', [], []), true);
  assert.equal(isPrimaryRulingDisabled('correct', ['QA Gap'], []), true);
});

test('a correction that clears the field is BLOCKED, not filed as a correction', () => {
  // classifyReviewOutcome checks `confirmed.length === 0` FIRST and returns
  // 'rejected', so a button reading "Save correction" would file a rejection.
  //
  // ⚠ HONEST LIMIT: this branch is NOT reachable in the shipped UI. With the
  // pristine snapshot as comparand, an empty selection can only be a `correct`
  // when the pristine value was non-empty — and `isRulingBlocked` already disables
  // the button in that state. Tested as a contingent guard, not a live one: it
  // becomes the sole protection if the route's §13.1 re-check is ever loosened to
  // permit `correct` on a populated row, which is an open Lacey decision.
  assert.equal(isPrimaryRulingDisabled('correct', [], ['QA Gap']), true);
});

test('a real confirm or a real correction is enabled', () => {
  assert.equal(isPrimaryRulingDisabled('confirm', [], ['QA Gap']), false, 'untouched confirm');
  assert.equal(isPrimaryRulingDisabled('correct', ['Late Assets/ Info'], ['QA Gap']), false);
});

// ── §13.1 — when a ruling is blocked ──

test('a ruling is blocked only when a root cause is already saved', () => {
  assert.equal(isRulingBlocked(null), false);
  assert.equal(isRulingBlocked([]), false);
  assert.equal(isRulingBlocked(['QA Gap']), true);
});

// ── C3 — the prose ──

test('prose blocks are labelled, ordered, and trimmed', () => {
  const blocks = proseBlocks({
    issue_details: '  details  ',
    resolution_notes: 'resolution',
    notes: 'note',
  });
  assert.deepEqual(blocks, [
    { label: 'Resolution notes', value: 'resolution' },
    { label: 'Notes', value: 'note' },
    { label: 'Issue details', value: 'details' },
  ]);
});

test('empty and whitespace-only prose is dropped, not rendered as a blank block', () => {
  // A labelled block with nothing under it reads as a fault rather than absence —
  // the same defect shape as the Pulse note marker promising content it did not have.
  assert.deepEqual(proseBlocks({ issue_details: null, resolution_notes: '   ', notes: '' }), []);
  assert.deepEqual(proseBlocks({ issue_details: null, resolution_notes: null, notes: 'only' }), [
    { label: 'Notes', value: 'only' },
  ]);
});

// ── §11.2 — the band is never a number ──

test('the band labels are exactly the three CHECK-constrained values', () => {
  assert.deepEqual(Object.keys(CONFIDENCE_BAND_LABEL).sort(), ['high', 'low', 'medium']);
  for (const label of Object.values(CONFIDENCE_BAND_LABEL)) {
    assert.ok(/^(High|Medium|Low) confidence$/.test(label), `${label} must not carry a number`);
    assert.ok(!/\d/.test(label), 'a rendered digit is a threshold waiting to happen');
  }
});

// ── C1 — the queue is gone ──

test('nothing references the retired review queue', () => {
  for (const rel of ['app/dashboard/reports/page.tsx']) {
    const s = src(rel);
    assert.ok(!/AiReviewQueue/.test(s), `${rel} still references AiReviewQueue`);
    assert.ok(!/ai-review-queue/.test(s), `${rel} still imports ai-review-queue`);
  }
  // LOW-2 (Karen): assert.throws(fn, string) treats the string as `message`, not
  // a matcher, so it only asserted that SOMETHING threw. An explicit existence
  // check says what is actually meant.
  assert.equal(
    existsSync(join(process.cwd(), 'components/reports/ai-review-queue.tsx')),
    false,
    'the queue component must be deleted, not merely unmounted',
  );
});

// ── C4's last row — the one that is "a test, not a comment" ──
//
// The dialog now holds the AI fields in scope, which it never did before. That
// makes it newly possible to include one in the payload sent to /api/logs/edit —
// and doing so would clear the flag on a general save, which is precisely the
// behaviour ai_review_pending exists as a separate column to prevent (classifier
// §4). The classifier suite asserts the ROUTE never touches the column; this
// asserts the CALLER never asks it to.

test('the edit dialog never sends an ai_* field to /api/logs/edit', () => {
  const start = DIALOG.indexOf('const updates = {');
  assert.ok(start > 0, 'could not locate the updates literal');
  const updates = DIALOG.slice(start, DIALOG.indexOf('};', start));
  assert.ok(!/ai_review_pending/.test(updates), 'a general save must not clear ai_review_pending');
  assert.ok(!/ai_suggested_root_cause/.test(updates), 'a general save must not touch the suggestion');
  assert.ok(!/ai_confidence_band/.test(updates), 'a general save must not touch the band');
});

test('the ruling posts to the ai-review route, never to the edit route', () => {
  const start = DIALOG.indexOf('async function handleRuling');
  assert.ok(start > 0);
  const fn = DIALOG.slice(start, DIALOG.indexOf('\n  }', DIALOG.indexOf('finally', start)));
  assert.ok(/'\/api\/admin\/logs\/ai-review'/.test(fn), 'must post to the ai-review route');
  assert.ok(!/'\/api\/logs\/edit'/.test(fn), 'the ruling must not go through the edit route');
});

test('only the correct action carries values', () => {
  assert.ok(
    /action === 'correct' \? \{ values: rootCauseFinal \} : \{\}/.test(DIALOG),
    'values must be sent for correct only',
  );
});

// ── Karen CRITICAL-2 — the local mirror must equal what the ROUTE writes ──
//
// ⚠ THIS REPLACES A REGEX THAT PINNED THE WHOLE EXPRESSION
// (`action === 'reject' ? log.root_cause_final : rootCauseFinal`) AND SO LOCKED IN
// A DEFECT. It was written to protect the REJECT branch, and it did — but by
// asserting the entire ternary it also froze the CONFIRM branch, which was wrong.
// A regex over source cannot distinguish the part you meant to protect from the
// part that is broken beside it. **Second time in two rounds** that a test of mine
// pinned a defect; both times the fix was to test BEHAVIOUR through a pure
// function instead of matching the source that produces it.

const LOG = (suggested: string[] | null, persisted: string[] | null) => ({
  ai_suggested_root_cause: suggested,
  root_cause_final: persisted,
});

test('confirm writes the SUGGESTION, not the dropdown selection', () => {
  // The live path: selection is empty (§13.6 guarantees it) and the route writes
  // `confirmedValues = suggested`. Mirroring the selection here is what erased
  // confirmed data with no audit row.
  assert.deepEqual(rulingWriteValues('confirm', LOG(['Client Request'], null), []), ['Client Request']);
  // Even when the dropdown holds something else, confirm still files the suggestion
  // — the route does not look at the selection on this action.
  assert.deepEqual(rulingWriteValues('confirm', LOG(['A'], null), ['B']), ['A']);
  // A null suggestion coerces to [] rather than throwing.
  assert.deepEqual(rulingWriteValues('confirm', LOG(null, null), ['B']), []);
});

test('correct writes the human selection', () => {
  assert.deepEqual(rulingWriteValues('correct', LOG(['A'], null), ['B']), ['B']);
});

test('reject leaves the persisted value untouched', () => {
  assert.deepEqual(rulingWriteValues('reject', LOG(['A'], null), ['B']), null);
  assert.deepEqual(rulingWriteValues('reject', LOG(['A'], ['C']), ['B']), ['C']);
});

test('the three parameters have three DISTINCT types, so a swap cannot type-check', () => {
  // Karen MEDIUM-1: the previous four-positional-parameter shape had two adjacent
  // `readonly string[]`, and transposing them reintroduced CRITICAL-2 with every
  // gate green. Arity is pinned here; the type distinctness is enforced by tsc.
  assert.equal(rulingWriteValues.length, 3, 'action, log, selection — no extracted arrays');
});

test('the dialog derives all three local writes from rulingWriteValues', () => {
  assert.ok(/const persistedRootCause = rulingWriteValues\(action, log, rootCauseFinal\)/.test(DIALOG));
  // The snapshot and the dropdown must move to the SAME value, or Part A's guard
  // prompts on close for a value the server already holds.
  assert.ok(/const written = persistedRootCause \?\? \[\];/.test(DIALOG));
  assert.ok(/setRootCauseFinal\(written\)/.test(DIALOG));
  assert.ok(/setSnapshot\(prev => \(\{ \.\.\.prev, rootCauseFinal: written \}\)\)/.test(DIALOG));
  // The hardcoded mirror must not come back.
  assert.ok(
    !/action === 'reject' \? log\.root_cause_final : rootCauseFinal/.test(DIALOG),
    'the hardcoded mirror is CRITICAL-2',
  );
});

test('the snapshot moves with the ruling, and ONLY that field', () => {
  // Otherwise the dismiss guard counts a value the server already holds as an
  // unsaved edit and prompts on every close after a ruling.
  //
  // Asserted as a spread-plus-one-key shape rather than an exact expression: the
  // value it carries is pinned behaviourally by the rulingWriteValues tests above,
  // and pinning the whole expression here is what froze the CRITICAL-2 defect.
  const patch = /setSnapshot\(prev => \(\{ \.\.\.prev, rootCauseFinal: (\w+) \}\)\)/.exec(DIALOG);
  assert.ok(patch, 'the snapshot patch must spread prev and set exactly rootCauseFinal');
  assert.equal(patch[1], 'written', 'it must carry what the route wrote, not the raw selection');
});

test('onSaved spreads the persisted log and leaks NO form state', () => {
  // Spreading form state would push the admin's still-unsaved edits to other
  // fields into the parent table as though they had been written.
  //
  // ⚠ ASSERTED AS AN ABSENCE, NOT A PRESENCE. The first version checked only that
  // `...log,` appeared — and a mutation that KEPT the spread and appended
  // `...{ notes: notes }` beside it passed. Presence of the right thing does not
  // exclude the wrong thing sitting next to it.
  //
  // ⚠ HONEST LIMIT (Karen MEDIUM-1): this bans the nine variable NAMES appearing
  // literally in the call. It cannot see a value laundered through an alias —
  // `const x = notes;` then `notes: x` survives it, proven by mutation. One such
  // alias exists deliberately (`persistedRootCause`, which IS `rootCauseFinal`)
  // and is asserted separately below. So this narrows the hole rather than closing
  // it; closing it needs dataflow analysis this repo has no harness for.
  const start = DIALOG.indexOf('onSaved({');
  assert.ok(start > 0);
  const call = DIALOG.slice(start, DIALOG.indexOf('});', start));
  assert.ok(/\.\.\.log,/.test(call), 'must spread the persisted log');

  const FORM_STATE = [
    'logStatus',
    'severity',
    'whoOwnsFix',
    'issueCategory',
    'issueSubtype',
    'rootCauseFinal',
    'resolutionType',
    'resolutionNotes',
    'notes',
  ];
  for (const name of FORM_STATE) {
    assert.ok(
      !new RegExp(`\\b${name}\\b`).test(call),
      `onSaved must not reference the form state variable \`${name}\` — only what the route wrote`,
    );
  }
});

// ── C2 — the chip ──

test('the AI chip filters on ai_review_pending and shares the B5 visibility rule', () => {
  assert.ok(/if \(aiReviewFilter && !log\.ai_review_pending\) return false;/.test(PAGE));
  assert.ok(/shouldShowReviewChip\(aiReviewCount, aiReviewFilter\)/.test(PAGE));
});

test('the strip is gated on a pending review, not merely on a suggestion existing', () => {
  // A suggestion with the flag already cleared has been ruled on; re-offering
  // Confirm would let a settled row be re-decided and would re-file an outcome.
  assert.ok(
    /log\?\.ai_review_pending \? log\.ai_suggested_root_cause \?\? \[\] : null/.test(DIALOG),
  );
});

test('the strip renders a band label, never the raw confidence score', () => {
  assert.ok(!/ai_confidence_score/.test(DIALOG), 'the raw score must never reach the UI');
  assert.ok(/CONFIDENCE_BAND_LABEL\[log\.ai_confidence_band\]/.test(DIALOG));
});

// ── Karen MEDIUM-2 — nothing pinned the wiring or the label, which is what let
// CRITICAL-1 through. suggestionAction was well tested in isolation; its USE was
// not, so a hardcoded `primaryRuling` and a hardcoded label both survived mutation.

test('primaryRuling is computed from the PRISTINE snapshot, not hardcoded', () => {
  assert.ok(
    /const primaryRuling = suggestionAction\(rootCauseFinal, snapshot\.rootCauseFinal\)/.test(DIALOG),
    'the action must be derived from the selection vs the snapshot',
  );
  // The CRITICAL-1 shape specifically: the suggestion must not be the comparand.
  assert.ok(
    !/suggestionAction\(suggestion/.test(DIALOG),
    'comparing against the suggestion is the CRITICAL-1 defect',
  );
});

test('the button label is derived from primaryRuling, both branches present', () => {
  assert.ok(/primaryRuling === 'confirm'\s*\?\s*'Confirm suggestion'/.test(DIALOG));
  assert.ok(/:\s*'Save correction'/.test(DIALOG));
});

test('the primary button consults isPrimaryRulingDisabled', () => {
  // Without this the empty-correction path is clickable and files a rejection
  // under a button reading "Save correction".
  assert.ok(/const primaryDisabled = /.test(DIALOG));
  assert.ok(/isPrimaryRulingDisabled\(primaryRuling, rootCauseFinal, suggestion\)/.test(DIALOG));
  assert.ok(/disabled=\{rulingBusy \|\| saving \|\| rulingBlocked \|\| primaryDisabled\}/.test(DIALOG));
});

test('a successful ruling records an outcome, and only in handleRuling', () => {
  // Karen HIGH-1. Also pins that handleSave does NOT set it — an earlier edit of
  // mine matched both onSaved call sites and wired this into the general save,
  // where it would have claimed a review outcome for an ordinary row edit.
  assert.equal(
    (DIALOG.match(/setRuledOutcome\(typeof body\?\.outcome/g) ?? []).length,
    1,
    'exactly one writer, in handleRuling',
  );
  const saveStart = DIALOG.indexOf('async function handleSave');
  const saveFn = DIALOG.slice(saveStart);
  assert.ok(
    !/setRuledOutcome\(typeof/.test(saveFn.slice(0, saveFn.indexOf('\n  return'))),
    'handleSave must not record a ruling outcome',
  );
});

// ── Label associations (Lacey's ask, plus the wider finding) ──
//
// The audit is written as a KNOWN-ORPHAN allowlist rather than a spot check, so it
// fails three ways: a new orphaned label appears, a fixed one is not removed from
// the list, or clientBrand regresses. It is the check that would have caught the
// original defect.

const KNOWN_ORPHANS: Record<string, string[]> = {
  // Pre-existing, outside this batch's diff, recorded in CLAUDE.md §15. These
  // point at <Select> blocks whose SelectTrigger carries no id.
  'app/dashboard/reports/page.tsx': [
    'issueCategory',
    'rootCauseFinal',
    'severity',
    'status',
    'testType',
    'whoOwnsFix',
  ],
  'app/dashboard/logs/page.tsx': [],
};

for (const [rel, expected] of Object.entries(KNOWN_ORPHANS)) {
  test(`label associations in ${rel} match the known-orphan list exactly`, () => {
    const s = src(rel);
    const labels = [...s.matchAll(/htmlFor="([^"]+)"/g)].map(m => m[1]);
    const orphans = [...new Set(labels.filter(h => !s.includes(`id="${h}"`)))].sort();
    assert.deepEqual(
      orphans,
      [...expected].sort(),
      `orphaned <Label htmlFor> values changed in ${rel} — fix the label or update KNOWN_ORPHANS`,
    );
  });
}

test('clientBrand is associated on BOTH pages — the id threads through BrandSelector', () => {
  for (const rel of ['app/dashboard/logs/page.tsx', 'app/dashboard/reports/page.tsx']) {
    assert.ok(/id="clientBrand"/.test(src(rel)), `${rel} must pass id to BrandSelector`);
  }
  assert.ok(/id\?: string;/.test(src('components/filters/brand-selector.tsx')));
  // And it must actually reach the DOM, not merely be accepted as a prop.
  assert.ok(/id=\{id\}/.test(src('components/ui/combobox.tsx')), 'Combobox must render the id');
});
