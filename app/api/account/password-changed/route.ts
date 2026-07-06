import { NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';

// Batch auth.2 — flag-clear coupling for the forced password change.
//
// The change-password form (settings/profile) updates the password via the
// browser's GoTrue client (supabase.auth.updateUser). The must_change_password
// flag is trigger-protected (migration 022) so the browser cannot clear it
// directly. After a successful password change the client calls this route,
// which clears the caller's OWN flag via the service role (auth.uid() IS NULL
// bypasses the r22 trigger).
//
// Self-service: any authenticated user may clear their own flag. There is no
// admin gate — the middleware forced-change gate keeps a flagged user pinned
// to the profile page until this route runs, and a user with the flag already
// unset simply gets a no-op UPDATE.

export async function POST() {
  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ must_change_password: false })
    .eq('id', user.id);

  if (error) {
    console.error('[account/password-changed] flag clear failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit the completed forced change against the user's own record.
  try {
    const changedBy = await getChangedBy(supabase);
    const { error: auditErr } = await supabaseAdmin.from('audit_log').insert({
      log_entry_id: null,
      target_type: 'user',
      target_id: user.id,
      action: 'UPDATE',
      field_name: 'must_change_password',
      old_value: 'true',
      new_value: 'false',
      changed_by: changedBy,
      notes: 'Forced password change completed by user.',
    });
    if (auditErr) {
      console.warn('[account/password-changed] audit insert failed', auditErr);
    }
  } catch (err) {
    console.warn('[account/password-changed] audit skipped', err);
  }

  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}
