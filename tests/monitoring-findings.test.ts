import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  FINDING_STATUSES,
  ISSUE_TYPES,
  MONITORING_SOURCES,
  buildInsertRow,
  buildUpdatePatch,
  compareForPanel,
  countNew,
  dedupeKey,
  isAdminStatus,
  isFindingSeverity,
  isIssueType,
  isMonitoringSource,
  parseFinding,
  resolveBrandId,
  type ParsedFinding,
  type ResolvableBrand,
} from '../lib/client-library/monitoring';

const BRANDS: ResolvableBrand[] = [
  { id: 'b-mrr', brand_code: 'MRR', jira_value: 'MRR - Mr Rooter Plumbing' },
  { id: 'b-asv', brand_code: 'ASV', jira_value: 'ASV - Aire Serv' },
];

function parseOk(raw: Parameters<typeof parseFinding>[0], now?: Date): ParsedFinding {
  const r = parseFinding(raw, now);
  assert.ok(r.ok, `expected parse to succeed: ${r.ok ? '' : r.error}`);
  return r.value;
}

// -------------------------------------------------------------------------
// Spec §5.1 — dedupe. Same (source, external_ref) posted twice → the second
// post is an UPDATE of the existing row's mutable fields, not a duplicate
// insert. Encoded in the pure layer: the dedupe key matches, and the update
// patch carries the refreshed fields.
// -------------------------------------------------------------------------
test('dedupe: same (source, external_ref) shares a key; second post updates fields', () => {
  const first = parseOk({
    source: 'convert',
    external_ref: 'cv-42',
    issue_type: 'no_conversions',
    summary: '0 conversions in 7 days',
    severity: 'medium',
    detected_at: '2026-07-10T00:00:00.000Z',
  });
  const second = parseOk({
    source: 'convert',
    external_ref: 'cv-42',
    issue_type: 'no_conversions',
    summary: '0 conversions in 14 days', // refreshed
    severity: 'critical', // escalated
    detected_at: '2026-07-16T00:00:00.000Z',
  });

  // Same dedupe key → matches the same existing row.
  assert.equal(dedupeKey(first.source, first.external_ref), 'convert::cv-42');
  assert.equal(dedupeKey(first.source, first.external_ref), dedupeKey(second.source, second.external_ref));

  // A different source with the same ref does NOT collide.
  assert.notEqual(dedupeKey('manual', 'cv-42'), dedupeKey('convert', 'cv-42'));
  // A null external_ref never dedupes.
  assert.equal(dedupeKey('convert', null), null);

  const patch = buildUpdatePatch(second, '2026-07-16T12:00:00.000Z');
  assert.equal(patch.summary, '0 conversions in 14 days');
  assert.equal(patch.severity, 'critical');
  assert.equal(patch.detected_at, '2026-07-16T00:00:00.000Z');
  assert.equal(patch.updated_at, '2026-07-16T12:00:00.000Z');
});

// -------------------------------------------------------------------------
// Spec §5.2 — dismissed stays dismissed. A re-ingest of an actioned/dismissed
// finding must not reset status to 'new'. The update patch NEVER carries a
// status key, so an UPDATE can only ever touch mutable fields — the human's
// decision is structurally preserved.
// -------------------------------------------------------------------------
test('dismissed stays dismissed: the upsert update patch never contains status', () => {
  const f = parseOk({
    source: 'convert',
    external_ref: 'cv-1',
    issue_type: 'high_bounce',
    summary: 'bounce spike',
  });
  const patch = buildUpdatePatch(f, '2026-07-16T00:00:00.000Z');
  assert.equal('status' in patch, false, 'update patch must not include status');

  // The insert row also omits status (column defaults to new); it never
  // ships an 'actioned'/'dismissed' either.
  const insert = buildInsertRow(f, null);
  assert.equal('status' in insert, false, 'insert row must not include status (DB default new)');
});

