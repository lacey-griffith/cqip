// Overlay badges for the Coverage pipeline table + drawer (Batch 010).
// Colors come from the per-theme --pill-* tokens in globals.css (§13 rule 25);
// no inline hex.

import { cn } from '@/lib/utils';
import { overlayKeyForTag, type OverlayKey } from '@/lib/coverage/pipeline-stages';

const OVERLAY_STYLE: Record<OverlayKey, { abbr: string; cls: string }> = {
  // Needs Info → blue, Troubleshooting → amber, On Hold → gray,
  // Awaiting Client Input → violet.
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
  awaiting_client_input: {
    abbr: 'ACI',
    cls: 'border-[color:var(--pill-aci-border)] bg-[color:var(--pill-aci-bg)] text-[color:var(--pill-aci-fg)]',
  },
};

// NOTE (Batch 005.2 commit 3): the Batch 010 overlay-toggle exports
// — OVERLAY_ACTIVE_CLASS, OverlayCountBadge, UntaggedCountBadge — were
// removed here. The Coverage Ledger redesign dropped the global overlay
// toggles in favor of per-stage status-tag chips rendered inline in the
// accordion, so nothing imported them anymore. TagBadge (below) is still
// consumed by the PipelineStageDrawer and stays.

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
