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
 *   1. Page through every issue in NBLYCRO via POST /rest/api/3/search/jql
 *      with expand=changelog, 100 per page, cursor-paginated by nextPageToken.
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
const PAGE_SIZE = 50;
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
  issues: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
}

async function jiraSearch(nextPageToken: string | null): Promise<JiraSearchResponse> {
  const body: Record<string, unknown> = {
    jql: JQL,
    maxResults: PAGE_SIZE,
    expand: 'changelog',
    fields: ['summary', NBLY_BRAND_FIELD],
  };
  if (nextPageToken) body.nextPageToken = nextPageToken;

  let attempt = 0;
  while (true) {
    const res = await fetch(
      `${jiraBaseUrl}/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${jiraAuth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    if (res.ok) return res.json() as Promise<JiraSearchResponse>;
    if (res.status === 429 && attempt < 3) {
      const backoffMs = 1000 * Math.pow(2, attempt);
      console.warn(`  ! 429 from Jira, backing off ${backoffMs}ms`);
      await sleep(backoffMs);
      attempt += 1;
      continue;
    }
    if (res.status === 400) {
      const text = await res.text().catch(() => '');
      console.error('[jira-search] 400 from Jira');
      console.error('  request body:', JSON.stringify(body, null, 2));
      console.error('  response:', text.slice(0, 400));
      throw new Error(`Jira search failed: 400 Bad Request`);
    }
    const text = await res.text().catch(() => '');
    throw new Error(`Jira search failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
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

  let nextPageToken: string | null = null;
  let pageNum = 0;
  let processed = 0;
  let inserted = 0;
  let skippedNoDcr = 0;
  let skippedDuplicate = 0;
  let errored = 0;
  const unmatchedBrands = new Map<string, number>();

  // The new /search/jql endpoint doesn't return a total count, so we use
  // cursor pagination: keep calling with nextPageToken until Jira flags
  // isLast or stops returning a token.
  do {
    pageNum += 1;
    const page = await jiraSearch(nextPageToken);
    console.log(`→ page ${pageNum} — ${page.issues.length} issues`);

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
        console.log(`  · processed ${processed}`);
      }
      await sleep(REQUEST_DELAY_MS);
    }

    nextPageToken = page.nextPageToken ?? null;
    if (page.isLast) break;
  } while (nextPageToken);

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
