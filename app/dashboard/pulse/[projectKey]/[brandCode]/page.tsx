'use client';

// Batch 012 — Phase E1 (Pulse shell). Deep-linkable per-brand page. URL mirrors
// /api/brands/[projectKey]/[brandCode] so brand pages are project-safe
// (brand_code isn't unique across projects). All read-only in E1:
//   - header: brand name / code / project / paused badge
//   - directives: this brand's status + note per active directive, filtered
//     from the same directive dataset the matrix uses (one source; RLS already
//     allows authenticated SELECT, so no new read endpoint)
//   - Convert config: a framed placeholder — E2 fills it.
//
// Directive editing stays on the matrix (the existing PATCH route); nothing
// here writes. E3 swaps the read-only directive rows for expandable
// comment/timeline rows — kept as a clean seam.

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import {
  brandDirectiveView,
  type BrandCell,
  type BrandDirectiveRow,
} from '@/lib/client-library/pulse';
import { broadcastPulseProject } from '@/lib/client-library/pulse-project-channel';
import type { CellStatus, DirectiveType } from '@/lib/client-library/directives';

interface BrandRow {
  id: string;
  brand_code: string;
  display_name: string;
  is_active: boolean;
  is_paused: boolean;
  project_key: string;
}

interface DirectiveRow {
  id: string;
  title: string;
  directive_type: DirectiveType;
  description: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<DirectiveType, string> = {
  goal: 'Goal',
  trigger: 'Trigger',
  site_area: 'Site area',
  audience: 'Audience',
};

const STATUS_LABEL: Record<CellStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
  n_a: 'N/A',
};

// Cell status → token color (§13 r25 — tokens, no inline hex). Matches the
// matrix's dot palette. n_a renders hollow (not owed).
const STATUS_DOT: Record<CellStatus, string> = {
  todo: 'var(--f92-lgray)',
  in_progress: 'var(--status-in-progress)',
  done: 'var(--status-resolved)',
  blocked: 'var(--status-blocked)',
  n_a: 'transparent',
};

