import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

// Proxy route for the jira-sync Supabase Edge Function. Keeps admin-only
// gating here even though the edge function has its own auth, so an anon
// caller can't hammer the function from the browser.
//
// Auth to the edge function uses CQIP_SYNC_AUTH_KEY — a custom shared
// secret set with matching values on Supabase (via `supabase secrets set`)
// and Cloudflare Worker (via `wrangler secret put`). This decouples the
// handshake from any Supabase-managed key rotation (Batch 003.5 after
// the ECC-signing migration broke SUPABASE_SERVICE_ROLE_KEY parity
// between the two runtimes).

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
  const syncAuthKey = process.env.CQIP_SYNC_AUTH_KEY;

  if (!supabaseUrl || !syncAuthKey) {
    console.error('[api/jira/sync] missing env vars', {
      urlPresent: Boolean(supabaseUrl),
      syncAuthKeyPresent: Boolean(syncAuthKey),
    });
    return NextResponse.json(
      {
        error: syncAuthKey
          ? 'Server misconfigured — contact admin'
          : 'CQIP_SYNC_AUTH_KEY not configured on Worker — run `wrangler secret put CQIP_SYNC_AUTH_KEY`',
      },
      { status: 500 },
    );
  }

  const functionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/jira-sync?apikey=${encodeURIComponent(syncAuthKey)}`;

  try {
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${syncAuthKey}`,
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
