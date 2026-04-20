'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar, type AvatarPattern } from '@/components/layout/user-avatar';
import { useTheme } from '@/components/layout/theme-provider';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface NavProfile {
  id: string;
  display_name: string;
  role: 'admin' | 'read_only';
  color_preference: string | null;
  pattern_preference: AvatarPattern | null;
  theme_preference: 'light' | 'dark' | null;
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/logs', label: 'Logs' },
  { href: '/dashboard/reports', label: 'Reports' },
  { href: '/dashboard/settings/profile', label: 'Profile' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/dashboard/settings') {
    return pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const [profile, setProfile] = useState<NavProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || cancelled) return;

      const userId = session.user.id;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('[nav] failed to load user_profiles for', userId, error);
        return;
      }

      if (!data) {
        console.warn('[nav] no user_profiles row found for auth id', userId);
        return;
      }

      const initial = data as NavProfile;
      setProfile(initial);
      if (initial.theme_preference === 'light' || initial.theme_preference === 'dark') {
        setTheme(initial.theme_preference);
      }

      channel = supabase
        .channel(`user_profile_${initial.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles',
            filter: `id=eq.${initial.id}`,
          },
          payload => {
            const next = payload.new as NavProfile;
            setProfile(next);
            if (next.theme_preference === 'light' || next.theme_preference === 'dark') {
              setTheme(next.theme_preference);
            }
          },
        )
        .subscribe();
    }

    init();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [setTheme]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const links = [
    ...navLinks,
    ...(profile?.role === 'admin' ? [{ href: '/dashboard/settings', label: 'Settings' }] : []),
  ];

  const primaryLabel = profile?.display_name || 'User';
  const role = profile?.role ?? 'read_only';

  return (
    <aside className="flex min-h-screen w-72 flex-col border-r border-[color:var(--f92-border)] bg-white px-6 py-8">
      <div className="mb-10">
        <div className="mb-4 inline-flex items-center gap-3 rounded-2xl bg-[color:var(--f92-warm)] px-4 py-3">
          <Image src="/cqip-logo.svg" alt="CQIP logo" width={40} height={40} priority />
          <div>
            <p className="text-sm font-semibold text-[color:var(--f92-dark)]">Fusion92 CQIP</p>
            <p className="text-xs text-[color:var(--f92-gray)]">CRO Quality Intelligence</p>
          </div>
        </div>
        <div className="space-y-1">
          {links.map(link => {
            const active = isActive(pathname || '', link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'block rounded-2xl py-3 pr-4 text-sm font-medium transition',
                  active
                    ? 'border-l-4 border-[color:var(--f92-orange)] bg-[color:var(--f92-warm)] pl-3 text-[color:var(--f92-navy)]'
                    : 'pl-4 text-[color:var(--f92-dark)] hover:bg-[color:var(--f92-warm)]',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto rounded-3xl bg-[color:var(--f92-warm)] p-4 text-sm">
        <div className="flex items-center gap-3">
          <UserAvatar
            displayName={profile?.display_name}
            color={profile?.color_preference}
            pattern={profile?.pattern_preference}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[color:var(--f92-dark)]">{primaryLabel}</p>
            <Badge
              variant={role === 'admin' ? 'open' : 'default'}
              className="mt-1 text-[10px] uppercase tracking-widest"
            >
              {role === 'admin' ? 'Admin' : 'Viewer'}
            </Badge>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end">
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  );
}
