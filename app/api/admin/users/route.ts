import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase/server';

const LOCAL_EMAIL_SUFFIX = '@cqip.local';

function sanitizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

async function requireAdmin(): Promise<
  | { ok: true; userId: string }
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

  return { ok: true, userId: user.id };
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json();
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

    const profile = await supabaseAdmin.from('user_profiles').insert({
      id: data.user?.id,
      email: finalEmail,
      display_name,
      role,
      is_active: true,
    });

    if (profile.error) {
      return NextResponse.json({ error: profile.error.message }, { status: 500 });
    }

    if (!isLocal) {
      await supabaseAdmin.auth.resetPasswordForEmail(finalEmail);
    }

    return NextResponse.json({ success: true, user: data.user?.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to create user.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const { id, is_active, role, action } = body;

  if (!id) {
    return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
  }

  try {
    if (action === 'reset_password') {
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
          { error: 'Local accounts cannot receive reset emails. Set the password directly.' },
          { status: 400 },
        );
      }

      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(profile.email);
      if (resetError) {
        return NextResponse.json({ error: resetError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    const updates: Record<string, any> = {};
    if (typeof is_active === 'boolean') {
      updates.is_active = is_active;
    }
    if (role) {
      updates.role = role;
    }

    if (Object.keys(updates).length > 0) {
      const { error: profileError } = await supabaseAdmin.from('user_profiles').update(updates).eq('id', id);
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }
    }

    if (role) {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: { role },
      });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to deactivate user.' }, { status: 500 });
  }
}
