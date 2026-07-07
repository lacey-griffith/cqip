import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';
import { getChangedBy } from '@/lib/audit/get-changed-by';

const LOCAL_EMAIL_SUFFIX = '@cqip.local';

type RouteClient = Awaited<ReturnType<typeof createSupabaseRouteClient>>;

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

// [Jenny H2] auth.1 email migration: an admin may edit their OWN email (Lacey
// migrates herself first) but not another admin's. Self is always allowed;
// otherwise fall back to the read-only-only rule.
async function assertTargetIsReadOnlyOrSelf(id: string, callerId: string): Promise<NextResponse | null> {
  if (id === callerId) return null;
  return assertTargetIsReadOnly(id);
}

// Loose RFC-ish email shape check. Deliberately permissive — auth.users is the
// real uniqueness/validity authority (updateUserById rejects malformed/dupes).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Centralized user-target audit write. Derives changed_by from the cookie-bound
// route client (§13 r19) and is fully try/caught so a getChangedBy() throw or an
// audit-insert failure can never fail a mutation that already succeeded
// [Karen LOW — match /api/account/password-changed]. All rows are
// target_type='user'; action stays in the CHECK-allowed set (CREATE/UPDATE)
// with a descriptive field_name (no 'email_change'/'password_reset' literals).
type UserAuditRow = {
  target_id: string;
  action: 'CREATE' | 'UPDATE';
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
};

