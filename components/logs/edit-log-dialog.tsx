'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  arraysEqual,
  isFormDirty,
  snapshotFromLog,
  type EditFormSnapshot,
} from '@/lib/logs/edit-dirty';
import {
  CONFIDENCE_BAND_LABEL,
  isPrimaryRulingDisabled,
  isRulingBlocked,
  proseBlocks,
  suggestionAction,
} from '@/lib/logs/ai-suggestion';
import { type ConfidenceBand } from '@/lib/classifier/confidence';
import { cn } from '@/lib/utils';

// Per-theme tokens, never inline hex (§13 r25). All nine referenced values are
// declared twice in globals.css — once under :root and once under
// :root[data-theme="dark"] — which is the one failure class tsc cannot see.
const BAND_STYLE: Record<ConfidenceBand, string> = {
  high: 'bg-[color:var(--pill-green-bg)] border-[color:var(--pill-green-border)] text-[color:var(--pill-green-fg)]',
  medium: 'bg-[color:var(--pill-amber-bg)] border-[color:var(--pill-amber-border)] text-[color:var(--pill-amber-fg)]',
  low: 'bg-[color:var(--pill-filter-bg)] border-[color:var(--f92-border)] text-[color:var(--pill-filter-fg)]',
};

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
  // Part C. The AI suggestion and the prose it was derived from.
  issue_details: string | null;
  ai_suggested_root_cause: string[] | null;
  ai_confidence_band: ConfidenceBand | null;
  ai_review_pending: boolean;
}

