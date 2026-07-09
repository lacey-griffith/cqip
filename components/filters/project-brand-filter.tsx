'use client';

// Shared project + brand multi-select filter. First mount: Coverage
// (Batch 005.22 Phase 2). Future mounts: Dashboard (Phase 3), Logs
// (Phase 4), Reports (deferred).
//
// FilterValue contract:
//   { projectKeys: [], brandCodes: [] }   → no filter (show all)
//   { projectKeys: ['NBLYCRO'], ... }     → narrow to project
//   { projectKeys: [...], brandCodes: ['MDG','MOJ'] }
//                                         → narrow to project + brand subset
// Empty arrays = implicit all (Variant A — locked with Lacey).
//
// State is owned by the parent. This component renders pills,
// emits `onChange`, and persists the latest value into
// sessionStorage under `storageKey`. On mount, hydrates from
// storage if present.

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface FilterValue {
  projectKeys: string[];
  brandCodes: string[];
}

export interface ProjectBrandFilterProject {
  jira_project_key: string;
  display_name: string;
  brand_model: 'multi_brand' | 'single_brand';
}

export interface ProjectBrandFilterBrand {
  id: string;
  project_key: string;
  brand_code: string;
  display_name: string;
  is_paused: boolean;
}

interface ProjectBrandFilterProps {
  storageKey: string;
  projects: ProjectBrandFilterProject[];
  brands: ProjectBrandFilterBrand[];
  value: FilterValue;
  onChange: (next: FilterValue) => void;
  // When true, paused brands appear as pickable pills (with a dashed
  // border + dimmed opacity). When false (default), they're hidden
  // from the pill row entirely. Coverage opts in by wiring its
  // existing showPaused state through; Dashboard / Logs mounts
  // leave this off.
  showPaused?: boolean;
  // Optional right-aligned action cluster rendered in the Project row's
  // right group alongside "Clear" (Batch 005.3 commit 3 — lets a page fold
  // its control bar into this one card instead of stacking a second Card).
  // Undefined on the Dashboard / Logs mounts → nothing extra renders.
  actions?: ReactNode;
}

// Strip the "CRO" suffix common to CQIP-monitored Jira project keys
// so pills read as "NBLY" / "SPL" instead of "NBLYCRO" / "SPLCRO".
// Falls back to the raw key for anything that doesn't match the
// pattern — defensive against future client keys that don't end CRO.
function projectShortCode(jiraProjectKey: string): string {
  return jiraProjectKey.endsWith('CRO')
    ? jiraProjectKey.slice(0, -3)
    : jiraProjectKey;
}

function arraysShallowEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Pill class builders. Kept local so the visual rules live next to
// the markup that consumes them, and so paused-state styling is the
// same shape for project and brand pills.
function pillClass({
  selected,
  paused = false,
}: {
  selected: boolean;
  paused?: boolean;
}): string {
  const base =
    'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)] focus-visible:ring-offset-1';
  // Option F: navy ghost (unselected) + orange solid (selected).
  // Border is transparent in both base states; paused pills swap
  // border to dashed + a paused-specific token so the dashing reads.
  const stateColors = selected
    ? 'border-transparent bg-[color:var(--f92-orange)] text-white hover:brightness-95'
    : 'border-transparent bg-[color:var(--pill-filter-bg)] text-[color:var(--pill-filter-fg)] hover:bg-[color:var(--pill-filter-bg-hover)]';
  const pausedExtra = paused
    ? selected
      ? 'border-dashed border-[color:var(--pill-filter-selected-paused-border)] opacity-70'
      : 'border-dashed border-[color:var(--pill-filter-paused-border)] opacity-70'
    : '';
  return cn(base, stateColors, pausedExtra);
}

