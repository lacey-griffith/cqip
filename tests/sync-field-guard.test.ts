// lib/sync/sync-field-guard.ts — the Jira-sync skip-if-empty guard.
//
// These tests exist because the bug they prevent is SILENT and CONFIRMED: from
// 2026-05-26 the sync wrote []/null over human-entered classifications whenever
// the Jira QA tab was empty (the NORMAL state — Jira automation clears those
// fields on entry to Dev QA / Dev Client Review). Five production rows lost
// issue_category, issue_subtype, root_cause_final, resolution_type, severity
// and who_owns_fix, with no audit row recording the clear.
//
// TWO THINGS MAKE THESE TESTS A VALID ORACLE, and both matter:
//
//  1. The OMIT-vs-WRITE-NULL distinction is asserted directly. A guard that
//     wrote null instead of omitting the key would still destroy data while
//     passing any naive "the value is unchanged" assertion.
//
//  2. The DRIFT TEST. tsconfig.json excludes supabase/functions, so `tsc` never
//     sees the deployed edge function and it cannot import this module. The
//     drift test is therefore the ONLY gate tying this tested module to the code
//     that actually runs. Without it, everything above proves nothing about
//     production — the "reference and value share no independent oracle" failure
//     CLAUDE.md §15 records four times.
//
// Run: npx tsx --test tests/sync-field-guard.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  SYNC_GUARDED_FIELDS,
  SYNC_AUDIT_CHANGED_BY,
  isEmptyForSync,
  addGuardedSyncFields,
  serializeForAudit,
  buildSyncAuditRows,
} from '../lib/sync/sync-field-guard';

// Resolved from cwd, matching the repo convention of running tests from the
// repo root (`npx tsx --test tests/...`). Both paths are existence-asserted
// below so a wrong cwd fails loudly instead of silently reading nothing.
const REPO = process.cwd();
const LIB_PATH = join(REPO, 'lib/sync/sync-field-guard.ts');
const FN_PATH = join(REPO, 'supabase/functions/jira-sync/index.ts');

function readOrFail(path: string): string {
  assert.ok(existsSync(path), `expected to find ${path} — run tests from the repo root`);
  return readFileSync(path, 'utf8');
}

const BEGIN = '// --- SYNC-FIELD-GUARD:BEGIN ---';
const END = '// --- SYNC-FIELD-GUARD:END ---';

// ---------------------------------------------------------------------------
// isEmptyForSync — case 4, plus the false/0 carve-out (case 5's foundation)
// ---------------------------------------------------------------------------

test('isEmptyForSync: absent and empty values are empty', () => {
  assert.equal(isEmptyForSync(null), true);
  assert.equal(isEmptyForSync(undefined), true);
  assert.equal(isEmptyForSync([]), true);
  assert.equal(isEmptyForSync(''), true);
  assert.equal(isEmptyForSync('   '), true, 'whitespace-only is empty');
});

test('isEmptyForSync: real values are not empty', () => {
  assert.equal(isEmptyForSync(['Client Request']), false);
  assert.equal(isEmptyForSync('Low'), false);
  assert.equal(isEmptyForSync([''] ), false, 'an array with an element is non-empty');
});

test('isEmptyForSync: false and 0 are REAL values, not empty', () => {
  // The guard must not falsy-test. `false` is a genuine boolean from a Jira
  // checkbox; treating it as empty would make the four boolean columns
  // un-clearable and is mutation #2 in the spec.
  assert.equal(isEmptyForSync(false), false);
  assert.equal(isEmptyForSync(0), false);
});

// ---------------------------------------------------------------------------
// addGuardedSyncFields — cases 1, 2, 3, 5, 8
// ---------------------------------------------------------------------------

test('case 1: empty incoming value OMITS the key, so the stored value survives', () => {
  const target: Record<string, unknown> = { updated_at: 'now' };
  addGuardedSyncFields(target, {
    issue_category: [],
    issue_subtype: [],
    root_cause_final: [],
    resolution_type: [],
    severity: null,
    who_owns_fix: null,
  });

  // The critical assertion: absent, NOT present-and-null. `in` distinguishes
  // them; a truthiness or `=== undefined` check would not.
  for (const field of SYNC_GUARDED_FIELDS) {
    assert.equal(field in target, false, `${field} must be omitted, not written`);
  }
  assert.deepEqual(target, { updated_at: 'now' });
});

