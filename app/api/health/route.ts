import { NextResponse } from 'next/server';

// Lightweight, public, dependency-free health probe (Batch 011).
//
// Purpose: give the auto-deploy workflow's post-deploy smoke check a real
// health signal instead of pinging /login. Intentionally has NO auth — the
// workflow must be able to hit it without credentials.
//
// Hard constraints (see docs/batch-011-spec.md §2):
//   - No DB query, no Supabase call, no Graph call. Must stay fast so the
//     smoke check has meaningful signal and never times out behind a slow
//     dependency.
//   - Always returns 200. If the handler itself fails to execute, the
//     workflow's HTTP fetch fails — that IS the health signal.
//   - No-store so an edge/CDN layer can't serve a stale "ok" for a wedged
//     Worker.
//
// `force-dynamic` keeps this evaluated per-request (fresh timestamp, never
// statically prerendered at build time).
export const dynamic = 'force-dynamic';

export async function GET() {
  // version: prefer the build-stamped commit (scripts/gen-build-info.js
  // writes NEXT_PUBLIC_BUILD_COMMIT during prebuild — the only source
  // actually populated in this Workers deploy), then the spec's documented
  // fallbacks, then "unknown". Never crash if none are set.
  const version =
    process.env.NEXT_PUBLIC_BUILD_COMMIT ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    'unknown';

  const environment =
    process.env.NODE_ENV || process.env.ENVIRONMENT || 'unknown';

  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version,
      environment,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
