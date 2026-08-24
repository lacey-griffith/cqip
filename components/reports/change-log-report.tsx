'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchAllPaged } from '@/lib/client-library/paged-fetch';
import {
  ACTOR_LABEL,
  CELL_TARGET_TYPE,
  DIRECTIVE_TARGET_TYPE,
  NOT_PERMITTED_TEXT,
  auditAccess,
  resolveDisplay,
  resolveMomentFor,
  sortEntries,
  summarize,
  verifyCompleteRead,
  type AuditRowLike,
  type ChangeLogEntry,
} from '@/lib/client-library/change-log';

// Batch #3 — Change Log widget. Spec: docs/specs/batch-change-log-widget.md.
//
// SELF-CONTAINED, like BrandWellnessReport: own project picker, own fetch, own
// state, NOT part of the ReportKind union or the shared from/to card controls.
//
// WHY IT LIVES ON /dashboard/reports AND NOT ON THE MATRIX PAGE (spec §6):
// G7 shipped a standing gate on 2026-08-23 — *decide the role="grid" roving
// tabindex question before adding another focusable surface to the Pulse matrix
// page*, which carries 1,105 tab stops in the default view. A widget there would
// trip a gate two days old. It also keeps `CellEditStrip` free, which is 012
// Phase E3's designated seam.
//
// READ-ONLY. No mutation route, no migration, no Jenny.
//
// ⚠ /dashboard/reports HAS NO MIDDLEWARE ADMIN GATE, AND THAT MATTERS HERE — the
// spec's first draft claimed this panel "shows nothing a Pulse viewer cannot
// already see", and that was FALSE. `audit_log` carries one SELECT policy,
// `is_admin()`, and it is the one table on this panel a read-only viewer cannot
// read. RLS filters the count and the paged read identically to zero WITH NO
// ERROR, so the completeness check passed and the panel asserted "0 of 639
// finished cells (0.0%) have an exact resolve date" — a fabricated figure
// presented as verified fact, to exactly the audience §6 was reasoning about.
// See `auditAccess` and the not-permitted branch below. Do not remove that
// branch, and do not add a mutation here without revisiting the missing gate.
//
// ⚠ WHAT IS STILL NOT COVERED BY ANY TEST, stated rather than implied (Karen
// MEDIUM-8): `readAllVerified` below is the count→page→verify composition the
// spec calls this batch's load-bearing decision, and it is UNTESTED, because it
// needs a live PostgREST to exercise. `verifyCompleteRead` — the pure comparison
// inside it — is tested; the plumbing around it is not, and the repo has no
// integration harness to change that. The C1 defect lived here, not in the
// tested half.
//
// COLOURS ARE TOKENS, NEVER `bg-white` (G7 Karen HIGH, 2026-08-23): globals.css's
// dark override is `:root[data-theme="dark"] .bg-white`, which matches the literal
// class and NOT a variant-generated selector, so a `focus:bg-white` or similar
// stays white on a #1E2235 card in dark mode.

interface DirectiveLite { id: string; title: string; project_key: string }
interface BrandLite { id: string; brand_code: string }
interface CellLite { id: string; directive_id: string; brand_id: string }

const ALL_PROJECTS = '__all__';

/**
 * Read every row, then PROVE the read was complete.
 *
 * A capped PostgREST read comes back short with NO error, and because an unranged
 * select has no ORDER BY, rows arrive in physical heap order — MVCC puts an
 * updated row's new version at the tail, so the rows past the cap are the
 * RECENTLY EDITED ones. A truncated change log therefore drops the newest changes
 * first. Counting separately and refusing to render on a mismatch is the only
 * honest option; it is also the method Gate 0 used.
 */