test('case 2: non-empty incoming value still overwrites, verbatim', () => {
  const target: Record<string, unknown> = {};
  addGuardedSyncFields(target, {
    issue_category: ['CRO Implementation'],
    severity: 'High',
    who_owns_fix: 'VN Team',
  });

  assert.deepEqual(target.issue_category, ['CRO Implementation']);
  assert.equal(target.severity, 'High');
  assert.equal(target.who_owns_fix, 'VN Team');
});

test('case 2b: a non-empty value is NOT trimmed on the way in', () => {
  // Trimming is for the emptiness TEST only. Storing a trimmed value would
  // silently change data shape.
  const target: Record<string, unknown> = {};
  addGuardedSyncFields(target, { severity: '  High  ' });
  assert.equal(target.severity, '  High  ');
});

test('case 3: no existing value + empty incoming stays empty — no write at all', () => {
  const target: Record<string, unknown> = {};
  addGuardedSyncFields(target, { issue_category: [], severity: null });
  assert.deepEqual(Object.keys(target), [], 'no regression: nothing written');
});

test('mixed: guarded fields are decided independently of one another', () => {
  const target: Record<string, unknown> = {};
  addGuardedSyncFields(target, {
    issue_category: ['Client Request'], // real -> written
    issue_subtype: [],                  // empty -> omitted
    severity: 'Low',                    // real -> written
    who_owns_fix: '',                   // empty -> omitted
  });

  assert.deepEqual(Object.keys(target).sort(), ['issue_category', 'severity']);
});

test('case 8: unguarded fields are untouched by the guard', () => {
  // client_brand MUST keep its unconditional write (§13 r28), so the guard
  // must not know about it. Passing it in does nothing.
  const target: Record<string, unknown> = { client_brand: 'MRA - Mr Appliance' };
  addGuardedSyncFields(target, { client_brand: null, jira_summary: null });

  assert.equal(target.client_brand, 'MRA - Mr Appliance', 'guard must not clear it');
  assert.equal('jira_summary' in target, false, 'guard must not add unguarded keys');
});

test('the guarded set is exactly the six human-editable sync-written columns', () => {
  // Pinned as a literal. The set is ALLOWED_FIELDS (app/api/logs/edit) INTERSECT
  // the sync updateData; widening or narrowing it is a deliberate decision that
  // should break a test, not slip through.
  assert.deepEqual([...SYNC_GUARDED_FIELDS], [
    'issue_category',
    'issue_subtype',
    'root_cause_final',
    'resolution_type',
    'severity',
    'who_owns_fix',
  ]);
});

// ---------------------------------------------------------------------------
// buildSyncAuditRows — cases 6, 7, 3, 8
//
// The sync emitted NO audit row for these columns, which is the only reason the
// data loss ran undetected for ten weeks. These tests pin the trail.
// ---------------------------------------------------------------------------

test('serializeForAudit: arrays are JSON, scalars are strings, absent is null', () => {
  // JSON for arrays so a sync-written row reads identically to a human-written
  // one for the same column (the edit dialog already sends `["Client Request"]`).
  assert.equal(serializeForAudit(['Client Request']), '["Client Request"]');
  assert.equal(serializeForAudit([]), '[]');
  assert.equal(serializeForAudit('Low'), 'Low');
  assert.equal(serializeForAudit(null), null);
  assert.equal(serializeForAudit(undefined), null);
});

test('case 6: a changed guarded field produces exactly one correct audit row', () => {
  const rows = buildSyncAuditRows(
    'log-1',
    { severity: 'Low', issue_category: [] },
    { severity: 'High', issue_category: ['Client Request'] },
  );

  assert.equal(rows.length, 2);
  const severity = rows.find((r) => r.field_name === 'severity')!;
  assert.deepEqual(severity, {
    log_entry_id: 'log-1',
    target_type: 'quality_log',
    target_id: 'log-1',
    action: 'UPDATE',
    field_name: 'severity',
    old_value: 'Low',
    new_value: 'High',
    changed_by: SYNC_AUDIT_CHANGED_BY,
    notes: 'Updated via Jira sync',
  });

  const category = rows.find((r) => r.field_name === 'issue_category')!;
  assert.equal(category.old_value, '[]');
  assert.equal(category.new_value, '["Client Request"]');
});

