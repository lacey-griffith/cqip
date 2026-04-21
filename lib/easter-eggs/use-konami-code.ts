'use client';

import { useEffect, useRef } from 'react';

// Two parallel arrays so we can match on either `event.code` (physical key,
// layout-independent) or `event.key` (logical character). Some keyboard
// layouts / IME states produce one reliably and not the other.
const KONAMI_CODES = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
] as const;

const KONAMI_KEYS = [
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
] as const;

const SEQUENCE_LENGTH = KONAMI_CODES.length;

// Flip to true locally when debugging; keep false in committed code.
const DEBUG = false;

function keyMatches(event: KeyboardEvent, index: number): boolean {
  if (event.code === KONAMI_CODES[index]) return true;
  const expectedKey = KONAMI_KEYS[index];
  const normalized = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return normalized === expectedKey;
}

export function useKonamiCode(onMatch: () => void) {
  const positionRef = useRef(0);
  const handlerRef = useRef(onMatch);

  useEffect(() => {
    handlerRef.current = onMatch;
  }, [onMatch]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Don't interfere with typing in form fields.
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      const position = positionRef.current;

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[konami]', {
          code: event.code,
          key: event.key,
          position,
          expectedCode: KONAMI_CODES[position],
          expectedKey: KONAMI_KEYS[position],
        });
      }

      if (keyMatches(event, position)) {
        const nextPosition = position + 1;
        if (nextPosition === SEQUENCE_LENGTH) {
          positionRef.current = 0;
          if (DEBUG) console.log('[konami] matched full sequence');
          handlerRef.current();
        } else {
          positionRef.current = nextPosition;
        }
        return;
      }

      // Wrong key — reset. If this very key matches the start of the sequence,
      // treat it as the first step of a new attempt.
      const isFirstStep =
        event.code === KONAMI_CODES[0] ||
        (event.key.length === 1 ? event.key.toLowerCase() : event.key) === KONAMI_KEYS[0];
      positionRef.current = isFirstStep ? 1 : 0;
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
