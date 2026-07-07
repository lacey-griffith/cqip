'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { capitalizeName } from '@/lib/utils';
import { BackToSettings } from '@/components/ui/back-to-settings';

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'read_only';
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  auth_email?: string | null;
  email_drift?: boolean;
}

const LOCAL_SUFFIX = '@cqip.local';
const F92_DOMAIN = '@fusion92.com';

// Edit-email smart default (Batch auth-cleanup): a bare local part gets the
// fusion domain appended; anything containing '@' is treated as a full address
// verbatim (so non-F92 / correction accounts stay possible — a default, not a
// hard cage). Lowercased to match the server's normalization.
function toFusionEmail(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (!v) return '';
  return v.includes('@') ? v : `${v}${F92_DOMAIN}`;
}

// RFC-ish email shape check (mirrors the server's EMAIL_RE). auth.users is the
// real validity/uniqueness authority; this is just a friendly client gate.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Friendly display name derived from the email local part (Batch create-flow):
// separators → spaces, then title-cased. "lacey@…" → "Lacey";
// "first.last@…" → "First Last". Keeps display_name as the friendly name now
// that email is the login identity (no username field).
function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  return capitalizeName(local.replace(/[._-]+/g, ' '));
}

// Relative "last active" label. "Never" for accounts that have never signed in.
function relativeTimeFromNow(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Never';
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [createEmail, setCreateEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'read_only'>('read_only');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingTempId, setSettingTempId] = useState<string | null>(null);
  const [tempInfo, setTempInfo] = useState<{ id: string; displayName: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [emailEditor, setEmailEditor] = useState<{ id: string; displayName: string; currentEmail: string } | null>(null);
  const [emailValue, setEmailValue] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setCurrentUserId(session.user.id);
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      const admin = data?.role === 'admin';
      setIsAdmin(admin);
      if (admin) {
        loadUsers();
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      // Batch auth.1 §5: service-role route so we get last_sign_in_at +
      // email-drift (both need the Auth admin API, unreachable client-side).
      const response = await fetch('/api/admin/users');
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to load user list.');
      }
      setUsers((result.users as UserProfile[]) || []);
    } catch (err) {
      console.error(err);
      setError('Unable to load user list.');
    } finally {
      setLoading(false);
    }
  }

  async function createUser() {
    // Batch create-flow: email is the login identity (no more @cqip.local).
    // Bare local part → @fusion92.com; anything with '@' taken verbatim —
    // same smart default as edit-email.
    const effectiveEmail = toFusionEmail(createEmail);
    if (!effectiveEmail || !EMAIL_RE.test(effectiveEmail)) {
      setMessage('Enter a valid email address.');
      return;
    }
    if (effectiveEmail.endsWith(LOCAL_SUFFIX)) {
      setMessage('Email cannot use the @cqip.local domain.');
      return;
    }
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }

    const displayName = displayNameFromEmail(effectiveEmail);

    try {
      setSaving(true);
      setMessage(null);
      setError(null);

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: effectiveEmail,
          password,
          display_name: displayName,
          role,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to create user.');
      }

      // Optimistic insert so the new row shows up immediately.
      if (result.user) {
        const optimistic: UserProfile = {
          id: result.user,
          email: effectiveEmail,
          display_name: displayName,
          role,
          is_active: true,
          created_at: new Date().toISOString(),
          last_sign_in_at: null,
          auth_email: effectiveEmail,
          email_drift: false,
        };
        setUsers(prev => [optimistic, ...prev.filter(u => u.id !== optimistic.id)]);
      }

      setMessage(`Account created for ${effectiveEmail}. Share the password over a secure channel — they'll be prompted to set a new one on first sign-in.`);
      setCreateEmail('');
      setPassword('');
      setRole('read_only');

      // Reconcile with the server so we pick up any fields the server sets.
      loadUsers();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to create user.');
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(id: string, updates: Partial<Pick<UserProfile, 'role' | 'is_active'>>) {
    try {
      setMessage(null);
      setError(null);
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to update user.');
      }

      setMessage('User updated successfully.');
      setUsers(users.map(user => user.id === id ? { ...user, ...updates } as UserProfile : user));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to update user.');
    }
  }

  async function resetPassword(id: string) {
    try {
      setResettingId(id);
      setMessage(null);
      setError(null);
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reset_password' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to send reset link.');
      }
      setMessage('Password reset email sent.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to send reset link.');
    } finally {
      setResettingId(null);
    }
  }

  async function setTempPassword(user: UserProfile) {
    try {
      setSettingTempId(user.id);
      setMessage(null);
      setError(null);
      setCopied(false);
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, action: 'set_temp_password' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to set a temp password.');
      }
      setTempInfo({ id: user.id, displayName: user.display_name, password: result.temp_password });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to set a temp password.');
    } finally {
      setSettingTempId(null);
    }
  }

  async function copyTempPassword() {
    if (!tempInfo) return;
    try {
      await navigator.clipboard.writeText(tempInfo.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function openEmailEditor(user: UserProfile) {
    setEmailEditor({ id: user.id, displayName: user.display_name, currentEmail: user.email });
    setEmailValue(user.email.endsWith(LOCAL_SUFFIX) ? '' : user.email);
    setEmailError(null);
    setMessage(null);
    setError(null);
  }

  async function saveEmail() {
    if (!emailEditor) return;
    const effectiveEmail = toFusionEmail(emailValue);
    try {
      setEmailSaving(true);
      setEmailError(null);
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: emailEditor.id, action: 'set_email', email: effectiveEmail }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to update email.');
      }
      const newEmail: string = result.email ?? effectiveEmail;
      setUsers(prev => prev.map(u =>
        u.id === emailEditor.id
          ? { ...u, email: newEmail, auth_email: newEmail, email_drift: false }
          : u,
      ));
      setEmailEditor(null);
      setMessage(`Email updated to ${newEmail}. No email was sent — tell them their new sign-in address directly.`);
    } catch (err) {
      console.error(err);
      setEmailError(err instanceof Error ? err.message : 'Unable to update email.');
    } finally {
      setEmailSaving(false);
    }
  }

  async function deleteUser(user: UserProfile) {
    if (user.id === currentUserId) {
      setError('You cannot deactivate your own account.');
      return;
    }
    if (!window.confirm(`Deactivate ${user.display_name}? They will be signed out and blocked from signing in.`)) {
      return;
    }
    try {
      setDeletingId(user.id);
      setMessage(null);
      setError(null);
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to deactivate user.');
      }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: false } : u));
      setMessage(`${user.display_name} deactivated.`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to deactivate user.');
    } finally {
      setDeletingId(null);
    }
  }

  const visibleUsers = useMemo(
    () => (showInactive ? users : users.filter(u => u.is_active)),
    [users, showInactive],
  );

  const inactiveCount = users.filter(u => !u.is_active).length;

  if (isAdmin === false) {
    return (
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[color:var(--f92-dark)]">Admin access required</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">You do not have permission to view user management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackToSettings />
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">User Management</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
          Create accounts for your CRO team. Users sign in with their email address.
        </p>
      </div>

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Create account</h2>
          <p className="text-sm text-[color:var(--f92-gray)]">
            Enter the person&apos;s fusion email (a bare name gets <code>@fusion92.com</code>; type a full
            address for external accounts). They set a new password on first sign-in.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <Label htmlFor="inviteEmail">Email</Label>
            <div className="flex items-stretch overflow-hidden rounded-md border border-[color:var(--f92-border)] bg-white focus-within:ring-2 focus-within:ring-[color:var(--f92-orange)]">
              <input
                id="inviteEmail"
                type="text"
                autoComplete="off"
                placeholder="first.last"
                value={createEmail}
                onChange={e => setCreateEmail(e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[color:var(--f92-dark)] outline-none"
              />
              {createEmail.includes('@') ? null : (
                <span className="flex items-center whitespace-nowrap border-l border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] px-3 text-sm text-[color:var(--f92-gray)]">
                  {F92_DOMAIN}
                </span>
              )}
            </div>
            {createEmail.trim() ? (
              <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
                Will create: <span className="font-mono text-[color:var(--f92-dark)]">{toFusionEmail(createEmail)}</span>
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="invitePassword">Temporary password</Label>
            <PasswordInput
              id="invitePassword"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="8+ characters"
            />
          </div>
          <div>
            <Label htmlFor="inviteRole">Role</Label>
            <Select value={role} onValueChange={(value: 'admin' | 'read_only') => setRole(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="read_only">Read only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={createUser} disabled={saving}>
            {saving ? 'Creating...' : 'Create account'}
          </Button>
          {message && <p className="text-sm text-[color:var(--f92-dark)]">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Card>

      {tempInfo ? (
        <Card className="border-[color:var(--f92-orange)] bg-[color:var(--f92-warm)] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">
                Temp password for {capitalizeName(tempInfo.displayName)}
              </h2>
              <p className="text-sm text-[color:var(--f92-gray)]">
                Share this over a secure channel. It won&apos;t be shown again — they&apos;ll be prompted to set a new password on next sign-in.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setTempInfo(null); setCopied(false); }}
            >
              Dismiss
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <code className="rounded-lg border border-[color:var(--f92-border)] bg-white px-4 py-2 font-mono text-base tracking-wider text-[color:var(--f92-dark)]">
              {tempInfo.password}
            </code>
            <Button size="sm" onClick={copyTempPassword}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </Card>
      ) : null}

      {emailEditor ? (
        <Card className="border-[color:var(--f92-orange)] bg-[color:var(--f92-warm)] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">
                Edit email for {capitalizeName(emailEditor.displayName)}
              </h2>
              <p className="text-sm text-[color:var(--f92-gray)]">
                Current: <span className="font-mono">{emailEditor.currentEmail}</span>. Set the fusion address from the
                directory — <strong>no email is sent</strong>. They sign in with the new email and their existing password.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEmailEditor(null); setEmailError(null); }}
              disabled={emailSaving}
            >
              Cancel
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex w-full max-w-sm items-stretch overflow-hidden rounded-md border border-[color:var(--f92-border)] bg-white focus-within:ring-2 focus-within:ring-[color:var(--f92-orange)]">
              <input
                type="text"
                autoComplete="off"
                placeholder="first.last"
                value={emailValue}
                onChange={e => setEmailValue(e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[color:var(--f92-dark)] outline-none"
              />
              {emailValue.includes('@') ? null : (
                <span className="flex items-center whitespace-nowrap border-l border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] px-3 text-sm text-[color:var(--f92-gray)]">
                  {F92_DOMAIN}
                </span>
              )}
            </div>
            <Button size="sm" onClick={saveEmail} disabled={emailSaving || !emailValue.trim()}>
              {emailSaving ? 'Saving…' : 'Save email'}
            </Button>
          </div>
          {emailValue.trim() ? (
            <p className="mt-2 text-xs text-[color:var(--f92-gray)]">
              Will set: <span className="font-mono text-[color:var(--f92-dark)]">{toFusionEmail(emailValue)}</span>
              {emailValue.includes('@') ? ' (full address entered)' : ''}
            </p>
          ) : null}
          {emailError ? <p className="mt-3 text-sm text-red-600">{emailError}</p> : null}
        </Card>
      ) : null}

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Users</h2>
            <p className="text-sm text-[color:var(--f92-gray)]">Active accounts and access control for authenticated users.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="showInactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="showInactive" className="text-xs">
                Show inactive ({inactiveCount})
              </Label>
            </div>
            <Badge variant="default" className="text-sm">{visibleUsers.length} users</Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--f92-border)] text-left text-sm">
            <thead className="bg-[color:var(--f92-warm)] text-[color:var(--f92-dark)]">
              <tr>
                <th className="px-3 py-3 font-semibold">Username</th>
                <th className="px-3 py-3 font-semibold">Role</th>
                <th className="px-3 py-3 font-semibold">Active</th>
                <th className="px-3 py-3 font-semibold">Last active</th>
                <th className="px-3 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--f92-border)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[color:var(--f92-gray)]">Loading users...</td>
                </tr>
              ) : visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[color:var(--f92-gray)]">No users to show.</td>
                </tr>
              ) : visibleUsers.map(user => {
                const isLocal = user.email.endsWith(LOCAL_SUFFIX);
                const isSelf = user.id === currentUserId;
                // Batch auth.2: the app never mutates admin accounts (role /
                // active / reset / temp-pw / delete are all server-refused on
                // admin targets). Match the UI so admins aren't offered
                // controls that would 403. Promotion still works — a read_only
                // row keeps its enabled role select.
                const isAdminTarget = user.role === 'admin';
                // [Jenny H2] Email edit is allowed on read_only targets OR on
                // one's own account (admin self-migration) — mirrors the
                // server's assertTargetIsReadOnlyOrSelf.
                const canEditEmail = isSelf || !isAdminTarget;
                return (
                  <tr key={user.id} className={cnRow(user)}>
                    <td className="px-3 py-3 font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{capitalizeName(user.display_name)}</span>
                        {user.email_drift ? (
                          <span
                            className="inline-flex w-fit items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700"
                            title={`Login email (${user.auth_email ?? 'unknown'}) differs from the profile record (${user.email}). Re-save the email to reconcile.`}
                          >
                            ⚠ email drift
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Select
                        value={user.role}
                        onValueChange={(value: 'admin' | 'read_only') => updateUser(user.id, { role: value })}
                        disabled={isAdminTarget}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={user.role} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="read_only">Read only</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`active-${user.id}`}
                          checked={user.is_active}
                          onCheckedChange={(checked) => updateUser(user.id, { is_active: checked })}
                          disabled={isAdminTarget || isSelf}
                        />
                        <Label htmlFor={`active-${user.id}`} className="text-xs">
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Label>
                      </div>
                    </td>
                    <td
                      className="px-3 py-3 text-xs text-[color:var(--f92-gray)]"
                      title={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never signed in'}
                    >
                      {relativeTimeFromNow(user.last_sign_in_at)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {!isAdminTarget && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setTempPassword(user)}
                              disabled={settingTempId === user.id}
                              title="Generate a one-time temp password the user must change on next sign-in"
                            >
                              {settingTempId === user.id ? 'Setting…' : 'Set temp password'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resetPassword(user.id)}
                              disabled={isLocal || resettingId === user.id}
                              title={isLocal ? 'Local accounts cannot receive reset emails — use Set temp password' : 'Send password reset email'}
                            >
                              {resettingId === user.id ? 'Sending...' : 'Reset password'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteUser(user)}
                              disabled={isSelf || deletingId === user.id || !user.is_active}
                              title={isSelf ? 'You cannot deactivate your own account' : 'Deactivate account'}
                              className="text-red-600 hover:text-red-700"
                            >
                              {deletingId === user.id ? 'Deactivating...' : 'Delete'}
                            </Button>
                          </>
                        )}
                        {canEditEmail && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEmailEditor(user)}
                            disabled={emailSaving && emailEditor?.id === user.id}
                            title="Edit the sign-in email (no email is sent)"
                          >
                            Edit email
                          </Button>
                        )}
                        {isAdminTarget && !isSelf ? (
                          <span className="text-xs text-[color:var(--f92-gray)]">Managed out-of-band</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function cnRow(user: UserProfile): string {
  return user.is_active
    ? 'hover:bg-[color:var(--f92-warm)]'
    : 'bg-[color:var(--f92-tint)] opacity-60 hover:opacity-80';
}
