'use client';

// Batch 012 — Pulse directive CRUD. In-place row editor for ONE directive.
// Spec: docs/batch-012-directive-crud-spec.md §3, §4.4.
//
// Renders as a full-width expansion row under the directive it edits, the same
// container shape as CellEditStrip — so the two editors read as one pattern and
// only one is ever open.
//
// Mount it KEYED per directive upstream, so the useState initializers seed from
// the snapshot and there is no seeding effect to go stale.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DIRECTIVE_TYPES,
  isDirectiveMovable,
  type DirectiveStatus,
  type DirectiveType,
  type MovabilityCell,
} from '@/lib/client-library/directives';
import {
  directivePatchBody,
  isDirectiveFormDirty,
  snapshotFromDirective,
  type DirectiveFormSnapshot,
  type DirectiveSnapshotSource,
} from '@/lib/client-library/directive-edit-dirty';

export function DirectiveEditStrip({
  directive,
  typeLabel,
  projectOptions,
  cells,
  onSave,
  onClose,
}: {
  directive: DirectiveSnapshotSource;
  typeLabel: Record<DirectiveType, string>;
  /** Active projects only — the route rejects inactive ones, so never offer them. */
  projectOptions: { key: string; label: string }[];
  /** This directive's FULL cell set. Drives the project_key lock. */
  cells: MovabilityCell[];
  /**
   * Returns null on success, or the failure message to render INLINE. A string
   * rather than a boolean because the route's 409s are the informative part —
   * "N brand cells have been edited", "a directive titled X already exists" —
   * and a toast that disappears is the wrong surface for a message the user has
   * to act on while the form is still open.
   */
  onSave: (body: Record<string, string | null>) => Promise<string | null>;
  onClose: () => void;
}) {
  // ONE producer for both the snapshot and the initial field values (see
  // directive-edit-dirty.ts). The form seeds FROM the snapshot it stores.
  const [snapshot] = useState<DirectiveFormSnapshot>(() => snapshotFromDirective(directive));
  const [title, setTitle] = useState(snapshot.title);
  const [description, setDescription] = useState(snapshot.description);
  const [directiveType, setDirectiveType] = useState<DirectiveType>(snapshot.directiveType);
  const [status, setStatus] = useState<DirectiveStatus>(snapshot.status);
  const [projectKey, setProjectKey] = useState(snapshot.projectKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current: DirectiveFormSnapshot = { title, description, directiveType, status, projectKey };
  const isDirty = isDirectiveFormDirty(snapshot, current);

  // ⚠ THE PROJECT LOCK. Same predicate the route re-checks server-side, so the
  // two cannot disagree about whether a move is allowed OR about why. This side
  // is only a convenience: the page snapshots cells once per load, so a cell
  // edited elsewhere since then is invisible here. The route is the guarantee.
  const movability = useMemo(() => isDirectiveMovable(cells), [cells]);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  // ONE close path. Esc, Cancel and the caller's outside-click all route here,
  // so the guard cannot be true of one dismissal and false of another.
  function requestClose() {
    if (submitting) return;
    if (!isDirty) {
      onClose();
      return;
    }
    setConfirmDiscard(true);
  }

  async function handleSave() {
    if (submitting) return;
    const body = directivePatchBody(snapshot, current);
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const failure = await onSave(body);
      if (failure === null) onClose();
      else setError(failure);
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Only when the confirm is closed. With it open, Radix routes Esc to the
    // topmost layer (the Dialog) and this never fires — which is what makes
    // "Esc at the prompt keeps editing" free rather than something to wire.
    if (e.key === 'Escape' && !confirmDiscard) {
      e.stopPropagation();
      requestClose();
    }
  }

  const canMove = movability.movable;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      aria-label={`Edit directive ${snapshot.title}`}
      className="flex flex-col gap-3 rounded-lg border border-[color:var(--f92-border)] bg-[color:var(--f92-surface)] px-3 py-3 focus:outline-none"
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]">
            Title
          </span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-sm"
            disabled={submitting}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]">
            Type
          </span>
          <Select
            value={directiveType}
            onValueChange={(v) => setDirectiveType(v as DirectiveType)}
            disabled={submitting}
          >
            <SelectTrigger aria-label="Directive type" className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTIVE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{typeLabel[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]">
            State
          </span>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as DirectiveStatus)}
            disabled={submitting}
          >
            <SelectTrigger aria-label="Directive state" className="h-8 w-32 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]">
            Description
          </span>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            className="h-8 text-sm"
            disabled={submitting}
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]">
            Project
          </span>
          {canMove ? (
            <Select
              value={projectKey}
              onValueChange={setProjectKey}
              disabled={submitting}
            >
              <SelectTrigger aria-label="Project" className="h-8 w-40 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projectOptions.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            // Inert markup, NEVER <button disabled> — a disabled control is
            // skippable by some screen-reader configurations, and there is
            // nothing here to operate. The reason comes from the SAME function
            // the route's 409 uses, so the two cannot describe the block
            // differently.
            <span
              className="flex h-8 w-40 items-center rounded-md border border-dashed border-[color:var(--f92-border)] px-2 text-sm text-[color:var(--f92-gray)]"
              title={movability.reason ?? undefined}
            >
              {projectKey}
            </span>
          )}
        </div>
      </div>

      {!canMove ? (
        <p className="text-xs text-[color:var(--f92-gray)]">
          {movability.reason} Archive it and create a replacement in the other project if it
          really needs to move.
        </p>
      ) : null}

      {error ? (
        <p className="text-xs font-medium text-[color:var(--status-blocked)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={requestClose} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {/* NESTED Dialog (§13 r26). Radix keeps one dismissable-layer stack keyed
          on mount order, so Esc goes to this prompt and NOT to the editor
          underneath — "Esc at the prompt keeps editing" comes free. */}
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard your changes?</DialogTitle>
            <DialogDescription>
              This directive has unsaved edits. Closing now loses them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
