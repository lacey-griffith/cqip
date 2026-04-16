import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getIssue } from '../../../lib/jira/client.ts';
import { JIRA_FIELD_MAP } from '../../../lib/jira/field-map.ts';

const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

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

  // Root cause final: update
  mapped.root_cause_final = fields[JIRA_FIELD_MAP.root_cause]?.map((item: any) => item.value) ?? [];

  // nbly_brand
  mapped.client_brand = fields[JIRA_FIELD_MAP.nbly_brand]?.value ?? null;

  return mapped;
}

export async function onRequest() {
  try {
    // Fetch all open logs
    const { data: logs, error: fetchError } = await supabase
      .from('quality_logs')
      .select('*')
      .not('log_status', 'in', '("Resolved")')
      .eq('is_deleted', false);

    if (fetchError) {
      throw fetchError;
    }

    for (const log of logs) {
      try {
        // Fetch current issue from Jira
        const issue = await getIssue(log.jira_ticket_id);

        // Map updated fields
        const mappedFields = mapJiraFields(issue.fields);

        // Update log
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

        // Check for auto-advance
        const currentStatus = issue.fields.status.name;
        if (['Dev QA', 'Dev Client Review'].includes(currentStatus) &&
            ['Open', 'In Progress'].includes(log.log_status)) {
          await supabase
            .from('quality_logs')
            .update({ log_status: 'Pending Verification' })
            .eq('id', log.id);

          // Audit log for status change
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
        // Continue with next log
      }
    }

    return new Response('Sync completed', { status: 200 });
  } catch (error) {
    console.error('Sync error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}