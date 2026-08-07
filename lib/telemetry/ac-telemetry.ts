// AC → DC telemetry: pure payload logic (redaction, truncation, validation).
//
// Kept free of Supabase/Next so it is directly testable — the redaction rule
// is the security-critical part of this batch and must be pinned by tests,
// not by review. Spec: docs/specs/telemetry-ac.md §3.

export const AC_EVENTS = ['draft_ok', 'draft_error', 'post_ok', 'post_error'] as const;
export type AcEvent = (typeof AC_EVENTS)[number];

export const AC_ENVS = ['dev', 'prod'] as const;
export type AcEnv = (typeof AC_ENVS)[number];

export const MAX_ERROR_DETAIL = 200;
export const MAX_BODY_BYTES = 8192;
export const REDACTED = '[REDACTED]';

// Short fields are TRUNCATED, never rejected — see validateAcEvent().
const MAX_SHORT_FIELD = 128;

/** Errors that count as errors for the 7-day "error events" figure. */
export const AC_ERROR_EVENTS: readonly AcEvent[] = ['draft_error', 'post_error'];

export interface AcTelemetryEvent {
  app_version: string;
  commit: string;
  event: AcEvent;
  ticket: string;
  error_kind: string | null;
  error_detail: string | null;
  env: AcEnv;
  ts: string; // normalized ISO-8601
}

export type ValidationResult =
  | { ok: true; value: AcTelemetryEvent }
  | { ok: false; reason: string };

// -------------------------------------------------------------------------
// Redaction
//
// CRITICAL: each pattern must consume the SECRET, not merely its marker.
// Redacting `?e=` alone would leave the token sitting right after it — the
// exact mistake this rule exists to prevent. The SharePoint case is real:
// DC's own /api/sharepoint/folder echoes the caller URL verbatim into its
// error envelope, and CRO share URLs carry a `?e=<token>` credential.
// -------------------------------------------------------------------------
const DENY_PATTERNS: readonly { readonly re: RegExp; readonly replace: string }[] = [
  // `Bearer <token>` — Authorization header echoed into an error string.
  { re: /Bearer\s+\S+/gi, replace: REDACTED },
  // JWT / Supabase key. `eyJ` is the base64 of `{"`, the standard JWT prefix.
  { re: /eyJ[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]+){0,2}/g, replace: REDACTED },
  // Credential-bearing query params: SharePoint share (`e`), Azure SAS
  // (`sig`/`sv`/`se`), OAuth (`access_token`). The separator and key are kept
  // so the message stays readable; only the VALUE is destroyed.
  {
    re: /([?&])(e|sig|sv|se|access_token)=[^&\s"']*/gi,
    replace: `$1$2=${REDACTED}`,
  },
];

/**
 * Redact credential-bearing substrings, THEN truncate to MAX_ERROR_DETAIL.
 *
 * ORDER: redact first. Be precise about why, because the obvious-sounding
 * reason is WRONG and was written down here before mutation testing killed it.
 *
 * NOT true: "truncating first could leave half a token behind." All three
 * patterns above are prefix-anchored and we truncate from the END, so a cut
 * that splits a secret still leaves the marker (`Bearer `, `eyJ`, `?e=`)
 * ahead of the surviving fragment, and a redact-after-truncate pass matches it
 * anyway. Swapping the order today changes no security outcome, and the test
 * suite provably cannot tell the two orders apart (verified by mutation).
 *
 * ACTUALLY true, and why it stays this way:
 *  1. Defensive against future patterns. The moment someone adds a rule that
 *     is not prefix-anchored — fixed-length match, trailing delimiter,
 *     lookbehind — truncate-first becomes exploitable. Redact-first is the
 *     order that survives that edit.
 *  2. Quality. Redacting first shortens the string before the cut, so more
 *     readable context survives inside the 200 chars.
 */
export function redactDetail(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  let out = String(input);
  for (const { re, replace } of DENY_PATTERNS) {
    out = out.replace(re, replace);
  }
  return out.length > MAX_ERROR_DETAIL ? out.slice(0, MAX_ERROR_DETAIL) : out;
}

function shortField(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > MAX_SHORT_FIELD ? t.slice(0, MAX_SHORT_FIELD) : t;
}

/**
 * Validate an inbound payload.
 *
 * Deliberately MINIMAL. Every rule added here is a potential silent-telemetry
 * death: AC swallows failures, so a 400 is invisible to the sender and renders
 * downstream as "no events in 7 days" — i.e. reads as "AC is dead" when AC is
 * fine (spec §4.1). So this rejects only what would break the write:
 * missing/!string required fields, the two closed enums, and an unparseable
 * `ts`. Over-long values are TRUNCATED, not rejected. Unknown keys are ignored.
 */
export function validateAcEvent(body: unknown): ValidationResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  const app_version = shortField(b.app_version);
  if (!app_version) return { ok: false, reason: 'app_version required' };

  const commit = shortField(b.commit);
  if (!commit) return { ok: false, reason: 'commit required' };

  const ticket = shortField(b.ticket);
  if (!ticket) return { ok: false, reason: 'ticket required' };

  if (typeof b.event !== 'string' || !AC_EVENTS.includes(b.event as AcEvent)) {
    return { ok: false, reason: `event must be one of ${AC_EVENTS.join('|')}` };
  }
  if (typeof b.env !== 'string' || !AC_ENVS.includes(b.env as AcEnv)) {
    return { ok: false, reason: `env must be one of ${AC_ENVS.join('|')}` };
  }

  if (typeof b.ts !== 'string') return { ok: false, reason: 'ts required (ISO-8601)' };
  const parsed = new Date(b.ts);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, reason: 'ts must be a parseable ISO-8601 timestamp' };
  }

  // error_kind is NOT validated against a list — AC owns that taxonomy, and a
  // DC-side allowlist would make an AC taxonomy addition a hard ingest failure
  // (§13 r27 blast-radius reasoning). Truncated only.
  return {
    ok: true,
    value: {
      app_version,
      commit,
      event: b.event as AcEvent,
      ticket,
      error_kind: shortField(b.error_kind),
      error_detail: redactDetail(
        typeof b.error_detail === 'string' ? b.error_detail : null,
      ),
      env: b.env as AcEnv,
      // Normalized so two spellings of the same instant collapse to one row
      // under the (env, commit, event, ticket, ts) dedupe index.
      ts: parsed.toISOString(),
    },
  };
}

/** True when the event represents a failure, for the 7-day count. */
export function isErrorEvent(event: AcEvent): boolean {
  return AC_ERROR_EVENTS.includes(event);
}
