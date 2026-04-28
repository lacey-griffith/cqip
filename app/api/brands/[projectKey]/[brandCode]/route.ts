import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateBearer } from '@/lib/api/bearer-auth';

// Read-only endpoint for the Forge QA-automation app. Returns one brand
// scoped by (projectKey, brandCode) when QA automation is enabled, else
// 404 — even if the row exists. Internal IDs and coverage/pause state
// are intentionally absent from the response.

const KEY_PATTERN = /^[A-Z0-9-]{1,32}$/;

const PUBLIC_FIELDS =
  'brand_code, project_key, display_name, live_url_base, default_local_sub_areas, client_contact_name, client_contact_jira_account_id, url_pattern, notes';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ projectKey: string; brandCode: string }> },
) {
  const auth = validateBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const { projectKey, brandCode } = await ctx.params;
  if (!KEY_PATTERN.test(projectKey) || !KEY_PATTERN.test(brandCode)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('brands')
    .select(PUBLIC_FIELDS)
    .eq('project_key', projectKey)
    .eq('brand_code', brandCode)
    .eq('qa_automation_enabled', true)
    .maybeSingle();

  if (error) {
    console.error('[api/brands/[projectKey]/[brandCode]] db error', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
