'use client';

import { useEffect, useRef, useState } from 'react';
import { useTypingDetector } from '@/lib/easter-eggs/use-typing-detector';

// Konami handling lives directly in app/dashboard/layout.tsx so the
// sequence listener can't accidentally be mounted more than once.
export function EasterEggHost() {
  const [waveActive, setWaveActive] = useState(false);
  const lastFireRef = useRef(0);

  function triggerWave() {
    // f92 is a suffix of fusion92, so typing the full word fires both
    // detectors. A short debounce collapses overlapping triggers into one wave.
    const now = Date.now();
    if (now - lastFireRef.current < 300) return;
    lastFireRef.current = now;
    setWaveActive(true);
    // Single-pass sweep runs 1400ms; 1500ms hold gives the last frame
    // time to fade before the container unmounts.
    window.setTimeout(() => setWaveActive(false), 1500);
  }

  useTypingDetector('fusion92', triggerWave);
  useTypingDetector('f92', triggerWave);

  useEffect(() => {
    function onTrigger() { triggerWave(); }
    window.addEventListener('cqip:fusion-wave', onTrigger);
    return () => window.removeEventListener('cqip:fusion-wave', onTrigger);
  }, []);

  return waveActive ? <div aria-hidden="true" className="cqip-fusion-wave" /> : null;
}
