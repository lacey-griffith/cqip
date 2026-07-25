// scripts/load-nbly-goal-directives.ts
//
// One-off bulk loader: NBLY goal directives → the Pulse directive matrix
// (Batch 012 / Phase A tables `directives` + `directive_brand_status`).
//
// Source of record: HANDOFF — NBLY goal directives bulk load (2026-07-21).
//   65 goal directives × 16 NBLY brands = 1,040 cells.
//   Expected status totals: Done 262 · To do 496 · N/A 282.
//
// There is no CSV-import in the app, so this loads as a plain data write
// (backfill-style), exactly like scripts/normalize-quality-log-fields.ts:
//   - service-role client (bypasses RLS)
//   - --dry-run default-safe, prompt-before-write, --yes to skip the prompt
//   - idempotent: matches existing directives on (project_key, title) and
//     skips them, so a re-run does not duplicate
//   - audit_log rows written for traceability (§13 r2), changed_by is the
//     system attribution string per §13 r20
//
// Gate profile: no schema change (migration 024 is already in prod), no new
// route → no Jenny. Karen reviews the loader + a mapping-parity spot-check;
// Lacey approves the mapping and smoke-tests after the run.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/load-nbly-goal-directives.ts --dry-run
//       Parse + validate + print the plan (incl. per-brand To-do parity). Writes nothing.
//   npx tsx --env-file=.env.local scripts/load-nbly-goal-directives.ts
//       Print the plan, prompt "Type 'yes' to proceed", then write.
//   npx tsx --env-file=.env.local scripts/load-nbly-goal-directives.ts --yes
//       Skip the prompt (re-run / CI).
//   ...optionally pass a CSV path as the last positional arg (default below).
//
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  isCellStatus,
  isDirectiveType,
  type CellStatus,
  type DirectiveType,
} from '../lib/client-library/directives';

// -------------------------------------------------------------------------
// Config
// -------------------------------------------------------------------------
const PROJECT_KEY = 'NBLYCRO';
const CHANGED_BY = 'system:nbly-goal-load'; // §13 r20 — no auth.uid() in a script
const DEFAULT_CSV = path.join(process.cwd(), 'scripts/data/NBLY_goal_directives_load.csv');
const DEFAULT_DIRECTIVE_TYPE: DirectiveType = 'goal';

// Locked decision (Lacey, 2026-07-21): apply the [GTM] bracket convention.
// Applied at load so the created title, the idempotency match, and the audit
// row all use the renamed value. Add future renames here, not in the CSV.
const TITLE_RENAMES: Record<string, string> = {
  'GTM Submits Lead Combined': '[GTM] Submits Lead Combined',
};

// Locked decisions Q1 (upsell block → To do) and Q2 (7 all-FALSE brands →
// To do checklist) require NO transform — the loader writes the file's
// statuses verbatim. They are documented here only so a future reader knows
// the choices were deliberate, not an oversight.

// Human status labels the mapped/load CSV may use → canonical CellStatus.
// Canonical values pass straight through (isCellStatus). Anything else fails.
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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Invoke with `npx tsx --env-file=.env.local scripts/load-nbly-goal-directives.ts`.',
  );
  process.exit(1);
}

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const SKIP_CONFIRM = ARGS.includes('--yes');
const CSV_PATH = ARGS.filter((a) => !a.startsWith('--')).at(-1) ?? DEFAULT_CSV;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------
interface LoadRow {
  title: string; // post-rename
  directiveType: DirectiveType;
  brandCode: string;
  status: CellStatus;
}