export function ProjectBrandFilter({
  storageKey,
  projects,
  brands,
  value,
  onChange,
  showPaused = false,
  actions,
}: ProjectBrandFilterProps) {
  // --- Hydration / persistence -----------------------------------
  // Read once on mount; subsequent value changes flow back to storage.
  const didHydrate = useRef(false);
  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as FilterValue).projectKeys) &&
        Array.isArray((parsed as FilterValue).brandCodes) &&
        (parsed as FilterValue).projectKeys.every(k => typeof k === 'string') &&
        (parsed as FilterValue).brandCodes.every(c => typeof c === 'string')
      ) {
        onChange(parsed as FilterValue);
      }
    } catch (err) {
      console.error('[ProjectBrandFilter] hydration failed', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!didHydrate.current) return;
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch (err) {
      console.error('[ProjectBrandFilter] persist failed', err);
    }
  }, [storageKey, value]);

  // --- Derived sets ---------------------------------------------
  // Single-brand projects: brand-row affordance doesn't apply
  // (the project pill IS the entire filter for them).
  const singleBrandProjectKeys = useMemo(
    () => new Set(projects.filter(p => p.brand_model === 'single_brand').map(p => p.jira_project_key)),
    [projects],
  );

  // Pickable brands = the user-facing pool for the brand pill row.
  // Conditionally excludes paused brands depending on `showPaused`.
  // Single-brand projects never contribute pool entries — their
  // brand has no per-brand filter affordance, period.
  const pickableBrands = useMemo(
    () => brands.filter(b => {
      if (singleBrandProjectKeys.has(b.project_key)) return false;
      if (!showPaused && b.is_paused) return false;
      return true;
    }),
    [brands, singleBrandProjectKeys, showPaused],
  );

  // --- Stale-state prune ----------------------------------------
  // After hydration + once brands/projects load, drop brandCodes
  // whose referent is no longer pickable: paused (when
  // !showPaused), single-brand-project, or no longer in
  // projects[]. Convergent in ≤2 ticks because we only call
  // onChange when the cleaned list actually differs from value.
  useEffect(() => {
    if (!didHydrate.current) return;
    if (value.brandCodes.length === 0) return;
    if (brands.length === 0 || projects.length === 0) return;

    const validCodes = new Set(pickableBrands.map(b => b.brand_code));
    const pruned = value.brandCodes.filter(c => validCodes.has(c));
    if (pruned.length !== value.brandCodes.length) {
      onChange({ projectKeys: value.projectKeys, brandCodes: pruned });
    }
  }, [brands, projects, pickableBrands, value, onChange]);

  // Pool of pickable brands actually reachable given the current
  // project selection. If no projects are selected the brand row
  // is hidden, so the pool is irrelevant; we compute it anyway
  // because the "Select all" pill state derives from it.
  const brandPool = useMemo(() => {
    if (value.projectKeys.length === 0) return [];
    return pickableBrands.filter(b => value.projectKeys.includes(b.project_key));
  }, [pickableBrands, value.projectKeys]);

  const poolCodes = useMemo(
    () => brandPool.map(b => b.brand_code),
    [brandPool],
  );

  const selectAllState = useMemo<'none' | 'some' | 'all'>(() => {
    if (poolCodes.length === 0) return 'none';
    const selectedInPool = value.brandCodes.filter(c =>
      poolCodes.includes(c),
    ).length;
    if (selectedInPool === 0) return 'none';
    if (selectedInPool === poolCodes.length) return 'all';
    return 'some';
  }, [poolCodes, value.brandCodes]);

  const grouped = useMemo(() => {
    const byProject = new Map<string, ProjectBrandFilterBrand[]>();
    for (const b of brandPool) {
      const list = byProject.get(b.project_key) ?? [];
      list.push(b);
      byProject.set(b.project_key, list);
    }
    return value.projectKeys
      .filter(pk => byProject.has(pk))
      .map(pk => ({
        projectKey: pk,
        shortCode: projectShortCode(pk),
        brands: (byProject.get(pk) ?? []).slice().sort(
          (a, b) => a.brand_code.localeCompare(b.brand_code),
        ),
      }));
  }, [brandPool, value.projectKeys]);

  const showProjectDividers = grouped.length >= 2;

  // --- Mutation helpers ------------------------------------------
  function toggleProject(jiraProjectKey: string) {
    const isSelected = value.projectKeys.includes(jiraProjectKey);
    const nextProjectKeys = isSelected
      ? value.projectKeys.filter(k => k !== jiraProjectKey)
      : [...value.projectKeys, jiraProjectKey];

    let nextBrandCodes = value.brandCodes;
    if (isSelected) {
      const droppedCodes = new Set(
        pickableBrands
          .filter(b => b.project_key === jiraProjectKey)
          .map(b => b.brand_code),
      );
      const stillReachable = new Set(
        pickableBrands
          .filter(b => nextProjectKeys.includes(b.project_key))
          .map(b => b.brand_code),
      );
      nextBrandCodes = value.brandCodes.filter(
        c => !droppedCodes.has(c) || stillReachable.has(c),
      );
      if (arraysShallowEqual(nextBrandCodes, value.brandCodes)) {
        nextBrandCodes = value.brandCodes;
      }
    }

    onChange({ projectKeys: nextProjectKeys, brandCodes: nextBrandCodes });
  }

  function toggleBrand(brandCode: string) {
    const isSelected = value.brandCodes.includes(brandCode);
    const nextBrandCodes = isSelected
      ? value.brandCodes.filter(c => c !== brandCode)
      : [...value.brandCodes, brandCode];
    onChange({ projectKeys: value.projectKeys, brandCodes: nextBrandCodes });
  }

  function clickSelectAll() {
    if (selectAllState === 'all') {
      onChange({
        projectKeys: value.projectKeys,
        brandCodes: value.brandCodes.filter(c => !poolCodes.includes(c)),
      });
    } else {
      const outsidePool = value.brandCodes.filter(c => !poolCodes.includes(c));
      onChange({
        projectKeys: value.projectKeys,
        brandCodes: [...outsidePool, ...poolCodes],
      });
    }
  }

  function clearAll() {
    onChange({ projectKeys: [], brandCodes: [] });
  }

  // --- Scroll affordance -----------------------------------------
  const brandRowRef = useRef<HTMLDivElement | null>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = brandRowRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      const overflowing = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setCanScrollRight(overflowing);
    }
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [grouped, value.projectKeys.length]);

  // --- Aria-live announcement ------------------------------------
  // Visual status line was removed in Phase 2.1 (Option F); the
  // screen-reader announcement region is kept as sr-only so AT
  // users still hear what changed.
  const hasAnyFilter =
    value.projectKeys.length > 0 || value.brandCodes.length > 0;

  const announcement = useMemo(() => {
    if (!hasAnyFilter) return 'Filter cleared.';
    const n = value.projectKeys.length;
    const m = value.brandCodes.length;
    const proj = n === 1 ? '1 project' : `${n} projects`;
    const brnd = m === 1 ? '1 brand' : `${m} brands`;
    return `Filter updated. ${proj}, ${brnd} selected.`;
  }, [hasAnyFilter, value.projectKeys.length, value.brandCodes.length]);

  const selectAllAriaLabel =
    selectAllState === 'all'
      ? `Clear all ${poolCodes.length} brand${poolCodes.length === 1 ? '' : 's'}`
      : `Select all ${poolCodes.length} brand${poolCodes.length === 1 ? '' : 's'}`;

  // --- Render ----------------------------------------------------
  return (
    <Card className="p-3 md:p-4">
      {/* Project row with Clear at the right edge */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="min-w-[3.5rem] text-[10px] font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">
            Project
          </span>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Project filter"
          >
            {projects.length === 0 ? (
              <span className="text-xs text-[color:var(--f92-gray)]">
                No active projects.
              </span>
            ) : (
              projects.map(p => {
                const selected = value.projectKeys.includes(p.jira_project_key);
                const code = projectShortCode(p.jira_project_key);
                return (
                  <button
                    key={p.jira_project_key}
                    type="button"
                    onClick={() => toggleProject(p.jira_project_key)}
                    aria-pressed={selected}
                    title={p.display_name}
                    className={pillClass({ selected })}
                  >
                    {selected ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                    {code}
                  </button>
                );
              })
            )}
          </div>
        </div>
        {/* Right cluster: page-supplied actions + Clear, one wrapping,
            right-aligned group (Batch 005.3 commit 3). flex-wrap keeps it
            stacking cleanly on narrow widths. */}
        {actions || hasAnyFilter ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {actions}
            {hasAnyFilter ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-[color:var(--f92-orange)] transition hover:underline focus-visible:outline-none focus-visible:underline"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Brand row — only when ≥1 project selected AND that project
          has pickable brands (single-brand-only selections render no
          brand row even if projects are picked). */}
      {value.projectKeys.length > 0 && (poolCodes.length > 0 || grouped.length > 0) ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="min-w-[3.5rem] text-[10px] font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">
            Brand
          </span>
          <div className="relative min-w-0 flex-1">
            <div
              ref={brandRowRef}
              className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-1"
              role="group"
              aria-label="Brand filter"
            >
              {/* Select all — three-state ghost pill, label without count */}
              {poolCodes.length > 0 ? (
                <button
                  type="button"
                  onClick={clickSelectAll}
                  aria-pressed={selectAllState === 'all'}
                  aria-label={selectAllAriaLabel}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)] focus-visible:ring-offset-1',
                    selectAllState === 'all'
                      ? 'border-[color:var(--f92-orange)] bg-[color:var(--pill-filter-bg)] text-[color:var(--f92-orange)]'
                      : 'border-[color:var(--pill-filter-paused-border)] bg-[color:var(--pill-filter-bg)] text-[color:var(--pill-filter-fg)] hover:border-[color:var(--f92-orange)] hover:text-[color:var(--f92-orange)]',
                  )}
                >
                  {selectAllState === 'all' ? 'Clear all' : 'Select all'}
                </button>
              ) : null}

              {grouped.map(group => (
                <div
                  key={group.projectKey}
                  className="flex shrink-0 items-center gap-1.5"
                >
                  {showProjectDividers ? (
                    <span className="ml-1 shrink-0 rounded-full border border-[color:var(--f92-border)] bg-[color:var(--f92-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">
                      {group.shortCode}
                    </span>
                  ) : null}
                  {group.brands.map(b => {
                    const selected = value.brandCodes.includes(b.brand_code);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBrand(b.brand_code)}
                        aria-pressed={selected}
                        title={b.display_name}
                        className={pillClass({ selected, paused: b.is_paused })}
                      >
                        {selected ? (
                          <Check className="h-3 w-3" aria-hidden="true" />
                        ) : null}
                        {b.brand_code}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {canScrollRight ? (
              <div
                className="pointer-events-none absolute inset-y-0 right-0 flex items-center pl-6 pr-1"
                style={{
                  background:
                    'linear-gradient(to right, transparent, var(--f92-bg) 60%)',
                }}
                aria-hidden="true"
              >
                <ChevronRight className="h-4 w-4 text-[color:var(--f92-gray)]" />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Screen-reader announcement (sr-only). Visual status line was
          removed in Phase 2.1; AT users still get a polite update. */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>
    </Card>
  );
}
