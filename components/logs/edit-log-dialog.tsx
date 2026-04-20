'use client';

import { useEffect, useState } from 'react';
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

export interface EditableLog {
  id: string;
  jira_ticket_id: string;
  log_status: string;
  severity: string | null;
  who_owns_fix: string | null;
  notes: string | null;
  root_cause_final: string[] | null;
  resolution_notes: string | null;
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

function joinRootCause(value: string[] | null | undefined): string {
  return Array.isArray(value) ? value.join(', ') : '';
}

function splitRootCause(value: string): string[] | null {
  const parts = value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

export function EditLogDialog({ log, open, onOpenChange, onSaved }: EditLogDialogProps) {
  const [logStatus, setLogStatus] = useState('Open');
  const [severity, setSeverity] = useState<string>('');
  const [whoOwnsFix, setWhoOwnsFix] = useState('');
  const [rootCauseFinal, setRootCauseFinal] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!log) return;
    setLogStatus(log.log_status);
    setSeverity(log.severity || '');
    setWhoOwnsFix(log.who_owns_fix || '');
    setRootCauseFinal(joinRootCause(log.root_cause_final));
    setResolutionNotes(log.resolution_notes || '');
    setNotes(log.notes || '');
    setError(null);
  }, [log]);

  async function handleSave() {
    if (!log) return;
    setSaving(true);
    setError(null);

    try {
      const nextSeverity = severity === '' ? null : severity;
      const nextOwner = whoOwnsFix.trim() || null;
      const nextRootCause = splitRootCause(rootCauseFinal);
      const nextResolution = resolutionNotes.trim() || null;
      const nextNotes = notes.trim() || null;

      const updates = {
        log_status: logStatus,
        severity: nextSeverity,
        who_owns_fix: nextOwner,
        root_cause_final: nextRootCause,
        resolution_notes: nextResolution,
        notes: nextNotes,
      };

      const diffs: { field: string; oldValue: string | null; newValue: string | null }[] = [];
      const push = (field: string, before: unknown, after: unknown) => {
        const beforeStr = before == null ? null : Array.isArray(before) ? before.join(', ') : String(before);
        const afterStr = after == null ? null : Array.isArray(after) ? after.join(', ') : String(after);
        if (beforeStr !== afterStr) diffs.push({ field, oldValue: beforeStr, newValue: afterStr });
      };

      push('log_status', log.log_status, logStatus);
      push('severity', log.severity, nextSeverity);
      push('who_owns_fix', log.who_owns_fix, nextOwner);
      push('root_cause_final', log.root_cause_final, nextRootCause);
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
        root_cause_final: nextRootCause,
        resolution_notes: nextResolution,
        notes: nextNotes,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit log{log ? ` — ${log.jira_ticket_id}` : ''}</DialogTitle>
          <DialogDescription>
            Update status, severity, ownership, and notes. Changes are recorded in the audit log.
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
            <Label htmlFor="edit-root-cause">Root cause (final)</Label>
            <Input
              id="edit-root-cause"
              value={rootCauseFinal}
              onChange={e => setRootCauseFinal(e.target.value)}
              placeholder="Comma-separated values"
            />
            <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
              Comma-separated. Each item is stored as a separate entry.
            </p>
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

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
