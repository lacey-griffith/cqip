'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface NavProps {
  email?: string | null;
  role?: 'admin' | 'read_only' | null;
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/logs', label: 'Logs' },
  { href: '/dashboard/reports', label: 'Reports' },
];

export function Nav({ email, role }: NavProps) {
  return (
    <aside className="flex min-h-screen w-72 flex-col border-r border-[color:var(--f92-border)] bg-white px-6 py-8">
      <div className="mb-10">
        <div className="mb-4 inline-flex items-center gap-3 rounded-2xl bg-[color:var(--f92-warm)] px-4 py-3">
          <div className="h-10 w-10 rounded-2xl bg-[color:var(--f92-orange)]" />
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
        <p className="font-semibold text-[color:var(--f92-dark)]">Signed in as</p>
        <p className="truncate text-[color:var(--f92-dark)]">{email ?? 'Unknown user'}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Badge variant={role === 'admin' ? 'open' : 'default'}>
            {role === 'admin' ? 'Admin' : 'Read Only'}
          </Badge>
          <Button variant="ghost" size="sm">
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  );
}
