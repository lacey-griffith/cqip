import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  ERROR_STATUS,
  buildErrorEnvelope,
  type ErrorCode,
} from '../lib/sharepoint/errors';

// Spec §4 matrix + D2 amendment (2026-05-28): every code maps to its
// locked HTTP status. xlsx_not_found added at D2 flip (soft-fail → 422).
const EXPECTED_STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  folder_not_found: 404,
  file_not_found: 404,
  multiple_xlsx_at_root: 422,
  xlsx_not_found: 422,
  sheet_not_found: 422,
  image_too_large: 413,
  sharepoint_auth: 502,
  sharepoint_upstream: 502,
  internal: 500,
};

test('every locked error code maps to the correct HTTP status', () => {
  for (const code of Object.keys(EXPECTED_STATUS) as ErrorCode[]) {
    assert.equal(ERROR_STATUS[code], EXPECTED_STATUS[code], `${code} status drift`);
  }
  // Sentinel: the code count is locked. Bump intentionally when adding
  // a new locked code (matrix is contract surface).
  assert.equal(Object.keys(ERROR_STATUS).length, 10, 'ERROR_STATUS code count drift');
});

test('envelope has error + message + context fields, in that shape', () => {
  const env = buildErrorEnvelope('multiple_xlsx_at_root', 'too many xlsx', {
    filenames: ['a.xlsx', 'b.xlsx'],
  });
  assert.equal(env.error, 'multiple_xlsx_at_root');
  assert.equal(env.message, 'too many xlsx');
  assert.deepEqual(env.filenames, ['a.xlsx', 'b.xlsx']);
});

test('envelope context fields ride alongside error/message for every code', () => {
  const cases: { code: ErrorCode; context: Record<string, unknown> }[] = [
    { code: 'unauthorized', context: {} },
    { code: 'folder_not_found', context: { url: 'https://x/y' } },
    { code: 'file_not_found', context: { ref: 'd:i' } },
    { code: 'multiple_xlsx_at_root', context: { filenames: ['a.xlsx', 'b.xlsx'] } },
    { code: 'xlsx_not_found', context: { url: 'https://x/y' } },
    { code: 'sheet_not_found', context: { expected: 'Preview Links' } },
    { code: 'image_too_large', context: { max_bytes: 26214400, actual_bytes: 30000000 } },
    { code: 'sharepoint_auth', context: {} },
    { code: 'sharepoint_upstream', context: { graph_status: 503 } },
    { code: 'internal', context: {} },
  ];
  for (const { code, context } of cases) {
    const env = buildErrorEnvelope(code, 'msg', context);
    assert.equal(env.error, code);
    assert.equal(env.message, 'msg');
    for (const [k, v] of Object.entries(context)) {
      assert.deepEqual(env[k], v, `${code} missing ${k}`);
    }
  }
});

test('envelope shape spreads cleanly even when context is empty', () => {
  const env = buildErrorEnvelope('unauthorized', 'no token');
  assert.deepEqual(Object.keys(env).sort(), ['error', 'message']);
});
