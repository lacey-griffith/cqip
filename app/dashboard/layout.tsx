'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Nav } from '@/components/layout/nav';
import { IdleTimeout } from '@/components/layout/idle-timeout';
import { ToasterProvider } from '@/components/layout/toaster';
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
        <IdleTimeout />
        <EasterEggHost />
      </div>
    </ToasterProvider>
  );
}
