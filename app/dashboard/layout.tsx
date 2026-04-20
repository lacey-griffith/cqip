'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Nav } from '@/components/layout/nav';

interface UserProfile {
  email: string;
  display_name: string;
  color_preference: string | null;
  role: 'admin' | 'read_only';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('email, display_name, color_preference, role')
        .eq('id', session.user.id)
        .single();

      if (!error && data) {
        setProfile(data as UserProfile);
      }

      setLoading(false);
    }

    loadSession();
  }, [router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[color:var(--f92-dark)]">Loading dashboard...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[color:var(--f92-warm)]">
      <Nav
        displayName={profile?.display_name ?? null}
        colorPreference={profile?.color_preference ?? null}
        role={profile?.role ?? 'read_only'}
      />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
