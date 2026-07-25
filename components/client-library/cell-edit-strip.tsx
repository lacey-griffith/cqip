'use client';

// Batch 012 — Pulse. Shared inline cell status/note editor (admin only),
// extracted verbatim from the matrix page's local CellEditStrip so the matrix
// and the per-brand page render the same editor. Decoupled from either page's
// row types: it takes only a brand LABEL + directive title + the initial
// status/note, and reports the new values via onSave. Already single-brand
// shaped (no brand-picker) — the brand page uses it as-is.
//
// Mount it keyed per cell upstream (so useState initializers seed from the
// cell — no seeding effect). Save delegates to the parent's optimistic handler
// (see lib/client-library/directive-cell-save.ts); the PATCH is unchanged.
// Esc collapses. This is the E3 seam — E3 enriches this container with
// comments / timeline / lifecycle dates.

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CELL_STATUSES, type CellStatus } from '@/lib/client-library/directives';

const STATUS_LABEL: Record<CellStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
  n_a: 'N/A',
};

export function CellEditStrip({
  brandLabel,
  directiveTitle,
  initialStatus,
  initialNote,
  onSave,
  onCancel,
}: {
  brandLabel: string;
  directiveTitle: string;
  initialStatus: CellStatus;
  initialNote: string | null;
  onSave: (status: CellStatus, note: string | null) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<CellStatus>(initialStatus);
  const [note, setNote] = useState(initialNote ?? '');
  const [submitting, setSubmitting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Move focus into the strip on open so Esc works immediately and screen
  // readers announce it. Ref focus, not setState — the set-state-in-effect
  // rule doesn't apply. Runs once (keyed remount per cell).
  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  async function handleSave() {
    if (submitting) return;
    setSubmitting(true);
    // Parent applies the optimistic update + collapses this strip; if it
    // throws we still release the button.
    try {
      await onSave(status, note.trim() || null);
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && !submitting) onCancel();
  }

  // Compact single-row editor: brand context inline, then status + note + the
  // Save/Cancel buttons on one line (wraps only on a narrow viewport). Visible
  // field labels are dropped for height — the controls carry aria-labels +
  // placeholders instead. The note is a single-line Input.
  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      aria-label={`Edit ${brandLabel} — ${directiveTitle}`}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--f92-border)] bg-[color:var(--f92-surface)] px-3 py-2 focus:outline-none"
    >
      <span
        className="shrink-0 text-xs font-medium text-[color:var(--f92-dark)]"
        title={directiveTitle}
      >
        {brandLabel}
      </span>
      <Select value={status} onValueChange={(v) => setStatus(v as CellStatus)}>
        <SelectTrigger aria-label="Status" className="h-8 w-36 shrink-0 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CELL_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label="Note (optional)"
        placeholder="Note (optional)"
        className="h-8 min-w-[10rem] flex-1 text-sm"
      />
      <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting}>Cancel</Button>
      <Button size="sm" onClick={handleSave} disabled={submitting}>
        {submitting ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
