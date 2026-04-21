'use client';

import { useMemo } from 'react';

const LOADING_MESSAGES = [
  'Interrogating Jira... 🔍',
  'Wrangling data... 🤠',
  'Asking nicely... 🙏',
  'Counting sendbacks... 🔢',
  'Checking for chaos... 👀',
  'Almost there... probably... 🤞',
  'Bribing the database... 💸',
  'Untangling tickets... 🧶',
  'Petting the cache... 🐾',
];

/**
 * Returns a random fun loading message. Stable across re-renders for a given
 * mount, so the message doesn't flicker while loading.
 */
export function useLoadingMessage(): string {
  return useMemo(() => {
    const idx = Math.floor(Math.random() * LOADING_MESSAGES.length);
    return LOADING_MESSAGES[idx];
  }, []);
}
