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
// Admins edit a directive's status/note for THIS brand inline (same PATCH
// route the matrix uses, via the shared saveDirectiveCell + CellEditStrip).
// Non-admins see the read-only view UNCHANGED — the route enforces admin
// server-side regardless of what renders. A cell must EXIST to be editable
// (Phase A design: hollow n_a "no cell" rows stay non-interactive). E3 swaps
// the read-only directive rows for expandable comment/timeline rows — the
// CellEditStrip container is the same seam E3 enriches.

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/layout/toaster';
import { CellEditStrip } from '@/components/client-library/cell-edit-strip';
import {
  brandDirectiveView,
  type BrandCell,
  type BrandDirectiveRow,
} from '@/lib/client-library/pulse';
import { broadcastPulseProject } from '@/lib/client-library/pulse-project-channel';
import { saveDirectiveCell } from '@/lib/client-library/directive-cell-save';
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
  const { toast } = useToast();

  const [brand, setBrand] = useState<BrandRow | null>(null);
  const [projectLabel, setProjectLabel] = useState<string>(projectKey);
  const [directives, setDirectives] = useState<DirectiveRow[]>([]);
  const [cells, setCells] = useState<BrandCell[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  // Which directive's cell is being edited inline (admin). One open at a time,
  // keyed by directive id — the brand is fixed (this page), so a directive id
  // uniquely identifies the cell.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Which (projectKey/brandCode) the loaded brand/directives/cells belong to.
  // On brand→brand navigation the component instance is reused (same route
  // segment), so without this the prior brand's content would flash until the
  // new fetch resolves. Rendering gates on `loadedFor === currentKey`, which is
  // a render-time comparison — no synchronous setState-in-effect.
  //
  // INVARIANT: every terminal branch of load() must call setLoadedFor(key) —
  // all four error/empty exits as well as the success tail (all after an await,
  // so the lint rule stays quiet). This is load-bearing, not bookkeeping: a
  // branch that returns without it leaves `ready` false forever, so the page
  // sits on "Loading…" and even the loadError card never renders. The cell-error
  // branch was missing it until 2026-07-25 (Karen MEDIUM-2) and did exactly that.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const currentKey = `${projectKey}/${brandCode}`;
  const ready = !loading && loadedFor === currentKey;

  // Mirror of currentKey that async callbacks can read at RESOLUTION time.
  // refetchCells (below) needs it because its closure captured the old brand and
  // therefore cannot tell on its own that it resolved after a nav. Written in the
  // load effect (refs must not be touched during render — react-hooks/refs).
  //
  // The effect-vs-render write leaves a tiny window — new brand committed, effect
  // not yet run — where this still holds the OLD key, so a stale reconcile would
  // pass the guard. That window is harmless: `ready` gates on
  // loadedFor === currentKey, so nothing renders but "Loading…" throughout it,
  // and the new brand's load() calls setCells again with the correct rows right
  // after. The damaging case Karen described needs the stale write to land AFTER
  // the new brand finished loading, and by then this ref is definitively the new
  // key — it is set before that load's first await could possibly resolve.
  const liveKeyRef = useRef(currentKey);

  // Return-context ride-along (Karen E1 observation B): broadcast this brand's
  // project onto the shared channel so "← Pulse" opens the matrix on the
  // deep-linked brand's client, and the cross-project client nav highlights
  // consistently. Side effect only (sessionStorage + event) — no setState, so
  // the set-state-in-effect rule doesn't apply.
  useEffect(() => {
    broadcastPulseProject(projectKey);
  }, [projectKey]);

  // Admin gate for the inline-edit affordance. Read-only users never see the
  // editor; the PATCH route enforces admin server-side regardless. Fetched once
  // on mount (independent of brand→brand nav). setState runs after an await, so
  // the set-state-in-effect rule stays quiet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (!cancelled) setIsAdmin(profile?.role === 'admin');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch is an inline async function inside the effect (mirrors the matrix
  // page) with a `cancelled` guard — all setState runs after an await, so the
  // set-state-in-effect rule stays quiet. `loading` starts true (useState), so
  // there's no synchronous loading flip in the body.
  useEffect(() => {
    let cancelled = false;
    // Publish the live key for refetchCells' staleness guard (Karen MEDIUM-1),
    // synchronously on every brand change — before load()'s first await, so a
    // reconcile issued for the previous brand can never see this as current.
    liveKeyRef.current = `${projectKey}/${brandCode}`;
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
      // the component instance is reused). editingId is reset too so an open
      // editor on the previous brand doesn't re-open on the new one (mirrors
      // the matrix's expandedCell reset on project change).
      setLoadError(null);
      setNotFound(false);
      setEditingId(null);

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
          // setLoadedFor is required here too (Karen MEDIUM-2): `ready` gates on
          // loadedFor === currentKey, so omitting it left the page on a
          // permanent "Loading…" with the loadError card unreachable.
          setLoadedFor(key);
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

  // Reconcile helper for the shared save handler's error path — re-fetch just
  // this brand's cells (cheaper than the full load()).
  //
  // Staleness-guarded (Karen MEDIUM-1). This runs from a save callback, NOT from
  // the load effect, so the effect's `cancelled` flag does not cover it: a save
  // that fails on brand A and reconciles after the user has navigated to brand B
  // would land setCells(A's cells) on top of B. brandDirectiveView filters on
  // c.brand_id === brand.id, so nothing would match and EVERY directive on B
  // would render hollow n_a and non-interactive — indistinguishable from "no
  // cells exist", recoverable only by reload. Same shape as the load effect's
  // guard, just anchored on a ref because the closure captures the old brand:
  // compare the key this invocation was issued for against the live key at
  // resolution time, and drop the result if the page has moved on.
  const refetchCells = useCallback(async () => {
    if (!brand || directives.length === 0) return;
    const issuedFor = `${brand.project_key}/${brand.brand_code}`;
    const { data, error } = await supabase
      .from('directive_brand_status')
      .select('directive_id, brand_id, status, note')
      .in('directive_id', directives.map((d) => d.id))
      .eq('brand_id', brand.id);
    if (issuedFor !== liveKeyRef.current) return;
    if (!error) setCells((data ?? []) as BrandCell[]);
  }, [brand, directives]);

  // Inline cell save (admin), via the shared saveDirectiveCell — same
  // optimistic + reconcile + toast core the matrix uses. The brand is fixed
  // (this page), so the (directive_id, brand_id) pair on the BrandCell is the
  // save target. `nextNote` arrives already normalized (trim || null).
  const handleSave = useCallback(
    (cell: BrandCell, nextStatus: CellStatus, nextNote: string | null) =>
      saveDirectiveCell(cell, nextStatus, nextNote, {
        applyOptimistic: (target, status, note) => {
          setCells((prev) =>
            prev.map((c) =>
              c.directive_id === target.directive_id && c.brand_id === target.brand_id
                ? { ...c, status, note }
                : c,
            ),
          );
          setEditingId(null);
        },
        reconcile: () => void refetchCells(),
        toast,
      }),
    [refetchCells, toast],
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
              This brand&rsquo;s status on each active directive.{' '}
              {isAdmin ? (
                <>Click a status to edit it for this brand.</>
              ) : (
                <>
                  Edit statuses on the{' '}
                  <Link href="/dashboard/pulse" className="text-[color:var(--f92-orange)] hover:underline">
                    directive matrix
                  </Link>
                  .
                </>
              )}
            </p>
            {rows.length === 0 ? (
              <Card className="p-6 text-center text-sm text-[color:var(--f92-gray)]">
                No directives yet for this brand.
              </Card>
            ) : (
              <div className="space-y-2">
                {rows.map(({ directive, cell }) => {
                  const status = cell?.status ?? 'n_a';
                  // A cell must EXIST to be editable (Phase A design): a
                  // directive with no directive_brand_status row for this brand
                  // renders hollow n_a and stays non-interactive.
                  const editable = isAdmin && !!cell;
                  const isEditing = editable && editingId === directive.id;
                  return (
                    <Card
                      key={directive.id}
                      className="p-3"
                      style={{ boxShadow: 'var(--shadow-sm)' }}
                    >
                      <div className="flex items-start gap-3">
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
                        {editable ? (
                          <button
                            type="button"
                            aria-expanded={isEditing}
                            onClick={() =>
                              setEditingId((cur) => (cur === directive.id ? null : directive.id))
                            }
                            aria-label={`${directive.title}: ${STATUS_LABEL[status]}${isEditing ? ' (editing — activate to close)' : ' (edit)'}`}
                            className={
                              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-[color:var(--f92-gray)] transition ' +
                              'cursor-pointer hover:text-[color:var(--f92-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)] ' +
                              (isEditing ? 'ring-2 ring-[color:var(--f92-orange)]' : '')
                            }
                          >
                            {STATUS_LABEL[status]}
                          </button>
                        ) : (
                          <span className="shrink-0 text-xs font-medium text-[color:var(--f92-gray)]">
                            {STATUS_LABEL[status]}
                          </span>
                        )}
                      </div>

                      {/* Inline editor (admin). The CellEditStrip container is
                          the E3 seam — E3 enriches it with comments / timeline /
                          lifecycle dates. Keyed by directive id → fresh mount
                          seeds from this cell. */}
                      {isEditing && cell && brand ? (
                        <div className="mt-2">
                          <CellEditStrip
                            key={directive.id}
                            brandLabel={brand.display_name}
                            directiveTitle={directive.title}
                            initialStatus={cell.status}
                            initialNote={cell.note}
                            onSave={(s, n) => handleSave(cell, s, n)}
                            onCancel={() => setEditingId(null)}
                          />
                        </div>
                      ) : null}
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
