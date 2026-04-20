'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import {
  UserAvatar,
  AVATAR_PALETTE,
  DEFAULT_AVATAR_COLOR,
  AVATAR_PATTERNS,
  AVATAR_PATTERN_LABELS,
  DEFAULT_AVATAR_PATTERN,
  type AvatarPattern,
} from '@/components/layout/user-avatar';
import { useTheme, type Theme } from '@/components/layout/theme-provider';
import { cn } from '@/lib/utils';

interface ProfileData {
  id: string;
  email: string;
  display_name: string;
  color_preference: string | null;
  pattern_preference: AvatarPattern | null;
  theme_preference: Theme | null;
  role: 'admin' | 'read_only';
}

export default function ProfileSettingsPage() {
  const { theme, setTheme } = useTheme();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_AVATAR_COLOR);
  const [pattern, setPattern] = useState<AvatarPattern>(DEFAULT_AVATAR_PATTERN);
  const [loading, setLoading] = useState(true);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [appearanceMessage, setAppearanceMessage] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('user_profiles')
        .select('id, email, display_name, color_preference, pattern_preference, theme_preference, role')
        .eq('id', session.user.id)
        .single();
      if (data) {
        const p = data as ProfileData;
        setProfile(p);
        setColor(p.color_preference || DEFAULT_AVATAR_COLOR);
        setPattern((p.pattern_preference as AvatarPattern) || DEFAULT_AVATAR_PATTERN);
        if (p.theme_preference === 'dark' || p.theme_preference === 'light') {
          setTheme(p.theme_preference);
        }
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persistAppearance(updates: Partial<Pick<ProfileData, 'color_preference' | 'pattern_preference' | 'theme_preference'>>) {
    if (!profile) return;
    setSavingAppearance(true);
    setAppearanceMessage(null);
    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', profile.id);
    setSavingAppearance(false);
    if (error) {
      setAppearanceMessage(`Error: ${error.message}`);
      return;
    }
    setAppearanceMessage('Preferences updated.');
  }

  async function handleColor(nextColor: string) {
    setColor(nextColor);
    await persistAppearance({ color_preference: nextColor });
  }

  async function handlePattern(nextPattern: AvatarPattern) {
    setPattern(nextPattern);
    await persistAppearance({ pattern_preference: nextPattern });
  }

  async function handleTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    await persistAppearance({ theme_preference: nextTheme });
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);

    if (profile?.email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });
      if (signInError) {
        setChangingPassword(false);
        setPasswordError('Current password is incorrect.');
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage('Password updated successfully.');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[color:var(--f92-gray)]">Loading profile...</div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[color:var(--f92-dark)]">Sign in required</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">Please sign in to manage your profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">Profile</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">Personalize your avatar, pick a theme, and manage your password.</p>
      </div>

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-4">
            <UserAvatar
              displayName={profile.display_name}
              color={color}
              pattern={pattern}
              size="lg"
            />
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">{profile.display_name}</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[color:var(--f92-gray)]">
                {profile.role === 'admin' ? 'Administrator' : 'Viewer'}
              </p>
              {appearanceMessage ? (
                <p className="mt-2 text-xs text-[color:var(--f92-gray)]">{appearanceMessage}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <Label className="mb-2 block">Avatar color</Label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_PALETTE.map(swatch => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => handleColor(swatch)}
                    disabled={savingAppearance}
                    className={cn(
                      'h-10 w-10 rounded-full border-2 transition',
                      color === swatch
                        ? 'scale-110 border-[color:var(--f92-dark)]'
                        : 'border-transparent hover:scale-105',
                    )}
                    style={{ backgroundColor: swatch }}
                    aria-label={`Select color ${swatch}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Pattern overlay</Label>
              <div className="flex flex-wrap gap-3">
                {AVATAR_PATTERNS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePattern(p)}
                    disabled={savingAppearance}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-2xl border-2 bg-[color:var(--f92-warm)] p-2 transition',
                      pattern === p
                        ? 'border-[color:var(--f92-orange)]'
                        : 'border-transparent hover:border-[color:var(--f92-border)]',
                    )}
                    aria-label={AVATAR_PATTERN_LABELS[p]}
                  >
                    <UserAvatar
                      displayName={profile.display_name}
                      color={color}
                      pattern={p}
                      size="sm"
                    />
                    <span className="text-[10px] uppercase tracking-wider text-[color:var(--f92-gray)]">
                      {AVATAR_PATTERN_LABELS[p]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Theme</h2>
          <p className="text-sm text-[color:var(--f92-gray)]">Applies globally, persists per user, and remembers your last choice locally.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {(['light', 'dark'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => handleTheme(t)}
              disabled={savingAppearance}
              className={cn(
                'flex w-40 flex-col gap-2 rounded-2xl border-2 p-3 text-left transition',
                theme === t
                  ? 'border-[color:var(--f92-orange)]'
                  : 'border-[color:var(--f92-border)] hover:border-[color:var(--f92-gray)]',
              )}
              aria-label={`Use ${t} theme`}
            >
              <div
                className="h-16 w-full rounded-xl border"
                style={
                  t === 'light'
                    ? {
                        background: 'linear-gradient(135deg, #FEF6EE 0%, #FFFFFF 100%)',
                        borderColor: '#E8D5C4',
                      }
                    : {
                        background: 'linear-gradient(135deg, #0F1117 0%, #1A1D2E 100%)',
                        borderColor: '#334155',
                      }
                }
              >
                <div className="flex h-full items-center gap-2 px-3">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: '#F47920' }}
                  />
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: '#1E2D6B' }}
                  />
                  <span
                    className="h-2 w-8 rounded-full"
                    style={{ background: t === 'light' ? '#1A1A2E' : '#F1F5F9' }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[color:var(--f92-dark)]">
                  {t === 'light' ? 'Light' : 'Dark'}
                </span>
                {theme === t ? (
                  <span className="text-xs text-[color:var(--f92-orange)]">Active</span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Change password</h2>
          <p className="text-sm text-[color:var(--f92-gray)]">Update the password you use to sign in.</p>
        </div>
        <form onSubmit={handleChangePassword} className="grid gap-4 lg:grid-cols-3">
          <div>
            <Label htmlFor="currentPassword">Current password</Label>
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="newPassword">New password</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="lg:col-span-3 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? 'Updating...' : 'Update password'}
            </Button>
            {passwordMessage ? <p className="text-sm text-[color:var(--f92-navy)]">{passwordMessage}</p> : null}
            {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
