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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DIRECTIVE_STATUSES,
  DIRECTIVE_STATUS_LABEL,
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
  onRequestClose,
  onClose,
  onDirtyChange,
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
  /**
   * GUARDED dismissal — Esc and Cancel. The PAGE decides whether to prompt,
   * because it owns the other two close paths too (see onDirtyChange).
   */
  onRequestClose: () => void;
  /** UNGUARDED close, used only after a successful save — nothing is unsaved. */
  onClose: () => void;
  /**
   * Reports dirtiness UP so the page can guard closes it initiates (clicking a
   * cell dot, switching project). Called from the single update() below rather
   * than from an effect, so there is exactly one place dirtiness is computed and
   * exactly one place it is announced.
   */
  onDirtyChange: (dirty: boolean) => void;
}) {
  // ONE producer for both the snapshot and the initial field values (see
  // directive-edit-dirty.ts). The form seeds FROM the snapshot it stores.
  const [snapshot] = useState<DirectiveFormSnapshot>(() => snapshotFromDirective(directive));
  // ONE state object, not five. With five, "what is the current form?" had to be
  // reassembled at every use — and every new field is another chance to forget
  // one, after which dirtiness is computed over a stale subset and the guard
  // silently stops firing for that field.
  const [form, setForm] = useState<DirectiveFormSnapshot>(snapshot);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // THE single mutation path. Computes the next form, stores it, and announces
  // dirtiness in one step — so the page's copy cannot lag the strip's.
  function update(patch: Partial<DirectiveFormSnapshot>) {
    const next = { ...form, ...patch };
    setForm(next);
    onDirtyChange(isDirectiveFormDirty(snapshot, next));
  }

  // ⚠ THE PROJECT LOCK. Same predicate the route re-checks server-side, so the
  // two cannot disagree about whether a move is allowed OR about why. This side
  // is only a convenience: the page snapshots cells once per load, so a cell
  // edited elsewhere since then is invisible here. The route is the guarantee.
  const movability = useMemo(() => isDirectiveMovable(cells), [cells]);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  // ⚠ CLEAR THE PAGE'S DIRTY FLAG ON UNMOUNT — a MECHANISM, not another
  // enumerated path (Karen fold re-gate MEDIUM-2, path 8).
  //
  // This strip renders inside the matrix row map, gated on the row being in
  // `matrixRows`. So it can disappear with NO setter running at all: if the edited
  // directive falls out of the filtered set, its row unmounts.
  // `editingDirectiveId` then still points at a row that is not rendered, and
  // `editorDirty` STAYS TRUE — which re-creates HIGH-2(b)'s exact symptom by a
  // different route: the next cell-dot click raises "Discard your changes?" for an
  // editor that is not on screen, and "Keep editing" makes that click silently do
  // nothing.
  //
  // The page's path enumeration could not cover this, because its unit is
  // "something assigns editingDirectiveId" and nothing here does. Rather than add
  // paths 9, 10, 11… as they are discovered, clearing on unmount covers EVERY
  // disappearance including ones nobody has thought of yet — the same reason the
  // movability predicate is a conjunction rather than a list of known-bad cases.
  //
  // Redundant on the guarded paths (closeDirectiveEditor already cleared it) and
  // deliberately so: redundant-and-correct beats exhaustive-and-hopeful.
  //
  // ⚠ WHAT THIS DOES NOT DO: it does not save the edit, and it does not prompt.
  // An unmount still discards unsaved work.
  //
  // The DISCRETE-CLICK droppers are now guarded upstream — the Hide-archived
  // checkbox and the State / Status / Type tabs go through guardFilterChange,
  // which prompts only when the click would actually drop the edited row (Karen
  // gate MEDIUM-1). An earlier version of this comment claimed the keystroke
  // argument covered all of them; it covered one.
  //
  // SEARCH remains unguarded, and is now the ONLY way to lose an edit without
  // being asked: a confirm dialog per character is worse than the loss it
  // prevents. That is the whole of the remaining limitation.
  // ⚠ THE CLEANUP DOES NOT DEPEND ON `onDirtyChange`'s IDENTITY, and that is a
  // fix rather than a style choice (Karen gate LOW-1).
  //
  // Written as `useEffect(cleanup, [onDirtyChange])` it worked only because the
  // page happens to pass a bare `setEditorDirty`, whose identity React
  // guarantees. Wrap that prop in an inline arrow — `onDirtyChange={(d) =>
  // setEditorDirty(d)}`, the most ordinary edit imaginable — and the deps change
  // every render, so React runs the CLEANUP every render: a keystroke sets the
  // flag true, the re-render immediately clears it, and THE ENTIRE DIRTY GUARD
  // STOPS FIRING ON ALL EIGHT PATHS. With `exhaustive-deps` satisfied, tsc clean
  // and every test green.
  //
  // A comment naming the requirement would have been the weaker fix — the
  // mechanism claimed to cover "every disappearance including ones nobody has
  // thought of yet" while resting on an undocumented property of its caller. So
  // the latest callback goes in a ref and the cleanup depends on nothing: it now
  // runs on unmount and only on unmount, whatever the caller passes.
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);
  useEffect(() => {
    return () => {
      onDirtyChangeRef.current(false);
    };
  }, []);

  async function handleSave() {
    if (submitting) return;
    const body = directivePatchBody(snapshot, form);
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const failure = await onSave(body);
      if (failure === null) {
        // Saved: nothing is unsaved, so this closes UNGUARDED. Reporting
        // onDirtyChange(false) and then asking for a guarded close would race —
        // the page's state has not committed yet and it would prompt over a form
        // that matches the database.
        onDirtyChange(false);
        onClose();
      } else {
        setError(failure);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // When the page's confirm dialog is open, Radix traps focus inside it, so
    // this never fires and Esc reaches the dialog instead — which is what makes
    // "Esc at the prompt keeps editing" free rather than something to wire.
    if (e.key === 'Escape' && !submitting) {
      e.stopPropagation();
      onRequestClose();
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
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            className="h-8 text-sm"
            disabled={submitting}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]">
            Type
          </span>
          <Select
            value={form.directiveType}
            onValueChange={(v) => update({ directiveType: v as DirectiveType })}
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
            value={form.status}
            onValueChange={(v) => update({ status: v as DirectiveStatus })}
            disabled={submitting}
          >
            <SelectTrigger aria-label="Directive state" className="h-8 w-32 text-sm">
              <SelectValue />
            </SelectTrigger>
            {/* Mapped from DIRECTIVE_STATUSES, not hardcoded. Two hardcoded
                options were a second spelling of a closed set — the same defect
                CELL_STATUS_LABEL was consolidated to remove, and the reason
                directive_type above maps DIRECTIVE_TYPES. */}
            <SelectContent>
              {DIRECTIVE_STATUSES.map((st) => (
                <SelectItem key={st} value={st}>{DIRECTIVE_STATUS_LABEL[st]}</SelectItem>
              ))}
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
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
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
              value={form.projectKey}
              onValueChange={(v) => update({ projectKey: v })}
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
              {form.projectKey}
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
        <Button variant="outline" size="sm" onClick={onRequestClose} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {/* NO DIALOG HERE ANY MORE — the page owns it.
          It used to live in this component, which meant the guard covered only
          the two dismissals this component knows about (Esc, Cancel). The page
          closes the editor in three more places, and each of those called
          setEditingDirectiveId(null) DIRECTLY: clicking a cell dot, switching
          project, and the pulse:project nav event. So editing a title and then
          clicking any status dot discarded the edit with no prompt — the exact
          loss the guard exists to prevent, on the most natural interaction on
          the page. A guard that covers two of five paths is not a guard.
          Hoisting the dialog is what makes "one guard" true rather than stated. */}
    </div>
  );
}