export default function PulseBrandPage({
  params,
}: {
  params: Promise<{ projectKey: string; brandCode: string }>;
}) {
  const { projectKey, brandCode } = use(params);

  const [brand, setBrand] = useState<BrandRow | null>(null);
  const [projectLabel, setProjectLabel] = useState<string>(projectKey);
  const [directives, setDirectives] = useState<DirectiveRow[]>([]);
  const [cells, setCells] = useState<BrandCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Which (projectKey/brandCode) the loaded brand/directives/cells belong to.
  // On brand→brand navigation the component instance is reused (same route
  // segment), so without this the prior brand's content would flash until the
  // new fetch resolves. Rendering gates on `loadedFor === currentKey`, which is
  // a render-time comparison — no synchronous setState-in-effect. Set in every
  // terminal branch of load() (all after an await, so the lint rule stays quiet).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const currentKey = `${projectKey}/${brandCode}`;
  const ready = !loading && loadedFor === currentKey;

  // Return-context ride-along (Karen E1 observation B): broadcast this brand's
  // project onto the shared channel so "← Pulse" opens the matrix on the
  // deep-linked brand's client, and the cross-project client nav highlights
  // consistently. Side effect only (sessionStorage + event) — no setState, so
  // the set-state-in-effect rule doesn't apply.
  useEffect(() => {
    broadcastPulseProject(projectKey);
  }, [projectKey]);

  // Fetch is an inline async function inside the effect (mirrors the matrix
  // page) with a `cancelled` guard — all setState runs after an await, so the
  // set-state-in-effect rule stays quiet. `loading` starts true (useState), so
  // there's no synchronous loading flip in the body.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const key = `${projectKey}/${brandCode}`;
      // Brand + project resolve first — the brand id gates the cell filter.
      const [brandRes, projectRes] = await Promise.all([
        supabase
          .from('brands')
          .select('id, brand_code, display_name, is_active, is_paused, project_key')
          .eq('project_key', projectKey)
          .eq('brand_code', brandCode)
          .maybeSingle(),
        supabase
          .from('projects')
          .select('display_name')
          .eq('jira_project_key', projectKey)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      if (projectRes.data?.display_name) setProjectLabel(projectRes.data.display_name);
      // Reset stale flags now that data is back (covers brand→brand nav where
      // the component instance is reused).
      setLoadError(null);
      setNotFound(false);

      if (brandRes.error) {
        setBrand(null);
        setLoadError(brandRes.error.message);
        setLoadedFor(key);
        setLoading(false);
        return;
      }
      const brandRow = brandRes.data as BrandRow | null;
      if (!brandRow) {
        setBrand(null);
        setNotFound(true);
        setLoadedFor(key);
        setLoading(false);
        return;
      }
      setBrand(brandRow);

      // Same per-project directive dataset the matrix loads; cells scoped to
      // this brand client-side (one source, not a per-brand copy).
      const { data: directiveData, error: directiveErr } = await supabase
        .from('directives')
        .select('id, title, directive_type, description, created_at')
        .eq('project_key', projectKey)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (cancelled) return;

      if (directiveErr) {
        setLoadError(directiveErr.message);
        setLoadedFor(key);
        setLoading(false);
        return;
      }
      const directiveRows = (directiveData ?? []) as DirectiveRow[];
      setDirectives(directiveRows);

      let cellRows: BrandCell[] = [];
      if (directiveRows.length > 0) {
        const { data: cellData, error: cellErr } = await supabase
          .from('directive_brand_status')
          .select('directive_id, brand_id, status, note')
          .in('directive_id', directiveRows.map((d) => d.id))
          .eq('brand_id', brandRow.id);
        if (cancelled) return;
        if (cellErr) {
          setLoadError(cellErr.message);
          setLoading(false);
          return;
        }
        cellRows = (cellData ?? []) as BrandCell[];
      }
      setCells(cellRows);
      setLoadedFor(key);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectKey, brandCode]);

  const rows: BrandDirectiveRow<DirectiveRow>[] = useMemo(
    () => (brand ? brandDirectiveView(directives, cells, brand.id) : []),
    [brand, directives, cells],
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <Link
          href="/dashboard/pulse"
          className="text-xs text-[color:var(--f92-gray)] transition hover:text-[color:var(--f92-orange)]"
        >
          ← Pulse
        </Link>
      </div>

      {!ready ? (
        // Not-ready covers first load AND the stale window during brand→brand
        // navigation (component instance reused) — the prior brand's content no
        // longer flashes; a crisp Loading shows until this brand's fetch lands.
        <Card className="p-8 text-center text-sm text-[color:var(--f92-gray)]">Loading…</Card>
      ) : notFound ? (
        <Card className="p-8 text-center text-sm text-[color:var(--f92-gray)]">
          No brand <span className="font-mono">{brandCode}</span> in {projectLabel}.{' '}
          <Link href="/dashboard/pulse" className="text-[color:var(--f92-orange)] hover:underline">
            Back to Pulse
          </Link>
        </Card>
      ) : loadError ? (
        <Card className="border-[color:var(--status-blocked)] p-4 text-sm text-[color:var(--status-blocked)]">
          Failed to load this brand: {loadError}
        </Card>
      ) : brand ? (
        <>
          {/* Header */}
          <div className="mb-6">
            <p
              className="text-[10px] uppercase text-[color:var(--f92-gray)]"
              style={{ letterSpacing: 'var(--tracking-eyebrow, 0.12em)' }}
            >
              Pulse · {projectLabel}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-[color:var(--f92-dark)]">
                {brand.display_name}
              </h1>
              <span
                className="inline-flex items-center px-2 py-0.5 font-mono text-xs font-semibold text-[color:var(--f92-navy)]"
                style={{ background: 'var(--pill-filter-bg)', borderRadius: 'var(--radius-full)' }}
              >
                {brand.brand_code}
              </span>
              {brand.is_paused ? (
                <span
                  className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase"
                  style={{
                    letterSpacing: 'var(--tracking-wide, 0.08em)',
                    background: 'var(--pill-amber-bg)',
                    border: '1px solid var(--pill-amber-border)',
                    color: 'var(--pill-amber-fg)',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  Paused
                </span>
              ) : null}
            </div>
          </div>

          {/* Directives for this brand */}
          <section className="mb-8">
            <h2 className="mb-1 text-lg font-semibold text-[color:var(--f92-dark)]">Directives</h2>
            <p className="mb-3 text-sm text-[color:var(--f92-gray)]">
              This brand&rsquo;s status on each active directive. Edit statuses on the{' '}
              <Link href="/dashboard/pulse" className="text-[color:var(--f92-orange)] hover:underline">
                directive matrix
              </Link>
              .
            </p>
            {rows.length === 0 ? (
              <Card className="p-6 text-center text-sm text-[color:var(--f92-gray)]">
                No directives yet for this brand.
              </Card>
            ) : (
              <div className="space-y-2">
                {rows.map(({ directive, cell }) => {
                  const status = cell?.status ?? 'n_a';
                  return (
                    <Card
                      key={directive.id}
                      className="flex items-start gap-3 p-3"
                      style={{ boxShadow: 'var(--shadow-sm)' }}
                    >
                      <span
                        className="mt-1.5 block h-3 w-3 shrink-0 rounded-full"
                        style={
                          status === 'n_a'
                            ? { border: '1.5px dashed var(--f92-lgray)' }
                            : { background: STATUS_DOT[status] }
                        }
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--f92-navy)]"
                            style={{
                              letterSpacing: 'var(--tracking-wide, 0.08em)',
                              background: 'var(--pill-filter-bg)',
                              borderRadius: 'var(--radius-full)',
                            }}
                          >
                            {TYPE_LABEL[directive.directive_type]}
                          </span>
                          <span className="font-medium text-[color:var(--f92-dark)]">
                            {directive.title}
                          </span>
                        </div>
                        {directive.description ? (
                          <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
                            {directive.description}
                          </p>
                        ) : null}
                        {cell?.note ? (
                          <p className="mt-1 text-xs text-[color:var(--f92-dark)]">
                            <span className="text-[color:var(--f92-gray)]">Note: </span>
                            {cell.note}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-[color:var(--f92-gray)]">
                        {STATUS_LABEL[status]}
                      </span>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Convert config placeholder — E2 fills this. Present but empty so
              the page shape is real now (clean seam for E2). */}
          <section>
            <h2 className="mb-1 text-lg font-semibold text-[color:var(--f92-dark)]">
              Convert configuration
            </h2>
            <Card
              className="flex min-h-[8rem] flex-col items-center justify-center gap-1 border-dashed p-8 text-center"
              style={{ boxShadow: 'none' }}
            >
              <p className="text-sm font-medium text-[color:var(--f92-gray)]">
                Convert configuration will sync here
              </p>
              <p className="text-xs text-[color:var(--f92-lgray)]">Coming in a later Pulse phase.</p>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
