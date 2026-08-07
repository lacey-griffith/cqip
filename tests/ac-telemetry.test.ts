import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  AC_EVENTS,
  MAX_ERROR_DETAIL,
  REDACTED,
  isErrorEvent,
  redactDetail,
  validateAcEvent,
} from '../lib/telemetry/ac-telemetry';

// -------------------------------------------------------------------------
// Redaction — the security-critical half of this batch.
//
// The tests that matter here assert the VALUE is gone, not merely that the
// output "changed" or that the marker was hit. A redactor that replaces `?e=`
// with `[REDACTED]` and leaves the token behind would pass a naive
// "output !== input" check while shipping the credential.
// -------------------------------------------------------------------------

test('redactDetail destroys the SharePoint ?e= share token, not just the marker', () => {
  const url =
    'https://fusion92.sharepoint.com/:f:/s/CRO/EgoZLFM55WhJs70TCK2eaqUB7botxU-eaHBEBQSQcL2yCg?e=BrCI3V';
  const out = redactDetail(`folder_not_found: ${url}`)!;

  // The token itself must be absent — this is the assertion that catches a
  // marker-only redactor.
  assert.ok(!out.includes('BrCI3V'), 'share token survived redaction');
  assert.ok(out.includes(REDACTED));
  // Surrounding context survives so the message stays diagnosable.
  assert.ok(out.includes('folder_not_found'));
  assert.ok(out.includes('fusion92.sharepoint.com'));
});

test('redactDetail destroys a Bearer token value', () => {
  const out = redactDetail('401 from upstream: Authorization: Bearer abc123SECRETvalue')!;
  assert.ok(!out.includes('abc123SECRETvalue'), 'bearer token survived');
  assert.ok(out.includes(REDACTED));
});

test('redactDetail destroys a JWT-shaped value', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dBjftJeZ4CVPmB92K27u';
  const out = redactDetail(`supabase rejected key ${jwt}`)!;
  assert.ok(!out.includes('dBjftJeZ4CVPmB92K27u'), 'JWT signature survived');
  assert.ok(!out.includes('eyJhbGciOiJIUzI1NiJ9'), 'JWT header survived');
  assert.ok(out.includes(REDACTED));
});

test('redactDetail destroys Azure SAS parameter values', () => {
  const out = redactDetail('GET failed ?sv=2021-08-06&se=2026-01-01&sig=AbC%2FdEf123')!;
  assert.ok(!out.includes('AbC%2FdEf123'), 'sig value survived');
  assert.ok(!out.includes('2021-08-06'), 'sv value survived');
  assert.ok(!out.includes('2026-01-01'), 'se value survived');
});

test('a credential is destroyed wherever it sits, including past the 200-char cut', () => {
  // Straddling the boundary: the marker starts before 200 and the value runs
  // past it.
  const straddle = 'x'.repeat(MAX_ERROR_DETAIL - 6) + '?e=TOPSECRETTOKEN';
  const out1 = redactDetail(straddle)!;
  assert.ok(!out1.includes('TOPSECRETTOKEN'), 'straddling token survived');
  assert.equal(out1.length, MAX_ERROR_DETAIL);

  // Entirely beyond the cut.
  const beyond = 'x'.repeat(MAX_ERROR_DETAIL + 40) + '?e=TOPSECRETTOKEN';
  assert.ok(!redactDetail(beyond)!.includes('TOPSECRETTOKEN'));

  // HONEST LIMIT, recorded so nobody mistakes this for an ordering guarantee:
  // this test passes under BOTH orders (redact-then-truncate and
  // truncate-then-redact), verified by mutation. It cannot pin the order, and
  // no test can, because with end-truncation and prefix-anchored patterns the
  // two orders are behaviourally identical. The order is kept for the reasons
  // in redactDetail's docblock — future non-prefix-anchored patterns, and
  // context quality — and those are review-level invariants, not testable
  // ones. An earlier version of this test claimed to prove the ordering and
  // did not; it padded the secret entirely past the cut, where truncation
  // alone removes it.
});

test('redactDetail hard-truncates to 200 chars', () => {
  const out = redactDetail('y'.repeat(500))!;
  assert.equal(out.length, MAX_ERROR_DETAIL);
});

test('redactDetail leaves ordinary text intact and passes null through', () => {
  assert.equal(redactDetail('xlsx_parse: sheet "Preview Links" missing'),
    'xlsx_parse: sheet "Preview Links" missing');
  assert.equal(redactDetail(null), null);
  assert.equal(redactDetail(undefined), null);
});

