import { createClient } from '@supabase/supabase-js';
import { getIssue } from '../../../lib/jira/client';
import { JIRA_FIELD_MAP } from '../../../lib/jira/field-map';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.WEBHOOK_SECRET;
const baseUrl = process.env.JIRA_BASE_URL;

if (!supabaseUrl || !serviceRoleKey || !webhookSecret || !baseUrl) {
  throw new Error('Missing required environment variables for Jira webhook function');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

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
  const secret = request.headers.get('X-Webhook-Secret');
  if (!secret || !webhookSecret) return false;
  return timingSafeEqual(secret, webhookSecret);
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

  // who_owns_fix: cascading select
  const whoOwnsFix = fields[JIRA_FIELD_MAP.who_owns_fix];
  mapped.who_owns_fix = whoOwnsFix?.child?.value ?? whoOwnsFix?.value ?? null;

  // detected_by: User Picker
  mapped.detected_by = fields[JIRA_FIELD_MAP.detected_by]?.displayName ?? null;

  // Checkboxes
  mapped.documentation_updated = (fields[JIRA_FIELD_MAP.documentation_updated]?.length ?? 0) > 0;
  mapped.experiment_paused = (fields[JIRA_FIELD_MAP.experiment_paused]?.length ?? 0) > 0;
  mapped.preventable = (fields[JIRA_FIELD_MAP.preventable]?.length ?? 0) > 0;
  mapped.process_improvement_needed = (fields[JIRA_FIELD_MAP.process_improvement_needed]?.length ?? 0) > 0;

  // Multi-select
  mapped.issue_category = fields[JIRA_FIELD_MAP.issue_category]?.map((item: any) => item.value) ?? [];
  mapped.issue_subtype = fields[JIRA_FIELD_MAP.issue_subtype]?.map((item: any) => item.value) ?? [];
  mapped.resolution_type = fields[JIRA_FIELD_MAP.resolution_type]?.map((item: any) => item.value) ?? [];

  // Single select
  mapped.reproducibility = fields[JIRA_FIELD_MAP.reproducibility]?.value ?? null;
  mapped.severity = fields[JIRA_FIELD_MAP.severity]?.value ?? null;

  // Text
  mapped.root_cause_description = fields[JIRA_FIELD_MAP.root_cause_description] ?? null;

  // Root cause: multi-select
  const rootCause = fields[JIRA_FIELD_MAP.root_cause]?.map((item: any) => item.value) ?? [];
  mapped.root_cause_initial = rootCause;
  mapped.root_cause_final = rootCause;

  // nbly_brand: pending
  mapped.client_brand = fields[JIRA_FIELD_MAP.nbly_brand]?.value ?? null;

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

export async function onRequest(context: { request: Request }) {
  const { request } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!validateWebhookSecret(request)) {
    console.warn(
      '[jira-webhook] rejected unauthenticated request',
      JSON.stringify({
        at: new Date().toISOString(),
        client: clientDescriptor(request),
        headerPresent: Boolean(request.headers.get('X-Webhook-Secret')),
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

    // Check if project is active
    const { data: project } = await supabase
      .from('projects')
      .select('is_active')
      .eq('jira_project_key', projectKey)
      .single();

    if (!project?.is_active) {
      return new Response('Project not active', { status: 200 });
    }

    // Find status change
    const statusChange = payload.changelog.items.find(item => item.field === 'status');
    if (!statusChange) {
      return new Response('No status change', { status: 200 });
    }

    if (!isValidTransition(statusChange.fromString, statusChange.toString)) {
      return new Response('Invalid transition', { status: 200 });
    }

    // Fetch full issue
    const fullIssue = await getIssue(issue.key);

    // Map fields
    const mappedFields = mapJiraFields(fullIssue.fields);

    // Determine test_type
    const hasDeploymentLabel = fullIssue.fields.labels?.includes('Deployment');
    const testType = hasDeploymentLabel ? 'Deployment' : 'A/B';

    // Calculate log_number
    const logNumber = await calculateLogNumber(issue.key);

    // Prepare log entry
    const logEntry = {
      jira_ticket_id: issue.key,
      jira_ticket_url: `${baseUrl}/browse/${issue.key}`,
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

    // Insert log
    const { data: insertedLog, error: insertError } = await supabase
      .from('quality_logs')
      .insert(logEntry)
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    // Insert audit log
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
}