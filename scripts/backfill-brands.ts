/**
 * One-time backfill: re-fetch client_brand for quality_logs where brand is null.
 *
 * Usage:
 *   npx tsx scripts/backfill-brands.ts
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN (same as .env.local).
 *
 * The script:
 *   1. Selects all non-deleted logs WHERE client_brand IS NULL.
 *   2. For each, fetches the Jira ticket and extracts customfield_12220.
 *   3. If a brand is now extractable, UPDATE the row + write an audit_log entry.
 *   4. Skips tickets Jira returns 404/401 for (prints, moves on).
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

const NBLY_BRAND_FIELD = 'customfield_12220';

function extractBrand(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (!first) return null;
    return extractBrand(first);
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.value === 'string') return (obj.value as string).trim() || null;
    if (obj.child && typeof (obj.child as Record<string, unknown>).value === 'string') {
      return ((obj.child as Record<string, unknown>).value as string).trim() || null;
    }
    if (typeof obj.name === 'string') return (obj.name as string).trim() || null;
  }
  return null;
}

async function fetchJiraIssue(key: string) {
  const res = await fetch(`${jiraBaseUrl}/rest/api/3/issue/${key}`, {
    headers: {
      Authorization: `Basic ${jiraAuth}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function run() {
  console.log('→ selecting logs with null client_brand…');
  const { data: logs, error } = await supabase
    .from('quality_logs')
    .select('id, jira_ticket_id, client_brand')
    .is('client_brand', null)
    .eq('is_deleted', false);

  if (error) {
    console.error('select failed:', error);
    process.exit(1);
  }

  if (!logs || logs.length === 0) {
    console.log('✔ nothing to backfill');
    return;
  }

  console.log(`→ ${logs.length} logs to check`);
  let updated = 0;
  let skippedMissing = 0;
  let skippedStillNull = 0;
  let errored = 0;

  for (const log of logs) {
    try {
      const issue = await fetchJiraIssue(log.jira_ticket_id);
      const raw = issue.fields?.[NBLY_BRAND_FIELD];
      const brand = extractBrand(raw);
      if (!brand) {
        skippedStillNull += 1;
        continue;
      }
      const { error: updErr } = await supabase
        .from('quality_logs')
        .update({ client_brand: brand, updated_at: new Date().toISOString() })
        .eq('id', log.id);
      if (updErr) {
        console.error(`  ✗ update failed for ${log.jira_ticket_id}:`, updErr);
        errored += 1;
        continue;
      }
      await supabase.from('audit_log').insert({
        log_entry_id: log.id,
        action: 'UPDATE',
        field_name: 'client_brand',
        old_value: null,
        new_value: brand,
        changed_by: 'backfill_script',
        notes: 'Backfilled from Jira customfield_12220',
      });
      console.log(`  ✓ ${log.jira_ticket_id} → ${brand}`);
      updated += 1;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith('404')) {
        skippedMissing += 1;
        console.log(`  · ${log.jira_ticket_id} not found in Jira (404), skipping`);
      } else {
        errored += 1;
        console.error(`  ✗ ${log.jira_ticket_id}:`, msg);
      }
    }
  }

  console.log('');
  console.log(`Done. updated=${updated}, still_null=${skippedStillNull}, not_found=${skippedMissing}, errored=${errored}`);
}

run().catch(e => {
  console.error('fatal:', e);
  process.exit(1);
});
