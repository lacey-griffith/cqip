'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { supabase } from '@/lib/supabase/client';
import { Nav } from '@/components/layout/nav';
import { ToasterProvider, useToast } from '@/components/layout/toaster';
import { EasterEggHost } from '@/components/layout/easter-egg-host';
import { useLoadingMessage } from '@/lib/easter-eggs/use-loading-message';

function LoadingSplash() {
  const message = useLoadingMessage();
  return (
    <div className="min-h-screen flex items-center justify-center text-[color:var(--f92-dark)]">
      {message}
    </div>
  );
}

const KONAMI = [
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

function KonamiListener() {
  const { toast } = useToast();
  const idx = useRef(0);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Don't eat keystrokes while typing into a form field.
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      const keyValue = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const expected = KONAMI[idx.current];

      if (keyValue === expected) {
        idx.current += 1;
        if (idx.current === KONAMI.length) {
          idx.current = 0;
          confetti({
            particleCount: 300,
            spread: 180,
            colors: ['#F47920', '#1E2D6B', '#FFFFFF', '#FFD700'],
            origin: { y: 0.6 },
          });
          toast('🎉 You found it! Welcome to the secret club.');
        }
      } else {
        idx.current = keyValue === KONAMI[0] ? 1 : 0;
      }

      // eslint-disable-next-line no-console
      console.log(`Konami: ${idx.current}/${KONAMI.length} - ${event.key}`);
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toast]);

  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function verifySession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      // Short-session (Remember me unchecked at login) — canary lives in
      // sessionStorage and dies on browser close. If the preference was set
      // to "no" but the canary is missing, treat this as a new browser
      // session and sign the user out.
      try {
        const remember = window.localStorage.getItem('cqip-remember-me');
        const canary = window.sessionStorage.getItem('cqip-session-active');
        if (remember === 'false' && !canary) {
          await supabase.auth.signOut();
          router.replace('/login');
          return;
        }
        if (remember === 'false' && canary) {
          // refresh canary (keeps it alive for the life of this tab/window)
          window.sessionStorage.setItem('cqip-session-active', '1');
        }
      } catch {
        /* storage unavailable; let Supabase default persistence ride */
      }

      setReady(true);
    }
    verifySession();
  }, [router]);

  if (!ready) {
    return <LoadingSplash />;
  }

  return (
    <ToasterProvider>
      <div className="min-h-screen flex flex-col md:flex-row bg-[color:var(--f92-warm)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[color:var(--f92-orange)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to main content
        </a>
        <Nav />
        <main
          className="flex-1 p-4 md:p-6 overflow-x-hidden"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
        <KonamiListener />
        <EasterEggHost />
      </div>
    </ToasterProvider>
  );
}
