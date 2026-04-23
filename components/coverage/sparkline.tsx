'use client';

import { useState } from 'react';

interface SparklineProps {
  points: Array<{ monthIso: string; count: number }>;
  width?: number;
  height?: number;
}

// 6-point line sparkline. Renders '—' when the whole window is flat-zero,
// since an empty line reads as a rendering bug rather than "no activity".
export function Sparkline({ points, width = 80, height = 24 }: SparklineProps) {
  const [hovered, setHovered] = useState(false);
  const max = points.reduce((m, p) => Math.max(m, p.count), 0);

  if (max === 0 || points.length < 2) {
    return (
      <span className="text-xs text-[color:var(--f92-lgray)]" title="No tests in the last 6 months">
        —
      </span>
    );
  }

  const tooltipLines = points.map(p => {
    const [y, m] = p.monthIso.split('-');
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
    return { label, count: p.count };
  });
  const ariaLabel = tooltipLines.map(l => `${l.label}: ${l.count}`).join(', ');

  const n = points.length;
  const stepX = n > 1 ? width / (n - 1) : 0;
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - (p.count / max) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <span
      className="relative inline-block align-middle"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      tabIndex={0}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`6-month trend: ${ariaLabel}`}
        className="inline-block align-middle"
      >
        <polyline
          fill="none"
          stroke="var(--f92-navy)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords.join(' ')}
        />
      </svg>
      {hovered ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-[color:var(--f92-border)] bg-[color:var(--f92-surface)] px-2 py-1 text-[10px] text-[color:var(--f92-dark)] shadow-md"
        >
          {tooltipLines.map((l, i) => (
            <span key={l.label} className="block">
              {l.label}: {l.count}
              {i < tooltipLines.length - 1 ? null : null}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
