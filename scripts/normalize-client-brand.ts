// scripts/normalize-client-brand.ts
//
// Normalizes historical quality_logs.client_brand values from raw
// brand codes (e.g. 'ASV', 'MRR') to canonical brands.jira_value
// format ('ASV - Aire Serv', 'MRR - Mr Rooter Plumbing').
//
// Closes Batch 005.25 finding F2 (5.19 sweep): pre-Phase-1
// CSV-imported rows store raw codes; post-Phase-1 webhook rows
// store full jira_value. Filter dropdowns sourcing from
// brands.jira_value would not match raw-code rows on .eq().
//
// Idempotent: re-running produces zero updates after the first
// successful pass. Safe to run multiple times. Non-destructive:
// raw codes that don't match any brand row are logged for manual
// review but left in place.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/normalize-client-brand.ts             # dry run (default)
//   npx tsx --env-file=.env.local scripts/normalize-client-brand.ts --execute   # apply changes
//
// Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Audit trail per §13 rule 2:
//   Every updated quality_logs row produces one audit_log row with
//   target_type='quality_log', changed_by='system:normalize-client-brand',
//   action='UPDATE', field_name='client_brand'.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Invoke with `npx tsx --env-file=.env.local scripts/normalize-client-brand.ts`.',
  );
  process.exit(1);
}

const EXECUTE = process.argv.includes('--execute');
const CHANGED_BY = 'system:normalize-client-brand';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface BrandRow {
  brand_code: string;
  jira_value: string;
}

interface QualityLogRow {
  id: string;
  client_brand: string;
}

async function main() {
  console.log(
    `\n=== normalize-client-brand ${EXECUTE ? '(EXECUTE MODE)' : '(DRY RUN)'} ===\n`,
  );

  // 1. Load brands catalog
  const { data: brands, error: brandsErr } = await supabase
    .from('brands')
    .select('brand_code, jira_value');

  if (brandsErr || !brands) {
    console.error('Failed to load brands:', brandsErr);
    process.exit(1);
  }

  console.log(`Loaded ${brands.length} brand rows.`);

  // Build lookup: brand_code -> jira_value. Detect duplicates so an
  // ambiguous brand_code can't silently pick the wrong target.
  const codeToJiraValue = new Map<string, string>();
  const duplicateCodes = new Set<string>();
  for (const b of brands as BrandRow[]) {
    if (codeToJiraValue.has(b.brand_code)) {
      duplicateCodes.add(b.brand_code);
    }
    codeToJiraValue.set(b.brand_code, b.jira_value);
  }
  if (duplicateCodes.size > 0) {
    console.warn(
      `WARNING: ${duplicateCodes.size} duplicate brand_code(s) in brands table:`,
      [...duplicateCodes],
    );
    console.warn(
      'Rows mapping to these codes will be skipped to avoid ambiguous resolution.',
    );
  }

  // Canonical-value set for fast "already correct" check
  const canonicalValues = new Set(brands.map(b => b.jira_value));

  // 2. Load all non-deleted quality_logs with non-null client_brand
  const { data: logs, error: logsErr } = await supabase
    .from('quality_logs')
    .select('id, client_brand')
    .eq('is_deleted', false)
    .not('client_brand', 'is', null);

  if (logsErr || !logs) {
    console.error('Failed to load quality_logs:', logsErr);
    process.exit(1);
  }

  console.log(`Loaded ${logs.length} non-deleted logs with client_brand.\n`);

  // 3. Categorize
  const updates: Array<{ id: string; oldVal: string; newVal: string }> = [];
  const unmatched = new Map<string, number>();
  const ambiguous = new Map<string, number>();
  let alreadyCanonical = 0;

  for (const log of logs as QualityLogRow[]) {
    const current = log.client_brand;
    if (canonicalValues.has(current)) {
      alreadyCanonical++;
      continue;
    }
    const candidateCode = current.includes(' - ')
      ? current.split(' - ')[0].trim()
      : current.trim();

    if (duplicateCodes.has(candidateCode)) {
      ambiguous.set(current, (ambiguous.get(current) ?? 0) + 1);
      continue;
    }

    const target = codeToJiraValue.get(candidateCode);
    if (target) {
      updates.push({ id: log.id, oldVal: current, newVal: target });
    } else {
      unmatched.set(current, (unmatched.get(current) ?? 0) + 1);
    }
  }

  // 4. Report
  console.log(`Already canonical:        ${alreadyCanonical}`);
  console.log(`Will normalize:           ${updates.length}`);
  console.log(
    `Ambiguous (dup code):     ${[...ambiguous.values()].reduce((a, b) => a + b, 0)}`,
  );
  console.log(
    `Unmatched (no brand row): ${[...unmatched.values()].reduce((a, b) => a + b, 0)}`,
  );

  if (updates.length > 0) {
    const byMapping = new Map<string, number>();
    for (const u of updates) {
      const key = `${u.oldVal} -> ${u.newVal}`;
      byMapping.set(key, (byMapping.get(key) ?? 0) + 1);
    }
    console.log('\nMappings:');
    for (const [mapping, count] of [...byMapping.entries()].sort()) {
      console.log(`  ${mapping}  (${count} row${count === 1 ? '' : 's'})`);
    }
  }

  if (ambiguous.size > 0) {
    console.log('\nAmbiguous values (skipped — dup brand_code in catalog):');
    for (const [val, count] of [...ambiguous.entries()].sort()) {
      console.log(`  "${val}"  (${count} row${count === 1 ? '' : 's'})`);
    }
  }

  if (unmatched.size > 0) {
    console.log('\nUnmatched values (manual review — no brand row found):');
    for (const [val, count] of [...unmatched.entries()].sort()) {
      console.log(`  "${val}"  (${count} row${count === 1 ? '' : 's'})`);
    }
  }

  if (!EXECUTE) {
    console.log('\n[dry run] No changes made. Re-run with --execute to apply.');
    return;
  }

  if (updates.length === 0) {
    console.log('\nNothing to update.');
    return;
  }

  // 5. Apply updates + audit rows
  console.log(`\nApplying ${updates.length} updates...`);

  const nowIso = new Date().toISOString();
  let successCount = 0;
  let errorCount = 0;
  let auditFailCount = 0;

  for (const u of updates) {
    const { error: updateErr } = await supabase
      .from('quality_logs')
      .update({ client_brand: u.newVal, updated_at: nowIso })
      .eq('id', u.id);

    if (updateErr) {
      console.error(`  Failed to update ${u.id}: ${updateErr.message}`);
      errorCount++;
      continue;
    }

    const { error: auditErr } = await supabase.from('audit_log').insert({
      log_entry_id: u.id,
      action: 'UPDATE',
      field_name: 'client_brand',
      old_value: u.oldVal,
      new_value: u.newVal,
      changed_by: CHANGED_BY,
      target_type: 'quality_log',
      target_id: u.id,
      notes:
        'Batch 005.25 normalization: pre-Phase-1 raw code -> canonical jira_value',
    });

    if (auditErr) {
      console.error(
        `  Updated ${u.id} but audit insert failed: ${auditErr.message}`,
      );
      auditFailCount++;
    }

    successCount++;
  }

  console.log(
    `\nDone. ${successCount} updates succeeded, ${errorCount} failed, ${auditFailCount} with audit-write errors.`,
  );

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
