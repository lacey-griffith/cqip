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
  // jira-sync's gateway auth accepts the anon key in both `?apikey=` and
  // `Authorization: Bearer` — this matches the curl pattern that works.
  // Using the anon key (not service role) is deliberate: the edge function
  // itself has its own admin logic, and the gateway only needs a valid key
  // to let the request through.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Sync function not configured' }, { status: 500 });
  }

  const functionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/jira-sync?apikey=${encodeURIComponent(anonKey)}`;

  try {
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(
        '[jira/sync] edge function returned non-OK',
        JSON.stringify({ status: res.status, body: body.slice(0, 500) }),
      );
      return NextResponse.json(
        { error: 'Jira sync edge function failed', status: res.status, detail: body.slice(0, 500) },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[jira/sync] request threw', err);
    return NextResponse.json({ error: 'Unable to reach sync function' }, { status: 502 });
  }
}
