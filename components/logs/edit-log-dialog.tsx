'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiCombobox, type MultiComboboxOption } from '@/components/ui/multi-combobox';
import { supabase } from '@/lib/supabase/client';

export interface EditableLog {
  id: string;
  jira_ticket_id: string;
  log_status: string;
  severity: string | null;
  who_owns_fix: string | null;
  notes: string | null;
  issue_category: string[] | null;
  issue_subtype: string[] | null;
  root_cause_final: string[] | null;
  resolution_type: string[] | null;
  resolution_notes: string | null;
  needs_review: boolean;
}

interface EditLogDialogProps {
  log: EditableLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: EditableLog) => void;
}

const STATUS_OPTIONS = ['Open', 'In Progress', 'Blocked', 'Pending Verification', 'Resolved'];
const SEVERITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];
const SEVERITY_SENTINEL = '__unset_severity__';

// Taxonomy field_name → quality_logs column name. root_cause_initial is
// frozen per §13 rule 3 (snapshot at creation) and is NOT in this map.
const TAXONOMY_COLUMNS = {
  issue_category: 'issue_category',
  issue_subtype: 'issue_subtype',
  root_cause: 'root_cause_final',
  resolution_type: 'resolution_type',
} as const;

type TaxonomyField = keyof typeof TAXONOMY_COLUMNS;

interface TaxonomyRow {
  field_name: TaxonomyField;
  canonical_value: string;
  description: string | null;
  sort_order: number;
}

function arraysEqual(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  return true;
}

function normalizeArrayValue(v: string[]): string[] | null {
  return v.length === 0 ? null : v;
}

