'use client';

// Pipeline stage drawer (Batch 010, Step 6). Opens when a pipeline count is
// clicked; lists that brand's live Jira tickets in that stage with a Jira
// link, title, CRO-Label tag badges, and approximate age in stage.
//
// This is NOT LogDetailDrawer (that renders quality_logs). These are live
// Jira tickets from the GET /api/coverage/pipeline response. Built on the
// shared Sheet so it stacks correctly over BrandDetailDrawer (§13 rule 26).

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { TagBadge } from '@/components/coverage/overlay-badge';
import type { PipelineTicket } from '@/lib/coverage/pipeline-stages';

interface PipelineStageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandLabel: string;
  stageLabel: string;
  tickets: PipelineTicket[];
}

export function PipelineStageDrawer({
  open,
  onOpenChange,
  brandLabel,
  stageLabel,
  tickets,
}: PipelineStageDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {brandLabel} · {stageLabel}
          </SheetTitle>
          <SheetDescription>
            {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'} in stage
          </SheetDescription>
        </SheetHeader>

        {tickets.length === 0 ? (
          <p className="mt-6 text-sm text-[color:var(--f92-gray)]">No tickets in this stage.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {tickets.map((t) => (
              <li
                key={t.key}
                className="rounded-xl border border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[color:var(--f92-navy)] hover:underline"
                  >
                    {t.key}
                  </a>
                  <span
                    className="shrink-0 text-xs text-[color:var(--f92-gray)]"
                    title="Approx. age in stage (status-category change date)"
                  >
                    {t.age_label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[color:var(--f92-dark)]">{t.summary}</p>
                {t.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
