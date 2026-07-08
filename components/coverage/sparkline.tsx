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

interface DeliverySparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

// 7-day delivery-trend polyline for the Coverage Ledger (Batch 005.2).
// Raw daily counts, baseline + end dot, tokenized colors (§13 r25 — the
// stroke/dot/baseline read from --ledger-spark-* so they flip per theme).
// Ports the mock's spark() math verbatim (design bundle .dc.html). An
// all-zero week renders a flat line on the baseline — that's a legitimate
// "no deliveries", not a rendering bug (unlike the monthly Sparkline above,
// which renders '—' for flat-zero because it's a 6-month lookback).
export function DeliverySparkline({ values, width = 212, height = 58 }: DeliverySparklineProps) {
  const n = values.length;
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = n > 1 ? width / (n - 1) : 0;
  const pts = values.map((v, i) => {
    const x = +(i * step).toFixed(1);
    const y = +(height - ((v - min) / span) * (height - 4) - 2).toFixed(1);
    return [x, y] as const;
  });
  const dot = pts[pts.length - 1] ?? ([0, height - 2] as const);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`7-day delivery trend, ${total} test${total === 1 ? '' : 's'}: ${values.join(', ')}`}
      className="block max-w-full"
      style={{ overflow: 'visible' }}
    >
      <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="var(--ledger-spark-baseline)" strokeWidth="1" />
      <polyline
        points={pts.map(p => p.join(',')).join(' ')}
        fill="none"
        stroke="var(--ledger-spark-line)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={dot[0]} cy={dot[1]} r="3" fill="var(--ledger-spark-dot)" />
    </svg>
  );
}
