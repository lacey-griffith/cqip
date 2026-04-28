'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/layout/toaster';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BackToSettings } from '@/components/ui/back-to-settings';
import { ManageMilestonesDialog } from '@/components/coverage/manage-milestones-dialog';
import { EditBrandQaConfigDrawer, type BrandQaConfig } from '@/components/coverage/edit-brand-qa-config-drawer';
import type { Brand } from '@/lib/coverage/queries';

type BrandWithQa = Brand & BrandQaConfig;

function CoverageSettingsBody() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialBrandId = searchParams.get('brand');

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [brands, setBrands] = useState<BrandWithQa[]>([]);
  const [loading, setLoading] = useState(true);

  // Pause form state (per-brand)
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [pauseReasonDraft, setPauseReasonDraft] = useState('');
  const [pauseSubmitting, setPauseSubmitting] = useState(false);

  // QA config drawer state
  const [qaDrawerBrand, setQaDrawerBrand] = useState<BrandQaConfig | null>(null);
  const [qaDrawerOpen, setQaDrawerOpen] = useState(false);

  const loadBrands = useCallback(async () => {
    const { data: brandsData } = await supabase
      .from('brands')
      .select('id, brand_code, jira_value, display_name, is_active, is_paused, paused_reason, qa_automation_enabled, live_url_base, default_local_sub_areas, client_contact_name, client_contact_jira_account_id, url_pattern, notes')
      .order('display_name');
    setBrands((brandsData ?? []) as BrandWithQa[]);
  }, []);

  function openQaDrawer(brand: BrandWithQa) {
    setQaDrawerBrand({
      id: brand.id,
      brand_code: brand.brand_code,
      display_name: brand.display_name,
      qa_automation_enabled: brand.qa_automation_enabled ?? false,
      live_url_base: brand.live_url_base ?? null,
      default_local_sub_areas: brand.default_local_sub_areas ?? null,
      client_contact_name: brand.client_contact_name ?? null,
      client_contact_jira_account_id: brand.client_contact_jira_account_id ?? null,
      url_pattern: brand.url_pattern ?? null,
      notes: brand.notes ?? null,
    });
    setQaDrawerOpen(true);
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      const admin = profile?.role === 'admin';
      setIsAdmin(admin);

      if (admin) {
        await loadBrands();
      }
      setLoading(false);
    }
    init();
  }, [loadBrands]);

  async function togglePause(brand: BrandWithQa, nextPaused: boolean, reason: string) {
    if (pauseSubmitting) return;
    const previous: BrandWithQa = { ...brand };
    const reasonTrimmed = reason.trim() || null;

    // Optimistic local update — restrict to fields actually on the Brand type
    // so the state shape stays honest (no `as Brand` fib).
    setBrands(prev =>
      prev.map(b =>
        b.id === brand.id
          ? { ...b, is_paused: nextPaused, paused_reason: nextPaused ? reasonTrimmed : null }
          : b,
      ),
    );

    setPauseSubmitting(true);
    try {
      // §13 rule 19: pause + audit write happen in a single server route
      // so changed_by is derived from auth.uid() rather than trusted from
      // the browser.
      const res = await fetch('/api/admin/brands/pause', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: brand.id, paused: nextPaused, reason: reasonTrimmed }),
      });
      const result: { ok?: boolean; error?: string; auditError?: string } =
        await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        throw new Error(result.error ?? `Pause request failed (${res.status})`);
      }
      if (result.auditError && process.env.NODE_ENV !== 'production') {
        toast(`⚠️ Audit write failed: ${result.auditError}`);
      }

      toast(nextPaused ? '⏸️ Brand paused' : '▶️ Brand resumed');
      setEditingBrandId(null);
      setPauseReasonDraft('');
      // Refetch so the ManageMilestonesDialog's brand dropdown reflects
      // fresh server state (covers races with concurrent admin edits).
      void loadBrands();
    } catch (err) {
      // Roll back the optimistic update so UI and DB stay consistent.
      setBrands(prev => prev.map(b => (b.id === brand.id ? previous : b)));
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[coverage] pause toggle failed', err);
      toast(`❌ Failed to update ${brand.display_name}: ${msg}`);
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setPauseSubmitting(false);
    }
  }

  if (isAdmin === false) {
    return (
      <div className="space-y-6">
        <BackToSettings />
        <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-[color:var(--f92-dark)]">Admin access required</h1>
          <p className="mt-2 text-sm text-[color:var(--f92-gray)]">You do not have permission to view coverage management.</p>
        </div>
      </div>
    );
  }

  const pausedBrands = brands.filter(b => b.is_paused);
  const activeBrands = brands.filter(b => !b.is_paused);

  return (
    <div className="space-y-6">
      <BackToSettings />
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">Coverage Management</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
          Manually add, edit, or delete test milestones. Use sparingly — milestones are normally captured automatically from Jira.
        </p>
      </div>

      {loading ? (
        <Card className="p-6">
          <p className="text-sm text-[color:var(--f92-gray)]">Loading…</p>
        </Card>
      ) : (
        <>
          <ManageMilestonesDialog
            brands={brands}
            initialBrandId={initialBrandId}
          />

          <Card className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[color:var(--f92-dark)]">QA Automation Config</h2>
                <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
                  Per-brand config consumed by the Forge QA-automation app via /api/brands. Disabling a brand here hides it from the Forge API entirely (returns 404).
                </p>
              </div>
              <p className="text-xs text-[color:var(--f92-gray)]">
                {brands.filter(b => b.qa_automation_enabled).length} enabled / {brands.length} total
              </p>
            </div>

            <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-2">
              {brands.length === 0 ? (
                <p className="text-sm text-[color:var(--f92-gray)]">No brands.</p>
              ) : brands.map(b => (
                <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--f92-border)] bg-white p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[color:var(--f92-dark)]">{b.display_name}</span>
                      <span className="rounded-full border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">
                        {b.brand_code}
                      </span>
                      {b.qa_automation_enabled ? (
                        <Badge variant="resolved">QA Enabled</Badge>
                      ) : (
                        <Badge variant="default">QA Disabled</Badge>
                      )}
                    </div>
                    {b.live_url_base ? (
                      <p className="mt-1 truncate text-xs text-[color:var(--f92-gray)]">{b.live_url_base}</p>
                    ) : null}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => openQaDrawer(b)}>
                    Edit QA Config
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[color:var(--f92-dark)]">Paused brands</h2>
                <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
                  Paused brands are excluded from drought flags on the coverage page. KPIs still count their milestones.
                </p>
              </div>
              <p className="text-xs text-[color:var(--f92-gray)]">
                {pausedBrands.length} paused / {activeBrands.length} active
              </p>
            </div>

            <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-2">
              {pausedBrands.length === 0 ? (
                <p className="text-sm text-[color:var(--f92-gray)]">No brands paused.</p>
              ) : pausedBrands.map(b => (
                <div key={b.id} className="rounded-xl border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[color:var(--f92-dark)]">{b.display_name}</span>
                        <span className="rounded-full border border-[color:var(--f92-border)] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">
                          {b.brand_code}
                        </span>
                        <Badge variant="default">Paused</Badge>
                      </div>
                      {b.paused_reason ? (
                        <p className="mt-1 text-xs text-[color:var(--f92-gray)]">{b.paused_reason}</p>
                      ) : null}
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => togglePause(b, false, '')} disabled={pauseSubmitting}>
                      Resume
                    </Button>
                  </div>
                  {editingBrandId === b.id ? (
                    <div className="mt-3 space-y-2">
                      <Label htmlFor={`reason-${b.id}`} className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Reason</Label>
                      <Textarea
                        id={`reason-${b.id}`}
                        value={pauseReasonDraft}
                        onChange={e => setPauseReasonDraft(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => togglePause(b, true, pauseReasonDraft)} disabled={pauseSubmitting}>
                          Save reason
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingBrandId(null); setPauseReasonDraft(''); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setEditingBrandId(b.id); setPauseReasonDraft(b.paused_reason ?? ''); }}
                      className="mt-2 text-xs text-[color:var(--f92-orange)] hover:underline focus-visible:outline-none focus-visible:underline"
                    >
                      Edit reason
                    </button>
                  )}
                </div>
              ))}
            </div>

            {activeBrands.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-[color:var(--f92-dark)]">Pause an active brand</h3>
                <PauseActiveBrandForm
                  brands={activeBrands}
                  onPause={(brand, reason) => togglePause(brand, true, reason)}
                />
              </div>
            ) : null}
          </Card>
        </>
      )}

      <EditBrandQaConfigDrawer
        brand={qaDrawerBrand}
        open={qaDrawerOpen}
        onOpenChange={open => {
          setQaDrawerOpen(open);
          if (!open) setQaDrawerBrand(null);
        }}
        onSaved={() => { void loadBrands(); }}
      />
    </div>
  );
}

