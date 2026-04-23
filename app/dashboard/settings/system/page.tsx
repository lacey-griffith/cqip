'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { BackToSettings } from '@/components/ui/back-to-settings';

const APP_VERSION = 'v1.2';
const GITHUB_COMMIT_URL = 'https://github.com/lacey-griffith/cqip/commit';

const BUILD_COMMIT = process.env.NEXT_PUBLIC_BUILD_COMMIT;
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME;

function formatBuildTime(iso: string | undefined): string {
  if (!iso) return 'Build info unavailable';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Build info unavailable';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SystemInfoPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      setIsAdmin(data?.role === 'admin');
    }
    init();
  }, []);

  if (isAdmin === false) {
    return (
      <div className="space-y-6">
        <BackToSettings />
        <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-[color:var(--f92-dark)]">Admin access required</h1>
          <p className="mt-2 text-sm text-[color:var(--f92-gray)]">You do not have permission to view system info.</p>
        </div>
      </div>
    );
  }

  const commitLabel = BUILD_COMMIT ?? 'dev';
  const timeLabel = formatBuildTime(BUILD_TIME);
  const canLinkCommit = Boolean(BUILD_COMMIT);

  return (
    <div className="space-y-6">
      <BackToSettings />
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">System Info</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
          Deploy verification: which bundle is live right now.
        </p>
      </div>

      <Card className="p-6">
        <dl className="grid gap-4 md:grid-cols-3">
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Version</dt>
            <dd className="mt-1 text-lg font-semibold text-[color:var(--f92-dark)]">{APP_VERSION}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Commit</dt>
            <dd className="mt-1 font-mono text-sm text-[color:var(--f92-dark)]">
              {canLinkCommit ? (
                <a
                  href={`${GITHUB_COMMIT_URL}/${BUILD_COMMIT}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--f92-orange)] hover:underline"
                >
                  {commitLabel}
                </a>
              ) : (
                commitLabel
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Build time</dt>
            <dd className="mt-1 text-sm text-[color:var(--f92-dark)]">{timeLabel}</dd>
          </div>
        </dl>
        <p className="mt-6 text-xs text-[color:var(--f92-gray)]">
          Build time reflects when the current bundle was compiled. Deploy time may be up to a few minutes later.
        </p>
      </Card>
    </div>
  );
}
