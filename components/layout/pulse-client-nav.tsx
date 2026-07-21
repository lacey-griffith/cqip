'use client';

// Batch 012 — Pulse E1 follow-on. Cross-project contextual client list in the
// side nav, rendered ONLY under /dashboard/pulse. Lists EVERY active client:
// multi-brand clients as a group (header → matrix scoped to that client via the
// shared pulse:project channel; brands link to their pages), single-brand
// clients collapsed to one direct entry. Paused = greyed-but-linked; inactive
// excluded. Presentation is intentionally thin — all grouping/sort/collapse
// logic lives in lib/client-library/pulse.ts (toClientNavGroups) so the later
// top-nav reorg only re-skins the renderer.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  toClientNavGroups,
  type ClientNavGroup,
  type ClientNavProjectInput,
  type ClientNavBrandRow,
  type ClientNavBrandEntry,
} from '@/lib/client-library/pulse';
import { broadcastPulseProject } from '@/lib/client-library/pulse-project-channel';

const PULSE_ROOT = '/dashboard/pulse';

function isUnderPulse(pathname: string): boolean {
  return pathname === PULSE_ROOT || pathname.startsWith(`${PULSE_ROOT}/`);
}

function brandHref(entry: ClientNavBrandEntry): string {
  return `${PULSE_ROOT}/${entry.projectKey}/${entry.brandCode}`;
}

export function PulseClientNav() {
  const pathname = usePathname() || '';
  const underPulse = isUnderPulse(pathname);
  const [groups, setGroups] = useState<ClientNavGroup[]>([]);

  // Fetch all active projects + brands cross-project. All setState is inside the
  // async function after the await (mirrors the matrix page), so the
  // set-state-in-effect rule stays quiet.
  useEffect(() => {
    if (!underPulse) return;
    let cancelled = false;
    async function load() {
      const [projectsRes, brandsRes] = await Promise.all([
        supabase
          .from('projects')
          .select('jira_project_key, display_name, brand_model, is_active')
          .eq('is_active', true),
        supabase
          .from('brands')
          .select('project_key, brand_code, display_name, is_active, is_paused')
          .eq('is_active', true),
      ]);
      if (cancelled) return;
      if (projectsRes.error || brandsRes.error) {
        console.error('[pulse-client-nav] fetch failed', projectsRes.error ?? brandsRes.error);
        setGroups([]);
        return;
      }
      setGroups(
        toClientNavGroups(
          (projectsRes.data ?? []) as ClientNavProjectInput[],
          (brandsRes.data ?? []) as ClientNavBrandRow[],
        ),
      );
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [underPulse]);

  if (!underPulse) return null;

  return (
    <div className="mt-6">
      <p
        className="px-1 pb-2 text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]"
        style={{ letterSpacing: 'var(--tracking-wide, 0.08em)' }}
      >
        Clients
      </p>
      {groups.length === 0 ? (
        <p className="px-4 text-xs text-[color:var(--f92-gray)]">No clients.</p>
      ) : (
        <nav aria-label="Clients" className="space-y-2">
          {groups.map((group) =>
            group.kind === 'single' ? (
              <BrandLink
                key={group.projectKey}
                entry={group.entry}
                label={group.label}
                pathname={pathname}
              />
            ) : (
              <div key={group.projectKey} className="space-y-0.5">
                {/* Group header → matrix, scoped to this client via the shared
                    handoff (sessionStorage carries across the navigation). */}
                <Link
                  href={PULSE_ROOT}
                  onClick={() => broadcastPulseProject(group.projectKey)}
                  title={`${group.label} — open matrix`}
                  className="block truncate rounded-xl px-3 py-1.5 text-[11px] font-semibold uppercase text-[color:var(--f92-gray)] transition hover:bg-[color:var(--f92-tint)] hover:text-[color:var(--f92-navy)]"
                  style={{ letterSpacing: 'var(--tracking-wide, 0.08em)' }}
                >
                  {group.label}
                </Link>
                <div className="space-y-0.5">
                  {group.brands.map((entry) => (
                    <BrandLink key={entry.brandCode} entry={entry} pathname={pathname} indent />
                  ))}
                </div>
              </div>
            ),
          )}
        </nav>
      )}
    </div>
  );
}

// A single brand link. `label` overrides the shown text (single-brand clients
// show the client name, not the brand name). `indent` nests it under a
// multi-brand group header.
function BrandLink({
  entry,
  label,
  pathname,
  indent,
}: {
  entry: ClientNavBrandEntry;
  label?: string;
  pathname: string;
  indent?: boolean;
}) {
  const href = brandHref(entry);
  const active = pathname === href;
  const text = label ?? entry.displayName;
  // Active adds a 4px left border, so drop 1 unit of left padding to keep the
  // text aligned (matches the E1 nav-link compensation).
  const pad = indent ? (active ? 'pl-5' : 'pl-6') : active ? 'pl-3' : 'pl-4';
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      title={entry.paused ? `${text} (paused)` : text}
      className={cn(
        'block truncate rounded-xl py-2 pr-3 text-sm transition min-h-[40px]',
        pad,
        active
          ? 'border-l-4 border-[color:var(--f92-active-border)] bg-[color:var(--f92-tint)] text-[color:var(--f92-navy)]'
          : 'hover:bg-[color:var(--f92-tint)]',
        entry.paused && !active ? 'text-[color:var(--f92-lgray)]' : '',
        !entry.paused && !active ? 'text-[color:var(--f92-dark)]' : '',
      )}
    >
      {text}
      {entry.paused ? <span className="ml-1 text-[10px] uppercase opacity-80">paused</span> : null}
    </Link>
  );
}
