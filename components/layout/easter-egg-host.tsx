'use client';

import { useState } from 'react';
import { useTypingDetector } from '@/lib/easter-eggs/use-typing-detector';
import { useToast } from '@/components/layout/toaster';

// Konami handling lives directly in app/dashboard/layout.tsx so the
// sequence listener can't accidentally be mounted more than once.
export function EasterEggHost() {
  const { toast } = useToast();
  const [waveActive, setWaveActive] = useState(false);

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
