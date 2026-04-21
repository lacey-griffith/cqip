'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
}

const LOCAL_SUFFIX = '@cqip.local';

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [username, setUsername] = useState('');
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
  const [showInactive, setShowInactive] = useState(false);

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
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, display_name, role, is_active, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers((data as UserProfile[]) || []);
    } catch (err) {
      console.error(err);
      setError('Unable to load user list.');
    } finally {
      setLoading(false);
    }
  }

  async function createUser() {
    const normalized = username.trim().toLowerCase();
    if (!normalized || !/^[a-z0-9._-]+$/.test(normalized)) {
      setMessage('Username must be lowercase letters, numbers, or . _ - only.');
      return;
    }
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      setError(null);

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: 'local',
          username: normalized,
          password,
          display_name: capitalizeName(normalized),
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
          email: `${normalized}${LOCAL_SUFFIX}`,
          display_name: capitalizeName(normalized),
          role,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        setUsers(prev => [optimistic, ...prev.filter(u => u.id !== optimistic.id)]);
      }

      setMessage(`Account created. ${normalized} can now sign in with the password you set.`);
      setUsername('');
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
          Create username/password accounts for your CRO team. Users sign in with their username only.
        </p>
      </div>

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Create account</h2>
          <p className="text-sm text-[color:var(--f92-gray)]">
            Usernames are lowercase first names (e.g. <code>lacey</code>, <code>xandor</code>).
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <Label htmlFor="inviteUsername">Username</Label>
            <Input
              id="inviteUsername"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
            />
          </div>
          <div>
            <Label htmlFor="invitePassword">Password</Label>
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
                <th className="px-3 py-3 font-semibold">Created</th>
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
                return (
                  <tr key={user.id} className={cnRow(user)}>
                    <td className="px-3 py-3 font-medium">{capitalizeName(user.display_name)}</td>
                    <td className="px-3 py-3">
                      <Select value={user.role} onValueChange={(value: 'admin' | 'read_only') => updateUser(user.id, { role: value })}>
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
                        />
                        <Label htmlFor={`active-${user.id}`} className="text-xs">
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Label>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-[color:var(--f92-gray)]">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resetPassword(user.id)}
                          disabled={isLocal || resettingId === user.id}
                          title={isLocal ? 'Local accounts cannot receive reset emails' : 'Send password reset email'}
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
