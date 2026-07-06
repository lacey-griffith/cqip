import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';

const LOCAL_EMAIL_SUFFIX = '@cqip.local';

type RouteClient = Awaited<ReturnType<typeof createSupabaseRouteClient>>;

function sanitizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

// Batch auth.2: server-generated temp password. Never client-supplied,
// never logged, never persisted. Alphanumeric with ambiguous glyphs
// (0/O, 1/l/I) dropped so it survives copy/paste over a chat channel.
// 20 chars over a 54-symbol alphabet ≈ 115 bits of entropy.
function generateTempPassword(): string {
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
}

async function requireAdmin(): Promise<
  | { ok: true; userId: string; supabase: RouteClient }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile || profile.role !== 'admin' || !profile.is_active) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, supabase };
}

// [Jenny H1/H2] Every state-changing surface (temp-pw, reset, role, is_active,
// deactivate) refuses admin targets — "the app never resets/mutates an admin".
// Returns a NextResponse to short-circuit on failure, or null when the target
// is a read_only account and the caller may proceed. auth.1's set_email uses a
// separate OrSelf guard so admins can migrate their own email.
async function assertTargetIsReadOnly(id: string): Promise<NextResponse | null> {
  const { data: target, error } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Unable to verify target user.' }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }
  if (target.role === 'admin') {
    return NextResponse.json(
      { error: 'This action is not allowed on admin accounts. Admin accounts are managed out-of-band.' },
      { status: 403 },
    );
  }
  return null;
}

