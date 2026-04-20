import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[96px] w-full rounded-md border border-[color:var(--f92-border)] bg-white px-3 py-2 text-sm text-[color:var(--f92-dark)] shadow-sm placeholder:text-[color:var(--f92-lgray)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = 'Textarea';
