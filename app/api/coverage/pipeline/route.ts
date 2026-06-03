// GET /api/coverage/pipeline — LIVE Jira pipeline counts per brand (Batch 010).
//
// WHY a server route: JIRA_API_TOKEN is a server-only Worker secret. The
// Coverage page is a client component and must never see it, so the live JQL
// work lives here. Data is LIVE at render — no jira_tickets cache (that is
// Batch 007). Read-only against Jira (§13 rule 5).
//
// AUTH: cookie-bound session, any authenticated user (coverage is visible to
// read-only users too). NOT Bearer, NOT admin-gated.

import { NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { searchJql } from '@/lib/jira/search';
import {
  ALL_STAGE_STATUSES,
  OVERLAY_FIELD_ID,
  emptyOverlayStageCounts,
  emptyStageCounts,
  overlayKeyForTag,
  stageForStatus,
  type PipelineBrand,
  type PipelineResponse,
  type PipelineTicket,
} from '@/lib/coverage/pipeline-stages';

// Reads cookies() for the session check → inherently dynamic; force it so
// Next never tries to evaluate/prerender this at build time.
export const dynamic = 'force-dynamic';

interface ProjectConfig {
  jira_project_key: string;
  brand_model: 'multi_brand' | 'single_brand';
  brand_jira_field_id: string | null;
  default_brand_id: string | null;
}

interface BrandRow {
  id: string;
  project_key: string;
  brand_code: string;
  jira_value: string;
}

// Mirror of the webhook's extractBrand (§13 rule 28). The brand field can be
// a string, a single-select { value }, a cascading select { value, child },
// or an array of those.
function extractBrand(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (Array.isArray(raw)) return raw.length ? extractBrand(raw[0]) : null;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.value === 'string') return obj.value.trim() || null;
    const child = obj.child as Record<string, unknown> | undefined;
    if (child && typeof child.value === 'string') return child.value.trim() || null;
    if (typeof obj.name === 'string') return obj.name.trim() || null;
  }
  return null;
}

// Approximate "age in stage" from statuscategorychangedate.
// NOTE: this is the v1 approximation — it measures time since the status
// CATEGORY last changed, not time in the specific status. True per-status age
// needs the issue changelog, which is out of scope for Batch 010.
function ageLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const ms = Date.now() - then;
  if (ms < 0) return '0d';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return '<1h';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (days < 60) return `${weeks}w`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

// Pull the CRO Labels option values off a ticket (multi-select → array of
// { value }).
function croLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const opt of raw) {
    if (opt && typeof opt === 'object' && typeof (opt as Record<string, unknown>).value === 'string') {
      out.push((opt as Record<string, string>).value);
    }
  }
  return out;
}