// [§13 r19] Never trust a client-supplied changed_by. Warn + discard.
function warnIfClientChangedBy(scope: string, body: unknown, uid: string) {
  if (body && typeof body === 'object' && 'changed_by' in body) {
    console.warn(`[admin/users ${scope}] ignored client-supplied changed_by`, {
      attempted: body.changed_by,
      uid,
    });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  warnIfClientChangedBy('POST', body, guard.userId);
  const { email, username, display_name, role, password, account_type } = body;

  if (!display_name || !role) {
    return NextResponse.json({ error: 'Display name and role are required.' }, { status: 400 });
  }

  const isLocal = account_type === 'local';

  try {
    let finalEmail: string;
    let finalPassword: string;

    if (isLocal) {
      const normalized = sanitizeUsername(username || '');
      if (!normalized) {
        return NextResponse.json({ error: 'A valid username is required for local accounts.' }, { status: 400 });
      }
      if (!password || password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
      }
      finalEmail = `${normalized}${LOCAL_EMAIL_SUFFIX}`;
      finalPassword = password;
    } else {
      if (!email) {
        return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
      }
      finalEmail = email;
      finalPassword = `Cqip!${Math.random().toString(36).slice(2, 10)}A`;
    }

    const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password: finalPassword,
      email_confirm: true,
      user_metadata: {
        display_name,
        role,
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const newUserId = data.user?.id;

    const profile = await supabaseAdmin.from('user_profiles').insert({
      id: newUserId,
      email: finalEmail,
      display_name,
      role,
      is_active: true,
    });

    if (profile.error) {
      return NextResponse.json({ error: profile.error.message }, { status: 500 });
    }

    // [Jenny finding 4] Audit the create. Server-derived changed_by (§13 r19).
    if (newUserId) {
      const changedBy = await getChangedBy(guard.supabase);
      const { error: auditErr } = await supabaseAdmin.from('audit_log').insert({
        log_entry_id: null,
        target_type: 'user',
        target_id: newUserId,
        action: 'CREATE',
        field_name: 'role',
        old_value: null,
        new_value: role,
        changed_by: changedBy,
        notes: `Account created for ${display_name}`,
      });
      if (auditErr) {
        console.warn('[admin/users POST] audit insert failed', auditErr);
      }
    }

    if (!isLocal) {
      await supabaseAdmin.auth.resetPasswordForEmail(finalEmail);
    }

    return NextResponse.json({ success: true, user: newUserId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to create user.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  warnIfClientChangedBy('PATCH', body, guard.userId);
  const { id, is_active, role, action } = body;

  if (!id) {
    return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
  }

  try {
    // ---- Action: admin-issued temp password (Batch auth.2) --------------
    if (action === 'set_temp_password') {
      const blocked = await assertTargetIsReadOnly(id);
      if (blocked) return blocked;

      const tempPassword = generateTempPassword();

      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: tempPassword,
      });
      if (pwError) {
        return NextResponse.json({ error: pwError.message }, { status: 500 });
      }

      // Service role bypasses the r22 trigger (auth.uid() IS NULL).
      const { error: flagError } = await supabaseAdmin
        .from('user_profiles')
        .update({ must_change_password: true })
        .eq('id', id);
      if (flagError) {
        return NextResponse.json({ error: flagError.message }, { status: 500 });
      }

      const changedBy = await getChangedBy(guard.supabase);
      const { error: auditErr } = await supabaseAdmin.from('audit_log').insert({
        log_entry_id: null,
        target_type: 'user',
        target_id: id,
        action: 'UPDATE',
        field_name: 'password',
        old_value: null,
        new_value: null, // never persist the temp password
        changed_by: changedBy,
        notes: 'Temp password issued by admin; user must change on next login.',
      });
      if (auditErr) {
        console.warn('[admin/users set_temp_password] audit insert failed', auditErr);
      }

      // One-time display only — never cache the body.
      return NextResponse.json(
        { success: true, temp_password: tempPassword },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // ---- Action: email password reset link ------------------------------
    if (action === 'reset_password') {
      const blocked = await assertTargetIsReadOnly(id);
      if (blocked) return blocked;

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('email')
        .eq('id', id)
        .single();

      if (profileError || !profile?.email) {
        return NextResponse.json({ error: 'Unable to find user email.' }, { status: 404 });
      }

      if (profile.email.endsWith(LOCAL_EMAIL_SUFFIX)) {
        return NextResponse.json(
          { error: 'Local accounts cannot receive reset emails. Set a temp password instead.' },
          { status: 400 },
        );
      }

      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(profile.email);
      if (resetError) {
        return NextResponse.json({ error: resetError.message }, { status: 500 });
      }

      const changedBy = await getChangedBy(guard.supabase);
      const { error: auditErr } = await supabaseAdmin.from('audit_log').insert({
        log_entry_id: null,
        target_type: 'user',
        target_id: id,
        action: 'UPDATE',
        field_name: 'password',
        old_value: null,
        new_value: null,
        changed_by: changedBy,
        notes: 'Password reset email sent by admin.',
      });
      if (auditErr) {
        console.warn('[admin/users reset_password] audit insert failed', auditErr);
      }

      return NextResponse.json({ success: true });
    }

    // ---- Generic role / is_active update --------------------------------
    const updates: Record<string, unknown> = {};
    if (typeof is_active === 'boolean') {
      updates.is_active = is_active;
    }
    if (role) {
      updates.role = role;
    }

    if (Object.keys(updates).length > 0) {
      // [Jenny H1] Guard the generic branch too — role change + is_active in
      // BOTH directions. Promotion (read_only → admin) passes because the
      // target is still read_only at guard time; demoting/deactivating an
      // admin is refused.
      const blocked = await assertTargetIsReadOnly(id);
      if (blocked) return blocked;

      // Snapshot for audit old_values.
      const { data: before } = await supabaseAdmin
        .from('user_profiles')
        .select('role, is_active')
        .eq('id', id)
        .maybeSingle();

      const { error: profileError } = await supabaseAdmin.from('user_profiles').update(updates).eq('id', id);
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      if (role) {
        await supabaseAdmin.auth.admin.updateUserById(id, {
          user_metadata: { role },
        });
      }

      const changedBy = await getChangedBy(guard.supabase);
      const auditRows: Record<string, unknown>[] = [];
      if (role && before && before.role !== role) {
        auditRows.push({
          log_entry_id: null,
          target_type: 'user',
          target_id: id,
          action: 'UPDATE',
          field_name: 'role',
          old_value: before.role ?? null,
          new_value: role,
          changed_by: changedBy,
          notes: null,
        });
      }
      if (typeof is_active === 'boolean' && before && before.is_active !== is_active) {
        auditRows.push({
          log_entry_id: null,
          target_type: 'user',
          target_id: id,
          action: 'UPDATE',
          field_name: 'is_active',
          old_value: String(before.is_active),
          new_value: String(is_active),
          changed_by: changedBy,
          notes: null,
        });
      }
      if (auditRows.length > 0) {
        const { error: auditErr } = await supabaseAdmin.from('audit_log').insert(auditRows);
        if (auditErr) {
          console.warn('[admin/users PATCH] audit insert failed', auditErr);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to update user.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let id: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    id = body?.id;
  } catch {
    /* fall through */
  }

  if (!id) {
    id = new URL(req.url).searchParams.get('id') ?? undefined;
  }

  if (!id) {
    return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
  }

  if (id === guard.userId) {
    return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
  }

  // [Jenny H1] Deactivation is a state-changing surface — refuse admin targets.
  const blocked = await assertTargetIsReadOnly(id);
  if (blocked) return blocked;

  try {
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({ is_active: false })
      .eq('id', id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Long ban effectively disables sign-in; reversible by re-activating.
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: '876000h',
    });

    if (banError) {
      console.warn('[admin/users DELETE] profile disabled but auth ban failed', banError);
    }

    const changedBy = await getChangedBy(guard.supabase);
    const { error: auditErr } = await supabaseAdmin.from('audit_log').insert({
      log_entry_id: null,
      target_type: 'user',
      target_id: id,
      action: 'UPDATE',
      field_name: 'is_active',
      old_value: 'true',
      new_value: 'false',
      changed_by: changedBy,
      notes: 'Account deactivated (sign-in banned).',
    });
    if (auditErr) {
      console.warn('[admin/users DELETE] audit insert failed', auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to deactivate user.' }, { status: 500 });
  }
}
