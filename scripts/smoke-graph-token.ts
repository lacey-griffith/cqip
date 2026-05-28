// Smoke script: exercises lib/sharepoint/graph-client.getGraphToken()
// against Azure AD using the credentials in .env.local. Prints token
// metadata only (length + prefix); never echoes the full token.
//
// Retained per CC10 (build verification muscle) — doubles as a
// rotation verifier for AZURE_CLIENT_SECRET and as a self-check that
// the scaffolded graph-client still negotiates with Azure AD after
// any upstream change (Microsoft endpoint shape, library bump, etc.).
//
// Run: `npx tsx --env-file=.env.local scripts/smoke-graph-token.ts`

import { getGraphToken } from '../lib/sharepoint/graph-client';

async function main() {
  const start = Date.now();
  const token = await getGraphToken();
  const elapsedMs = Date.now() - start;
  console.log(
    JSON.stringify(
      {
        ok: true,
        token_prefix: token.slice(0, 12) + '...',
        token_length: token.length,
        elapsed_ms: elapsedMs,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('FAILED', {
    name: err?.name,
    message: err?.message,
    status: err?.status,
  });
  process.exit(1);
});
