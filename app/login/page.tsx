'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';

const LOCAL_SUFFIX = '@cqip.local';
const RATE_LIMIT_KEY = 'cqip-login-attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const WARN_AFTER = 3;

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function toEmail(username: string): string {
  return `${normalizeUsername(username)}${LOCAL_SUFFIX}`;
}

// Batch auth.1 dual-mode login [Jenny H3]. If the identifier looks like an
// email, use it directly; otherwise synthesize the legacy @cqip.local address.
//
// Approach C (Karen HIGH fix): the earlier version did a username→email lookup
// against user_profiles here. That lookup is DEAD from the login screen — the
// browser client is unauthenticated and user_profiles RLS is authenticated-only
// (migration 005), so it always returned null and fell through to synthesis
// anyway. Dropped entirely rather than papered over with a resolver endpoint or
// an anon RLS policy. Migrated users sign in via the '@' branch (they enter
// their fusion email — the failed-login hint nudges them there); un-migrated
// users still resolve by username via synthesis.
function resolveIdentifierToEmail(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  // TODO(auth.1-cleanup): legacy @cqip.local synthesis. Removed once all 7
  //   accounts are migrated and everyone signs in with their email.
  return toEmail(trimmed);
}

interface AttemptState {
  count: number;
  lockedUntil: number | null;
}

function readAttempts(): AttemptState {
  if (typeof window === 'undefined') return { count: 0, lockedUntil: null };
  try {
    const raw = window.localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { count: 0, lockedUntil: null };
    const parsed = JSON.parse(raw);
    if (typeof parsed?.count === 'number' && (parsed.lockedUntil === null || typeof parsed.lockedUntil === 'number')) {
      return parsed as AttemptState;
    }
  } catch {
    /* fall through */
  }
  return { count: 0, lockedUntil: null };
}

function writeAttempts(state: AttemptState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable; ignore */
  }
}

function clearAttempts() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(RATE_LIMIT_KEY);
  } catch {
    /* ignore */
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  );
}

