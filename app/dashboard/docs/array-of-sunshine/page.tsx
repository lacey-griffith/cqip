'use client';

import { useState, type FormEvent } from 'react';
import confetti from 'canvas-confetti';

interface EggEntry {
  name: string;
  trigger: string;
  description: string;
}

const EGGS: EggEntry[] = [
  {
    name: 'Konami code',
    trigger: '↑ ↑ ↓ ↓ ← → ← → B A (anywhere on a dashboard page)',
    description: 'Massive confetti explosion (orange, navy, white, gold) plus a toast.',
  },
  {
    name: 'Matrix rain',
    trigger: 'Click the "Quality Intelligence Platform" title 7× on the dashboard',
    description: 'Green glyphs cascade over the whole screen for 3 seconds. Ends with "There is no bug. 🕶️".',
  },
  {
    name: 'Sun → clouds',
    trigger: 'In light mode, hover the Sun icon for 1.5 seconds',
    description: 'Three chunky Super Mario clouds drift across the sidebar over a soft sky-blue tint.',
  },
  {
    name: 'Moon → stars',
    trigger: 'In dark mode, hover the Moon icon for 3 seconds',
    description: '20-odd tiny stars twinkle across the sidebar in white, pale yellow, and gold.',
  },
  {
    name: 'Logo rainbow',
    trigger: 'Click the CQ hexagon 5× quickly',
    description: 'The logo bounces, spins, and hue-rotates through the rainbow before snapping back to Fusion92 orange.',
  },
  {
    name: 'Brand chant',
    trigger: 'Type "fusion92" anywhere on a dashboard page',
    description: 'A warm orange wave sweeps across the screen.',
  },
  {
    name: 'Avatar slot machine',
    trigger: 'Click your avatar 3× quickly',
    description: 'Patterns reel through like a slot machine and land on a random one.',
  },
  {
    name: 'Admin badge titles',
    trigger: 'Admins: click the ADMIN badge in the sidebar',
    description: 'Cycles through 15 alternate titles (Bug Whisperer, 404: Title Not Found, sudo make me a sandwich, etc.). The 9th click resets to ADMIN.',
  },
  {
    name: 'Missing Info tooltip',
    trigger: 'Hover over "Missing / Miscommunicated Info" anywhere in the app',
    description: 'A speech bubble appears after 500ms: "📞 Have you tried... talking to each other?"',
  },
  {
    name: 'Zero-critical sparkle',
    trigger: 'Critical KPI = 0 (fires on roughly 1-in-5 dashboard loads)',
    description: 'A tiny 🎊 or ⭐ pops in next to "All systems normal".',
  },
  {
    name: 'Clean streak',
    trigger: 'No new logs in 7+ days',
    description: 'A bouncing badge appears in the dashboard header. Click it for an extra kudos toast.',
  },
  {
    name: 'Lost in development (404)',
    trigger: 'Hit any 404 URL',
    description: 'The CQIP logo looks confused. We logged it.',
  },
  {
    name: 'Loading messages',
    trigger: 'Anywhere the app is loading',
    description: 'Honest, slightly chaotic status updates while you wait (Interrogating Jira…, Bribing the database…).',
  },
  {
    name: 'Audit-trail eyes',
    trigger: 'A log edited more than 5 times',
    description: 'A 👀 emoji appears next to the ticket ID. It has been through some things.',
  },
];

const UNLOCK_PASSWORD = 'open';

export default function ArrayOfSunshinePage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.trim().toLowerCase() === UNLOCK_PASSWORD) {
      setUnlocked(true);
      setError(null);
      confetti({
        particleCount: 220,
        spread: 90,
        origin: { y: 0.4 },
        colors: ['#F47920', '#FFFFFF', '#FACC15'],
      });
      return;
    }
    setError('Access denied. Try again.');
    setShake(true);
    setPassword('');
    window.setTimeout(() => setShake(false), 520);
  }

  if (!unlocked) {
    return (
      <main className="cqip-dossier-bg flex min-h-[70vh] items-center justify-center px-6 py-10 font-mono">
        <form
          onSubmit={handleSubmit}
          className={`cqip-dossier-card max-w-md rounded-3xl border p-10 text-center ${shake ? 'cqip-shake' : ''}`}
        >
          <p className="text-xs uppercase tracking-[0.4em]">access denied</p>
          <h1 className="mt-3 text-2xl font-bold">🔐 Locked</h1>
          <p className="mt-3 text-sm opacity-80">
            Enter the password to unseal this dossier.
          </p>

          <div className="mt-6 text-left">
            <label htmlFor="cqip-dossier-password" className="text-[10px] uppercase tracking-[0.3em] opacity-70">
              Password
            </label>
            <input
              id="cqip-dossier-password"
              type="password"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={password}
              onChange={e => setPassword(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'cqip-dossier-password-error' : undefined}
              className="mt-2 w-full rounded-md border border-current/40 bg-black/30 px-3 py-2 font-mono text-sm tracking-widest text-current placeholder:text-current/40 focus:border-current/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-current/60"
              placeholder="••••"
            />
            {error ? (
              <p id="cqip-dossier-password-error" className="mt-2 text-xs uppercase tracking-widest text-red-400">
                {error}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className="mt-5 w-full rounded-md border border-current/50 bg-black/20 px-3 py-2 text-sm uppercase tracking-[0.3em] transition hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/60"
          >
            Unlock
          </button>
        </form>
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
