'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/layout/toaster';
import { cn } from '@/lib/utils';
import { SyncStatusPill } from '@/components/dashboard/sync-status-pill';

export function SyncJiraButton({ className }: { className?: string }) {
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  // Bumped on a successful manual sync so the SyncStatusPill refetches
  // immediately rather than waiting for its 30s poll.
  const [pillRefreshKey, setPillRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.user?.id) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setIsAdmin(data?.role === 'admin');
    }
    check();
    return () => { cancelled = true; };
  }, []);

  async function handleClick() {
    if (syncing) return;
    setSyncing(true);
    // Show 'Syncing…' on the pill immediately — the edge function writes
    // a running row at start, so a fast refetch picks it up. Subsequent
    // polls refresh into success/failed once the run completes.
    setPillRefreshKey((n) => n + 1);
    try {
      const response = await fetch('/api/jira/sync', { method: 'POST' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      toast('✅ Synced with Jira');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[sync-jira-button] sync failed', err);
      toast(`❌ Sync failed: ${msg.slice(0, 80)}`);
    } finally {
      setSyncing(false);
      // Refresh the pill once more on completion so it reflects the
      // final success/failed state without waiting for the 30s tick.
      setPillRefreshKey((n) => n + 1);
    }
  }

  // Render the pill for everyone (admin + read-only). The button itself
  // stays admin-only — read-only users see the pill alongside whatever
  // header content the page already renders, with no Sync button.
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isAdmin && (
        <button
          type="button"
          onClick={handleClick}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-full bg-[color:var(--f92-orange)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)] focus-visible:ring-offset-2"
        >
          <svg
            className={cn('h-3.5 w-3.5', syncing && 'animate-spin')}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          {syncing ? 'Syncing…' : 'Sync with Jira'}
        </button>
      )}
      <SyncStatusPill refreshKey={pillRefreshKey} />
    </div>
  );
}
