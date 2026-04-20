'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';

const LOCAL_SUFFIX = '@cqip.local';

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function toEmail(username: string): string {
  return `${normalizeUsername(username)}${LOCAL_SUFFIX}`;
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(username),
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data?.session) {
      router.push(redirectTarget);
    } else {
      setMessage('Please check your credentials and try again.');
    }
  }

  async function handlePasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetLoading(true);
    setResetMessage(null);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('display_name', normalizeUsername(resetUsername))
      .maybeSingle();

    if (!profile?.email) {
      setResetLoading(false);
      setResetMessage('If a matching account exists, a reset link has been sent.');
      return;
    }

    if (profile.email.endsWith(LOCAL_SUFFIX)) {
      setResetLoading(false);
      setResetMessage('Local accounts cannot receive reset emails. Please contact an admin.');
      return;
    }

    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/settings/profile`
      : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
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
                ? 'Enter your username and we will send a reset link to the admin-registered address.'
                : 'Enter your username and password to continue.'}
            </p>
          </div>
        </div>

        {showReset ? (
          <form onSubmit={handlePasswordReset} className="space-y-5" suppressHydrationWarning>
            <div>
              <Label htmlFor="resetUsername">Username</Label>
              <Input
                id="resetUsername"
                type="text"
                autoComplete="username"
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
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="e.g. lacey"
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
            {message ? <p className="text-sm text-[color:var(--f92-orange)]">{message}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
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
