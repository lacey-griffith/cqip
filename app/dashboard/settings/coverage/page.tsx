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
import type { Brand } from '@/lib/coverage/queries';

function CoverageSettingsBody() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialBrandId = searchParams.get('brand');

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  // Pause form state (per-brand)
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [pauseReasonDraft, setPauseReasonDraft] = useState('');
  const [pauseSubmitting, setPauseSubmitting] = useState(false);

  const loadBrands = useCallback(async () => {
    const { data: brandsData } = await supabase
      .from('brands')
      .select('id, brand_code, jira_value, display_name, is_active, is_paused, paused_reason')
      .order('display_name');
    setBrands((brandsData ?? []) as Brand[]);
  }, []);

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
        .select('role, email')
        .eq('id', session.user.id)
        .maybeSingle();
      const admin = profile?.role === 'admin';
      setIsAdmin(admin);
      setUserEmail(profile?.email ?? session.user.email ?? 'unknown');

      if (admin) {
        await loadBrands();
      }
      setLoading(false);
    }
    init();
  }, [loadBrands]);

  async function togglePause(brand: Brand, nextPaused: boolean, reason: string) {
    if (pauseSubmitting) return;
    const previous: Brand = { ...brand };
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
      const updates = nextPaused
        ? {
            is_paused: true,
            paused_at: new Date().toISOString(),
            paused_by: userEmail,
            paused_reason: reasonTrimmed,
          }
        : {
            is_paused: false,
            paused_at: null,
            paused_by: null,
            paused_reason: null,
          };
      const { error } = await supabase.from('brands').update(updates).eq('id', brand.id);
      if (error) throw error;

      const { error: auditErr } = await supabase.from('audit_log').insert({
        log_entry_id: null,
        target_type: 'brand',
        target_id: brand.id,
        action: 'UPDATE',
        field_name: 'is_paused',
        old_value: String(brand.is_paused),
        new_value: String(nextPaused),
        changed_by: userEmail,
        notes: nextPaused ? reasonTrimmed : 'Unpaused',
      });
      if (auditErr) console.warn('[coverage] audit insert failed', auditErr);

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
            currentUserEmail={userEmail}
            initialBrandId={initialBrandId}
          />

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
                  submitting={pauseSubmitting}
                />
              </div>
            ) : null}
          </Card>
        </>
      )}
    </div>
  );
}

interface PauseActiveBrandFormProps {
  brands: Brand[];
  onPause: (brand: Brand, reason: string) => Promise<void> | void;
  submitting: boolean;
}

function PauseActiveBrandForm({ brands, onPause, submitting }: PauseActiveBrandFormProps) {
  const [selectedId, setSelectedId] = useState(brands[0]?.id ?? '');
  const [reason, setReason] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const brand = brands.find(b => b.id === selectedId);
    if (!brand) return;
    onPause(brand, reason);
    setReason('');
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
      <Button type="submit" disabled={submitting || !selectedId}>Pause</Button>
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
