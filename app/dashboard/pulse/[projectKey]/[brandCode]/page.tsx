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
// route the matrix uses, via the shared saveDirectiveCell + CellEditStrip) by
// clicking the row's leading STATUS DOT — the only interactive element in the
// row, and the same element that is the target on the matrix. The right-hand
// status label is inert.
// A client-side status filter scopes the list (default `Open` = not Done and
// not N/A); see lib/client-library/pulse.ts for why that is a different
// function from the matrix's derived-resolve filter and must not be unified
// with it.
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
  countBrandRowsByType,
  effectiveCellStatus,
  filterBrandRows,
  BRAND_STATUS_FILTERS,
  BRAND_STATUS_FILTER_LABEL,
  BRAND_TYPE_FILTERS,
  BRAND_TYPE_FILTER_LABEL,
  type BrandCell,
  type BrandDirectiveRow,
  type BrandStatusFilter,
  type BrandTypeFilter,
} from '@/lib/client-library/pulse';
import { StatusCellBox, StatusLegend } from '@/components/client-library/status-cell';
import { TabGroup } from '@/components/client-library/tab-group';
import { broadcastPulseProject } from '@/lib/client-library/pulse-project-channel';
import { fetchAllPaged } from '@/lib/client-library/paged-fetch';
import { saveDirectiveCell } from '@/lib/client-library/directive-cell-save';
import { buildCellReadout } from '@/lib/client-library/cell-note';
import {
  CELL_STATUS_LABEL,
  type CellStatus,
  type DirectiveType,
} from '@/lib/client-library/directives';

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