test('case 7: an unchanged guarded field produces NO audit row', () => {
  // A quiet sync must stay quiet. audit_log is already over the PostgREST
  // 1,000-row cap; emitting a row per field per run would be noise with a cost.
  const rows = buildSyncAuditRows(
    'log-1',
    { severity: 'Low', issue_category: ['Client Request'] },
    { severity: 'Low', issue_category: ['Client Request'] },
  );
  assert.deepEqual(rows, []);
});

test('case 3: a field the guard OMITTED produces no audit row', () => {
  // The guard skipped it, so nothing was written and nothing changed. A row
  // here would claim a write that never happened.
  const previous = { severity: 'Low', issue_category: ['Client Request'] };
  const updateData: Record<string, unknown> = { updated_at: 'now' };
  addGuardedSyncFields(updateData, { severity: null, issue_category: [] });

  assert.deepEqual(buildSyncAuditRows('log-1', previous, updateData), []);
});

test('case 8: unguarded columns are never audited, even when they change', () => {
  // Deliberate: §13 r2 is NARROWED (6 of 16), not closed. Full closure lands
  // with the audit_log pagination fix. Pinned so the scope is a decision, not
  // an accident.
  const rows = buildSyncAuditRows(
    'log-1',
    { client_brand: 'MRA - Mr Appliance', jira_summary: 'old' },
    { client_brand: 'MRR - Mr Rooter Plumbing', jira_summary: 'new' },
  );
  assert.deepEqual(rows, []);
});

test('audit: a null -> value transition is recorded, not skipped', () => {
  // The recovery case. A row whose value the old sync destroyed gets a real
  // trail the next time Jira supplies a value.
  const rows = buildSyncAuditRows('log-1', { who_owns_fix: null }, { who_owns_fix: 'VN Team' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].old_value, null);
  assert.equal(rows[0].new_value, 'VN Team');
});

test('audit: changed_by follows §13 r20 system:<name>', () => {
  assert.equal(SYNC_AUDIT_CHANGED_BY, 'system:jira-sync');
});

test('audit: rows satisfy the audit_log CHECK constraints', () => {
  // audit_log_target_shape_chk needs target_type='quality_log' AND a non-null
  // log_entry_id; the action CHECK admits only CREATE/UPDATE/DELETE/
  // STATUS_CHANGE/AI_SUGGESTION. An insert violating either throws at runtime,
  // where the edge function has no type-checking to catch it.
  const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'AI_SUGGESTION'];
  const rows = buildSyncAuditRows(
    'log-1',
    { severity: 'Low', who_owns_fix: 'CRO Dev', issue_subtype: [] },
    { severity: 'High', who_owns_fix: 'VN Team', issue_subtype: ['CSS/ Styling Issue'] },
  );
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.target_type, 'quality_log');
    assert.ok(row.log_entry_id, 'log_entry_id must be non-null for the quality_log branch');
    assert.ok(ACTIONS.includes(row.action), `${row.action} is not in the action CHECK`);
    assert.ok(row.changed_by, 'changed_by is NOT NULL');
  }
});

// ---------------------------------------------------------------------------
// Drift test — the only gate that reaches the deployed code
// ---------------------------------------------------------------------------

function extractBlock(source: string, path: string): string {
  const beginCount = source.split(BEGIN).length - 1;
  const endCount = source.split(END).length - 1;

  // Assert the markers exist EXACTLY once. Without this, a deleted marker
  // would silently compare two empty strings and the test would "pass".
  assert.equal(beginCount, 1, `${path}: expected exactly 1 BEGIN marker, found ${beginCount}`);
  assert.equal(endCount, 1, `${path}: expected exactly 1 END marker, found ${endCount}`);

  const start = source.indexOf(BEGIN) + BEGIN.length;
  const stop = source.indexOf(END);
  assert.ok(stop > start, `${path}: END marker precedes BEGIN marker`);
  return source.slice(start, stop);
}

