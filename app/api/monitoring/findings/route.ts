import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateMonitoringBearer } from '@/lib/api/monitoring-bearer-auth';
import {
  parseFinding,
  resolveBrandId,
  buildInsertRow,
  buildUpdatePatch,
  dedupeKey,
  type RawFinding,
  type ParsedFinding,
  type ResolvableBrand,
} from '@/lib/client-library/monitoring';

// Batch 012 — Client Library, Phase B. External Bearer-authed ingest for the
// monitoring feed (spec §2). Mirrors the /api/brands Bearer pattern (NOT the
// session pattern): validate Authorization: Bearer against
// CQIP_CONVERT_MONITORING_TOKEN; 401 on mismatch. Writes via supabaseAdmin
// (service role, bypasses RLS). /api/monitoring/* is carved out of the
// middleware matcher so this never hits the session cookie.
//
// Source-agnostic by design: Batch 008 (Convert) posts here with
// source='convert' rather than building a second ingest path.
//
// Body: a single finding object OR an array (batch). Each finding is deduped
// on (source, external_ref): new → insert with status='new'; existing →
// update summary/detail/severity/detected_at/updated_at but LEAVE status
// untouched (never resurrect an actioned/dismissed finding). Findings without
// an external_ref are never deduped (always inserted).
//
// No per-ingest audit row (external, fire-and-forget, high volume). Only human
// status-changes are audited (see /api/admin/monitoring/findings/status).

// Guard against absurd batches (Worker memory + one bounded DB round-trip).
const MAX_BATCH = 500;

export async function POST(req: NextRequest) {
  const auth = validateMonitoringBearer(req);
  if (!auth.ok) {
    // 500 for a missing server-side token (ops misconfig), 401 otherwise.
    // Never echo the token or the reason detail beyond the status.
    const message = auth.status === 500 ? 'Monitoring ingest not configured' : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawFindings: RawFinding[] = Array.isArray(body) ? body : [body];
  if (rawFindings.length === 0) {
    return NextResponse.json({ error: 'No findings in body' }, { status: 400 });
  }
  if (rawFindings.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Batch too large (${rawFindings.length} > ${MAX_BATCH})` },
      { status: 400 },
    );
  }

  const now = new Date();

  // Validate every finding up front — a single bad finding fails the whole
  // batch with an index-scoped message (all-or-nothing keeps the caller's
  // retry logic simple; partial ingest would be ambiguous).
  const parsed = rawFindings.map((raw, i) => ({ i, result: parseFinding(raw, now) }));
  const firstBad = parsed.find((p) => !p.result.ok);
  if (firstBad && !firstBad.result.ok) {
    return NextResponse.json(
      { error: `finding[${firstBad.i}]: ${firstBad.result.error}` },
      { status: 400 },
    );
  }
  // All entries validated ok above (we returned on the first bad one).
  const findings: ParsedFinding[] = parsed.map((p) => {
    if (!p.result.ok) throw new Error('unreachable: unvalidated finding');
    return p.result.value;
  });

  // Load brands once for resolution. Only brands with a truthy brand string
  // need it, but the set is tiny (≤ a few dozen) so fetch all active brands.
  const { data: brandData, error: brandErr } = await supabaseAdmin
    .from('brands')
    .select('id, brand_code, jira_value')
    .eq('is_active', true);
  if (brandErr) {
    console.error('[monitoring/findings POST] brand fetch failed', brandErr);
    return NextResponse.json({ error: 'Failed to load brands for resolution' }, { status: 500 });
  }
  const brands = (brandData ?? []) as ResolvableBrand[];

  // Fetch existing rows for the batch's non-null external_refs in one query,
  // then match by (source, external_ref) so the same ref under two sources
  // doesn't cross-match.
  const refs = Array.from(
    new Set(findings.map((f) => f.external_ref).filter((r): r is string => r !== null)),
  );
  const existingByKey = new Map<string, { id: string }>();
  if (refs.length > 0) {
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('monitoring_findings')
      .select('id, source, external_ref')
      .in('external_ref', refs);
    if (existErr) {
      console.error('[monitoring/findings POST] existing lookup failed', existErr);
      return NextResponse.json({ error: 'Failed to check for existing findings' }, { status: 500 });
    }
    for (const row of existing ?? []) {
      const key = dedupeKey(row.source, row.external_ref);
      if (key) existingByKey.set(key, { id: row.id });
    }
  }

  const nowIso = now.toISOString();
  // Split into inserts vs updates. Collapse intra-batch duplicates that share
  // a dedupe key (same source+external_ref) so the bulk insert never ships two
  // rows that would violate the partial unique index — which would surface as
  // an opaque 500 for what is really a malformed batch (Karen LOW-1). Last
  // write wins within the batch, matching the re-post semantics. Null-key
  // findings (no external_ref) never dedupe — each is its own insert.
  const insertByKey = new Map<string, ReturnType<typeof buildInsertRow>>();
  const insertNoKey: ReturnType<typeof buildInsertRow>[] = [];
  const updateById = new Map<string, ReturnType<typeof buildUpdatePatch>>();
  const unresolvedBrands: string[] = [];

  for (const f of findings) {
    const brandId = resolveBrandId(f.brand, brands);
    if (f.brand && brandId === null && !unresolvedBrands.includes(f.brand)) {
      unresolvedBrands.push(f.brand);
    }
    const key = dedupeKey(f.source, f.external_ref);
    const existing = key ? existingByKey.get(key) : undefined;
    if (existing) {
      // Existing DB row → update. A repeated key in the batch collapses to a
      // single update of that row (last wins).
      updateById.set(existing.id, buildUpdatePatch(f, nowIso));
    } else if (key) {
      // New keyed finding → insert; an intra-batch repeat overwrites the
      // pending insert instead of adding a colliding second row.
      insertByKey.set(key, buildInsertRow(f, brandId));
    } else {
      insertNoKey.push(buildInsertRow(f, brandId));
    }
  }

  const insertRows = [...insertNoKey, ...insertByKey.values()];
  if (insertRows.length > 0) {
    const { error: insertErr } = await supabaseAdmin.from('monitoring_findings').insert(insertRows);
    if (insertErr) {
      console.error('[monitoring/findings POST] insert failed', insertErr);
      return NextResponse.json({ error: 'Failed to insert findings' }, { status: 500 });
    }
  }

  // Updates are per-row (each carries its own patch). Low volume; a dedupe
  // re-post typically touches one row.
  for (const [id, patch] of updateById) {
    const { error: updateErr } = await supabaseAdmin
      .from('monitoring_findings')
      .update(patch)
      .eq('id', id);
    if (updateErr) {
      console.error('[monitoring/findings POST] update failed', updateErr);
      return NextResponse.json({ error: 'Failed to update an existing finding' }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    ingested: insertRows.length,
    updated: updateById.size,
    unresolved_brands: unresolvedBrands,
  });
}
