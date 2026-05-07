'use client';

// Batch 005 brand-create UI — closes audit Q1
// (docs/multi-client-readiness.md §10 / §6.5). Sheet-based drawer
// matching the BrandDetailDrawer / EditBrandQaConfigDrawer pattern.
//
// Scope is deliberately narrow: create only. Brand delete/archive
// is deferred to backlog item 5.4 ("only if business need emerges").
// Coverage + Settings UX redesign is backlog 5.1 — when that lands
// the trigger surface for this drawer may move, but the form itself
// is reusable.

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/layout/toaster';
import { supabase } from '@/lib/supabase/client';

export interface ProjectOption {
  jira_project_key: string;
  display_name: string;
}

interface AddBrandDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Pre-fetched project options. If omitted the drawer fetches them
  // itself on open. Allowing the parent to pass them avoids a redundant
  // fetch when the parent already has the list.
  projects?: ProjectOption[];
  onCreated: () => void;
}

interface FormState {
  project_key: string;
  brand_code: string;
  jira_value: string;
  display_name: string;
  is_active: boolean;
  is_paused: boolean;
}

const EMPTY_FORM: FormState = {
  project_key: '',
  brand_code: '',
  jira_value: '',
  display_name: '',
  is_active: true,
  is_paused: false,
};

const BRAND_CODE_PATTERN = /^[A-Z0-9-]{1,32}$/;

function validateBrandCode(value: string): string | null {
  if (value.length === 0) return null;
  if (!BRAND_CODE_PATTERN.test(value)) {
    return '1–32 chars: uppercase letters, digits, hyphens only';
  }
  return null;
}

export function AddBrandDrawer({ open, onOpenChange, projects, onCreated }: AddBrandDrawerProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [fetchedProjects, setFetchedProjects] = useState<ProjectOption[] | null>(null);

  // Reset the form whenever the drawer opens — never carry stale state
  // across opens (e.g. half-typed values from a previous attempt).
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setCodeError(null);
    }
  }, [open]);

  // Fetch project options if the parent didn't supply them. Only runs
  // when the drawer is open and projects are missing.
  useEffect(() => {
    if (!open || projects) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('jira_project_key, display_name')
        .eq('is_active', true)
        .order('display_name');
      if (cancelled) return;
      if (error) {
        console.warn('[add-brand-drawer] project fetch failed', error.message);
        return;
      }
      setFetchedProjects((data as ProjectOption[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [open, projects]);

  const projectOptions = projects ?? fetchedProjects ?? [];

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === 'brand_code') {
      const upper = String(value).toUpperCase();
      setCodeError(validateBrandCode(upper));
    }
  }

  const trimmedCode = form.brand_code.trim().toUpperCase();
  const trimmedJiraValue = form.jira_value.trim();
  const trimmedDisplayName = form.display_name.trim();
  const canSubmit =
    !!form.project_key &&
    !!trimmedCode &&
    !codeError &&
    !!trimmedJiraValue &&
    !!trimmedDisplayName &&
    !submitting;

  async function handleCreate() {
    if (!canSubmit) return;
    const codeIssue = validateBrandCode(trimmedCode);
    if (codeIssue) {
      setCodeError(codeIssue);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        project_key: form.project_key,
        brand_code: trimmedCode,
        jira_value: trimmedJiraValue,
        display_name: trimmedDisplayName,
        is_active: form.is_active,
        is_paused: form.is_paused,
      };

      const res = await fetch('/api/admin/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result: { ok?: boolean; error?: string; auditError?: string; brand?: { brand_code?: string } } =
        await res.json().catch(() => ({}));

      if (!res.ok || !result.ok) {
        toast(`❌ ${result.error ?? `Create failed (${res.status})`}`);
        // Keep drawer open so the user can adjust without retyping.
        return;
      }

      if (result.auditError) {
        toast(`⚠️ Brand added, but audit write failed: ${result.auditError}`);
      } else {
        toast(`✅ Brand ${result.brand?.brand_code ?? trimmedCode} added`);
      }
      onCreated();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`❌ ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add brand</SheetTitle>
          <p className="text-xs text-[color:var(--f92-gray)]">
            Seed a new brand for an existing CRO project. The brand
            appears on Coverage immediately and feeds the drought
            evaluator on the next daily run.
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div>
            <Label htmlFor="brandProject" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              Project
            </Label>
            <Select value={form.project_key} onValueChange={value => update('project_key', value)}>
              <SelectTrigger id="brandProject" className="h-9 text-sm">
                <SelectValue placeholder="Pick a project" />
              </SelectTrigger>
              <SelectContent>
                {projectOptions.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No active projects found
                  </SelectItem>
                ) : (
                  projectOptions.map(p => (
                    <SelectItem key={p.jira_project_key} value={p.jira_project_key}>
                      {p.display_name} ({p.jira_project_key})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="brandCode" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              Brand code
            </Label>
            <Input
              id="brandCode"
              value={form.brand_code}
              onChange={e => update('brand_code', e.target.value)}
              placeholder="MRA"
              className="h-9 text-sm font-mono uppercase"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-[color:var(--f92-gray)]">
              Short uppercase identifier. Letters, numbers, and hyphens only.
            </p>
            {codeError ? <p className="mt-1 text-xs text-red-600" role="alert">{codeError}</p> : null}
          </div>

          <div>
            <Label htmlFor="brandJiraValue" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              Jira value
            </Label>
            <Input
              id="brandJiraValue"
              value={form.jira_value}
              onChange={e => update('jira_value', e.target.value)}
              placeholder="MLY - Molly Maid"
              className="h-9 text-sm"
            />
            <p className="mt-1 text-[11px] text-[color:var(--f92-gray)]">
              Format: <code>CODE - Display Name</code> (e.g.{' '}
              <code>MLY - Molly Maid</code>, <code>SPL - Spotloan</code>). For
              multi-brand projects this must match the exact value Jira returns
              from the project&apos;s brand custom field. For single-brand projects
              the field isn&apos;t read at runtime, but use the same format so
              Coverage rework counts and dashboard filters render consistently.
            </p>
          </div>

          <div>
            <Label htmlFor="brandDisplayName" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              Display name
            </Label>
            <Input
              id="brandDisplayName"
              value={form.display_name}
              onChange={e => update('display_name', e.target.value)}
              placeholder="Molly Maid"
              className="h-9 text-sm"
            />
            <p className="mt-1 text-[11px] text-[color:var(--f92-gray)]">
              Shown throughout the dashboard and in exports.
            </p>
          </div>

          <div className="rounded-xl border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="brandActive" className="text-sm font-semibold text-[color:var(--f92-dark)]">
                  Active
                </Label>
                <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
                  Off means the brand is hidden from coverage and alerts but historical data is preserved.
                </p>
              </div>
              <Switch
                id="brandActive"
                checked={form.is_active}
                onCheckedChange={value => update('is_active', value)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="brandPaused" className="text-sm font-semibold text-[color:var(--f92-dark)]">
                  Paused
                </Label>
                <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
                  Pause skips the brand in drought evaluation. Useful for clients with no active tests.
                </p>
              </div>
              <Switch
                id="brandPaused"
                checked={form.is_paused}
                onCheckedChange={value => update('is_paused', value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {submitting ? 'Adding…' : 'Add brand'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