async function writeUserAudit(routeClient: RouteClient, rows: UserAuditRow[]) {
  if (rows.length === 0) return;
  try {
    const changedBy = await getChangedBy(routeClient);
    const { error } = await supabaseAdmin.from('audit_log').insert(
      rows.map(r => ({
        log_entry_id: null,
        target_type: 'user',
        target_id: r.target_id,
        action: r.action,
        field_name: r.field_name,
        old_value: r.old_value,
        new_value: r.new_value,
        changed_by: changedBy,
        notes: r.notes,
      })),
    );
    if (error) console.warn('[admin/users audit] insert failed', error);
  } catch (err) {
    console.warn('[admin/users audit] skipped', err);
  }
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

// GET — admin-gated user list with last_sign_in_at + email drift (Batch auth.1
// §5). The client can't read auth.users.last_sign_in_at directly, so the page
// switches its list load to this service-role route.
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: profiles, error: profErr } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, display_name, role, is_active, created_at')
    .order('created_at', { ascending: false });
  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  // last_sign_in_at + the authoritative login email come from the Auth admin API.
  // TODO(auth.1): listUsers() paginates (default ~50/page). Fine at 7 users;
  //   page through perPage when the org outgrows one page.
  const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }
  const authById = new Map(authList.users.map(u => [u.id, u]));

  const users = (profiles ?? []).map(p => {
    const au = authById.get(p.id);
    const authEmail = au?.email ?? null;
    return {
      ...p,
      last_sign_in_at: au?.last_sign_in_at ?? null,
      auth_email: authEmail,
      // [Jenny M3] drift: profile email vs the login source of truth. Nearly
      // free — listUsers() is already fetched for last_sign_in_at.
      email_drift: !!authEmail && authEmail.toLowerCase() !== (p.email ?? '').toLowerCase(),
    };
  });

  return NextResponse.json({ users }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  warnIfClientChangedBy('POST', body, guard.userId);
  const { email, display_name, role, password } = body;

  if (!display_name || !role) {
    return NextResponse.json({ error: 'Display name and role are required.' }, { status: 400 });
  }

  // Batch create-flow: accounts are created with a REAL email — the login
  // identity (no more username@cqip.local mint). email_confirm:true marks it
  // confirmed WITHOUT sending anything (no-unsolicited-email rule); the admin
  // conveys the temp password out-of-band, and must_change_password forces a
  // change on first login (same model as the temp-password reset flow).
  const finalEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!finalEmail || !EMAIL_RE.test(finalEmail)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }
  if (finalEmail.endsWith(LOCAL_EMAIL_SUFFIX)) {
    return NextResponse.json({ error: `Email cannot use the ${LOCAL_EMAIL_SUFFIX} domain.` }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  try {
    const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        display_name,
        role,
      },
    });

    if (authError) {
      // Surface a duplicate email as a clean 409 (auth.users is the authority).
      const status = authError.message.toLowerCase().includes('already') ? 409 : 500;
      return NextResponse.json({ error: authError.message }, { status });
    }

    const newUserId = data.user?.id;

    const profile = await supabaseAdmin.from('user_profiles').insert({
      id: newUserId,
      email: finalEmail,
      display_name,
      role,
      is_active: true,
      must_change_password: true, // forced change on first login
    });

    if (profile.error) {
      return NextResponse.json({ error: profile.error.message }, { status: 500 });
    }

    // [Jenny finding 4] Audit the create. Server-derived changed_by (§13 r19).
    if (newUserId) {
      await writeUserAudit(guard.supabase, [{
        target_id: newUserId,
        action: 'CREATE',
        field_name: 'role',
        old_value: null,
        new_value: role,
        notes: `Account created for ${display_name}`,
      }]);
    }

    // No reset/invite email — no-unsolicited-email rule. Admin conveys the
    // temp password out-of-band; must_change_password gates first login.
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

      await writeUserAudit(guard.supabase, [{
        target_id: id,
        action: 'UPDATE',
        field_name: 'password',
        old_value: null,
        new_value: null, // never persist the temp password
        notes: 'Temp password issued by admin; user must change on next login.',
      }]);

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

      await writeUserAudit(guard.supabase, [{
        target_id: id,
        action: 'UPDATE',
        field_name: 'password',
        old_value: null,
        new_value: null,
        notes: 'Password reset email sent by admin.',
      }]);

      return NextResponse.json({ success: true });
    }

    // ---- Action: set/migrate email (Batch auth.1) -----------------------
    if (action === 'set_email') {
      // [Jenny H2] self-edit allowed; other admins blocked.
      const blocked = await assertTargetIsReadOnlyOrSelf(id, guard.userId);
      if (blocked) return blocked;

      const nextEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!nextEmail || !EMAIL_RE.test(nextEmail)) {
        return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
      }
      if (nextEmail.endsWith(LOCAL_EMAIL_SUFFIX)) {
        return NextResponse.json({ error: `Email cannot use the ${LOCAL_EMAIL_SUFFIX} domain.` }, { status: 400 });
      }

      const { data: before, error: beforeErr } = await supabaseAdmin
        .from('user_profiles')
        .select('email')
        .eq('id', id)
        .maybeSingle();
      if (beforeErr) {
        return NextResponse.json({ error: 'Unable to load the target user.' }, { status: 500 });
      }
      if (!before) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }
      const oldEmail = before.email ?? null;
      if (oldEmail && oldEmail.toLowerCase() === nextEmail) {
        return NextResponse.json({ error: 'That is already this account’s email.' }, { status: 400 });
      }

      // Duplicate pre-check for a clean 409 on the common case. Uses eq on the
      // already-lowercased nextEmail — ilike would treat '_' in an address as a
      // wildcard and false-match a different email (Karen LOW). auth.users.email
      // remains the real unique authority (its error is surfaced as 409 below).
      const { data: dup } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('email', nextEmail)
        .maybeSingle();
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: 'That email is already in use by another account.' }, { status: 409 });
      }

      // [Jenny M3] Ordered two-write, NO rollback machinery. Auth first: it's
      // the login source of truth, so if the profile write fails the user can
      // still sign in with the new email (they were told out-of-band) — the
      // recoverable state is the failure-landing state. email_confirm:true
      // marks it confirmed WITHOUT sending anything.
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
        email: nextEmail,
        email_confirm: true,
      });
      if (authErr) {
        // Auth write failed → nothing changed on the login side; safe hard fail.
        return NextResponse.json(
          { error: `Failed to update the login email: ${authErr.message}` },
          { status: authErr.message.toLowerCase().includes('already') ? 409 : 500 },
        );
      }

      // Profile write, retried once [M3]. On persistent failure, auth.users is
      // already the new email while user_profiles is stale — recovery reads
      // user_profiles.email, so surface loudly which side won. No rollback.
      let profileErr = (await supabaseAdmin.from('user_profiles').update({ email: nextEmail }).eq('id', id)).error;
      if (profileErr) {
        profileErr = (await supabaseAdmin.from('user_profiles').update({ email: nextEmail }).eq('id', id)).error;
      }
      if (profileErr) {
        console.error('[admin/users set_email] auth updated but profile write failed', profileErr);
        return NextResponse.json({
          error: `Login email updated to ${nextEmail}, but the profile record still shows ${oldEmail ?? '(none)'}. They can sign in with the new email now; password recovery may use the old address until this is reconciled — retry the email edit.`,
        }, { status: 500 });
      }

      // Audit: action='UPDATE' + field_name='email' (NOT a literal 'email_change'
      // — same audit_log.action CHECK reason as auth.2).
      await writeUserAudit(guard.supabase, [{
        target_id: id,
        action: 'UPDATE',
        field_name: 'email',
        old_value: oldEmail,
        new_value: nextEmail,
        notes: 'Email migrated (auth.1).',
      }]);

      return NextResponse.json({ success: true, email: nextEmail });
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

      const auditRows: UserAuditRow[] = [];
      if (role && before && before.role !== role) {
        auditRows.push({
          target_id: id,
          action: 'UPDATE',
          field_name: 'role',
          old_value: before.role ?? null,
          new_value: role,
          notes: null,
        });
      }
      if (typeof is_active === 'boolean' && before && before.is_active !== is_active) {
        auditRows.push({
          target_id: id,
          action: 'UPDATE',
          field_name: 'is_active',
          old_value: String(before.is_active),
          new_value: String(is_active),
          notes: null,
        });
      }
      await writeUserAudit(guard.supabase, auditRows);
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

    await writeUserAudit(guard.supabase, [{
      target_id: id,
      action: 'UPDATE',
      field_name: 'is_active',
      old_value: 'true',
      new_value: 'false',
      notes: 'Account deactivated (sign-in banned).',
    }]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to deactivate user.' }, { status: 500 });
  }
}
