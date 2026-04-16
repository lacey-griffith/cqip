import * as fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      process.env[key] = value;
    }
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

interface CSVRow {
  [key: string]: string;
}

interface QualityLog {
  jira_ticket_id: string;
  jira_ticket_url?: string;
  jira_summary?: string;
  project_key: string;
  client_brand?: string;
  trigger_from_status?: string;
  trigger_to_status: string;
  triggered_at?: string;
  log_number: number;
  log_status?: string;
  detected_by?: string;
  issue_category?: string[];
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
  preventable?: boolean | null;
  documentation_updated?: boolean | null;
  process_improvement_needed?: boolean | null;
  screenshot_urls?: string[];
  affected_url?: string;
  created_by: string;
}

// Simple CSV parser replaced with csv-parse
function parseCSV(csvContent: string): CSVRow[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CSVRow[];
  return records;
}

// Map status from CSV to database
function mapStatus(csvStatus: string): string {
  const statusMap: { [key: string]: string } = {
    'Resolved': 'Resolved',
    'In Progress': 'In Progress',
    'Open': 'Open',
    'Blocked': 'Blocked',
  };
  return statusMap[csvStatus] || 'Open';
}

// Extract project key from Jira ticket ID
function extractProjectKey(jiraTicketId: string): string {
  const match = jiraTicketId.match(/^([A-Z]+)-/);
  return match ? match[1] : '';
}

