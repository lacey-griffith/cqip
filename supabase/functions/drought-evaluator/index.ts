// Deno / Supabase Edge Function — Brand Coverage Drought evaluator.
//
// Fired by a Supabase pg_cron job daily at 10:00 UTC (5am Central /
// 4pm Vietnam end-of-day). Reconciles per-brand drought state against
// alert_events: opens an alert when a brand drops to ≤ threshold
// milestones in the rolling window, closes it when the brand recovers.
//
// Rule definition lives in alert_rules. We read threshold + window from
// the rule's config so admin tweaks land without redeploys, but fall
// back to the documented defaults (threshold=2, window_days=28) if the
// row is missing fields.
//
// Audit writes use changed_by = 'system:drought-evaluator' per
// CLAUDE.md §13 rule 20 — there's no auth.uid() in a cron context, so
// the universal rule 19 (server-derive from auth.uid) gets a documented
// system-cron exception.
//
// Self-contained: only npm specifier import is supabase-js. Same auth
// pattern as jira-sync (Bearer token + apikey header + ?apikey query,
// timing-safe-compared) so manual triggers from the Supabase dashboard
// work the same as scheduled cron HTTP requests.

import { createClient } from 'npm:@supabase/supabase-js@2';

// -------------------------------------------------------------------------
// Env
// -------------------------------------------------------------------------
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const droughtAuthKey = Deno.env.get('CQIP_DROUGHT_AUTH_KEY');

{
  const missing: string[] = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!droughtAuthKey) missing.push('CQIP_DROUGHT_AUTH_KEY');
  if (missing.length > 0) {
    throw new Error(`drought-evaluator missing required env vars: ${missing.join(', ')}`);
  }
}

const supabase = createClient(supabaseUrl!, serviceRoleKey!);

// -------------------------------------------------------------------------
// Auth — accept Bearer header, ?apikey query param, or apikey header.
// All three timing-safe-compared against CQIP_DROUGHT_AUTH_KEY.
// Mirrors jira-sync.
// -------------------------------------------------------------------------
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function validateApiKey(request: Request): boolean {
  if (!droughtAuthKey) return false;
  const candidates: string[] = [];

  const url = new URL(request.url);
  const queryKey = url.searchParams.get('apikey');
  if (queryKey) candidates.push(queryKey);

  const headerKey = request.headers.get('apikey');
  if (headerKey) candidates.push(headerKey);

  const auth = request.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    candidates.push(auth.slice(7).trim());
  }

  return candidates.some((candidate) => timingSafeEqual(candidate, droughtAuthKey));
}

function clientDescriptor(request: Request): string {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  return `${ip} | ${ua}`;
}

// -------------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------------
const CHANGED_BY = 'system:drought-evaluator';
// CLAUDE.md §10 + migration 009 seed: rule_name is 'Client Coverage Drought'.
// (The Batch 004.4 spec uses 'Brand Coverage' colloquially; the seeded row
// is the source of truth.)
const RULE_NAME = 'Client Coverage Drought';
const DEFAULT_THRESHOLD = 2;
const DEFAULT_WINDOW_DAYS = 28;

// -------------------------------------------------------------------------
// Reconciler — per-brand
// -------------------------------------------------------------------------
async function evaluateBrand(
  brand: { id: string; brand_code: string; project_key: string; display_name: string },
  ruleId: string,
  threshold: number,
  windowDays: number,
  windowStartIso: string,
): Promise<'started' | 'ended' | 'noop'> {
  // a. Count milestones in the rolling window. is_deleted=FALSE matches
  //    the partial unique index used everywhere else; soft-deleted rows
  //    must not count toward recovery.
  const { count: milestoneCount, error: countErr } = await supabase
    .from('test_milestones')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brand.id)
    .eq('is_deleted', false)
    .gte('reached_at', windowStartIso);

  if (countErr) {
    throw new Error(`milestone count failed: ${countErr.message}`);
  }

  const count = milestoneCount ?? 0;
  const inDrought = count <= threshold;

  // c. Find existing OPEN brand-scoped alert for this (brand, rule).
  const { data: openAlerts, error: openErr } = await supabase
    .from('alert_events')
    .select('id, triggered_at')
    .eq('rule_id', ruleId)
    .eq('brand_id', brand.id)
    .is('resolved_at', null)
    .order('triggered_at', { ascending: false })
    .limit(1);

  if (openErr) {
    throw new Error(`alert lookup failed: ${openErr.message}`);
  }

  const openAlert = openAlerts?.[0] ?? null;

  // d. Reconcile.
  if (inDrought && !openAlert) {
    // Case 1 — drought started. INSERT new alert_event + audit row.
    const { data: inserted, error: insertErr } = await supabase
      .from('alert_events')
      .insert({
        rule_id: ruleId,
        log_entry_id: null,
        brand_id: brand.id,
        notification_sent: false,
      })
      .select('id')
      .single();

    if (insertErr) {
      // 23505 → unique violation on idx_alert_events_one_open_per_brand_rule.
      // Means a parallel run already handled case 1; treat as case 2 no-op.
      if ((insertErr as { code?: string }).code === '23505') {
        console.warn(`[drought] race on ${brand.brand_code}: open alert already exists, skipping insert`);
        return 'noop';
      }
      throw new Error(`alert_event insert failed: ${insertErr.message}`);
    }

    const auditNote = `Drought started: ${brand.brand_code} has ${count} milestones in last ${windowDays} days`;
    const { error: auditErr } = await supabase.from('audit_log').insert({
      log_entry_id: null,
      target_type: 'alert_event',
      target_id: inserted!.id,
      action: 'CREATE',
      field_name: null,
      old_value: null,
      new_value: brand.brand_code,
      changed_by: CHANGED_BY,
      notes: auditNote,
    });
    if (auditErr) {
      console.warn(`[drought] audit insert failed for ${brand.brand_code} start:`, auditErr);
    }
    return 'started';
  }

  if (!inDrought && openAlert) {
    // Case 4 — drought ended. UPDATE resolved_at + audit row.
    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('alert_events')
      .update({ resolved_at: nowIso })
      .eq('id', openAlert.id);

    if (updateErr) {
      throw new Error(`alert_event resolve failed: ${updateErr.message}`);
    }

    const auditNote = `Drought ended: ${brand.brand_code} recovered to ${count} milestones in last ${windowDays} days`;
    const { error: auditErr } = await supabase.from('audit_log').insert({
      log_entry_id: null,
      target_type: 'alert_event',
      target_id: openAlert.id,
      action: 'UPDATE',
      field_name: 'resolved_at',
      old_value: null,
      new_value: nowIso,
      changed_by: CHANGED_BY,
      notes: auditNote,
    });
    if (auditErr) {
      console.warn(`[drought] audit insert failed for ${brand.brand_code} end:`, auditErr);
    }
    return 'ended';
  }

  // Cases 2 + 3 — state matches, no action.
  return 'noop';
}

