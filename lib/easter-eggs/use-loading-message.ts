'use client';

import { useEffect, useState } from 'react';

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
 * Returns a fun loading message. The initial value is stable so SSR and the
 * first client render agree (no hydration mismatch); the real random pick
 * happens in an effect after mount.
 */
export function useLoadingMessage(): string {
  const [message, setMessage] = useState<string>(LOADING_MESSAGES[0]);
  useEffect(() => {
    const idx = Math.floor(Math.random() * LOADING_MESSAGES.length);
    setMessage(LOADING_MESSAGES[idx]);
  }, []);
  return message;
}
