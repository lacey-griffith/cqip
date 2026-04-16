import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface AlertRule {
  id: string;
  rule_name: string;
  rule_type: 'severity_threshold' | 'frequency_pattern' | 'per_ticket' | 'aging';
  config: any;
  is_active: boolean;
  notification_channels: string[];
  created_by: string;
  created_at: string;
}

export interface QualityLog {
  id: string;
  jira_ticket_id: string;
  jira_ticket_url?: string;
  jira_summary?: string;
  project_key: string;
  client_brand?: string;
  trigger_from_status: string;
  trigger_to_status: string;
  triggered_at: string;
  log_number: number;
  log_status: string;
  detected_by?: string;
  experiment_paused?: boolean;
  issue_category?: string[];
  issue_subtype?: string[];
  issue_details?: string;
  reproducibility?: string;
  severity?: string;
  resolution_type?: string[];
  root_cause_initial?: string[];
  root_cause_final?: string[];
  root_cause_description?: string;
  resolution_notes?: string;
  who_owns_fix?: string;
  test_type: string;
  preventable?: boolean;
  documentation_updated?: boolean;
  process_improvement_needed?: boolean;
  screenshot_urls?: string[];
  affected_url?: string;
  jira_created_at?: string;
  resolved_at?: string;
  created_by: string;
  updated_at: string;
  ai_suggested_root_cause?: string[];
  ai_confidence_score?: number;
  notes?: string;
  is_deleted: boolean;
}

/**
 * Evaluate all active alert rules against a newly created quality log
 * This function is called by the jira-webhook edge function after a log is created
 */
export async function evaluateAlertRules(newLog: QualityLog): Promise<void> {
  try {
    // Get all active alert rules
    const { data: rules, error } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching alert rules:', error);
      return;
    }

    if (!rules || rules.length === 0) {
      console.log('No active alert rules found');
      return;
    }

    // Evaluate each rule
    for (const rule of rules) {
      const isTriggered = await evaluateRule(rule, newLog);

      if (isTriggered) {
        // Check if this alert is already active (not resolved)
        const { data: existingAlert } = await supabase
          .from('alert_events')
          .select('id')
          .eq('rule_id', rule.id)
          .eq('log_entry_id', newLog.id)
          .is('resolved_at', null)
          .single();

        if (!existingAlert) {
          // Create new alert event
          const { error: insertError } = await supabase
            .from('alert_events')
            .insert({
              rule_id: rule.id,
              log_entry_id: newLog.id,
              triggered_at: new Date().toISOString(),
              notification_sent: false,
            });

          if (insertError) {
            console.error('Error creating alert event:', insertError);
          } else {
            console.log(`Alert triggered: ${rule.rule_name} for log ${newLog.id}`);

            // TODO: Send notifications (Teams webhook, in-app notifications)
            // This would be implemented in a separate notification service
          }
        }
      }
    }
  } catch (err) {
    console.error('Error evaluating alert rules:', err);
  }
}

/**
 * Evaluate a single alert rule against a quality log
 */
async function evaluateRule(rule: AlertRule, log: QualityLog): Promise<boolean> {
  switch (rule.rule_type) {
    case 'severity_threshold':
      return evaluateSeverityThreshold(rule, log);
    case 'frequency_pattern':
      return await evaluateFrequencyPattern(rule, log);
    case 'per_ticket':
      return evaluatePerTicket(rule, log);
    case 'aging':
      return evaluateAging(rule, log);
    default:
      console.warn(`Unknown rule type: ${rule.rule_type}`);
      return false;
  }
}

/**
 * Evaluate severity threshold rules
 * Examples:
 * - severity = 'Critical'
 * - severity = 'High', count >= 3, window = 7 days
 */
function evaluateSeverityThreshold(rule: AlertRule, log: QualityLog): boolean {
  const { severity, count, window } = rule.config;

  if (log.severity !== severity) {
    return false;
  }

  // If no count/window specified, trigger on single occurrence
  if (!count || !window) {
    return true;
  }

  // For count-based rules, we need to check historical data
  // This is handled in frequency_pattern evaluation
  return false;
}

/**
 * Evaluate frequency pattern rules
 * Examples:
 * - same root_cause_final, count >= 5, window = 30 days
 * - same client_brand, count >= 4, window = 14 days
 */