interface EditLogDialogProps {
  log: EditableLog | null;
  open: boolean;
  /**
   * Gates the suggestion strip's actions. The route enforces admin server-side
   * regardless (r6) — this only decides whether the affordance renders. Non-admins
   * get an inert line, never a disabled button, per §13.8 and the Batch 012 Pulse
   * precedent: a disabled control announces "unavailable" for something that is
   * not a control for this user at all.
   */
  isAdmin: boolean;
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

function normalizeArrayValue(v: string[]): string[] | null {
  return v.length === 0 ? null : v;
}

export function EditLogDialog({ log, open, isAdmin, onOpenChange, onSaved }: EditLogDialogProps) {
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

  // Part A — the values the modal opened with. Stored, not recomputed from `log`
  // on the fly: `log` is a prop the parent may re-create, and comparing against a
  // moving reference would make "dirty" mean "differs from whatever the parent
  // last rendered" rather than "differs from what I opened".
  const [snapshot, setSnapshot] = useState<EditFormSnapshot>(() => snapshotFromLog(null));
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const keepEditingRef = useRef<HTMLButtonElement>(null);

  // Part C — the suggestion strip's own in-flight/error state, kept separate from
  // the form's `saving`/`error`. They are two different writes to two different
  // routes: a failed ruling must not present as a failed row save, and vice versa.
  const [rulingBusy, setRulingBusy] = useState(false);
  const [rulingError, setRulingError] = useState<string | null>(null);
  // Karen HIGH-1. Without this a successful ruling changed nothing on screen: the
  // strip stayed live because the dialog's own `log` prop still carries
  // ai_review_pending=true (applyEditedLog deliberately does NOT touch
  // editingLog — that is what keeps the seeding effect from re-firing and
  // clobbering unsaved edits). A second click then hit the route's 409 and showed
  // an ERROR for an action that had already succeeded.
  const [ruledOutcome, setRuledOutcome] = useState<string | null>(null);

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

  // ONE mapping produces both the snapshot and the form's initial values — see the
  // docblock on lib/logs/edit-dirty.ts. Seeding the fields from `log` while
  // building the snapshot separately would be two transcriptions of the same
  // mapping, and they drift the moment a tenth field is added.
  useEffect(() => {
    if (!log) return;
    const snap = snapshotFromLog(log);
    setSnapshot(snap);
    setLogStatus(snap.logStatus);
    setSeverity(snap.severity);
    setWhoOwnsFix(snap.whoOwnsFix);
    setIssueCategory(snap.issueCategory);
    setIssueSubtype(snap.issueSubtype);
    setRootCauseFinal(snap.rootCauseFinal);
    setResolutionType(snap.resolutionType);
    setResolutionNotes(snap.resolutionNotes);
    setNotes(snap.notes);
    setError(null);
    // A stale confirm must never survive into a different log. Without this, the
    // prompt from a dismissed row reappears over the next row the admin opens.
    setConfirmDiscardOpen(false);
    setRulingError(null);
    setRuledOutcome(null);
  }, [log]);

  const isDirty = useMemo(
    () =>
      isFormDirty(snapshot, {
        logStatus,
        severity,
        whoOwnsFix,
        issueCategory,
        issueSubtype,
        rootCauseFinal,
        resolutionType,
        resolutionNotes,
        notes,
      }),
    [
      snapshot,
      logStatus,
      severity,
      whoOwnsFix,
      issueCategory,
      issueSubtype,
      rootCauseFinal,
      resolutionType,
      resolutionNotes,
      notes,
    ],
  );

  // Part C derived state. `suggestion` is null unless a ruling is actually
  // pending, which is what keeps the strip out of the DOM on the overwhelming
  // majority of rows (measured 2026-08-12: 0 of 122 pending).
  const suggestion = log?.ai_review_pending ? log.ai_suggested_root_cause ?? [] : null;
  // Reads the PERSISTED value, not the form state — the route's §13.1 re-check
  // reads the row, so mirroring the form here would disable the buttons for a user
  // who merely typed into the dropdown, and enable them in the one case the server
  // refuses.
  const rulingBlocked = isRulingBlocked(log?.root_cause_final ?? null);
  // Karen CRITICAL-1. Compared against the SNAPSHOT — "has the human touched the
  // field" — never against the suggestion. Selection guarantees the snapshot is
  // empty on every eligible row, so comparing to the suggestion made an untouched
  // form read as a correction and file `values: []`, which scores as 'rejected'.
  const primaryRuling = suggestionAction(rootCauseFinal, snapshot.rootCauseFinal);
  const primaryDisabled = suggestion
    ? isPrimaryRulingDisabled(primaryRuling, rootCauseFinal, suggestion)
    : true;
  const prose = log ? proseBlocks(log) : [];

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

  // ─── Part A — the dismiss guard ───
  //
  // Radix routes Esc, outside-click AND the built-in X (DialogPrimitive.Close in
  // components/ui/dialog.tsx:43) through a single onOpenChange(false). Intercepting
  // there covers three of the spec's four triggers with one branch; Cancel is wired
  // to the same requestClose below, so all four behave identically — which is what
  // "confirm on ANY dismiss when dirty" means and why this is not four handlers.
  function requestClose() {
    if (!isDirty) {
      onOpenChange(false);
      return;
    }
    setConfirmDiscardOpen(true);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    // Mid-save dismissal is refused outright rather than confirmed. The request is
    // already in flight, so "discard" would be a lie — the write lands either way.
    // Same posture as ConfirmDeleteDialog's `if (busy) return`.
    if (saving) return;
    requestClose();
  }

  function discardAndClose() {
    setConfirmDiscardOpen(false);
    onOpenChange(false);
  }

  // ─── Part C — file a ruling on the AI suggestion ───
  //
  // Posts to /api/admin/logs/ai-review, which per classifier §13.2 is the ONLY
  // writer of ai_review_pending = false. /api/logs/edit must never touch that
  // column, and the column is deliberately absent from its ALLOWED_FIELDS — which
  // is what makes C4's last row ("general row save → untouched") true by
  // construction rather than by discipline.
  //
  // The modal is NOT closed on success. The ruling settles one field; the admin is
  // usually here to fill in the others, and closing would throw away the rest of
  // their edits.
  async function handleRuling(action: 'confirm' | 'reject' | 'correct') {
    if (!log) return;
    setRulingBusy(true);
    setRulingError(null);
    try {
      const res = await fetch('/api/admin/logs/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_id: log.id,
          action,
          // Only `correct` carries values, and they are the modal's own dropdown
          // selection — the constrained, taxonomy-validated control. The route
          // re-validates against the active taxonomy anyway (r29).
          ...(action === 'correct' ? { values: rootCauseFinal } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The §13.1 409 is the interesting failure: the row gained a root cause
        // after the suggestion was made, so `detail` names the edit dialog as the
        // path — which is where the user already is. Surfaced verbatim rather than
        // flattened into a generic message.
        setRulingError(body?.detail ?? body?.error ?? `Could not record the review (${res.status}).`);
        return;
      }

      // What the ROUTE actually wrote — reject leaves root_cause_final untouched
      // and clears the suggestion; confirm/correct write the canonical field and
      // retain the suggestion (C4's table).
      const persistedRootCause = action === 'reject' ? log.root_cause_final : rootCauseFinal;

      // Reflect the write locally. The canonical field is now saved, so the
      // SNAPSHOT moves with it — otherwise the dismiss guard would count a value
      // the server already holds as an unsaved edit and prompt on close.
      //
      // ONLY root cause is patched. Any other unsaved edits stay dirty, because
      // they genuinely are: this route wrote one column, not the row.
      if (action !== 'reject') {
        setRootCauseFinal(rootCauseFinal);
        setSnapshot(prev => ({ ...prev, rootCauseFinal }));
      }

      // Spread `log`, NOT the form state. `log` is the last-known-PERSISTED row,
      // so the parent's table row picks up exactly what the route wrote and none
      // of the admin's still-unsaved edits to other fields.
      setRuledOutcome(typeof body?.outcome === 'string' ? body.outcome : action);

      onSaved({
        ...log,
        root_cause_final: persistedRootCause,
        ai_review_pending: false,
        ai_suggested_root_cause: action === 'reject' ? null : log.ai_suggested_root_cause,
        ai_confidence_band: action === 'reject' ? null : log.ai_confidence_band,
      });
    } catch (err) {
      setRulingError(err instanceof Error ? err.message : 'Could not record the review.');
    } finally {
      setRulingBusy(false);
    }
  }

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
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

            {/*
              ─── C3 — the AI suggestion strip ───
              Rendered DIRECTLY BELOW Root cause (final), because the field it
              proposes a value for is the thing to compare it against. This is the
              whole reason the surface moved off /dashboard/reports: one place a log
              is ever classified, and that page has no middleware admin gate.
            */}
            {suggestion ? (
              <div className="mt-3 rounded-lg border border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--f92-navy)]">
                    AI suggested root cause
                  </p>
                  {/*
                    A BAND, never a number. classifier §11.2 is locked: a float
                    invites a threshold and a threshold invites auto-confirm, the
                    failure mode §9 forbids. The raw model confidence is never
                    persisted, so there is nothing here to sort or filter on.
                  */}
                  {log?.ai_confidence_band ? (
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                        BAND_STYLE[log.ai_confidence_band],
                      )}
                    >
                      {CONFIDENCE_BAND_LABEL[log.ai_confidence_band]}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-sm font-medium text-[color:var(--f92-dark)]">
                  {suggestion.length > 0 ? suggestion.join(' · ') : '—'}
                </p>

                {/*
                  The prose the classifier READ — deliberately not "the field it
                  came from". No provenance is captured anywhere (the model returns
                  only root_causes + confidence), so naming one field would be a
                  guess wearing attribution's clothes. Resolved with Lacey.
                */}
                {prose.length > 0 ? (
                  <div className="mt-2 space-y-1.5 border-t border-[color:var(--f92-border)] pt-2">
                    <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
                      Prose the classifier read
                    </p>
                    {prose.map(block => (
                      <div key={block.label}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--f92-gray)]">
                          {block.label}
                        </p>
                        <p className="whitespace-pre-wrap text-xs text-[color:var(--f92-dark)]">
                          {block.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs italic text-[color:var(--f92-gray)]">
                    This log has no prose beyond its summary.
                  </p>
                )}

                {/*
                  §13.1 — should normally be absent, because selection excludes
                  rows that already carry a root cause. If it appears, r37's "a
                  non-empty Jira value still wins on sync" moved a value in between
                  classification and review, and the route will refuse both confirm
                  and correct (its re-check is `action !== 'reject'`). The UI must
                  not offer what the server refuses — the classifier batch's Karen
                  MEDIUM-2 shipped with Confirm disabled under a message saying
                  confirming was blocked, and Correct… enabled beside it.
                */}
                {rulingBlocked ? (
                  <div className="mt-2 rounded-md border border-[color:var(--pill-amber-border)] bg-[color:var(--pill-amber-bg)] p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--pill-amber-fg)]">
                      Already classified
                    </p>
                    <p className="mt-0.5 text-xs text-[color:var(--pill-amber-fg)]">
                      This log already has a saved root cause ({(log?.root_cause_final ?? []).join(' · ')}).
                      Confirming would overwrite it, so it is blocked. Reject still works, or edit the
                      field above and save the row normally.
                    </p>
                  </div>
                ) : null}

                {rulingError ? (
                  <p className="mt-2 text-xs text-red-600">{rulingError}</p>
                ) : null}

                {/*
                  Karen HIGH-1 — a successful ruling must SAY so. Previously the
                  strip stayed live and unchanged, because the dialog's `log` prop
                  still carries ai_review_pending=true: `applyEditedLog`
                  deliberately does not touch `editingLog`, which is what stops the
                  seeding effect re-firing and clobbering unsaved edits. So the
                  only honest signal is local, and without it a second click hit the
                  route's 409 and showed an ERROR for an action that had succeeded.
                */}
                {ruledOutcome ? (
                  <p
                    className="mt-2 rounded-md border border-[color:var(--pill-green-border)] bg-[color:var(--pill-green-bg)] px-2 py-1 text-xs text-[color:var(--pill-green-fg)]"
                    role="status"
                  >
                    Review recorded ({ruledOutcome}). The other fields on this row are still
                    unsaved — use Save changes below.
                  </p>
                ) : isAdmin ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {/*
                      ONE primary button whose meaning follows the dropdown, decided
                      by suggestionAction against the PRISTINE snapshot: untouched →
                      `confirm`, edited → `correct` carrying the human's values.
                      §3 C3 asks for two actions and §3 C4 lists three outcomes —
                      this is how both hold without a second value-picker competing
                      with the constrained dropdown.

                      The label changes with the action because the two record
                      DIFFERENT outcome shapes (§6), and the correction rate is this
                      batch's only validation — a correction filed as a confirm
                      would report the classifier as exactly right on a row where
                      the human changed the answer, and the inverse (Karen
                      CRITICAL-1) filed every acceptance as a rejection.
                    */}
                    <Button
                      size="sm"
                      disabled={rulingBusy || saving || rulingBlocked || primaryDisabled}
                      onClick={() => handleRuling(primaryRuling)}
                    >
                      {rulingBusy
                        ? 'Saving…'
                        : primaryRuling === 'confirm'
                          ? 'Confirm suggestion'
                          : 'Save correction'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={rulingBusy || saving}
                      onClick={() => handleRuling('reject')}
                    >
                      Reject
                    </Button>
                    <span className="text-[10px] text-[color:var(--f92-gray)]">
                      {primaryRuling === 'confirm'
                        ? 'Confirm writes the suggestion into Root cause (final).'
                        : rootCauseFinal.length === 0
                          ? 'Clearing the field is a rejection — use Reject to record it.'
                          : 'Your edit above will be saved as a correction.'}
                    </span>
                  </div>
                ) : (
                  /* Inert, never a disabled button (§13.8 / Pulse precedent). */
                  <p className="mt-2 text-xs italic text-[color:var(--f92-gray)]">
                    Reviewing AI suggestions is admin-only.
                  </p>
                )}
              </div>
            ) : null}
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
          {/* Cancel routes through the SAME guard as Esc / outside-click / X.
              An unguarded Cancel would be the one path that still loses work,
              and it is the path a user reaches for deliberately. */}
          <Button variant="outline" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || taxonomyLoading}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/*
      Discard confirmation — a NESTED Dialog, stacked over the edit modal per
      §13 r26 (drawer/dialog-on-dialog is supported and intentional; Radix owns
      the overlay z-index and focus trap).

      Nesting rather than an inline block inside the edit modal buys the Esc
      behaviour for free: Radix's dismissable-layer stack routes Esc to the
      TOPMOST layer only, so Esc here closes the confirm and leaves the edit
      modal open — which is exactly "keep editing". An inline block would have
      needed that case hand-written, and getting it wrong means Esc-at-the-prompt
      discards the work the prompt exists to protect.
    */}
    <Dialog open={confirmDiscardOpen} onOpenChange={next => { if (!next) setConfirmDiscardOpen(false); }}>
      <DialogContent
        className="max-w-md"
        // §1: "default focus on keep editing". Radix would otherwise focus the
        // first tabbable node, and DialogFooter is flex-col-reverse on mobile —
        // so DOM order and visual order disagree and "the first button" is not a
        // stable target. Focusing the ref makes the safe choice the default on
        // every breakpoint, rather than on the ones that happen to line up.
        onOpenAutoFocus={e => {
          e.preventDefault();
          keepEditingRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogDescription>
            This log has edits that have not been saved. Discarding closes the dialog and loses
            them.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button ref={keepEditingRef} variant="outline" onClick={() => setConfirmDiscardOpen(false)}>
            Keep editing
          </Button>
          <Button onClick={discardAndClose} className="bg-red-600 text-white hover:bg-red-700">
            Discard changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
