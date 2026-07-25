// scripts/backfill-convert-reconciliation.ts
//
// One-off reconciliation backfill: flip existing Pulse matrix cell statuses to
// match Convert's real configuration (Batch 012 / the migration-024 tables
// `directives` + `directive_brand_status`).
//
// Source of record: docs/batch-012-convert-reconciliation-spec.md — a manual
// 2026-07-25 cross-reference of all 65 loaded goal directives against real
// Convert config exports for the 13 ACTIVE NBLY brands (paused MRR-CA / SHG /
// WDG deliberately excluded — see the spec's out-of-scope section).
//   215 cells: 207 upgrades (To do → Done, confirmed live in Convert)
//            +   8 downgrades (Done → To do, false positives — see below).
//
// THIS IS AN UPDATE PASS, NOT A CREATE PASS. Every (directive, brand) pair in
// the CSV already has a cell from the original bulk load. This script:
//   - creates NO directives, NO brands, NO cells
//   - touches NO schema (no migration), adds NO route
//   - hard-fails if a CSV pair does not resolve to an existing cell, rather
//     than silently skipping (an unresolved pair means the input is stale)
//
// Mirrors scripts/load-nbly-goal-directives.ts's shape and discipline:
//   - service-role client (bypasses RLS)
//   - --dry-run default-safe, prompt-before-write, --yes to skip the prompt
//   - idempotent: a cell already at its target status is skipped (logged, not
//     written, not counted as a change), so a re-run is a safe no-op
//   - one audit_log row per CHANGED cell (§13 r2). Until the Convert/Jira date
//     sync lands, this trail is the only record of WHEN a cell resolved
//     (docs/HANDOFF-goal-directives-load.md §7), so it is load-bearing, not
//     decoration. changed_by is the system attribution string per §13 r20.
//   - post-run self-verify: re-reads every written cell and asserts the DB
//     matches the plan; loud failure on mismatch (don't trust "no error").
//
// Gate profile: no schema change, no new route → no Jenny (same profile as the
// goal-directive load). Karen reviews the logic + spot-checks the mapping.
// DO NOT auto-run — Lacey approves and runs.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-convert-reconciliation.ts --dry-run
//       Parse + validate + resolve against prod + print the plan. Writes nothing.
//   npx tsx --env-file=.env.local scripts/backfill-convert-reconciliation.ts
//       Print the plan, prompt "Type 'yes' to proceed", then write.
//   npx tsx --env-file=.env.local scripts/backfill-convert-reconciliation.ts --yes
//       Skip the prompt (re-run / CI).
//   --allow-drift   Proceed when a cell's live status matches NEITHER the CSV's
//                   our_status NOR its suggested_status (see DRIFT below).
//   ...optionally pass a CSV path as the last positional arg (default below).
//
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { isCellStatus, type CellStatus } from '../lib/client-library/directives';

// -------------------------------------------------------------------------
// Config
// -------------------------------------------------------------------------
const PROJECT_KEY = 'NBLYCRO';
const CHANGED_BY = 'system:convert-reconciliation'; // §13 r20 — no auth.uid() in a script
const RECONCILED_ON = '2026-07-25'; // the manual cross-reference date, per the spec
const DEFAULT_CSV = path.join(process.cwd(), 'scripts/data/convert-reconciliation-backfill.csv');

// Expected totals from the spec. Asserted against the parsed file so a swapped
// or truncated CSV fails loudly instead of half-applying.
//
// 212/205/7 after two CSV corrections on 2026-07-25 (originally 215/207/8):
//
//   215/207/8 → 213/205/8  Two MLY UPGRADE rows removed (a design decision, not
//     a bug): "FLF: Views Step #1 | Contact Info" and "FLF: Views Step #2 |
//     Service Details" both mapped to the SAME Convert goal id 100480830,
//     because MLY genuinely tracks Contact Info + Service Details as one
//     combined event. Neither directive can be flipped independently without
//     asserting something the data does not measure. OPEN ITEM: MLY needs a
//     second, separate Convert goal before per-step tracking is possible.
//     Downgrades unaffected — both removed rows were upgrades, and MLY never
//     appeared in DOWNGRADE_REASONS (verified, not assumed).
//
//   213/205/8 → 212/205/7  One MDG DOWNGRADE row removed — a genuine BUG in the
//     reconciliation tool, not a judgement call. MDG's Convert export contains
//     TWO goals with the byte-identical name "Step 1 | Contact Info | Validation
//     Error Exposure": one ACTIVE (id 1004115396) and one ARCHIVED (id
//     1004117395). The tool's exact-match resolver keyed a plain dict by name,
//     so on a collision the later array entry silently overwrote the earlier —
//     the archived duplicate won, and the pass concluded "archived, so flip to
//     To do". MDG's directive is genuinely Done via the real ACTIVE goal; the
//     archived twin is noise Convert never cleaned up. So this is a CORRECTED
//     NON-ENTRY, categorically unlike the 7 intentional downgrades: the cell
//     needs no change at all. Its DOWNGRADE_REASONS entry was removed in the
//     same change rather than left to drift.
//     Note UPGRADES stay 205 — a downgrade was removed, so only the total and
//     the downgrade count move (205 + 7 = 212).
//
// A repo-wide scan for the same duplicate-name collision found exactly one other
// case — MOJ "Submits SF Lead - Footer [Contact API]" ×2 — but BOTH copies are
// active, so either resolution yields the same answer. No data impact; untouched.
const EXPECTED_TOTAL = 212;
const EXPECTED_UPGRADES = 205;
const EXPECTED_DOWNGRADES = 7;

