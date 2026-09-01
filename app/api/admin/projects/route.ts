import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';
import {
  BRAND_CODE_PATTERN,
  PROJECT_KEY_PATTERN,
  isBrandModel,
  validateBrandConfig,
  type BrandModel,
} from '@/lib/onboarding/project-config';

// Batch "single-brand onboarding" §2.1 — admin-only project create + edit.
//
// Spec: docs/specs/batch-single-brand-onboarding.md. Cite by section number.
//
// WHY THIS ROUTE EXISTS. Before this, app/dashboard/settings/projects/page.tsx
// wrote projects with a DIRECT BROWSER SUPABASE INSERT — four columns, no server
// route, no audit rows, and no way to reach brand_model / brand_jira_field_id /
// default_brand_id at all. A project was therefore always created with
// brand_model='multi_brand' and brand_jira_field_id='customfield_12220' by
// column default, silently, with no error and no edit path afterwards (§0.1-0.2).
// HDCRO is live in that state.
//
// Mirrors app/api/admin/brands/route.ts exactly: cookie-bound client validates
// the admin session, supabaseAdmin performs the write, changed_by is derived
// server-side per CLAUDE.md §13 rule 19, one audit row per submitted field, and
// an audit failure surfaces in the response WITHOUT rolling back the write.
//
// jira_project_key is immutable after creation. It is the join column for
// brands.project_key and quality_logs.project_key, neither of which has an FK to
// projects — renaming it would orphan every row that references it, silently.

const CREATE_NOTE = 'Project created via admin UI';
const UPDATE_NOTE = 'Project updated via admin UI';

interface ProjectBody {
  jira_project_key?: unknown;
  client_name?: unknown;
  display_name?: unknown;
  jira_project_url?: unknown;
  is_active?: unknown;
  brand_model?: unknown;
  brand_jira_field_id?: unknown;
  default_brand_id?: unknown;
  brand?: unknown;
  changed_by?: unknown;
}

/**
 * The one brand a single-brand project is created WITH, in the same request.
 * `project_key` is deliberately absent: the RPC takes it from the project row it
 * just inserted rather than trusting the caller (part-2 spec §2).
 */
