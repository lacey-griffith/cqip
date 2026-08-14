// Batch 012 — Pulse matrix: which background a grid cell paints (Part C).
//
// WHY THIS IS A FUNCTION AND NOT A TERNARY IN THE JSX. Three states can want a
// background on the same cell — the clicked-column highlight, the hover/focus
// crosshair, and neither — and getting their ORDER wrong is invisible to tsc, to
// ESLint and to the build. It is also the kind of thing that gets "tidied" into
// a layered className by someone who does not know the constraint below. Pulling
// it out means the precedence is stated once, shared by the header and the body
// (which previously each carried their own copy of a shorter chain), and pinned
// by tests that read the behaviour rather than the source that produces it.
//
// THE CONSTRAINT, which is the whole reason this returns ONE class and never
// two: every candidate is a plain `bg-*` utility at CSS specificity (0,1,0). If
// two were ever emitted on the same element the winner would be decided by
// Tailwind's EMISSION ORDER in the built stylesheet — not by the order they
// appear in the className string, and not by anything visible in this file. A
// chain that returns exactly one class is the only form that is
// order-independent. The batch-3 comments on the body cells record the same
// constraint; this is where it now lives.

export const BAND_HIGHLIGHT = 'bg-[color:var(--pulse-col-highlight)]';
export const BAND_CROSSHAIR = 'bg-[color:var(--f92-tint)]';
export const BAND_SURFACE = 'bg-[color:var(--f92-surface)]';
export const BAND_NONE = '';

export interface BandState {
  /** This column is the one the user clicked in the brand header. */
  highlighted: boolean;
  /** The hover/focus crosshair wants this cell (its row OR its column). */
  crosshair: boolean;
}

// PRECEDENCE: highlight > crosshair > fallback.
//
// The highlight wins because it is DELIBERATE and PERSISTENT while the crosshair
// is transient pointer feedback. With the order reversed, sweeping the pointer
// down a highlighted column would make that column appear to flicker between two
// treatments — the user's own explicit state being overridden by where their
// hand happens to be.
//
// `fallback` differs by caller and that is not incidental: a sticky header MUST
// paint an opaque background or body rows scroll visibly through it, while a
// body cell must stay transparent so the row band underneath it shows.
function band(state: BandState, fallback: string): string {
  if (state.highlighted) return BAND_HIGHLIGHT;
  if (state.crosshair) return BAND_CROSSHAIR;
  return fallback;
}

/** Header cell. Opaque fallback — it is sticky (Part B). */
export function headerBandClass(state: BandState): string {
  return band(state, BAND_SURFACE);
}

/** Body cell. Transparent fallback, so an unbanded cell shows the row through. */
export function cellBandClass(state: BandState): string {
  return band(state, BAND_NONE);
}
