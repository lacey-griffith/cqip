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
    const konamiColors = ['#F47920', '#1E2D6B', '#FFFFFF', '#FACC15'];
    // Two bursts for a "massive" effect — one centered, one wider spread.
    confetti({
      particleCount: 260,
      spread: 100,
      startVelocity: 55,
      origin: { y: 0.45 },
      colors: konamiColors,
    });
    confetti({
      particleCount: 140,
      spread: 160,
      startVelocity: 35,
      origin: { y: 0.35 },
      colors: konamiColors,
    });
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
