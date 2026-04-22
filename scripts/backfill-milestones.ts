/**
 * One-time backfill: walk Jira changelogs and record the FIRST time every
 * NBLYCRO ticket entered 'Dev Client Review' as a test_milestones row.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-milestones.ts
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN (same as .env.local).
 *
 * Strategy:
 *   1. Page through every issue in NBLYCRO via /rest/api/3/search?jql=…
 *      with expand=changelog, 100 per page.
 *   2. For each issue, scan histories in chronological order; take the
 *      FIRST history whose items include {field:'status', toString:'Dev Client Review'}.
 *   3. Resolve brand_id by matching the issue's current
 *      customfield_12220 value against the brands table.
 *   4. Insert a test_milestone with source='backfill'. The partial
 *      unique index (jira_ticket_id, milestone_type) WHERE is_deleted = FALSE
 *      silently rejects duplicates from prior webhook runs or earlier
 *      backfill passes.
 *   5. Rate-limit at 100ms between issue fetches; back off exponentially
 *      on 429.
 *   6. Log any brand_jira_value that didn't match the seed list so the
 *      brands seed in migration 009 can be patched.
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
const JQL = 'project = NBLYCRO';
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 100;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

interface ChangelogItem {
  field: string;
  toString?: string;
}

interface ChangelogHistory {
  created: string;
  items: ChangelogItem[];
}

interface JiraIssue {
  key: string;
  fields: {
    summary?: string;
    [fieldId: string]: unknown;
  };
  changelog?: {
    histories?: ChangelogHistory[];
  };
}

interface JiraSearchResponse {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

async function jiraSearch(startAt: number): Promise<JiraSearchResponse> {
  const url = new URL(`${jiraBaseUrl}/rest/api/3/search`);
  url.searchParams.set('jql', JQL);
  url.searchParams.set('startAt', String(startAt));
  url.searchParams.set('maxResults', String(PAGE_SIZE));
  url.searchParams.set('expand', 'changelog');
  url.searchParams.set('fields', `summary,${NBLY_BRAND_FIELD}`);

  let attempt = 0;
  while (true) {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${jiraAuth}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) return res.json() as Promise<JiraSearchResponse>;
    if (res.status === 429 && attempt < 3) {
      const backoffMs = 1000 * Math.pow(2, attempt);
      console.warn(`  ! 429 from Jira, backing off ${backoffMs}ms`);
      await sleep(backoffMs);
      attempt += 1;
      continue;
    }
    throw new Error(`Jira search failed: ${res.status} ${res.statusText}`);
  }
}

function firstDevClientReviewEntry(issue: JiraIssue): string | null {
  const histories = issue.changelog?.histories ?? [];
  // Jira returns histories in reverse-chronological order on some tenants
  // and chronological on others. Sort explicitly to be safe.
  const sorted = [...histories].sort(
    (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
  );
  for (const history of sorted) {
    for (const item of history.items ?? []) {
      if (item.field === 'status' && item.toString === 'Dev Client Review') {
        return history.created;
      }
    }
  }
  return null;
}

async function loadBrandMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('brands').select('id, jira_value');
  if (error) {
    console.error('Failed to load brands table:', error);
    process.exit(1);
  }
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.jira_value) map.set(row.jira_value, row.id);
  }
  return map;
}

async function run() {
  console.log('→ loading brands table…');
  const brandMap = await loadBrandMap();
  console.log(`  loaded ${brandMap.size} brands`);

  let startAt = 0;
  let total = Infinity;
  let processed = 0;
  let inserted = 0;
  let skippedNoDcr = 0;
  let skippedDuplicate = 0;
  let errored = 0;
  const unmatchedBrands = new Map<string, number>();

  while (startAt < total) {
    const page = await jiraSearch(startAt);
    total = page.total;
    if (startAt === 0) console.log(`→ ${total} NBLYCRO issues to scan`);

    for (const issue of page.issues) {
      processed += 1;
      try {
        const reachedAt = firstDevClientReviewEntry(issue);
        if (!reachedAt) {
          skippedNoDcr += 1;
          continue;
        }

        const rawBrand = issue.fields?.[NBLY_BRAND_FIELD];
        const brandValue = extractBrand(rawBrand);
        let brandId: string | null = null;
        if (brandValue) {
          brandId = brandMap.get(brandValue) ?? null;
          if (!brandId) {
            unmatchedBrands.set(brandValue, (unmatchedBrands.get(brandValue) ?? 0) + 1);
          }
        }

        const { error: insertError } = await supabase.from('test_milestones').insert({
          jira_ticket_id: issue.key,
          jira_ticket_url: `${jiraBaseUrl}/browse/${issue.key}`,
          jira_summary: issue.fields?.summary ?? null,
          brand_id: brandId,
          brand_jira_value: brandValue,
          milestone_type: 'dev_client_review',
          reached_at: reachedAt,
          source: 'backfill',
          created_by: 'backfill_script',
        });

        if (insertError) {
          // Partial unique index collisions on (jira_ticket_id, milestone_type)
          // where is_deleted=false are expected when a webhook or prior
          // backfill already recorded this milestone.
          const msg = insertError.message ?? String(insertError);
          if (msg.includes('duplicate') || insertError.code === '23505') {
            skippedDuplicate += 1;
          } else {
            console.error(`  ✗ ${issue.key}: ${msg}`);
            errored += 1;
          }
          continue;
        }

        inserted += 1;
      } catch (e: unknown) {
        errored += 1;
        console.error(`  ✗ ${issue.key}:`, e instanceof Error ? e.message : e);
      }

      if (processed % 50 === 0) {
        console.log(`  · processed ${processed}/${total}`);
      }
      await sleep(REQUEST_DELAY_MS);
    }

    startAt += page.issues.length;
    // Jira page returning fewer than expected with startAt < total usually
    // signals the tail of the result set; break to avoid an infinite loop.
    if (page.issues.length === 0) break;
  }

  console.log('');
  console.log(`Done. processed=${processed}, inserted=${inserted}, skipped_no_dcr=${skippedNoDcr}, skipped_duplicate=${skippedDuplicate}, errored=${errored}, unmatched_brands=${unmatchedBrands.size}`);

  if (unmatchedBrands.size > 0) {
    console.log('');
    console.log('Unmatched brand_jira_value strings (patch brands seed if these are real):');
    for (const [brand, count] of unmatchedBrands.entries()) {
      console.log(`  ${count.toString().padStart(4)}  ${brand}`);
    }
  }
}

run().catch(e => {
  console.error('fatal:', e);
  process.exit(1);
});
