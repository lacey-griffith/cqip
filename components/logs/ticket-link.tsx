'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TicketLinkProps {
  ticketId: string;
  url: string | null | undefined;
  className?: string;
}

export function TicketLink({ ticketId, url, className }: TicketLinkProps) {
  if (!url) {
    return <span className={cn('font-medium text-[color:var(--f92-dark)]', className)}>{ticketId}</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex items-center gap-1 font-medium text-[color:var(--f92-orange)] hover:underline',
        className,
      )}
      aria-label={`${ticketId} — opens in Jira`}
    >
      {ticketId}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}
