// Batch 012 — Phase E1 (Pulse shell). Pure helpers for the contextual client
// nav and the per-brand page. Kept pure + side-effect-free so the render/
// routing layer stays thin and tests/pulse-shell.test.ts can pin the two bits
// of real logic (the brand-directive filter + the client-nav list rule).
// Mirrors the lib/client-library/{directives,monitoring}.ts split.

import {
  CELL_STATUS_LABEL,
  DIRECTIVE_TYPES,
  type CellStatus,
  type DirectiveType,
} from './directives';

// -------------------------------------------------------------------------
// Cross-project client nav (Pulse E1 follow-on). Groups ALL active brands by
// project (client) into an ordered, render-ready structure:
//   - single_brand project → ONE collapsed entry under the client's name,
//     linking straight to its brand page.
//   - multi_brand project → a group header (client name → matrix, scoped) plus
//     its brands.
// Groups alpha by project display name; brands alpha by display name; paused
// kept + flagged (greyed-but-linked); inactive projects/brands excluded; a
// project with zero active brands is skipped. Every node carries projectKey
// (+ brandCode where it links to a brand) so the renderer builds hrefs with no
// further logic — the nav moves to the top in a later batch, so all the logic
// lives here and the renderer stays thin.
// -------------------------------------------------------------------------
export interface ClientNavProjectInput {
  jira_project_key: string;
  display_name: string;
  brand_model: string; // 'multi_brand' | 'single_brand' (migration 019)
  is_active: boolean;
}

export interface ClientNavBrandRow {
  project_key: string;
  brand_code: string;
  display_name: string;
  is_active: boolean;
  is_paused: boolean;
}

export interface ClientNavBrandEntry {
  projectKey: string;
  brandCode: string;
  displayName: string;
  paused: boolean;
}

export type ClientNavGroup =
  | { kind: 'single'; projectKey: string; label: string; entry: ClientNavBrandEntry }
  | { kind: 'multi'; projectKey: string; label: string; brands: ClientNavBrandEntry[] };

export function toClientNavGroups(
  projects: ReadonlyArray<ClientNavProjectInput>,
  brands: ReadonlyArray<ClientNavBrandRow>,
): ClientNavGroup[] {
  // Group active brands by project_key.
  const byProject = new Map<string, ClientNavBrandEntry[]>();
  for (const b of brands) {
    if (!b.is_active) continue;
    const list = byProject.get(b.project_key) ?? [];
    list.push({
      projectKey: b.project_key,
      brandCode: b.brand_code,
      displayName: b.display_name,
      paused: b.is_paused,
    });
    byProject.set(b.project_key, list);
  }

  const activeProjects = projects
    .filter((p) => p.is_active)
    .slice()
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  const groups: ClientNavGroup[] = [];
  for (const project of activeProjects) {
    const entries = (byProject.get(project.jira_project_key) ?? [])
      .slice()
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    if (entries.length === 0) continue; // nothing to link — skip empty client

    if (project.brand_model === 'single_brand') {
      // The project IS the client — collapse to one entry under its name,
      // linking to the (single) brand's page.
      groups.push({
        kind: 'single',
        projectKey: project.jira_project_key,
        label: project.display_name,
        entry: entries[0],
      });
    } else {
      groups.push({
        kind: 'multi',
        projectKey: project.jira_project_key,
        label: project.display_name,
        brands: entries,
      });
    }
  }
  return groups;
}

// -------------------------------------------------------------------------
// Brand page directive view (spec §3). The same directive dataset the matrix
// loads, projected to ONE brand: for each directive, that brand's cell (status
// + note) or null if no cell exists yet (a brand added after the directive was
// created — Phase A has no backfill). One source, not a per-brand copy.
// -------------------------------------------------------------------------
export interface DirectiveLike {
  id: string;
}

export interface BrandCell {
  directive_id: string;
  brand_id: string;
  status: CellStatus;
  note: string | null;
}

