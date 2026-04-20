'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UserAvatar, AVATAR_PALETTE, DEFAULT_AVATAR_COLOR } from '@/components/layout/user-avatar';

interface ProfileData {
  id: string;
  email: string;
  display_name: string;
  color_preference: string | null;
  role: 'admin' | 'read_only';
}

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_AVATAR_COLOR);
  const [loading, setLoading] = useState(true);
  const [savingColor, setSavingColor] = useState(false);
  const [colorMessage, setColorMessage] = useState<string | null>(null);

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
        .select('id, email, display_name, color_preference, role')
        .eq('id', session.user.id)
        .single();
      if (data) {
        const p = data as ProfileData;
        setProfile(p);
        setColor(p.color_preference || DEFAULT_AVATAR_COLOR);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function saveColor(nextColor: string) {
    if (!profile) return;
    setSavingColor(true);
    setColorMessage(null);
    const { error } = await supabase
      .from('user_profiles')
      .update({ color_preference: nextColor })
      .eq('id', profile.id);
    setSavingColor(false);
    if (error) {
      setColorMessage(`Error: ${error.message}`);
      return;
    }
    setColor(nextColor);
    setColorMessage('Avatar color updated.');
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
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">Personalize your avatar and manage your password.</p>
      </div>

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <UserAvatar displayName={profile.display_name} color={color} size="lg" />
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">{profile.display_name}</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[color:var(--f92-gray)]">
                {profile.role === 'admin' ? 'Administrator' : 'Read only'}
              </p>
            </div>
          </div>

          <div className="lg:ml-auto">
            <Label className="mb-2 block">Avatar color</Label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_PALETTE.map(swatch => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => saveColor(swatch)}
                  disabled={savingColor}
                  className={`h-10 w-10 rounded-full border-2 transition ${color === swatch ? 'border-[color:var(--f92-dark)] scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: swatch }}
                  aria-label={`Select color ${swatch}`}
                />
              ))}
            </div>
            {colorMessage ? (
              <p className="mt-2 text-xs text-[color:var(--f92-gray)]">{colorMessage}</p>
            ) : null}
          </div>
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
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
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
