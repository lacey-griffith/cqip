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

export const AVATAR_PATTERNS = [
  'none',
  'polka_dots',
  'stripes',
  'squiggles',
  'checkered',
  'spirals',
  'cheetah',
] as const;
export type AvatarPattern = (typeof AVATAR_PATTERNS)[number];

export const AVATAR_PATTERN_LABELS: Record<AvatarPattern, string> = {
  none: 'None',
  polka_dots: 'Polka Dots',
  stripes: 'Diagonal Stripes',
  squiggles: 'Squiggles',
  checkered: 'Checkered',
  spirals: 'Spirals',
  cheetah: 'Cheetah',
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
  if (pattern === 'squiggles') {
    return (
      <pattern id={id} x="0" y="0" width="20" height="14" patternUnits="userSpaceOnUse">
        <path
          d="M0 7 Q 5 0, 10 7 T 20 7"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </pattern>
    );
  }
  if (pattern === 'checkered') {
    return (
      <pattern id={id} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="7" height="7" fill="rgba(255,255,255,0.32)" />
        <rect x="7" y="7" width="7" height="7" fill="rgba(255,255,255,0.32)" />
      </pattern>
    );
  }
  if (pattern === 'spirals') {
    return (
      <pattern id={id} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
        <path
          d="M12 12 m-6 0 a6 6 0 1 1 12 0 a6 6 0 1 1 -10 0 a4 4 0 1 1 8 0 a4 4 0 1 1 -6 0"
          fill="none"
          stroke="rgba(255,255,255,0.42)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </pattern>
    );
  }
  if (pattern === 'cheetah') {
    return (
      <pattern id={id} x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
        <g fill="rgba(0,0,0,0.32)">
          <ellipse cx="6" cy="6" rx="2.6" ry="2" />
          <ellipse cx="20" cy="10" rx="2.4" ry="1.8" />
          <ellipse cx="11" cy="18" rx="2.6" ry="2" />
          <ellipse cx="24" cy="22" rx="2.2" ry="1.6" />
        </g>
        <g fill="rgba(255,255,255,0.16)">
          <circle cx="6" cy="6" r="0.9" />
          <circle cx="20" cy="10" r="0.9" />
          <circle cx="11" cy="18" r="0.9" />
          <circle cx="24" cy="22" r="0.9" />
        </g>
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
