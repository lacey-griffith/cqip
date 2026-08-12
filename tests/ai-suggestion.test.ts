import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFIDENCE_BAND_LABEL,
  isRulingBlocked,
  proseBlocks,
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

test('an untouched selection files confirm', () => {
  assert.equal(suggestionAction(['QA Gap'], ['QA Gap']), 'confirm');
  assert.equal(suggestionAction([], []), 'confirm');
});

test('any difference files correct', () => {
  assert.equal(suggestionAction(['QA Gap'], ['Late Assets/ Info']), 'correct');
  assert.equal(suggestionAction(['QA Gap'], []), 'correct', 'clearing the field is a correction');
  assert.equal(suggestionAction(['QA Gap'], ['QA Gap', 'Late Assets/ Info']), 'correct', 'adding');
  assert.equal(suggestionAction(['QA Gap', 'Late Assets/ Info'], ['QA Gap']), 'correct', 'removing');
});

test('reordering files correct — array order persists in Postgres', () => {
  assert.equal(
    suggestionAction(['QA Gap', 'Late Assets/ Info'], ['Late Assets/ Info', 'QA Gap']),
    'correct',
  );
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
  assert.throws(
    () => src('components/reports/ai-review-queue.tsx'),
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

test('reject does not write root_cause_final locally', () => {
  // Mirrors the route, which omits the key entirely on reject so it cannot be
  // written by accident. If this local mirror diverged, the table row would show a
  // value the database does not hold.
  assert.ok(
    /action === 'reject' \? log\.root_cause_final : rootCauseFinal/.test(DIALOG),
    'reject must leave root_cause_final at its persisted value',
  );
});

test('the snapshot moves with a confirmed root cause, and only that field', () => {
  // Otherwise the dismiss guard counts a value the server already holds as an
  // unsaved edit and prompts on every close after a ruling.
  assert.ok(/setSnapshot\(prev => \(\{ \.\.\.prev, rootCauseFinal \}\)\)/.test(DIALOG));
});

test('onSaved spreads the persisted log and leaks NO form state', () => {
  // Spreading form state would push the admin's still-unsaved edits to other
  // fields into the parent table as though they had been written.
  //
  // ⚠ ASSERTED AS AN ABSENCE, NOT A PRESENCE. The first version of this test
  // checked only that `...log,` appeared — and a mutation that KEPT the spread and
  // appended `...{ notes: notes }` beside it passed. Presence of the right thing
  // does not exclude the wrong thing sitting next to it; this is the weak-oracle
  // shape CLAUDE.md §15 records repeatedly, found here by mutation rather than by
  // reading.
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
