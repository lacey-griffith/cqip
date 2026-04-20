'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data?.session) {
      router.push('/dashboard');
    } else {
      setMessage('Please check your credentials and try again.');
    }
  }

  async function handlePasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetLoading(true);
    setResetMessage(null);

    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/settings/profile`
      : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo,
    });

    setResetLoading(false);

    if (error) {
      setResetMessage(error.message);
      return;
    }

    setResetMessage('If an account exists for that email, a reset link has been sent.');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--f92-warm)] px-4 py-10 text-[color:var(--f92-dark)]">
      <Card className="w-full max-w-md">
        <div className="mb-8 space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--f92-orange)] text-white">C</div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Fusion92 CQIP</p>
            <h1 className="text-3xl font-semibold">
              {showReset ? 'Reset your password' : 'Sign in to your account'}
            </h1>
            <p className="text-sm text-[color:var(--f92-gray)]">
              {showReset
                ? 'Enter your Fusion92 email and we will send you a password reset link.'
                : 'Enter your Fusion92 email and password to continue.'}
            </p>
          </div>
        </div>

        {showReset ? (
          <form onSubmit={handlePasswordReset} className="space-y-5">
            <div>
              <Label htmlFor="resetEmail">Email</Label>
              <Input
                id="resetEmail"
                type="email"
                value={resetEmail}
                onChange={event => setResetEmail(event.target.value)}
                required
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
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
              />
            </div>
            {message ? <p className="text-sm text-[color:var(--f92-orange)]">{message}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
            <button
              type="button"
              onClick={() => { setShowReset(true); setResetEmail(email); setMessage(null); }}
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
