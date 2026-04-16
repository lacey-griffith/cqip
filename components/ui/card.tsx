import * as React from 'react';
import { cn } from '@/lib/utils';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-[color:var(--f92-border)] bg-white p-6 shadow-sm',
        className,
      )}
      {...props}
    />
  );
}
