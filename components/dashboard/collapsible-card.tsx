'use client';

import { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export function CollapsibleCard({
  title,
  defaultOpen = true,
  children,
  className,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card
      className={cn(
        'border-[color:var(--f92-border)] bg-white shadow-sm transition-[padding] duration-300 ease-in-out',
        open ? 'p-4 md:p-5' : 'px-5 py-3',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full cursor-pointer items-center justify-between text-left"
        aria-expanded={open}
      >
        <h3 className="cqip-section-title text-sm font-semibold text-[color:var(--f92-navy)]">
          {title}
        </h3>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-[color:var(--f92-gray)] transition-transform duration-300',
            open ? 'rotate-0' : '-rotate-90',
          )}
          aria-hidden="true"
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </Card>
  );
}
