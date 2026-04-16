import * as React from 'react';
import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-md border border-[color:var(--f92-border)] bg-white px-3 py-2 text-sm text-[color:var(--f92-dark)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]',
          className,
        )}
        {...props}
      />
    );
  },
);

Select.displayName = 'Select';