async function readAllVerified<T>(
  describe: string,
  select: string,
  table: string,
  applyFilters: (q: any) => any,
): Promise<{ rows: T[]; error: string | null }> {
  const countQ = applyFilters(supabase.from(table).select('id', { count: 'exact', head: true }));
  const { count, error: countErr, status, statusText } = await countQ;
  if (countErr) {
    // A `head:true` response has NO BODY, so supabase-js hands back
    // `error.message === ''` — the first build rendered "directives: count
    // failed — " with a dangling em-dash and threw away the only usable signal
    // (Karen MEDIUM-2).
    const why = countErr.message || [status, statusText].filter(Boolean).join(' ') || 'no detail available';
    return { rows: [], error: `${describe}: count failed — ${why}` };
  }

  const { data, error } = await fetchAllPaged<T>(describe, (from, to) =>
    applyFilters(supabase.from(table).select(select)).range(from, to));
  if (error) return { rows: [], error };

  const check = verifyCompleteRead(describe, count ?? null, data.length);
  if (!check.ok) return { rows: [], error: check.message };
  return { rows: data, error: null };
}

export function ChangeLogReport() {
  const [directives, setDirectives] = useState<DirectiveLite[]>([]);
  const [brands, setBrands] = useState<BrandLite[]>([]);
  const [cells, setCells] = useState<CellLite[]>([]);
  const [audit, setAudit] = useState<AuditRowLike[]>([]);
  const [project, setProject] = useState<string>(ALL_PROJECTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readAt, setReadAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const [d, b, c, a] = await Promise.all([
        readAllVerified<DirectiveLite>('directives', 'id, title, project_key', 'directives', (q) => q),
        readAllVerified<BrandLite>('brands', 'id, brand_code', 'brands', (q) => q),
        readAllVerified<CellLite>('done cells', 'id, directive_id, brand_id', 'directive_brand_status',
          (q) => q.eq('status', 'done')),
        // `field_name` IS read — it is what separates a resolve from a note edit
        // (RESOLVE_FIELD). `old_value`/`new_value` were selected and never used;
        // dropped rather than carried on the wire for ~1,700 rows.
        readAllVerified<AuditRowLike>('audit rows',
          'id, target_type, target_id, field_name, changed_by, changed_at',
          'audit_log', (q) => q.in('target_type', [CELL_TARGET_TYPE, DIRECTIVE_TARGET_TYPE])),
      ]);

      if (cancelled) return;

      // ANY failed read fails the whole panel. Rendering three of four reads is
      // exactly the partial-data-as-complete failure the pager exists to prevent.
      const firstError = [d, b, c, a].find((r) => r.error)?.error ?? null;
      if (firstError) {
        setError(firstError);
        setLoading(false);
        return;
      }

      setDirectives(d.rows);
      setBrands(b.rows);
      setCells(c.rows);
      setAudit(a.rows);
      setReadAt(new Date().toISOString());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const projectKeys = useMemo(
    () => Array.from(new Set(directives.map((d) => d.project_key))).sort(),
    [directives],
  );

  // Keyed on `audit` ALONE — the first build rebuilt both indexes over every
  // audit row whenever the project filter changed (Karen LOW-5).
  const indexes = useMemo(() => {
    const perCell = new Map<string, AuditRowLike[]>();
    const perDirective = new Map<string, AuditRowLike[]>();
    for (const r of audit) {
      if (!r.target_id) continue;
      const bucket = r.target_type === CELL_TARGET_TYPE ? perCell : perDirective;
      const list = bucket.get(r.target_id);
      if (list) list.push(r); else bucket.set(r.target_id, [r]);
    }
    return { perCell, perDirective };
  }, [audit]);

  const cellAuditRowCount = useMemo(
    () => audit.reduce((n, r) => (r.target_type === CELL_TARGET_TYPE ? n + 1 : n), 0),
    [audit],
  );

  // C1: zero cell-audit rows alongside finished cells is a PERMISSION state.
  const access = auditAccess(cells.length, cellAuditRowCount);

  const entries = useMemo<ChangeLogEntry[]>(() => {
    const dirById = new Map(directives.map((d) => [d.id, d]));
    const brandById = new Map(brands.map((b) => [b.id, b]));
    const { perCell, perDirective } = indexes;

    const out: ChangeLogEntry[] = [];
    for (const cell of cells) {
      const dir = dirById.get(cell.directive_id);
      const brand = brandById.get(cell.brand_id);
      if (!dir || !brand) continue;
      // ⚠ FILTERED BY project_key ONLY — and NOT by directive status.
      //
      // The first build's comment here claimed "filter on status (§15)" and no
      // such filter existed (Karen MEDIUM-5). Stated accurately now: cells are
      // filtered to `status='done'` at the query, directives are NOT filtered by
      // lifecycle, so ~15 done cells belonging to archived directives DO appear.
      // That is deliberate — a resolved cell is a real historical event and
      // archiving its parent does not un-resolve it — but it is a product call,
      // so it is written down rather than implied by a comment describing code
      // that was never there.
      if (project !== ALL_PROJECTS && dir.project_key !== project) continue;
      out.push({
        cellId: cell.id,
        directiveId: cell.directive_id,
        brandCode: brand.brand_code,
        directiveTitle: dir.title,
        moment: resolveMomentFor({ cellId: cell.id, directiveId: cell.directive_id }, perCell, perDirective),
      });
    }
    return sortEntries(out);
  }, [cells, directives, brands, indexes, project]);

  const summary = useMemo(() => summarize(entries), [entries]);

  return (
    <Card
      className="border-[color:var(--f92-border)] bg-[color:var(--f92-surface)] p-6"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Change log</h2>
          <p className="mt-1 text-sm text-[color:var(--f92-gray)]">
            When each finished directive cell was resolved. Read-only.
          </p>
        </div>
        <div>
          <Label htmlFor="clProjectFilter" className="text-[10px] uppercase text-[color:var(--f92-gray)]">
            Project
          </Label>
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger id="clProjectFilter" className="h-9 w-48 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
              {projectKeys.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* COVERAGE HEADER — reported from THIS read and stamped, never hardcoded.
          These counts have moved on every probe: 284/539 (52.7%) on 08-03,
          387/639 (60.6%) later on 08-24. A hardcoded ratio would already be stale
          three times over. */}
      {!loading && !error && access === 'readable' ? (
        <div className="mb-4 border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] p-3 text-sm text-[color:var(--f92-dark)]">
          <strong>{summary.exact}</strong> of <strong>{summary.total}</strong> finished cells
          {summary.exactPct === null ? null : <> ({summary.exactPct.toFixed(1)}%)</>} have an exact
          resolve date.
          {/* Counted SEPARATELY, because they render differently: an approximate
              cell shows a directive date, an unknown cell shows no date at all.
              The first build lumped them and claimed both "show an approximate
              directive date" (Karen MEDIUM-11). */}
          {summary.approximate > 0 ? (
            <> <strong>{summary.approximate}</strong> show an approximate directive date instead.</>
          ) : null}
          {summary.unknown > 0 ? (
            <> <strong>{summary.unknown}</strong> have no audit trail at all.</>
          ) : null}
          <span className="block text-xs text-[color:var(--f92-gray)]">
            {/* ⚠ THE FIRST BUILD STATED A FALSE CAUSE AS FACT (Karen HIGH-2):
                "Cells resolved before per-cell history existed." Per-cell history
                starts 2026-07-17 and was demonstrably writing on 07-22. All ~252
                degraded cells carry `updated_at` inside a 0.4-SECOND window on
                2026-07-22 — a bulk load, five days AFTER per-cell history began.
                There is no trigger on directive_brand_status; audit rows come
                from application code, so this was an app-level omission, not a
                schema-era gap.

                Also softened: "does not reach zero" was stated as an invariant
                and is only app discipline (Karen MEDIUM-10). Two data points of
                stability is not a guarantee, and one new bulk path adds a fresh
                block instantly — which is exactly how these arose. */}
            Resolved by a bulk load that did not write per-cell audit rows. This share falls as new
            work lands, and a future bulk write could add to it.
            {readAt ? <> Read {new Date(readAt).toLocaleString('en-US')}.</> : null}
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="p-8 text-center text-sm text-[color:var(--f92-gray)]">Loading change log…</div>
      ) : access === 'not-permitted' ? (
        /* ⚠ C1 — DO NOT REMOVE, AND DO NOT LET THIS FALL THROUGH TO THE DATA
           BRANCHES. `audit_log`'s only SELECT policy is `is_admin()`, and RLS
           filters the count and the read identically to zero with NO error. The
           first build therefore passed its own completeness check and rendered
           "0 of 639 finished cells (0.0%) have an exact resolve date", with 639
           rows reading "no audit trail" — every one of which HAS one. A
           fabricated figure, presented as verified fact, to the read-only viewer
           this panel was reasoned about for.

           Deliberately carries NO figure of any kind: the defect was a number
           read as fact, so the replacement states a capability limit instead. */
        <div className="border border-[color:var(--f92-border)] p-4 text-sm">
          <p className="font-semibold text-[color:var(--f92-dark)]">Change history unavailable</p>
          <p className="mt-1 text-[color:var(--f92-gray)]">{NOT_PERMITTED_TEXT}</p>
        </div>
      ) : error ? (
        /* A failed or unverifiable read renders NOTHING but the reason. The one
           thing this panel must never do is show a partial list as complete. */
        <div className="border border-[color:var(--f92-border)] p-4 text-sm">
          <p className="font-semibold text-[color:var(--f92-dark)]">Change log not shown</p>
          <p className="mt-1 text-[color:var(--f92-gray)]">{error}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center text-sm text-[color:var(--f92-gray)]">
          No finished cells for this project yet.
        </div>
      ) : (
        /* tabIndex + role + label because THIS SCROLL REGION CONTAINS NOTHING
           FOCUSABLE (Karen MEDIUM-4, WCAG 2.1.1). The matrix page's documented
           escape hatch — "every interactive thing inside is already a real
           <button> with its own keyboard path" — does NOT apply here: there are
           no controls at all, so without a tab stop a keyboard user cannot reach
           hundreds of rows. This is the one place in this batch where ADDING a
           tab stop is correct, and it is on the Reports page, not the matrix. */
        <div
          className="max-h-[60vh] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)]"
          tabIndex={0}
          role="region"
          aria-label="Change log, scrollable"
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase text-[color:var(--f92-gray)]">
                {/* HEADER_RULE as an inset box-shadow, NOT a border (Karen
                    MEDIUM-3, and the matrix page documents the same fix): under
                    `border-collapse: collapse` a collapsed border belongs to the
                    table's border model rather than to the cell, so it does not
                    travel with a sticky cell while rows scroll beneath it. The
                    opaque background is the other half — without it rows scroll
                    straight through the header. */}
                {(['Resolved', 'Brand', 'Directive', 'By'] as const).map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="sticky top-0 bg-[color:var(--f92-surface)] p-2"
                    style={{ boxShadow: 'inset 0 -1px 0 var(--f92-border)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const d = resolveDisplay(e.moment);
                return (
                  <tr key={e.cellId} className="border-t border-[color:var(--f92-border)]">
                    <td className="p-2 align-top whitespace-nowrap">
                      {/* `primary` NEVER contains a date unless it is exact — the
                          structure makes the §4 failure unreachable rather than
                          relying on this conditional being right. */}
                      <span className={d.exact ? 'text-[color:var(--f92-dark)]' : 'italic text-[color:var(--f92-gray)]'}>
                        {d.primary}
                      </span>
                      {d.qualifier ? (
                        <span className="block text-xs text-[color:var(--f92-gray)]">{d.qualifier}</span>
                      ) : null}
                    </td>
                    <td className="p-2 align-top whitespace-nowrap text-[color:var(--f92-dark)]">{e.brandCode}</td>
                    <td className="p-2 align-top text-[color:var(--f92-dark)]">{e.directiveTitle}</td>
                    <td className="p-2 align-top whitespace-nowrap text-[color:var(--f92-gray)]">
                      {/* Script vs human ONLY (§5). No email, no named pass — the
                          data cannot distinguish one human pass from another. An
                          approximate moment carries NO actor at all, because a
                          directive-level row says who touched the DIRECTIVE. */}
                      {e.moment.actor ? ACTOR_LABEL[e.moment.actor] : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
