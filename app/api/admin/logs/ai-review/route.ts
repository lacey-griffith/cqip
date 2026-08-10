import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';
import {
  ROOT_CAUSE_TAXONOMY_FIELD,
  findInvalidTaxonomyValues,
} from '@/lib/classifier/vocabulary';
import {
  classifyReviewOutcome,
  buildReviewOutcomeAuditRow,
  type ReviewOutcome,
} from '@/lib/classifier/suggestion';

// Batch classifier-1 — AI root-cause classifier, Phase 1. COMMIT 2.
// Spec: docs/HANDOFF-root-cause-classifier.md §8 COMMIT 3, §13.1, §13.2, §13.5.
//
// ⚠ THIS ROUTE EXISTS BECAUSE §4 AND §8 COMMIT 3 CONTRADICTED EACH OTHER.
// §4 requires that a general row save leave ai_review_pending untouched — "a test,
// not a comment". §8 COMMIT 3 said the existing edit dialog handles corrections
// and clears the flag "on that path too". But there is exactly ONE edit surface
// (POST /api/logs/edit) and a general save arrives byte-identical to a correction,
// so both cannot hold. Jenny CRITICAL-2. The discriminator is this route: it is
// the ONLY writer of ai_review_pending = false, /api/logs/edit never touches the
// column, and the column is deliberately absent from that route's ALLOWED_FIELDS.
//
// DO NOT reintroduce the needs_review pattern (logs/edit route.ts:146-153, which
// clears implicitly on any save when already set). It is the established local
// convention, which is exactly why copying it is the path of least resistance —
// and it is the behaviour §4 was written to prevent.
//
// Body: { log_id, action: 'confirm'|'reject'|'correct', values?: string[] }

const ACTIONS = ['confirm', 'reject', 'correct'] as const;
type ReviewAction = (typeof ACTIONS)[number];

function isAction(v: unknown): v is ReviewAction {
  return typeof v === 'string' && (ACTIONS as readonly string[]).includes(v);
}

