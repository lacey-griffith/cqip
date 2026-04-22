'use client';

import { useEffect, useRef, useState } from 'react';
import { useTypingDetector } from '@/lib/easter-eggs/use-typing-detector';
import { useToast } from '@/components/layout/toaster';

// Konami handling lives directly in app/dashboard/layout.tsx so the
// sequence listener can't accidentally be mounted more than once.
export function EasterEggHost() {
  const { toast } = useToast();
  const [waveActive, setWaveActive] = useState(false);
  const lastFireRef = useRef(0);

  function triggerWave() {
    // f92 is a suffix of fusion92, so typing the full word fires both
    // detectors. A short debounce collapses overlapping triggers into one wave.
    const now = Date.now();
    if (now - lastFireRef.current < 300) return;
    lastFireRef.current = now;
    setWaveActive(true);
    toast('🧡 Built with love by Fusion92');
    window.setTimeout(() => setWaveActive(false), 1900);
  }

  useTypingDetector('fusion92', triggerWave);
  useTypingDetector('f92', triggerWave);

  useEffect(() => {
    function onTrigger() { triggerWave(); }
    window.addEventListener('cqip:fusion-wave', onTrigger);
    return () => window.removeEventListener('cqip:fusion-wave', onTrigger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return waveActive ? (
    <div
      aria-hidden="true"
      className="cqip-fusion-wave pointer-events-none fixed inset-0 z-[80]"
    >
      <div className="cqip-fusion-wave-extra" aria-hidden="true" />
    </div>
  ) : null;
}
