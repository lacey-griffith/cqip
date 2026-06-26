'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/layout/toaster';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ManageMilestonesDialog } from '@/components/coverage/manage-milestones-dialog';
import { BrandQaConfigForm, type BrandQaConfig } from '@/components/coverage/brand-qa-config-form';
import type { Brand } from '@/lib/coverage/queries';
import { cn } from '@/lib/utils';

// Per-brand admin surface for the Coverage page (Batch 005.1 Phase 4).
// Consolidates all brand-admin actions — Details, QA Config, Milestones,
// Pause — into one drawer opened from the Output table by admins. Replaces
// the old redirect to /dashboard/settings/coverage (that page stays live as
// a fallback until Phase 5).
//
// No new mutation routes: each write reuses an existing server-gated route
// (/api/admin/brands/qa-config, /api/admin/milestones, /api/admin/brands/pause)
// so audit writes stay server-derived (§13 r19). No project has Tabs in the
// component library, so the tab strip is a minimal local switch.

interface BrandAdminDrawerProps {
  brand: Brand | null;
  brands: Brand[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutated: () => void;
}

// Full brand record (base + QA columns) fetched admin-side for the QA tab.
interface FullBrandRecord extends Brand {
  qa_automation_enabled: boolean;
  live_url_base: string | null;
  default_local_sub_areas: string[] | null;
  client_contact_name: string | null;
  client_contact_jira_account_id: string | null;
  url_pattern: 'convert-preview' | 'live-qa' | null;
  notes: string | null;
}

type TabKey = 'details' | 'qa' | 'milestones' | 'pause';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'details', label: 'Details' },
  { key: 'qa', label: 'QA Config' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'pause', label: 'Pause' },
];

function toQaConfig(rec: FullBrandRecord): BrandQaConfig {
  return {
    id: rec.id,
    brand_code: rec.brand_code,
    display_name: rec.display_name,
    qa_automation_enabled: rec.qa_automation_enabled ?? false,
    live_url_base: rec.live_url_base ?? null,
    default_local_sub_areas: rec.default_local_sub_areas ?? null,
    client_contact_name: rec.client_contact_name ?? null,
    client_contact_jira_account_id: rec.client_contact_jira_account_id ?? null,
    url_pattern: rec.url_pattern ?? null,
    notes: rec.notes ?? null,
  };
}