async function importCSV() {
  try {
    // Find and read CSV file
    const csvFileName = 'NBLY_QualityTrackingLog_Error_Log_.csv';
    const csvPath = path.join(process.cwd(), csvFileName);

    if (!fs.existsSync(csvPath)) {
      console.error(`CSV file not found: ${csvPath}`);
      process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvContent);

    console.log(`Found ${rows.length} rows in CSV`);

    // Filter rows where Type of Issue is NOT empty
    const validRows = rows.filter(row => row['Type of Issue'] && row['Type of Issue'].trim() !== '');
    console.log(`Filtered to ${validRows.length} rows with non-empty Type of Issue`);

    if (validRows.length === 0) {
      console.log('No valid rows to import');
      return;
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // First, check which projects need to exist in the database
    const projectKeys = new Set<string>();
    validRows.forEach(row => {
      const jiraTicketRaw = row['JIRA Ticket'] ? row['JIRA Ticket'].trim() : '';
      let projectKey = '';
      
      if (jiraTicketRaw.includes('fusion92.atlassian.net')) {
        const match = jiraTicketRaw.match(/browse\/([A-Z]+)-\d+/);
        if (match) {
          projectKey = match[1];
        }
      } else {
        const match = jiraTicketRaw.match(/^([A-Z]+)-/);
        if (match) {
          projectKey = match[1];
        }
      }

      if (projectKey) {
        projectKeys.add(projectKey);
      }
    });

    console.log(`Found project keys: ${Array.from(projectKeys).join(', ')}`);

    // Create projects if they don't exist
    for (const pk of projectKeys) {
      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('jira_project_key', pk)
        .single();

      if (!existing) {
        const { error: insertError } = await supabase.from('projects').insert({
          jira_project_key: pk,
          client_name: pk,
          display_name: pk,
          is_active: true,
        });

        if (insertError && insertError.code !== '23505') { // 23505 = duplicate key
          console.warn(`Could not create project ${pk}:`, insertError);
        } else {
          console.log(`✓ Created project ${pk}`);
        }
      }
    }

    // Map CSV rows to quality_logs records
    const logsToInsert: QualityLog[] = validRows
      .map(row => {
        // Extract ticket ID from JIRA Ticket column (may be URL or just ID)
        let jiraTicketId = '';
        let jiraTicketUrl = '';
        const jiraTicketRaw = row['JIRA Ticket'] ? row['JIRA Ticket'].trim() : '';

        if (jiraTicketRaw.includes('fusion92.atlassian.net')) {
          // It's a URL, extract the ticket ID
          const match = jiraTicketRaw.match(/browse\/([A-Z]+-\d+)/);
          if (match) {
            jiraTicketId = match[1];
            jiraTicketUrl = jiraTicketRaw;
          }
        } else {
          // It's just a ticket ID
          jiraTicketId = jiraTicketRaw;
          if (jiraTicketId) {
            jiraTicketUrl = `https://fusion92.atlassian.net/browse/${jiraTicketId}`;
          }
        }

        const projectKey = extractProjectKey(jiraTicketId);

        // Skip rows with empty project key
        if (!projectKey) {
          console.warn(`Skipping row: could not extract project key from ticket "${jiraTicketRaw}"`);
          return null;
        }

        // Parse date (CSV format appears to be MM/DD/YYYY)
        let triggeredAt: string | undefined;
        if (row['Date']) {
          const dateStr = row['Date'].trim();
          if (dateStr && dateStr !== 'N/A') {
            const date = new Date(dateStr);
            // Check if date is valid
            if (!isNaN(date.getTime())) {
              triggeredAt = date.toISOString();
            } else {
              console.warn(`Invalid date "${dateStr}" for ticket ${jiraTicketId}, using current time`);
              triggeredAt = new Date().toISOString();
            }
          } else {
            // No date provided, use current time
            triggeredAt = new Date().toISOString();
          }
        } else {
          // No date column, use current time
          triggeredAt = new Date().toISOString();
        }

        // Parse screenshot links
        let screenshotUrls: string[] | undefined;
        if (row['Screenshot Links'] && row['Screenshot Links'].trim() !== 'N/A') {
          screenshotUrls = [row['Screenshot Links'].trim()];
        }

        // Parse affected URL
        let affectedUrl: string | undefined;
        if (row['URL'] && row['URL'].trim() !== 'N/A') {
          affectedUrl = row['URL'].trim();
        }

        // Validate severity
        const validSeverities = ['Critical', 'High', 'Medium', 'Low'];
        let severity: string | undefined = row['Severity'] ? row['Severity'].trim() : undefined;
        if (severity && !validSeverities.includes(severity)) {
          console.warn(`Invalid severity value "${severity}" for ticket ${jiraTicketId}, skipping`);
          severity = undefined;
        }

        const log: QualityLog = {
          jira_ticket_id: jiraTicketId,
          jira_ticket_url: jiraTicketUrl || undefined,
          jira_summary: row['Summary'] ? row['Summary'].trim() : undefined,
          project_key: projectKey,
          client_brand: row['Client'] ? row['Client'].trim() : undefined,
          trigger_from_status: row['Errored'] && row['Errored'].trim() ? row['Errored'].trim() : 'Live',
          trigger_to_status: 'Active Dev',
          triggered_at: triggeredAt,
          log_number: 1,
          log_status: row['Status'] ? mapStatus(row['Status'].trim()) : 'Open',
          detected_by: row['Origin'] ? row['Origin'].trim() : undefined,
          issue_category: row['Type of Issue'] ? [row['Type of Issue'].trim()] : undefined,
          issue_details: row['Issue Details'] ? row['Issue Details'].trim() : undefined,
          reproducibility: undefined,
          severity: severity,
          resolution_type: undefined,
          root_cause_initial: row['Root Cause - Initial'] ? [row['Root Cause - Initial'].trim()] : undefined,
          root_cause_final: row['Root Cause - Final'] ? [row['Root Cause - Final'].trim()] : undefined,
          root_cause_description: row['Issue Details'] ? row['Issue Details'].trim() : undefined,
          resolution_notes: row['Resolution'] ? row['Resolution'].trim() : undefined,
          who_owns_fix: undefined,
          test_type: 'A/B',
          preventable: undefined,
          documentation_updated: undefined,
          process_improvement_needed: undefined,
          screenshot_urls: screenshotUrls,
          affected_url: affectedUrl,
          created_by: 'csv_import',
        };

        return log;
      })
      .filter((log): log is QualityLog => log !== null);

    console.log(`Inserting ${logsToInsert.length} quality logs...`);

    // Insert in batches to avoid payload size limits
    const batchSize = 100;
    for (let i = 0; i < logsToInsert.length; i += batchSize) {
      const batch = logsToInsert.slice(i, i + batchSize);
      const { error } = await supabase.from('quality_logs').insert(batch);

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        throw error;
      }

      console.log(`✓ Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
    }

    console.log(`\n✅ Successfully imported ${logsToInsert.length} quality logs`);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

importCSV();
