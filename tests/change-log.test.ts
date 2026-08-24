import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  ACTOR_KINDS,
  ACTOR_LABEL,
  CELL_TARGET_TYPE,
  NOT_PERMITTED_TEXT,
  RESOLVE_FIELD,
  UNKNOWN_DATE_TEXT,
  actorKind,
  actorLabel,
  auditAccess,
  latestRow,
  resolveDisplay,
  resolveMomentFor,
  sortEntries,
  summarize,
  verifyCompleteRead,
  type AuditRowLike,
  type ChangeLogEntry,
} from '../lib/client-library/change-log';

// `assert.ok(x)` does not narrow for tsc, and `tests/` IS typechecked by
// `next build` (tsconfig includes **/*.ts, no ignoreBuildErrors). The first draft
// of this file shipped 5 strict-null errors that `npm test` could not see, because
// tsx strips types — CI went green on tests and would have gone red on deploy.
// This helper narrows and asserts in one step.
function present<T>(v: T | null | undefined, what: string): T {
  assert.ok(v !== null && v !== undefined, `expected ${what} to be present`);
  return v;
}

const row = (over: Partial<AuditRowLike> = {}): AuditRowLike => ({
  id: 'r1',
  target_type: CELL_TARGET_TYPE,
  target_id: 'cell-1',
  field_name: 'status',
  old_value: 'todo',
  new_value: 'done',
  changed_by: 'l.hay@fusion92.com',
  changed_at: '2026-08-21T10:00:00Z',
  ...over,
});

// -------------------------------------------------------------------------
// Spec §5 — attribution is script vs human ONLY.
// -------------------------------------------------------------------------
test('§5 system: prefix is script, everything else is human', () => {
  assert.equal(actorKind('system:convert-reconciliation'), 'script');
  assert.equal(actorKind('system:nbly-goal-load'), 'script');
  assert.equal(actorKind('l.hay@fusion92.com'), 'human');
  assert.equal(actorKind('lacey@cqip.local'), 'human');
});

test('§5 an UNKNOWN script identity must not be labelled Manual', () => {
  // Prefix, not an allowlist. A new script otherwise reads as a human edit, and
  // that is the direction that overclaims.
  assert.equal(actorKind('system:some-future-backfill'), 'script');
});

test('§5 the vocabulary is exactly two labels', () => {
  assert.deepEqual([...ACTOR_KINDS], ['script', 'human']);
  assert.equal(Object.keys(ACTOR_LABEL).length, 2);
  assert.equal(actorLabel('system:x'), 'Automated');
  assert.equal(actorLabel('l.hay@fusion92.com'), 'Manual');
});

test('§5 no label leaks an email or a named pass', () => {
  for (const label of Object.values(ACTOR_LABEL)) {
    assert.equal(label.includes('@'), false, `label "${label}" leaks an identity`);
    assert.equal(/v2\.?1|backport|goal-load|convert/i.test(label), false, `label "${label}" names a pass`);
  }
});

// -------------------------------------------------------------------------
// Spec §4 — the degraded path. An approximate date may NEVER render as exact.
// -------------------------------------------------------------------------
const cell = { cellId: 'cell-1', directiveId: 'dir-1' };

test('§4 a per-cell row gives an exact date and no qualifier', () => {
  const m = resolveMomentFor(cell, new Map([['cell-1', [row()]]]), new Map());
  assert.equal(m.provenance, 'per-cell');
  const d = resolveDisplay(m);
  assert.equal(d.exact, true);
  assert.equal(d.qualifier, null);
  assert.equal(d.primary, 'Aug 21, 2026');
});

test('§4 no per-cell row falls back to the directive date, MARKED APPROXIMATE', () => {
  const m = resolveMomentFor(
    cell,
    new Map(),
    new Map([['dir-1', [row({ target_type: 'directive', target_id: 'dir-1', changed_at: '2026-08-03T09:00:00Z' })]]]),
  );
  assert.equal(m.provenance, 'directive-approximate');
  const d = resolveDisplay(m);
  assert.equal(d.exact, false);
  assert.equal(d.primary, UNKNOWN_DATE_TEXT);
  assert.ok(d.qualifier, 'an approximate moment MUST carry a qualifier');
  assert.ok(d.qualifier.includes('approximate'), 'the qualifier must say approximate');
  assert.ok(d.qualifier.includes('Aug 03, 2026'), 'the directive date belongs in the qualifier');
});

test('§4 THE HEADLINE INVARIANT: an approximate primary never contains its date', () => {
  // This is the "47% quietly wrong in one direction" failure. The date exists
  // only inside `qualifier`, so a component that renders `primary` alone still
  // cannot state a date it does not have.
  const m = resolveMomentFor(
    cell, new Map(),
    new Map([['dir-1', [row({ changed_at: '2026-08-03T09:00:00Z' })]]]),
  );
  const d = resolveDisplay(m);
  assert.equal(/\d{4}/.test(d.primary), false, `approximate primary leaked a date: "${d.primary}"`);
  assert.equal(d.primary, UNKNOWN_DATE_TEXT);
});

