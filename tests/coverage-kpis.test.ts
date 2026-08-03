import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  COVERAGE_TARGET,
  isInDrought,
  buildCoverageRows,
  computeCoverageHealth,
  computeQualityScore,
  type Brand,
  type Milestone,
  type QualityLog,
} from '../lib/coverage/queries';

// Batch 005.1 Phase 2 — Coverage KPI calc tests.
// Pure functions over plain arrays; run via `npx tsx --test`.
// All windows are rolling 28d; we pin `now` so the window is deterministic.

const NOW = new Date('2026-06-08T12:00:00.000Z');
// In-window = reached/triggered within [NOW-28d, NOW). NOW-28d = 2026-05-11T12:00Z.
const IN_WINDOW = '2026-05-20T12:00:00.000Z'; // comfortably inside
const OUT_WINDOW = '2026-04-01T12:00:00.000Z'; // before the window opens

// --- builders -----------------------------------------------------------

function brand(over: Partial<Brand> & { id: string }): Brand {
  return {
    project_key: 'NBLYCRO',
    brand_code: 'XX',
    jira_value: 'XX - X',
    display_name: 'Brand X',
    is_active: true,
    is_paused: false,
    paused_reason: null,
    ...over,
  };
}

let mSeq = 0;
function milestone(
  brandId: string | null,
  reachedAt: string,
  over: Partial<Milestone> = {},
): Milestone {
  mSeq += 1;
  return {
    id: `m${mSeq}`,
    jira_ticket_id: `T-${mSeq}`,
    jira_ticket_url: null,
    jira_summary: null,
    brand_id: brandId,
    brand_jira_value: null,
    milestone_type: 'dev_client_review',
    reached_at: reachedAt,
    source: 'webhook',
    created_by: 'system',
    notes: null,
    is_deleted: false,
    ...over,
  };
}

let lSeq = 0;
function qlog(ticketId: string, triggeredAt: string, over: Partial<QualityLog> = {}): QualityLog {
  lSeq += 1;
  return {
    id: `l${lSeq}`,
    jira_ticket_id: ticketId,
    client_brand: null,
    triggered_at: triggeredAt,
    is_deleted: false,
    ...over,
  };
}

// `n` in-window dev_client_review milestones for a brand, each a distinct ticket.
function deliveries(brandId: string, n: number, ticketPrefix: string): Milestone[] {
  return Array.from({ length: n }, (_, i) =>
    milestone(brandId, IN_WINDOW, { jira_ticket_id: `${ticketPrefix}${i + 1}` }),
  );
}

// --- 1. Normal mixed case -----------------------------------------------

test('normal mixed case — correct health %, N/M, and quality score', () => {
  // Target is 4 as of 2026-08-03, so 3 is DROUGHT and 4 is covered. This
  // fixture deliberately keeps a brand on each side of the new boundary AND
  // one (A, 3) that flipped meaning when the target moved — the old version of
  // this test called A "covered" at 3.
  const brands = [
    brand({ id: 'A' }), // 3 delivered → DROUGHT under target 4 (was covered at threshold 2)
    brand({ id: 'B' }), // 5 delivered → covered
    brand({ id: 'C' }), // 2 delivered → drought
    brand({ id: 'D', is_paused: true }), // paused → excluded
    brand({ id: 'E', is_active: false }), // inactive → excluded
  ];
  const milestones = [
    ...deliveries('A', 3, 'TA'),
    ...deliveries('B', 5, 'TB'),
    ...deliveries('C', 2, 'TC'),
    ...deliveries('D', 9, 'TD'), // would be covered, but paused → excluded
    ...deliveries('E', 9, 'TE'), // inactive → excluded
  ];
  // dirty: one rework on TA1, three reworks on TB1 (counts once)
  const logs = [
    qlog('TA1', IN_WINDOW),
    qlog('TB1', IN_WINDOW),
    qlog('TB1', IN_WINDOW),
    qlog('TB1', IN_WINDOW),
  ];

  const health = computeCoverageHealth(brands, milestones, NOW);
  assert.equal(health.totalCount, 3, 'denominator = active non-paused brands');
  assert.equal(health.coveredCount, 1, 'only B (5) clears target 4; A (3) and C (2) are drought');
  assert.equal(health.healthPct, 33, 'round(1/3*100)');

  const quality = computeQualityScore(milestones, logs, NOW);
  // Only A(3) + B(5) + C(2) milestones are for active brands, but Quality
  // rate is ticket-based and type/brand-agnostic on the milestone side —
  // it counts ALL in-window dev_client_review deliveries: 3+5+2+9+9 = 28.
  assert.equal(quality.deliveredCount, 28, 'all in-window DCR deliveries, distinct tickets');
  assert.equal(quality.dirtyCount, 2, 'TA1 + TB1 (TB1 multiplicity counts once)');
  assert.equal(quality.cleanCount, 26);
  assert.equal(quality.scorePct, 93, 'round(26/28*100)');
});

// --- 2. 0-denominator guards --------------------------------------------

test('0-denominator guards — health and quality render — (null), never div-by-zero', () => {
  // (a) no active, non-paused brands
  const brands = [
    brand({ id: 'P', is_paused: true }),
    brand({ id: 'I', is_active: false }),
  ];
  const milestones = [...deliveries('P', 5, 'TP'), ...deliveries('I', 5, 'TI')];
  const health = computeCoverageHealth(brands, milestones, NOW);
  assert.equal(health.totalCount, 0);
  assert.equal(health.coveredCount, 0);
  assert.equal(health.healthPct, null, 'denominator 0 → null (render —)');

  // (b) zero delivered tickets in window → quality score null
  const quality = computeQualityScore([], [qlog('T1', IN_WINDOW)], NOW);
  assert.equal(quality.deliveredCount, 0);
  assert.equal(quality.scorePct, null, '0 delivered → null (render —), not 100%');
});

