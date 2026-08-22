#!/usr/bin/env node
/**
 * Regenerates the "### Archive index" block inside CLAUDE.md §16 from the
 * actual archive files. GENERATED, NEVER HAND-MAINTAINED — a hand-kept index
 * is a third copy of state and drifts from the two it indexes, which is the
 * failure the 2026-08-22 CLAUDE.md split batch existed to remove.
 *
 *   node scripts/gen-archive-index.js          # rewrite the block
 *   node scripts/gen-archive-index.js --check  # exit 1 if stale (no write)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ARCHIVE = path.join(ROOT, 'docs', 'claude-archive');
const CLAUDE = path.join(ROOT, 'CLAUDE.md');
const START = '### Archive index';
const END = '\n---\n';

// Sort key: pre-04 first, then YYYY-MM ascending.
const monthKey = (f) => f.replace(/^CLAUDE-16-/, '').replace(/\.md$/, '');
const files = fs
  .readdirSync(ARCHIVE)
  .filter((f) => /^CLAUDE-16-.*\.md$/.test(f))
  .sort((a, b) => {
    const ka = monthKey(a), kb = monthKey(b);
    if (ka.includes('pre-')) return -1;
    if (kb.includes('pre-')) return 1;
    return ka.localeCompare(kb);
  });

const lines = [];
for (const f of files) {
  // Entry titles are `### ` headings; `## ` headings are the split batch's own
  // section wrappers and are deliberately not indexed.
  const titles = fs
    .readFileSync(path.join(ARCHIVE, f), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('### '))
    .map((l) => l.slice(4).trim());
  lines.push('');
  const n = titles.length;
  lines.push(`**[\`${f}\`](docs/claude-archive/${f})** — ${n} item${n === 1 ? '' : 's'}`);
  lines.push('');
  for (const t of titles) lines.push(`- ${t}`);
}

const block = `${START}\n${lines.join('\n')}\n`;
const claude = fs.readFileSync(CLAUDE, 'utf8');
const i = claude.indexOf(START);
if (i === -1) {
  console.error(`gen-archive-index: could not find "${START}" in CLAUDE.md`);
  process.exit(1);
}
const j = claude.indexOf(END, i);
if (j === -1) {
  console.error('gen-archive-index: could not find the block terminator');
  process.exit(1);
}
const next = claude.slice(0, i) + block + claude.slice(j + 1);

if (process.argv.includes('--check')) {
  if (next !== claude) {
    console.error('gen-archive-index: index is STALE — run `npm run archive:index`');
    process.exit(1);
  }
  console.log('gen-archive-index: index is current');
  process.exit(0);
}
fs.writeFileSync(CLAUDE, next);
console.log(
  `gen-archive-index: indexed ${files.length} archive files, ` +
    `${lines.filter((l) => l.startsWith('- ')).length} entries`
);
