/**
 * One-time backfill: overwrite jira_summary on CSV-imported quality_logs
 * with the real Jira ticket title from fields.summary.
 *
 * Context: the original CSV import (scripts/import-csv.ts) populated
 * jira_summary from a "Summary" spreadsheet column that actually held
 * issue descriptions, not ticket titles. Live webhook rows have correct
 * titles — only rows with created_by = 'csv_import' need fixing.
 * issue_details and root_cause_description stay untouched.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-jira-summaries.ts
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const jiraBaseUrl = process.env.JIRA_BASE_URL ?? '';
const jiraEmail = process.env.JIRA_EMAIL ?? '';
const jiraApiToken = process.env.JIRA_API_TOKEN ?? '';

if (!supabaseUrl || !serviceRoleKey || !jiraBaseUrl || !jiraEmail || !jiraApiToken) {
  console.error('Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const jiraAuth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');

const REQUEST_DELAY_MS = 100;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function truncate(s: string | null | undefined, limit = 200): string | null {
  if (s == null) return null;
  const str = String(s);
  return str.length > limit ? str.slice(0, limit) : str;
}

async function fetchIssueSummary(key: string): Promise<string | null> {
  let attempt = 0;
  while (true) {
    const res = await fetch(`${jiraBaseUrl}/rest/api/3/issue/${key}?fields=summary`, {
      headers: {
        Authorization: `Basic ${jiraAuth}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      const body = await res.json();
      return body?.fields?.summary ?? null;
    }
    if (res.status === 404) {
      const err = new Error('404');
      (err as Error & { code?: number }).code = 404;
      throw err;
    }
    if (res.status === 429 && attempt < 3) {
      const backoffMs = 1000 * Math.pow(2, attempt);
      console.warn(`  ! 429 from Jira, backing off ${backoffMs}ms`);
      await sleep(backoffMs);
      attempt += 1;
      continue;
    }
    const text = await res.text().catch(() => '');
    throw new Error(`Jira fetch failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
  }
}

async function run() {
  console.log('→ selecting CSV-imported logs…');
  const { data: logs, error } = await supabase
    .from('quality_logs')
    .select('id, jira_ticket_id, jira_summary')
    .eq('is_deleted', false)
    .eq('created_by', 'csv_import');

  if (error) {
    console.error('select failed:', error);
    process.exit(1);
  }
  if (!logs || logs.length === 0) {
    console.log('✔ nothing to backfill');
    return;
  }

  console.log(`→ ${logs.length} rows to check`);
  let processed = 0;
  let updated = 0;
  let unchanged = 0;
  let notFound = 0;
  let errored = 0;

  for (const log of logs) {
    processed += 1;
    try {
      const newSummary = await fetchIssueSummary(log.jira_ticket_id);
      if (newSummary == null) {
        // Issue exists but has no summary — extremely rare. Count as
        // unchanged to avoid stamping null over an existing string.
        unchanged += 1;
        continue;
      }
      if (newSummary === log.jira_summary) {
        unchanged += 1;
        continue;
      }

      const oldValue = truncate(log.jira_summary, 200);
      const nowIso = new Date().toISOString();
      const { error: updErr } = await supabase
        .from('quality_logs')
        .update({ jira_summary: newSummary, updated_at: nowIso })
        .eq('id', log.id);
      if (updErr) {
        console.error(`  ✗ update failed for ${log.jira_ticket_id}:`, updErr);
        errored += 1;
        continue;
      }

      const { error: auditErr } = await supabase.from('audit_log').insert({
        log_entry_id: log.id,
        action: 'UPDATE',
        field_name: 'jira_summary',
        old_value: oldValue,
        new_value: truncate(newSummary, 200),
        changed_by: 'csv_title_backfill',
        notes: 'Corrected historical title from CSV description',
      });
      if (auditErr) {
        console.warn(`  ! audit insert failed for ${log.jira_ticket_id}:`, auditErr.message);
      }

      updated += 1;
    } catch (e: unknown) {
      const err = e as Error & { code?: number };
      if (err.code === 404 || err.message?.startsWith('404')) {
        notFound += 1;
        console.log(`  · ${log.jira_ticket_id} not found in Jira (404), skipping`);
      } else {
        errored += 1;
        console.error(`  ✗ ${log.jira_ticket_id}:`, err.message ?? e);
      }
    }

    if (processed % 25 === 0) {
      console.log(`  · processed ${processed}/${logs.length}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log('');
  console.log(`Done. processed=${processed}, updated=${updated}, unchanged=${unchanged}, not_found=${notFound}, errored=${errored}`);
}

run().catch(e => {
  console.error('fatal:', e);
  process.exit(1);
});
