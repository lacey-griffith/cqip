'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { UserAvatar, type AvatarPattern } from '@/components/layout/user-avatar';
import { useTheme } from '@/components/layout/theme-provider';
import { supabase } from '@/lib/supabase/client';
import { capitalizeName, cn } from '@/lib/utils';

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

function matchesHref(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (!matchesHref(pathname, href)) continue;
    if (!best || href.length > best.length) {
      best = href;
    }
  }
  return best;
}

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
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

  async function handleToggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (profile?.id) {
      await supabase
        .from('user_profiles')
        .update({ theme_preference: next })
        .eq('id', profile.id);
    }
  }

  const links = [
    ...navLinks,
    ...(profile?.role === 'admin' ? [{ href: '/dashboard/settings', label: 'Settings' }] : []),
  ];

  const primaryLabel = capitalizeName(profile?.display_name) || 'User';
  const role = profile?.role ?? 'read_only';
  const isDark = theme === 'dark';

  return (
    <aside className="flex min-h-screen w-72 flex-col border-r border-[color:var(--f92-border)] bg-[color:var(--f92-sidebar)] px-6 py-8">
      <div className="mb-6 inline-flex items-center gap-3 rounded-2xl bg-[color:var(--f92-tint)] px-4 py-3">
        <Image src="/cqip-logo.svg" alt="CQIP logo" width={40} height={40} priority />
        <div>
          <p className="text-sm font-semibold text-[color:var(--f92-dark)]">Fusion92 CQIP</p>
          <p className="text-xs text-[color:var(--f92-gray)]">CRO Quality Intelligence</p>
        </div>
      </div>

      <div className="mb-6 px-1 text-sm">
        <div className="flex items-center gap-3">
          <UserAvatar
            displayName={capitalizeName(profile?.display_name)}
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
          <div
            role="group"
            aria-label="Theme"
            className="flex items-center gap-0.5 rounded-full bg-[color:var(--f92-tint)] p-0.5"
          >
            <button
              type="button"
              onClick={() => { if (isDark) handleToggleTheme(); }}
              aria-pressed={!isDark}
              aria-label="Light theme"
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full transition',
                !isDark
                  ? 'bg-[color:var(--f92-orange)] text-white'
                  : 'text-[color:var(--f92-gray)] hover:text-[color:var(--f92-dark)]',
              )}
            >
              <Sun className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => { if (!isDark) handleToggleTheme(); }}
              aria-pressed={isDark}
              aria-label="Dark theme"
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full transition',
                isDark
                  ? 'bg-[color:var(--f92-orange)] text-white'
                  : 'text-[color:var(--f92-gray)] hover:text-[color:var(--f92-dark)]',
              )}
            >
              <Moon className="h-3 w-3" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-3 text-xs text-[color:var(--f92-gray)] transition hover:text-[color:var(--f92-orange)]"
        >
          Sign out
        </button>
      </div>

      <div className="space-y-1">
        {(() => {
          const activeHref = findActiveHref(pathname || '', links.map(l => l.href));
          return links.map(link => {
            const active = link.href === activeHref;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'block rounded-2xl py-3 pr-4 text-sm font-medium transition',
                  active
                    ? 'border-l-4 border-[color:var(--f92-active-border)] bg-[color:var(--f92-tint)] pl-3 text-[color:var(--f92-navy)]'
                    : 'pl-4 text-[color:var(--f92-dark)] hover:bg-[color:var(--f92-tint)]',
                )}
              >
                {link.label}
              </Link>
            );
          });
        })()}
      </div>
    </aside>
  );
}
