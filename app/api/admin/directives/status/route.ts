import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';
import { isCellStatus } from '@/lib/client-library/directives';

// Batch 012 — Client Library, Phase A. Admin-only: set one matrix cell's
// status + note (spec §3.2). The cell must already exist (created by the
// directive fan-out); 404 if not.
//
// Mirrors the qa-config route: cookie-bound session → admin gate →
// supabaseAdmin write → getChangedBy() server-side; client changed_by
// ignored with a warn; one audit_log row per changed field.

interface PatchStatusBody {
  directive_id?: unknown;
  brand_id?: unknown;
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
    console.warn('[admin/directives/status PATCH] ignored client-supplied changed_by', {
      attempted: body.changed_by,
      uid: user.id,
    });
  }

  const directiveId = typeof body.directive_id === 'string' ? body.directive_id : null;
  const brandId = typeof body.brand_id === 'string' ? body.brand_id : null;
  if (!directiveId) {
    return NextResponse.json({ error: 'directive_id is required' }, { status: 400 });
  }
  if (!brandId) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400 });
  }
  if (!isCellStatus(body.status)) {
    return NextResponse.json(
      { error: "status must be one of 'todo', 'in_progress', 'done', 'blocked', 'n_a'" },
      { status: 400 },
    );
  }
  const nextStatus = body.status;
  const noteProvided = 'note' in (body ?? {});
  const nextNote = noteProvided ? normaliseNote(body.note) : undefined;

  // Cell must already exist from fan-out (§3.2). Look it up by the unique
  // (directive_id, brand_id) pair.
  const { data: cell, error: fetchErr } = await supabaseAdmin
    .from('directive_brand_status')
    .select('id, status, note')
    .eq('directive_id', directiveId)
    .eq('brand_id', brandId)
    .maybeSingle();
  if (fetchErr) {
    console.error('[admin/directives/status PATCH] fetch failed', fetchErr);
    return NextResponse.json({ error: 'Failed to load cell' }, { status: 500 });
  }
  if (!cell) {
    return NextResponse.json({ error: 'Matrix cell not found' }, { status: 404 });
  }

  const changedBy = await getChangedBy(supabase);

  // Diff each editable field so no-ops are true no-ops and audit rows only
  // reflect real changes.
  const changes: { field: 'status' | 'note'; before: string | null; after: string | null }[] = [];
  if (nextStatus !== cell.status) {
    changes.push({ field: 'status', before: cell.status, after: nextStatus });
  }
  if (noteProvided && (nextNote ?? null) !== (cell.note ?? null)) {
    changes.push({ field: 'note', before: cell.note ?? null, after: nextNote ?? null });
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
    .from('directive_brand_status')
    .update(updatePayload)
    .eq('id', cell.id);
  if (updateErr) {
    console.error('[admin/directives/status PATCH] update failed', updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const auditRows = changes.map((change) => ({
    log_entry_id: null,
    target_type: 'directive_brand_status',
    target_id: cell.id,
    action: 'UPDATE',
    field_name: change.field,
    old_value: change.before,
    new_value: change.after,
    changed_by: changedBy,
    notes: 'Directive cell status edit via Client Library',
  }));

  const { error: auditErr } = await supabaseAdmin.from('audit_log').insert(auditRows);
  if (auditErr) {
    console.error('[admin/directives/status PATCH] audit insert failed', auditErr);
    return NextResponse.json(
      { ok: true, changed: changes.length, auditError: auditErr.message },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, changed: changes.length });
}