// The 7 downgrades, verbatim from the spec's "know these before running"
// section, keyed by `BRAND||title` using the CSV's exact title spelling.
//
// This is a REVIEW GATE, not decoration: a downgrade row whose (brand, title)
// is absent here hard-fails the run. A Done → To do flip destroys a "resolved"
// signal, so every one of them must be a documented, reviewed decision — a new
// downgrade appearing in a regenerated CSV must go back through the spec first.
//
// Was 8. The MDG "Step 1 | Contact Info | Validation Error Exposure" entry was
// REMOVED on 2026-07-25 along with its CSV row — a resolver bug had matched the
// archived duplicate goal (id 1004117395) instead of the real active one (id
// 1004115396), inventing a downgrade for a directive that is genuinely Done. It
// is deleted here deliberately rather than left in place: a stale key would make
// the `staleReasons` notice fire on every run, training the operator to ignore
// exactly the signal that catches a genuinely-dropped downgrade. See the
// EXPECTED_* block above for the full root cause.
const DOWNGRADE_REASONS: Record<string, string> = {
  'MRA||Submits Form Lead - Combined':
    'goal exists but is ARCHIVED in Convert',
  'MRA||Submits LF Lead + Contact Us':
    'no combined variant exists for MRA',
  'MDG||[Upsell] Clicks Submit CTA':
    'V1 placeholder goal, not real (confirmed)',
  'PDS||[Upsell] Clicks Submit CTA':
    'same placeholder pattern',
  'RBW||Clicks Learn More on Tiles':
    'Local/National split pending rollout decision (Lacey: roll out everywhere, ' +
    'not yet built — stays To do until then)',
  'RBW||[Upsell] Clicks Submit CTA':
    'dead goal ID (confirmed via the separate upsell-backport handoff doc)',
  'FSP||[Upsell] Clicks Submit CTA':
    'FSP has no upsell module at all',
};

// Human status labels the reconciliation CSV uses → canonical CellStatus.
// Canonical values pass straight through (isCellStatus). Anything else fails.
// Kept identical to the goal loader's map so both scripts read the same file
// dialect.
const STATUS_LABEL_MAP: Record<string, CellStatus> = {
  done: 'done',
  'to do': 'todo',
  todo: 'todo',
  'n/a': 'n_a',
  na: 'n_a',
  n_a: 'n_a',
  'in progress': 'in_progress',
  in_progress: 'in_progress',
  blocked: 'blocked',
};

// -------------------------------------------------------------------------
// Env / args
// -------------------------------------------------------------------------
const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const SKIP_CONFIRM = ARGS.includes('--yes');
const ALLOW_DRIFT = ARGS.includes('--allow-drift');
const CSV_PATH = ARGS.filter((a) => !a.startsWith('--')).at(-1) ?? DEFAULT_CSV;

// Env is validated and the client built inside main(), not at module scope, so
// tests/convert-reconciliation.test.ts can import the pure helpers below
// without needing service-role credentials (or triggering a run).
function buildClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Invoke with `npx tsx --env-file=.env.local scripts/backfill-convert-reconciliation.ts`.',
    );
    process.exit(1);
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Module-system-agnostic "am I the entry point" check (no import.meta, so this
// works whether tsx loads the file as ESM or CJS).
const INVOKED_DIRECTLY =
  !!process.argv[1] &&
  path.basename(process.argv[1]).startsWith('backfill-convert-reconciliation');

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------
interface CsvRow {
  line: number;
  brandCode: string;
  title: string;
  ourStatus: CellStatus; // what the CSV believes is currently loaded
  suggestedStatus: CellStatus; // what Convert says is true → the write target
  convertName: string;
  convertId: string;
  convertStatus: string;
  isDowngrade: boolean;
}

interface BrandRow {
  id: string;
  brand_code: string;
  is_active: boolean;
  is_paused: boolean;
}

interface CellRow {
  id: string;
  directive_id: string;
  brand_id: string;
  status: string;
}

/** A CSV row successfully resolved to a live cell. */
interface ResolvedRow extends CsvRow {
  cellId: string;
  liveStatus: CellStatus | string;
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------
function normalizeStatus(raw: string): CellStatus | null {
  const key = raw.trim().toLowerCase();
  if (STATUS_LABEL_MAP[key]) return STATUS_LABEL_MAP[key];
  if (isCellStatus(key)) return key;
  return null;
}

function pick(row: Record<string, string>, ...names: string[]): string {
  // case-insensitive header lookup, tolerant of column aliases
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) lower[k.trim().toLowerCase()] = v;
  for (const n of names) {
    const hit = lower[n.toLowerCase()];
    if (hit !== undefined) return hit;
  }
  return '';
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function key(brandCode: string, title: string): string {
  return `${brandCode}||${title}`;
}

// PostgREST caps an unranged SELECT at 1000 rows and does NOT report that it
// truncated (the Batch 004.12 / §15 item 5.18 lesson). 65 directives × 16
// brands is already 1040 cells, so reading the matrix without explicit paging
// silently drops rows — which would make the "cell does not exist" hard-fail
// below fire on cells that are actually present. Page until a short page.
const PAGE = 1000;

async function fetchAllPaged<T>(
  describe: string,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) {
      console.error(`Failed to load ${describe}:`, error.message);
      process.exit(1);
    }
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE) return out;
  }
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
  n_a: 'N/A',
};

