'use client';

import { useEffect, useRef } from 'react';

const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

export function useKonamiCode(onMatch: () => void) {
  const positionRef = useRef(0);
  const handlerRef = useRef(onMatch);

  // Keep latest callback without re-subscribing.
  useEffect(() => {
    handlerRef.current = onMatch;
  }, [onMatch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Allow typing into inputs without messing up form work.
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      const expected = KONAMI_SEQUENCE[positionRef.current];
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === expected) {
        positionRef.current += 1;
        if (positionRef.current === KONAMI_SEQUENCE.length) {
          positionRef.current = 0;
          handlerRef.current();
        }
      } else {
        // Reset, but allow restart on the first key.
        positionRef.current = key === KONAMI_SEQUENCE[0] ? 1 : 0;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
