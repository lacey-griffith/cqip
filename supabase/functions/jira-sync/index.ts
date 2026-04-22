// Deno / Supabase Edge Function — periodic Jira sync.
// Self-contained: Jira client + field map inlined; no imports outside this
// file other than the supabase-js npm specifier.

import { createClient } from 'npm:@supabase/supabase-js@2';

// -------------------------------------------------------------------------
// Env
// -------------------------------------------------------------------------
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const jiraBaseUrl = Deno.env.get('JIRA_BASE_URL');
const jiraEmail = Deno.env.get('JIRA_EMAIL');
const jiraApiToken = Deno.env.get('JIRA_API_TOKEN');

if (!supabaseUrl || !serviceRoleKey || !jiraBaseUrl || !jiraEmail || !jiraApiToken) {
  throw new Error('Missing required environment variables for jira-sync function');
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
      `[jira-sync] unexpected client_brand shape on ${ticketId}`,
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
// Field mapping
// -------------------------------------------------------------------------
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

  mapped.root_cause_final = fields[JIRA_FIELD_MAP.root_cause]?.map((item: any) => item.value) ?? [];

  const rawBrand = fields[JIRA_FIELD_MAP.nbly_brand];
  mapped.client_brand = extractBrand(rawBrand, fields.summary ?? 'unknown');
  // Diagnostic: dump the raw shape whenever brand resolves to null, so we can
  // see WHY on the next live ticket in Supabase logs. Remove once confirmed.
  if (mapped.client_brand == null) {
    console.warn('[jira-sync] client_brand resolved null', JSON.stringify({
      ticket: fields.summary ?? 'unknown',
      rawType: typeof rawBrand,
      rawIsArray: Array.isArray(rawBrand),
      rawPreview: rawBrand == null ? null : JSON.stringify(rawBrand).slice(0, 300),
    }));
  }

  return mapped;
}

// -------------------------------------------------------------------------
// API-key validation — accepts the Supabase anon or service-role key as a
// query parameter (?apikey=...), an `apikey` header, or a Bearer token.
// Mirrors the query-param-first / header-fallback pattern used in
// jira-webhook's secret check.
// -------------------------------------------------------------------------
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

const validKeys = [anonKey, serviceRoleKey].filter((k): k is string => Boolean(k));

function validateApiKey(request: Request): boolean {
  if (validKeys.length === 0) return false;

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

  return candidates.some((candidate) =>
    validKeys.some((key) => timingSafeEqual(candidate, key)),
  );
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
// Request handler (Deno / Supabase Edge entrypoint)
// -------------------------------------------------------------------------
Deno.serve(async (request: Request) => {
  if (!validateApiKey(request)) {
    const url = new URL(request.url);
    console.warn(
      '[jira-sync] rejected unauthenticated request',
      JSON.stringify({
        at: new Date().toISOString(),
        client: clientDescriptor(request),
        queryPresent: url.searchParams.has('apikey'),
        headerPresent: Boolean(request.headers.get('apikey')),
        authHeaderPresent: Boolean(request.headers.get('authorization')),
      }),
    );
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { data: logs, error: fetchError } = await supabase
      .from('quality_logs')
      .select('*')
      .not('log_status', 'in', '("Resolved")')
      .eq('is_deleted', false);

    if (fetchError) {
      throw fetchError;
    }

    for (const log of logs ?? []) {
      try {
        const issue = await getIssue(log.jira_ticket_id);
        const mappedFields = mapJiraFields(issue.fields);

        const updateData = {
          jira_summary: issue.fields.summary,
          client_brand: mappedFields.client_brand,
          detected_by: mappedFields.detected_by,
          experiment_paused: mappedFields.experiment_paused,
          issue_category: mappedFields.issue_category,
          issue_subtype: mappedFields.issue_subtype,
          reproducibility: mappedFields.reproducibility,
          severity: mappedFields.severity,
          resolution_type: mappedFields.resolution_type,
          root_cause_final: mappedFields.root_cause_final,
          root_cause_description: mappedFields.root_cause_description,
          who_owns_fix: mappedFields.who_owns_fix,
          preventable: mappedFields.preventable,
          documentation_updated: mappedFields.documentation_updated,
          process_improvement_needed: mappedFields.process_improvement_needed,
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from('quality_logs')
          .update(updateData)
          .eq('id', log.id);

        const currentStatus = issue.fields.status?.name;
        if (
          currentStatus &&
          ['Dev QA', 'Dev Client Review'].includes(currentStatus) &&
          ['Open', 'In Progress'].includes(log.log_status)
        ) {
          await supabase
            .from('quality_logs')
            .update({ log_status: 'Pending Verification' })
            .eq('id', log.id);

          await supabase
            .from('audit_log')
            .insert({
              log_entry_id: log.id,
              action: 'STATUS_CHANGE',
              field_name: 'log_status',
              old_value: log.log_status,
              new_value: 'Pending Verification',
              changed_by: 'system',
              notes: 'Auto-advanced via sync',
            });
        }
      } catch (issueError) {
        console.error(`Error syncing log ${log.id}:`, issueError);
      }
    }

    return new Response('Sync completed', { status: 200 });
  } catch (error) {
    console.error('Sync error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