interface BrandRow {
  id: string;
  brand_code: string;
  is_active: boolean;
  is_paused: boolean;
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
  // case-insensitive header lookup, tolerant of the load-file column aliases
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

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------
async function main() {
  console.log(
    `\n=== load-nbly-goal-directives ${
      DRY_RUN ? '(DRY RUN — writes nothing)' : '(EXECUTE — prompts unless --yes)'
    } ===\n`,
  );

  if (!fs.existsSync(CSV_PATH)) {
    console.error(
      `CSV not found at: ${CSV_PATH}\n` +
        `Drop the long-form load file there (columns: directive_title, directive_type, ` +
        `brand_code, status) or pass a path as the last argument.`,
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

  const rows: LoadRow[] = [];
  const statusErrors: string[] = [];
  const typeErrors: string[] = [];

  records.forEach((rec, i) => {
    const line = i + 2; // +1 header, +1 to 1-index
    const rawTitle = pick(rec, 'directive_title', 'title');
    const rawType = pick(rec, 'directive_type', 'type') || DEFAULT_DIRECTIVE_TYPE;
    const rawBrand = pick(rec, 'brand_code', 'brand');
    const rawStatus = pick(rec, 'status', 'cell_status');

    if (!rawTitle || !rawBrand) {
      statusErrors.push(`row ${line}: missing title or brand_code`);
      return;
    }

    const title = (TITLE_RENAMES[rawTitle.trim()] ?? rawTitle.trim());
    if (!isDirectiveType(rawType.trim())) {
      typeErrors.push(`row ${line}: invalid directive_type "${rawType}"`);
      return;
    }
    const status = normalizeStatus(rawStatus);
    if (!status) {
      statusErrors.push(`row ${line}: unrecognized status "${rawStatus}" (title="${title}", brand=${rawBrand})`);
      return;
    }

    rows.push({
      title,
      directiveType: rawType.trim() as DirectiveType,
      brandCode: rawBrand.trim().toUpperCase(),
      status,
    });
  });

  if (typeErrors.length || statusErrors.length) {
    console.error('❌ Parse/validation errors — nothing loaded:');
    [...typeErrors, ...statusErrors].forEach((e) => console.error('   ' + e));
    process.exit(1);
  }

  console.log(`Parsed ${rows.length} cell rows from ${path.basename(CSV_PATH)}.`);

  // ---- in-file duplicate (title, brand) guard --------------------------
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const r of rows) {
    const key = `${r.title} ${r.brandCode}`;
    if (seen.has(key)) dupes.push(`${r.title} × ${r.brandCode}`);
    seen.add(key);
  }
  if (dupes.length) {
    console.error(`❌ Duplicate (title, brand) rows in the CSV — ambiguous, nothing loaded:`);
    dupes.forEach((d) => console.error('   ' + d));
    process.exit(1);
  }

  // ---- load prod state -------------------------------------------------
  const { data: brandData, error: brandErr } = await supabase
    .from('brands')
    .select('id, brand_code, is_active, is_paused')
    .eq('project_key', PROJECT_KEY);
  if (brandErr) {
    console.error('Failed to load brands:', brandErr.message);
    process.exit(1);
  }
  const brands = (brandData ?? []) as BrandRow[];
  const brandByCode = new Map(brands.map((b) => [b.brand_code.toUpperCase(), b]));

  const { data: existingDir, error: dirErr } = await supabase
    .from('directives')
    .select('id, title')
    .eq('project_key', PROJECT_KEY);
  if (dirErr) {
    console.error('Failed to load existing directives:', dirErr.message);
    process.exit(1);
  }
  const existingTitles = new Set((existingDir ?? []).map((d) => d.title));

  // ---- brand-code + active-state validation (hard fail) ----------------
  const referencedCodes = [...new Set(rows.map((r) => r.brandCode))];
  const unmatched = referencedCodes.filter((c) => !brandByCode.has(c));
  const inactive = referencedCodes.filter((c) => brandByCode.get(c)?.is_active === false);

  if (unmatched.length) {
    console.error(
      `❌ ${unmatched.length} brand_code(s) in the CSV do not match any ${PROJECT_KEY} ` +
        `brands.brand_code — cells would be silently dropped. Nothing loaded:`,
    );
    unmatched.forEach((c) => console.error('   ' + c));
    process.exit(1);
  }
  if (inactive.length) {
    console.error(
      `❌ ${inactive.length} referenced brand(s) are is_active=FALSE — a cell on an ` +
        `inactive brand won't render in the matrix. Reactivate or drop them, then re-run:`,
    );
    inactive.forEach((c) => console.error('   ' + c));
    process.exit(1);
  }

  // ---- group by directive title ----------------------------------------
  const byTitle = new Map<string, LoadRow[]>();
  for (const r of rows) {
    if (!byTitle.has(r.title)) byTitle.set(r.title, []);
    byTitle.get(r.title)!.push(r);
  }

  const toCreate: string[] = [];
  const toSkip: string[] = [];
  for (const title of byTitle.keys()) {
    (existingTitles.has(title) ? toSkip : toCreate).push(title);
  }

  // ---- plan report -----------------------------------------------------
  const createRows = toCreate.flatMap((t) => byTitle.get(t)!);
  const statusTotals: Record<CellStatus, number> = {
    todo: 0, in_progress: 0, done: 0, blocked: 0, n_a: 0,
  };
  const todoByBrand = new Map<string, number>();
  for (const r of createRows) {
    statusTotals[r.status] += 1;
    if (r.status === 'todo') todoByBrand.set(r.brandCode, (todoByBrand.get(r.brandCode) ?? 0) + 1);
  }

  console.log(`\nDirectives:  ${byTitle.size} in file → create ${toCreate.length}, skip ${toSkip.length} (already exist)`);
  console.log(`Brands:      ${referencedCodes.length} referenced / ${brands.length} in ${PROJECT_KEY}`);
  console.log(`Cells to insert: ${createRows.length}`);
  console.log(
    `  done ${statusTotals.done} · todo ${statusTotals.todo} · n_a ${statusTotals.n_a}` +
      (statusTotals.in_progress || statusTotals.blocked
        ? ` · in_progress ${statusTotals.in_progress} · blocked ${statusTotals.blocked}`
        : ''),
  );
  if (toSkip.length) {
    console.log(`\nSkipped (idempotency — title already in ${PROJECT_KEY}):`);
    toSkip.forEach((t) => console.log('   • ' + t));
  }
  console.log(`\nTo-do per brand (parity check vs handoff §2):`);
  [...todoByBrand.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([code, n]) => console.log(`   ${code.padEnd(7)} ${n}`));

  if (createRows.length === 0) {
    console.log('\nNothing to create — everything already loaded. Done.');
    return;
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] No changes made.');
    return;
  }

  // ---- confirm ---------------------------------------------------------
  if (!SKIP_CONFIRM) {
    const rl = createInterface({ input, output });
    const answer = await rl.question(
      `\nThis will create ${toCreate.length} directive(s) + ${createRows.length} cell(s) ` +
        `and emit ~${toCreate.length * 2} audit_log row(s). Type 'yes' to proceed: `,
    );
    rl.close();
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('Aborted.');
      return;
    }
  }

