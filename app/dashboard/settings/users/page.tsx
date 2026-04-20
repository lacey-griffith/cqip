'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

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
  const [accountType, setAccountType] = useState<'email' | 'local'>('email');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'read_only'>('read_only');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
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
    if (!displayName.trim()) {
      setMessage('Display name is required.');
      return;
    }

    if (accountType === 'email' && !email.trim()) {
      setMessage('Email is required for email accounts.');
      return;
    }

    if (accountType === 'local') {
      if (!username.trim()) {
        setMessage('Username is required for local accounts.');
        return;
      }
      if (password.length < 8) {
        setMessage('Password must be at least 8 characters.');
        return;
      }
    }

    try {
      setSaving(true);
      setMessage(null);
      setError(null);

      const payload: Record<string, unknown> = {
        display_name: displayName,
        role,
        account_type: accountType,
      };

      if (accountType === 'email') {
        payload.email = email;
      } else {
        payload.username = username;
        payload.password = password;
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to create user.');
      }

      setMessage(
        accountType === 'email'
          ? 'User created. A password reset link was emailed to them.'
          : 'Local account created successfully.',
      );
      setEmail('');
      setUsername('');
      setPassword('');
      setDisplayName('');
      setRole('read_only');
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

  function formatAccount(user: UserProfile): string {
    return user.email.endsWith(LOCAL_SUFFIX)
      ? `${user.email.slice(0, -LOCAL_SUFFIX.length)} (local)`
      : user.email;
  }

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
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">User Management</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">Create users, assign roles, and manage account access for your CRO team.</p>
      </div>

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Create account</h2>
          <p className="text-sm text-[color:var(--f92-gray)]">
            Invite via email (recommended) or create a local username/password account for users without email.
          </p>
        </div>

        <div className="mb-5">
          <Label>Account type</Label>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant={accountType === 'email' ? 'default' : 'outline'}
              onClick={() => setAccountType('email')}
            >
              Email invite
            </Button>
            <Button
              type="button"
              variant={accountType === 'local' ? 'default' : 'outline'}
              onClick={() => setAccountType('local')}
            >
              Local (username + password)
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {accountType === 'email' ? (
            <div>
              <Label htmlFor="inviteEmail">Email</Label>
              <Input id="inviteEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="inviteUsername">Username</Label>
                <Input
                  id="inviteUsername"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="lowercase letters, numbers, . _ -"
                />
              </div>
              <div>
                <Label htmlFor="invitePassword">Password</Label>
                <Input
                  id="invitePassword"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8+ characters"
                />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="inviteName">Display name</Label>
            <Input id="inviteName" value={displayName} onChange={e => setDisplayName(e.target.value)} />
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
            {saving ? 'Creating...' : accountType === 'email' ? 'Send invite' : 'Create local account'}
          </Button>
          {message && <p className="text-sm text-[color:var(--f92-dark)]">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Card>

      <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--f92-navy)]">Users</h2>
            <p className="text-sm text-[color:var(--f92-gray)]">Active accounts and access control for authenticated users.</p>
          </div>
          <Badge variant="default" className="text-sm">{users.length} users</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--f92-border)] text-left text-sm">
            <thead className="bg-[color:var(--f92-warm)] text-[color:var(--f92-dark)]">
              <tr>
                <th className="px-3 py-3 font-semibold">Name</th>
                <th className="px-3 py-3 font-semibold">Account</th>
                <th className="px-3 py-3 font-semibold">Role</th>
                <th className="px-3 py-3 font-semibold">Active</th>
                <th className="px-3 py-3 font-semibold">Created</th>
                <th className="px-3 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--f92-border)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[color:var(--f92-gray)]">Loading users...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[color:var(--f92-gray)]">No users found.</td>
                </tr>
              ) : users.map(user => {
                const isLocal = user.email.endsWith(LOCAL_SUFFIX);
                return (
                  <tr key={user.id} className="hover:bg-[color:var(--f92-warm)]">
                    <td className="px-3 py-3">{user.display_name}</td>
                    <td className="px-3 py-3 text-xs">{formatAccount(user)}</td>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resetPassword(user.id)}
                        disabled={isLocal || resettingId === user.id}
                        title={isLocal ? 'Local accounts cannot receive reset emails' : 'Send password reset email'}
                      >
                        {resettingId === user.id ? 'Sending...' : 'Reset password'}
                      </Button>
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
