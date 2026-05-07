// Deno / Supabase Edge Function — Jira webhook receiver.
// Self-contained: all shared code (Jira client, field map) inlined here so
// the function has no dependencies outside its own directory.

import { createClient } from 'npm:@supabase/supabase-js@2';

// -------------------------------------------------------------------------
// Env
// -------------------------------------------------------------------------
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
const jiraBaseUrl = Deno.env.get('JIRA_BASE_URL');
const jiraEmail = Deno.env.get('JIRA_EMAIL');
const jiraApiToken = Deno.env.get('JIRA_API_TOKEN');

if (!supabaseUrl || !serviceRoleKey || !webhookSecret || !jiraBaseUrl || !jiraEmail || !jiraApiToken) {
  throw new Error('Missing required environment variables for jira-webhook function');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// -------------------------------------------------------------------------
// Inlined: lib/jira/field-map.ts
// nbly_brand removed in Batch 005.22 Phase 1 — brand field is now per-project,
// looked up from `projects.brand_jira_field_id` via getProjectConfig().
// -------------------------------------------------------------------------
const JIRA_FIELD_MAP = {
  who_owns_fix:               'customfield_13120',
  detected_by:                'customfield_12910',
  documentation_updated:      'customfield_12914',
  experiment_paused:          'customfield_12912',
  issue_category:             'customfield_12871',
  issue_subtype:              'customfield_12904',
  preventable:                'customfield_12911',
  process_improvement_needed: 'customfield_12913',
  reproducibility:            'customfield_12907',
  resolution_type:            'customfield_12908',
  root_cause:                 'customfield_12905',
  root_cause_description:     'customfield_12909',
  severity:                   'customfield_12906',
} as const;

// The brand field can come back as a string, a single-select { value },
// a cascading select { value, child: { value } }, or an array of those.
// Resolve the string in any of those shapes; log when it's a surprise type.
function extractBrand(raw: unknown, ticketId: string): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (!first) return null;
    return extractBrand(first, ticketId);
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.value === 'string') return (obj.value as string).trim() || null;
    if (obj.child && typeof (obj.child as any).value === 'string') return ((obj.child as any).value as string).trim() || null;
    if (typeof obj.name === 'string') return (obj.name as string).trim() || null;
    console.warn(
      `[jira-webhook] unexpected client_brand shape on ${ticketId}`,
      JSON.stringify(obj).slice(0, 400),
    );
  }
  return null;
}

// -------------------------------------------------------------------------
// Inlined: lib/jira/client.ts (Deno-ported — btoa instead of Buffer)
// -------------------------------------------------------------------------
const jiraAuth = btoa(`${jiraEmail}:${jiraApiToken}`);
const jiraHeaders: Record<string, string> = {
  Authorization: `Basic ${jiraAuth}`,
  'Content-Type': 'application/json',
};

async function getIssue(issueKey: string) {
  const response = await fetch(`${jiraBaseUrl}/rest/api/3/issue/${issueKey}`, {
    headers: jiraHeaders,
  });
  if (!response.ok) {
    throw new Error(`Jira API request failed: ${response.status}`);
  }
  return response.json();
}

// Resolve a Jira brand string to a brands.id. Canonical brands.jira_value
// match wins; brand_aliases is the fallback. Returns null (and warns)
// when neither matches — callers insert with brand_id = null and rely on
// scripts/backfill-milestones.ts to reconcile.
async function resolveBrandId(brandValue: string): Promise<string | null> {
  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('jira_value', brandValue)
    .maybeSingle();
  if (brand?.id) return brand.id as string;

  const { data: alias } = await supabase
    .from('brand_aliases')
    .select('brand_id')
    .eq('jira_value', brandValue)
    .maybeSingle();
  if (alias?.brand_id) return alias.brand_id as string;

  return null;
}

