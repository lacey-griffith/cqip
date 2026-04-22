'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/components/layout/toaster';
import { cn } from '@/lib/utils';

const LAST_SYNC_KEY = 'cqip-last-sync';

function formatLastSync(iso: string | null): string {
  if (!iso) return 'Never synced';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Never synced';
  const diff = Date.now() - then.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Last synced: just now';
  if (mins < 60) return `Last synced: ${mins} minute${mins === 1 ? '' : 's'} ago`;
  const sameDay = then.toDateString() === new Date().toDateString();
  if (sameDay) {
    return `Last synced: Today at ${then.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return `Last synced: ${then.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} at ${then.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export function SyncJiraButton({ className }: { className?: string }) {
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

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

      try {
        const stored = window.localStorage.getItem(LAST_SYNC_KEY);
        if (stored) setLastSyncedAt(stored);
      } catch { /* storage unavailable */ }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  async function handleClick() {
    if (syncing) return;
    setSyncing(true);
    try {
      const response = await fetch('/api/jira/sync', { method: 'POST' });
      if (!response.ok) throw new Error('Sync failed');
      const stamp = new Date().toISOString();
      setLastSyncedAt(stamp);
      try { window.localStorage.setItem(LAST_SYNC_KEY, stamp); } catch { /* ignore */ }
      toast('✅ Synced with Jira');
    } catch (err) {
      console.error('[sync-jira-button] sync failed', err);
      toast('❌ Sync failed — try again');
    } finally {
      setSyncing(false);
    }
  }

  if (!isAdmin) return null;

  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
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
      <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
        {formatLastSync(lastSyncedAt)}
      </p>
    </div>
  );
}