function isEmptyArray(v: unknown): boolean {
  return v === null || v === undefined || (Array.isArray(v) && v.length === 0);
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin-only, enforced server-side (r6, §13.8). /dashboard/reports has no
  // middleware admin gate — middleware.ts covers /dashboard/settings/* only — so
  // this check is the actual control, not a convenience.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if ('changed_by' in body) {
    console.warn('[admin/logs/ai-review POST] ignored client-supplied changed_by', {
      attempted: body.changed_by,
      uid: user.id,
    });
  }

  const logId = typeof body.log_id === 'string' ? body.log_id : null;
  if (!logId) return NextResponse.json({ error: 'log_id is required' }, { status: 400 });
  if (!isAction(body.action)) {
    return NextResponse.json(
      { error: `action must be one of: ${ACTIONS.join(', ')}` },
      { status: 400 },
    );
  }
  const action = body.action;

  // Read current state. root_cause_final is read for two reasons: the §13.1
  // write-time re-check, and the audit row's old_value.
  const { data: row, error: readError } = await supabaseAdmin
    .from('quality_logs')
    .select('id, ai_suggested_root_cause, ai_review_pending, root_cause_final')
    .eq('id', logId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: `Read failed: ${readError.message}` }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: 'Log not found' }, { status: 404 });
  if (!row.ai_review_pending) {
    // Not an error worth 500-ing: the likely cause is two reviewers, or a double
    // click. Reported as a conflict so the UI can refetch rather than retry.
    return NextResponse.json({ error: 'No AI review pending on this log' }, { status: 409 });
  }

  const suggested: string[] = Array.isArray(row.ai_suggested_root_cause)
    ? row.ai_suggested_root_cause
    : [];
  const previousRootCauseFinal: string[] | null = Array.isArray(row.root_cause_final)
    ? row.root_cause_final
    : null;

  // The values that will land in root_cause_final. 'reject' writes nothing there.
  let confirmedValues: string[] = [];
  if (action === 'confirm') {
    confirmedValues = suggested;
  } else if (action === 'correct') {
    if (!Array.isArray(body.values) || body.values.some((v) => typeof v !== 'string')) {
      return NextResponse.json(
        { error: 'correct requires values: string[]' },
        { status: 400 },
      );
    }
    confirmedValues = body.values as string[];
  }

  // ─── §13.1 — THE WRITE-TIME RE-CHECK ───
  //
  // Selection already excludes rows with a non-empty root_cause_final, so in the
  // normal case this cannot fire. It exists because selection is a SNAPSHOT and
  // §13 r37 records that a NON-EMPTY Jira value still wins on sync — so a row can
  // legitimately acquire a classification between being classified and being
  // confirmed. Without this check, Confirm would then overwrite it, invisibly,
  // which is the defect r37 was written to close.
  //
  // Refusing (rather than merging or silently skipping) is deliberate: a human
  // needs to see both values and decide, and the constrained edit dialog is where
  // that happens.
  if (action !== 'reject' && !isEmptyArray(previousRootCauseFinal)) {
    return NextResponse.json(
      {
        error: 'root_cause_final is already set',
        detail:
          'This log gained a root cause after the suggestion was made. Review it in the edit ' +
          'dialog so the existing value is not overwritten.',
        current: previousRootCauseFinal,
        suggested,
      },
      { status: 409 },
    );
  }

  // ─── r29 — re-validate against the taxonomy at write time ───
  //
  // Not a formality. The suggestion was validated at classify time and is being
  // confirmed possibly days later, and a taxonomy row can be deactivated in
  // between (is_active exists precisely so values can be retired). Trusting the
  // stored suggestion would write a retired canonical into the live column. And a
  // model-originated value read back out of a column is not a trusted input.
  //
  // Deliberately UNCONDITIONAL — no `if (confirmedValues.length > 0)` wrapper.
  // findInvalidTaxonomyValues returns [] for an empty input, so the guard bought
  // nothing except one more condition that could be flipped. A mutation that
  // wrapped this block in `if (false)` survived the suite until the logic moved
  // into a pure, separately-tested function.
  const { data: taxRows, error: taxError } = await supabaseAdmin
    .from('quality_log_taxonomy')
    .select('canonical_value')
    .eq('field_name', ROOT_CAUSE_TAXONOMY_FIELD)
    .eq('is_active', true);
  if (taxError) {
    return NextResponse.json(
      { error: `Taxonomy validation lookup failed: ${taxError.message}` },
      { status: 500 },
    );
  }
  const invalid = findInvalidTaxonomyValues(
    confirmedValues,
    (taxRows ?? []).map((r) => r.canonical_value as string),
  );
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Value(s) not in the active root_cause taxonomy: ${invalid.join(', ')}` },
      { status: 400 },
    );
  }

  const outcome: ReviewOutcome = classifyReviewOutcome(suggested, confirmedValues);

  // The update. ai_review_pending is cleared here and ONLY here.
  //
  // On reject the suggestion is cleared and root_cause_final is left untouched —
  // note it is not even a key in that branch, so it cannot be written by
  // accident (§10 item 5).
  const update: Record<string, unknown> = {
    ai_review_pending: false,
    updated_at: new Date().toISOString(),
  };
  if (action === 'reject') {
    update.ai_suggested_root_cause = null;
    update.ai_confidence_band = null;
  } else {
    update.root_cause_final = confirmedValues;
  }

  const { error: updateError } = await supabaseAdmin
    .from('quality_logs')
    .update(update)
    .eq('id', logId);
  if (updateError) {
    return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 500 });
  }

  // r19: server-derived, from the cookie-bound client. Never the request body.
  const changedBy = await getChangedBy(supabase);

  const rows = [
    buildReviewOutcomeAuditRow(logId, outcome, previousRootCauseFinal, changedBy),
  ];
  // A separate row for the canonical-field write, so the trail shows the value
  // change and not only the outcome classification.
  if (action !== 'reject') {
    rows.push({
      log_entry_id: logId,
      target_type: 'quality_log',
      target_id: logId,
      action: 'UPDATE',
      field_name: 'root_cause_final',
      old_value: previousRootCauseFinal === null ? null : JSON.stringify(previousRootCauseFinal),
      new_value: JSON.stringify(confirmedValues),
      changed_by: changedBy,
      notes: `AI review: ${action} (${outcome})`,
    });
  }

  const { error: auditError } = await supabaseAdmin.from('audit_log').insert(rows);
  if (auditError) {
    // Surfaced, not swallowed. The data landed, so this is not a failure of the
    // action — but a missing trail on a write into the canonical field is exactly
    // what made the sync-guard defect invisible for ten weeks.
    console.error('[admin/logs/ai-review] audit write failed', { log_id: logId, error: auditError });
    return NextResponse.json({
      ok: true,
      outcome,
      warning: `Review applied, but ${rows.length} audit row(s) failed to write: ${auditError.message}`,
    });
  }

  return NextResponse.json({ ok: true, outcome });
}