// -------------------------------------------------------------------------
// Spec §5.3 — brand resolution. code and jira-value inputs resolve to a
// brand_id; unknown → null (still ingested).
// -------------------------------------------------------------------------
test('brand resolution: code primary, jira_value fallback, unknown → null', () => {
  assert.equal(resolveBrandId('MRR', BRANDS), 'b-mrr'); // code
  assert.equal(resolveBrandId('ASV - Aire Serv', BRANDS), 'b-asv'); // jira value
  assert.equal(resolveBrandId('  MRR  ', BRANDS), 'b-mrr'); // trimmed
  assert.equal(resolveBrandId('WDG', BRANDS), null); // unknown code
  assert.equal(resolveBrandId('', BRANDS), null);
  assert.equal(resolveBrandId(null, BRANDS), null);
  assert.equal(resolveBrandId(undefined, BRANDS), null);

  // An unresolved brand still parses + inserts (brand_id null).
  const f = parseOk({
    source: 'manual',
    external_ref: null,
    brand: 'WDG',
    issue_type: 'other',
    summary: 'manual note',
  });
  const row = buildInsertRow(f, resolveBrandId(f.brand, BRANDS));
  assert.equal(row.brand_id, null);
  assert.equal(row.summary, 'manual note');
});

// -------------------------------------------------------------------------
// Spec §5.4 — new-count / status filter + panel sort feeding the panel.
// -------------------------------------------------------------------------
test('new-count counts only status=new', () => {
  const findings = [
    { status: 'new' as const },
    { status: 'new' as const },
    { status: 'actioned' as const },
    { status: 'dismissed' as const },
  ];
  assert.equal(countNew(findings), 2);
  assert.equal(countNew([]), 0);
});

test('panel sort: severity (critical→medium→low→unset) then detected_at desc', () => {
  const items = [
    { status: 'new' as const, severity: 'low' as const, detected_at: '2026-07-10T00:00:00Z' },
    { status: 'new' as const, severity: null, detected_at: '2026-07-16T00:00:00Z' },
    { status: 'new' as const, severity: 'critical' as const, detected_at: '2026-07-01T00:00:00Z' },
    { status: 'new' as const, severity: 'critical' as const, detected_at: '2026-07-15T00:00:00Z' },
    { status: 'new' as const, severity: 'medium' as const, detected_at: '2026-07-12T00:00:00Z' },
  ];
  const sorted = [...items].sort(compareForPanel);
  assert.deepEqual(
    sorted.map((s) => `${s.severity ?? 'unset'}@${s.detected_at.slice(0, 10)}`),
    [
      'critical@2026-07-15', // critical, newer first
      'critical@2026-07-01',
      'medium@2026-07-12',
      'low@2026-07-10',
      'unset@2026-07-16', // unset severity sinks below all graded ones
    ],
  );
});

// -------------------------------------------------------------------------
// Validation guards (defense in front of the DB CHECK — bad value → 400).
// -------------------------------------------------------------------------
test('parse validates source, issue_type, summary, optional severity', () => {
  assert.equal(parseFinding({ issue_type: 'error', summary: 'x' }).ok, false); // missing source
  assert.equal(parseFinding({ source: 'convert', summary: 'x' }).ok, false); // missing issue_type
  assert.equal(parseFinding({ source: 'convert', issue_type: 'error' }).ok, false); // missing summary
  assert.equal(parseFinding({ source: 'convert', issue_type: 'error', summary: '   ' }).ok, false); // blank summary
  assert.equal(
    parseFinding({ source: 'convert', issue_type: 'error', summary: 'x', severity: 'sev1' }).ok,
    false,
  ); // bad severity

  // Valid, severity omitted → null; detail defaults null; detected_at defaults to now.
  const now = new Date('2026-07-17T09:00:00.000Z');
  const f = parseOk({ source: 'convert', issue_type: 'error', summary: 'boom' }, now);
  assert.equal(f.severity, null);
  assert.equal(f.detail, null);
  assert.equal(f.detected_at, '2026-07-17T09:00:00.000Z');
});

test('type guards reject out-of-set values; enum counts are locked', () => {
  for (const s of MONITORING_SOURCES) assert.equal(isMonitoringSource(s), true);
  assert.equal(isMonitoringSource('sentry'), false);
  for (const t of ISSUE_TYPES) assert.equal(isIssueType(t), true);
  assert.equal(isIssueType('crash'), false);
  assert.equal(isFindingSeverity('critical'), true);
  assert.equal(isFindingSeverity('high'), false);
  assert.equal(isAdminStatus('actioned'), true);
  assert.equal(isAdminStatus('dismissed'), true);
  assert.equal(isAdminStatus('new'), false, "admin route must not accept 'new'");

  // Sentinels: these sets are contract surfaces. Bump intentionally.
  assert.equal(MONITORING_SOURCES.length, 2, 'MONITORING_SOURCES count drift');
  assert.equal(ISSUE_TYPES.length, 6, 'ISSUE_TYPES count drift');
  assert.equal(FINDING_STATUSES.length, 3, 'FINDING_STATUSES count drift');
});
