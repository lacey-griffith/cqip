import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'bg-[color:var(--f92-orange)] text-white hover:bg-[#d9691d] focus:ring-offset-[color:var(--f92-white)] focus:ring-2 focus:ring-[color:var(--f92-navy)]',
  secondary:
    'bg-[color:var(--f92-navy)] text-white hover:bg-[#17264f] focus:ring-offset-[color:var(--f92-white)] focus:ring-2 focus:ring-[color:var(--f92-orange)]',
  outline:
    'border border-[color:var(--f92-border)] bg-white text-[color:var(--f92-dark)] hover:bg-[color:var(--f92-warm)]',
  ghost: 'bg-transparent text-[color:var(--f92-dark)] hover:bg-[color:var(--f92-warm)]',
};

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-11 px-5 py-2.5 text-sm',
  sm: 'h-9 px-3 rounded-md text-sm',
  lg: 'h-12 px-6 rounded-md text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
