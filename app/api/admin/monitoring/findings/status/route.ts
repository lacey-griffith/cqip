import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';
import { isAdminStatus } from '@/lib/client-library/monitoring';

// Batch 012 — Client Library, Phase B. Admin-only: dismiss or action a
// monitoring finding (spec §3). Mirrors the Phase A directives/status route
// exactly: cookie-bound session → admin gate → supabaseAdmin write →
// getChangedBy() server-side; client changed_by ignored with a warn; one
// audit_log row (target_type='monitoring_finding').
//
// Body: { finding_id, status, note? } where status IN ('actioned','dismissed').

interface PatchStatusBody {
  finding_id?: unknown;
  status?: unknown;
  note?: unknown;
  changed_by?: unknown;
}

function normaliseNote(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function PATCH(req: NextRequest) {
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

  let body: PatchStatusBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if ('changed_by' in (body ?? {})) {
    console.warn('[admin/monitoring/findings/status PATCH] ignored client-supplied changed_by', {
      attempted: body.changed_by,
      uid: user.id,
    });
  }

  const findingId = typeof body.finding_id === 'string' ? body.finding_id : null;
  if (!findingId) {
    return NextResponse.json({ error: 'finding_id is required' }, { status: 400 });
  }
  if (!isAdminStatus(body.status)) {
    return NextResponse.json(
      { error: "status must be one of 'actioned', 'dismissed'" },
      { status: 400 },
    );
  }
  const nextStatus = body.status;
  const noteProvided = 'note' in (body ?? {});
  const nextNote = noteProvided ? normaliseNote(body.note) : undefined;

  const { data: finding, error: fetchErr } = await supabaseAdmin
    .from('monitoring_findings')
    .select('id, status, note')
    .eq('id', findingId)
    .maybeSingle();
  if (fetchErr) {
    console.error('[admin/monitoring/findings/status PATCH] fetch failed', fetchErr);
    return NextResponse.json({ error: 'Failed to load finding' }, { status: 500 });
  }
  if (!finding) {
    return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
  }

  const changedBy = await getChangedBy(supabase);

  // Diff each editable field so no-ops are true no-ops and audit rows only
  // reflect real changes.
  const changes: { field: 'status' | 'note'; before: string | null; after: string | null }[] = [];
  if (nextStatus !== finding.status) {
    changes.push({ field: 'status', before: finding.status, after: nextStatus });
  }
  if (noteProvided && (nextNote ?? null) !== (finding.note ?? null)) {
    changes.push({ field: 'note', before: finding.note ?? null, after: nextNote ?? null });
  }

  if (changes.length === 0) {
    return NextResponse.json({ ok: true, changed: 0 });
  }

  const updatePayload: Record<string, unknown> = {
    updated_by: changedBy,
    updated_at: new Date().toISOString(),
  };
  for (const change of changes) {
    updatePayload[change.field] = change.after;
  }

  const { error: updateErr } = await supabaseAdmin
    .from('monitoring_findings')
    .update(updatePayload)
    .eq('id', finding.id);
  if (updateErr) {
    console.error('[admin/monitoring/findings/status PATCH] update failed', updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const auditRows = changes.map((change) => ({
    log_entry_id: null,
    target_type: 'monitoring_finding',
    target_id: finding.id,
    action: 'UPDATE',
    field_name: change.field,
    old_value: change.before,
    new_value: change.after,
    changed_by: changedBy,
    notes: 'Monitoring finding status edit via Client Library',
  }));

  const { error: auditErr } = await supabaseAdmin.from('audit_log').insert(auditRows);
  if (auditErr) {
    console.error('[admin/monitoring/findings/status PATCH] audit insert failed', auditErr);
    return NextResponse.json(
      { ok: true, changed: changes.length, auditError: auditErr.message },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, changed: changes.length });
}
