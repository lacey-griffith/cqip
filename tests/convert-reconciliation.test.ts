// Batch 012 — Convert reconciliation backfill. Tests the two pure helpers in
// scripts/backfill-convert-reconciliation.ts where a mistake would be SILENT
// and permanent (Karen post-flight, 2026-07-25):
//
//   classifyRow — decides apply / skip / drift. A misclassification either
//     skips a flip that was needed, or clobbers a hand-edit made after the
//     2026-07-25 reconciliation pass.
//   auditNote   — the audit row's note text. Until the Convert/Jira date sync
//     lands this trail is the only record of WHEN a cell resolved, so a wrong
//     note is unrecoverable after the fact.
//
// Everything else in that script is either reporting (visible on every run) or
// a guard that fails loudly, so it's exercised by the dry-run instead.
//
// Run: npx tsx --test tests/convert-reconciliation.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRow, auditNote } from '../scripts/backfill-convert-reconciliation';

// -------------------------------------------------------------------------
// classifyRow
// -------------------------------------------------------------------------

test('classifyRow: clean upgrade — live matches our_status → apply', () => {
  assert.equal(
    classifyRow({ liveStatus: 'todo', ourStatus: 'todo', suggestedStatus: 'done' }),
    'apply',
  );
});

test('classifyRow: clean downgrade — live matches our_status → apply', () => {
  assert.equal(
    classifyRow({ liveStatus: 'done', ourStatus: 'done', suggestedStatus: 'todo' }),
    'apply',
  );
});

test('classifyRow: already at target → skip (the idempotency guarantee)', () => {
  // The 6 real rows in this state on 2026-07-25 ([Rev] Time Spent on Site/
  // Financing) must not be written and must not be counted as changes.
  assert.equal(
    classifyRow({ liveStatus: 'done', ourStatus: 'todo', suggestedStatus: 'done' }),
    'skip',
  );
  // A downgrade that was already corrected by hand is likewise a no-op.
  assert.equal(
    classifyRow({ liveStatus: 'todo', ourStatus: 'done', suggestedStatus: 'todo' }),
    'skip',
  );
});

test('classifyRow: skip wins over drift when live already equals the target', () => {
  // Ordering matters. Live disagrees with our_status (which would otherwise
  // read as drift), but it already equals the target — the end state is right,
  // so this must be skip, never drift, and must never trigger a write.
  assert.equal(
    classifyRow({ liveStatus: 'done', ourStatus: 'blocked', suggestedStatus: 'done' }),
    'skip',
  );
});

test('classifyRow: live is a third value → drift (must not be silently overwritten)', () => {
  for (const liveStatus of ['in_progress', 'blocked', 'n_a']) {
    assert.equal(
      classifyRow({ liveStatus, ourStatus: 'todo', suggestedStatus: 'done' }),
      'drift',
      `live=${liveStatus} should be drift`,
    );
  }
});

test('classifyRow: an unknown/garbage live status is drift, never apply', () => {
  // Defensive: a value outside the CHECK constraint must never be treated as
  // a clean flip.
  assert.equal(
    classifyRow({ liveStatus: '', ourStatus: 'todo', suggestedStatus: 'done' }),
    'drift',
  );
  assert.equal(
    classifyRow({ liveStatus: 'Done', ourStatus: 'todo', suggestedStatus: 'done' }),
    'drift',
    'case-mismatched status must not pass as the canonical value',
  );
});

// -------------------------------------------------------------------------
// auditNote
// -------------------------------------------------------------------------

const PREFIX = 'Convert reconciliation 2026-07-25 — ';

test('auditNote: a real Convert goal keeps its name, id and status', () => {
  assert.equal(
    auditNote({
      convertName: '[Rev] Total Page Views',
      convertId: '1004122741',
      convertStatus: 'active',
    }),
    `${PREFIX}[Rev] Total Page Views (id 1004122741, Convert status: active)`,
  );
});

test('auditNote: an ARCHIVED-but-real goal keeps its id (the spec deviation)', () => {
  // The two downgrades that reference a genuine archived Convert goal. The
  // spec's direction-based phrasing would have written "no real Convert goal"
  // over these and thrown the ids away — that is exactly what this branch
  // exists to prevent.
  assert.equal(
    auditNote({
      convertName: 'Submits Form Lead - Combined',
      convertId: '1004101324',
      convertStatus: 'archived',
    }),
    `${PREFIX}Submits Form Lead - Combined (id 1004101324, Convert status: archived)`,
  );
  assert.equal(
    auditNote({
      convertName: 'Step 1 | Contact Info | Validation Error Exposure',
      convertId: '1004117395',
      convertStatus: 'archived',
    }),
    `${PREFIX}Step 1 | Contact Info | Validation Error Exposure (id 1004117395, Convert status: archived)`,
  );
});

test('auditNote: no convert_id → the spec §2 placeholder wording, verbatim', () => {
  assert.equal(
    auditNote({ convertName: '(no real goal — placeholder/absent)', convertId: '', convertStatus: 'n/a' }),
    `${PREFIX}no real Convert goal — placeholder/absent`,
  );
});

test('auditNote: placeholder branch ignores convert_name and convert_status', () => {
  // Whatever the CSV puts in those columns for a goal-less row must not leak
  // into the trail as if it were a real Convert goal.
  assert.equal(
    auditNote({ convertName: 'anything at all', convertId: '', convertStatus: 'archived' }),
    `${PREFIX}no real Convert goal — placeholder/absent`,
  );
});

test('auditNote: a missing convert_status still yields a well-formed note', () => {
  assert.equal(
    auditNote({ convertName: 'Chat Start', convertId: '1004120153', convertStatus: '' }),
    `${PREFIX}Chat Start (id 1004120153, Convert status: unknown)`,
  );
});