export interface BrandDirectiveRow<D extends DirectiveLike> {
  directive: D;
  cell: BrandCell | null;
}

// Just the target brand's cells out of a mixed cell set (test §5.1).
export function cellsForBrand(
  cells: ReadonlyArray<BrandCell>,
  brandId: string,
): BrandCell[] {
  return cells.filter((c) => c.brand_id === brandId);
}

// Per-directive view for one brand, preserving the directive order passed in.
export function brandDirectiveView<D extends DirectiveLike>(
  directives: ReadonlyArray<D>,
  cells: ReadonlyArray<BrandCell>,
  brandId: string,
): BrandDirectiveRow<D>[] {
  const byDirective = new Map<string, BrandCell>();
  for (const c of cells) {
    if (c.brand_id === brandId) byDirective.set(c.directive_id, c);
  }
  return directives.map((directive) => ({
    directive,
    cell: byDirective.get(directive.id) ?? null,
  }));
}

// -------------------------------------------------------------------------
// Brand-page status filter. Client-side over the rows brandDirectiveView has
// already produced — no fetch, no new query.
//
// THIS IS NOT THE MATRIX'S FILTER, and the two must not be unified.
// matrix-controls.ts filters on a DERIVED RESOLVE STATE computed across every
// brand of a directive (active / resolved / unstarted). Here each directive has
// exactly ONE cell, so that classifier collapses to the cell's own status and
// carries no information the status itself doesn't. Different question, different
// function. Neither control should be relabelled to match the other either:
// "Open" on the matrix means "this directive is not finished ANYWHERE", while
// "Open" here means "this brand still owes this directive".
//
// It lives in pulse.ts rather than a sibling brand-controls.ts because it is a
// projection of brandDirectiveView's output, directly above — one module for the
// brand page's pure logic, tested by tests/pulse-shell.test.ts.
// -------------------------------------------------------------------------

// The statuses that owe nothing further on this brand. `open` is defined as the
// EXCLUSION of this set, never as a whitelist of {todo, in_progress, blocked} —
// the fail-safe direction matters: a sixth cell status added later defaults to
// VISIBLE under the default filter rather than silently disappearing from it.
//
// Deliberately NOT derived as the complement of OWED_CELL_STATUSES, even though
// the two sets partition today's five statuses exactly. A complement-of-whitelist
// would invert the fail-safe: a status added to CELL_STATUSES but not to OWED
// would be auto-classified terminal and vanish from the default view. The sets
// encode opposite intents (OWED decides what counts toward Outstanding and must
// not over-count; this decides what to hide and must not over-hide), so they are
// declared independently on purpose.
//
// DO NOT "simplify" this into that complement. No test can stop you — verified
// by mutation 2026-07-31: the complement form keeps the whole suite green,
// because the two forms only diverge once a sixth status exists, which a
// compile-time const makes unconstructable in a test. This comment is the only
// enforcement there is.
export const TERMINAL_CELL_STATUSES: readonly CellStatus[] = ['done', 'n_a'];
const TERMINAL = new Set<CellStatus>(TERMINAL_CELL_STATUSES);

export const BRAND_STATUS_FILTERS = [
  'open',
  'todo',
  'in_progress',
  'done',
  'blocked',
  'n_a',
  'all',
] as const;
export type BrandStatusFilter = (typeof BRAND_STATUS_FILTERS)[number];

// Per-status labels come from CELL_STATUS_LABEL so this control and the editor
// dropdown beside it cannot spell a status two ways.
export const BRAND_STATUS_FILTER_LABEL: Record<BrandStatusFilter, string> = {
  open: 'Open',
  todo: CELL_STATUS_LABEL.todo,
  in_progress: CELL_STATUS_LABEL.in_progress,
  done: CELL_STATUS_LABEL.done,
  blocked: CELL_STATUS_LABEL.blocked,
  n_a: CELL_STATUS_LABEL.n_a,
  all: 'All',
};

