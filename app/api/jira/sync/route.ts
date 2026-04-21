import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

export async function POST() {
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Sync function not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/jira-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[jira/sync] edge function returned', res.status, body.slice(0, 300));
      return NextResponse.json(
        { error: 'Jira sync edge function failed' },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[jira/sync] request error', err);
    return NextResponse.json({ error: 'Unable to reach sync function' }, { status: 502 });
  }
}
