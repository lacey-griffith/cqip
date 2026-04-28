import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';

// Admin-only: pause / unpause a brand. Mirrors the brand QA-config
// pattern — server derives changed_by per §13 rule 19, browser cannot
// influence the audit attribution.

interface PauseBody {
  id?: string;
  paused?: boolean;
  reason?: string | null;
  changed_by?: unknown;
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

  let body: PauseBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if ('changed_by' in (body ?? {})) {
    console.warn('[admin/brands/pause] ignored client-supplied changed_by', {
      attempted: body.changed_by,
      uid: user.id,
    });
  }

  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  if (typeof body.paused !== 'boolean') {
    return NextResponse.json({ error: 'paused must be a boolean' }, { status: 400 });
  }

  const reasonTrimmed = typeof body.reason === 'string' && body.reason.trim().length > 0
    ? body.reason.trim()
    : null;

  const changedBy = await getChangedBy(supabase);

  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('brands')
    .select('id, is_paused')
    .eq('id', body.id)
    .maybeSingle();
  if (fetchErr) {
    console.error('[admin/brands/pause] fetch failed', fetchErr);
    return NextResponse.json({ error: 'Failed to load brand' }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
  }

  const updates = body.paused
    ? {
        is_paused: true,
        paused_at: new Date().toISOString(),
        paused_by: changedBy,
        paused_reason: reasonTrimmed,
      }
    : {
        is_paused: false,
        paused_at: null,
        paused_by: null,
        paused_reason: null,
      };

  const { error: updateErr } = await supabaseAdmin
    .from('brands')
    .update(updates)
    .eq('id', body.id);
  if (updateErr) {
    console.error('[admin/brands/pause] update failed', updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const { error: auditErr } = await supabaseAdmin.from('audit_log').insert({
    log_entry_id: null,
    target_type: 'brand',
    target_id: body.id,
    action: 'UPDATE',
    field_name: 'is_paused',
    old_value: String(current.is_paused),
    new_value: String(body.paused),
    changed_by: changedBy,
    notes: body.paused ? reasonTrimmed : 'Unpaused',
  });
  if (auditErr) {
    console.warn('[admin/brands/pause] audit insert failed', auditErr);
    return NextResponse.json({ ok: true, auditError: auditErr.message });
  }

  return NextResponse.json({ ok: true });
}
