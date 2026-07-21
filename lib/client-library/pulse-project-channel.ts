// Batch 012 — Pulse. Shared client-side channel for handing the selected
// project between the Pulse matrix page, the contextual client nav, and the
// brand page's return-context broadcast. NOT pure — it touches
// window/sessionStorage — so it lives beside pulse.ts rather than inside it
// (pulse.ts stays pure + unit-testable). Single source for the key + event so
// the page and nav can't drift (E1 had these duplicated with a "keep in sync"
// comment; this removes that debt).
//
// Mechanism (unchanged from E1): the matrix page can't expose its picked
// project via the URL (the shared nav can't use useSearchParams under
// statically-prerendered dashboard pages), so the project is handed off through
// sessionStorage (persists across navigation → the matrix seeds its initial
// pick from it) plus a CustomEvent (live update while the page is mounted).

export const PULSE_PROJECT_STORAGE_KEY = 'pulse:project';
export const PULSE_PROJECT_EVENT = 'pulse:project';

// Persist the pick WITHOUT dispatching the event. Use this from a producer that
// ALSO owns the matrix's project state directly (the matrix page itself) — it
// updates its own state in-line, so it must not round-trip through the event it
// listens to (that would fire a redundant second load, since the dispatch is
// synchronous and the listener's projectKey closure is still stale). Persisting
// keeps sessionStorage current for the next fresh mount.
export function writeStoredPulseProject(key: string): void {
  if (!key || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PULSE_PROJECT_STORAGE_KEY, key);
  } catch {
    // sessionStorage can throw in private modes — consumers then fall back to
    // their defaults; not worth surfacing.
  }
}

// Persist AND announce. Use this from a producer that does NOT own the matrix's
// state — the cross-project nav's group headers and the brand page — so a live
// matrix (already mounted, e.g. a same-URL header click) re-scopes via its
// listener, and sessionStorage still carries the pick across a fresh mount.
export function broadcastPulseProject(key: string): void {
  if (!key || typeof window === 'undefined') return;
  writeStoredPulseProject(key);
  window.dispatchEvent(new CustomEvent(PULSE_PROJECT_EVENT, { detail: key }));
}

export function readStoredPulseProject(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(PULSE_PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}