async function evaluateFrequencyPattern(rule: AlertRule, log: QualityLog): Promise<boolean> {
  const { field, value, count, window } = rule.config;

  if (!field || !count || !window) {
    console.warn('Frequency pattern rule missing required config:', rule.config);
    return false;
  }

  // Calculate window start date
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - window);

  let query = supabase
    .from('quality_logs')
    .select('id', { count: 'exact' })
    .eq('is_deleted', false)
    .gte('triggered_at', windowStart.toISOString());

  // Apply field-specific filtering
  if (field === 'root_cause_final') {
    if (log.root_cause_final && Array.isArray(log.root_cause_final) && log.root_cause_final.length > 0) {
      // Check if any of the root causes in this log match the pattern
      query = query.overlaps('root_cause_final', log.root_cause_final);
    } else {
      return false;
    }
  } else if (field === 'client_brand') {
    if (log.client_brand) {
      query = query.eq('client_brand', log.client_brand);
    } else {
      return false;
    }
  } else if (field === 'severity') {
    if (log.severity) {
      query = query.eq('severity', log.severity);
    } else {
      return false;
    }
  }

  const { count: matchingCount, error } = await query;

  if (error) {
    console.error('Error evaluating frequency pattern:', error);
    return false;
  }

  return (matchingCount || 0) >= count;
}

/**
 * Evaluate per-ticket rules
 * Example: log_number >= 3
 */
function evaluatePerTicket(rule: AlertRule, log: QualityLog): boolean {
  const { log_number_threshold } = rule.config;

  if (!log_number_threshold) {
    console.warn('Per-ticket rule missing log_number_threshold:', rule.config);
    return false;
  }

  return log.log_number >= log_number_threshold;
}

/**
 * Evaluate aging rules
 * Example: log_status IN ('Open','In Progress'), age >= 14 days
 */
function evaluateAging(rule: AlertRule, log: QualityLog): boolean {
  const { statuses, age_days } = rule.config;

  if (!statuses || !Array.isArray(statuses) || !age_days) {
    console.warn('Aging rule missing required config:', rule.config);
    return false;
  }

  // Check if log status matches
  if (!statuses.includes(log.log_status)) {
    return false;
  }

  // Calculate age in days
  const triggeredAt = new Date(log.triggered_at);
  const now = new Date();
  const ageInDays = (now.getTime() - triggeredAt.getTime()) / (1000 * 60 * 60 * 24);

  return ageInDays >= age_days;
}

/**
 * Get default alert rules to seed the database
 */
export function getDefaultAlertRules(): Omit<AlertRule, 'id' | 'created_at'>[] {
  return [
    {
      rule_name: 'Critical Issue Open',
      rule_type: 'severity_threshold',
      config: { severity: 'Critical' },
      is_active: true,
      notification_channels: ['teams', 'in_app'],
      created_by: 'system',
    },
    {
      rule_name: 'High Severity Spike',
      rule_type: 'frequency_pattern',
      config: {
        field: 'severity',
        value: 'High',
        count: 3,
        window: 7, // days
      },
      is_active: true,
      notification_channels: ['teams', 'in_app'],
      created_by: 'system',
    },
    {
      rule_name: 'Repeat Root Cause',
      rule_type: 'frequency_pattern',
      config: {
        field: 'root_cause_final',
        count: 5,
        window: 30, // days
      },
      is_active: true,
      notification_channels: ['teams', 'in_app'],
      created_by: 'system',
    },
    {
      rule_name: 'Client Rework Spike',
      rule_type: 'frequency_pattern',
      config: {
        field: 'client_brand',
        count: 4,
        window: 14, // days
      },
      is_active: true,
      notification_channels: ['teams', 'in_app'],
      created_by: 'system',
    },
    {
      rule_name: 'Repeated Sendback',
      rule_type: 'per_ticket',
      config: { log_number_threshold: 3 },
      is_active: true,
      notification_channels: ['teams', 'in_app'],
      created_by: 'system',
    },
    {
      rule_name: 'Long-Running Open',
      rule_type: 'aging',
      config: {
        statuses: ['Open', 'In Progress'],
        age_days: 14,
      },
      is_active: true,
      notification_channels: ['teams', 'in_app'],
      created_by: 'system',
    },
  ];
}