// -------------------------------------------------------------------------
// Project-aware brand resolution (Batch 005.22 Phase 1, §13 rule 28).
//
// `getProjectConfig(projectKey)` is the single source of truth for what
// kind of brand model a project follows. The webhook calls it once per
// invocation — replaces the prior standalone `is_active` lookup, net
// zero queries.
//
// `resolveBrandForTicket(payloadFields, fullIssueFields, projectConfig)`
// returns the resolved brandId + brandJiraValue (verbatim Jira string
// for test_milestones; NULL for single-brand) + clientBrandString
// (brands.jira_value verbatim for quality_logs.client_brand — Option γ
// per §13 rule 28). The helper takes BOTH the payload and the optional
// getIssue() fallback so the webhook's caller decides whether to fetch
// the full issue independently of brand resolution (rule 18 contract).
// -------------------------------------------------------------------------

interface ProjectConfig {
  jira_project_key: string;
  brand_model: 'multi_brand' | 'single_brand';
  brand_jira_field_id: string | null;
  default_brand_id: string | null;
  is_active: boolean;
}

async function getProjectConfig(projectKey: string): Promise<ProjectConfig | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('jira_project_key, brand_model, brand_jira_field_id, default_brand_id, is_active')
    .eq('jira_project_key', projectKey)
    .maybeSingle();
  if (error) {
    console.warn('[jira-webhook] project config lookup failed', error.message);
    return null;
  }
  return (data as ProjectConfig | null) ?? null;
}

interface ResolvedBrand {
  brandId: string | null;
  brandJiraValue: string | null;
  clientBrandString: string | null;
}

async function resolveBrandForTicket(
  payloadFields: Record<string, unknown> | undefined,
  fullIssueFields: Record<string, unknown> | undefined,
  projectConfig: ProjectConfig,
  ticketKey: string,
): Promise<ResolvedBrand> {
  // Single-brand path: project IS the brand. Skip field extraction
  // entirely. brand_jira_value stays NULL (we didn't consult any field).
  // client_brand string comes from the brand row's jira_value (which
  // migration 019 normalized to "CODE - Display Name" shape).
  if (projectConfig.brand_model === 'single_brand') {
    if (!projectConfig.default_brand_id) {
      // CHECK constraint should prevent this state; defensive log
      // in case a config update raced.
      console.warn('[jira-webhook] single_brand project missing default_brand_id', {
        project: projectConfig.jira_project_key,
      });
      return { brandId: null, brandJiraValue: null, clientBrandString: null };
    }
    const { data: brand } = await supabase
      .from('brands')
      .select('id, jira_value')
      .eq('id', projectConfig.default_brand_id)
      .maybeSingle();
    return {
      brandId: brand?.id ?? null,
      brandJiraValue: null,
      clientBrandString: brand?.jira_value ?? null,
    };
  }

  // Multi-brand path: read the configured field, normalize via
  // existing extractBrand(), then walk brands → aliases →
  // default_brand_id → null.
  const fieldId = projectConfig.brand_jira_field_id!;  // CHECK guarantees non-null
  const rawFromPayload = payloadFields?.[fieldId];
  const rawFromIssue = fullIssueFields?.[fieldId];
  const rawValue = rawFromPayload ?? rawFromIssue ?? null;
  const extracted = extractBrand(rawValue, ticketKey);

  if (!extracted) {
    // No field value at all. If the project has a default_brand_id
    // (escape-hatch fallback per §13 rule 28), use it.
    if (projectConfig.default_brand_id) {
      const { data: brand } = await supabase
        .from('brands')
        .select('id, jira_value')
        .eq('id', projectConfig.default_brand_id)
        .maybeSingle();
      return {
        brandId: brand?.id ?? null,
        brandJiraValue: null,
        clientBrandString: brand?.jira_value ?? null,
      };
    }
    return { brandId: null, brandJiraValue: null, clientBrandString: null };
  }

  // brands.jira_value → brand_aliases.jira_value chain (preserved from
  // Batch 004.1's resolveBrandId). On a hit, source clientBrandString
  // from the resolved brand row (Option γ writeback).
  const brandId = await resolveBrandId(extracted);
  if (brandId) {
    const { data: brand } = await supabase
      .from('brands')
      .select('jira_value')
      .eq('id', brandId)
      .maybeSingle();
    return {
      brandId,
      brandJiraValue: extracted,
      clientBrandString: brand?.jira_value ?? extracted,
    };
  }

  // brands + aliases miss → final fallback to default_brand_id if
  // configured, else null. brand_jira_value preserves the verbatim
  // unmatched string for later alias seeding.
  if (projectConfig.default_brand_id) {
    console.warn('[jira-webhook] brand resolution fell back to default_brand_id', {
      project: projectConfig.jira_project_key,
      fieldId,
      extracted,
    });
    const { data: brand } = await supabase
      .from('brands')
      .select('id, jira_value')
      .eq('id', projectConfig.default_brand_id)
      .maybeSingle();
    return {
      brandId: brand?.id ?? null,
      brandJiraValue: extracted,
      clientBrandString: brand?.jira_value ?? null,
    };
  }

  console.warn('[jira-webhook] no brand or alias match', {
    project: projectConfig.jira_project_key,
    fieldId,
    extracted,
  });
  return { brandId: null, brandJiraValue: extracted, clientBrandString: null };
}

