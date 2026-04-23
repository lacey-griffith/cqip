import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

// Proxy route for the jira-sync Supabase Edge Function. Keeps admin-only
// gating here even though the edge function has its own auth, so an anon
// caller can't hammer the function from the browser.
//
// Batch 003 diagnostic pass: on non-2xx the route now folds the edge
// function's body into the top-level `error` field so the client-side
// toast surfaces the real failure string instead of 'Sync failed'.

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
    console.error('[api/jira/sync] missing env vars', {
      urlPresent: Boolean(supabaseUrl),
      keyPresent: Boolean(anonKey),
    });
    return NextResponse.json(
      { error: 'Server misconfigured — contact admin' },
      { status: 500 },
    );
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
        '[api/jira/sync] edge function returned non-OK',
        JSON.stringify({ status: res.status, body: body.slice(0, 500) }),
      );
      const detail = body ? `: ${body.slice(0, 120)}` : '';
      return NextResponse.json(
        { error: `Sync service returned ${res.status}${detail}` },
        { status: 502 },
      );
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/jira/sync] fetch threw', msg);
    return NextResponse.json(
      { error: `Network error calling sync service: ${msg}` },
      { status: 502 },
    );
  }
}
