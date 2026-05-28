import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/sharepoint/errors';

// Validates an incoming `Authorization: Bearer <token>` header against
// the CQIP_SHAREPOINT_API_TOKEN env var using a length-tolerant
// timing-safe compare. Mirrors lib/api/bearer-auth.ts (brands API).
// Separate secret per Batch 009 spec §7 and DC §13 rule 27 — blast
// radius stays bounded if one of the two tokens leaks or rotates.

export type BearerAuthFailure =
  | { ok: false; status: 500; reason: 'not_configured' }
  | { ok: false; status: 401; reason: 'missing_header' | 'wrong_token' };

export type BearerAuthResult = { ok: true } | BearerAuthFailure;

export function validateSharePointBearer(req: Request): BearerAuthResult {
  const expected = process.env.CQIP_SHAREPOINT_API_TOKEN;
  if (!expected) {
    console.error('[sharepoint-api] CQIP_SHAREPOINT_API_TOKEN not configured');
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

// Maps a bearer auth failure to the right error envelope. A missing
// CQIP_SHAREPOINT_API_TOKEN env (`not_configured`) is an ops misconfig
// and must surface as 500 `internal` — collapsing it to 401
// `unauthorized` makes it look like AC's token is wrong and routes the
// fix to the wrong side (Jenny C1 / Karen H4, 2026-05-28).
export function respondAuthFailure(auth: BearerAuthFailure): NextResponse {
  if (auth.reason === 'not_configured') {
    return errorResponse('internal', 'SharePoint proxy is not configured');
  }
  return errorResponse('unauthorized', 'Bearer token missing or invalid');
}
