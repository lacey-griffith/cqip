'use client';

// Batch 012 — Phase E1 (Pulse shell). Contextual client list rendered in the
// side nav ONLY while the user is under /dashboard/pulse. Active brands link to
// their brand page; paused brands are greyed but still linked (the page exists
// even when empty). Outside /dashboard/pulse this renders nothing.
//
// Which project the list reflects (spec §4):
//   - brand page  → the projectKey in the URL (authoritative).
//   - main page   → the matrix picker, mirrored via sessionStorage + a
//                   `pulse:project` CustomEvent broadcast by the Pulse page
//                   (the shared nav can't use useSearchParams under
//                   statically-prerendered dashboard pages), else DEFAULT.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { toClientNavItems, type ClientNavItem } from '@/lib/client-library/pulse';

const PULSE_ROOT = '/dashboard/pulse';
// Keep these in sync with app/dashboard/pulse/page.tsx.
const PROJECT_STORAGE_KEY = 'pulse:project';
const PROJECT_EVENT = 'pulse:project';
const DEFAULT_PROJECT = 'NBLYCRO';

function isUnderPulse(pathname: string): boolean {
  return pathname === PULSE_ROOT || pathname.startsWith(`${PULSE_ROOT}/`);
}

// Brand-page URL shape: /dashboard/pulse/<projectKey>/<brandCode>.
function projectKeyFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean); // ['dashboard','pulse',proj,brand]
  if (parts[0] === 'dashboard' && parts[1] === 'pulse' && parts.length >= 4) {
    return decodeURIComponent(parts[2]);
  }
  return null;
}

interface BrandFetchRow {
  brand_code: string;
  display_name: string;
  is_active: boolean;
  is_paused: boolean;
}

export function PulseClientNav() {
  const pathname = usePathname() || '';
  const underPulse = isUnderPulse(pathname);
  const urlProject = projectKeyFromPath(pathname);

  // Seed the picker mirror from sessionStorage at mount (lazy init — guarded
  // for SSR, and it never setStates inside an effect body). The main page
  // re-broadcasts its project on every mount + change, so the listener below
  // keeps this current regardless of mount order.
  const [pickerProject, setPickerProject] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.sessionStorage.getItem(PROJECT_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [brands, setBrands] = useState<ClientNavItem[]>([]);

  // Listener only — no synchronous setState in the effect body. The handler's
  // setState runs on the event, which the lint rule does not flag.
  useEffect(() => {
    function onProject(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string' && detail) setPickerProject(detail);
    }
    window.addEventListener(PROJECT_EVENT, onProject);
    return () => window.removeEventListener(PROJECT_EVENT, onProject);
  }, []);

  // URL project wins (brand page); else the picker; else the default.
  const projectKey = urlProject ?? pickerProject ?? DEFAULT_PROJECT;

  // Fetch the current project's active brands. All setState is inside the async
  // function after the await (mirrors the matrix page pattern), so the
  // set-state-in-effect rule stays quiet. Between project switches the prior
  // list shows briefly until the new fetch resolves — fine for a small list.
  useEffect(() => {
    if (!underPulse || !projectKey) return;
    let cancelled = false;
    async function loadBrands(key: string) {
      const { data, error } = await supabase
        .from('brands')
        .select('brand_code, display_name, is_active, is_paused')
        .eq('project_key', key)
        .eq('is_active', true)
        .order('display_name');
      if (cancelled) return;
      if (error) {
        console.error('[pulse-client-nav] brand fetch failed', error);
        setBrands([]);
      } else {
        setBrands(toClientNavItems((data ?? []) as BrandFetchRow[]));
      }
    }
    void loadBrands(projectKey);
    return () => {
      cancelled = true;
    };
  }, [underPulse, projectKey]);

  if (!underPulse) return null;

  return (
    <div className="mt-6">
      <p
        className="px-1 pb-2 text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]"
        style={{ letterSpacing: 'var(--tracking-wide, 0.08em)' }}
      >
        Clients
      </p>
      {brands.length === 0 ? (
        <p className="px-4 text-xs text-[color:var(--f92-gray)]">No clients for this project.</p>
      ) : (
        <nav aria-label="Clients" className="space-y-0.5">
          {brands.map((b) => {
            const href = `${PULSE_ROOT}/${projectKey}/${b.brand_code}`;
            const active = pathname === href;
            return (
              <Link
                key={b.brand_code}
                href={href}
                aria-current={active ? 'page' : undefined}
                title={b.paused ? `${b.display_name} (paused)` : b.display_name}
                className={cn(
                  'block truncate rounded-xl py-2 pr-3 text-sm transition min-h-[40px]',
                  active
                    ? 'border-l-4 border-[color:var(--f92-active-border)] bg-[color:var(--f92-tint)] pl-3 text-[color:var(--f92-navy)]'
                    : 'pl-4 hover:bg-[color:var(--f92-tint)]',
                  b.paused && !active ? 'text-[color:var(--f92-lgray)]' : '',
                  !b.paused && !active ? 'text-[color:var(--f92-dark)]' : '',
                )}
              >
                {b.display_name}
                {b.paused ? <span className="ml-1 text-[10px] uppercase opacity-80">paused</span> : null}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