// The status a row RENDERS as. A directive with no cell for this brand (a brand
// added after the directive was created — Phase A has no backfill) reads n_a.
// One definition consumed by the row render, the filter, and the count, so the
// three cannot disagree about what a cell-less row is.
//
// Consequence, accepted: a cell-less row is hidden under the default `open`
// filter. Nothing actionable is lost — such a row is non-interactive anyway
// (editable = isAdmin && !!cell) — and it is included in the hidden count the
// page surfaces, so its existence is never silent.
export function effectiveCellStatus(cell: { status: CellStatus } | null | undefined): CellStatus {
  return cell?.status ?? 'n_a';
}

export function matchesBrandStatusFilter(status: CellStatus, filter: BrandStatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return !TERMINAL.has(status);
  return status === filter;
}

export function filterBrandDirectiveRows<D extends DirectiveLike>(
  rows: ReadonlyArray<BrandDirectiveRow<D>>,
  filter: BrandStatusFilter,
): BrandDirectiveRow<D>[] {
  return rows.filter((row) => matchesBrandStatusFilter(effectiveCellStatus(row.cell), filter));
}

// -------------------------------------------------------------------------
// Brand-page TYPE group (Batch 012 restyle — new on this surface; the matrix
// got the same group in matrix-controls.ts).
//
// Reads the REAL `directive_type` column (migration 024's enum). The mockup's
// title-regex derivation is scaffolding and is NOT ported — it looks like logic,
// which is what makes it dangerous, and it would mislabel any title outside the
// pattern.
//
// All four options are always rendered even though prod holds only goal +
// trigger today, so an empty tab needs type-specific copy rather than the
// generic no-match state.
//
// The two groups on this page compose: single-choice within each, AND across,
// AND with nothing else — there is no derived state here, because one brand
// means one cell per directive (see the status-filter note above).
// -------------------------------------------------------------------------
export const BRAND_TYPE_FILTERS = [...DIRECTIVE_TYPES, 'all'] as const;
export type BrandTypeFilter = (typeof BRAND_TYPE_FILTERS)[number];

export const BRAND_TYPE_FILTER_LABEL: Record<BrandTypeFilter, string> = {
  goal: 'Goal',
  trigger: 'Trigger',
  site_area: 'Site area',
  audience: 'Audience',
  all: 'All',
};

export function matchesBrandTypeFilter(
  directiveType: DirectiveType,
  filter: BrandTypeFilter,
): boolean {
  return filter === 'all' || directiveType === filter;
}

export interface BrandFilterControls {
  status: BrandStatusFilter;
  type: BrandTypeFilter;
}

// Both groups at once, so the page has ONE call and cannot apply them in a way
// that disagrees with the hidden count below.
export function filterBrandRows<D extends DirectiveLike & { directive_type: DirectiveType }>(
  rows: ReadonlyArray<BrandDirectiveRow<D>>,
  controls: BrandFilterControls,
): BrandDirectiveRow<D>[] {
  return rows.filter(
    (row) =>
      matchesBrandStatusFilter(effectiveCellStatus(row.cell), controls.status) &&
      matchesBrandTypeFilter(row.directive.directive_type, controls.type),
  );
}

// NOTE: a `hasActiveBrandFilter` helper was written here and then REMOVED before
// commit — it had no consumer. On this surface it is provably redundant: reaching
// the "filters emptied the view" branch requires rows.length > 0 AND
// visibleRows.length === 0, which already implies a group is narrowing. Shipping a
// tested-but-uncalled export would be dead code dressed up as coverage. The matrix
// keeps its equivalent (hasActiveFilterGroup) because THERE it is not redundant —
// three groups plus a search make "did a GROUP narrow this?" a genuinely separate
// question from "are any rows hidden?".

export function countBrandRowsByType<D extends DirectiveLike & { directive_type: DirectiveType }>(
  rows: ReadonlyArray<BrandDirectiveRow<D>>,
  type: DirectiveType,
): number {
  let n = 0;
  for (const r of rows) if (r.directive.directive_type === type) n += 1;
  return n;
}
