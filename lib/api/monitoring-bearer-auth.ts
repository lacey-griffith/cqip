import { timingSafeEqual } from 'node:crypto';

// Validates an incoming `Authorization: Bearer <token>` header against the
// CQIP_CONVERT_MONITORING_TOKEN env var using a length-tolerant timing-safe
// compare. Mirrors lib/api/bearer-auth.ts (brands API) and
// lib/api/sharepoint-bearer-auth.ts. Separate secret per §13 rule 27 — blast
// radius stays bounded if one of the tokens leaks or rotates. Consumed by the
// external monitoring feed (Batch 008 Convert posts through the same route).

export type BearerAuthFailure =
  | { ok: false; status: 500; reason: 'not_configured' }
  | { ok: false; status: 401; reason: 'missing_header' | 'wrong_token' };

export type BearerAuthResult = { ok: true } | BearerAuthFailure;

export function validateMonitoringBearer(req: Request): BearerAuthResult {
  const expected = process.env.CQIP_CONVERT_MONITORING_TOKEN;
  if (!expected) {
    console.error('[monitoring-api] CQIP_CONVERT_MONITORING_TOKEN not configured');
    return { ok: false, status: 500, reason: 'not_configured' };
  }

  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, reason: 'missing_header' };
  }

  const provided = match[1].trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return { ok: false, status: 401, reason: 'wrong_token' };
  }
  return timingSafeEqual(a, b)
    ? { ok: true }
    : { ok: false, status: 401, reason: 'wrong_token' };
}
