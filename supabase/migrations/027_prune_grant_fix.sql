-- Batch telemetry-ac — follow-up to migration 026.
--
-- 026 tried to lock down prune_ac_telemetry() with:
--     REVOKE ALL ON FUNCTION public.prune_ac_telemetry() FROM PUBLIC;
--     GRANT EXECUTE ON FUNCTION public.prune_ac_telemetry() TO service_role;
--
-- THAT WAS INSUFFICIENT, and it was verified insufficient against production
-- immediately after 026 was applied: an anon-key POST to
-- /rest/v1/rpc/prune_ac_telemetry still returned 200
-- {"telemetry_deleted":0,"rejects_deleted":0}.
--
-- Why: Supabase ships ALTER DEFAULT PRIVILEGES granting EXECUTE on new
-- functions in the `public` schema to `anon` and `authenticated`. Those are
-- EXPLICIT grants to named roles, not the implicit PUBLIC grant, so
-- REVOKE ... FROM PUBLIC does not remove them. The 026 REVOKE was correct but
-- addressed only one of the two grant sources.
--
-- Impact today: none, and the observed (0,0) is exactly the analysis Karen
-- gave when she raised this — SECURITY INVOKER + RLS enabled + no DELETE
-- policy for anon means the deletes match zero rows and the COUNT(*) is
-- RLS-filtered. So the function leaks nothing and destroys nothing. The defect
-- is that 026 CLAIMED to have closed the hole and had not: the safety still
-- rests entirely on "no DELETE policy exists", which is one future
-- admin-cleanup migration away from being false.
--
-- 026 is left untouched — it has already been applied, and editing an applied
-- migration makes the file disagree with what actually ran.
--
-- Idempotent.

REVOKE ALL ON FUNCTION public.prune_ac_telemetry() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prune_ac_telemetry() FROM anon;
REVOKE ALL ON FUNCTION public.prune_ac_telemetry() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.prune_ac_telemetry() TO service_role;

-- Verify after applying (should be 401/403, NOT 200):
--   curl -X POST "$SUPABASE_URL/rest/v1/rpc/prune_ac_telemetry" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--     -H "Content-Type: application/json" -d '{}'
--
-- And the ingest path must still work (service role), so re-check:
--   curl -X POST "$SUPABASE_URL/rest/v1/rpc/prune_ac_telemetry" \
--     -H "apikey: $SERVICE_ROLE" -H "Authorization: Bearer $SERVICE_ROLE" \
--     -H "Content-Type: application/json" -d '{}'
--   → 200 {"telemetry_deleted":N,"rejects_deleted":M}
