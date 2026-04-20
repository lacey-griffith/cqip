'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';

const IDLE_LIMIT_MS = 60 * 60 * 1000; // 60 minutes
const WARN_BEFORE_MS = 5 * 60 * 1000;  // warn 5 minutes before timeout
const TICK_MS = 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

export function IdleTimeout() {
  const router = useRouter();
  const lastActivityRef = useRef<number>(Date.now());
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(WARN_BEFORE_MS / 1000));
  const signingOutRef = useRef(false);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (warningOpen) setWarningOpen(false);
  }, [warningOpen]);

  const signOutNow = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[idle-timeout] signOut failed', err);
    }
    router.replace('/login?reason=timeout');
  }, [router]);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetActivity));
    };
  }, [resetActivity]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;

      if (idleFor >= IDLE_LIMIT_MS) {
        signOutNow();
        return;
      }

      if (idleFor >= IDLE_LIMIT_MS - WARN_BEFORE_MS) {
        const remainingMs = IDLE_LIMIT_MS - idleFor;
        setSecondsLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
        if (!warningOpen) setWarningOpen(true);
      }
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [signOutNow, warningOpen]);

  function handleStaySignedIn() {
    lastActivityRef.current = Date.now();
    setWarningOpen(false);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const pretty = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${seconds} second${seconds === 1 ? '' : 's'}`;

  return (
    <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription>
            You will be signed out in {pretty} due to inactivity. Move your mouse or click below to stay signed in.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={signOutNow}>
            Sign out now
          </Button>
          <Button onClick={handleStaySignedIn}>
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
