// Batch 012 — Phase E1 (Pulse shell). Pure helpers for the contextual client
// nav and the per-brand page. Kept pure + side-effect-free so the render/
// routing layer stays thin and tests/pulse-shell.test.ts can pin the two bits
// of real logic (the brand-directive filter + the client-nav list rule).
// Mirrors the lib/client-library/{directives,monitoring}.ts split.

import type { CellStatus } from './directives';

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