  // ---- insert directives ----------------------------------------------
  const directiveInserts = toCreate.map((title) => ({
    project_key: PROJECT_KEY,
    title,
    directive_type: byTitle.get(title)![0].directiveType,
    description: null as string | null,
    status: 'active' as const,
    created_by: CHANGED_BY,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from('directives')
    .insert(directiveInserts)
    .select('id, title');
  if (insErr || !inserted) {
    console.error('Directive insert failed:', insErr?.message);
    process.exit(1);
  }
  const idByTitle = new Map(inserted.map((d) => [d.title, d.id as string]));
  console.log(`\n✓ Created ${inserted.length} directives.`);

  // ---- insert cells ----------------------------------------------------
  const cellInserts = createRows.map((r) => ({
    directive_id: idByTitle.get(r.title)!,
    brand_id: brandByCode.get(r.brandCode)!.id,
    status: r.status,
    note: null as string | null,
    updated_by: CHANGED_BY,
  }));

  const createdIds = inserted.map((d) => d.id as string);
  let cellsWritten = 0;
  for (const batch of chunk(cellInserts, 500)) {
    const { error } = await supabase.from('directive_brand_status').insert(batch);
    if (error) {
      // Directives are already in (one atomic insert), but cells are now
      // PARTIAL. The title-based idempotency guard would skip these titles on
      // a naive re-run and never backfill the gap (Karen MEDIUM). So print the
      // exact clean-up before exiting: delete the created directives (cells
      // cascade via ON DELETE CASCADE), then re-run from clean.
      console.error(`\n❌ Cell insert failed after ${cellsWritten}/${cellInserts.length} cells:`, error.message);
      console.error(
        `\n⚠ PARTIAL STATE — ${inserted.length} directives created, cells incomplete.\n` +
          `   Do NOT simply re-run (the guard will skip these titles and leave the gap).\n` +
          `   Delete the partially-loaded directives (cells cascade), then re-run:\n\n` +
          `   DELETE FROM directives WHERE project_key = '${PROJECT_KEY}' AND id IN (\n     '${createdIds.join("',\n     '")}'\n   );\n`,
      );
      process.exit(1);
    }
    cellsWritten += batch.length;
  }
  console.log(`✓ Inserted ${cellsWritten} cells.`);

  // ---- audit -----------------------------------------------------------
  const auditRows = toCreate.flatMap((title) => {
    const id = idByTitle.get(title)!;
    const cells = byTitle.get(title)!;
    const d = cells.filter((c) => c.status === 'done').length;
    const t = cells.filter((c) => c.status === 'todo').length;
    const na = cells.filter((c) => c.status === 'n_a').length;
    return [
      {
        log_entry_id: null,
        target_type: 'directive',
        target_id: id,
        action: 'CREATE',
        field_name: 'title',
        old_value: null,
        new_value: title,
        changed_by: CHANGED_BY,
        notes: 'Bulk goal-directive load (NBLY_Goal_Tracker, 2026-07-21)',
      },
      {
        log_entry_id: null,
        target_type: 'directive',
        target_id: id,
        action: 'CREATE',
        field_name: 'directive_brand_status',
        old_value: null,
        new_value: `loaded ${cells.length} cells (done ${d}, todo ${t}, n_a ${na})`,
        changed_by: CHANGED_BY,
        notes: 'Bulk goal-directive load (NBLY_Goal_Tracker, 2026-07-21)',
      },
    ];
  });

  let auditWritten = 0;
  for (const batch of chunk(auditRows, 500)) {
    const { error } = await supabase.from('audit_log').insert(batch);
    if (error) {
      // Directive + cells exist; surface the audit gap without rolling back
      // (mirrors the directives route + qa-config precedent).
      console.error(`⚠ audit_log insert failed after ${auditWritten} rows:`, error.message);
      break;
    }
    auditWritten += batch.length;
  }
  console.log(`✓ Wrote ${auditWritten} audit_log rows.`);

  // ---- post-verify -----------------------------------------------------
  const { count: dirCount } = await supabase
    .from('directives')
    .select('id', { count: 'exact', head: true })
    .eq('project_key', PROJECT_KEY);
  // Assert the cells actually landed for the directives we just created
  // (Karen LOW-1): a short insert would otherwise pass silently.
  const { count: cellCount } = await supabase
    .from('directive_brand_status')
    .select('id', { count: 'exact', head: true })
    .in('directive_id', createdIds);
  if (cellCount !== cellInserts.length) {
    console.error(
      `\n⚠ CELL COUNT MISMATCH — expected ${cellInserts.length} cells for the ${inserted.length} ` +
        `new directives, DB reports ${cellCount ?? '?'}. Investigate before trusting the matrix.`,
    );
  } else {
    console.log(`✓ Verified ${cellCount} cells for the ${inserted.length} new directives.`);
  }
  console.log(`\nDone. ${PROJECT_KEY} now has ${dirCount ?? '?'} directives total.`);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
