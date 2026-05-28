import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  validateSharePointBearer,
  respondAuthFailure,
} from '../lib/api/sharepoint-bearer-auth';

const ENV_KEY = 'CQIP_SHAREPOINT_API_TOKEN';

function mockReq(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/sharepoint/folder', { headers });
}

function withEnv<T>(value: string | undefined, fn: () => T): T {
  const saved = process.env[ENV_KEY];
  if (value === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = saved;
  }
}

test('validateSharePointBearer: missing env → not_configured (500)', () => {
  withEnv(undefined, () => {
    const res = validateSharePointBearer(mockReq({ authorization: 'Bearer anything' }));
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 500);
      assert.equal(res.reason, 'not_configured');
    }
  });
});

test('validateSharePointBearer: missing Authorization → missing_header (401)', () => {
  withEnv('configured-token', () => {
    const res = validateSharePointBearer(mockReq({}));
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 401);
      assert.equal(res.reason, 'missing_header');
    }
  });
});

test('validateSharePointBearer: wrong token → wrong_token (401)', () => {
  withEnv('configured-token', () => {
    const res = validateSharePointBearer(mockReq({ authorization: 'Bearer wrong' }));
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, 401);
      assert.equal(res.reason, 'wrong_token');
    }
  });
});

test('validateSharePointBearer: matching token → ok', () => {
  withEnv('configured-token', () => {
    const res = validateSharePointBearer(
      mockReq({ authorization: 'Bearer configured-token' }),
    );
    assert.equal(res.ok, true);
  });
});

test('respondAuthFailure: not_configured → 500 internal envelope', async () => {
  const res = respondAuthFailure({ ok: false, status: 500, reason: 'not_configured' });
  assert.equal(res.status, 500);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'internal');
});

test('respondAuthFailure: missing_header → 401 unauthorized envelope', async () => {
  const res = respondAuthFailure({ ok: false, status: 401, reason: 'missing_header' });
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'unauthorized');
});

test('respondAuthFailure: wrong_token → 401 unauthorized envelope', async () => {
  const res = respondAuthFailure({ ok: false, status: 401, reason: 'wrong_token' });
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'unauthorized');
});
