import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';

// Admin-only: edit (PATCH) or soft-delete (DELETE) a single
// test_milestones row. Each mutation emits one audit_log row per
// changed field with changed_by derived server-side per §13 rule 19.

interface PatchBody {
  reached_at?: string;
  notes?: string | null;
  changed_by?: unknown;
}

async function requireAdmin(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>; uid: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return { ok: false, response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { ok: true, supabase, uid: user.id };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if ('changed_by' in (body ?? {})) {
    console.warn('[admin/milestones PATCH] ignored client-supplied changed_by', {
      attempted: body.changed_by,
      uid: guard.uid,
    });
  }

  if (body.reached_at && Number.isNaN(new Date(body.reached_at).getTime())) {
    return NextResponse.json({ error: 'reached_at must be a valid ISO timestamp' }, { status: 400 });
  }

  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('test_milestones')
    .select('id, reached_at, notes')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) {
    console.error('[admin/milestones PATCH] fetch failed', fetchErr);
    return NextResponse.json({ error: 'Failed to load milestone' }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
  }

  const nextNotes = body.notes === undefined
    ? current.notes
    : (typeof body.notes === 'string' && body.notes.trim().length > 0 ? body.notes.trim() : null);
  const nextReachedAt = body.reached_at ?? current.reached_at;

  const updates: Record<string, unknown> = {};
  if (nextReachedAt !== current.reached_at) updates.reached_at = nextReachedAt;
  if (nextNotes !== (current.notes ?? null)) updates.notes = nextNotes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, changed: 0 });
  }

  const { error: updateErr } = await supabaseAdmin
    .from('test_milestones')
    .update(updates)
    .eq('id', id);
  if (updateErr) {
    console.error('[admin/milestones PATCH] update failed', updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const changedBy = await getChangedBy(guard.supabase);
  const auditRows: Array<Record<string, unknown>> = [];
  if (updates.reached_at !== undefined) {
    auditRows.push({
      log_entry_id: null,
      target_type: 'test_milestone',
      target_id: id,
      action: 'UPDATE',
      field_name: 'reached_at',
      old_value: current.reached_at,
      new_value: nextReachedAt,
      changed_by: changedBy,
    });
  }
  if (updates.notes !== undefined) {
    auditRows.push({
      log_entry_id: null,
      target_type: 'test_milestone',
      target_id: id,
      action: 'UPDATE',
      field_name: 'notes',
      old_value: current.notes ?? null,
      new_value: nextNotes,
      changed_by: changedBy,
    });
  }

  const { error: auditErr } = await supabaseAdmin.from('audit_log').insert(auditRows);
  if (auditErr) {
    console.warn('[admin/milestones PATCH] audit insert failed', auditErr);
    return NextResponse.json({ ok: true, changed: auditRows.length, auditError: auditErr.message });
  }
  return NextResponse.json({ ok: true, changed: auditRows.length });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error: softErr } = await supabaseAdmin
    .from('test_milestones')
    .update({ is_deleted: true })
    .eq('id', id);
  if (softErr) {
    console.error('[admin/milestones DELETE] update failed', softErr);
    return NextResponse.json({ error: softErr.message }, { status: 500 });
  }

  const changedBy = await getChangedBy(guard.supabase);
  const { error: auditErr } = await supabaseAdmin.from('audit_log').insert({
    log_entry_id: null,
    target_type: 'test_milestone',
    target_id: id,
    action: 'DELETE',
    field_name: null,
    old_value: null,
    new_value: null,
    changed_by: changedBy,
    notes: 'Soft-deleted via admin UI',
  });
  if (auditErr) {
    console.warn('[admin/milestones DELETE] audit insert failed', auditErr);
    return NextResponse.json({ ok: true, auditError: auditErr.message });
  }
  return NextResponse.json({ ok: true });
}
