'use client';

interface SparklineProps {
  points: Array<{ monthIso: string; count: number }>;
  width?: number;
  height?: number;
}

// 6-point line sparkline. Renders '—' when the whole window is flat-zero,
// since an empty line reads as a rendering bug rather than "no activity".
export function Sparkline({ points, width = 80, height = 24 }: SparklineProps) {
  const max = points.reduce((m, p) => Math.max(m, p.count), 0);

  if (max === 0 || points.length < 2) {
    return (
      <span className="text-xs text-[color:var(--f92-lgray)]" title="No tests in the last 6 months">
        —
      </span>
    );
  }

  const title = points
    .map(p => {
      const [y, m] = p.monthIso.split('-');
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
      return `${label}: ${p.count}`;
    })
    .join(', ');

  const n = points.length;
  const stepX = n > 1 ? width / (n - 1) : 0;
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - (p.count / max) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`6-month trend: ${title}`}
      className="inline-block align-middle"
    >
      <title>{title}</title>
      <polyline
        fill="none"
        stroke="var(--f92-navy)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(' ')}
      />
    </svg>
  );
}
