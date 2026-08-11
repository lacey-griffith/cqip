import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';
import { buildClassifierPayload, CLASSIFIER_READ_FIELDS } from '@/lib/classifier/payload';
import { checkVocabulary, ROOT_CAUSE_TAXONOMY_FIELD } from '@/lib/classifier/vocabulary';
import { deriveConfidenceBand } from '@/lib/classifier/confidence';
import { buildClassifierUpdate, buildSuggestionAuditRow } from '@/lib/classifier/suggestion';
import {
  requestClassification,
  ClassifierNotConfiguredError,
  CLASSIFIER_API_KEY_ENV,
} from '@/lib/classifier/model';

// Batch classifier-1 — AI root-cause classifier, Phase 1. COMMIT 2.
// Spec: docs/HANDOFF-root-cause-classifier.md §8 COMMIT 2, §13.6, §13.7.
//
// Admin-only, manual-trigger. NO CRON (§9) — this route is not wired to pg_cron
// or deploy.yml, and it deliberately introduces no new scheduling surface.
//
// Mirrors the house admin-route pattern (see admin/monitoring/findings/status):
// cookie-bound session → admin gate → supabaseAdmin write → getChangedBy()
// server-side, client changed_by ignored with a warn (§13 r19).
//
// ⚠ THIS ROUTE NEVER WRITES root_cause_final. That is the #1 non-negotiable, and
// it is enforced structurally rather than by review: the update object comes only
// from buildClassifierUpdate(), which returns exactly three keys, and a test
// asserts that key set. See lib/classifier/suggestion.ts.
//
// ⚠ SHIPS INERT. No model credential exists on the Worker yet (verified
// 2026-08-10: 16 secrets, none of them a model key), so until CQIP_ANTHROPIC_API_KEY
// is minted this answers 500 not_configured — deployable and inert, exactly the
// Batch telemetry-ac precedent.

