import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateBearer } from '@/lib/api/bearer-auth';

// Read-only list endpoint for the Forge QA-automation app. Returns the
// QA-enabled brands for a given projectKey. Disabled rows are not
// returned, matching the per-brand endpoint's "treat disabled as
// not-found" rule.

const KEY_PATTERN = /^[A-Z0-9-]{1,32}$/;

const PUBLIC_FIELDS =
  'brand_code, project_key, display_name, live_url_base, default_local_sub_areas, client_contact_name, client_contact_jira_account_id, url_pattern, notes';

export async function GET(req: NextRequest) {
  const auth = validateBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });
  }

  const projectKey = req.nextUrl.searchParams.get('projectKey');
  if (!projectKey || !KEY_PATTERN.test(projectKey)) {
    return NextResponse.json({ error: 'projectKey query parameter required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('brands')
    .select(PUBLIC_FIELDS)
    .eq('project_key', projectKey)
    .eq('qa_automation_enabled', true)
    .order('brand_code');

  if (error) {
    console.error('[api/brands] db error', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