export function EditLogDialog({ log, open, onOpenChange, onSaved }: EditLogDialogProps) {
  const [logStatus, setLogStatus] = useState('Open');
  const [severity, setSeverity] = useState<string>('');
  const [whoOwnsFix, setWhoOwnsFix] = useState('');
  const [issueCategory, setIssueCategory] = useState<string[]>([]);
  const [issueSubtype, setIssueSubtype] = useState<string[]>([]);
  const [rootCauseFinal, setRootCauseFinal] = useState<string[]>([]);
  const [resolutionType, setResolutionType] = useState<string[]>([]);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Single shared taxonomy fetch — populated once on dialog open and
  // cached for the dialog's lifetime. All 4 multi-selects read from
  // this same array; no per-field refetch.
  const [taxonomy, setTaxonomy] = useState<TaxonomyRow[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || taxonomy.length > 0) return;
    let cancelled = false;
    setTaxonomyLoading(true);
    setTaxonomyError(null);
    (async () => {
      const { data, error: fetchError } = await supabase
        .from('quality_log_taxonomy')
        .select('field_name, canonical_value, description, sort_order')
        .eq('is_active', true)
        .order('field_name', { ascending: true })
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (fetchError) {
        console.error('[EditLogDialog] taxonomy load failed', fetchError);
        setTaxonomyError('Could not load option lists. Try closing and reopening this dialog.');
      } else {
        setTaxonomy((data ?? []) as TaxonomyRow[]);
      }
      setTaxonomyLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, taxonomy.length]);

  useEffect(() => {
    if (!log) return;
    setLogStatus(log.log_status);
    setSeverity(log.severity || '');
    setWhoOwnsFix(log.who_owns_fix || '');
    setIssueCategory(log.issue_category ?? []);
    setIssueSubtype(log.issue_subtype ?? []);
    setRootCauseFinal(log.root_cause_final ?? []);
    setResolutionType(log.resolution_type ?? []);
    setResolutionNotes(log.resolution_notes || '');
    setNotes(log.notes || '');
    setError(null);
  }, [log]);

  const optionsByField = useMemo(() => {
    const map: Record<TaxonomyField, MultiComboboxOption[]> = {
      issue_category: [],
      issue_subtype: [],
      root_cause: [],
      resolution_type: [],
    };
    for (const row of taxonomy) {
      const list = map[row.field_name];
      if (!list) continue;
      list.push({
        value: row.canonical_value,
        label: row.canonical_value,
        description: row.description ?? undefined,
      });
    }
    return map;
  }, [taxonomy]);

  async function handleSave() {
    if (!log) return;
    setSaving(true);
    setError(null);

    try {
      const nextSeverity = severity === '' ? null : severity;
      const nextOwner = whoOwnsFix.trim() || null;
      const nextIssueCategory = normalizeArrayValue(issueCategory);
      const nextIssueSubtype = normalizeArrayValue(issueSubtype);
      const nextRootCause = normalizeArrayValue(rootCauseFinal);
      const nextResolutionType = normalizeArrayValue(resolutionType);
      const nextResolution = resolutionNotes.trim() || null;
      const nextNotes = notes.trim() || null;

      const updates = {
        log_status: logStatus,
        severity: nextSeverity,
        who_owns_fix: nextOwner,
        issue_category: nextIssueCategory,
        issue_subtype: nextIssueSubtype,
        root_cause_final: nextRootCause,
        resolution_type: nextResolutionType,
        resolution_notes: nextResolution,
        notes: nextNotes,
      };

      const diffs: { field: string; oldValue: string | null; newValue: string | null }[] = [];
      const push = (field: string, before: unknown, after: unknown) => {
        const beforeStr = before == null ? null : Array.isArray(before) ? JSON.stringify(before) : String(before);
        const afterStr = after == null ? null : Array.isArray(after) ? JSON.stringify(after) : String(after);
        if (beforeStr !== afterStr) diffs.push({ field, oldValue: beforeStr, newValue: afterStr });
      };

      push('log_status', log.log_status, logStatus);
      push('severity', log.severity, nextSeverity);
      push('who_owns_fix', log.who_owns_fix, nextOwner);
      if (!arraysEqual(log.issue_category, nextIssueCategory)) {
        push('issue_category', log.issue_category, nextIssueCategory);
      }
      if (!arraysEqual(log.issue_subtype, nextIssueSubtype)) {
        push('issue_subtype', log.issue_subtype, nextIssueSubtype);
      }
      if (!arraysEqual(log.root_cause_final, nextRootCause)) {
        push('root_cause_final', log.root_cause_final, nextRootCause);
      }
      if (!arraysEqual(log.resolution_type, nextResolutionType)) {
        push('resolution_type', log.resolution_type, nextResolutionType);
      }
      push('resolution_notes', log.resolution_notes, nextResolution);
      push('notes', log.notes, nextNotes);

      const response = await fetch('/api/logs/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: log.id, updates, diffs }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to save changes.');
      }

      onSaved({
        ...log,
        log_status: logStatus,
        severity: nextSeverity,
        who_owns_fix: nextOwner,
        issue_category: nextIssueCategory,
        issue_subtype: nextIssueSubtype,
        root_cause_final: nextRootCause,
        resolution_type: nextResolutionType,
        resolution_notes: nextResolution,
        notes: nextNotes,
        // Server clears needs_review on every successful edit (the edit
        // IS the review decision); mirror that locally so the worklist
        // pill count stays accurate without a refetch.
        needs_review: false,
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit log{log ? ` — ${log.jira_ticket_id}` : ''}</DialogTitle>
          <DialogDescription>
            Update status, severity, ownership, and classification. Changes are recorded in the audit log.
            {log?.needs_review ? (
              <span className="ml-1 inline-flex items-center rounded-full bg-[color:var(--pill-amber-bg)] px-2 py-0.5 text-xs font-medium text-[color:var(--pill-amber-fg)] ring-1 ring-inset ring-[color:var(--pill-amber-border)]">
                Needs review — saving clears the flag.
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="edit-status">Status</Label>
            <Select value={logStatus} onValueChange={setLogStatus}>
              <SelectTrigger id="edit-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-severity">Severity</Label>
            <Select
              value={severity || SEVERITY_SENTINEL}
              onValueChange={v => setSeverity(v === SEVERITY_SENTINEL ? '' : v)}
            >
              <SelectTrigger id="edit-severity">
                <SelectValue placeholder="Unset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEVERITY_SENTINEL}>Unset</SelectItem>
                {SEVERITY_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="edit-owner">Who owns fix</Label>
            <Input
              id="edit-owner"
              value={whoOwnsFix}
              onChange={e => setWhoOwnsFix(e.target.value)}
              placeholder="Person or team responsible"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="edit-issue-category">Issue category</Label>
            <MultiCombobox
              id="edit-issue-category"
              values={issueCategory}
              onChange={setIssueCategory}
              options={optionsByField.issue_category}
              placeholder={taxonomyLoading ? 'Loading options…' : 'Select issue category'}
              emptyLabel="No matching category"
              disabled={taxonomyLoading || !!taxonomyError}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="edit-issue-subtype">Issue subtype</Label>
            <MultiCombobox
              id="edit-issue-subtype"
              values={issueSubtype}
              onChange={setIssueSubtype}
              options={optionsByField.issue_subtype}
              placeholder={taxonomyLoading ? 'Loading options…' : 'Select issue subtype'}
              emptyLabel="No matching subtype"
              disabled={taxonomyLoading || !!taxonomyError}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="edit-root-cause">Root cause (final)</Label>
            <MultiCombobox
              id="edit-root-cause"
              values={rootCauseFinal}
              onChange={setRootCauseFinal}
              options={optionsByField.root_cause}
              placeholder={taxonomyLoading ? 'Loading options…' : 'Select root cause'}
              emptyLabel="No matching root cause"
              disabled={taxonomyLoading || !!taxonomyError}
            />
            <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
              Root Cause - Initial is captured once at log creation per §13 r3 and is not edited here.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="edit-resolution-type">Resolution type</Label>
            <MultiCombobox
              id="edit-resolution-type"
              values={resolutionType}
              onChange={setResolutionType}
              options={optionsByField.resolution_type}
              placeholder={taxonomyLoading ? 'Loading options…' : 'Select resolution type'}
              emptyLabel="No matching resolution type"
              disabled={taxonomyLoading || !!taxonomyError}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="edit-resolution">Resolution notes</Label>
            <Textarea
              id="edit-resolution"
              value={resolutionNotes}
              onChange={e => setResolutionNotes(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {taxonomyError ? (
          <p className="text-sm text-red-600">{taxonomyError}</p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || taxonomyLoading}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
