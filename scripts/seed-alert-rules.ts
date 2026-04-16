import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const defaultAlertRules = [
  {
    rule_name: 'Critical Issue Open',
    rule_type: 'severity_threshold',
    config: {
      severity: 'Critical',
      critical_threshold: 1,
      time_window_hours: 24,
    },
    is_active: true,
    notification_channels: ['teams', 'in_app'],
    created_by: 'system',
  },
  {
    rule_name: 'High Severity Spike',
    rule_type: 'severity_threshold',
    config: {
      severity: 'High',
      high_threshold: 3,
      time_window_hours: 168, // 7 days
    },
    is_active: true,
    notification_channels: ['teams', 'in_app'],
    created_by: 'system',
  },
  {
    rule_name: 'Repeat Root Cause',
    rule_type: 'frequency_pattern',
    config: {
      pattern_type: 'recurring',
      threshold_count: 5,
      time_window_hours: 720, // 30 days
      group_by: 'root_cause_final',
    },
    is_active: true,
    notification_channels: ['teams', 'in_app'],
    created_by: 'system',
  },
  {
    rule_name: 'Client Rework Spike',
    rule_type: 'frequency_pattern',
    config: {
      pattern_type: 'spike',
      threshold_count: 4,
      time_window_hours: 336, // 14 days
      group_by: 'client_brand',
    },
    is_active: true,
    notification_channels: ['teams', 'in_app'],
    created_by: 'system',
  },
  {
    rule_name: 'Repeated Sendback',
    rule_type: 'per_ticket',
    config: {
      log_number_threshold: 3,
    },
    is_active: true,
    notification_channels: ['teams', 'in_app'],
    created_by: 'system',
  },
  {
    rule_name: 'Long-Running Open',
    rule_type: 'aging',
    config: {
      max_age_hours: 336, // 14 days
      severity_filter: 'all',
      status_filter: ['Open', 'In Progress'],
    },
    is_active: true,
    notification_channels: ['teams', 'in_app'],
    created_by: 'system',
  },
];

async function seedAlertRules() {
  console.log('Seeding default alert rules...');

  try {
    // Check if rules already exist
    const { data: existingRules, error: checkError } = await supabase
      .from('alert_rules')
      .select('rule_name');

    if (checkError) {
      console.error('Error checking existing rules:', checkError);
      return;
    }

    if (existingRules && existingRules.length > 0) {
      console.log(`Found ${existingRules.length} existing alert rules. Skipping seed.`);
      return;
    }

    // Insert default rules
    const { data, error } = await supabase
      .from('alert_rules')
      .insert(defaultAlertRules)
      .select();

    if (error) {
      console.error('Error seeding alert rules:', error);
      return;
    }

    console.log(`Successfully seeded ${data?.length || 0} default alert rules:`);
    data?.forEach(rule => {
      console.log(`  - ${rule.rule_name} (${rule.rule_type})`);
    });

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

seedAlertRules();