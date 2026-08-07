import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateTelemetryBearer } from '@/lib/api/telemetry-bearer-auth';
import {
  validateAcEvent,
  redactDetail,
  MAX_BODY_BYTES,
} from '@/lib/telemetry/ac-telemetry';

// POST /api/telemetry/ac — AC → DC telemetry ingest. Spec:
// docs/specs/telemetry-ac.md.
//
// AC (Forge) runs only inside Jira and exposes no pollable surface, so it
// PUSHES events here and DC renders them on System Info. Bearer-authed against
// CQIP_TELEMETRY_TOKEN (its own secret per §13 r27), writes via supabaseAdmin,
// and carved out of the middleware matcher so it never touches the session
// cookie — same posture as /api/monitoring/findings and /api/brands.
//
// Fire-and-forget contract: AC swallows every failure here. That is what makes
// §4.1 of the spec necessary — a silent 400 would surface downstream as "no
// events in 7 days", which an operator reads as "AC is dead" when AC is fine.
// So every rejection is RECORDED, not just logged.
//
// No audit_log row per ingest: §13 r2 is scoped to quality_logs, and
// /api/monitoring/findings sets the precedent for external machine feeds.

const JSON_NO_STORE = { 'Cache-Control': 'no-store' } as const;

/**
 * Record a rejected payload so shape drift is visible on System Info rather
 * than masquerading as silence. Best-effort: a failure here must not change
 * the response the sender gets.
 *
 * Only reachable AFTER the bearer check passes, so an attacker without the
 * token cannot fill this table.
 */
async function recordReject(reason: string, rawExcerpt: string | null): Promise<void> {
  try {
    // supabase-js RESOLVES with { error } rather than throwing, so the
    // try/catch alone only covers network-level faults. Without destructuring
    // it, a persistent failure here (RLS drift, migration not applied,
    // constraint violation) would be recorded nowhere and logged nowhere —
    // i.e. the one write whose entire job is making rejection impossible to
    // miss would itself fail silently. Every other write in this file already
    // checks `error`; this one did not.
    const { error } = await supabaseAdmin.from('ac_telemetry_rejects').insert({
      reason,
      // Redact the FULL body, then let redactDetail truncate. Slicing first
      // would be truncate-then-redact — the exact order redactDetail's own
      // docblock argues against for future non-prefix-anchored patterns. No
      // leak either way today, but applying the argument in one path and
      // violating it in the other is how the argument stops being followed.
      detail: redactDetail(rawExcerpt),
    });
    if (error) {
      console.error('[telemetry-api] failed to record reject', error);
    }
  } catch (err) {
    console.error('[telemetry-api] failed to record reject', err);
  }
}

function badRequest(reason: string): NextResponse {
  return NextResponse.json({ error: reason }, { status: 400, headers: JSON_NO_STORE });
}

export async function POST(req: NextRequest) {
  const auth = validateTelemetryBearer(req);
  if (!auth.ok) {
    // 500 for a missing server-side token (ops misconfig — the intended
    // pre-mint state), 401 otherwise. Never echo the token or the reason.
    const message =
      auth.status === 500 ? 'Telemetry not configured' : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: auth.status, headers: JSON_NO_STORE });
  }

  // Body-size bound BEFORE parsing. Precisely: this bounds what JSON.parse
  // sees and what can reach a row — it is NOT a memory guard, because
  // req.text() has already buffered the whole body by the time we measure and
  // Content-Length is never consulted. It also bounds bytes per row, not rows
  // per token: retention is what bounds volume, and only past 90 days.
  const raw = await req.text();
  const bytes = new TextEncoder().encode(raw).length;
  if (bytes > MAX_BODY_BYTES) {
    await recordReject('body_too_large', `${bytes} bytes`);
    return badRequest(`Body too large (${bytes} > ${MAX_BODY_BYTES} bytes)`);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    await recordReject('invalid_json', raw);
    return badRequest('Invalid JSON body');
  }

  const parsed = validateAcEvent(body);
  if (!parsed.ok) {
    await recordReject(`shape:${parsed.reason}`, raw);
    return badRequest(parsed.reason);
  }
  const evt = parsed.value;

  // Dedupe on (env, commit, event, ticket, ts). ignoreDuplicates so a retry is
  // dropped rather than counted as a second incident — error paths are exactly
  // where a fire-and-forget sender retries, and the 7-day figure is a COUNT.
  const { error: insertError } = await supabaseAdmin
    .from('ac_telemetry')
    .upsert(evt, {
      onConflict: 'env,commit,event,ticket,ts',
      ignoreDuplicates: true,
    });

  if (insertError) {
    console.error('[telemetry-api] insert failed', insertError);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: JSON_NO_STORE },
    );
  }

  // First-seen ledger. NEVER pruned, and ignoreDuplicates means the FIRST
  // write wins so first_seen_at is immutable. This is what makes the render's
  // "first seen" survive retention — see migration 026 §2.
  const { error: versionError } = await supabaseAdmin
    .from('ac_version_seen')
    .upsert(
      {
        env: evt.env,
        commit: evt.commit,
        app_version: evt.app_version,
      },
      { onConflict: 'env,commit', ignoreDuplicates: true },
    );

  if (versionError) {
    // Non-fatal: the event landed. Losing a first-seen row degrades one
    // rendered line, and must not cost us the telemetry itself.
    console.error('[telemetry-api] version_seen upsert failed', versionError);
  }

  // Retention, inline rather than cron (spec §5.1): no ops step to forget, no
  // new cron surface, no edge function, no fifth shared secret. Failure is
  // swallowed — it must never fail an ingest, and the consequence (the table
  // grows) is benign and observable as row count.
  const { error: pruneError } = await supabaseAdmin.rpc('prune_ac_telemetry');
  if (pruneError) {
    console.error('[telemetry-api] prune failed', pruneError);
  }

  return NextResponse.json({ ok: true }, { status: 202, headers: JSON_NO_STORE });
}
