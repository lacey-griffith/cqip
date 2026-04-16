import * as React from 'react';
import { cn } from '@/lib/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn('mb-2 block text-sm font-medium text-[color:var(--f92-dark)]', className)}
        {...props}
      />
    );
  },
);

Label.displayName = 'Label';
