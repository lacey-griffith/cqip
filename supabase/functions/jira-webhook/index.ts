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
  nbly_brand:                 'customfield_12220',
} as const;

// The NBLY brand field can come back as a string, a single-select { value },
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

  mapped.client_brand = extractBrand(fields[JIRA_FIELD_MAP.nbly_brand], fields.summary ?? 'unknown');

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

    const { data: project } = await supabase
      .from('projects')
      .select('is_active')
      .eq('jira_project_key', projectKey)
      .single();

    if (!project?.is_active) {
      return new Response('Project not active', { status: 200 });
    }

    const statusChange = payload.changelog.items.find((item) => item.field === 'status');
    if (!statusChange) {
      return new Response('No status change', { status: 200 });
    }

    if (!isValidTransition(statusChange.fromString, statusChange.toString)) {
      return new Response('Invalid transition', { status: 200 });
    }

    const fullIssue = await getIssue(issue.key);
    const mappedFields = mapJiraFields(fullIssue.fields);

    const hasDeploymentLabel = fullIssue.fields.labels?.includes('Deployment');
    const testType = hasDeploymentLabel ? 'Deployment' : 'A/B';

    const logNumber = await calculateLogNumber(issue.key);

    const logEntry = {
      jira_ticket_id: issue.key,
      jira_ticket_url: `${jiraBaseUrl}/browse/${issue.key}`,
      jira_summary: issue.fields.summary,
      project_key: projectKey,
      client_brand: mappedFields.client_brand,
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
        action: 'CREATE',
        changed_by: 'system',
        notes: 'Created via Jira webhook',
      });

    return new Response('Log created', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
