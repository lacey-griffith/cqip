import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';

// Admin-only: edit QA automation config on a brand row. Updates the
// row + emits one audit_log row per changed field, with changed_by
// derived from auth.uid() server-side per CLAUDE.md §13 rule 19. The
// browser must NOT supply changed_by — values in the body are ignored.

const QA_FIELDS = [
  'live_url_base',
  'default_local_sub_areas',
  'client_contact_name',
  'client_contact_jira_account_id',
  'url_pattern',
  'qa_automation_enabled',
  'notes',
] as const;

type QaField = (typeof QA_FIELDS)[number];

type QaValues = {
  live_url_base?: string | null;
  default_local_sub_areas?: string[] | null;
  client_contact_name?: string | null;
  client_contact_jira_account_id?: string | null;
  url_pattern?: 'convert-preview' | 'live-qa' | null;
  qa_automation_enabled?: boolean;
  notes?: string | null;
};

function normaliseString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normaliseSubAreas(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const cleaned = v
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(item => item.length > 0);
  return cleaned.length === 0 ? null : cleaned;
}

function arraysEqual(a: string[] | null, b: string[] | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function serialize(field: QaField, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (field === 'default_local_sub_areas' && Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export async function PATCH(req: NextRequest) {
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

  // §13 rule 19: changed_by is server-derived via the canonical helper.
  // Anything the client sent on a `changed_by` key in the body is
  // intentionally ignored.
  const changedBy = await getChangedBy(supabase);

  let body: { id?: string; values?: QaValues; changed_by?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Forensic log if a client tries to supply changed_by — per §13 rule 19
  // it is always ignored, but a deployed browser passing it is a clue
  // about an out-of-date callsite.
  if ('changed_by' in (body ?? {})) {
    console.warn('[admin/brands/qa-config] ignored client-supplied changed_by', {
      attempted: body.changed_by,
      uid: user.id,
    });
  }

  const id = body?.id;
  const values = body?.values;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Brand id is required' }, { status: 400 });
  }
  if (!values || typeof values !== 'object') {
    return NextResponse.json({ error: 'values is required' }, { status: 400 });
  }

  // Validate constrained fields up-front so we can return a 400 instead
  // of relying on the DB CHECK constraint to reject (which would surface
  // as a 500 from supabase-js).
  if (values.live_url_base != null) {
    const v = String(values.live_url_base);
    if (v.length > 0 && (!v.startsWith('https://') || v.endsWith('/'))) {
      return NextResponse.json(
        { error: 'live_url_base must start with https:// and have no trailing slash' },
        { status: 400 },
      );
    }
  }
  if (values.url_pattern != null && values.url_pattern !== 'convert-preview' && values.url_pattern !== 'live-qa') {
    return NextResponse.json(
      { error: "url_pattern must be 'convert-preview' or 'live-qa'" },
      { status: 400 },
    );
  }

  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('brands')
    .select('id, live_url_base, default_local_sub_areas, client_contact_name, client_contact_jira_account_id, url_pattern, qa_automation_enabled, notes')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    console.error('[admin/brands/qa-config] fetch failed', fetchErr);
    return NextResponse.json({ error: 'Failed to load brand' }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
  }

  const next: Record<QaField, unknown> = {
    live_url_base: 'live_url_base' in values
      ? normaliseString(values.live_url_base)
      : current.live_url_base,
    default_local_sub_areas: 'default_local_sub_areas' in values
      ? normaliseSubAreas(values.default_local_sub_areas)
      : current.default_local_sub_areas,
    client_contact_name: 'client_contact_name' in values
      ? normaliseString(values.client_contact_name)
      : current.client_contact_name,
    client_contact_jira_account_id: 'client_contact_jira_account_id' in values
      ? normaliseString(values.client_contact_jira_account_id)
      : current.client_contact_jira_account_id,
    url_pattern: 'url_pattern' in values
      ? (values.url_pattern ?? null)
      : current.url_pattern,
    qa_automation_enabled: 'qa_automation_enabled' in values
      ? Boolean(values.qa_automation_enabled)
      : current.qa_automation_enabled,
    notes: 'notes' in values
      ? normaliseString(values.notes)
      : current.notes,
  };

  const changedFields: QaField[] = [];
  for (const field of QA_FIELDS) {
    const before = (current as Record<string, unknown>)[field];
    const after = next[field];
    if (field === 'default_local_sub_areas') {
      if (!arraysEqual(before as string[] | null, after as string[] | null)) {
        changedFields.push(field);
      }
    } else if (before !== after) {
      changedFields.push(field);
    }
  }

  if (changedFields.length === 0) {
    return NextResponse.json({ ok: true, changed: 0 });
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of changedFields) {
    updatePayload[field] = next[field];
  }

  const { error: updateErr } = await supabaseAdmin
    .from('brands')
    .update(updatePayload)
    .eq('id', id);

  if (updateErr) {
    console.error('[admin/brands/qa-config] update failed', updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const auditRows = changedFields.map(field => ({
    log_entry_id: null,
    target_type: 'brand',
    target_id: id,
    action: 'UPDATE',
    field_name: field,
    old_value: serialize(field, (current as Record<string, unknown>)[field]),
    new_value: serialize(field, next[field]),
    changed_by: changedBy,
    notes: 'QA config edit via admin UI',
  }));

  const { error: auditErr } = await supabaseAdmin.from('audit_log').insert(auditRows);
  if (auditErr) {
    // Audit write failed but the brand row already updated. Log + bubble
    // up so the admin sees a non-silent failure; mirrors the dev-toast
    // pattern from ManageMilestonesDialog.
    console.error('[admin/brands/qa-config] audit insert failed', auditErr);
    return NextResponse.json(
      { ok: true, changed: changedFields.length, auditError: auditErr.message },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, changed: changedFields.length });
}
