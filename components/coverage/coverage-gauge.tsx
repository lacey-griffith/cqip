'use client';

import { useEffect, useRef, useState } from 'react';

// Donut gauge for the Coverage Ledger KPI strip (Batch 005.2). Ports the
// mock's SVG donut + mount animation: on mount the arc AND the numeric label
// count up from 0 → value over 1000ms with ease-out cubic (1 - (1-t)^3).
// Colors come from --ledger-gauge-* tokens (§13 r25) so light/dark both work.
// prefers-reduced-motion snaps straight to the final value.
//
// value is a percent 0..100, or null → renders the track only + '—' (the
// caller passes null when the metric has a 0-denominator, e.g. no active
// unpaused brands / no delivered tickets in the window).

interface CoverageGaugeProps {
  value: number | null;
  /** CSS var expression for the arc + numeral, e.g. 'var(--ledger-gauge-health)'. */
  colorVar: string;
  ariaLabel: string;
}

const R = 26;
const CIRC = 2 * Math.PI * R;

export function CoverageGauge({ value, colorVar, ariaLabel }: CoverageGaugeProps) {
  const [anim, setAnim] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value == null) return;
    // All setState happens inside a requestAnimationFrame callback (never
    // synchronously in the effect body) so this doesn't trip
    // react-hooks/set-state-in-effect. anim initializes at 0, so the mount
    // case animates 0→value without an explicit reset.
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      rafRef.current = requestAnimationFrame(() => setAnim(1));
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
    const start = performance.now();
    const dur = 1000;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setAnim(1 - Math.pow(1 - t, 3));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  const pct = value ?? 0;
  const off = CIRC * (1 - (pct / 100) * anim);
  const label = value == null ? '—' : `${Math.round(pct * anim)}%`;

  return (
    <div className="relative h-14 w-14">
      <svg width="56" height="56" viewBox="0 0 64 64" role="img" aria-label={ariaLabel}>
        <circle cx="32" cy="32" r={R} fill="none" stroke="var(--ledger-gauge-track)" strokeWidth="7" />
        {value != null ? (
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            stroke={colorVar}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRC.toFixed(2)}
            strokeDashoffset={off.toFixed(2)}
            transform="rotate(-90 32 32)"
          />
        ) : null}
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums"
        style={{ color: value == null ? 'var(--f92-lgray)' : colorVar }}
        aria-hidden="true"
      >
        {label}
      </div>
    </div>
  );
}
