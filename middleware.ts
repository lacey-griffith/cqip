import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isDashboard = pathname.startsWith('/dashboard');
  const isLogin = pathname === '/login';

  if (isDashboard && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLogin && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  // Admin-route gating (Batch 004.8, §13 rule 24). The settings pages each
  // run their own client-side isAdmin check and render "Admin access required"
  // for non-admins, but the URLs were browseable — a guest hitting a
  // bookmarked link landed on a useless page. Server-side gate, scoped to
  // admin-only paths so the extra DB round-trip never fires for reads of
  // /dashboard/coverage, /logs, /reports, etc.
  //
  // /dashboard/settings/profile is carved out — every user (admin or
  // read_only) edits their own theme / avatar / password there.
  //
  // Scenarios:
  //   read_only on /dashboard/coverage         → pass (not /settings)
  //   read_only on /dashboard/settings/profile → pass (carved out)
  //   read_only on /dashboard/settings/users   → redirect to /dashboard
  //   admin on /dashboard/settings/users       → pass
  //   logged out on /dashboard/anything        → redirect to /login (handled above)
  //   logged in on /login                      → redirect to /dashboard (handled above)
  const isAdminSettingsPath =
    pathname.startsWith('/dashboard/settings') &&
    !pathname.startsWith('/dashboard/settings/profile');

  if (isAdminSettingsPath && user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.role !== 'admin' || !profile.is_active) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      dashboardUrl.search = '';
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$).*)',
  ],
};
