// Batch 012 restyle — the Pulse cell visual, in ONE place.
//
// Both surfaces render a cell status (the matrix's grid, the brand page's row
// dot) and the new legend explains them. Those three MUST agree, so the shape
// lives here rather than being described three times — the same structural
// argument that collapsed three copies of CELL_STATUS_LABEL into one.
//
// DESIGN: the mockup's rounded squares replace the old dots. Each status differs
// in SHAPE/FILL PATTERN as well as hue — solid, half-filled, dashed, hatched,
// bar — so colour is never the sole channel carrying the status (WCAG 1.4.1).
// n_a is a thin bar, never a filled box: it is the "not applicable" state and
// should not read as a box awaiting work.
//
// COLOURS come from the --cell-* tokens (commit cc95b7a): light values derived
// F92-conformant at ≥3:1 on the card, dark values the mockup's verbatim. ZERO
// inline hex.
//
// WHY inline `style` is safe on the box (given 3363629): that regression was an
// inline declaration beating a Tailwind `hover:` rule on the SAME element. The
// box carries no hover rule — the hover/focus ring lives on the parent <button>
// in the page — and gradients referencing CSS vars are impractical as Tailwind
// arbitrary values. Do NOT add a hover: utility to this element; put it on the
// parent, as both pages do.

import type { CellStatus } from '@/lib/client-library/directives';
import { CELL_STATUS_LABEL, CELL_STATUSES } from '@/lib/client-library/directives';

// Per-status token pair. `hue` is the solid colour (border / bar / legend),
// `fill` the pale interior.
const TOKEN: Record<CellStatus, { hue: string; fill: string }> = {
  todo: { hue: 'var(--cell-todo)', fill: 'var(--cell-todo-fill)' },
  in_progress: { hue: 'var(--cell-progress)', fill: 'var(--cell-progress-fill)' },
  done: { hue: 'var(--cell-done)', fill: 'var(--cell-done-fill)' },
  blocked: { hue: 'var(--cell-blocked)', fill: 'var(--cell-blocked-fill)' },
  n_a: { hue: 'var(--cell-na)', fill: 'var(--cell-na-fill)' },
};

/**
 * The cell box's own style, at a given edge length.
 * `emphasis` brightens the treatment for the row/cell under the cursor or open
 * for edit — the mockup's `hot` state.
 */
export function cellBoxStyle(
  status: CellStatus,
  size: number,
  emphasis = false,
): React.CSSProperties {
  const { hue, fill } = TOKEN[status];
  const radius = Math.max(2, Math.round(size / 3.8));
  const base: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: `${radius}px`,
    boxSizing: 'border-box',
  };
  switch (status) {
    case 'done':
      // Solid-ish: filled + a continuous border.
      return { ...base, background: fill, border: `1px solid ${hue}`, opacity: emphasis ? 1 : 0.92 };
    case 'in_progress':
      // Half-filled from the bottom — reads as "partway".
      //
      // The half uses the FULL-STRENGTH hue, not the pale fill (Karen MEDIUM-2).
      // Measured: with the pale fill, the half/empty boundary was ~1.15:1 in
      // light — imperceptible, which collapsed the shape channel and left hue
      // doing all the work. At full strength the boundary is the hue's own
      // contrast (4.10:1), so "half-filled" is actually legible as a shape.
      return {
        ...base,
        border: `1px solid ${hue}`,
        background: `linear-gradient(to top, ${hue} 50%, transparent 50%)`,
        opacity: emphasis ? 1 : 0.92,
      };
    case 'todo':
      // Empty + DASHED: nothing has happened yet. The dash is a border-level
      // signal, so it was already the strongest shape cue of the five — it is
      // what rescues to-do vs in-progress, whose hues are near-identical under
      // deuteranopia.
      return { ...base, border: `1px dashed ${hue}`, background: 'transparent' };
    case 'blocked':
      // Hatched — visually "obstructed".
      //
      // Same full-strength change as in_progress, and here it matters most: DONE
      // and BLOCKED are semantically opposite, are the two that drive action, and
      // their light hues are a deuteranope confusion pair (~1.16:1 apparent).
      // With a ~1.15:1 hatch nothing distinguished them but colour. At full
      // strength the stripes read as stripes, so the shape channel genuinely
      // carries the distinction rather than merely claiming to.
      return {
        ...base,
        border: `1px solid ${hue}`,
        background: `repeating-linear-gradient(45deg, ${hue} 0 2px, transparent 2px 5px)`,
        opacity: emphasis ? 1 : 0.92,
      };
    case 'n_a':
    default:
      // A bar, not a box. Deliberately the odd shape out.
      return {
        width: `${Math.round(size * 0.6)}px`,
        height: '2px',
        borderRadius: '1px',
        background: hue,
        opacity: emphasis ? 1 : 0.75,
      };
  }
}

/**
 * The cell box. Purely presentational — the interactive element (and its
 * hover/focus ring) is always the caller's <button>, per the 5870dae contract
 * that the DOT is the edit target.
 */
export function StatusCellBox({
  status,
  size = 19,
  emphasis = false,
}: {
  status: CellStatus;
  size?: number;
  emphasis?: boolean;
}) {
  // n_a is a bar inside a box-sized slot, so the grid stays aligned.
  if (status === 'n_a') {
    return (
      <span
        className="inline-flex items-center justify-center"
        style={{ width: `${size}px`, height: `${size}px` }}
        aria-hidden="true"
      >
        <span style={cellBoxStyle('n_a', size, emphasis)} />
      </span>
    );
  }
  return <span style={cellBoxStyle(status, size, emphasis)} aria-hidden="true" />;
}

/**
 * The legend. NEW this batch — there was none, so the shapes were unexplained.
 * Renders every declared status by mapping CELL_STATUSES, so a sixth status
 * appears here automatically instead of being silently unexplained.
 *
 * Deliberately does NOT include a "has note" swatch: the mockup has one, but
 * cell notes stay invisible on the matrix this batch (the hover-inspect readout
 * is batch 3), and a legend entry for an indicator that isn't rendered would be
 * a lie.
 */
export function StatusLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
      aria-label="Cell status legend"
    >
      {CELL_STATUSES.map((s) => (
        <span
          key={s}
          className="inline-flex items-center gap-2 text-[11px] font-medium text-[color:var(--f92-gray)]"
        >
          <span className="inline-flex h-[13px] w-[13px] items-center justify-center">
            <StatusCellBox status={s} size={13} />
          </span>
          {CELL_STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}