export function BrandAdminDrawer({ brand, brands, open, onOpenChange, onMutated }: BrandAdminDrawerProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('details');
  const [record, setRecord] = useState<FullBrandRecord | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);

  // Pause tab local state.
  const [pauseReasonDraft, setPauseReasonDraft] = useState('');
  const [editingReason, setEditingReason] = useState(false);
  const [pauseSubmitting, setPauseSubmitting] = useState(false);

  const brandId = brand?.id ?? null;

  const loadRecord = useCallback(async () => {
    if (!brandId) return;
    setRecordLoading(true);
    const { data, error } = await supabase
      .from('brands')
      .select('id, project_key, brand_code, jira_value, display_name, is_active, is_paused, paused_reason, qa_automation_enabled, live_url_base, default_local_sub_areas, client_contact_name, client_contact_jira_account_id, url_pattern, notes')
      .eq('id', brandId)
      .maybeSingle();
    if (error) {
      console.error('[brand-admin-drawer] record load failed', error.message);
    }
    setRecord((data as FullBrandRecord) ?? null);
    setRecordLoading(false);
  }, [brandId]);

  // Reset tab + (re)fetch the full record each time a brand is opened.
  useEffect(() => {
    if (open && brandId) {
      setTab('details');
      setEditingReason(false);
      setPauseReasonDraft('');
      void loadRecord();
    }
  }, [open, brandId, loadRecord]);

  if (!brand) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent />
      </Sheet>
    );
  }

  // Pause state: prefer the freshly-fetched record, fall back to the prop
  // snapshot until it lands.
  const isPaused = record?.is_paused ?? brand.is_paused;
  const pausedReason = record?.paused_reason ?? brand.paused_reason;

  async function setPaused(nextPaused: boolean, reason: string) {
    if (!brand || pauseSubmitting) return;
    const reasonTrimmed = reason.trim() || null;
    setPauseSubmitting(true);
    try {
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
      setEditingReason(false);
      setPauseReasonDraft('');
      // Reflect new state in this drawer immediately, then refetch the
      // full record and notify the page so the Output status pill flips.
      setRecord(prev => (prev ? { ...prev, is_paused: nextPaused, paused_reason: nextPaused ? reasonTrimmed : null } : prev));
      void loadRecord();
      onMutated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[brand-admin-drawer] pause toggle failed', err);
      toast(`❌ Failed to update ${brand.display_name}: ${msg}`);
    } finally {
      setPauseSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Manage — {brand.display_name}</SheetTitle>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[color:var(--f92-gray)]">
            <span>{brand.brand_code}</span>
            {isPaused ? <Badge variant="default">Paused</Badge> : <Badge variant="resolved">Active</Badge>}
          </div>
        </SheetHeader>

        {/* Tab strip — minimal local switch (no Tabs component in the library). */}
        <div className="mt-4 flex gap-1 border-b border-[color:var(--f92-border)]">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? 'page' : undefined}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition',
                tab === t.key
                  ? 'border-[color:var(--f92-orange)] text-[color:var(--f92-dark)]'
                  : 'border-transparent text-[color:var(--f92-gray)] hover:text-[color:var(--f92-dark)]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'details' ? (
            <dl className="space-y-3">
              <DetailRow label="Display name" value={brand.display_name} />
              <DetailRow label="Brand code" value={brand.brand_code} mono />
              <DetailRow label="Jira value" value={brand.jira_value} mono />
              <DetailRow label="Project" value={brand.project_key} mono />
              <DetailRow label="Active" value={brand.is_active ? 'Yes' : 'No'} />
            </dl>
          ) : null}

          {tab === 'qa' ? (
            recordLoading || !record ? (
              <p className="text-sm text-[color:var(--f92-gray)]">Loading QA config…</p>
            ) : (
              <BrandQaConfigForm
                key={record.id}
                brand={toQaConfig(record)}
                onSaved={() => { void loadRecord(); onMutated(); }}
              />
            )
          ) : null}

          {tab === 'milestones' ? (
            <ManageMilestonesDialog
              brands={brands}
              initialBrandId={brand.id}
              onChanged={onMutated}
            />
          ) : null}

          {tab === 'pause' ? (
            <div className="space-y-4">
              {isPaused ? (
                <div className="rounded-xl border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[color:var(--f92-dark)]">Paused</span>
                    <Badge variant="default">Paused</Badge>
                  </div>
                  {pausedReason ? (
                    <p className="mt-1 text-xs text-[color:var(--f92-gray)]">{pausedReason}</p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setPaused(false, '')} disabled={pauseSubmitting}>
                      {pauseSubmitting ? 'Working…' : 'Resume'}
                    </Button>
                    {!editingReason ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditingReason(true); setPauseReasonDraft(pausedReason ?? ''); }}
                        disabled={pauseSubmitting}
                      >
                        Edit reason
                      </Button>
                    ) : null}
                  </div>
                  {editingReason ? (
                    <div className="mt-3 space-y-2">
                      <Label htmlFor="adminPauseReason" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Reason</Label>
                      <Textarea
                        id="adminPauseReason"
                        value={pauseReasonDraft}
                        onChange={e => setPauseReasonDraft(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setPaused(true, pauseReasonDraft)} disabled={pauseSubmitting}>
                          Save reason
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingReason(false); setPauseReasonDraft(''); }} disabled={pauseSubmitting}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-[color:var(--f92-gray)]">
                    Pausing skips this brand in drought evaluation. KPIs still count its milestones.
                  </p>
                  <Label htmlFor="adminPauseReason" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Reason</Label>
                  <Input
                    id="adminPauseReason"
                    value={pauseReasonDraft}
                    onChange={e => setPauseReasonDraft(e.target.value)}
                    placeholder="e.g. client paused program"
                    className="h-9 text-sm"
                  />
                  <Button size="sm" onClick={() => setPaused(true, pauseReasonDraft)} disabled={pauseSubmitting}>
                    {pauseSubmitting ? 'Pausing…' : 'Pause'}
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-[color:var(--f92-border)] bg-white p-3">
      <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">{label}</dt>
      <dd className={cn('mt-1 text-sm text-[color:var(--f92-dark)]', mono ? 'font-mono' : '')}>{value}</dd>
    </div>
  );
}
