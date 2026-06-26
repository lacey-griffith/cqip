'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/layout/toaster';

// Chrome-less QA-config form, extracted verbatim from EditBrandQaConfigDrawer
// (Batch 005.1 Phase 4) so the same form body can be hosted by both the
// settings-page drawer (which closes on save) AND the coverage-page
// BrandAdminDrawer's QA tab (which stays open and refetches). Validation,
// payload shape, route, and audit behavior are unchanged — the only thing
// that moved is the chrome. The host owns close behavior via onSaved/onCancel.

export interface BrandQaConfig {
  id: string;
  brand_code: string;
  display_name: string;
  qa_automation_enabled: boolean;
  live_url_base: string | null;
  default_local_sub_areas: string[] | null;
  client_contact_name: string | null;
  client_contact_jira_account_id: string | null;
  url_pattern: 'convert-preview' | 'live-qa' | null;
  notes: string | null;
}

const URL_PATTERN_NONE = '__none__';

interface BrandQaConfigFormProps {
  brand: BrandQaConfig;
  onSaved: () => void;
  onCancel?: () => void;
}

interface FormState {
  qa_automation_enabled: boolean;
  live_url_base: string;
  default_local_sub_areas: string;
  client_contact_name: string;
  client_contact_jira_account_id: string;
  url_pattern: string; // empty string represented by URL_PATTERN_NONE
  notes: string;
}

function fromBrand(brand: BrandQaConfig): FormState {
  return {
    qa_automation_enabled: brand.qa_automation_enabled,
    live_url_base: brand.live_url_base ?? '',
    default_local_sub_areas: (brand.default_local_sub_areas ?? []).join(', '),
    client_contact_name: brand.client_contact_name ?? '',
    client_contact_jira_account_id: brand.client_contact_jira_account_id ?? '',
    url_pattern: brand.url_pattern ?? URL_PATTERN_NONE,
    notes: brand.notes ?? '',
  };
}

function validateLiveUrl(value: string): string | null {
  if (value.length === 0) return null;
  if (!value.startsWith('https://')) return 'Must start with https://';
  if (value.endsWith('/')) return 'Must not end with a trailing slash';
  return null;
}

export function BrandQaConfigForm({ brand, onSaved, onCancel }: BrandQaConfigFormProps) {
  const { toast } = useToast();
  // Init from brand. The host remounts this component per brand via `key`,
  // so no open-based reset effect is needed.
  const [form, setForm] = useState<FormState>(() => fromBrand(brand));
  const [submitting, setSubmitting] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === 'live_url_base') {
      setUrlError(validateLiveUrl(String(value)));
    }
  }

  async function handleSave() {
    if (submitting) return;
    const liveUrlIssue = validateLiveUrl(form.live_url_base.trim());
    if (liveUrlIssue) {
      setUrlError(liveUrlIssue);
      return;
    }

    setSubmitting(true);
    try {
      const subAreas = form.default_local_sub_areas
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const payload = {
        id: brand.id,
        values: {
          qa_automation_enabled: form.qa_automation_enabled,
          live_url_base: form.live_url_base.trim() || null,
          default_local_sub_areas: subAreas.length > 0 ? subAreas : null,
          client_contact_name: form.client_contact_name.trim() || null,
          client_contact_jira_account_id: form.client_contact_jira_account_id.trim() || null,
          url_pattern: form.url_pattern === URL_PATTERN_NONE ? null : form.url_pattern,
          notes: form.notes.trim() || null,
        },
      };

      const res = await fetch('/api/admin/brands/qa-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result: { ok?: boolean; changed?: number; error?: string; auditError?: string } =
        await res.json().catch(() => ({}));

      if (!res.ok || !result.ok) {
        toast(`❌ ${result.error ?? `Save failed (${res.status})`}`);
        return;
      }

      if (result.auditError) {
        toast(`⚠️ Saved, but audit write failed: ${result.auditError}`);
      } else if (result.changed === 0) {
        toast('No changes to save');
      } else {
        toast(`✅ Saved ${result.changed} change${result.changed === 1 ? '' : 's'}`);
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`❌ ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-5">
        <div className="rounded-xl border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label htmlFor="qaEnabled" className="text-sm font-semibold text-[color:var(--f92-dark)]">
                QA Automation Enabled
              </Label>
              <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
                Gates whether the Forge app sees this brand. Disabled brands return 404 from the public API even if the row exists.
              </p>
            </div>
            <Switch
              id="qaEnabled"
              checked={form.qa_automation_enabled}
              onCheckedChange={value => update('qa_automation_enabled', value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="liveUrlBase" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
            Live URL Base
          </Label>
          <Input
            id="liveUrlBase"
            value={form.live_url_base}
            onChange={e => update('live_url_base', e.target.value)}
            placeholder="https://example.com"
            className="h-9 text-sm"
          />
          <p className="mt-1 text-[11px] text-[color:var(--f92-gray)]">
            Must start with <code>https://</code> and have no trailing slash.
          </p>
          {urlError ? <p className="mt-1 text-xs text-red-600" role="alert">{urlError}</p> : null}
        </div>

        <div>
          <Label htmlFor="urlPattern" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
            URL Pattern
          </Label>
          <Select value={form.url_pattern} onValueChange={value => update('url_pattern', value)}>
            <SelectTrigger id="urlPattern" className="h-9 text-sm">
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={URL_PATTERN_NONE}>Not set</SelectItem>
              <SelectItem value="convert-preview">convert-preview</SelectItem>
              <SelectItem value="live-qa">live-qa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="subAreas" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
            Default Local Sub-Areas
          </Label>
          <Input
            id="subAreas"
            value={form.default_local_sub_areas}
            onChange={e => update('default_local_sub_areas', e.target.value)}
            placeholder="austin, dallas, houston"
            className="h-9 text-sm"
          />
          <p className="mt-1 text-[11px] text-[color:var(--f92-gray)]">Comma-separated. Stored as TEXT[].</p>
        </div>

        <div>
          <Label htmlFor="contactName" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
            Client Contact Name
          </Label>
          <Input
            id="contactName"
            value={form.client_contact_name}
            onChange={e => update('client_contact_name', e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        <div>
          <Label htmlFor="contactJira" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
            Client Contact Jira Account ID
          </Label>
          <Input
            id="contactJira"
            value={form.client_contact_jira_account_id}
            onChange={e => update('client_contact_jira_account_id', e.target.value)}
            placeholder="557058:abcd-1234-..."
            className="h-9 text-sm font-mono"
          />
        </div>

        <div>
          <Label htmlFor="qaNotes" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
            Notes
          </Label>
          <Textarea
            id="qaNotes"
            value={form.notes}
            onChange={e => update('notes', e.target.value)}
            rows={4}
            className="text-sm"
          />
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <Button onClick={handleSave} disabled={submitting || urlError !== null}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
        {onCancel ? (
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        ) : null}
      </div>
    </>
  );
}