interface SingleBrandPayload {
  brand_code?: unknown;
  jira_value?: unknown;
  display_name?: unknown;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function serialize(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return String(value);
  return String(value);
}

/** Admin gate. Returns the cookie-bound client on success. */
async function requireAdmin() {
  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { supabase: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return { supabase: null, response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { supabase, response: null };
}

/**
 * Resolve the project_key of the brand `default_brand_id` points at. Returns
 * null when the id is absent or resolves to nothing — validateBrandConfig()
 * distinguishes those by the id itself.
 */
async function resolveDefaultBrandProjectKey(defaultBrandId: string | null): Promise<string | null> {
  if (!defaultBrandId) return null;
  const { data } = await supabaseAdmin
    .from('brands')
    .select('project_key')
    .eq('id', defaultBrandId)
    .maybeSingle();
  return data?.project_key ?? null;
}

const SELECT_COLS =
  'id, jira_project_key, client_name, display_name, jira_project_url, is_active, deactivated_at, brand_model, brand_jira_field_id, default_brand_id, created_at';

const SINGLE_BRAND_CREATE_NOTE = 'Project created via admin UI (single-brand, atomic)';

/**
 * Single-brand create — ONE FORM, ONE TRANSACTION.
 * Spec: docs/specs/batch-single-brand-part2-rpc.md, Karen K2.
 *
 * WHY THIS IS NOT THE ORDINARY INSERT PATH. A single-brand project needs a
 * default_brand_id, and its brand cannot exist until the project does
 * (brands.project_key → projects.jira_project_key, 009:14). The shipped wizard
 * did that in two requests, so a failed second step left a row that is
 * multi_brand + brand_jira_field_id set + 1 active brand — which every
 * multiBrandChecks() branch reads as VALID, so the badge said "Configured" and
 * retry could not recover (the brand POST 409s). Migration 031 does all three
 * statements in one transaction, so the half-state is unreachable rather than
 * merely visible.
 *
 * VALIDATION LIVES HERE, NOT IN plpgsql (§3.2). The function is for atomicity
 * only. Everything below is the TypeScript half, and it is the only half.
 *
 * TWO BEHAVIOURAL DIFFERENCES FROM THE MULTI-BRAND PATH, both consequences of
 * atomicity rather than oversights:
 *   · There is no `auditError` response. The audit rows are written inside the
 *     transaction, so an audit failure rolls the project and brand back with it.
 *     The caller cannot be told "saved but unrecorded" because that state cannot
 *     occur here.
 *   · changed_by is derived BEFORE the call and passed in. The function runs as
 *     service_role and has no auth.uid() to derive from — it refuses any caller
 *     that does have one (§1.3). Deriving it here, from the cookie-bound client,
 *     keeps §13 r19 intact.
 */
async function createSingleBrandProject(
  supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  projectKey: string,
  project: {
    client_name: string;
    display_name: string;
    jira_project_url: string | null;
    is_active: boolean;
  },
  rawBrand: unknown,
) {
  if (typeof rawBrand !== 'object' || rawBrand === null || Array.isArray(rawBrand)) {
    return NextResponse.json(
      {
        error:
          'A single-brand project must be created together with its one brand. Send a `brand` object with brand_code, jira_value, and display_name.',
        field: 'brand',
      },
      { status: 400 },
    );
  }
  const brand = rawBrand as SingleBrandPayload;

  const brandCodeRaw = asTrimmedString(brand.brand_code);
  if (!brandCodeRaw) {
    return NextResponse.json({ error: 'brand.brand_code is required', field: 'brand_code' }, { status: 400 });
  }
  const brandCode = brandCodeRaw.toUpperCase();
  if (!BRAND_CODE_PATTERN.test(brandCode)) {
    return NextResponse.json(
      { error: 'brand_code must be 1-32 chars: uppercase letters, digits, hyphens only', field: 'brand_code' },
      { status: 400 },
    );
  }

  const jiraValue = asTrimmedString(brand.jira_value);
  if (!jiraValue) {
    return NextResponse.json({ error: 'brand.jira_value is required', field: 'jira_value' }, { status: 400 });
  }

  const brandDisplayName = asTrimmedString(brand.display_name);
  if (!brandDisplayName) {
    return NextResponse.json({ error: 'brand.display_name is required', field: 'display_name' }, { status: 400 });
  }

  // brands.jira_value is UNIQUE instance-wide (009:15). Checked here so the user
  // gets the sentence the brands route would have given them, rather than a
  // rolled-back transaction reported as a raw constraint name. The RPC still
  // fails safe if the row is created between this check and the call.
  const { data: jiraValueClash } = await supabaseAdmin
    .from('brands')
    .select('project_key, brand_code')
    .eq('jira_value', jiraValue)
    .maybeSingle();
  if (jiraValueClash) {
    return NextResponse.json(
      {
        error: `jira_value "${jiraValue}" is already in use by ${jiraValueClash.project_key}/${jiraValueClash.brand_code}. Brand jira_value must be unique across all projects.`,
        field: 'jira_value',
      },
      { status: 409 },
    );
  }

  const changedBy = await getChangedBy(supabase);

  const { data: created, error: rpcErr } = await supabaseAdmin.rpc('create_single_brand_project', {
    p_project: {
      jira_project_key: projectKey,
      client_name: project.client_name,
      display_name: project.display_name,
      jira_project_url: project.jira_project_url,
      is_active: project.is_active,
    },
    p_brand: {
      brand_code: brandCode,
      jira_value: jiraValue,
      display_name: brandDisplayName,
    },
    p_changed_by: changedBy,
  });

  if (rpcErr || !created) {
    console.error('[admin/projects POST] single-brand rpc failed', rpcErr);
    // Nothing was written — that is the point of the batch. Every branch below
    // may say so without qualification.
    if (rpcErr?.code === '23505') {
      return NextResponse.json(
        { error: `${rpcErr.message} — nothing was created; fix the duplicate and submit again.` },
        { status: 409 },
      );
    }
    if (rpcErr?.code === '42501') {
      // The migration 031 guard fired: this route reached the function with an
      // authenticated session, which means it stopped using the service-role
      // client. A bug in this file, not bad input.
      return NextResponse.json(
        { error: 'Single-brand create was refused by the database guard. This is a server misconfiguration, not a problem with what you entered.' },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: `${rpcErr?.message ?? 'Failed to create single-brand project'} — nothing was created.` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, project: created, note: SINGLE_BRAND_CREATE_NOTE }, { status: 201 });
}

// -------------------------------------------------------------------------
// POST — create
// -------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const { supabase, response } = await requireAdmin();
  if (!supabase) return response;

  let body: ProjectBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if ('changed_by' in (body ?? {})) {
    console.warn('[admin/projects POST] ignored client-supplied changed_by', {
      attempted: body.changed_by,
      table: 'projects',
    });
  }

  const rawKey = asTrimmedString(body.jira_project_key);
  if (!rawKey) {
    return NextResponse.json({ error: 'jira_project_key is required' }, { status: 400 });
  }
  const projectKey = rawKey.toUpperCase();
  if (!PROJECT_KEY_PATTERN.test(projectKey)) {
    return NextResponse.json(
      { error: 'jira_project_key must be 2-30 chars: uppercase letters and digits, starting with a letter' },
      { status: 400 },
    );
  }

  const clientName = asTrimmedString(body.client_name);
  if (!clientName) {
    return NextResponse.json({ error: 'client_name is required' }, { status: 400 });
  }
  const displayName = asTrimmedString(body.display_name);
  if (!displayName) {
    return NextResponse.json({ error: 'display_name is required' }, { status: 400 });
  }

  const brandModelRaw = body.brand_model ?? 'multi_brand';
  if (!isBrandModel(brandModelRaw)) {
    return NextResponse.json(
      { error: "brand_model must be 'multi_brand' or 'single_brand'" },
      { status: 400 },
    );
  }
  const brandModel: BrandModel = brandModelRaw;

  const { data: existing, error: dupeErr } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('jira_project_key', projectKey)
    .maybeSingle();
  if (dupeErr) {
    console.error('[admin/projects POST] duplicate check failed', dupeErr);
    return NextResponse.json({ error: 'Failed to check for duplicates' }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ error: `Project "${projectKey}" already exists` }, { status: 409 });
  }

  const isActive = typeof body.is_active === 'boolean' ? body.is_active : true;

  // §4. Single-brand creates go through migration 031's transaction. There is no
  // other single-brand create path, and there never was a working one: this
  // branch used to be unreachable, because validateBrandConfig() requires a
  // default_brand_id whose brand belongs to the project, and no such brand can
  // exist before the project does.
  if (brandModel === 'single_brand') {
    return createSingleBrandProject(
      supabase,
      projectKey,
      {
        client_name: clientName,
        display_name: displayName,
        jira_project_url: asTrimmedString(body.jira_project_url),
        is_active: isActive,
      },
      body.brand,
    );
  }

  const defaultBrandId = asTrimmedString(body.default_brand_id);
  const config = validateBrandConfig(
    {
      brand_model: brandModel,
      brand_jira_field_id: asTrimmedString(body.brand_jira_field_id),
      default_brand_id: defaultBrandId,
    },
    {
      projectKey,
      defaultBrandProjectKey: await resolveDefaultBrandProjectKey(defaultBrandId),
    },
  );
  if (!config.ok) {
    return NextResponse.json({ error: config.error, field: config.field }, { status: 400 });
  }

  const newRow = {
    jira_project_key: projectKey,
    client_name: clientName,
    display_name: displayName,
    jira_project_url: asTrimmedString(body.jira_project_url),
    is_active: isActive,
    brand_model: config.value.brand_model,
    brand_jira_field_id: config.value.brand_jira_field_id,
    default_brand_id: config.value.default_brand_id,
  };

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('projects')
    .insert(newRow)
    .select(SELECT_COLS)
    .single();
  if (insertErr || !inserted) {
    console.error('[admin/projects POST] insert failed', insertErr);
    return NextResponse.json(
      { error: insertErr?.message ?? 'Failed to insert project' },
      { status: 500 },
    );
  }

  const changedBy = await getChangedBy(supabase);
  const auditRows = (Object.keys(newRow) as (keyof typeof newRow)[]).map(field => ({
    log_entry_id: null,
    target_type: 'project',
    target_id: inserted.id,
    action: 'CREATE',
    field_name: field,
    old_value: null,
    new_value: serialize(newRow[field]),
    changed_by: changedBy,
    notes: CREATE_NOTE,
  }));

  const { error: auditErr } = await supabaseAdmin.from('audit_log').insert(auditRows);
  if (auditErr) {
    console.error('[admin/projects POST] audit insert failed', auditErr);
    return NextResponse.json({ ok: true, project: inserted, auditError: auditErr.message }, { status: 200 });
  }

  return NextResponse.json({ ok: true, project: inserted }, { status: 201 });
}

// -------------------------------------------------------------------------
// PATCH — edit. This is the path that did not exist before (§0.2).
// -------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const { supabase, response } = await requireAdmin();
  if (!supabase) return response;

  let body: ProjectBody & { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if ('changed_by' in (body ?? {})) {
    console.warn('[admin/projects PATCH] ignored client-supplied changed_by', {
      attempted: body.changed_by,
      table: 'projects',
    });
  }

  const id = asTrimmedString(body.id);
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { data: before, error: readErr } = await supabaseAdmin
    .from('projects')
    .select(SELECT_COLS)
    .eq('id', id)
    .maybeSingle();
  if (readErr) {
    console.error('[admin/projects PATCH] read failed', readErr);
    return NextResponse.json({ error: 'Failed to read project' }, { status: 500 });
  }
  if (!before) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Immutable. Reject loudly rather than ignoring — a caller that thinks it
  // renamed a project and did not is worse than an error.
  const submittedKey = asTrimmedString(body.jira_project_key);
  if (submittedKey && submittedKey.toUpperCase() !== before.jira_project_key) {
    return NextResponse.json(
      {
        error:
          'jira_project_key cannot be changed. Brands and quality logs join on it with no FK, so a rename would orphan them silently.',
        field: 'jira_project_key',
      },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};

  if ('client_name' in body) {
    const v = asTrimmedString(body.client_name);
    if (!v) return NextResponse.json({ error: 'client_name cannot be empty' }, { status: 400 });
    updates.client_name = v;
  }
  if ('display_name' in body) {
    const v = asTrimmedString(body.display_name);
    if (!v) return NextResponse.json({ error: 'display_name cannot be empty' }, { status: 400 });
    updates.display_name = v;
  }
  if ('jira_project_url' in body) {
    updates.jira_project_url = asTrimmedString(body.jira_project_url);
  }
  if ('is_active' in body) {
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 });
    }
    updates.is_active = body.is_active;
    // deactivated_at was never written by the direct-browser toggleActive() it
    // replaces, so historical rows carry null. Written from here on.
    updates.deactivated_at = body.is_active ? null : new Date().toISOString();
  }