export const BATCH_CAP = 25; // §11.3, LOCKED by Lacey.

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Read the body only to warn about a client-supplied changed_by (r19). There
  // are no other accepted inputs — in particular no batch size and no field
  // name, because §11.3 locks the cap and §9 forbids classifying anything but
  // root_cause in Phase 1. A missing or unparseable body is fine.
  const body = await req.json().catch(() => ({}));
  if (body && typeof body === 'object' && 'changed_by' in body) {
    console.warn('[admin/logs/classify POST] ignored client-supplied changed_by', {
      attempted: (body as Record<string, unknown>).changed_by,
      uid: user.id,
    });
  }

  // Fail fast before touching the database, so an unconfigured deploy is
  // unambiguous rather than reported as an empty batch.
  if (!process.env[CLASSIFIER_API_KEY_ENV]) {
    return NextResponse.json(
      { error: 'not_configured', detail: `${CLASSIFIER_API_KEY_ENV} is not set` },
      { status: 500 },
    );
  }

  const triggeredBy = await getChangedBy(supabase);

  // Vocabulary from the database, never a hardcoded list or count (§13.3).
  // field_name is 'root_cause' — singular — because one Jira field backs both
  // root_cause_initial and root_cause_final.
  const { data: taxRows, error: taxError } = await supabaseAdmin
    .from('quality_log_taxonomy')
    .select('canonical_value')
    .eq('field_name', ROOT_CAUSE_TAXONOMY_FIELD)
    .eq('is_active', true);

  if (taxError) {
    return NextResponse.json(
      { error: `Taxonomy lookup failed: ${taxError.message}` },
      { status: 500 },
    );
  }
  const vocabulary = (taxRows ?? []).map((r) => r.canonical_value as string);
  if (vocabulary.length === 0) {
    return NextResponse.json(
      { error: 'Active root_cause vocabulary is empty — refusing to classify' },
      { status: 500 },
    );
  }

  // §13.6 selection. Every clause earns its place:
  //   is_deleted = false                  — soft-deleted rows are not work
  //   ai_review_pending = false           — never clobber pending review state
  //   ai_suggested_root_cause IS NULL     — never re-suggest; makes re-runs idempotent
  //   root_cause_final empty              — §13.1, so Confirm can never destroy
  //                                         a human classification
  //
  // The select is narrowed to the eight readable fields plus id (§13.9). It is
  // deliberately NOT select('*'): with a full row in scope one variable away from
  // the payload, JSON.stringify(row) into a prompt is an easy accident. The
  // payload test would still catch it, but a narrow select makes it hard to make.
  const { data: candidates, error: selectError } = await supabaseAdmin
    .from('quality_logs')
    .select(['id', ...CLASSIFIER_READ_FIELDS].join(', '))
    .eq('is_deleted', false)
    .eq('ai_review_pending', false)
    .is('ai_suggested_root_cause', null)
    .or('root_cause_final.is.null,root_cause_final.eq.{}')
    .order('triggered_at', { ascending: false })
    .limit(BATCH_CAP);

  if (selectError) {
    return NextResponse.json(
      { error: `Candidate selection failed: ${selectError.message}` },
      { status: 500 },
    );
  }

  const rows = (candidates ?? []) as unknown as Array<Record<string, unknown> & { id: string }>;

  // Zero eligible rows is a count, not an error (§13.6) — it is the expected
  // steady state once the queue is drained.
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, classified: 0, skipped: 0, dropped: [], eligible: 0 });
  }

  let classified = 0;
  let skipped = 0;
  const droppedLog: Array<{ log_id: string; dropped: string[] }> = [];
  const failures: Array<{ log_id: string; error: string }> = [];

  for (const row of rows) {
    try {
      const payload = buildClassifierPayload(row);
      const raw = await requestClassification(payload, vocabulary);

      const { accepted, dropped } = checkVocabulary(
        Array.isArray(raw.root_causes) ? raw.root_causes : [],
        vocabulary,
      );

      // §7: out-of-vocabulary output is dropped and LOGGED, never stored, and the
      // vocabulary is never widened to accommodate it. Logged to the response and
      // the console rather than to a table — Phase 1 has no store for it, and
      // inventing one would be schema this batch does not own.
      if (dropped.length > 0) {
        console.warn('[admin/logs/classify] dropped out-of-vocabulary values', {
          log_id: row.id,
          dropped,
        });
        droppedLog.push({ log_id: row.id, dropped });
      }

      // Every value the model returned was invented. Writing an empty suggestion
      // would put a row in the review queue with nothing to review, so skip it.
      if (accepted.length === 0) {
        skipped += 1;
        continue;
      }

      const band = deriveConfidenceBand(raw.confidence);
      const update = buildClassifierUpdate(accepted, band);

      const { error: updateError } = await supabaseAdmin
        .from('quality_logs')
        .update(update)
        .eq('id', row.id);
      if (updateError) throw new Error(`update failed: ${updateError.message}`);

      // §13 r2 — audit every write. Emitted AFTER the update succeeds, and its
      // own failure is surfaced rather than swallowed: the sync-guard batch's
      // Karen HIGH was precisely an audit failure that exited 0.
      const { error: auditError } = await supabaseAdmin
        .from('audit_log')
        .insert(buildSuggestionAuditRow(row.id, accepted, band, triggeredBy, raw.served_model));
      if (auditError) {
        console.error('[admin/logs/classify] audit write failed', {
          log_id: row.id,
          error: auditError,
        });
        failures.push({ log_id: row.id, error: `audit write failed: ${auditError.message}` });
      }

      classified += 1;
    } catch (err) {
      // Per-row isolation: one bad row must not abandon the rest of the batch.
      // A not-configured error mid-loop cannot happen (checked above) but is
      // re-thrown rather than counted, because it is not a row-level problem.
      if (err instanceof ClassifierNotConfiguredError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      console.error('[admin/logs/classify] row failed', { log_id: row.id, error: message });
      failures.push({ log_id: row.id, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    eligible: rows.length,
    classified,
    skipped,
    dropped: droppedLog,
    failures,
  });
}