test('§4 qualifier is non-null for EVERY non-exact provenance', () => {
  const approx = resolveDisplay(resolveMomentFor(cell, new Map(), new Map([['dir-1', [row()]]])));
  const none = resolveDisplay(resolveMomentFor(cell, new Map(), new Map()));
  for (const d of [approx, none]) {
    assert.equal(d.exact, false);
    assert.notEqual(d.qualifier, null, 'a non-exact display must be qualified');
  }
});

test('§4 nothing known at all is still SHOWN, not dropped', () => {
  const m = resolveMomentFor(cell, new Map(), new Map());
  assert.equal(m.provenance, 'none');
  assert.equal(m.at, null);
  assert.equal(resolveDisplay(m).primary, UNKNOWN_DATE_TEXT);
});

test('§4 the approximate case carries NO actor', () => {
  // A directive-level row says who touched the DIRECTIVE, not who resolved this
  // cell. An actor badge would be the same overclaim as the bare date, one
  // column over, and harder to spot because it carries no marker.
  const m = resolveMomentFor(
    cell, new Map(),
    new Map([['dir-1', [row({ changed_by: 'system:nbly-goal-load' })]]]),
  );
  assert.equal(m.provenance, 'directive-approximate');
  assert.equal(m.actor, null);
});

test('per-cell wins over a NEWER directive-level row', () => {
  // Precision beats recency: an exact date for this cell is better evidence than
  // a later summary date for its parent.
  const m = resolveMomentFor(
    cell,
    new Map([['cell-1', [row({ changed_at: '2026-07-20T00:00:00Z' })]]]),
    new Map([['dir-1', [row({ changed_at: '2026-08-21T00:00:00Z' })]]]),
  );
  assert.equal(m.provenance, 'per-cell');
  assert.equal(m.at, '2026-07-20T00:00:00Z');
});

test('latest per-cell row wins', () => {
  const m = resolveMomentFor(
    cell,
    new Map([['cell-1', [
      row({ id: 'a', changed_at: '2026-07-01T00:00:00Z' }),
      row({ id: 'b', changed_at: '2026-08-15T00:00:00Z', changed_by: 'system:convert-reconciliation' }),
      row({ id: 'c', changed_at: '2026-08-02T00:00:00Z' }),
    ]]]),
    new Map(),
  );
  assert.equal(m.at, '2026-08-15T00:00:00Z');
  assert.equal(m.actor, 'script');
});

test('latestRow on an empty list is null, not a throw', () => {
  assert.equal(latestRow([]), null);
});

// -------------------------------------------------------------------------
// Spec §3 / §7.2 — a short read must abort, in BOTH directions.
// -------------------------------------------------------------------------
test('§3 matching count passes', () => {
  assert.equal(verifyCompleteRead('audit', 505, 505).ok, true);
});

test('§3 a SHORT read fails, names the shortfall, and says why it matters', () => {
  const c = verifyCompleteRead('audit', 505, 500);
  assert.equal(c.ok, false);
  const msg = present(c.message, 'a failure message');
  assert.ok(msg.includes('505'));
  assert.ok(msg.includes('5 missing'), 'name the shortfall, not just the two totals');
  assert.ok(/MOST RECENT/i.test(msg), 'the message must say WHICH rows go missing');
});

test('§3 an OVER-read PASSES — a row arriving mid-load is normal', () => {
  // Karen MEDIUM-1: the first build failed this direction too, so one ordinary
  // save between the count and the read killed the whole panel — with a message
  // explaining a short read while the read had been long. An over-read cannot
  // hide rows, which is the only thing this check exists to catch.
  assert.equal(verifyCompleteRead('audit', 505, 506).ok, true);
  assert.equal(verifyCompleteRead('audit', 505, 600).ok, true);
});

test('§3 NaN is what the real client hands us, and it fails CLOSED', () => {
  // Karen HIGH-3: supabase-js does parseInt on the content-range, so a missing
  // count is NaN, not null. The first build branched on `=== null`, so this path
  // was DEAD and users saw "the exact count is NaN".
  const c = verifyCompleteRead('audit', Number.NaN, 505);
  assert.equal(c.ok, false);
  const msg = present(c.message, 'a failure message');
  assert.ok(/cannot be verified/i.test(msg));
  assert.equal(msg.includes('NaN'), false, 'never surface NaN to a reader');
});

test('§3 null still fails closed', () => {
  assert.equal(verifyCompleteRead('audit', null, 505).ok, false);
});

test('§3 zero rows verified against zero is a valid complete read', () => {
  assert.equal(verifyCompleteRead('audit', 0, 0).ok, true);
});

// -------------------------------------------------------------------------
// Ordering + summary.
// -------------------------------------------------------------------------
const entry = (id: string, at: string | null, prov: 'per-cell' | 'directive-approximate' | 'none'): ChangeLogEntry => ({
  cellId: id, directiveId: 'dir-1', brandCode: 'RBW', directiveTitle: 'T',
  moment: { provenance: prov, at, actor: null },
});

test('newest first', () => {
  const out = sortEntries([
    entry('a', '2026-07-01T00:00:00Z', 'per-cell'),
    entry('b', '2026-08-21T00:00:00Z', 'per-cell'),
    entry('c', '2026-08-03T00:00:00Z', 'directive-approximate'),
  ]);
  assert.deepEqual(out.map((e) => e.cellId), ['b', 'c', 'a']);
});