  // Brand config is validated as a UNIT even when only one of the three fields
  // is submitted, because the three constrain each other. Unsubmitted fields
  // fall back to the stored values, so a PATCH of brand_model alone is checked
  // against the default_brand_id already on the row.
  const touchesConfig =
    'brand_model' in body || 'brand_jira_field_id' in body || 'default_brand_id' in body;

  if (touchesConfig) {
    const brandModelRaw = 'brand_model' in body ? body.brand_model : before.brand_model;
    if (!isBrandModel(brandModelRaw)) {
      return NextResponse.json(
        { error: "brand_model must be 'multi_brand' or 'single_brand'" },
        { status: 400 },
      );
    }
    const fieldId =
      'brand_jira_field_id' in body
        ? asTrimmedString(body.brand_jira_field_id)
        : before.brand_jira_field_id;
    const defaultBrandId =
      'default_brand_id' in body
        ? asTrimmedString(body.default_brand_id)
        : before.default_brand_id;

    const config = validateBrandConfig(
      { brand_model: brandModelRaw, brand_jira_field_id: fieldId, default_brand_id: defaultBrandId },
      {
        projectKey: before.jira_project_key,
        defaultBrandProjectKey: await resolveDefaultBrandProjectKey(defaultBrandId),
      },
    );
    if (!config.ok) {
      return NextResponse.json({ error: config.error, field: config.field }, { status: 400 });
    }
    updates.brand_model = config.value.brand_model;
    updates.brand_jira_field_id = config.value.brand_jira_field_id;
    updates.default_brand_id = config.value.default_brand_id;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes submitted' }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select(SELECT_COLS)
    .single();
  if (updateErr || !updated) {
    console.error('[admin/projects PATCH] update failed', updateErr);
    return NextResponse.json(
      { error: updateErr?.message ?? 'Failed to update project' },
      { status: 500 },
    );
  }

  const changedBy = await getChangedBy(supabase);

  // One audit row per field that ACTUALLY CHANGED. A PATCH that resubmits an
  // unchanged value must not manufacture an audit row saying it changed — that
  // is the G5a claim-pattern (a record asserting something that did not happen).
  const beforeRow = before as unknown as Record<string, unknown>;
  const auditRows = Object.keys(updates)
    .filter(field => serialize(beforeRow[field]) !== serialize(updates[field]))
    .map(field => ({
      log_entry_id: null,
      target_type: 'project',
      target_id: id,
      action: 'UPDATE',
      field_name: field,
      old_value: serialize(beforeRow[field]),
      new_value: serialize(updates[field]),
      changed_by: changedBy,
      notes: UPDATE_NOTE,
    }));

  if (auditRows.length === 0) {
    return NextResponse.json({ ok: true, project: updated, unchanged: true }, { status: 200 });
  }

  const { error: auditErr } = await supabaseAdmin.from('audit_log').insert(auditRows);
  if (auditErr) {
    console.error('[admin/projects PATCH] audit insert failed', auditErr);
    return NextResponse.json({ ok: true, project: updated, auditError: auditErr.message }, { status: 200 });
  }

  return NextResponse.json({ ok: true, project: updated }, { status: 200 });
}
