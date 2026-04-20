import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';

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
    .select('role, is_active, display_name, email')
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
    const changedBy = profile.display_name || profile.email || user.id;
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
