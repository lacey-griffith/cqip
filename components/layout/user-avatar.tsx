'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export const AVATAR_PALETTE = [
  '#F47920', // Fusion92 orange
  '#1E2D6B', // Fusion92 navy
  '#DC2626', // red
  '#F97316', // coral / high-severity orange
  '#EAB308', // yellow
  '#16A34A', // green
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#10B981', // mint
] as const;

export const DEFAULT_AVATAR_COLOR = AVATAR_PALETTE[0];

export const AVATAR_PATTERNS = ['none', 'flowers', 'polka_dots', 'stripes'] as const;
export type AvatarPattern = (typeof AVATAR_PATTERNS)[number];

export const AVATAR_PATTERN_LABELS: Record<AvatarPattern, string> = {
  none: 'None',
  flowers: 'Flowers',
  polka_dots: 'Polka Dots',
  stripes: 'Diagonal Stripes',
};

export const DEFAULT_AVATAR_PATTERN: AvatarPattern = 'none';

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
  pattern?: AvatarPattern | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap: Record<NonNullable<UserAvatarProps['size']>, { px: number; fontSize: number }> = {
  sm: { px: 32, fontSize: 38 },
  md: { px: 40, fontSize: 38 },
  lg: { px: 80, fontSize: 36 },
};

function PatternDef({ id, pattern }: { id: string; pattern: AvatarPattern }) {
  if (pattern === 'polka_dots') {
    return (
      <pattern id={id} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="8" cy="8" r="2.4" fill="rgba(255,255,255,0.42)" />
      </pattern>
    );
  }
  if (pattern === 'stripes') {
    return (
      <pattern
        id={id}
        x="0"
        y="0"
        width="10"
        height="10"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect x="0" y="0" width="5" height="10" fill="rgba(255,255,255,0.3)" />
      </pattern>
    );
  }
  if (pattern === 'flowers') {
    return (
      <pattern id={id} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
        <g fill="rgba(255,255,255,0.38)">
          <circle cx="11" cy="4" r="2.2" />
          <circle cx="11" cy="18" r="2.2" />
          <circle cx="4" cy="11" r="2.2" />
          <circle cx="18" cy="11" r="2.2" />
        </g>
        <circle cx="11" cy="11" r="1.6" fill="rgba(255,255,255,0.7)" />
      </pattern>
    );
  }
  return null;
}

export function UserAvatar({
  displayName,
  color,
  pattern,
  size = 'md',
  className,
}: UserAvatarProps) {
  const initials = getInitials(displayName);
  const bg = color || DEFAULT_AVATAR_COLOR;
  const activePattern: AvatarPattern =
    pattern && (AVATAR_PATTERNS as readonly string[]).includes(pattern) ? pattern : 'none';
  const { px, fontSize } = sizeMap[size];
  const reactId = React.useId().replace(/[:]/g, '');
  const patternId = `avatar-pattern-${reactId}`;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      className={cn('select-none rounded-full', className)}
      role="img"
      aria-label={displayName ? `${displayName} avatar` : 'User avatar'}
    >
      {activePattern !== 'none' ? (
        <defs>
          <PatternDef id={patternId} pattern={activePattern} />
        </defs>
      ) : null}
      <circle cx="50" cy="50" r="50" fill={bg} />
      {activePattern !== 'none' ? (
        <circle cx="50" cy="50" r="50" fill={`url(#${patternId})`} />
      ) : null}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={600}
        fill="#FFFFFF"
        style={{ fontFamily: 'inherit' }}
      >
        {initials}
      </text>
    </svg>
  );
}
