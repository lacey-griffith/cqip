import type { SupabaseClient } from '@supabase/supabase-js';

// Canonical server-side derivation of `changed_by` for audit_log writes.
// Per CLAUDE.md §13 rule 19, every audit write must derive this value
// from auth.uid() — the request body is not trusted.
//
// Resolution order: user_profiles.email → auth.users.email → 'unknown'.
// We never throw — if a logged-in admin happens to be missing a
// user_profiles row (legacy data, race during onboarding) the audit row
// still lands with a useful identifier rather than blocking the
// underlying mutation.
//
// Pass the cookie-bound client (createSupabaseRouteClient). Service-role
// clients have no auth.uid() context and would return null here.

export async function getChangedBy(supabase: SupabaseClient): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No authenticated user for audit write');
  }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('id', user.id)
    .maybeSingle();
  return profile?.email ?? user.email ?? 'unknown';
}