test('undated rows sort LAST but are never dropped', () => {
  const out = sortEntries([
    entry('x', null, 'none'),
    entry('y', '2026-08-01T00:00:00Z', 'per-cell'),
  ]);
  assert.deepEqual(out.map((e) => e.cellId), ['y', 'x']);
  assert.equal(out.length, 2, '§4: an unknown row is SHOWN, not hidden');
});

test('sortEntries does not mutate its input', () => {
  const input = [entry('a', '2026-07-01T00:00:00Z', 'per-cell'), entry('b', '2026-08-01T00:00:00Z', 'per-cell')];
  const before = input.map((e) => e.cellId);
  sortEntries(input);
  assert.deepEqual(input.map((e) => e.cellId), before);
});

test('summary counts the three provenances and nothing else', () => {
  const s = summarize([
    entry('a', '2026-08-01T00:00:00Z', 'per-cell'),
    entry('b', '2026-08-01T00:00:00Z', 'per-cell'),
    entry('c', '2026-08-01T00:00:00Z', 'directive-approximate'),
    entry('d', null, 'none'),
  ]);
  assert.equal(s.total, 4);
  assert.equal(s.exact, 2);
  assert.equal(s.approximate, 1);
  assert.equal(s.unknown, 1);
  assert.equal(s.exact + s.approximate + s.unknown, s.total);
  assert.equal(s.exactPct, 50);
});

test('a percentage of nothing is UNDEFINED, not 0%', () => {
  // Small-n honesty, same instinct as the data-insights suppression rule.
  const s = summarize([]);
  assert.equal(s.total, 0);
  assert.equal(s.exactPct, null);
});

// (A test asserting summarize(368 exact + 252 approx) === 368/252 was REMOVED.
//  Karen LOW-8: it was a tautology over the counting already covered above, and
//  it hardcoded the very figures its own name said must not be pinned.)

// -------------------------------------------------------------------------
// H1 — only a `status` row is a resolve event. This is the regression test for a
// CONFIRMED production defect, built from the real row shape.
// -------------------------------------------------------------------------
test('H1 a later NOTE edit must NOT become the exact resolve date', () => {
  // Real shape, cell ea9cd7c5: resolved todo→done on 2026-07-25 by
  // system:convert-reconciliation, then a note edit on 07-29 by a human. The
  // first build rendered "Jul 29, 2026", exact, no qualifier, By: Manual.
  const m = resolveMomentFor(cell, new Map([['cell-1', [
    row({ id: 'st', field_name: 'status', new_value: 'done',
          changed_by: 'system:convert-reconciliation', changed_at: '2026-07-25T12:00:00Z' }),
    row({ id: 'nt', field_name: 'note', new_value: 'some note',
          changed_by: 'l.hay@fusion92.com', changed_at: '2026-07-29T12:00:00Z' }),
  ]]]), new Map());
  assert.equal(m.at, '2026-07-25T12:00:00Z', 'the STATUS row is the resolve moment');
  assert.equal(m.actor, 'script', 'and its actor, not the note-editor');
  assert.equal(resolveDisplay(m).primary, 'Jul 25, 2026');
});

test('H1 a cell with ONLY note rows has no exact date at all', () => {
  const m = resolveMomentFor(cell, new Map([['cell-1', [row({ field_name: 'note' })]]]),
    new Map([['dir-1', [row({ changed_at: '2026-08-03T00:00:00Z' })]]]));
  assert.equal(m.provenance, 'directive-approximate');
  assert.notEqual(resolveDisplay(m).qualifier, null);
});

test('H1 RESOLVE_FIELD is the single source for that filter', () => {
  assert.equal(RESOLVE_FIELD, 'status');
});

// -------------------------------------------------------------------------
// C1 — "no rows" vs "not allowed to see rows". The first build rendered a
// fabricated 0% as verified fact for every read-only user.
// -------------------------------------------------------------------------
test('C1 zero audit rows WITH finished cells is a PERMISSION state, not data', () => {
  // audit_log has one SELECT policy: is_admin(). RLS filters the count and the
  // paged read identically to zero, with no error, so the completeness check
  // passes and 639 cells render "no audit trail" — every one of which HAS one.
  assert.equal(auditAccess(639, 0), 'not-permitted');
});

test('C1 zero cells and zero audit rows is genuinely empty, not a permission problem', () => {
  assert.equal(auditAccess(0, 0), 'readable');
});

test('C1 any audit row at all means the read worked', () => {
  assert.equal(auditAccess(639, 1), 'readable');
  assert.equal(auditAccess(639, 542), 'readable');
});

test('C1 the permission message never states a coverage figure', () => {
  // The whole defect was a number presented as fact. The replacement copy must
  // not carry one.
  assert.equal(/\d/.test(NOT_PERMITTED_TEXT), false, `"${NOT_PERMITTED_TEXT}" contains a figure`);
  assert.ok(/admin/i.test(NOT_PERMITTED_TEXT));
});
