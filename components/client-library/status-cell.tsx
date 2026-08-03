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
 * The "this cell carries a note" marker (batch 3, spec §2.2).
 *
 * THE LOAD-BEARING PIECE OF THE BATCH. Before it, the only way to discover a
 * note was to hover cells one at a time — across ~1,300 of them, which is not a
 * discovery mechanism. The readout bar is how you READ a note; this is how you
 * FIND one.
 *
 * Absolutely positioned, so it costs no layout: the cell box does not move, row
 * rhythm is unchanged, and the parent button's 24x24 hit area (WCAG 2.5.8) is
 * untouched. `pointer-events-none` so the marker can never swallow a click or
 * break the parent's hover — it is decoration over a control.
 *
 * It DOES overlap the box (Karen LOW-2) — the positioning ancestor is the 24px
 * button, so the dot lands at x 17–23 / y 1–7 over the 19px box's rounded
 * top-right corner, occluding ~6px of it. Zero layout cost is not zero overlap.
 * That slightly erodes the shape channel batch 2's MEDIUM-2 fought for on `todo`
 * (dashed) and `blocked` (hatched); at this scale it should be fine, but it is an
 * eye-gate item rather than something a ratio can settle.
 *
 * WHY A HALOED DOT, AND WHY NO NEW TOKEN. The marker overlaps the cell box's
 * rounded top-right corner, so it sits over five different treatments in two
 * themes. A flat mark fails that in DARK: measured, a plain `--f92-dark` mark
 * over dark `blocked`'s amber stripes (#F59E0B, full-strength across the whole
 * box) is 1.74:1, and over dark `done`'s 1px BORDER (#34D399) 1.56:1 — both
 * under the 3:1 WCAG 1.4.11 asks of a non-text indicator. Precision matters
 * there (Karen LOW-3): `done`'s FILL is rgba(52,211,153,0.18), which composites
 * to ≈#224247 and would have measured 8.79:1 — it is the border arc in the dot's
 * path that fails, not the treatment's dominant area. In LIGHT a flat mark
 * already clears it (3.40:1 on both), so the halo is required by dark alone.
 *
 * The 1.5px halo fixes it structurally rather than by picking a luckier colour:
 * the eye judges the dot against its OWN ring, so the only contrast that must
 * hold is dot-vs-ring — `--f92-dark` on `--f92-surface`:
 *   light  #1A1A2E on #FFFFFF  = 17.06:1
 *   dark   #E2E8F0 on #1E2235  = 12.76:1
 * Both existing app-wide tokens, both already theme-correct, so this adds NO
 * token and needs no cross-app measurement sweep. It is also unmistakable for a
 * status: all five statuses are squares or a bar, none is a circle, and none
 * uses `--f92-dark`.
 *
 * ONE HONEST LIMIT (Karen's eye-gate item 4): on a BANDED row the td background
 * becomes --f92-tint, and in light that is #FEF6EE against the halo's #FFFFFF —
 * 1.07:1, so the halo effectively vanishes there. Harmless, because the dot is
 * still 15.95:1 on the tint itself; but "the ring is the card" is only true off
 * the band, and the marker on a banded row is a look-at-it item, not a measured
 * one.
 *
 * Static Tailwind classes, not inline `style`, deliberately: it keeps the
 * marker verifiable in the COMPILED stylesheet (spec §5) instead of only in the
 * JS bundle, and it cannot repeat 3363629 — an inline declaration silently
 * beating a `hover:` rule — because there is nothing inline to do the beating.
 */
export function NoteIndicator() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-px top-px h-1.5 w-1.5 rounded-full bg-[color:var(--f92-dark)] shadow-[0_0_0_1.5px_var(--f92-surface)]"
    />
  );
}

/**
 * The legend. Renders every declared status by mapping CELL_STATUSES, so a
 * sixth status appears here automatically instead of being silently
 * unexplained.
 *
 * The note entry (spec §2.5) is now real. It was deliberately absent in batch 2
 * — the mockup had one, but nothing rendered a note indicator then, and a
 * legend entry for an unrendered indicator would have been a lie. §2.2 landed
 * the indicator, so the converse now holds: shipping the marker without
 * explaining it would leave a dot in the corner of some cells and no way to
 * learn what it means.
 *
 * It sits AFTER the statuses and is visually separated, because it is not a
 * sixth status — it is an overlay that can appear on any of the five.
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

      <span className="inline-flex items-center gap-2 border-l border-[color:var(--f92-border)] pl-4 text-[11px] font-medium text-[color:var(--f92-gray)]">
        {/* The same COMPONENT the cells draw, so the legend cannot describe a
            marker the grid doesn't render.
            NOT the same geometry, though (Karen LOW-1): in the grid the
            positioning ancestor is the 24px button and the dot overhangs the
            box's corner; here it is a 13px wrapper equal to the box, so the dot
            sits fully inside and reads proportionally larger (~46% of the edge
            vs ~25%). An earlier version of this comment claimed "same corner
            position, box-sized to mirror a real cell" — the second half is
            true, the first is not, and the two marks will not look identical.
            Accepted: the legend's job is to teach "corner dot = note", which it
            does. Flagged for the eye-gate as the most likely thing to look off.
            The carrier is `todo` because the marker has to sit ON something to
            teach where it appears, and todo is the one treatment that is an
            empty outline — it shows the corner without a fill competing with
            the dot. It is not claiming notes belong to to-do cells; the label
            is "Has note", and the same swatch is two entries to the left. */}
        <span className="relative inline-flex h-[13px] w-[13px] items-center justify-center">
          <StatusCellBox status="todo" size={13} />
          <NoteIndicator />
        </span>
        Has note
      </span>
    </div>
  );
}
