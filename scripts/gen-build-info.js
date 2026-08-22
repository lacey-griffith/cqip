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

// App version. package.json is the single source of truth — the System Info
// page previously hardcoded `APP_VERSION = 'v1.2'` while the CLAUDE.md footer
// said v2.7, i.e. the page rendered a version that had been wrong for five
// minor releases with nothing to catch it. Stamping it here turns a literal
// into a derived value; the only remaining coupling is package.json ↔ the
// CLAUDE.md footer, which §13 r23 already requires bumping together.
let appVersion = 'unknown';
try {
  appVersion = require(path.join(process.cwd(), 'package.json')).version || 'unknown';
} catch {
  // Fall through to 'unknown' rather than failing the build over a version string.
}

const envPath = path.join(process.cwd(), '.env.production.local');
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

// Strip any prior build-info lines, then append fresh ones. Idempotent across
// repeated builds.
// NOTE the second prefix: NEXT_PUBLIC_APP_VERSION does NOT start with
// NEXT_PUBLIC_BUILD_, so without stripping it explicitly it would be appended
// again on every build and the file would accumulate duplicates.
const cleaned = existing
  .split('\n')
  .filter(l => !l.startsWith('NEXT_PUBLIC_BUILD_') && !l.startsWith('NEXT_PUBLIC_APP_VERSION'))
  .join('\n')
  .trim();

const next = [
  cleaned,
  `NEXT_PUBLIC_BUILD_COMMIT=${sha}`,
  `NEXT_PUBLIC_BUILD_TIME=${timestamp}`,
  `NEXT_PUBLIC_APP_VERSION=${appVersion}`,
]
  .filter(Boolean)
  .join('\n') + '\n';

fs.writeFileSync(envPath, next);
console.log(`[build-info] commit=${sha} time=${timestamp} version=${appVersion}`);

// ---------------------------------------------------------------------------
// CLAUDE.md size ceiling — §13 r41. WARN ONLY, NEVER FAIL THE BUILD.
//
// A gate is the wrong instrument here twice over: docs-only commits skip CI via
// paths-ignore (§13 r30/r31), so a failing gate is unreachable on exactly the
// commits that grow this file — and destructive on the ones it does catch,
// since it would block a deploy over a documentation size.
//
// Unit is CHARACTERS, not bytes. This file's bytes run ~+1.0% over its
// characters (it is dense with em dashes, §, ⚠, ·), which is over a thousand
// at the boundary.
//
// The PER-SECTION breakdown is the load-bearing part: without it the reflex on
// a tripped ceiling is to roll §16 over, which does nothing when the growth was
// in §15 or the header.
// ---------------------------------------------------------------------------
const CLAUDE_MD_CEILING = 120000; // characters — §13 r41
try {
  const mdPath = path.join(__dirname, '..', 'CLAUDE.md');
  const md = fs.readFileSync(mdPath, 'utf8');
  const total = md.length;

  const lines = md.split('\n');
  const heads = [];
  lines.forEach((l, i) => { if (l.startsWith('## ')) heads.push([i, l.slice(3).trim()]); });
  const sections = heads.map(([i, name], n) => {
    const end = n + 1 < heads.length ? heads[n + 1][0] : lines.length;
    return { name, chars: lines.slice(i, end).join('\n').length };
  }).sort((a, b) => b.chars - a.chars);

  const pct = ((total / CLAUDE_MD_CEILING) * 100).toFixed(0);
  console.log(`[claude-md] ${total.toLocaleString()} chars / ${CLAUDE_MD_CEILING.toLocaleString()} ceiling (${pct}%)`);
  for (const s of sections.slice(0, 5)) {
    console.log(`[claude-md]   ${s.chars.toLocaleString().padStart(9)}  ${s.name.slice(0, 58)}`);
  }
  if (total > CLAUDE_MD_CEILING) {
    const over = total - CLAUDE_MD_CEILING;
    console.warn('');
    console.warn('  ⚠  CLAUDE.md IS OVER ITS SIZE CEILING (§13 r41)');
    console.warn(`     ${total.toLocaleString()} chars, ${over.toLocaleString()} over the ${CLAUDE_MD_CEILING.toLocaleString()} limit.`);
    console.warn(`     Largest section: ${sections[0].name} at ${sections[0].chars.toLocaleString()} chars.`);
    console.warn('     Roll the OLDEST §16 month out to docs/claude-archive/ — but check');
    console.warn('     the breakdown above first: if the growth is in §15 or the header,');
    console.warn('     rolling §16 over will not move the number.');
    console.warn('     Not failing the build — this is a warning by design (r41).');
    console.warn('');
  }
} catch (err) {
  // Never let a measurement break a build.
  console.warn(`[claude-md] size check skipped: ${err.message}`);
}
