import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';
import {
  duplicateTitleMessage,
  fanOutCells,
  isDirectiveType,
  type DirectiveType,
} from '@/lib/client-library/directives';

// Batch 012 — Client Library, Phase A. Admin-only: create a directive and
// fan out one directive_brand_status cell per ACTIVE brand in the project
// (spec §2/§3.1).
//
// Mirrors app/api/admin/brands/route.ts exactly:
// - Cookie-bound supabase client validates the admin session.
// - Service-role client performs the insert + fan-out + audit writes.
// - changed_by is server-derived via getChangedBy() per §13 rule 19; any
//   client-supplied changed_by in the body is ignored with a forensic warn.
//
// Audit: one row per directive field (action='CREATE', target_type=
// 'directive') PLUS a single summary row for the fan-out — NOT N rows.

interface CreateDirectiveBody {
  project_key?: unknown;
  title?: unknown;
  directive_type?: unknown;
  description?: unknown;
  changed_by?: unknown;
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

  let body: CreateDirectiveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // §13 rule 19: changed_by is server-derived. Anything on a client-supplied
  // changed_by key is ignored with a forensic warn.
  if ('changed_by' in (body ?? {})) {
    console.warn('[admin/directives POST] ignored client-supplied changed_by', {
      attempted: body.changed_by,
      uid: user.id,
    });
  }

  const projectKey = asTrimmedString(body.project_key);
  if (!projectKey) {
    return NextResponse.json({ error: 'project_key is required' }, { status: 400 });
  }

  const title = asTrimmedString(body.title);
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  if (!isDirectiveType(body.directive_type)) {
    return NextResponse.json(
      { error: "directive_type must be one of 'goal', 'trigger', 'site_area', 'audience'" },
      { status: 400 },
    );
  }
  const directiveType: DirectiveType = body.directive_type;

  const description = asTrimmedString(body.description); // optional → null

  // Project must exist and be active. Cookie-bound client is fine —
  // projects has an authenticated SELECT policy.
  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .select('jira_project_key, is_active')
    .eq('jira_project_key', projectKey)
    .maybeSingle();
  if (projectErr) {
    console.error('[admin/directives POST] project lookup failed', projectErr);
    return NextResponse.json({ error: 'Failed to verify project' }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: `Project "${projectKey}" not found` }, { status: 400 });
  }
  if (!project.is_active) {
    return NextResponse.json({ error: `Project "${projectKey}" is not active` }, { status: 400 });
  }

  // ---------------------------------------------------------------------
  // Duplicate title — added by directive CRUD (spec §5), and NOT optional once
  // migration 029 exists.
  //
  // Before 029 this route silently minted duplicates (the long-standing backlog
  // gap, and the reason countHiddenByFilters had to mitigate on the render
  // side). After 029 the index rejects them — but the insert-error path below
  // returns `insertErr.message` with a 500, so without this the inline create
  // strip would surface `duplicate key value violates unique constraint
  // "idx_directives_project_title"` to an admin who simply retyped a title.
  //
  // Two layers, because a pre-check is NOT a lock: two concurrent creates both
  // pass it and the index catches one. The pre-check gives the good message;
  // the 23505 mapping below makes the race land on the same answer.
  //
  // Spans ARCHIVED titles too, matching the index (§5.1) — so the message says
  // so, otherwise "already exists" is baffling when no such directive is
  // visible on the matrix.
  const { data: clash, error: clashErr } = await supabaseAdmin
    .from('directives')
    .select('id')
    .eq('project_key', projectKey)
    .eq('title', title)
    .maybeSingle();
  if (clashErr) {
    console.error('[admin/directives POST] duplicate pre-check failed', clashErr);
    return NextResponse.json({ error: 'Failed to check for duplicate title' }, { status: 500 });
  }
  if (clash) {
    return NextResponse.json({ error: duplicateTitleMessage(title, projectKey) }, { status: 409 });
  }

  const changedBy = await getChangedBy(supabase);

  // Insert the directive.
  const newRow = {
    project_key: projectKey,
    title,
    directive_type: directiveType,
    description,
    status: 'active' as const,
    created_by: changedBy,
  };

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('directives')
    .insert(newRow)
    .select('id, project_key, title, directive_type, description, status, created_by, created_at, updated_at')
    .single();
  if (insertErr || !inserted) {
    // The race the pre-check above cannot close. Same 409, same message — an
    // admin must never see a Postgres constraint name.
    if (insertErr?.code === '23505') {
      return NextResponse.json({ error: duplicateTitleMessage(title, projectKey) }, { status: 409 });
    }
    console.error('[admin/directives POST] insert failed', insertErr);
    return NextResponse.json({ error: insertErr?.message ?? 'Failed to insert directive' }, { status: 500 });
  }

  // Fan-out per §2: one cell per ACTIVE brand in the project. Paused brands
  // land 'n_a'; non-paused land 'todo'. Empty brand set is valid (no cells).
  const { data: brands, error: brandsErr } = await supabaseAdmin
    .from('brands')
    .select('id, is_paused')
    .eq('project_key', projectKey)
    .eq('is_active', true);
  if (brandsErr) {
    console.error('[admin/directives POST] brand fetch for fan-out failed', brandsErr);
    // The directive row already exists; surface the failure without rolling
    // back so the admin can re-run the fan-out path later. Cells missing is
    // recoverable (a follow-on could backfill), the directive is not lost.
    return NextResponse.json(
      { ok: true, directive: inserted, cells_created: 0, fanOutError: brandsErr.message },
      { status: 200 },
    );
  }

  const cells = fanOutCells(inserted.id, (brands ?? []) as { id: string; is_paused: boolean }[]);
  let cellsCreated = 0;
  if (cells.length > 0) {
    const { error: cellsErr } = await supabaseAdmin.from('directive_brand_status').insert(cells);
    if (cellsErr) {
      console.error('[admin/directives POST] fan-out insert failed', cellsErr);
      return NextResponse.json(
        { ok: true, directive: inserted, cells_created: 0, fanOutError: cellsErr.message },
        { status: 200 },
      );
    }
    cellsCreated = cells.length;
  }

  // Audit: one row per directive field (action='CREATE') + a single summary
  // row for the fan-out (NOT N rows — spec §3.1).
  const directiveFields: { field: string; value: string | null }[] = [
    { field: 'project_key', value: projectKey },
    { field: 'title', value: title },
    { field: 'directive_type', value: directiveType },
    { field: 'description', value: description },
    { field: 'status', value: 'active' },
  ];
  const auditRows = directiveFields.map(({ field, value }) => ({
    log_entry_id: null,
    target_type: 'directive',
    target_id: inserted.id,
    action: 'CREATE',
    field_name: field,
    old_value: null,
    new_value: value,
    changed_by: changedBy,
    notes: 'Directive created via Client Library',
  }));
  auditRows.push({
    log_entry_id: null,
    target_type: 'directive',
    target_id: inserted.id,
    action: 'CREATE',
    field_name: 'directive_brand_status',
    old_value: null,
    new_value: `fanned out to ${cellsCreated} brands`,
    changed_by: changedBy,
    notes: 'Directive created via Client Library',
  });

  const { error: auditErr } = await supabaseAdmin.from('audit_log').insert(auditRows);
  if (auditErr) {
    // Audit failed but the directive + cells exist. Mirror the qa-config /
    // brands pattern — surface the audit error without rolling back.
    console.error('[admin/directives POST] audit insert failed', auditErr);
    return NextResponse.json(
      { ok: true, directive: inserted, cells_created: cellsCreated, auditError: auditErr.message },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, directive: inserted, cells_created: cellsCreated }, { status: 201 });
}