function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/dashboard';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [attempts, setAttempts] = useState<AttemptState>({ count: 0, lockedUntil: null });
  const [now, setNow] = useState(() => Date.now());
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    setAttempts(readAttempts());
  }, []);

  const isLockedRaw = attempts.lockedUntil !== null && attempts.lockedUntil > now;

  // Tick once per second while locked so the countdown refreshes.
  useEffect(() => {
    if (!isLockedRaw) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isLockedRaw]);

  const locked = attempts.lockedUntil !== null && attempts.lockedUntil > now;
  const minutesRemaining = locked
    ? Math.max(1, Math.ceil((attempts.lockedUntil! - now) / 60000))
    : 0;
  const remaining = Math.max(0, MAX_ATTEMPTS - attempts.count);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const current = readAttempts();
    if (current.lockedUntil && current.lockedUntil > Date.now()) {
      setAttempts(current);
      setNow(Date.now());
      return;
    }

    setLoading(true);
    setMessage(null);

    const resolvedEmail = resolveIdentifierToEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });

    setLoading(false);

    if (error || !data?.session) {
      const nextCount = current.count + 1;
      const next: AttemptState =
        nextCount >= MAX_ATTEMPTS
          ? { count: nextCount, lockedUntil: Date.now() + LOCKOUT_MS }
          : { count: nextCount, lockedUntil: null };
      writeAttempts(next);
      setAttempts(next);
      setNow(Date.now());
      // Static hint (no lookup, no directory disclosure): migrated users who
      // still type their old username will fail synthesis — point them at email.
      const baseMessage = error?.message ?? 'Please check your credentials and try again.';
      setMessage(`${baseMessage} Switched to email login? Enter your email address.`);
      return;
    }

    clearAttempts();
    setAttempts({ count: 0, lockedUntil: null });

    // Fire-and-forget: record the successful login for later activity history
    // (Batch login-events). The now-authenticated client satisfies the
    // insert-own RLS policy. This is a non-critical side effect — a failure
    // must never block or error the login, so it is not awaited and swallowed.
    void supabase
      .from('login_events')
      .insert({ user_id: data.session.user.id })
      .then(({ error: logError }) => {
        if (logError) console.warn('[login] failed to record login_event', logError);
      });

    // Remember-me: when unchecked, mark this as a short session. A
    // sessionStorage canary dies when the browser closes; the dashboard
    // layout checks the pair on next mount and signs the user back out
    // if short-session is set but the canary is gone.
    try {
      if (rememberMe) {
        window.localStorage.setItem('cqip-remember-me', 'true');
        window.sessionStorage.removeItem('cqip-session-active');
      } else {
        window.localStorage.setItem('cqip-remember-me', 'false');
        window.sessionStorage.setItem('cqip-session-active', '1');
      }
    } catch {
      /* storage unavailable — session falls back to Supabase default */
    }

    router.push(redirectTarget);
  }

  async function handlePasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetLoading(true);
    setResetMessage(null);

    // Approach C (Karen HIGH fix): no user_profiles lookup — it was dead from
    // the unauthenticated login screen (RLS is authenticated-only), so the old
    // flow never actually reached resetPasswordForEmail. Email in → send the
    // link directly. Username / non-email in → un-migrated (@cqip.local) account
    // that can't receive reset email; keep the refusal message.
    const identifier = resetUsername.trim();

    if (!identifier.includes('@')) {
      setResetLoading(false);
      setResetMessage('Local accounts cannot receive reset emails. Please contact an admin.');
      return;
    }

    const email = identifier.toLowerCase();
    if (email.endsWith(LOCAL_SUFFIX)) {
      setResetLoading(false);
      setResetMessage('Local accounts cannot receive reset emails. Please contact an admin.');
      return;
    }

    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/settings/profile`
      : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setResetLoading(false);

    if (error) {
      setResetMessage(error.message);
      return;
    }

    setResetMessage('If a matching account exists, a reset link has been sent.');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--f92-warm)] px-4 py-10 text-[color:var(--f92-dark)]">
      <Card className="w-full max-w-md">
        <div className="mb-8 space-y-3">
          <Image src="/cqip-logo.svg" alt="CQIP logo" width={48} height={48} priority />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Fusion92 CQIP</p>
            <h1 className="text-3xl font-semibold">
              {showReset ? 'Reset your password' : 'Sign in to your account'}
            </h1>
            <p className="text-sm text-[color:var(--f92-gray)]">
              {showReset
                ? 'Enter your email address and we will send a reset link. Username-only accounts cannot receive reset emails — contact an admin.'
                : 'Enter your email or username and password to continue.'}
            </p>
          </div>
        </div>

        {showReset ? (
          <form onSubmit={handlePasswordReset} className="space-y-5" suppressHydrationWarning>
            <div>
              <Label htmlFor="resetUsername">Email</Label>
              <Input
                id="resetUsername"
                type="text"
                autoComplete="email"
                placeholder="you@fusion92.com"
                value={resetUsername}
                onChange={event => setResetUsername(event.target.value)}
                required
                suppressHydrationWarning
              />
            </div>
            {resetMessage ? <p className="text-sm text-[color:var(--f92-navy)]">{resetMessage}</p> : null}
            <Button type="submit" className="w-full" disabled={resetLoading}>
              {resetLoading ? 'Sending...' : 'Send reset link'}
            </Button>
            <button
              type="button"
              onClick={() => { setShowReset(false); setResetMessage(null); }}
              className="w-full text-center text-sm text-[color:var(--f92-navy)] underline"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" suppressHydrationWarning>
            <div>
              <Label htmlFor="username">Email or username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="email or username"
                value={username}
                onChange={event => setUsername(event.target.value)}
                required
                suppressHydrationWarning
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
                suppressHydrationWarning
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--f92-dark)]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-[color:var(--f92-border)] accent-[color:var(--f92-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
              />
              Remember me for 7 days
            </label>
            {message ? <p className="text-sm text-[color:var(--f92-orange)]">{message}</p> : null}
            {locked ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Too many failed attempts. Try again in {minutesRemaining} minute{minutesRemaining === 1 ? '' : 's'}.
              </p>
            ) : attempts.count >= WARN_AFTER ? (
              <p className="text-xs text-[color:var(--f92-gray)]">
                {remaining} attempt{remaining === 1 ? '' : 's'} remaining before the form is locked for 5 minutes.
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading || locked}>
              {loading ? 'Signing in...' : locked ? 'Locked' : 'Sign in'}
            </Button>
            <button
              type="button"
              onClick={() => { setShowReset(true); setResetUsername(username); setMessage(null); }}
              className="w-full text-center text-sm text-[color:var(--f92-navy)] underline"
            >
              Forgot password?
            </button>
          </form>
        )}
      </Card>
    </main>
  );
}
