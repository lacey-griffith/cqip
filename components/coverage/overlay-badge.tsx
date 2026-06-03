// Overlay badges for the Coverage pipeline table + drawer (Batch 010).
// Colors come from the per-theme --pill-* tokens in globals.css (§13 rule 25);
// no inline hex.

import { cn } from '@/lib/utils';
import { OVERLAY_LABELS, overlayKeyForTag, type OverlayKey } from '@/lib/coverage/pipeline-stages';

const OVERLAY_STYLE: Record<OverlayKey, { abbr: string; cls: string }> = {
  // Needs Info → blue, Troubleshooting → amber, On Hold → gray.
  needs_info: {
    abbr: 'NI',
    cls: 'border-[color:var(--pill-blue-border)] bg-[color:var(--pill-blue-bg)] text-[color:var(--pill-blue-fg)]',
  },
  troubleshooting: {
    abbr: 'TS',
    cls: 'border-[color:var(--pill-amber-border)] bg-[color:var(--pill-amber-bg)] text-[color:var(--pill-amber-fg)]',
  },
  on_hold: {
    abbr: 'OH',
    cls: 'border-[color:var(--pill-gray-border)] bg-[color:var(--pill-gray-bg)] text-[color:var(--pill-gray-fg)]',
  },
};

// Active-state classes for the control-bar overlay toggle chips, so the chip
// adopts the same color as the badges it switches on. Inactive chips render
// neutral (handled by the caller).
export const OVERLAY_ACTIVE_CLASS: Record<OverlayKey, string> = {
  needs_info: OVERLAY_STYLE.needs_info.cls,
  troubleshooting: OVERLAY_STYLE.troubleshooting.cls,
  on_hold: OVERLAY_STYLE.on_hold.cls,
};

// Compact count badge rendered next to a pipeline stage count when its
// overlay toggle is on. Abbreviation + count; full label in the tooltip.
export function OverlayCountBadge({ overlayKey, count }: { overlayKey: OverlayKey; count: number }) {
  const s = OVERLAY_STYLE[overlayKey];
  return (
    <span
      title={`${OVERLAY_LABELS[overlayKey]}: ${count}`}
      className={cn(
        'inline-flex items-center gap-0.5 rounded border px-1 text-[10px] font-semibold leading-tight',
        s.cls,
      )}
    >
      {s.abbr} {count}
    </span>
  );
}

// Full-text tag chip for the stage drawer. Overlay tags get their color;
// any other CRO Label value (Deployment, Awaiting client input, …) renders
// neutral gray.
export function TagBadge({ tag }: { tag: string }) {
  const key = overlayKeyForTag(tag);
  const cls = key
    ? OVERLAY_STYLE[key].cls
    : 'border-[color:var(--pill-gray-border)] bg-[color:var(--pill-gray-bg)] text-[color:var(--pill-gray-fg)]';
  return (
    <span className={cn('inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium', cls)}>
      {tag}
    </span>
  );
}
