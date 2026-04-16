import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'open' | 'in_progress' | 'blocked' | 'pending' | 'resolved';
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[color:var(--f92-gray)] text-white',
  critical: 'bg-[color:var(--severity-critical)] text-white',
  high: 'bg-[color:var(--severity-high)] text-white',
  medium: 'bg-[color:var(--severity-medium)] text-white',
  low: 'bg-[color:var(--severity-low)] text-white',
  open: 'bg-[color:var(--status-open)] text-white',
  in_progress: 'bg-[color:var(--status-in-progress)] text-white',
  blocked: 'bg-[color:var(--status-blocked)] text-white',
  pending: 'bg-[color:var(--status-pending-verification)] text-white',
  resolved: 'bg-[color:var(--status-resolved)] text-white',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider',
          variantStyles[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Badge.displayName = 'Badge';
