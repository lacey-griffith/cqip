'use client';

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useKonamiCode } from '@/lib/easter-eggs/use-konami-code';

interface EggEntry {
  name: string;
  trigger: string;
  description: string;
}

const EGGS: EggEntry[] = [
  {
    name: 'Konami code',
    trigger: '↑ ↑ ↓ ↓ ← → ← → B A',
    description: 'Confetti, a toast, and the secret club door swings open.',
  },
  {
    name: 'Logo unlock',
    trigger: 'Click the CQ hexagon 5× quickly',
    description: 'The logo bounces, spins, and rainbow-cycles before snapping back.',
  },
  {
    name: 'Brand chant',
    trigger: 'Type "fusion92" anywhere on a dashboard page',
    description: 'A warm orange wave sweeps across the screen.',
  },
  {
    name: 'All clear sparkle',
    trigger: 'Critical KPI = 0 (1-in-5 page loads)',
    description: 'A tiny 🎊 or ⭐ pops in next to "All systems normal".',
  },
  {
    name: 'Clean streak',
    trigger: 'No new logs in 7+ days',
    description: 'A bouncing badge appears in the dashboard header.',
  },
  {
    name: 'Avatar slot machine',
    trigger: 'Click your avatar 3× quickly',
    description: 'Patterns reel through like a slot machine and land random.',
  },
  {
    name: 'Twinkle',
    trigger: 'In dark mode, hover the moon icon for 3s',
    description: 'Tiny stars twinkle in the sidebar background.',
  },
  {
    name: 'Lost in development',
    trigger: 'Hit any 404 URL',
    description: 'The CQIP logo looks confused. We logged it.',
  },
  {
    name: 'Loading messages',
    trigger: 'Anywhere the app is loading',
    description: 'Honest, slightly chaotic status updates while you wait.',
  },
  {
    name: 'Audit-trail eyes',
    trigger: 'A log edited more than 5 times',
    description: 'A 👀 emoji appears next to the ticket. It has been through some things.',
  },
];

export default function ArrayOfSunshinePage() {
  const [unlocked, setUnlocked] = useState(false);

  // Honor a previous unlock from this session so refreshing doesn't re-lock.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('cqip-konami-found') === '1') setUnlocked(true);
    } catch { /* ignore */ }
  }, []);

  useKonamiCode(() => {
    setUnlocked(true);
    try { sessionStorage.setItem('cqip-konami-found', '1'); } catch { /* ignore */ }
    confetti({
      particleCount: 220,
      spread: 90,
      origin: { y: 0.4 },
      colors: ['#F47920', '#FFFFFF', '#FACC15'],
    });
  });

  if (!unlocked) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="cqip-dossier-card max-w-md rounded-3xl border p-10 text-center font-mono">
          <p className="text-xs uppercase tracking-[0.4em]">access denied</p>
          <h1 className="mt-3 text-2xl font-bold">🔐 Locked</h1>
          <p className="mt-3 text-sm opacity-80">
            This dossier is sealed. Enter the code to proceed.
          </p>
          <p className="mt-6 text-xs opacity-60">
            Hint: it&apos;s a classic. ↑↑↓↓...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="cqip-dossier-bg min-h-[80vh] px-6 py-10 font-mono">
      <div className="mx-auto max-w-3xl">
        <div className="cqip-dossier-card relative overflow-hidden rounded-3xl border p-8 md:p-10">
          <div className="cqip-classified-stamp" aria-hidden="true">CLASSIFIED</div>
          <p className="text-xs uppercase tracking-[0.4em] opacity-70">Top secret</p>
          <h1 className="mt-2 text-3xl font-bold">🔐 CLASSIFIED: CQIP Secret Files</h1>
          <p className="mt-2 text-sm opacity-80">You didn&apos;t find this here. 🤫</p>

          <ol className="mt-8 space-y-4">
            {EGGS.map((egg, idx) => (
              <li key={egg.name} className="rounded-xl border border-current/20 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    <span className="opacity-50">#{String(idx + 1).padStart(2, '0')}</span> · {egg.name}
                  </h2>
                </div>
                <p className="mt-2 text-xs uppercase tracking-widest opacity-60">Trigger</p>
                <p className="text-sm">{egg.trigger}</p>
                <p className="mt-2 text-xs uppercase tracking-widest opacity-60">Description</p>
                <p className="text-sm">{egg.description}</p>
              </li>
            ))}
          </ol>

          <p className="mt-10 text-center text-xs uppercase tracking-[0.4em] opacity-70">
            ~ array of sunshine 🌞 ~
          </p>
        </div>
      </div>
    </main>
  );
}
