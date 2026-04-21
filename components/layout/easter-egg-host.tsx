'use client';

import { useState } from 'react';
import confetti from 'canvas-confetti';
import { useKonamiCode } from '@/lib/easter-eggs/use-konami-code';
import { useTypingDetector } from '@/lib/easter-eggs/use-typing-detector';
import { useToast } from '@/components/layout/toaster';

export function EasterEggHost() {
  const { toast } = useToast();
  const [waveActive, setWaveActive] = useState(false);

  useKonamiCode(() => {
    confetti({
      particleCount: 180,
      spread: 80,
      origin: { y: 0.4 },
      colors: ['#F47920', '#1E2D6B', '#FFFFFF', '#FEF6EE'],
    });
    // Mark Konami as found so /array-of-sunshine unlocks for the session.
    try {
      sessionStorage.setItem('cqip-konami-found', '1');
    } catch {
      /* ignore */
    }
    toast('🎉 You found it! Welcome to the secret club.');
  });

  useTypingDetector('fusion92', () => {
    setWaveActive(true);
    toast('🧡 Built with love by Fusion92');
    window.setTimeout(() => setWaveActive(false), 1400);
  });

  return waveActive ? (
    <div
      aria-hidden="true"
      className="cqip-fusion-wave pointer-events-none fixed inset-0 z-[80]"
    />
  ) : null;
}
