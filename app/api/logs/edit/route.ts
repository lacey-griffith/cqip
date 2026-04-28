import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';

interface EditPayload {
  id: string;
  updates: {
    log_status?: string;
    severity?: string | null;
    who_owns_fix?: string | null;
    root_cause_final?: string[] | null;
    resolution_notes?: string | null;
    notes?: string | null;
  };
  diffs: Array<{
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }>;
}

const ALLOWED_FIELDS = new Set([
  'log_status',
  'severity',
  'who_owns_fix',
  'root_cause_final',
  'resolution_notes',
  'notes',
]);

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

  let body: EditPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body?.id || !body?.updates) {
    return NextResponse.json({ error: 'id and updates are required' }, { status: 400 });
  }

  // Whitelist fields.
  const sanitizedUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.updates)) {
    if (ALLOWED_FIELDS.has(key)) {
      sanitizedUpdates[key] = value;
    }
  }
  if (Object.keys(sanitizedUpdates).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 });
  }

  // Perform the update through the user's cookie-bound client so quality_logs
  // RLS policies still apply.
  const { error: updateError } = await supabase
    .from('quality_logs')
    .update(sanitizedUpdates)
    .eq('id', body.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Audit rows go through the service role so the table can keep direct
  // authenticated writes disabled (see migration 005).
  const diffs = Array.isArray(body.diffs)
    ? body.diffs.filter(d => d && typeof d.field === 'string' && ALLOWED_FIELDS.has(d.field))
    : [];

  if (diffs.length > 0) {
    const changedBy = await getChangedBy(supabase);
    const rows = diffs.map(d => ({
      log_entry_id: body.id,
      action: d.field === 'log_status' ? 'STATUS_CHANGE' : 'UPDATE',
      field_name: d.field,
      old_value: d.oldValue,
      new_value: d.newValue,
      changed_by: changedBy,
    }));

    const { error: auditError } = await supabaseAdmin.from('audit_log').insert(rows);
    if (auditError) {
      console.warn('[logs/edit] audit_log insert failed', auditError);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
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

  const body = await req.json().catch(() => ({}));
  const queryId = new URL(req.url).searchParams.get('id') ?? undefined;
  const id = (body?.id as string | undefined) ?? queryId;
  const mode = body?.mode as string | undefined;
  const jiraTicketId = body?.jira_ticket_id as string | undefined;
  const changedBy = await getChangedBy(supabase);

  // -----------------------------------------------------------------------
  // Batch mode: soft-delete every non-deleted log for a jira_ticket_id.
  // -----------------------------------------------------------------------
  if (mode === 'ticket') {
    if (!jiraTicketId) {
      return NextResponse.json({ error: 'jira_ticket_id is required for batch delete' }, { status: 400 });
    }

    const { data: targets, error: fetchError } = await supabase
      .from('quality_logs')
      .select('id, log_number, log_status, severity')
      .eq('jira_ticket_id', jiraTicketId)
      .eq('is_deleted', false);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!targets || targets.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    const { error: softError } = await supabase
      .from('quality_logs')
      .update({ is_deleted: true })
      .eq('jira_ticket_id', jiraTicketId)
      .eq('is_deleted', false);

    if (softError) {
      return NextResponse.json({ error: softError.message }, { status: 500 });
    }

    const auditRows = targets.map(t => ({
      log_entry_id: t.id,
      action: 'DELETE',
      field_name: 'is_deleted',
      old_value: 'false',
      new_value: 'true',
      changed_by: changedBy,
      notes: `Batch soft-delete of ${jiraTicketId} log #${t.log_number} (was ${t.log_status}${t.severity ? `, ${t.severity}` : ''})`,
    }));
    const { error: auditError } = await supabaseAdmin.from('audit_log').insert(auditRows);
    if (auditError) {
      console.warn('[logs/edit DELETE ticket] audit_log insert failed', auditError);
    }

    return NextResponse.json({ success: true, deleted: targets.length });
  }

  // -----------------------------------------------------------------------
  // Single-row mode: soft-delete one log by id.
  // -----------------------------------------------------------------------
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('quality_logs')
    .select('jira_ticket_id, log_status, severity, log_number, is_deleted')
    .eq('id', id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Log not found' }, { status: 404 });
  }
  if (existing.is_deleted) {
    return NextResponse.json({ success: true, already: true });
  }

  const { error: softDeleteError } = await supabase
    .from('quality_logs')
    .update({ is_deleted: true })
    .eq('id', id);

  if (softDeleteError) {
    return NextResponse.json({ error: softDeleteError.message }, { status: 500 });
  }

  const { error: auditError } = await supabaseAdmin.from('audit_log').insert({
    log_entry_id: id,
    action: 'DELETE',
    field_name: 'is_deleted',
    old_value: 'false',
    new_value: 'true',
    changed_by: changedBy,
    notes: `Soft-delete of ${existing.jira_ticket_id} log #${existing.log_number} (was ${existing.log_status}${existing.severity ? `, ${existing.severity}` : ''})`,
  });
  if (auditError) {
    console.warn('[logs/edit DELETE] audit_log insert failed', auditError);
  }

  return NextResponse.json({ success: true });
}
