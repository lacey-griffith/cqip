/**
 * On-demand backfill: re-fetch client_brand for quality_logs where brand is null.
 *
 * Usage:
 *   npx tsx scripts/backfill-brands.ts
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN (same as .env.local).
 *
 * The script:
 *   1. Selects all non-deleted logs WHERE client_brand IS NULL.
 *   2. For each, looks up the project's brand_jira_field_id from the
 *      `projects` table (Batch 005.22 Phase 1 made the field per-project).
 *      Single-brand projects are skipped here — their brand is determined
 *      by the project itself, not a Jira field.
 *   3. Fetches the Jira ticket and extracts the configured brand field.
 *   4. If a brand is now extractable, UPDATE the row + write an audit_log entry.
 *   5. Skips tickets Jira returns 404/401 for (prints, moves on).
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

interface ProjectConfig {
  brand_model: 'multi_brand' | 'single_brand';
  brand_jira_field_id: string | null;
}

const projectConfigCache = new Map<string, ProjectConfig | null>();

async function getProjectConfig(projectKey: string): Promise<ProjectConfig | null> {
  const cached = projectConfigCache.get(projectKey);
  if (cached !== undefined) return cached;
  const { data } = await supabase
    .from('projects')
    .select('brand_model, brand_jira_field_id')
    .eq('jira_project_key', projectKey)
    .maybeSingle();
  const config = (data as ProjectConfig | null) ?? null;
  projectConfigCache.set(projectKey, config);
  return config;
}

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
    .select('id, jira_ticket_id, project_key, client_brand')
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
  let skippedSingleBrand = 0;
  let errored = 0;

  for (const log of logs) {
    try {
      const config = await getProjectConfig(log.project_key);
      if (!config) {
        console.warn(`  · ${log.jira_ticket_id}: project ${log.project_key} not found, skipping`);
        skippedStillNull += 1;
        continue;
      }
      // Single-brand projects don't read a Jira field — their brand is
      // determined by the project itself. A null client_brand on a
      // single-brand log is a Phase-1 migration artifact that should
      // be fixed via the migration's conditional UPDATE block, not
      // here. Skip rather than guess.
      if (config.brand_model === 'single_brand') {
        skippedSingleBrand += 1;
        continue;
      }
      const fieldId = config.brand_jira_field_id;
      if (!fieldId) {
        // Multi-brand row missing field config — shouldn't happen
        // post-Phase-1 (CHECK enforces it), defensive only.
        console.warn(`  · ${log.jira_ticket_id}: project ${log.project_key} has no brand_jira_field_id, skipping`);
        skippedStillNull += 1;
        continue;
      }
      const issue = await fetchJiraIssue(log.jira_ticket_id);
      const raw = issue.fields?.[fieldId];
      const extracted = extractBrand(raw);
      if (!extracted) {
        skippedStillNull += 1;
        continue;
      }

      // Option γ writeback per §13 rule 28: client_brand must source
      // from brands.jira_value verbatim, not the raw extracted string.
      // Walk brands → aliases; on match, write the canonical
      // jira_value. On no match, preserve the legacy passthrough
      // behavior (raw extracted string) — same as pre-Phase-1.
      let writeValue = extracted;
      const { data: brandRow } = await supabase
        .from('brands')
        .select('jira_value')
        .eq('jira_value', extracted)
        .maybeSingle();
      if (brandRow?.jira_value) {
        writeValue = brandRow.jira_value;
      } else {
        const { data: aliasRow } = await supabase
          .from('brand_aliases')
          .select('brands(jira_value)')
          .eq('jira_value', extracted)
          .maybeSingle();
        const aliasJiraValue = (aliasRow as { brands?: { jira_value?: string } } | null)
          ?.brands?.jira_value;
        if (aliasJiraValue) {
          writeValue = aliasJiraValue;
        } else {
          console.warn(`  · ${log.jira_ticket_id}: no brand or alias match for "${extracted}", writing raw value`);
        }
      }

      const { error: updErr } = await supabase
        .from('quality_logs')
        .update({ client_brand: writeValue, updated_at: new Date().toISOString() })
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
        new_value: writeValue,
        changed_by: 'backfill_script',
        notes: `Backfilled from Jira ${fieldId}`,
      });
      console.log(`  ✓ ${log.jira_ticket_id} → ${writeValue}`);
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
  console.log(`Done. updated=${updated}, still_null=${skippedStillNull}, single_brand=${skippedSingleBrand}, not_found=${skippedMissing}, errored=${errored}`);
}

run().catch(e => {
  console.error('fatal:', e);
  process.exit(1);
});
