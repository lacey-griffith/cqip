'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { HelpCircle, Menu, Moon, Sun, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  UserAvatar,
  AVATAR_PATTERNS,
  type AvatarPattern,
} from '@/components/layout/user-avatar';
import { F92Logo } from '@/components/layout/f92-logo';
import { useTheme } from '@/components/layout/theme-provider';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/layout/toaster';
import { capitalizeName, cn } from '@/lib/utils';

interface NavProfile {
  id: string;
  display_name: string;
  role: 'admin' | 'read_only';
  color_preference: string | null;
  pattern_preference: AvatarPattern | null;
  theme_preference: 'light' | 'dark' | null;
  avatar_url: string | null;
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/coverage', label: 'Client Coverage' },
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
  const { toast } = useToast();
  const [profile, setProfile] = useState<NavProfile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Egg state: logo click counter, avatar slot machine, moon→stars, sun→clouds,
  // admin-badge title cycling.
  const logoClicks = useRef<{ count: number; lastAt: number }>({ count: 0, lastAt: 0 });
  const avatarClicks = useRef<{ count: number; lastAt: number }>({ count: 0, lastAt: 0 });
  const [adminTitle, setAdminTitle] = useState<string | null>(null);
  const [adminBouncing, setAdminBouncing] = useState(false);
  const adminClicks = useRef(0);
  const [logoCelebrating, setLogoCelebrating] = useState(false);
  const [slotPattern, setSlotPattern] = useState<AvatarPattern | null>(null);
  const [slotSpinning, setSlotSpinning] = useState(false);
  const [twinkles, setTwinkles] = useState<
    Array<{ id: number; left: string; top: string; size: number; color: string; delay: number }>
  >([]);
  const [clouds, setClouds] = useState<
    Array<{ id: number; top: string; duration: number; delay: number; direction: 1 | -1 }>
  >([]);
  const moonHoverTimer = useRef<number | null>(null);
  const sunHoverTimer = useRef<number | null>(null);
  const twinkleClearTimer = useRef<number | null>(null);
  const cloudClearTimer = useRef<number | null>(null);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (mobileOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = previous; };
    }
  }, [mobileOpen]);

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

  function handleLogoClick() {
    const now = Date.now();
    if (now - logoClicks.current.lastAt > 1500) logoClicks.current.count = 0;
    logoClicks.current.count += 1;
    logoClicks.current.lastAt = now;
    if (logoClicks.current.count >= 5) {
      logoClicks.current.count = 0;
      setLogoCelebrating(true);
      window.setTimeout(() => setLogoCelebrating(false), 1000);
      toast('✨ Logo unlocked!');
    }
  }

  const ADMIN_TITLES = [
    'Bug Whisperer 🐛',
    'The Architect 🏛️',
    'Stack Overflow Survivor 💀',
    '10x Engineer ⚡',
    'The One 👁️',
    'sudo make me a sandwich 🥪',
    'Senior Googler 🔍',
    'Principal Vibe Engineer ✨',
    'Git Blame Recipient 😅',
    'Keyboard Warrior ⌨️',
    'Deploy Cowboy 🤠',
    'I Am Groot 🌿',
    'It Depends... 🤔',
    'LGTM (didn\'t read) 👀',
    '404: Title Not Found 🔍',
  ];

  function handleAdminBadgeClick() {
    if (role !== 'admin') return;
    adminClicks.current += 1;
    if (adminClicks.current >= 9) {
      adminClicks.current = 0;
      setAdminTitle(null);
    } else {
      const pick = ADMIN_TITLES[Math.floor(Math.random() * ADMIN_TITLES.length)];
      setAdminTitle(pick);
    }
    setAdminBouncing(true);
    window.setTimeout(() => setAdminBouncing(false), 260);
  }

  function handleAvatarClick() {
    const now = Date.now();
    if (now - avatarClicks.current.lastAt > 1200) avatarClicks.current.count = 0;
    avatarClicks.current.count += 1;
    avatarClicks.current.lastAt = now;

    if (avatarClicks.current.count >= 3 && !slotSpinning) {
      avatarClicks.current.count = 0;
      setSlotSpinning(true);
      const reels = 14;
      let i = 0;
      const id = window.setInterval(() => {
        const next = AVATAR_PATTERNS[Math.floor(Math.random() * AVATAR_PATTERNS.length)];
        setSlotPattern(next);
        i += 1;
        if (i >= reels) {
          window.clearInterval(id);
          setSlotSpinning(false);
          toast('🎰 New look!');
          // Hold the random pattern for a couple seconds, then revert.
          window.setTimeout(() => setSlotPattern(null), 2200);
        }
      }, 60);
    }
  }

  const STAR_COLORS = ['#FFFFFF', '#FFF9C4', '#FFD700'];

  function handleMoonEnter() {
    if (theme !== 'dark') return;
    if (moonHoverTimer.current) window.clearTimeout(moonHoverTimer.current);
    moonHoverTimer.current = window.setTimeout(() => {
      const count = 22 + Math.floor(Math.random() * 8); // 22–29 stars
      const stars = Array.from({ length: count }, (_, i) => ({
        id: Date.now() + i,
        left: `${2 + Math.random() * 96}%`,
        top: `${2 + Math.random() * 92}%`,
        size: 3 + Math.random() * 5, // 3–8px
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        delay: i * (100 + Math.random() * 100), // staggered 100–200ms
      }));
      setTwinkles(stars);
      if (twinkleClearTimer.current) window.clearTimeout(twinkleClearTimer.current);
      twinkleClearTimer.current = window.setTimeout(() => setTwinkles([]), 3000);
    }, 3000);
  }

  function handleMoonLeave() {
    if (moonHoverTimer.current) {
      window.clearTimeout(moonHoverTimer.current);
      moonHoverTimer.current = null;
    }
  }

  function handleSunEnter() {
    // eslint-disable-next-line no-console
    console.log(`[nav] sun hover enter — theme=${theme}`);
    if (theme !== 'light') return;
    if (sunHoverTimer.current) window.clearTimeout(sunHoverTimer.current);
    sunHoverTimer.current = window.setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log('[nav] sun hover 1.5s fired — spawning clouds');
      // First cloud renders immediately (delay 0); later clouds stagger.
      const cloudSpecs = Array.from({ length: 6 }, (_, i) => ({
        id: Date.now() + i,
        top: `${8 + Math.random() * 75}%`,
        duration: 5 + Math.random() * 2, // 5–7s
        delay: i === 0 ? 0 : 600 + (i - 1) * 700,
        direction: (i % 2 === 0 ? 1 : -1) as 1 | -1,
      }));
      setClouds(cloudSpecs);
      if (cloudClearTimer.current) window.clearTimeout(cloudClearTimer.current);
      const maxLife =
        Math.max(...cloudSpecs.map(c => c.duration * 1000 + c.delay)) + 400;
      cloudClearTimer.current = window.setTimeout(() => setClouds([]), maxLife);
    }, 1500);
  }

  function handleSunLeave() {
    if (sunHoverTimer.current) {
      window.clearTimeout(sunHoverTimer.current);
      sunHoverTimer.current = null;
    }
  }

  // If the theme flips mid-animation, cancel pending triggers and clear any
  // active particles so stars/clouds never appear in the wrong theme.
  useEffect(() => {
    if (moonHoverTimer.current) {
      window.clearTimeout(moonHoverTimer.current);
      moonHoverTimer.current = null;
    }
    if (sunHoverTimer.current) {
      window.clearTimeout(sunHoverTimer.current);
      sunHoverTimer.current = null;
    }
    if (twinkleClearTimer.current) {
      window.clearTimeout(twinkleClearTimer.current);
      twinkleClearTimer.current = null;
    }
    if (cloudClearTimer.current) {
      window.clearTimeout(cloudClearTimer.current);
      cloudClearTimer.current = null;
    }
    setTwinkles([]);
    setClouds([]);
  }, [theme]);

  const links = [
    ...navLinks,
    ...(profile?.role === 'admin' ? [{ href: '/dashboard/settings', label: 'Settings' }] : []),
  ];

  const primaryLabel = capitalizeName(profile?.display_name) || 'User';
  const role = profile?.role ?? 'read_only';
  const isDark = theme === 'dark';
  const activeHref = findActiveHref(pathname || '', links.map(l => l.href));

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-[color:var(--f92-border)] bg-[color:var(--f92-sidebar)] px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="cqip-mobile-nav"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[color:var(--f92-dark)] hover:bg-[color:var(--f92-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link
          href="/dashboard"
          onClick={handleLogoClick}
          aria-label="CQIP — go to dashboard"
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-1 transition',
            logoCelebrating && 'cqip-logo-rainbow',
          )}
        >
          <Image
            src="/cqip-logo.svg"
            alt=""
            width={28}
            height={28}
            priority
            className={cn(logoCelebrating && 'cqip-logo-celebrate')}
          />
          <span className="text-sm font-semibold text-[color:var(--f92-dark)]">CQIP</span>
        </Link>
        <button
          type="button"
          onClick={handleAvatarClick}
          aria-label="Avatar"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
        >
          <span className={cn('inline-block', slotSpinning && 'cqip-slot-spin')}>
            <UserAvatar
              displayName={capitalizeName(profile?.display_name)}
              color={profile?.color_preference}
              pattern={slotPattern ?? profile?.pattern_preference}
              avatarUrl={profile?.avatar_url}
              size="sm"
            />
          </span>
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileOpen ? (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      ) : null}

      {/* Sidebar — always rendered, fixed on mobile, in-flow on md+ */}
      <aside
        id="cqip-mobile-nav"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[color:var(--f92-border)] bg-[color:var(--f92-sidebar)] px-6 py-8 transition-transform md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        aria-label="Primary"
      >
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/dashboard"
            onClick={handleLogoClick}
            aria-label="CQIP — go to dashboard"
            className={cn(
              'inline-flex items-center gap-3 rounded-2xl bg-[color:var(--f92-tint)] px-4 py-3 text-left',
              logoCelebrating && 'cqip-logo-rainbow',
            )}
          >
            <Image
              src="/cqip-logo.svg"
              alt=""
              width={40}
              height={40}
              priority
              className={cn(logoCelebrating && 'cqip-logo-celebrate')}
            />
            <div>
              <p className="text-sm font-semibold text-[color:var(--f92-dark)]">Fusion92 CQIP</p>
              <p className="text-xs text-[color:var(--f92-gray)]">CRO Quality Intelligence</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="ml-2 flex h-10 w-10 items-center justify-center rounded-xl text-[color:var(--f92-dark)] hover:bg-[color:var(--f92-tint)] md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mb-6 px-1 text-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAvatarClick}
              aria-label="Avatar"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
            >
              <span className={cn('inline-block', slotSpinning && 'cqip-slot-spin')}>
                <UserAvatar
                  displayName={capitalizeName(profile?.display_name)}
                  color={profile?.color_preference}
                  pattern={slotPattern ?? profile?.pattern_preference}
                  avatarUrl={profile?.avatar_url}
                  size="md"
                />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[color:var(--f92-dark)]">{primaryLabel}</p>
              {role === 'admin' ? (
                <button
                  type="button"
                  onClick={handleAdminBadgeClick}
                  aria-label="Admin badge — click for alternate titles"
                  className={cn(
                    'mt-1 origin-left transition-transform',
                    adminBouncing && 'scale-110',
                  )}
                >
                  <Badge
                    variant="open"
                    className="text-[10px] uppercase tracking-widest"
                  >
                    {adminTitle ?? 'Admin'}
                  </Badge>
                </button>
              ) : (
                <Badge variant="default" className="mt-1 text-[10px] uppercase tracking-widest">
                  Viewer
                </Badge>
              )}
            </div>
            <div
              role="group"
              aria-label="Theme"
              className="flex items-center gap-0.5 rounded-full bg-[color:var(--f92-tint)] p-0.5"
            >
              <button
                type="button"
                onClick={() => { if (isDark) handleToggleTheme(); }}
                onMouseEnter={handleSunEnter}
                onMouseLeave={handleSunLeave}
                onFocus={handleSunEnter}
                onBlur={handleSunLeave}
                aria-pressed={!isDark}
                aria-label="Light theme"
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full transition',
                  !isDark
                    ? 'bg-[color:var(--f92-orange)] text-white'
                    : 'text-[color:var(--f92-gray)] hover:text-[color:var(--f92-dark)]',
                )}
              >
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => { if (!isDark) handleToggleTheme(); }}
                onMouseEnter={handleMoonEnter}
                onMouseLeave={handleMoonLeave}
                onFocus={handleMoonEnter}
                onBlur={handleMoonLeave}
                aria-pressed={isDark}
                aria-label="Dark theme"
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full transition',
                  isDark
                    ? 'bg-[color:var(--f92-orange)] text-white'
                    : 'text-[color:var(--f92-gray)] hover:text-[color:var(--f92-dark)]',
                )}
              >
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 text-xs text-[color:var(--f92-gray)] transition hover:text-[color:var(--f92-orange)] focus-visible:outline-none focus-visible:underline"
          >
            Sign out
          </button>
        </div>

        <nav aria-label="Sections" className="space-y-1">
          {links.map(link => {
            const active = link.href === activeHref;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-2xl py-3 pr-4 text-sm font-medium transition min-h-[44px]',
                  active
                    ? 'border-l-4 border-[color:var(--f92-active-border)] bg-[color:var(--f92-tint)] pl-3 text-[color:var(--f92-navy)]'
                    : 'pl-4 text-[color:var(--f92-dark)] hover:bg-[color:var(--f92-tint)]',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center gap-2 pt-4">
          <Link
            href="/dashboard/docs"
            aria-label="Documentation"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--f92-gray)] transition hover:bg-[color:var(--f92-tint)] hover:text-[color:var(--f92-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Documentation</span>
          </Link>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('cqip:fusion-wave'))}
            aria-label="Fusion92"
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[color:var(--f92-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
          >
            <F92Logo size={20} aria-hidden={true} />
            <span className="sr-only">Fire Fusion92 shimmer</span>
          </button>
        </div>

        {isDark && twinkles.length > 0 ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            {twinkles.map(t => (
              <svg
                key={t.id}
                className="cqip-star-twinkle absolute"
                style={{
                  left: t.left,
                  top: t.top,
                  width: `${t.size}px`,
                  height: `${t.size}px`,
                  color: t.color,
                  animationDelay: `${t.delay}ms`,
                }}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2 L13.5 9 L20 10 L14 14 L16 21 L12 17 L8 21 L10 14 L4 10 L10.5 9 Z" />
              </svg>
            ))}
          </div>
        ) : null}

        {/* Sky tint fades in while clouds are animating. */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 transition-opacity duration-500',
            !isDark && clouds.length > 0 ? 'opacity-100' : 'opacity-0',
          )}
          style={{ background: 'rgba(147, 197, 253, 0.55)' }}
        />

        {!isDark && clouds.length > 0 ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            {clouds.map(c => (
              <svg
                key={c.id}
                className="cqip-cloud-drift absolute"
                style={{
                  top: c.top,
                  animationDuration: `${c.duration}s`,
                  animationDelay: `${c.delay}ms`,
                  // Flip horizontally for right-to-left drift.
                  transform: c.direction === -1 ? 'scaleX(-1)' : undefined,
                }}
                width={104}
                height={54}
                viewBox="0 0 120 60"
              >
                {/* Super Mario cloud: chunky overlapping white circles on top
                    of a light-gray shadow belly so the cloud stays readable
                    against the sky tint. */}
                <g>
                  <ellipse cx="60" cy="48" rx="52" ry="11" fill="#CBD5E1" />
                  <g fill="#FFFFFF">
                    <circle cx="24" cy="38" r="14" />
                    <circle cx="40" cy="30" r="18" />
                    <circle cx="58" cy="22" r="22" />
                    <circle cx="78" cy="28" r="20" />
                    <circle cx="96" cy="36" r="16" />
                    <rect x="20" y="36" width="84" height="12" rx="6" />
                  </g>
                </g>
              </svg>
            ))}
          </div>
        ) : null}
      </aside>
    </>
  );
}