interface PauseActiveBrandFormProps {
  brands: BrandWithQa[];
  onPause: (brand: BrandWithQa, reason: string) => Promise<void>;
}

function PauseActiveBrandForm({ brands, onPause }: PauseActiveBrandFormProps) {
  const [selectedId, setSelectedId] = useState(brands[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const brand = brands.find(b => b.id === selectedId);
    if (!brand) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await onPause(brand, reason);
      // Only clear the form on success so a network failure doesn't
      // swallow the admin's typed reason.
      setSelectedId(brands[0]?.id ?? '');
      setReason('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to pause brand';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-3 md:grid-cols-[14rem_1fr_auto] md:items-end">
      <div>
        <Label htmlFor="pauseBrand" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Brand</Label>
        <select
          id="pauseBrand"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="h-9 w-full rounded-md border border-[color:var(--f92-border)] bg-white px-2 text-sm"
        >
          {brands.map(b => (
            <option key={b.id} value={b.id}>{b.display_name} ({b.brand_code})</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="pauseReason" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Reason</Label>
        <Input
          id="pauseReason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. client paused program"
          className="h-9 text-sm"
        />
      </div>
      <Button type="submit" disabled={submitting || !selectedId}>
        {submitting ? 'Pausing…' : 'Pause'}
      </Button>
      {formError ? (
        <p className="md:col-span-3 text-xs text-red-600" role="alert">{formError}</p>
      ) : null}
    </form>
  );
}

export default function CoverageSettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[color:var(--f92-gray)]">Loading…</div>}>
      <CoverageSettingsBody />
    </Suspense>
  );
}