function label(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/**
 * The audit note for a changed cell. Both strings are the spec §2 formats
 * verbatim; only the choice between them is ours.
 *
 * Keyed on whether the row carries real Convert coordinates, NOT on the
 * direction of the flip — a deliberate refinement of the spec's "downgrades get
 * the placeholder note" phrasing. Two of the 8 downgrades reference a REAL
 * Convert goal that is archived (MRA "Submits Form Lead - Combined" id
 * 1004101324, MDG "Step 1 | Contact Info | Validation Error Exposure" id
 * 1004117395); writing "no real Convert goal" over those would discard the
 * archived goal's id from the only forensic trail we keep.
 *
 * Exported for tests: a wrong note here is silent and permanent.
 */
export function auditNote(row: {
  convertName: string;
  convertId: string;
  convertStatus: string;
}): string {
  const prefix = `Convert reconciliation ${RECONCILED_ON} — `;
  if (row.convertId) {
    return (
      prefix +
      `${row.convertName} (id ${row.convertId}, Convert status: ${row.convertStatus || 'unknown'})`
    );
  }
  // Verbatim spec §2 wording. Deliberately does NOT say "archived": every
  // archived goal carries an id and takes the branch above, so this string is
  // only ever reached by a genuinely absent/placeholder goal.
  return prefix + 'no real Convert goal — placeholder/absent';
}

/**
 * Classify one resolved row against its live DB status.
 *   'skip'  — already at target: idempotent no-op (no write, no audit row)
 *   'apply' — live status matches what the CSV expected: clean flip
 *   'drift' — live is a third value: edited after the reconciliation pass
 *
 * Exported for tests: this is the other place a mistake is silent — a
 * misclassification either skips a needed flip or clobbers a hand-edit.
 */
export function classifyRow(args: {
  liveStatus: string;
  ourStatus: CellStatus;
  suggestedStatus: CellStatus;
}): 'skip' | 'apply' | 'drift' {
  if (args.liveStatus === args.suggestedStatus) return 'skip';
  if (args.liveStatus === args.ourStatus) return 'apply';
  return 'drift';
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------
async function main() {
  const supabase = buildClient();
  console.log(
    `\n=== backfill-convert-reconciliation ${
      DRY_RUN ? '(DRY RUN — writes nothing)' : '(EXECUTE — prompts unless --yes)'
    } ===\n`,
  );

  if (!fs.existsSync(CSV_PATH)) {
    console.error(
      `CSV not found at: ${CSV_PATH}\n` +
        `Expected the reconciliation file (columns: brand, title, our_status, ` +
        `suggested_status, convert_name, convert_id, convert_status) or pass a ` +
        `path as the last argument.`,
    );
    process.exit(1);
  }

  // ---- parse -----------------------------------------------------------
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const rows: CsvRow[] = [];
  const parseErrors: string[] = [];

  records.forEach((rec, i) => {
    const line = i + 2; // +1 header, +1 to 1-index
    const rawBrand = pick(rec, 'brand', 'brand_code');
    const rawTitle = pick(rec, 'title', 'directive_title');
    const rawOur = pick(rec, 'our_status');
    const rawSuggested = pick(rec, 'suggested_status');

    if (!rawBrand || !rawTitle) {
      parseErrors.push(`row ${line}: missing brand or title`);
      return;
    }
    const ourStatus = normalizeStatus(rawOur);
    const suggestedStatus = normalizeStatus(rawSuggested);
    if (!ourStatus) {
      parseErrors.push(
        `row ${line}: unrecognized our_status "${rawOur}" (${rawBrand} / ${rawTitle})`,
      );
      return;
    }
    if (!suggestedStatus) {
      parseErrors.push(
        `row ${line}: unrecognized suggested_status "${rawSuggested}" (${rawBrand} / ${rawTitle})`,
      );
      return;
    }
    if (ourStatus === suggestedStatus) {
      // The file is a diff — a no-change row means it was generated wrong.
      parseErrors.push(
        `row ${line}: our_status === suggested_status ("${rawOur}") — not a diff ` +
          `(${rawBrand} / ${rawTitle})`,
      );
      return;
    }

    rows.push({
      line,
      brandCode: rawBrand.trim().toUpperCase(),
      title: rawTitle.trim(),
      ourStatus,
      suggestedStatus,
      convertName: pick(rec, 'convert_name').trim(),
      convertId: pick(rec, 'convert_id').trim(),
      convertStatus: pick(rec, 'convert_status').trim(),
      isDowngrade: ourStatus === 'done' && suggestedStatus !== 'done',
    });
  });

  if (parseErrors.length) {
    console.error('❌ Parse/validation errors — nothing written:');
    parseErrors.forEach((e) => console.error('   ' + e));
    process.exit(1);
  }

  console.log(`Parsed ${rows.length} diff rows from ${path.basename(CSV_PATH)}.`);

  // ---- in-file duplicate (brand, title) guard --------------------------
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const r of rows) {
    const k = key(r.brandCode, r.title);
    if (seen.has(k)) dupes.push(`${r.brandCode} × ${r.title}`);
    seen.add(k);
  }
  if (dupes.length) {
    console.error('❌ Duplicate (brand, title) rows in the CSV — ambiguous, nothing written:');
    dupes.forEach((d) => console.error('   ' + d));
    process.exit(1);
  }

  // ---- shape assertions vs the spec ------------------------------------
  const upgrades = rows.filter((r) => !r.isDowngrade);
  const downgrades = rows.filter((r) => r.isDowngrade);
  const shapeErrors: string[] = [];
  // Pin the DIRECTION of every row, not just the counts (Karen L1). The
  // EXPECTED_* totals alone would happily pass a regenerated CSV containing
  // e.g. `todo → blocked`, which the per-brand report and the confirm prompt
  // would then mislabel to the operator as "↑ to Done" at the one human gate.
  const badTransitions = rows.filter(
    (r) =>
      !(r.ourStatus === 'todo' && r.suggestedStatus === 'done') &&
      !(r.ourStatus === 'done' && r.suggestedStatus === 'todo'),
  );
  if (badTransitions.length) {
    shapeErrors.push(
      `${badTransitions.length} row(s) are neither To do→Done nor Done→To do: ` +
        badTransitions
          .slice(0, 5)
          .map((r) => `row ${r.line} (${r.brandCode} ${label(r.ourStatus)}→${label(r.suggestedStatus)})`)
          .join(', '),
    );
  }
  if (rows.length !== EXPECTED_TOTAL) {
    shapeErrors.push(`expected ${EXPECTED_TOTAL} rows, found ${rows.length}`);
  }
  if (upgrades.length !== EXPECTED_UPGRADES) {
    shapeErrors.push(`expected ${EXPECTED_UPGRADES} upgrades, found ${upgrades.length}`);
  }
  if (downgrades.length !== EXPECTED_DOWNGRADES) {
    shapeErrors.push(`expected ${EXPECTED_DOWNGRADES} downgrades, found ${downgrades.length}`);
  }
  if (shapeErrors.length) {
    console.error(
      '❌ CSV shape does not match the spec — wrong or regenerated file. Nothing written:',
    );
    shapeErrors.forEach((e) => console.error('   ' + e));
    console.error(
      '   If the CSV was intentionally regenerated, update the spec doc + the\n' +
        '   EXPECTED_* constants + DOWNGRADE_REASONS in this script together.',
    );
    process.exit(1);
  }

  // ---- every downgrade must be a documented, reviewed decision ---------
  const undocumented = downgrades.filter((r) => !DOWNGRADE_REASONS[key(r.brandCode, r.title)]);
  if (undocumented.length) {
    console.error(
      `❌ ${undocumented.length} downgrade(s) have no documented reason in this script.\n` +
        `   A Done → To do flip destroys a "resolved" signal, so each one must be\n` +
        `   reviewed in docs/batch-012-convert-reconciliation-spec.md first. Nothing written:`,
    );
    undocumented.forEach((r) => console.error(`   ${r.brandCode} — ${r.title} (row ${r.line})`));
    process.exit(1);
  }
  const staleReasons = Object.keys(DOWNGRADE_REASONS).filter(
    (k) => !downgrades.some((r) => key(r.brandCode, r.title) === k),
  );
  if (staleReasons.length) {
    console.log(
      `\nℹ ${staleReasons.length} documented downgrade(s) are no longer in the CSV ` +
        `(already applied, or dropped from the pass):`,
    );
    staleReasons.forEach((k) => console.log('   • ' + k.replace('||', ' — ')));
  }

  // ---- load prod state -------------------------------------------------
  const brands = await fetchAllPaged<BrandRow>('brands', (from, to) =>
    supabase
      .from('brands')
      .select('id, brand_code, is_active, is_paused')
      .eq('project_key', PROJECT_KEY)
      .order('id')
      .range(from, to),
  );
  const brandByCode = new Map(brands.map((b) => [b.brand_code.toUpperCase(), b]));

  const directives = await fetchAllPaged<{ id: string; title: string; status: string }>(
    'directives',
    (from, to) =>
      supabase
        .from('directives')
        .select('id, title, status')
        .eq('project_key', PROJECT_KEY)
        .order('id')
        .range(from, to),
  );

  // `directives(project_key, title)` has NO unique constraint (migration 024
  // has only plain indexes) and POST /api/admin/directives does no duplicate
  // check — so the live inline-create strip can mint a second directive with
  // the same title. A title→id Map would silently keep the LAST one, flip the
  // wrong cell, and still pass post-verify (which re-reads the id we chose).
  // Refuse instead (Karen M3).
  const titleCounts = new Map<string, number>();
  for (const d of directives) titleCounts.set(d.title, (titleCounts.get(d.title) ?? 0) + 1);
  const duplicateTitles = [...titleCounts.entries()].filter(([, n]) => n > 1);
  if (duplicateTitles.length) {
    console.error(
      `❌ ${duplicateTitles.length} duplicate directive title(s) in ${PROJECT_KEY} — a title ` +
        `cannot be resolved to one directive, so the wrong cell could be flipped. Nothing written:`,
    );
    duplicateTitles.forEach(([t, n]) => console.error(`   "${t}" ×${n}`));
    console.error('   Merge or archive the duplicates in the matrix, then re-run.');
    process.exit(1);
  }

  const dirIdByTitle = new Map(directives.map((d) => [d.title, d.id]));
  const dirStatusById = new Map(directives.map((d) => [d.id, d.status]));

  // Cells for this project's directives, keyed by `directive_id||brand_id`.
  // MUST be paged: 65 directives × 16 brands already exceeds PostgREST's silent
  // 1000-row default, and a truncated read here would make the hard-fail below
  // report cells as "missing" when they exist.
  const directiveIds = directives.map((d) => d.id);
  const allCells = await fetchAllPaged<CellRow>('matrix cells', (from, to) =>
    supabase
      .from('directive_brand_status')
      .select('id, directive_id, brand_id, status')
      .in('directive_id', directiveIds)
      .order('id')
      .range(from, to),
  );
  const cellByPair = new Map<string, CellRow>();
  for (const c of allCells) {
    cellByPair.set(`${c.directive_id}||${c.brand_id}`, c);
  }
  console.log(
    `Loaded ${brands.length} ${PROJECT_KEY} brands, ${directives.length} directives, ` +
      `${cellByPair.size} existing cells.`,
  );

  // ---- brand-state guard (spec §4: paused brands must NOT be written) ---
  // The precedent loader hard-fails on inactive brands; this pass additionally
  // refuses PAUSED ones, because the pause rule forces n_a and the spec is
  // explicit that MRR-CA / SHG / WDG are out of scope. Latent with today's CSV
  // (all 13 rows are active, unpaused) — this exists so a REGENERATED CSV that
  // sweeps the paused brands in can't quietly flip them to done (Karen M2).
  const referencedCodes = [...new Set(rows.map((r) => r.brandCode))];
  const inactiveRefs = referencedCodes.filter((c) => brandByCode.get(c)?.is_active === false);
  const pausedRefs = referencedCodes.filter((c) => brandByCode.get(c)?.is_paused === true);
  if (inactiveRefs.length || pausedRefs.length) {
    console.error(
      `\n❌ The CSV references brand(s) this pass must not write. Nothing written:`,
    );
    if (inactiveRefs.length) {
      console.error(`   is_active = FALSE (${inactiveRefs.length}): ${inactiveRefs.join(', ')}`);
    }
    if (pausedRefs.length) {
      console.error(
        `   is_paused = TRUE (${pausedRefs.length}): ${pausedRefs.join(', ')}\n` +
          `   Paused brands are out of scope per the spec — the pause rule forces n_a and\n` +
          `   they aren't live. Drop them from the CSV (see paused-brands-readiness.csv).`,
      );
    }
    process.exit(1);
  }

  // ---- resolve every CSV row to a live cell (HARD FAIL on any miss) ----
  const unknownBrand: CsvRow[] = [];
  const unknownTitle: CsvRow[] = [];
  const missingCell: CsvRow[] = [];
  const archivedDirective: CsvRow[] = [];
  const resolved: ResolvedRow[] = [];

  for (const r of rows) {
    const brand = brandByCode.get(r.brandCode);
    if (!brand) {
      unknownBrand.push(r);
      continue;
    }
    const directiveId = dirIdByTitle.get(r.title);
    if (!directiveId) {
      unknownTitle.push(r);
      continue;
    }
    // An archived directive doesn't render in the matrix, so flipping its cell
    // would be an invisible write (Karen L3).
    if (dirStatusById.get(directiveId) !== 'active') {
      archivedDirective.push(r);
      continue;
    }
    const cell = cellByPair.get(`${directiveId}||${brand.id}`);
    if (!cell) {
      missingCell.push(r);
      continue;
    }
    resolved.push({ ...r, cellId: cell.id, liveStatus: cell.status });
  }

  if (unknownBrand.length || unknownTitle.length || missingCell.length || archivedDirective.length) {
    console.error(
      `\n❌ ${
        unknownBrand.length + unknownTitle.length + missingCell.length + archivedDirective.length
      } row(s) do not resolve to a live matrix cell. This is an UPDATE pass — an unresolved ` +
        `row means the input is stale, not something to skip. Nothing written:`,
    );
    if (archivedDirective.length) {
      console.error(`\n   Directive is ARCHIVED, so the cell is invisible (${archivedDirective.length}):`);
      archivedDirective.forEach((r) =>
        console.error(`     row ${r.line}: ${r.brandCode} — ${r.title}`),
      );
    }
    if (unknownBrand.length) {
      console.error(`\n   Unknown brand_code in ${PROJECT_KEY} (${unknownBrand.length}):`);
      unknownBrand.forEach((r) => console.error(`     row ${r.line}: ${r.brandCode} — ${r.title}`));
    }
    if (unknownTitle.length) {
      console.error(`\n   No ${PROJECT_KEY} directive with this title (${unknownTitle.length}):`);
      unknownTitle.forEach((r) => console.error(`     row ${r.line}: ${r.brandCode} — ${r.title}`));
      console.error(
        `     (check for title drift, incl. the [GTM]/[Upsell] bracket conventions)`,
      );
    }
    if (missingCell.length) {
      console.error(
        `\n   Directive + brand both exist but the cell does not (${missingCell.length}):`,
      );
      missingCell.forEach((r) => console.error(`     row ${r.line}: ${r.brandCode} — ${r.title}`));
      console.error(
        `     (a brand added AFTER the directive was created has no cell — that is the\n` +
          `      known Phase A cell-backfill gap, not something this script should create)`,
      );
    }
    process.exit(1);
  }

  // ---- classify: apply / skip (already at target) / drift ---------------
  const toApply: ResolvedRow[] = [];
  const alreadyDone: ResolvedRow[] = [];
  const drift: ResolvedRow[] = [];

  for (const r of resolved) {
    switch (classifyRow({ ...r, liveStatus: String(r.liveStatus) })) {
      case 'skip':
        alreadyDone.push(r); // idempotent no-op — log, don't write, don't count
        break;
      case 'apply':
        toApply.push(r); // clean: live state matches what the CSV expected
        break;
      default:
        drift.push(r); // live state is a third value — someone edited since 07-25
    }
  }

  // A drifted cell is still flipped to Convert's truth (Convert is the source
  // of record for whether a goal exists), but never silently: the run refuses
  // to proceed without --allow-drift so a hand-edit made after the
  // reconciliation pass can't be clobbered unnoticed.
  const writeSet = ALLOW_DRIFT ? [...toApply, ...drift] : toApply;

  // ---- plan report -----------------------------------------------------
  console.log(`\n--- PLAN ---`);
  console.log(`CSV rows:            ${rows.length}  (${upgrades.length} upgrades, ${downgrades.length} downgrades)`);
  console.log(`Resolved to cells:   ${resolved.length}`);
  console.log(
    `To change:           ${writeSet.length}` +
      (ALLOW_DRIFT && drift.length ? `  (${toApply.length} clean + ${drift.length} drifted)` : ''),
  );
  console.log(`Already at target:   ${alreadyDone.length}  (skipped — idempotent no-op)`);
  console.log(`Drifted:             ${drift.length}${drift.length ? (ALLOW_DRIFT ? '  (INCLUDED — --allow-drift)' : '  (BLOCKING — see below)') : ''}`);

  const byBrand = new Map<string, { up: number; down: number }>();
  for (const r of writeSet) {
    const cur = byBrand.get(r.brandCode) ?? { up: 0, down: 0 };
    if (r.isDowngrade) cur.down += 1;
    else cur.up += 1;
    byBrand.set(r.brandCode, cur);
  }
  if (byBrand.size) {
    console.log(`\nChanges per brand:`);
    [...byBrand.entries()]
      .sort((a, b) => b[1].up + b[1].down - (a[1].up + a[1].down) || a[0].localeCompare(b[0]))
      .forEach(([code, n]) =>
        console.log(
          `   ${code.padEnd(7)} ${String(n.up + n.down).padStart(3)}` +
            `  (↑ ${n.up} to Done${n.down ? `, ↓ ${n.down} to To do` : ''})`,
        ),
      );
  }

  // The 8 downgrades, always by name with their reason — a "downgrade" in the
  // diff is an intentional correction here, NOT a bug. Printed even in a
  // no-op re-run so whoever runs this never has to go dig for the reasons.
  // Every CSV row is in `resolved` by this point (unresolved rows hard-fail
  // above), so the lookup below is total.
  const resolvedByLine = new Map(resolved.map((r) => [r.line, r]));
  console.log(
    `\nDOWNGRADES (Done → To do) — ${downgrades.length} intentional corrections, not regressions:`,
  );
  for (const r of downgrades) {
    const live = resolvedByLine.get(r.line);
    const state = !live
      ? 'unresolved'
      : live.liveStatus === r.suggestedStatus
        ? 'already corrected'
        : live.liveStatus === r.ourStatus
          ? 'will flip'
          : `DRIFTED (live: ${label(String(live.liveStatus))})`;
    console.log(`   • ${r.brandCode.padEnd(4)} ${r.title}`);
    console.log(`       reason: ${DOWNGRADE_REASONS[key(r.brandCode, r.title)]}`);
    console.log(
      `       convert: ${r.convertName || '(none)'}` +
        `${r.convertId ? ` · id ${r.convertId}` : ''}` +
        `${r.convertStatus ? ` · ${r.convertStatus}` : ''}  →  ${state}`,
    );
  }

  if (alreadyDone.length) {
    console.log(
      `\nAlready at target (${alreadyDone.length}) — skipped, no write, no audit row:`,
    );
    const preview = alreadyDone.slice(0, 10);
    preview.forEach((r) =>
      console.log(`   • ${r.brandCode.padEnd(4)} ${r.title}  (${label(r.suggestedStatus)})`),
    );
    if (alreadyDone.length > preview.length) {
      console.log(`   … and ${alreadyDone.length - preview.length} more`);
    }
  }

  if (drift.length) {
    console.log(
      `\n⚠ DRIFT (${drift.length}) — live status matches NEITHER our_status NOR ` +
        `suggested_status.\n` +
        `   Someone changed these cells after the ${RECONCILED_ON} reconciliation pass:`,
    );
    drift.forEach((r) =>
      console.log(
        `   • ${r.brandCode.padEnd(4)} ${r.title}\n` +
          `       CSV expected ${label(r.ourStatus)} → live is ${label(String(r.liveStatus))}` +
          ` → would set ${label(r.suggestedStatus)}`,
      ),
    );
    if (!ALLOW_DRIFT) {
      console.error(
        `\n❌ Refusing to overwrite drifted cells. Either re-verify them against ` +
          `Convert and\n   re-run with --allow-drift, or drop them from the CSV. Nothing written.`,
      );
      process.exit(1);
    }
    console.log(`   → --allow-drift given: these WILL be overwritten to Convert's value.`);
  }

  if (writeSet.length === 0) {
    console.log(`\nNothing to change — every cell is already at its target. Done.`);
    return;
  }

  if (DRY_RUN) {
    console.log(`\n[dry-run] No changes made. ${writeSet.length} cell(s) would be updated.`);
    return;
  }

  // ---- confirm ---------------------------------------------------------
  if (!SKIP_CONFIRM) {
    const rl = createInterface({ input, output });
    const answer = await rl.question(
      `\nThis will UPDATE ${writeSet.length} existing cell(s) ` +
        `(${writeSet.filter((r) => !r.isDowngrade).length} ↑ to Done, ` +
        `${writeSet.filter((r) => r.isDowngrade).length} ↓ to To do) and emit ` +
        `${writeSet.length} audit_log row(s). Type 'yes' to proceed: `,
    );
    rl.close();
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('Aborted.');
      return;
    }
  }

  // ---- update cells ----------------------------------------------------
  // Grouped by target status so each group is one UPDATE ... WHERE id IN (...)
  // with identical values. `note` is deliberately left untouched — this pass
  // reconciles status only.
  const nowIso = new Date().toISOString();
  const byTarget = new Map<CellStatus, ResolvedRow[]>();
  for (const r of writeSet) {
    if (!byTarget.has(r.suggestedStatus)) byTarget.set(r.suggestedStatus, []);
    byTarget.get(r.suggestedStatus)!.push(r);
  }

  let cellsWritten = 0;
  const flipped: ResolvedRow[] = []; // exactly what landed, for L4 recovery output
  for (const [status, group] of byTarget) {
    for (const batch of chunk(group, 200)) {
      const { error } = await supabase
        .from('directive_brand_status')
        .update({ status, updated_by: CHANGED_BY, updated_at: nowIso })
        .in(
          'id',
          batch.map((r) => r.cellId),
        );
      if (error) {
        // Partial state is SAFE to re-run here (unlike the create-pass loader):
        // this script is idempotent per-cell — already-flipped cells land in
        // `alreadyDone` and are skipped, so a re-run finishes the remainder.
        console.error(
          `\n❌ Cell update failed after ${cellsWritten}/${writeSet.length} cells:`,
          error.message,
        );
        console.error(
          `\n⚠ PARTIAL STATE — exactly what is true right now:\n` +
            `   • ${cellsWritten} cell(s) HAVE been flipped in directive_brand_status.\n` +
            `   • 0 audit_log rows were written — audit runs only after ALL updates\n` +
            `     succeed, so those ${cellsWritten} flips currently have NO audit trail.\n` +
            `   • ${writeSet.length - cellsWritten} cell(s) were not reached.\n\n` +
            `   Re-running is SAFE for the cells (already-flipped ones are skipped as\n` +
            `   idempotent no-ops), but a plain re-run will NOT backfill the missing audit\n` +
            `   rows for those ${cellsWritten} — a skipped cell writes no audit row. Since the\n` +
            `   audit row is the only record of WHEN a cell resolved, either:\n` +
            `     (a) accept the gap, re-run to finish the remainder, and note it; or\n` +
            `     (b) revert the ${cellsWritten} flipped cells to their prior status and re-run\n` +
            `         clean, so cells and audit rows land together.\n` +
            `   Either way, afterwards confirm:\n` +
            `     SELECT count(*) FROM audit_log WHERE changed_by = '${CHANGED_BY}';`,
        );
        // L4: option (b) is only actionable if the operator knows exactly which
        // cells moved and what they held before. Dump it.
        if (flipped.length) {
          console.error(`\n   Cells already flipped (cell_id, prior → new):`);
          flipped.forEach((r) =>
            console.error(`     ${r.cellId}  ${r.liveStatus} → ${r.suggestedStatus}   (${r.brandCode} ${r.title})`),
          );
          console.error(
            `\n   Revert SQL for option (b) — one statement per prior status:\n` +
              [...new Set(flipped.map((r) => String(r.liveStatus)))]
                .map(
                  (prior) =>
                    `     UPDATE directive_brand_status SET status = '${prior}' WHERE id IN (\n       '${flipped
                      .filter((r) => String(r.liveStatus) === prior)
                      .map((r) => r.cellId)
                      .join("',\n       '")}'\n     );`,
                )
                .join('\n'),
          );
        }
        process.exit(1);
      }
      cellsWritten += batch.length;
      flipped.push(...batch);
    }
  }
  console.log(`\n✓ Updated ${cellsWritten} cells.`);

  // ---- audit (one row per changed cell, §13 r2) ------------------------
  const auditRows = writeSet.map((r) => ({
    log_entry_id: null,
    target_type: 'directive_brand_status',
    target_id: r.cellId,
    action: 'UPDATE',
    field_name: 'status',
    old_value: String(r.liveStatus),
    new_value: r.suggestedStatus,
    changed_by: CHANGED_BY,
    notes: auditNote(r),
  }));

  let auditWritten = 0;
  for (const batch of chunk(auditRows, 500)) {
    const { error } = await supabase.from('audit_log').insert(batch);
    if (error) {
      // Cells are updated; surface the audit gap without rolling back (mirrors
      // the directives route + qa-config precedent). This matters more than
      // usual here: the audit row is the only record of WHEN a cell resolved.
      console.error(`⚠ audit_log insert failed after ${auditWritten} rows:`, error.message);
      break;
    }
    auditWritten += batch.length;
  }
  console.log(`✓ Wrote ${auditWritten} audit_log rows.`);
  if (auditWritten !== auditRows.length) {
    // Karen H1: this used to fall through to post-verify, which only checks
    // cell statuses — so a run that flipped 209 cells and wrote ZERO audit rows
    // printed "✓ Post-verify ... Done." and exited 0. The cells are correct, so
    // the honest signal is "data landed, trail didn't" — which must be non-zero.
    console.error(
      `\n❌ AUDIT GAP — expected ${auditRows.length} audit rows, wrote ${auditWritten}.\n` +
        `   The cell flips LANDED and are correct, but their resolve-timestamp trail is\n` +
        `   incomplete. Until the Convert/Jira date sync exists, this trail is the only\n` +
        `   record of WHEN a cell resolved, so this is a real failure, not a warning.\n` +
        `   Re-running will NOT backfill it (flipped cells are skipped as no-ops).\n` +
        `   Reconcile manually, then confirm:\n` +
        `     SELECT count(*) FROM audit_log WHERE changed_by = '${CHANGED_BY}'\n` +
        `       AND field_name = 'status';`,
    );
    process.exit(1);
  }

  // ---- post-verify (assert the DB matches the plan) --------------------
  const liveById = new Map<string, string>();
  for (const batch of chunk(writeSet.map((r) => r.cellId), 200)) {
    const { data, error } = await supabase
      .from('directive_brand_status')
      .select('id, status')
      .in('id', batch);
    if (error) {
      console.error(`⚠ Post-verify read failed: ${error.message} — VERIFY MANUALLY.`);
      process.exit(1);
    }
    for (const c of (data ?? []) as { id: string; status: string }[]) {
      liveById.set(c.id, c.status);
    }
  }

  const mismatches = writeSet.filter((r) => liveById.get(r.cellId) !== r.suggestedStatus);
  if (mismatches.length) {
    console.error(
      `\n❌ POST-VERIFY FAILED — ${mismatches.length}/${writeSet.length} cell(s) do not hold ` +
        `their expected status. Do NOT trust the matrix until this is resolved:`,
    );
    mismatches
      .slice(0, 20)
      .forEach((r) =>
        console.error(
          `   ${r.brandCode.padEnd(4)} ${r.title}: expected ${r.suggestedStatus}, ` +
            `DB has ${liveById.get(r.cellId) ?? '(row not found)'}`,
        ),
      );
    if (mismatches.length > 20) console.error(`   … and ${mismatches.length - 20} more`);
    process.exit(1);
  }
  console.log(`✓ Post-verify: all ${writeSet.length} cells hold their expected status.`);

  // Karen M1: assert the AUDIT side too, not just the cells. Scoped to THIS
  // run's cell ids + field_name, so it's a real equality check rather than a
  // cumulative count that can never be compared to an expected value.
  let auditVerified = 0;
  for (const batch of chunk(writeSet.map((r) => r.cellId), 200)) {
    const { count, error } = await supabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('changed_by', CHANGED_BY)
      .eq('field_name', 'status')
      .in('target_id', batch);
    if (error) {
      console.error(`⚠ Audit post-verify read failed: ${error.message} — VERIFY MANUALLY.`);
      process.exit(1);
    }
    auditVerified += count ?? 0;
  }
  if (auditVerified < writeSet.length) {
    console.error(
      `\n❌ AUDIT POST-VERIFY FAILED — expected at least ${writeSet.length} audit row(s) for ` +
        `this run's cells, found ${auditVerified}. The flips landed; the trail did not.`,
    );
    process.exit(1);
  }
  console.log(
    `✓ Post-verify: ${auditVerified} audit row(s) present for the ${writeSet.length} changed cell(s)` +
      `${auditVerified > writeSet.length ? ' (includes rows from earlier runs on the same cells)' : ''}.`,
  );

  console.log(
    `\nDone. ${writeSet.length} cell(s) reconciled` +
      `${alreadyDone.length ? `, ${alreadyDone.length} already correct` : ''}` +
      ` — ${writeSet.length + alreadyDone.length}/${rows.length} CSV rows accounted for.`,
  );
}

// Only run when executed directly, so the exported pure helpers above can be
// imported by tests/convert-reconciliation.test.ts without starting a run.
if (INVOKED_DIRECTLY) {
  main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}
