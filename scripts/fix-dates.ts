/**
 * Reconcile quality_logs.triggered_at with the original CSV dates.
 *
 * Reads NBLY_QualityTrackingLog_Error_Log_.csv and updates the matching
 * quality_logs row for each CSV entry, using (jira_ticket_id, issue_category)
 * as the compound key so rows that share a ticket but differ in category are
 * disambiguated. Only rows originally imported by `csv_import` are touched.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

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
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

interface CSVRow {
  [key: string]: string;
}

interface CandidateLog {
  id: string;
  issue_category: string[] | null;
  triggered_at: string;
}

function parseCsvDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'N/A') return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function extractTicketId(raw: string | undefined): string | null {
  // Mirror the logic in scripts/import-csv.ts so we match whatever it stored.
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('atlassian.net')) {
    const match = trimmed.match(/browse\/([A-Z]+-\d+)/);
    return match ? match[1] : null;
  }
  return trimmed;
}

async function main() {
  const csvPath = path.join(process.cwd(), 'NBLY_QualityTrackingLog_Error_Log_.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const csv = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as CSVRow[];

  // Only rows that were actually imported (they had a Type of Issue value)
  const validRows = rows.filter(r => r['Type of Issue'] && r['Type of Issue'].trim() !== '');
  console.log(`Read ${rows.length} CSV rows; ${validRows.length} have a Type of Issue and were importable.`);

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const updatedIds = new Set<string>();
  let updated = 0;
  let skippedNoDate = 0;
  let skippedNoTicket = 0;
  let skippedNoMatch = 0;
  let skippedAlreadyUpdated = 0;
  let errors = 0;

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    const dateISO = parseCsvDate(row['Date']);
    if (!dateISO) {
      skippedNoDate++;
      continue;
    }

    const ticketId = extractTicketId(row['JIRA Ticket']);
    if (!ticketId) {
      skippedNoTicket++;
      continue;
    }

    const category = row['Type of Issue']?.trim() || null;

    const { data: matches, error: fetchError } = await supabase
      .from('quality_logs')
      .select('id, issue_category, triggered_at')
      .eq('jira_ticket_id', ticketId)
      .eq('created_by', 'csv_import')
      .eq('is_deleted', false);

    if (fetchError) {
      console.error(`Row ${i + 1} (${ticketId}): fetch error`, fetchError.message);
      errors++;
      continue;
    }

    if (!matches || matches.length === 0) {
      skippedNoMatch++;
      continue;
    }

    const candidates = matches as CandidateLog[];

    const categoryFiltered = category
      ? candidates.filter(m => Array.isArray(m.issue_category) && m.issue_category.includes(category))
      : [];

    const pool = categoryFiltered.length > 0 ? categoryFiltered : candidates;
    const target = pool.find(m => !updatedIds.has(m.id));

    if (!target) {
      skippedAlreadyUpdated++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('quality_logs')
      .update({ triggered_at: dateISO })
      .eq('id', target.id);

    if (updateError) {
      console.error(`Row ${i + 1} (${ticketId}): update error`, updateError.message);
      errors++;
      continue;
    }

    updatedIds.add(target.id);
    updated++;
  }

  console.log('');
  console.log('=== Reconciliation summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no valid date): ${skippedNoDate}`);
  console.log(`Skipped (unparseable ticket): ${skippedNoTicket}`);
  console.log(`Skipped (no csv_import row for ticket): ${skippedNoMatch}`);
  console.log(`Skipped (all matching rows already updated in this run): ${skippedAlreadyUpdated}`);
  console.log(`Errors: ${errors}`);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