// -------------------------------------------------------------------------
// Webhook payload + transition logic
// -------------------------------------------------------------------------
interface WebhookPayload {
  webhookEvent: string;
  issue: {
    key: string;
    fields: {
      project: { key: string };
      summary: string;
      labels?: string[];
      created: string;
      [key: string]: any;
    };
  };
  changelog: {
    items: Array<{
      field: string;
      fromString: string;
      toString: string;
    }>;
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function validateWebhookSecret(request: Request): boolean {
  if (!webhookSecret) return false;
  // Jira webhooks can't send custom headers, so accept the secret as a
  // query parameter. The header path stays in place for other callers.
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  if (querySecret && timingSafeEqual(querySecret, webhookSecret)) return true;

  const headerSecret = request.headers.get('X-Webhook-Secret');
  if (headerSecret && timingSafeEqual(headerSecret, webhookSecret)) return true;

  return false;
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

function isValidTransition(fromStatus: string, toStatus: string): boolean {
  const validTo = ['Active Dev', 'Active Development', 'Active Design'];
  const validFrom = ['Dev QA', 'Dev Client Review', 'Queued', 'Live', 'Done'];
  return validTo.includes(toStatus) && validFrom.includes(fromStatus);
}

function mapJiraFields(fields: any) {
  const mapped: any = {};

  const whoOwnsFix = fields[JIRA_FIELD_MAP.who_owns_fix];
  mapped.who_owns_fix = whoOwnsFix?.child?.value ?? whoOwnsFix?.value ?? null;

  mapped.detected_by = fields[JIRA_FIELD_MAP.detected_by]?.displayName ?? null;

  mapped.documentation_updated = (fields[JIRA_FIELD_MAP.documentation_updated]?.length ?? 0) > 0;
  mapped.experiment_paused = (fields[JIRA_FIELD_MAP.experiment_paused]?.length ?? 0) > 0;
  mapped.preventable = (fields[JIRA_FIELD_MAP.preventable]?.length ?? 0) > 0;
  mapped.process_improvement_needed = (fields[JIRA_FIELD_MAP.process_improvement_needed]?.length ?? 0) > 0;

  mapped.issue_category = fields[JIRA_FIELD_MAP.issue_category]?.map((item: any) => item.value) ?? [];
  mapped.issue_subtype = fields[JIRA_FIELD_MAP.issue_subtype]?.map((item: any) => item.value) ?? [];
  mapped.resolution_type = fields[JIRA_FIELD_MAP.resolution_type]?.map((item: any) => item.value) ?? [];

  mapped.reproducibility = fields[JIRA_FIELD_MAP.reproducibility]?.value ?? null;
  mapped.severity = fields[JIRA_FIELD_MAP.severity]?.value ?? null;

  mapped.root_cause_description = fields[JIRA_FIELD_MAP.root_cause_description] ?? null;

  const rootCause = fields[JIRA_FIELD_MAP.root_cause]?.map((item: any) => item.value) ?? [];
  mapped.root_cause_initial = rootCause;
  mapped.root_cause_final = rootCause;

  // client_brand is no longer extracted here — brand resolution moved
  // to resolveBrandForTicket() in Batch 005.22 Phase 1 so the webhook
  // can do project-aware lookups (single-brand vs multi-brand).

  return mapped;
}

async function calculateLogNumber(ticketId: string): Promise<number> {
  const { data } = await supabase
    .from('quality_logs')
    .select('log_number')
    .eq('jira_ticket_id', ticketId)
    .eq('is_deleted', false)
    .order('log_number', { ascending: false })
    .limit(1);

  return (data?.[0]?.log_number ?? 0) + 1;
}

// -------------------------------------------------------------------------
// Request handler (Deno / Supabase Edge entrypoint)
// -------------------------------------------------------------------------
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!validateWebhookSecret(request)) {
    const url = new URL(request.url);
    console.warn(
      '[jira-webhook] rejected unauthenticated request',
      JSON.stringify({
        at: new Date().toISOString(),
        client: clientDescriptor(request),
        headerPresent: Boolean(request.headers.get('X-Webhook-Secret')),
        queryPresent: url.searchParams.has('secret'),
      }),
    );
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const payload: WebhookPayload = await request.json();

    if (payload.webhookEvent !== 'jira:issue_updated') {
      return new Response('Ignored', { status: 200 });
    }

    const issue = payload.issue;
    const projectKey = issue.fields.project.key;

    const projectConfig = await getProjectConfig(projectKey);
    if (!projectConfig?.is_active) {
      return new Response('Project not active', { status: 200 });
    }

    const statusChange = payload.changelog.items.find((item) => item.field === 'status');
    if (!statusChange) {
      return new Response('No status change', { status: 200 });
    }

    // -------------------------------------------------------------------
    // Milestone branch — records the FIRST time a ticket enters
    // 'Dev Client Review'. Runs before the rework branch so a transition
    // that doesn't satisfy isValidTransition (e.g. In Development →
    // Dev Client Review) still creates a milestone.
    //
    // Design: the milestone fact is independent of brand resolution. A
    // Jira outage or token issue must NOT drop the milestone row — the
    // insert always runs on a Dev Client Review transition, with brand
    // resolved best-effort: payload-first, getIssue fallback, then null.
    // Null brand_id rows are reconciled by scripts/backfill-milestones.ts.
    // See CLAUDE.md §13 rule 18.
    // -------------------------------------------------------------------
    // Milestone outcome for the response body — surfaced in the Supabase
    // Invocations tab so a single glance tells an admin whether a DCR
    // transition actually landed a row. Default holds for any transition
    // that doesn't target Dev Client Review.
    let milestoneOutcome = 'skipped-not-applicable';
    if (statusChange.toString === 'Dev Client Review') {
      const { data: existing } = await supabase
        .from('test_milestones')
        .select('id')
        .eq('jira_ticket_id', issue.key)
        .eq('milestone_type', 'dev_client_review')
        .eq('is_deleted', false)
        .maybeSingle();

      if (existing) {
        milestoneOutcome = 'skipped-duplicate';
      } else {
        // Decide whether we need to fetch the full issue. Summary +
        // brand both come from the payload first; getIssue() runs only
        // when the payload is missing summary OR (for multi-brand
        // projects) the brand custom field. The fetch is wrapped in
        // its own try/catch — Jira outages must not drop the milestone
        // (rule 18: milestone independence).
        const payloadFields = issue.fields as Record<string, unknown>;
        let resolvedSummary: string | null = issue.fields?.summary ?? null;
        const fieldKey = projectConfig.brand_jira_field_id;
        const payloadHasBrand =
          projectConfig.brand_model === 'single_brand' ||
          (fieldKey != null && payloadFields[fieldKey] != null);
        const needsFallback = !resolvedSummary || !payloadHasBrand;

        let fullIssueFields: Record<string, unknown> | undefined;
        if (needsFallback) {
          try {
            const fullIssue = await getIssue(issue.key);
            fullIssueFields = fullIssue.fields as Record<string, unknown>;
            if (!resolvedSummary && typeof fullIssue.fields?.summary === 'string') {
              resolvedSummary = fullIssue.fields.summary;
            }
          } catch (err) {
            console.warn('[jira-webhook] milestone: getIssue fallback failed', err);
            // Continue with payload-only data; the resolver tolerates
            // a missing fullIssueFields and the insert tolerates a
            // null brand (rule 18).
          }
        }

        const resolved = await resolveBrandForTicket(
          payloadFields,
          fullIssueFields,
          projectConfig,
          issue.key,
        );

        const { error: milestoneError } = await supabase
          .from('test_milestones')
          .insert({
            jira_ticket_id: issue.key,
            jira_ticket_url: `${jiraBaseUrl}/browse/${issue.key}`,
            jira_summary: resolvedSummary,
            brand_id: resolved.brandId,
            brand_jira_value: resolved.brandJiraValue,
            source: 'webhook',
            created_by: 'system',
          });

        if (milestoneError) {
          // Duplicate inserts (race against another webhook delivery) are
          // expected to collide against idx_test_milestones_unique; log
          // and carry on so the rework branch still runs.
          console.warn('[jira-webhook] milestone insert failed', milestoneError.message);
          milestoneOutcome = 'error-insert';
        } else {
          milestoneOutcome = resolved.brandId ? 'recorded' : 'recorded-no-brand';
        }
      }
    }

    if (!isValidTransition(statusChange.fromString, statusChange.toString)) {
      return new Response(
        `milestone: ${milestoneOutcome}; rework: skipped-not-applicable`,
        { status: 200 },
      );
    }

    const fullIssue = await getIssue(issue.key);
    const mappedFields = mapJiraFields(fullIssue.fields);

    // Brand resolution is project-aware (Batch 005.22 Phase 1). The
    // rework branch always has fullIssue available, so pass both the
    // payload fields and the full-issue fields to the resolver. The
    // returned clientBrandString is brands.jira_value verbatim per
    // §13 rule 28 (Option γ writeback).
    const resolved = await resolveBrandForTicket(
      issue.fields as Record<string, unknown>,
      fullIssue.fields as Record<string, unknown>,
      projectConfig,
      issue.key,
    );

    const hasDeploymentLabel = fullIssue.fields.labels?.includes('Deployment');
    const testType = hasDeploymentLabel ? 'Deployment' : 'A/B';

    const logNumber = await calculateLogNumber(issue.key);

    const logEntry = {
      jira_ticket_id: issue.key,
      jira_ticket_url: `${jiraBaseUrl}/browse/${issue.key}`,
      jira_summary: issue.fields.summary,
      project_key: projectKey,
      client_brand: resolved.clientBrandString,
      trigger_from_status: statusChange.fromString,
      trigger_to_status: statusChange.toString,
      log_number: logNumber,
      detected_by: mappedFields.detected_by,
      experiment_paused: mappedFields.experiment_paused,
      issue_category: mappedFields.issue_category,
      issue_subtype: mappedFields.issue_subtype,
      reproducibility: mappedFields.reproducibility,
      severity: mappedFields.severity,
      resolution_type: mappedFields.resolution_type,
      root_cause_initial: mappedFields.root_cause_initial,
      root_cause_final: mappedFields.root_cause_final,
      root_cause_description: mappedFields.root_cause_description,
      who_owns_fix: mappedFields.who_owns_fix,
      test_type: testType,
      preventable: mappedFields.preventable,
      documentation_updated: mappedFields.documentation_updated,
      process_improvement_needed: mappedFields.process_improvement_needed,
      jira_created_at: issue.fields.created,
      created_by: 'system',
    };

    const { data: insertedLog, error: insertError } = await supabase
      .from('quality_logs')
      .insert(logEntry)
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    await supabase
      .from('audit_log')
      .insert({
        log_entry_id: insertedLog.id,
        target_type: 'quality_log',
        target_id: insertedLog.id,
        action: 'CREATE',
        changed_by: 'system',
        notes: 'Created via Jira webhook',
      });

    return new Response(
      `milestone: ${milestoneOutcome}; rework: recorded`,
      { status: 200 },
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
