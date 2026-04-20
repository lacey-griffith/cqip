import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error('Missing Supabase server environment variables');
}

// Service-role client. Bypasses RLS. Never invoke on behalf of an unauthenticated
// request — always gate mutations with a prior cookie-based admin check.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// Cookie-bound server client for Route Handlers and Server Components. Use this
// to act as the currently-authenticated browser session (subject to RLS).
export async function createSupabaseRouteClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component, where cookies() is readonly.
          // The middleware refresh path is authoritative for cookie rotation.
        }
      },
    },
  });
}
