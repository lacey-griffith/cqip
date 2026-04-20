'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/layout/user-avatar';
import { supabase } from '@/lib/supabase/client';

interface NavProps {
  displayName?: string | null;
  colorPreference?: string | null;
  role?: 'admin' | 'read_only' | null;
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/logs', label: 'Logs' },
  { href: '/dashboard/reports', label: 'Reports' },
];

export function Nav({ displayName, colorPreference, role }: NavProps) {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const primaryLabel = displayName || 'User';

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
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--f92-dark)] transition hover:bg-[color:var(--f92-warm)]"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/dashboard/settings/profile"
            className="block rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--f92-dark)] transition hover:bg-[color:var(--f92-warm)]"
          >
            Profile
          </Link>
          {role === 'admin' ? (
            <Link
              href="/dashboard/settings"
              className="block rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--f92-dark)] transition hover:bg-[color:var(--f92-warm)]"
            >
              Settings
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-auto rounded-3xl bg-[color:var(--f92-warm)] p-4 text-sm">
        <div className="flex items-center gap-3">
          <UserAvatar displayName={displayName} color={colorPreference} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[color:var(--f92-dark)]">{primaryLabel}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Badge variant={role === 'admin' ? 'open' : 'default'}>
            {role === 'admin' ? 'Admin' : 'Read Only'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  );
}
