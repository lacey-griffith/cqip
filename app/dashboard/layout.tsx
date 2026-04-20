'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Nav } from '@/components/layout/nav';
import { IdleTimeout } from '@/components/layout/idle-timeout';

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
    return (
      <div className="min-h-screen flex items-center justify-center text-[color:var(--f92-dark)]">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[color:var(--f92-warm)]">
      <Nav />
      <main className="flex-1 p-6">{children}</main>
      <IdleTimeout />
    </div>
  );
}
