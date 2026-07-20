// Batch 012 — Phase E1 (Pulse shell). Pure helpers for the contextual client
// nav and the per-brand page. Kept pure + side-effect-free so the render/
// routing layer stays thin and tests/pulse-shell.test.ts can pin the two bits
// of real logic (the brand-directive filter + the client-nav list rule).
// Mirrors the lib/client-library/{directives,monitoring}.ts split.

import type { CellStatus } from './directives';

// -------------------------------------------------------------------------
// Contextual client nav (spec §4). The list = active brands for the current
// project; paused brands are KEPT but flagged (greyed-but-linked); inactive
// brands are excluded entirely. Sorted alpha by display name.
// -------------------------------------------------------------------------
export interface ClientNavBrandInput {
  brand_code: string;
  display_name: string;
  is_active: boolean;
  is_paused: boolean;
}

export interface ClientNavItem {
  brand_code: string;
  display_name: string;
  paused: boolean;
}

export function toClientNavItems(
  brands: ReadonlyArray<ClientNavBrandInput>,
): ClientNavItem[] {
  return brands
    .filter((b) => b.is_active)
    .map((b) => ({
      brand_code: b.brand_code,
      display_name: b.display_name,
      paused: b.is_paused,
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
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
