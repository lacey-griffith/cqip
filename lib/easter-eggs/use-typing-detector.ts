'use client';

import { useEffect, useRef } from 'react';

/**
 * Detects when the user types `target` anywhere on the page (outside form
 * inputs). Calls `onMatch` when matched, then resets the buffer.
 */
export function useTypingDetector(target: string, onMatch: () => void) {
  const bufferRef = useRef('');
  const handlerRef = useRef(onMatch);

  useEffect(() => {
    handlerRef.current = onMatch;
  }, [onMatch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
      if (e.key.length !== 1) return;

      const next = (bufferRef.current + e.key.toLowerCase()).slice(-target.length);
      bufferRef.current = next;
      if (next === target.toLowerCase()) {
        bufferRef.current = '';
        handlerRef.current();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target]);
}
