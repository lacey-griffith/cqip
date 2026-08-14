// Fixed-position placement for a portalled popover panel.
//
// Batch logs-page — Lacey smoke test 4.
//
// WHY A PORTAL AT ALL, and why this is not a spacing fix:
// The Combobox panel was `absolute` inside the component's own `relative` wrapper,
// so it was clipped by ANY ancestor that establishes a clipping context. On
// /dashboard/logs that ancestor is `overflow-hidden` on the collapsible filter body
// — which is **pre-existing** (present at f2f9511^:550, before this batch) and is
// load-bearing: it is what makes the `grid-rows-[0fr]→[1fr]` collapse animate
// instead of popping. Removing it breaks the animation; toggling it on `filtersOpen`
// breaks the transition. Neither is the right place to fix a popover that cannot
// escape its container.
//
// The sibling controls in that same row — Severity and Status — were never affected
// because shadcn's Select renders through `SelectPrimitive.Portal` (select.tsx:74).
// Brand was the only control in the row that did not portal. This makes Combobox
// behave like its neighbours rather than making the page accommodate it.
//
// The maths lives here, pure and tested, because a popover that renders offscreen
// or flips at the wrong moment is invisible to tsc, to ESLint and to every other
// check in this repo.

export interface PopoverRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

export interface PopoverPosition {
  top: number;
  left: number;
  width: number;
  placement: 'below' | 'above';
}

export const POPOVER_GAP = 4;

// Flips above the trigger when the panel would not fit below AND there is more room
// above. Both halves matter: on a short viewport neither side fits, and flipping to
// the side with LESS room would be strictly worse. Falls back to below, where the
// panel's own `max-height` keeps it on screen.
export function computePopoverPosition(
  trigger: PopoverRect,
  viewportHeight: number,
  panelHeight: number,
): PopoverPosition {
  const spaceBelow = viewportHeight - trigger.bottom - POPOVER_GAP;
  const spaceAbove = trigger.top - POPOVER_GAP;
  const flip = panelHeight > spaceBelow && spaceAbove > spaceBelow;

  return {
    // Clamped at 0 so a flipped panel taller than the space above cannot be
    // positioned off the top of the viewport, where it is unreachable entirely.
    top: flip
      ? Math.max(0, trigger.top - POPOVER_GAP - panelHeight)
      : trigger.bottom + POPOVER_GAP,
    left: trigger.left,
    // Width tracks the trigger so the portalled panel still reads as belonging to
    // it — `w-full` cannot do that once the panel is no longer a descendant.
    width: trigger.width,
    placement: flip ? 'above' : 'below',
  };
}