export async function GET() {
  // --- Auth: cookie-bound session, any authenticated user ---
  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jiraBaseUrl = process.env.JIRA_BASE_URL ?? '';

  // --- Load brand-resolution data once (service role; read-only) ---
  const [projectsRes, brandsRes, aliasesRes] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('jira_project_key, brand_model, brand_jira_field_id, default_brand_id')
      .eq('is_active', true),
    supabaseAdmin
      .from('brands')
      .select('id, project_key, brand_code, jira_value'),
    supabaseAdmin
      .from('brand_aliases')
      .select('jira_value, brand_id'),
  ]);

  if (projectsRes.error || brandsRes.error || aliasesRes.error) {
    const msg = projectsRes.error?.message || brandsRes.error?.message || aliasesRes.error?.message;
    console.error('[api/coverage/pipeline] config load failed', msg);
    return NextResponse.json({ error: 'Failed to load brand configuration' }, { status: 500 });
  }

  const projects = (projectsRes.data ?? []) as ProjectConfig[];
  const brands = (brandsRes.data ?? []) as BrandRow[];
  const aliases = (aliasesRes.data ?? []) as Array<{ jira_value: string; brand_id: string }>;

  const brandById = new Map<string, BrandRow>(brands.map((b) => [b.id, b]));
  const brandByJiraValue = new Map<string, BrandRow>(brands.map((b) => [b.jira_value, b]));
  const aliasToBrandId = new Map<string, string>(aliases.map((a) => [a.jira_value, a.brand_id]));

  // brand_code → accumulating per-brand pipeline bucket
  const byBrandCode = new Map<string, PipelineBrand>();
  function bucketFor(brandCode: string): PipelineBrand {
    let b = byBrandCode.get(brandCode);
    if (!b) {
      b = {
        brand_code: brandCode,
        counts: emptyStageCounts(),
        overlays: emptyOverlayStageCounts(),
        tickets: [],
      };
      byBrandCode.set(brandCode, b);
    }
    return b;
  }

  // Resolve a ticket's brand row following the §13 r13/r28 chain.
  function resolveBrand(project: ProjectConfig, fields: Record<string, unknown>): BrandRow | null {
    if (project.brand_model === 'single_brand') {
      return project.default_brand_id ? brandById.get(project.default_brand_id) ?? null : null;
    }
    // multi_brand: read configured field → brands → aliases → default → null
    const fieldId = project.brand_jira_field_id;
    const extracted = fieldId ? extractBrand(fields[fieldId]) : null;
    if (extracted) {
      const direct = brandByJiraValue.get(extracted);
      if (direct) return direct;
      const aliasBrandId = aliasToBrandId.get(extracted);
      if (aliasBrandId) return brandById.get(aliasBrandId) ?? null;
    }
    return project.default_brand_id ? brandById.get(project.default_brand_id) ?? null : null;
  }

  const statusList = ALL_STAGE_STATUSES.map((s) => `"${s}"`).join(', ');
  const errors: string[] = [];
  let unresolvedCount = 0;

  // One JQL fetch per active project (NOT one per brand).
  for (const project of projects) {
    const fields = ['summary', 'status', 'statuscategorychangedate', OVERLAY_FIELD_ID];
    if (project.brand_model === 'multi_brand' && project.brand_jira_field_id) {
      fields.push(project.brand_jira_field_id);
    }
    const jql = `project = "${project.jira_project_key}" AND status in (${statusList})`;

    let issues;
    try {
      issues = await searchJql(jql, fields);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[api/coverage/pipeline] JQL failed for ${project.jira_project_key}`, message);
      errors.push(`${project.jira_project_key}: ${message}`);
      continue;
    }

    for (const issue of issues) {
      const f = issue.fields;
      const statusName = (f.status as { name?: string } | undefined)?.name;
      const stage = stageForStatus(statusName);
      if (!stage) continue; // defensive: JQL already filtered to counted statuses

      const brand = resolveBrand(project, f);
      if (!brand) {
        unresolvedCount += 1;
        continue;
      }

      const tags = croLabels(f[OVERLAY_FIELD_ID]);
      const ticket: PipelineTicket = {
        key: issue.key,
        url: `${jiraBaseUrl}/browse/${issue.key}`,
        summary: (f.summary as string) ?? '',
        stage,
        tags,
        age_label: ageLabel(f.statuscategorychangedate as string | null),
      };

      const bucket = bucketFor(brand.brand_code);
      bucket.counts[stage] += 1;
      bucket.tickets.push(ticket);
      for (const tag of tags) {
        const overlayKey = overlayKeyForTag(tag);
        if (overlayKey) bucket.overlays[overlayKey][stage] += 1;
      }
    }
  }

  // Total failure (no project succeeded) → surface as an error status so the
  // page's failures[] picks it up rather than rendering a silent empty table.
  if (errors.length > 0 && byBrandCode.size === 0) {
    return NextResponse.json(
      { error: `Pipeline fetch failed: ${errors.join(' · ')}` },
      { status: 502 },
    );
  }

  const body: PipelineResponse = {
    brands: Array.from(byBrandCode.values()),
    unresolved_count: unresolvedCount,
    errors,
  };
  return NextResponse.json(body);
}