// --- 3. Dirty-ticket-not-in-delivered-set + out-of-window rework ---------

test('quality score — intersection with delivered set; out-of-window rework stays clean', () => {
  // delivered in-window: T1, T2. (T999 is never delivered.)
  const milestones = [
    milestone('A', IN_WINDOW, { jira_ticket_id: 'T1' }),
    milestone('A', IN_WINDOW, { jira_ticket_id: 'T2' }),
  ];
  const logs = [
    qlog('T1', IN_WINDOW), // T1 reworked in-window → dirty
    qlog('T2', OUT_WINDOW), // T2 rework predates window → T2 stays CLEAN
    qlog('T999', IN_WINDOW), // not delivered in-window → must NOT count (intersection)
  ];

  const quality = computeQualityScore(milestones, logs, NOW);
  assert.equal(quality.deliveredCount, 2, 'T1, T2');
  assert.equal(quality.dirtyCount, 1, 'only T1 — T999 excluded by intersection, T2 rework out of window');
  assert.equal(quality.cleanCount, 1);
  assert.equal(quality.scorePct, 50, 'round(1/2*100)');
});

// --- 4. Exactly-ON-TARGET boundary (Jenny Critical, re-pointed 2026-08-03) --

// THE POINT OF THIS TEST INVERTED when the constant became a TARGET compared
// with strict-less-than. Under the old `<= threshold` spelling, a brand sitting
// exactly ON the number was DROUGHT. Under `< target`, a brand exactly ON the
// number is COVERED. Lacey's rule is "drought is 3, covered is 4", and that is
// what is asserted here — 3 drought, 4 covered — because writing the target as
// 4 into the OLD predicate would have made 4 read as drought (`4 <= 4`), which
// is the off-by-one the rename exists to prevent.
test('exactly-ON-TARGET boundary — 3 reads DROUGHT and 4 reads COVERED on BOTH pill and KPI', () => {
  assert.equal(COVERAGE_TARGET, 4, 'target constant is 4 (effective 2026-08-03)');

  // Shared predicate. target-1 is drought; exactly-target is covered.
  assert.equal(isInDrought(3, false), true, 'count < target → drought');
  assert.equal(isInDrought(4, false), false, 'count === target → COVERED (not drought)');
  assert.equal(isInDrought(5, false), false, 'count > target → covered');
  // The old boundary must no longer read as covered.
  assert.equal(isInDrought(2, false), true, '2 was the old threshold; still drought');
  assert.equal(isInDrought(0, false), true, 'zero deliveries → drought');
  // Paused always short-circuits regardless of count.
  assert.equal(isInDrought(0, true), false, 'paused → never drought');

  const brands = [
    brand({ id: 'A' }), // exactly 3 → drought / uncovered
    brand({ id: 'B' }), // exactly 4 → ON target → covered
  ];
  const milestones = [...deliveries('A', 3, 'TA'), ...deliveries('B', 4, 'TB')];

  // Pill (Output table) and KPI must AGREE at the boundary. Pin NOW on the
  // pill side too — buildCoverageRows now takes an injectable clock, so the
  // fixture window can never age out from under the wall clock (Karen F1/F3).
  const rows = buildCoverageRows(brands, milestones, [], NOW);
  const rowA = rows.find(r => r.brand.id === 'A')!;
  const rowB = rows.find(r => r.brand.id === 'B')!;
  assert.equal(rowA.testsRolling28, 3);
  assert.equal(rowA.droughtFlag, true, 'pill: 3 (target-1) → DROUGHT');
  assert.equal(rowB.testsRolling28, 4);
  assert.equal(rowB.droughtFlag, false, 'pill: exactly 4 → NOT drought');

  const health = computeCoverageHealth(brands, milestones, NOW);
  assert.equal(health.totalCount, 2);
  assert.equal(health.coveredCount, 1, 'KPI: only B covered — boundary brand A matches its DROUGHT pill');
  assert.equal(health.healthPct, 50, 'round(1/2*100)');
});

// --- 5. Single-pass Health + Covered cannot diverge ----------------------

test('single-pass — Overall Health derives from the SAME numerator/denominator as Brands Covered', () => {
  const brands = [
    brand({ id: 'A' }),
    brand({ id: 'B' }),
    brand({ id: 'C' }),
    brand({ id: 'D' }),
  ];
  const milestones = [
    ...deliveries('A', 4, 'TA'), // exactly on target → covered
    ...deliveries('B', 3, 'TB'), // 3 → DROUGHT under target 4 (was covered at threshold 2)
    ...deliveries('C', 1, 'TC'), // drought
    // D: 0 deliveries → drought
  ];

  const health = computeCoverageHealth(brands, milestones, NOW);

  // Brands Covered "N/M" is literally these two numbers...
  assert.equal(health.coveredCount, 1, 'only A (exactly 4) clears the target');
  assert.equal(health.totalCount, 4);

  // ...and Overall Health is computed FROM them — no second computation,
  // so the two surfaces are physically incapable of diverging.
  assert.equal(
    health.healthPct,
    Math.round((health.coveredCount / health.totalCount) * 100),
    'healthPct is exactly the round() of the Brands-Covered fraction',
  );
  assert.equal(health.healthPct, 25, 'round(1/4*100)');
});