test('DRIFT: the inlined edge-function copy is identical to the module', () => {
  const libBlock = extractBlock(readOrFail(LIB_PATH), LIB_PATH);
  const fnBlock = extractBlock(readOrFail(FN_PATH), FN_PATH);

  // Exactly one normalization, applied to the lib copy only: a module exports,
  // an inlined copy cannot. Nothing else is normalized — no whitespace
  // collapsing, no comment stripping — so the comparison stays honest.
  const normalized = libBlock.replace(/^export /gm, '');

  if (normalized !== fnBlock) {
    // Fail with a line-level diff naming the first divergence, not a bare
    // `false` that tells the next person nothing.
    const a = normalized.split('\n');
    const b = fnBlock.split('\n');
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    assert.fail(
      `SYNC-FIELD-GUARD block drifted at line ${i + 1} of the block.\n` +
        `  lib/sync/sync-field-guard.ts (export stripped): ${JSON.stringify(a[i])}\n` +
        `  supabase/functions/jira-sync/index.ts:          ${JSON.stringify(b[i])}\n` +
        `Edit BOTH copies together — the edge function cannot import the module ` +
        `(tsconfig excludes supabase/functions), so this assertion is the only ` +
        `thing making the unit tests above valid for the deployed code.`,
    );
  }
});

test('DRIFT: the extracted block is substantial, not accidentally empty', () => {
  // Guards the guard: if both files were reduced to bare markers, the identity
  // assertion above would pass vacuously.
  const fnBlock = extractBlock(readOrFail(FN_PATH), FN_PATH);
  assert.ok(fnBlock.includes('function isEmptyForSync'), 'block must carry isEmptyForSync');
  assert.ok(fnBlock.includes('function addGuardedSyncFields'), 'block must carry addGuardedSyncFields');
  assert.ok(fnBlock.includes('function buildSyncAuditRows'), 'block must carry buildSyncAuditRows');
  assert.ok(fnBlock.includes('SYNC_GUARDED_FIELDS'), 'block must carry the field list');
});

test('DRIFT: the edge function checks the update error before auditing', () => {
  // Without this the update can fail silently (supabase-js resolves with
  // { error }) and we would write audit rows for changes that never landed.
  const fn = readOrFail(FN_PATH);
  assert.ok(
    /const \{ error: updateError \} = await supabase[\s\S]{0,200}?\.update\(updateData\)/.test(fn),
    'the quality_logs update must destructure its error',
  );
  assert.ok(/if \(updateError\)/.test(fn), 'the update error must be acted on');

  // Order matters: the error check must precede the audit write.
  assert.ok(
    fn.indexOf('if (updateError)') < fn.indexOf('buildSyncAuditRows(log.id'),
    'the update error must be checked BEFORE audit rows are built',
  );
});

test('DRIFT: the edge function writes the audit rows it builds', () => {
  const fn = readOrFail(FN_PATH);
  assert.ok(
    /buildSyncAuditRows\(log\.id, log, updateData\)/.test(fn),
    'jira-sync must build audit rows from the pre-update snapshot',
  );
  assert.ok(
    /from\('audit_log'\)\s*\.insert\(auditRows\)/.test(fn),
    'jira-sync must insert the built audit rows',
  );
  // A failed audit write must be surfaced, not swallowed — that silence is the
  // reason this defect ran for ten weeks.
  assert.ok(/auditRowsFailed/.test(fn), 'audit write failures must be counted and surfaced');
});

test('DRIFT: the edge function actually CALLS the guard', () => {
  // The block could be present, identical, and never invoked — in which case
  // every test above passes and production still destroys data.
  const fn = readOrFail(FN_PATH);
  assert.ok(
    /addGuardedSyncFields\(updateData, mappedFields\)/.test(fn),
    'jira-sync must call addGuardedSyncFields(updateData, mappedFields)',
  );
  // And the guarded columns must NOT also be written unconditionally in the
  // updateData literal, which would defeat the guard entirely.
  const literal = fn.slice(fn.indexOf('const updateData'), fn.indexOf('addGuardedSyncFields(updateData'));
  for (const field of SYNC_GUARDED_FIELDS) {
    assert.ok(
      !new RegExp(`^\\s*${field}:`, 'm').test(literal),
      `${field} must not be written unconditionally in the updateData literal`,
    );
  }
});
