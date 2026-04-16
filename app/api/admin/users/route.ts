import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, display_name, role } = body;

  if (!email || !display_name || !role) {
    return NextResponse.json({ error: 'Email, display name, and role are required.' }, { status: 400 });
  }

  try {
    const password = `Cqip!${Math.random().toString(36).slice(2, 10)}A`;
    const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
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
      email,
      display_name,
      role,
      is_active: true,
    });

    if (profile.error) {
      return NextResponse.json({ error: profile.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data.user?.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to create user.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, is_active, role } = body;

  if (!id) {
    return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
  }

  try {
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