// -------------------------------------------------------------------------
// Request handler
// -------------------------------------------------------------------------
Deno.serve(async (request: Request) => {
  if (!validateApiKey(request)) {
    console.warn(
      '[drought-evaluator] rejected unauthenticated request',
      JSON.stringify({
        at: new Date().toISOString(),
        client: clientDescriptor(request),
      }),
    );
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 1. Find the seeded drought rule. Multiple matches → warn, take
    //    the first by created_at; zero matches → 200 with skipped flag.
    const { data: rules, error: ruleErr } = await supabase
      .from('alert_rules')
      .select('id, config, created_at')
      .eq('rule_name', RULE_NAME)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (ruleErr) {
      throw ruleErr;
    }

    if (!rules || rules.length === 0) {
      console.warn(`[drought-evaluator] no active rule named ${RULE_NAME}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: 'no active drought rule' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (rules.length > 1) {
      console.warn(`[drought-evaluator] multiple active rules named ${RULE_NAME}: ${rules.length}. Using earliest.`);
    }

    const rule = rules[0];
    const config = (rule.config ?? {}) as Record<string, unknown>;
    const threshold = typeof config.threshold === 'number' ? (config.threshold as number) : DEFAULT_THRESHOLD;
    const windowDays = typeof config.window_days === 'number' ? (config.window_days as number) : DEFAULT_WINDOW_DAYS;

    // 2. Window start. Compute once; pass an ISO string into per-brand
    //    queries so every brand sees the same cutoff (no drift across
    //    the loop).
    const windowStartIso = new Date(Date.now() - windowDays * 86400000).toISOString();

    // 3. Load all non-paused, active brands.
    const { data: brands, error: brandsErr } = await supabase
      .from('brands')
      .select('id, brand_code, project_key, display_name, is_paused')
      .eq('is_paused', false)
      .eq('is_active', true)
      .order('brand_code');

    if (brandsErr) {
      throw brandsErr;
    }

    let droughtsStarted = 0;
    let droughtsEnded = 0;
    let errors = 0;

    for (const brand of brands ?? []) {
      try {
        const outcome = await evaluateBrand(brand, rule.id, threshold, windowDays, windowStartIso);
        if (outcome === 'started') droughtsStarted += 1;
        else if (outcome === 'ended') droughtsEnded += 1;
      } catch (err) {
        errors += 1;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[drought-evaluator] brand ${brand.brand_code} failed: ${msg}`);
      }
    }

    // Paused brands are deliberately not evaluated. Their open alerts
    // (if any pre-pause) stay open — preserves the audit trail. They'll
    // resolve naturally on unpause if the brand has recovered, or stay
    // open if still in drought. Documented in CLAUDE.md §13 rule 20.
    const { count: pausedCount } = await supabase
      .from('brands')
      .select('id', { count: 'exact', head: true })
      .eq('is_paused', true)
      .eq('is_active', true);

    const summary = {
      evaluated: brands?.length ?? 0,
      droughts_started: droughtsStarted,
      droughts_ended: droughtsEnded,
      skipped_paused: pausedCount ?? 0,
      errors,
    };

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[drought-evaluator] fatal:', msg);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
