'use client';

interface DeliverySparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

// 7-day delivery-trend polyline for the Coverage Ledger (Batch 005.2).
// Raw daily counts, baseline + end dot, tokenized colors (§13 r25 — the
// stroke/dot/baseline read from --ledger-spark-* so they flip per theme).
// Ports the design bundle's spark() math verbatim (.dc.html). An all-zero
// week renders a flat line on the baseline — a legitimate "no deliveries",
// not a rendering bug.
//
// (Batch 005.1's monthly `Sparkline` — the '—'-on-flat-zero, hover-tooltip
// variant used by the old Output table — was removed in Batch 005.2 commit 3
// once the ledger replaced that table; nothing imported it anymore.)
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
