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

import { useEffect, useMemo, useRef, useState } from 'react';
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

export function ProjectBrandFilter({
  storageKey,
  projects,
  brands,
  value,
  onChange,
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

  // --- Stale-state prune ----------------------------------------
  // After hydration + once brands/projects load, drop any brandCodes
  // that no longer reference a pickable brand (paused, or belonging
  // to a single-brand project, or belonging to a project no longer
  // in projects[]). Convergent in at most two ticks: prune triggers
  // an onChange, which renders again with the clean value, which
  // re-runs this effect as a no-op.
  useEffect(() => {
    if (!didHydrate.current) return;
    if (value.brandCodes.length === 0) return;
    if (brands.length === 0 || projects.length === 0) return;

    const multiBrandProjectKeys = new Set(
      projects.filter(p => p.brand_model === 'multi_brand').map(p => p.jira_project_key),
    );
    const validCodes = new Set<string>();
    for (const b of brands) {
      if (b.is_paused) continue;
      if (!multiBrandProjectKeys.has(b.project_key)) continue;
      validCodes.add(b.brand_code);
    }
    const pruned = value.brandCodes.filter(c => validCodes.has(c));
    if (pruned.length !== value.brandCodes.length) {
      onChange({ projectKeys: value.projectKeys, brandCodes: pruned });
    }
  }, [brands, projects, value, onChange]);

  // --- Derived state ---------------------------------------------
  // Pickable brands = the user-facing pool. Paused brands and brands
  // belonging to single-brand projects are excluded from rendering.
  // Single-brand projects use the project pill as their entire filter
  // affordance — no per-brand control. The raw `brands` prop is kept
  // for status-line label lookups in case a brand was just paused
  // mid-session and value.brandCodes still references it.
  const singleBrandProjectKeys = useMemo(
    () => new Set(projects.filter(p => p.brand_model === 'single_brand').map(p => p.jira_project_key)),
    [projects],
  );
  const pickableBrands = useMemo(
    () => brands.filter(b => !b.is_paused && !singleBrandProjectKeys.has(b.project_key)),
    [brands, singleBrandProjectKeys],
  );

  // Pool of brands actually reachable given the current project
  // selection. Single-brand projects contribute no pool entries
  // (handled via the pickableBrands filter above). If no projects
  // are selected the brand row is hidden, so the pool is irrelevant;
  // we compute it anyway because the "select all N" pill needs the
  // count.
  const brandPool = useMemo(() => {
    if (value.projectKeys.length === 0) return [];
    return pickableBrands.filter(b => value.projectKeys.includes(b.project_key));
  }, [pickableBrands, value.projectKeys]);

  const poolCodes = useMemo(
    () => brandPool.map(b => b.brand_code),
    [brandPool],
  );

  // Three-state derivation for the "Select all N" pill.
  const selectAllState = useMemo<'none' | 'some' | 'all'>(() => {
    if (poolCodes.length === 0) return 'none';
    const selectedInPool = value.brandCodes.filter(c =>
      poolCodes.includes(c),
    ).length;
    if (selectedInPool === 0) return 'none';
    if (selectedInPool === poolCodes.length) return 'all';
    return 'some';
  }, [poolCodes, value.brandCodes]);

  // Group brand pool by project (for divider headers when 2+ projects).
  const grouped = useMemo(() => {
    const byProject = new Map<string, ProjectBrandFilterBrand[]>();
    for (const b of brandPool) {
      const list = byProject.get(b.project_key) ?? [];
      list.push(b);
      byProject.set(b.project_key, list);
    }
    // Preserve project ordering from the projects prop (already sorted).
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

    // When a project is deselected, drop any of its brand codes
    // from brandCodes so state stays coherent. (A brand code can
    // legitimately exist in multiple projects, but the filter
    // applies project + brand together, so only the codes of
    // brands still in the pool are meaningful.)
    let nextBrandCodes = value.brandCodes;
    if (isSelected) {
      const droppedCodes = new Set(
        pickableBrands
          .filter(b => b.project_key === jiraProjectKey)
          .map(b => b.brand_code),
      );
      // Keep brand codes that ALSO belong to another still-selected
      // pickable project. Only drop codes whose only home was the
      // deselected project.
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
    // 'all' → deselect all in pool; 'none' or 'some' → fill in.
    if (selectAllState === 'all') {
      onChange({
        projectKeys: value.projectKeys,
        brandCodes: value.brandCodes.filter(c => !poolCodes.includes(c)),
      });
    } else {
      // Preserve any brandCodes outside the pool (shouldn't exist
      // post-toggleProject, but defensive) and add every pool code.
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

  // --- Status line content ---------------------------------------
  const hasAnyFilter =
    value.projectKeys.length > 0 || value.brandCodes.length > 0;

  const statusFragments = useMemo(() => {
    if (!hasAnyFilter) return [];
    // Project model lookup. Single-brand projects render as just
    // the project short code — the project IS the filter, no
    // brand sub-list applies.
    const modelByKey = new Map<string, 'multi_brand' | 'single_brand'>();
    for (const p of projects) modelByKey.set(p.jira_project_key, p.brand_model);
    return value.projectKeys.map(pk => {
      const shortCode = projectShortCode(pk);
      if (modelByKey.get(pk) === 'single_brand') return shortCode;
      // Multi-brand: list selected brand codes if any. Status looks
      // up against the raw `brands` prop (not pickableBrands) so an
      // in-flight selection for a brand that was just paused still
      // renders its label rather than silently disappearing.
      const projectBrandCodes = brands
        .filter(b => b.project_key === pk)
        .map(b => b.brand_code);
      const selectedHere = value.brandCodes.filter(c =>
        projectBrandCodes.includes(c),
      );
      if (selectedHere.length === 0) return shortCode;
      return `${shortCode} (${selectedHere.join(', ')})`;
    });
  }, [hasAnyFilter, value.projectKeys, value.brandCodes, brands, projects]);

  // --- Render ----------------------------------------------------
  return (
    <Card className="p-3 md:p-4">
      {/* Project row */}
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
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)] focus-visible:ring-offset-1',
                    selected
                      ? 'border-[color:var(--f92-orange)] bg-[color:var(--f92-orange)] text-white'
                      : 'border-[color:var(--f92-border)] bg-transparent text-[color:var(--f92-dark)] hover:border-[color:var(--f92-orange)] hover:text-[color:var(--f92-orange)]',
                  )}
                >
                  {selected ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                  {code}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Brand row — only when ≥1 project selected */}
      {value.projectKeys.length > 0 ? (
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
              {/* Select all N — three-state ghost pill */}
              {poolCodes.length > 0 ? (
                <button
                  type="button"
                  onClick={clickSelectAll}
                  aria-pressed={selectAllState === 'all'}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)] focus-visible:ring-offset-1',
                    selectAllState === 'all'
                      ? 'border-[color:var(--f92-orange)] bg-[color:var(--f92-tint)] text-[color:var(--f92-orange)]'
                      : 'border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] text-[color:var(--f92-dark)] hover:border-[color:var(--f92-orange)] hover:text-[color:var(--f92-orange)]',
                  )}
                >
                  {selectAllState === 'all'
                    ? `Clear all ${poolCodes.length}`
                    : `Select all ${poolCodes.length}`}
                </button>
              ) : null}

              {grouped.map(group => (
                <div
                  key={group.projectKey}
                  className="flex shrink-0 items-center gap-1.5"
                >
                  {showProjectDividers ? (
                    <span className="ml-1 shrink-0 rounded-full border border-[color:var(--f92-border)] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">
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
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)] focus-visible:ring-offset-1',
                          selected
                            ? 'border-[color:var(--f92-orange)] bg-[color:var(--f92-orange)] text-white'
                            : 'border-[color:var(--f92-border)] bg-transparent text-[color:var(--f92-dark)] hover:border-[color:var(--f92-orange)] hover:text-[color:var(--f92-orange)]',
                        )}
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

      {/* Status line */}
      {hasAnyFilter ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--f92-gray)]"
          aria-live="polite"
        >
          <span>
            Filtering to:{' '}
            <span className="font-medium text-[color:var(--f92-dark)]">
              {statusFragments.length > 0
                ? statusFragments.join(', ')
                : value.brandCodes.join(', ')}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-[color:var(--f92-orange)] transition hover:text-[color:var(--f92-navy)] focus-visible:outline-none focus-visible:underline"
          >
            Clear
          </button>
        </div>
      ) : null}
    </Card>
  );
}
