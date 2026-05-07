import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';

// Admin-only: create a new brand row. Closes audit Q1 from
// docs/multi-client-readiness.md §10 / §6.5 — brand seeding has been
// SQL-only until now, which becomes a friction point at client-3+.
//
// Mirrors the qa-config / pause patterns:
// - Cookie-bound supabase client validates the admin session.
// - Service-role client performs the insert + audit writes.
// - changed_by is derived server-side via getChangedBy() per §13 rule 19;
//   any client-supplied changed_by in the body is ignored with a
//   forensic warn.
//
// Audit writes: one row per submitted field with target_type='brand',
// target_id=<new brand id>, action='CREATE', field_name=<column>,
// new_value=<serialized value>. old_value is null since the row didn't
// exist before.

const BRAND_CODE_PATTERN = /^[A-Z0-9-]{1,32}$/;

interface CreateBrandBody {
  project_key?: unknown;
  brand_code?: unknown;
  jira_value?: unknown;
  display_name?: unknown;
  is_active?: unknown;
  is_paused?: unknown;
  changed_by?: unknown;
}

interface NewBrandRow {
  project_key: string;
  brand_code: string;
  jira_value: string;
  display_name: string;
  is_active: boolean;
  is_paused: boolean;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

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

  let body: CreateBrandBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if ('changed_by' in (body ?? {})) {
    console.warn('[admin/brands POST] ignored client-supplied changed_by', {
      attempted: body.changed_by,
      uid: user.id,
    });
  }

  const projectKey = asTrimmedString(body.project_key);
  if (!projectKey) {
    return NextResponse.json({ error: 'project_key is required' }, { status: 400 });
  }

  const brandCodeRaw = asTrimmedString(body.brand_code);
  if (!brandCodeRaw) {
    return NextResponse.json({ error: 'brand_code is required' }, { status: 400 });
  }
  const brandCode = brandCodeRaw.toUpperCase();
  if (!BRAND_CODE_PATTERN.test(brandCode)) {
    return NextResponse.json(
      { error: 'brand_code must be 1-32 chars: uppercase letters, digits, hyphens only' },
      { status: 400 },
    );
  }

  const jiraValue = asTrimmedString(body.jira_value);
  if (!jiraValue) {
    return NextResponse.json({ error: 'jira_value is required' }, { status: 400 });
  }

  const displayName = asTrimmedString(body.display_name);
  if (!displayName) {
    return NextResponse.json({ error: 'display_name is required' }, { status: 400 });
  }

  const isActive = asBoolean(body.is_active, true);
  const isPaused = asBoolean(body.is_paused, false);

  // Project must exist and be active. Using the cookie-bound client is
  // fine here — projects has an authenticated SELECT policy.
  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .select('jira_project_key, is_active')
    .eq('jira_project_key', projectKey)
    .maybeSingle();
  if (projectErr) {
    console.error('[admin/brands POST] project lookup failed', projectErr);
    return NextResponse.json({ error: 'Failed to verify project' }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: `Project "${projectKey}" not found` }, { status: 400 });
  }
  if (!project.is_active) {
    return NextResponse.json({ error: `Project "${projectKey}" is not active` }, { status: 400 });
  }

  // Duplicate check: (project_key, brand_code) is logically unique even
  // though no DB constraint enforces it (see schema in §5). Surface a
  // 409 so the form can keep state and let the user adjust.
  const { data: existing, error: dupeErr } = await supabaseAdmin
    .from('brands')
    .select('id')
    .eq('project_key', projectKey)
    .eq('brand_code', brandCode)
    .maybeSingle();
  if (dupeErr) {
    console.error('[admin/brands POST] duplicate check failed', dupeErr);
    return NextResponse.json({ error: 'Failed to check for duplicates' }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(
      { error: `Brand "${brandCode}" already exists on project "${projectKey}"` },
      { status: 409 },
    );
  }

  // brands.jira_value has a UNIQUE constraint instance-wide. Catch
  // collisions explicitly so the error message is actionable.
  const { data: jiraValueClash } = await supabaseAdmin
    .from('brands')
    .select('id, project_key, brand_code')
    .eq('jira_value', jiraValue)
    .maybeSingle();
  if (jiraValueClash) {
    return NextResponse.json(
      {
        error: `jira_value "${jiraValue}" is already in use by ${jiraValueClash.project_key}/${jiraValueClash.brand_code}. Brand jira_value must be unique across all projects.`,
      },
      { status: 409 },
    );
  }

  const newRow: NewBrandRow = {
    project_key: projectKey,
    brand_code: brandCode,
    jira_value: jiraValue,
    display_name: displayName,
    is_active: isActive,
    is_paused: isPaused,
  };

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('brands')
    .insert(newRow)
    .select('id, project_key, brand_code, jira_value, display_name, is_active, is_paused, paused_at, paused_by, paused_reason, created_at')
    .single();
  if (insertErr || !inserted) {
    console.error('[admin/brands POST] insert failed', insertErr);
    return NextResponse.json({ error: insertErr?.message ?? 'Failed to insert brand' }, { status: 500 });
  }

  const changedBy = await getChangedBy(supabase);

  // One audit row per submitted field. action='CREATE' on every row;
  // old_value is null because the row didn't exist before.
  const auditRows = (Object.keys(newRow) as (keyof NewBrandRow)[]).map((field) => ({
    log_entry_id: null,
    target_type: 'brand',
    target_id: inserted.id,
    action: 'CREATE',
    field_name: field,
    old_value: null,
    new_value: typeof newRow[field] === 'boolean' ? String(newRow[field]) : (newRow[field] as string),
    changed_by: changedBy,
    notes: 'Brand created via admin UI',
  }));

  const { error: auditErr } = await supabaseAdmin.from('audit_log').insert(auditRows);
  if (auditErr) {
    // Audit failed but the brand exists. Mirror the qa-config pattern —
    // surface the audit error in the response without rolling back the
    // brand insert.
    console.error('[admin/brands POST] audit insert failed', auditErr);
    return NextResponse.json(
      { ok: true, brand: inserted, auditError: auditErr.message },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, brand: inserted }, { status: 201 });
}