// NOTE: the local STATUS_DOT_CLASS map is gone — the cell visual moved to the
// shared components/client-library/status-cell.tsx, so this page, the matrix, and
// the new legend cannot describe a status three different ways. That component
// also stopped borrowing the quality-log --status-* palette for cells: they use
// the dedicated --cell-* tokens now (globals.css).

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
  // Status filter over the already-loaded cells (no refetch). `open` is the
  // DEFAULT, so the first paint hides Done/N-A rows — which is exactly why the
  // count + hidden-count readout below is load-bearing rather than decoration.
  //
  // Session-only React state, and deliberately NOT reset on brand→brand nav:
  // this mirrors the matrix, whose search/status/sort survive a project switch,
  // and it makes "walk the brands looking at everything Blocked" work.
  const [statusFilter, setStatusFilter] = useState<BrandStatusFilter>('open');
  // Type group — NEW this batch, mirroring the matrix's third group. Reads the
  // real directive_type column; all four options always render.
  const [typeFilter, setTypeFilter] = useState<BrandTypeFilter>('all');
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
  // pass the guard and setCells(previous brand). Two independent things make that
  // unobservable, and BOTH are load-bearing:
  //   1. Window interior: `ready` gates on loadedFor === currentKey, and `!ready`
  //      is the FIRST render branch, so only "Loading…" paints throughout.
  //   2. Window exit — this depends on the render branch ORDER
  //      (!ready → notFound → loadError → rows). The new brand's load() either
  //      hits its success tail, which calls setCells + setLoadedFor in one
  //      synchronous continuation (auto-batched, so nothing paints with
  //      ready === true beside stale cells), or takes an error exit, which sets
  //      loadedFor without touching cells and short-circuits into
  //      notFound/loadError, never reaching the rows render.
  // So DO NOT hoist the rows render above notFound/loadError: that would expose
  // stale cells on the error paths, and no test covers it (Karen, re-confirm pass).
  // The damaging case Karen originally described needs the stale write to land
  // AFTER the new brand finished loading, and by then this ref is definitively the
  // new key — it is set before that load's first await could possibly resolve.
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
        // PAGED defensively. This read is scoped to ONE brand, so it returns at
        // most one row per directive (76 today) and is under PostgREST's
        // 1,000-row cap — but only by accident of the directive count, and it
        // scales with directives exactly as the matrix does. The matrix read
        // crossed the cap on 2026-07-31 and silently truncated; this one is
        // paged now so it can never repeat that at ~1,000 directives.
        const ids = directiveRows.map((d) => d.id);
        const { data: cellData, error: cellErr } = await fetchAllPaged<BrandCell>(
          'cells',
          (from, to) =>
            supabase
              .from('directive_brand_status')
              .select('directive_id, brand_id, status, note')
              .in('directive_id', ids)
              .eq('brand_id', brandRow.id)
              .range(from, to),
        );
        if (cancelled) return;
        if (cellErr) {
          setLoadError(cellErr);
          // setLoadedFor is required here too (Karen MEDIUM-2): `ready` gates on
          // loadedFor === currentKey, so omitting it left the page on a
          // permanent "Loading…" with the loadError card unreachable.
          setLoadedFor(key);
          setLoading(false);
          return;
        }
        cellRows = cellData;
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

  // What the list actually renders. Kept separate from `rows` so every count
  // below derives from live data — never a literal (prod went 76 → 82 active
  // directives inside a week).
  const brandControls = useMemo(
    () => ({ status: statusFilter, type: typeFilter }),
    [statusFilter, typeFilter],
  );
  const visibleRows = useMemo(
    () => filterBrandRows(rows, brandControls),
    [rows, brandControls],
  );

  // Rows the filter is holding back. Deliberately a subtraction and NOT a lib
  // helper: unlike the matrix — where countHiddenByStatus is load-bearing
  // because SEARCH filters first, so hidden ≠ total − shown — this page has no
  // search axis, so the two are provably equal and a helper would only be a
  // second way to compute one number.
  const hiddenByFilter = rows.length - visibleRows.length;

  // Changing the filter can remove the row whose editor is open; don't leave a
  // strip mounted for a row that just left the DOM.
  const handleStatusFilterChange = useCallback((next: BrandStatusFilter) => {
    setStatusFilter(next);
    setEditingId(null);
  }, []);

  const handleTypeFilterChange = useCallback((next: BrandTypeFilter) => {
    setTypeFilter(next);
    setEditingId(null); // same reason as the status group — the row may leave the DOM
  }, []);

  // Clears BOTH groups — what the hidden-count reset offers.
  const clearBrandFilters = useCallback(() => {
    setStatusFilter('all');
    setTypeFilter('all');
    setEditingId(null);
  }, []);

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
    // Paged for the same reason as the load path above — and so the page's two
    // reads of this table cannot behave differently. An unpaged reconcile would
    // silently re-truncate whatever the load path correctly fetched.
    const ids = directives.map((d) => d.id);
    const { data, error } = await fetchAllPaged<BrandCell>('cells', (from, to) =>
      supabase
        .from('directive_brand_status')
        .select('directive_id, brand_id, status, note')
        .in('directive_id', ids)
        .eq('brand_id', brand.id)
        .range(from, to),
    );
    if (issuedFor !== liveKeyRef.current) return;
    if (!error) setCells(data);
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
                <>Click a status dot to edit it for this brand.</>
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
            {/* Filter groups + count. TWO groups here, not three: one brand
                means one cell per directive, so there is no derived-state axis —
                `Status` IS the cell's own status (see lib/client-library/pulse.ts
                for why that is a DIFFERENT function from the matrix's resolve
                classifier and must not be merged with it).
                Same TabGroup component the matrix uses. Client-side over the
                already-loaded cells — nothing here refetches. Suppressed when the
                brand has no directives at all (nothing to filter). */}
            {rows.length > 0 ? (
              <div className="mb-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <TabGroup
                    legend="Status"
                    options={BRAND_STATUS_FILTERS}
                    labels={BRAND_STATUS_FILTER_LABEL}
                    value={statusFilter}
                    onChange={handleStatusFilterChange}
                  />
                  {/* Type — NEW this batch. Reads the real directive_type column;
                      all four always render. (Karen LOW-4: "prod holds only goal +
                      trigger" was wrong — verified 2026-08-02, NBLYCRO is goal 75 /
                      trigger 7 but SPLCRO has 1 site_area. Which only strengthens
                      rendering all four.) */}
                  <TabGroup
                    legend="Type"
                    options={BRAND_TYPE_FILTERS}
                    labels={BRAND_TYPE_FILTER_LABEL}
                    value={typeFilter}
                    onChange={handleTypeFilterChange}
                  />

                  {/* ONE polite live region holding the count AND the hidden-row
                      correction, per the matrix's LOW-7 lesson: announcing a bare
                      count lets "0 directives" affirm a false "there's nothing
                      here" reading. Both shapes (rows listed / zero rows) are
                      announced from this same region, and it holds the only reset
                      — the empty state points at it rather than duplicating it.
                      Unlike the matrix, the correction is NOT gated behind a
                      search: there is no search box here, and the DEFAULT filter
                      hides rows the user never asked to hide, so on first paint
                      they must be able to see that Done/N-A rows exist.
                      aria-atomic so the count and correction are announced as ONE
                      sentence (Karen LOW-2). Known limit, recorded rather than
                      papered over: the region mounts WITH its content, and content
                      present at region creation is generally not announced, so the
                      FIRST paint is silent to a screen reader; later changes
                      announce correctly and the text is visible in reading order.
                      A real fix means hoisting above the `!ready` gate, which
                      collides with the DO-NOT-hoist render-branch order at the top
                      of this file. */}
                  <div
                    className="ml-auto flex flex-wrap items-center justify-end gap-x-2 text-xs font-medium text-[color:var(--f92-gray)]"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <span className="tabular-nums">
                      {visibleRows.length === rows.length
                        ? `${rows.length} directive${rows.length === 1 ? '' : 's'}`
                        : `${visibleRows.length} of ${rows.length} directives`}
                    </span>
                    {hiddenByFilter > 0 ? (
                      <span className="font-normal">
                        ·{' '}
                        {hiddenByFilter === 1
                          ? '1 directive hidden by the current filters.'
                          : `${hiddenByFilter} directives hidden by the current filters.`}{' '}
                        {/* Clears BOTH groups and says so — with two groups a
                            hidden row is ambiguous, so no per-group attribution
                            is attempted. */}
                        <button
                          type="button"
                          onClick={clearBrandFilters}
                          className="font-medium text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                        >
                          Clear all filters
                        </button>
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Legend — NEW this batch, from the same component the rows draw
                    their status box with, so it cannot drift from them. */}
                <div className="mt-2.5 border-t border-[color:var(--f92-border)] pt-2.5">
                  <StatusLegend />
                </div>
              </div>
            ) : null}

            {rows.length === 0 ? (
              <Card className="p-6 text-center text-sm text-[color:var(--f92-gray)]">
                No directives yet for this brand.
              </Card>
            ) : visibleRows.length === 0 ? (
              /* The filters emptied the view. Distinct from "this brand has no
                 directives" above — keep both reachable, or a filtered-out view
                 reads as a data-loading bug on a brand with dozens of rows.
                 An unused TYPE gets its own copy: "no site area directives yet" is
                 a fact about the data, while the generic no-match copy reads as a
                 bug on a type nobody has started using.
                 Otherwise the reset lives in the live region just above (LOW-7),
                 and pointing at it is safe by arithmetic rather than luck:
                 hiddenByFilter is rows.length - 0 here and this branch requires
                 rows.length > 0, so the button is ALWAYS rendered when this shows. */
              <Card className="p-6 text-center text-sm text-[color:var(--f92-gray)]">
                {typeFilter !== 'all' && countBrandRowsByType(rows, typeFilter) === 0 ? (
                  <>
                    No {BRAND_TYPE_FILTER_LABEL[typeFilter].toLowerCase()} directives yet for this
                    brand.{' '}
                    <button
                      type="button"
                      onClick={() => handleTypeFilterChange('all')}
                      className="font-medium text-[color:var(--f92-orange)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
                    >
                      Show all types
                    </button>
                  </>
                ) : (
                  <>
                    No directives match the current filters for this brand. Use{' '}
                    <span className="italic">Clear all filters</span> above to see every directive.
                  </>
                )}
              </Card>
            ) : (
              <div className="space-y-2">
                {visibleRows.map(({ directive, cell }) => {
                  const status = effectiveCellStatus(cell);
                  // The shared readout model (§2.1). Used here only for its
                  // `note` field — this page needs no hover readout — but built
                  // through the same function the matrix calls so the whitespace
                  // rule is one definition rather than two agreeing habits.
                  // `status` is the effective status already resolved above, so
                  // a cell-less directive still yields a model.
                  const readout = buildCellReadout({
                    brandLabel: brand.display_name,
                    directiveTitle: directive.title,
                    status,
                    note: cell?.note,
                  });
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
                        {/* THE STATUS DOT IS THE EDIT TARGET — matching the
                            matrix, where the cell dot is the control and the
                            directive title is not. Shorter travel from where the
                            eye already scans, and one mental model across both
                            surfaces.
                            The right-hand pill is INERT (see below): the target
                            and its affordance moved together, deliberately as one
                            change. A chip that reads clickable but isn't is worse
                            than a flat label.
                            Non-admins (and any row whose cell doesn't exist yet)
                            get the same inert dot — a plain <span>, never a
                            disabled button, so no interactive control leaks. */}
                        {editable ? (
                          <button
                            type="button"
                            aria-expanded={isEditing}
                            onClick={() =>
                              setEditingId((cur) => (cur === directive.id ? null : directive.id))
                            }
                            // Leads with the ACTION and names the directive:
                            // "To do" repeated down 82 rows tells a screen-reader
                            // user nothing about which row they are on. The pill
                            // is not a control and carries no accessible name, so
                            // there is exactly one control + one tab stop per row.
                            // NOT the same as "the status is announced once":
                            // browse mode speaks it twice (this label, then the
                            // visible span). Kept deliberately — aria-hidden on
                            // the pill would strip the status from read-only rows
                            // entirely, and dropping it from this label costs a
                            // keyboard-only user the current value at the tab stop.
                            aria-label={`Edit status for ${directive.title}: ${CELL_STATUS_LABEL[status]}${isEditing ? ' (editing — activate to close)' : ''}`}
                            // HIT AREA: the status box is 19px, but WCAG 2.5.8
                            // wants a ≥24×24 target. The `after:` pseudo-element
                            // expands the CLICKABLE region while contributing
                            // NOTHING to layout — so the box does not move, the
                            // row height is untouched, and it is not scaled up to
                            // fake a bigger target. `after:content-['']` is
                            // REQUIRED: without it the pseudo-element never
                            // renders and the hit area silently does not exist.
                            // A wrapper button like the matrix's would have
                            // shifted this row's text; the matrix can afford one
                            // because its cell sits alone in a table cell.
                            //
                            // ALL colors via className, NEVER an inline style.
                            // That is not stylistic: 3363629 set color/borderColor
                            // inline, which silently beat the Tailwind `hover:`
                            // rules (an inline declaration wins over an author
                            // stylesheet absent !important), so the advertised
                            // hover was dead code asserted in three documents.
                            // Verify any change here against the COMPILED CSS —
                            // a class-list review cannot see that bug.
                            //
                            // The BOX's own colours come from StatusCellBox (a
                            // child), whose inline style is safe precisely because
                            // it carries no hover rule of its own.
                            className={
                              'relative mt-1 flex h-[19px] w-[19px] shrink-0 cursor-pointer items-center justify-center transition ' +
                              "after:absolute after:-inset-[3px] after:rounded-md after:content-[''] " +
                              'hover:ring-2 hover:ring-[color:var(--f92-focus-ring)] ' +
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)] ' +
                              // Mid-edit the box takes the matrix's ring treatment,
                              // so the two surfaces read ANALOGOUSLY — not
                              // identically: the matrix rings a 24px wrapper with
                              // no offset, this rings the 19px box with
                              // ring-offset-2. Same treatment, not the same pixels.
                              // A ring is a box-shadow, so it costs no layout.
                              //
                              // NOTE: this hover/focus ring is the ONLY affordance
                              // — at rest an editable box is pixel-identical to a
                              // non-editable one, and on touch there is no hover
                              // at all. That is a DECIDED trade, not an oversight:
                              // Lacey accepted hover-only for matrix parity on
                              // 2026-07-31 (the matrix's cell is hover-only too).
                              // Do not add a resting cue here without revisiting
                              // it — spec §0.5 has the full disclosure.
                              (isEditing
                                ? 'ring-2 ring-offset-2 ring-[color:var(--f92-focus-ring)] ring-offset-[color:var(--f92-surface)] '
                                : '')
                            }
                            style={{ borderRadius: 'var(--radius-md)' }}
                          >
                            <StatusCellBox status={status} size={19} emphasis={isEditing} />
                          </button>
                        ) : (
                          <span className="mt-1 flex h-[19px] w-[19px] shrink-0 items-center justify-center">
                            <StatusCellBox status={status} size={19} />
                          </span>
                        )}
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
                          {/* §2.7 — a REFACTOR, not a rebuild. This persistent
                              note render already shipped; the treatment,
                              placement and the "Note: " prefix are all
                              deliberately byte-for-byte unchanged. The ONLY
                              change is the source of truth: it used to be a bare
                              `cell?.note` truthiness test, which called an
                              all-whitespace note a note and would have rendered
                              this `Note:` label with nothing after it. It now
                              reads the same shared model the matrix does, so the
                              two surfaces cannot disagree about what counts as a
                              note — previously they agreed only by both being
                              wrong in the same direction.

                              This is the second consumer, and the one that
                              proves the seam: notes here stay PERSISTENT text
                              with no hover, because on a one-brand page there is
                              no grid to scan and nothing to inspect. */}
                          {readout.note ? (
                            <p className="mt-1 text-xs text-[color:var(--f92-dark)]">
                              <span className="text-[color:var(--f92-gray)]">Note: </span>
                              {readout.note}
                            </p>
                          ) : null}
                        </div>
                        {/* INERT status label — one control per row, and it is
                            the dot. This deliberately drops the bordered-chip
                            treatment 3363629 gave it: that chip existed to say
                            "click me", and now something else is the target, so
                            keeping it would advertise a control that no longer
                            exists. It carries no accessible name of its own
                            either — the dot's aria-label already speaks the
                            status, and a second name would make screen-reader
                            users hear every row twice. Same flat span for admins
                            and read-only users; the row's editability is signalled
                            by the dot's hover/focus ring. */}
                        <span
                          className="shrink-0 px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            // A pill VISUALLY, per the restyle — but deliberately
                            // NOT the chip treatment 3363629 gave it: no border, no
                            // hover, no ring, and it is a <span>. Border + hover are
                            // what made the old chip read as clickable, which is the
                            // exact confusion 5870dae fixed by moving the target to
                            // the box.
                            // The tint is NEUTRAL, not status-hued (Karen LOW-3
                            // caught an earlier comment claiming otherwise). That is
                            // the right call, not an oversight: the row's status is
                            // already carried by the coloured box on the left, and
                            // hue-tinting the label too would give one row two
                            // competing colour signals — and would make the inert
                            // label look MORE like the interactive control, which is
                            // the opposite of what this element needs.
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--f92-tint)',
                            color: 'var(--f92-gray)',
                            letterSpacing: 'var(--tracking-label)',
                          }}
                        >
                          {CELL_STATUS_LABEL[status]}
                        </span>
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
