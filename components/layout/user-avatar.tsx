'use client';

import { cn } from '@/lib/utils';

export const AVATAR_PALETTE = [
  '#F47920', // Fusion92 orange
  '#1E2D6B', // Fusion92 navy
  '#DC2626', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#16A34A', // green
  '#3B82F6', // blue
  '#8B5CF6', // purple
] as const;

export const DEFAULT_AVATAR_COLOR = AVATAR_PALETTE[0];

export function getInitials(displayName: string | null | undefined): string {
  if (!displayName) return '?';
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UserAvatarProps {
  displayName?: string | null;
  color?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-20 w-20 text-2xl',
};

export function UserAvatar({ displayName, color, size = 'md', className }: UserAvatarProps) {
  const initials = getInitials(displayName);
  const bg = color || DEFAULT_AVATAR_COLOR;

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold text-white select-none',
        sizeClasses[size],
        className,
      )}
      style={{ backgroundColor: bg }}
      aria-label={displayName ? `${displayName} avatar` : 'User avatar'}
    >
      {initials}
    </div>
  );
}
