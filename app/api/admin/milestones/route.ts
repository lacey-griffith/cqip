import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';

// Admin-only: create a new test_milestones row, or restore + update a
// previously soft-deleted one (when restoreId is supplied — caller has
// already confirmed in the UI). audit_log row(s) emitted server-side
// with changed_by derived from auth.uid() per §13 rule 19.

interface CreateBody {
  jira_ticket_id?: string;
  brand_id?: string;
  brand_jira_value?: string | null;
  reached_at?: string;
  notes?: string | null;
  restoreId?: string;
  changed_by?: unknown;
}

const TICKET_PATTERN = /^[A-Z]+-\d+$/;

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

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if ('changed_by' in (body ?? {})) {
    console.warn('[admin/milestones POST] ignored client-supplied changed_by', {
      attempted: body.changed_by,
      uid: user.id,
    });
  }

  const ticket = (body.jira_ticket_id ?? '').trim().toUpperCase();
  if (!TICKET_PATTERN.test(ticket)) {
    return NextResponse.json({ error: 'jira_ticket_id must look like NBLYCRO-123' }, { status: 400 });
  }
  if (!body.brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400 });
  }
  if (!body.reached_at || Number.isNaN(new Date(body.reached_at).getTime())) {
    return NextResponse.json({ error: 'reached_at must be a valid ISO timestamp' }, { status: 400 });
  }

  const notes = typeof body.notes === 'string' && body.notes.trim().length > 0
    ? body.notes.trim()
    : null;
  const changedBy = await getChangedBy(supabase);

  // Restore-and-update path: the caller looked up a soft-deleted row
  // (admin can SELECT including is_deleted via RLS, so this lookup is
  // reliable) and confirmed they want to revive it instead of creating
  // a parallel record.
  if (body.restoreId) {
    const { error: restoreErr } = await supabaseAdmin
      .from('test_milestones')
      .update({
        is_deleted: false,
        reached_at: body.reached_at,
        notes,
        brand_id: body.brand_id,
        brand_jira_value: body.brand_jira_value ?? null,
        source: 'manual',
        created_by: changedBy,
      })
      .eq('id', body.restoreId);
    if (restoreErr) {
      console.error('[admin/milestones POST restore] failed', restoreErr);
      return NextResponse.json({ error: restoreErr.message }, { status: 500 });
    }

    const { error: auditErr } = await supabaseAdmin.from('audit_log').insert({
      log_entry_id: null,
      target_type: 'test_milestone',
      target_id: body.restoreId,
      action: 'UPDATE',
      field_name: 'is_deleted',
      old_value: 'true',
      new_value: 'false',
      changed_by: changedBy,
      notes: 'Restored via admin UI (previously soft-deleted)',
    });
    if (auditErr) {
      console.warn('[admin/milestones POST restore] audit insert failed', auditErr);
      return NextResponse.json({ ok: true, restored: true, auditError: auditErr.message });
    }
    return NextResponse.json({ ok: true, restored: true });
  }

  // Fresh create.
  const { data: inserted, error } = await supabaseAdmin
    .from('test_milestones')
    .insert({
      jira_ticket_id: ticket,
      jira_ticket_url: `https://fusion92.atlassian.net/browse/${ticket}`,
      jira_summary: null,
      brand_id: body.brand_id,
      brand_jira_value: body.brand_jira_value ?? null,
      milestone_type: 'dev_client_review',
      reached_at: body.reached_at,
      source: 'manual',
      created_by: changedBy,
      notes,
    })
    .select('id, jira_ticket_id')
    .single();

  if (error) {
    if (error.code === '23505' || (error.message ?? '').includes('duplicate')) {
      return NextResponse.json(
        { error: `A milestone already exists for ${ticket}. Edit or soft-delete the existing one first.` },
        { status: 409 },
      );
    }
    console.error('[admin/milestones POST] insert failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: auditErr } = await supabaseAdmin.from('audit_log').insert({
    log_entry_id: null,
    target_type: 'test_milestone',
    target_id: inserted!.id,
    action: 'CREATE',
    field_name: null,
    old_value: null,
    new_value: inserted!.jira_ticket_id,
    changed_by: changedBy,
    notes: 'Manual milestone added via admin UI',
  });
  if (auditErr) {
    console.warn('[admin/milestones POST] audit insert failed', auditErr);
    return NextResponse.json({ ok: true, id: inserted!.id, auditError: auditErr.message });
  }

  return NextResponse.json({ ok: true, id: inserted!.id });
}
