import { timingSafeEqual } from 'node:crypto';

// Validates an incoming `Authorization: Bearer <token>` header against the
// CQIP_TELEMETRY_TOKEN env var using a length-tolerant timing-safe compare.
// Mirrors lib/api/monitoring-bearer-auth.ts, lib/api/bearer-auth.ts (brands)
// and lib/api/sharepoint-bearer-auth.ts. Separate secret per §13 rule 27 —
// rotating this token cannot break drafting (SharePoint) or config reads
// (brands). Consumed by the AC telemetry ingest (POST /api/telemetry/ac).
//
// Note the pre-mint state is intentional and deployable: with no token set the
// route answers 500 not_configured and stores nothing.

export type BearerAuthFailure =
  | { ok: false; status: 500; reason: 'not_configured' }
  | { ok: false; status: 401; reason: 'missing_header' | 'wrong_token' };

export type BearerAuthResult = { ok: true } | BearerAuthFailure;

export function validateTelemetryBearer(req: Request): BearerAuthResult {
  const expected = process.env.CQIP_TELEMETRY_TOKEN;
  if (!expected) {
    console.error('[telemetry-api] CQIP_TELEMETRY_TOKEN not configured');
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
