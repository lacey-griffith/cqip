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

  // Admin-route gating (Batch 004.8, §13 rule 24) + forced-change gate
  // (Batch auth.2). Both need a user_profiles lookup for an authenticated
  // dashboard request, so we do ONE round-trip and serve both from it.
  //
  // Forced-change gate: a user with must_change_password = TRUE (an admin
  // issued them a temp password) is pinned to the change-password screen
  // (/dashboard/settings/profile) until they change it and the flag clears.
  // This runs BEFORE the admin gate so a flagged admin is sent to profile
  // rather than bounced from an admin settings page.
  //
  // Admin gate: the settings pages each run their own client-side isAdmin
  // check, but the URLs were browseable. Server-side gate, scoped to
  // admin-only paths. /dashboard/settings/profile is carved out — every
  // user (admin or read_only) edits their own theme / avatar / password there.
  //
  // Scenarios:
  //   read_only on /dashboard/coverage          → pass (not /settings, no flag)
  //   flagged user on /dashboard/anything       → redirect to /settings/profile
  //   flagged user on /dashboard/settings/profile → pass (the change screen)
  //   read_only on /dashboard/settings/profile  → pass (carved out)
  //   read_only on /dashboard/settings/users    → redirect to /dashboard
  //   admin on /dashboard/settings/users        → pass
  //   logged out on /dashboard/anything         → redirect to /login (handled above)
  //   logged in on /login                       → redirect to /dashboard (handled above)
  const isProfilePage = pathname === '/dashboard/settings/profile';
  const isAdminSettingsPath =
    pathname.startsWith('/dashboard/settings') && !isProfilePage;

  if (isDashboard && user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_active, must_change_password')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.must_change_password && !isProfilePage) {
      const changePasswordUrl = request.nextUrl.clone();
      changePasswordUrl.pathname = '/dashboard/settings/profile';
      changePasswordUrl.search = '';
      changePasswordUrl.searchParams.set('mustChangePassword', '1');
      return NextResponse.redirect(changePasswordUrl);
    }

    if (isAdminSettingsPath && (!profile || profile.role !== 'admin' || !profile.is_active)) {
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
    // Negative lookahead — paths that must NOT run middleware:
    //   _next/static, _next/image, favicon, static images: build artifacts
    //   api/sharepoint, api/brands, api/monitoring: each authenticates via
    //     its own Bearer token (CQIP_SHAREPOINT_API_TOKEN /
    //     CQIP_BRANDS_API_TOKEN / CQIP_CONVERT_MONITORING_TOKEN) and never reads
    //     the Supabase session cookie. Without the carveout every external
    //     call paid a supabase.auth.getUser() round-trip and gained a
    //     Supabase-availability dependency on a token-gated path.
    //     (Karen review, 2026-05-28; api/monitoring added Batch 012 Phase B.)
    //     NOTE: only the external INGEST lives under /api/monitoring; the
    //     admin status route is /api/admin/monitoring/* and is intentionally
    //     NOT carved out — it uses the session cookie + admin gate.
    '/((?!_next/static|_next/image|favicon.ico|api/sharepoint|api/brands|api/monitoring|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$).*)',
  ],
};
