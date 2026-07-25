// Batch 012 — Pulse. Shared optimistic-save + reconcile-on-error orchestration
// for a directive/brand matrix cell. Extracted from the matrix page's inline
// `handleCellSave` so BOTH the matrix (dashboard/pulse/page.tsx) and the
// per-brand page ([projectKey]/[brandCode]/page.tsx) call the exact same
// PATCH + toast + reconcile logic — defined once, not duplicated.
//
// The two genuinely page-specific bits are injected as callbacks:
//   - applyOptimistic: how the page mutates its own local cell state
//     (the matrix keys its cell array, the brand page keys its own) + any
//     UI transition (e.g. collapse the open editor).
//   - reconcile: how the page reloads server truth to revert a failed
//     optimistic change (matrix reloads the project; the brand page re-fetches).
//
// The PATCH endpoint (/api/admin/directives/status) and the toast semantics
// are the shared core. `fetchFn` is injectable for tests; it defaults to the
// global fetch.

import type { CellStatus } from './directives';

// Minimal identity of the cell to save — the PATCH route resolves the row by
// the unique (directive_id, brand_id) pair, so an `id` is not required.
export interface DirectiveCellTarget {
  directive_id: string;
  brand_id: string;
}

export interface DirectiveCellSaveCallbacks {
  /** Mutate local state optimistically + any UI transition (e.g. close editor). */
  applyOptimistic: (target: DirectiveCellTarget, status: CellStatus, note: string | null) => void;
  /** Reload server truth to revert the optimistic change after a failed save. */
  reconcile: () => void;
  /** Surface a user-facing message. */
  toast: (message: string) => void;
  /** Injectable for tests; defaults to global fetch. */
  fetchFn?: typeof fetch;
}

// Shape of the /api/admin/directives/status PATCH response we care about.
interface StatusPatchResult {
  ok?: boolean;
  error?: string;
  changed?: number;
  auditError?: string;
}

/**
 * Optimistically apply a cell status/note change, PATCH it, and reconcile on
 * failure. `note` must already be normalized by the caller (trim || null).
 * Never throws — all outcomes are surfaced via `toast` and, on failure,
 * `reconcile`.
 */
export async function saveDirectiveCell(
  target: DirectiveCellTarget,
  status: CellStatus,
  note: string | null,
  cb: DirectiveCellSaveCallbacks,
): Promise<void> {
  cb.applyOptimistic(target, status, note);

  const doFetch = cb.fetchFn ?? fetch;
  try {
    const res = await doFetch('/api/admin/directives/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directive_id: target.directive_id,
        brand_id: target.brand_id,
        status,
        note,
      }),
    });
    const result: StatusPatchResult = await res.json().catch(() => ({}));
    if (!res.ok || !result.ok) {
      cb.toast(`❌ ${result.error ?? `Save failed (${res.status})`}`);
      cb.reconcile(); // revert the optimistic change
      return;
    }
    if (result.auditError) {
      cb.toast('⚠️ Saved, but audit write failed');
    } else if ((result.changed ?? 0) === 0) {
      cb.toast('No changes');
    } else {
      cb.toast('✅ Updated');
    }
  } catch (err) {
    cb.toast(`❌ ${err instanceof Error ? err.message : String(err)}`);
    cb.reconcile();
  }
}
