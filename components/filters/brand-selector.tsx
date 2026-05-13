'use client';

// Shared brand filter dropdown. Sources brand options from
// the brands table (is_active = TRUE), not from DISTINCT
// client_brand in quality_logs.
//
// Consumers: /dashboard/logs, /dashboard/reports.
//
// Source-of-truth decision (Batch 005.25, closes 5.19 finding F1):
// Brands without active non-deleted logs (e.g. SPL on first
// onboarding) are now visible in the dropdown. The quality_logs-
// derived approach silently hid them.
//
// Value contract: emits brands.jira_value verbatim (e.g.
// "SPL - Spotloan"). Callers filter quality_logs.client_brand
// via .eq() against the emitted value. This works uniformly
// because Batch 005.25 Commit 1 normalized historical raw
// codes to canonical jira_value format, and §13 rule 28
// (Option γ writeback) keeps new rows canonical at ingestion
// time.
//
// Phase 4 hook: optional projectKey prop restricts options
// to a single project. Unused by 005.25 callers; available
// for Batch 005.22 Phase 4 (project-aware logs dropdown).

import { useEffect, useMemo, useState } from 'react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { supabase } from '@/lib/supabase/client';

// Canonical sentinel for "no brand filter applied."
// Exported so consumers import this instead of defining
// local ALL constants — single source of truth.
export const BRAND_SELECTOR_ALL = '__all__';

interface BrandRow {
  brand_code: string;
  jira_value: string;
  display_name: string;
  project_key: string;
}

interface BrandSelectorProps {
  value: string;                 // jira_value, or BRAND_SELECTOR_ALL
  onChange: (value: string) => void;
  projectKey?: string;
  placeholder?: string;
  allLabel?: string;
  className?: string;
}

export function BrandSelector({
  value,
  onChange,
  projectKey,
  placeholder = 'All brands',
  allLabel = 'All brands',
  className,
}: BrandSelectorProps) {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let query = supabase
        .from('brands')
        .select('brand_code, jira_value, display_name, project_key')
        .eq('is_active', true)
        .order('jira_value');
      if (projectKey) {
        query = query.eq('project_key', projectKey);
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error('[BrandSelector] failed to load brands', error);
        setBrands([]);
      } else {
        setBrands((data ?? []) as BrandRow[]);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [projectKey]);

  const options = useMemo<ComboboxOption[]>(
    () => [
      { value: BRAND_SELECTOR_ALL, label: allLabel },
      ...brands.map(b => ({ value: b.jira_value, label: b.jira_value })),
    ],
    [brands, allLabel],
  );

  return (
    <Combobox
      value={value || BRAND_SELECTOR_ALL}
      onChange={onChange}
      options={options}
      placeholder={loading ? 'Loading brands…' : placeholder}
      emptyLabel="No matching brand"
      className={className}
    />
  );
}
