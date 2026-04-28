import { timingSafeEqual } from 'node:crypto';

// Validates an incoming `Authorization: Bearer <token>` header against
// the CQIP_BRANDS_API_TOKEN env var using a length-tolerant timing-safe
// compare. Mirrors the spirit of CQIP_SYNC_AUTH_KEY: a custom shared
// secret, not a JWT, set on both ends of the integration (this dashboard
// + the Forge app).

export type BearerAuthFailure =
  | { ok: false; status: 500; reason: 'not_configured' }
  | { ok: false; status: 401; reason: 'missing_header' | 'wrong_token' };

export type BearerAuthResult = { ok: true } | BearerAuthFailure;

export function validateBearer(req: Request): BearerAuthResult {
  const expected = process.env.CQIP_BRANDS_API_TOKEN;
  if (!expected) {
    console.error('[brands-api] CQIP_BRANDS_API_TOKEN not configured');
    return { ok: false, status: 500, reason: 'not_configured' };
  }

  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, reason: 'missing_header' };
  }

  const provided = match[1].trim();
  // timingSafeEqual rejects mismatched-length buffers without comparing,
  // which is fine — short-circuiting on length doesn't leak more than
  // any well-known auth scheme already does.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return { ok: false, status: 401, reason: 'wrong_token' };
  }
  return timingSafeEqual(a, b)
    ? { ok: true }
    : { ok: false, status: 401, reason: 'wrong_token' };
}
