/* eslint-disable @typescript-eslint/no-require-imports */
// prebuild hook — stamps the current git SHA and timestamp into
// .env.production.local so the app can surface 'which build is live' on
// the admin System Info page (Cloudflare deploy verification).
//
// Runs as part of `npm run build` via the prebuild script in package.json.
// .env.production.local is gitignored (covered by .env* rule).
// CJS require() because this file is executed by plain `node` before any
// bundler / TS transform runs; the project's package.json doesn't declare
// "type": "module".

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let sha = 'unknown';
try {
  sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
} catch {
  // Not a git checkout, or git isn't available. Fall through to 'unknown'.
}

const timestamp = new Date().toISOString();

const envPath = path.join(process.cwd(), '.env.production.local');
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

// Strip any prior build-info lines, then append fresh ones. Idempotent across
// repeated builds.
const cleaned = existing
  .split('\n')
  .filter(l => !l.startsWith('NEXT_PUBLIC_BUILD_'))
  .join('\n')
  .trim();

const next = [
  cleaned,
  `NEXT_PUBLIC_BUILD_COMMIT=${sha}`,
  `NEXT_PUBLIC_BUILD_TIME=${timestamp}`,
]
  .filter(Boolean)
  .join('\n') + '\n';

fs.writeFileSync(envPath, next);
console.log(`[build-info] commit=${sha} time=${timestamp}`);