// -------------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------------

const valid = {
  app_version: '5.2.0',
  commit: '43de652',
  event: 'draft_ok',
  ticket: 'NBLYCRO-2354',
  error_kind: null,
  error_detail: null,
  ts: '2026-08-07T10:00:00.000Z',
  env: 'prod',
};

test('validateAcEvent accepts a well-formed payload', () => {
  const r = validateAcEvent(valid);
  assert.ok(r.ok);
  assert.equal(r.value.event, 'draft_ok');
  assert.equal(r.value.env, 'prod');
  assert.equal(r.value.ticket, 'NBLYCRO-2354');
});

test('validateAcEvent requires env — this is what keeps a dead prod from reading as alive', () => {
  const { env: _drop, ...noEnv } = valid;
  void _drop;
  const r = validateAcEvent(noEnv);
  assert.equal(r.ok, false);
});

test('validateAcEvent rejects an env outside dev|prod', () => {
  assert.equal(validateAcEvent({ ...valid, env: 'staging' }).ok, false);
});

test('validateAcEvent rejects an event outside the closed set', () => {
  assert.equal(validateAcEvent({ ...valid, event: 'draft_maybe' }).ok, false);
  for (const e of AC_EVENTS) {
    assert.ok(validateAcEvent({ ...valid, event: e }).ok, `${e} should be accepted`);
  }
});

test('validateAcEvent rejects missing/blank required fields', () => {
  for (const key of ['app_version', 'commit', 'ticket']) {
    assert.equal(validateAcEvent({ ...valid, [key]: '' }).ok, false, `blank ${key}`);
    assert.equal(validateAcEvent({ ...valid, [key]: undefined }).ok, false, `missing ${key}`);
  }
});

test('validateAcEvent rejects an unparseable ts', () => {
  assert.equal(validateAcEvent({ ...valid, ts: 'not-a-date' }).ok, false);
  assert.equal(validateAcEvent({ ...valid, ts: 12345 }).ok, false);
});

test('validateAcEvent normalizes ts so equivalent spellings dedupe to one row', () => {
  const a = validateAcEvent({ ...valid, ts: '2026-08-07T10:00:00Z' });
  const b = validateAcEvent({ ...valid, ts: '2026-08-07T10:00:00.000Z' });
  assert.ok(a.ok && b.ok);
  assert.equal(a.value.ts, b.value.ts);
});

test('validateAcEvent does NOT constrain error_kind — an AC taxonomy addition must not 400', () => {
  const r = validateAcEvent({
    ...valid,
    event: 'draft_error',
    error_kind: 'some_brand_new_kind_ac_invented_today',
  });
  assert.ok(r.ok);
  assert.equal(r.value.error_kind, 'some_brand_new_kind_ac_invented_today');
});

test('validateAcEvent TRUNCATES over-long values instead of rejecting them', () => {
  // Rejecting would be invisible to a fire-and-forget sender and would surface
  // downstream as "AC is dead". Truncation keeps the event.
  const r = validateAcEvent({ ...valid, ticket: 'T'.repeat(500) });
  assert.ok(r.ok);
  assert.ok(r.value.ticket.length < 500);
});

test('validateAcEvent redacts error_detail on the way in', () => {
  const r = validateAcEvent({
    ...valid,
    event: 'post_error',
    error_kind: 'sharepoint_404',
    error_detail: 'failed for https://x.sharepoint.com/a?e=LEAKYTOKEN',
  });
  assert.ok(r.ok);
  assert.ok(!r.value.error_detail!.includes('LEAKYTOKEN'));
});

test('validateAcEvent ignores unknown extra keys rather than rejecting', () => {
  const r = validateAcEvent({ ...valid, some_future_field: 'whatever' });
  assert.ok(r.ok);
  assert.ok(!('some_future_field' in r.value));
});

test('validateAcEvent rejects non-object bodies', () => {
  assert.equal(validateAcEvent(null).ok, false);
  assert.equal(validateAcEvent([valid]).ok, false);
  assert.equal(validateAcEvent('string').ok, false);
});

test('isErrorEvent identifies exactly the two failure events', () => {
  assert.equal(isErrorEvent('draft_error'), true);
  assert.equal(isErrorEvent('post_error'), true);
  assert.equal(isErrorEvent('draft_ok'), false);
  assert.equal(isErrorEvent('post_ok'), false);
});
