'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TicketLinkProps {
  ticketId: string;
  url: string | null | undefined;
  title?: string | null;
  className?: string;
}

export function TicketLink({ ticketId, url, title, className }: TicketLinkProps) {
  if (!title) {
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

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span
        className="font-medium text-[color:var(--f92-dark)] leading-snug"
        title={title}
      >
        {title}
      </span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[color:var(--f92-orange)] hover:underline"
          aria-label={`${ticketId} — opens in Jira`}
        >
          {ticketId}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      ) : (
        <span className="text-xs text-[color:var(--f92-gray)]">{ticketId}</span>
      )}
    </div>
  );
}
