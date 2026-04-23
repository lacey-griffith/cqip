'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TicketLinkProps {
  ticketId: string;
  url: string | null | undefined;
  title?: string | null;
  brand?: string | null;
  onTitleClick?: () => void;
  className?: string;
}

export function TicketLink({ ticketId, url, title, brand, onTitleClick, className }: TicketLinkProps) {
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

  const brandLabel = brand?.trim() ? brand.trim() : null;
  const titleClassName = 'font-medium text-[color:var(--f92-dark)] leading-snug text-left';

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {onTitleClick ? (
        <button
          type="button"
          onClick={onTitleClick}
          className={cn(titleClassName, 'hover:underline focus-visible:outline-none focus-visible:underline')}
          title={title}
        >
          {title}
        </button>
      ) : (
        <span className={titleClassName} title={title}>
          {title}
        </span>
      )}
      <div className="flex items-center gap-2 text-xs">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[color:var(--f92-orange)] hover:underline"
            aria-label={`${ticketId} — opens in Jira`}
          >
            {ticketId}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-[color:var(--f92-gray)]">{ticketId}</span>
        )}
        {brandLabel ? (
          <>
            <span className="text-[color:var(--f92-lgray)]" aria-hidden="true">•</span>
            <span className="font-medium text-[color:var(--f92-navy)]">{brandLabel}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
