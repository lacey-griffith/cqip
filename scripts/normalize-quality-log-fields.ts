// scripts/normalize-quality-log-fields.ts
//
// One-shot normalization of historical drift on the 5 multi-select
// fields:
//   - issue_category   (taxonomy field_name='issue_category')
//   - issue_subtype    (taxonomy field_name='issue_subtype')
//   - root_cause_initial (taxonomy field_name='root_cause')
//   - root_cause_final   (taxonomy field_name='root_cause')
//   - resolution_type  (taxonomy field_name='resolution_type')
//
// Reads the mapping in FIELD_MAPPINGS below (mirrors
// docs/root-cause-taxonomy-mapping.md as resolved by DC + Lacey
// 2026-05-20). Closes Batch 005.28.
//
// Idempotent: re-running produces zero changes after the first
// successful pass. Audit-logged: one audit_log row per changed
// field per quality_log. Cross-field-pollution elements are removed
// from the array and the row is flagged needs_review = TRUE.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/normalize-quality-log-fields.ts --dry-run
//       Print the change plan, write nothing.
//   npx tsx --env-file=.env.local scripts/normalize-quality-log-fields.ts
//       Print plan, prompt "Type 'yes' to proceed", then write.
//   npx tsx --env-file=.env.local scripts/normalize-quality-log-fields.ts --yes
//       Skip the prompt (CI / re-run).
//
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Audit attribution per §13 rule 20 (cron/system context):
//   changed_by = 'system:normalize-quality-log-fields'
//   target_type = 'quality_log', target_id = the log id

import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Invoke with `npx tsx --env-file=.env.local scripts/normalize-quality-log-fields.ts`.',
  );
  process.exit(1);
}

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const SKIP_CONFIRM = ARGS.includes('--yes');
const CHANGED_BY = 'system:normalize-quality-log-fields';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// -------------------------------------------------------------------------
// FIELD_MAPPINGS — mirrors docs/root-cause-taxonomy-mapping.md.
// Targets are Jira-verbatim per N2 Policy A (locked 2026-05-20).
//
// Each entry:
//   canonical: string — the verbatim Jira value to map to, OR
//                       null to mark cross-field pollution
//                       (element removed from array, row flagged needs_review)
//   needsReview: boolean — set needs_review = TRUE when this mapping fires
//   reason: short audit_log notes string
// -------------------------------------------------------------------------
type MappingEntry = {
  canonical: string | null;
  needsReview: boolean;
  reason: string;
};

type TaxonomyField = 'issue_category' | 'issue_subtype' | 'root_cause' | 'resolution_type';

const FIELD_MAPPINGS: Record<TaxonomyField, Record<string, MappingEntry>> = {
  issue_category: {
    'CRO - Frontend Issue':            { canonical: 'CRO Implementation',     needsReview: false, reason: 'Legacy "Type of Issue" → Jira Category translation' },
    'Convert Configuration':           { canonical: 'Experiment Configuration', needsReview: false, reason: 'Legacy translation; Convert is the experiment tool' },
    'Process/Communication Issue':     { canonical: 'Process/ Communication', needsReview: false, reason: 'Legacy translation; "Issue" suffix dropped' },
    'Client - Frontend Issue':         { canonical: 'Client Website Code',    needsReview: false, reason: 'Legacy translation; frontend/backend granularity now in Subtype' },
    'Client - Data/Source File Issue': { canonical: 'Client Data/Feed',       needsReview: false, reason: 'Legacy translation; direct rename' },
    'Design/ Visual':                  { canonical: null,                     needsReview: true,  reason: "Removed canonical (Issue Category); symptom belongs in Issue Subtype. Cross-field pollution rule: element removed, needs_review = TRUE." },
    'External Dependency Change':      { canonical: 'External Factor',        needsReview: false, reason: 'Legacy translation; new canonical absorbs legacy concept' },
  },

  // root_cause covers BOTH root_cause_initial and root_cause_final columns
  root_cause: {
    'Missing / Miscommunicated Info':          { canonical: 'Missing Assets/ Info',                needsReview: true,  reason: "3-way-split default per Interpretation C; Lacey reclassifies between Missing Assets/ Info, Unclear/ Conflicting Requirements, Late Assets/ Info" },
    'Missing or Miscommunicated Information':  { canonical: 'Missing Assets/ Info',                needsReview: true,  reason: 'Deprecated canonical; same 3-way-split default as "Missing / Miscommunicated Info"' },
    'CRO Code / Configuration Error':          { canonical: 'CRO Code Error',                      needsReview: false, reason: 'Legacy "Root Cause - Final" → Jira translation; direct match' },
    'CRO Code / Config Error':                 { canonical: 'CRO Code Error',                      needsReview: false, reason: 'Abbreviated spelling of "CRO Code / Configuration Error"' },
    'External Dependency Change':              { canonical: 'External Factor/ Environment Change', needsReview: false, reason: 'New canonical absorbs the legacy "Environment / External Factors" concept' },
    'Process / QA Gap':                        { canonical: 'Process Gap',                         needsReview: true,  reason: 'Process/QA-split default per Interpretation C; Lacey reclassifies to QA Gap per row when appropriate' },
    'Requirement / Scope Change':              { canonical: 'Requirement or Scope Change',         needsReview: false, reason: 'Legacy translation; slash vs "or"' },
    'Design/Visual':                           { canonical: null,                                  needsReview: true,  reason: "Cross-field pollution: this is an Issue Category value mistakenly stored in root_cause. Element removed; needs_review = TRUE." },
    'CRO Implementation':                      { canonical: null,                                  needsReview: true,  reason: "Cross-field pollution: this is an Issue Category canonical value mistakenly stored in root_cause. Element removed; needs_review = TRUE." },
    'CRO Code':                                { canonical: 'CRO Code Error',                      needsReview: true,  reason: 'Ambiguous one-word free-text edit; DC-confirmed default to CRO Code Error. needs_review = TRUE so Lacey can switch to Experiment Setup Error if appropriate.' },
    'Client Code':                             { canonical: 'Client Side Code Issue',              needsReview: false, reason: 'Only canonical option for client-side code problems; DC-confirmed mechanical' },
    'Client Code / Backend Error':             { canonical: 'Client Side Code Issue',              needsReview: false, reason: 'Legacy translation; direct rename' },
    'Data / Mapping Issue':                    { canonical: 'Client Data/ Feed Issue',             needsReview: false, reason: 'Legacy translation; Jira-verbatim target' },
    'Unknown / Needs Investigation':           { canonical: 'Unknown/ Needs Investigation',        needsReview: false, reason: 'Re-added to Jira post-Phase-1; spacing-normalized to Jira-verbatim' },
  },

  // Field has zero historical drift per audit. Empty mapping; if a future
  // value appears, it's logged as unmatched and left in place.
  issue_subtype: {},

  resolution_type: {},
};

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------
interface TaxonomyRow {
  field_name: TaxonomyField;
  canonical_value: string;
}

interface QualityLogRow {
  id: string;
  needs_review: boolean;
  issue_category: string[] | null;
  issue_subtype: string[] | null;
  root_cause_initial: string[] | null;
  root_cause_final: string[] | null;
  resolution_type: string[] | null;
}

interface FieldChange {
  field: string;                    // quality_logs column name
  taxonomyField: TaxonomyField;     // taxonomy field_name
  before: string[] | null;
  after: string[] | null;
  notes: string[];                  // one note per element mapped/removed
}

interface RowPlan {
  id: string;
  changes: FieldChange[];
  setNeedsReview: boolean;
  alreadyNeedsReview: boolean;
}

// -------------------------------------------------------------------------
// Per-element normalization
// -------------------------------------------------------------------------
function normalizeArrayField(
  column: string,
  taxonomyField: TaxonomyField,
  source: string[] | null,
  canonicalSet: Set<string>,
  crossFieldCanonicals: Map<string, TaxonomyField>,
  unmatched: Map<string, number>,
): { next: string[] | null; needsReview: boolean; notes: string[]; changed: boolean } {
  if (!source || source.length === 0) {
    return { next: source ?? null, needsReview: false, notes: [], changed: false };
  }

  const mappings = FIELD_MAPPINGS[taxonomyField];
  const out: string[] = [];
  let needsReview = false;
  let changed = false;
  const notes: string[] = [];

  for (const raw of source) {
    if (canonicalSet.has(raw)) {
      // Already canonical for this field — keep as-is
      out.push(raw);
      continue;
    }

    const mapping = mappings[raw];
    if (mapping) {
      if (mapping.canonical === null) {
        // Cross-field pollution: drop element
        notes.push(`Dropped element "${raw}": ${mapping.reason}`);
        needsReview = needsReview || mapping.needsReview;
        changed = true;
        continue;
      }
      // Mapped to a canonical value in this field
      if (mapping.canonical !== raw) {
        notes.push(`Mapped "${raw}" → "${mapping.canonical}": ${mapping.reason}`);
        changed = true;
      }
      out.push(mapping.canonical);
      needsReview = needsReview || mapping.needsReview;
      continue;
    }

    // Not canonical, not in mappings. Check whether the value belongs
    // to a DIFFERENT taxonomy field (cross-field pollution we didn't
    // pre-list). If so, treat as cross-field pollution implicitly.
    const otherField = crossFieldCanonicals.get(raw);
    if (otherField && otherField !== taxonomyField) {
      notes.push(
        `Dropped element "${raw}": cross-field pollution — value belongs to ` +
          `taxonomy field "${otherField}", not "${taxonomyField}". needs_review = TRUE.`,
      );
      needsReview = true;
      changed = true;
      continue;
    }

    // Truly unmatched — keep in place, log for later review
    unmatched.set(`${column}::${raw}`, (unmatched.get(`${column}::${raw}`) ?? 0) + 1);
    out.push(raw);
  }

  // De-dupe (a mapping might collapse two variants onto one canonical)
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const v of out) {
    if (!seen.has(v)) {
      seen.add(v);
      deduped.push(v);
    }
  }
  if (deduped.length !== out.length) changed = true;

  const next = deduped.length === 0 ? null : deduped;
  // Also flag "changed" if before/after differ in shape (null vs [])
  if (!arraysEqual(source, next)) changed = true;

  return { next, needsReview, notes, changed };
}

function arraysEqual(a: string[] | null, b: string[] | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------
async function main() {
  console.log(
    `\n=== normalize-quality-log-fields ${DRY_RUN ? '(DRY RUN)' : '(EXECUTE — will prompt unless --yes)'} ===\n`,
  );

  // Load taxonomy
  const { data: taxRows, error: taxErr } = await supabase
    .from('quality_log_taxonomy')
    .select('field_name, canonical_value')
    .eq('is_active', true);

  if (taxErr || !taxRows) {
    console.error('Failed to load quality_log_taxonomy:', taxErr);
    process.exit(1);
  }

  console.log(`Loaded ${taxRows.length} active taxonomy rows.`);

  // Per-field canonical sets
  const canonicalByField = new Map<TaxonomyField, Set<string>>();
  // Reverse lookup: canonical_value → which field it belongs to (for
  // implicit cross-field pollution detection)
  const valueToField = new Map<string, TaxonomyField>();

  for (const r of taxRows as TaxonomyRow[]) {
    if (!canonicalByField.has(r.field_name)) canonicalByField.set(r.field_name, new Set());
    canonicalByField.get(r.field_name)!.add(r.canonical_value);
    valueToField.set(r.canonical_value, r.field_name);
  }

  // Load non-deleted quality_logs
  const { data: logs, error: logsErr } = await supabase
    .from('quality_logs')
    .select(
      'id, needs_review, issue_category, issue_subtype, root_cause_initial, root_cause_final, resolution_type',
    )
    .eq('is_deleted', false);

  if (logsErr || !logs) {
    console.error('Failed to load quality_logs:', logsErr);
    process.exit(1);
  }

  console.log(`Loaded ${logs.length} non-deleted quality_logs.\n`);

  // Build per-row plans
  const unmatched = new Map<string, number>();
  const plans: RowPlan[] = [];

  // The 5 quality_logs columns → 4 taxonomy fields
  const columnTaxonomy: { column: keyof QualityLogRow; field: TaxonomyField }[] = [
    { column: 'issue_category',     field: 'issue_category' },
    { column: 'issue_subtype',      field: 'issue_subtype' },
    { column: 'root_cause_initial', field: 'root_cause' },
    { column: 'root_cause_final',   field: 'root_cause' },
    { column: 'resolution_type',    field: 'resolution_type' },
  ];

  for (const log of logs as QualityLogRow[]) {
    const plan: RowPlan = {
      id: log.id,
      changes: [],
      setNeedsReview: log.needs_review,
      alreadyNeedsReview: log.needs_review,
    };

    for (const { column, field } of columnTaxonomy) {
      const before = log[column] as string[] | null;
      const canonicalSet = canonicalByField.get(field) ?? new Set();
      const { next, needsReview, notes, changed } = normalizeArrayField(
        column,
        field,
        before,
        canonicalSet,
        valueToField,
        unmatched,
      );
      if (changed) {
        plan.changes.push({
          field: column,
          taxonomyField: field,
          before,
          after: next,
          notes,
        });
        plan.setNeedsReview = plan.setNeedsReview || needsReview;
      }
    }

    if (plan.changes.length > 0 || (plan.setNeedsReview && !plan.alreadyNeedsReview)) {
      plans.push(plan);
    }
  }

  // -------- Report --------
  const totalFieldChanges = plans.reduce((acc, p) => acc + p.changes.length, 0);
  const newlyFlagged = plans.filter(p => p.setNeedsReview && !p.alreadyNeedsReview).length;

  console.log('--- Plan summary ---');
  console.log(`Rows examined:           ${logs.length}`);
  console.log(`Rows to modify:          ${plans.length}`);
  console.log(`Field-changes to apply:  ${totalFieldChanges}`);
  console.log(`Rows newly flagged for review: ${newlyFlagged}`);

  // Per-field breakdown
  const perField = new Map<string, number>();
  for (const p of plans) {
    for (const c of p.changes) {
      perField.set(c.field, (perField.get(c.field) ?? 0) + 1);
    }
  }
  if (perField.size > 0) {
    console.log('\nField-changes by column:');
    for (const [field, count] of [...perField.entries()].sort()) {
      console.log(`  ${field.padEnd(22)} ${count}`);
    }
  }

  if (unmatched.size > 0) {
    console.log('\nUnmatched values (left in place — not in taxonomy or mapping):');
    for (const [key, count] of [...unmatched.entries()].sort()) {
      console.log(`  ${key}  (${count})`);
    }
  }

  if (plans.length === 0) {
    console.log('\nNothing to normalize. The taxonomy is already aligned.');
    return;
  }

  // Show first 10 row plans as a sample
  console.log('\nSample plans (first 10):');
  for (const p of plans.slice(0, 10)) {
    console.log(`\n  log ${p.id}${p.alreadyNeedsReview ? ' [already needs_review]' : ''}`);
    if (!p.alreadyNeedsReview && p.setNeedsReview) console.log('    → will set needs_review = TRUE');
    for (const c of p.changes) {
      console.log(`    ${c.field}:`);
      console.log(`      before: ${JSON.stringify(c.before)}`);
      console.log(`      after:  ${JSON.stringify(c.after)}`);
      for (const note of c.notes) console.log(`      · ${note}`);
    }
  }
  if (plans.length > 10) console.log(`\n  ...and ${plans.length - 10} more`);

  if (DRY_RUN) {
    console.log('\n[dry-run] No changes made.');
    return;
  }

  // -------- Confirm --------
  if (!SKIP_CONFIRM) {
    const rl = createInterface({ input, output });
    const answer = await rl.question(
      `\nThis will modify ${plans.length} row(s) and emit ${totalFieldChanges} audit_log row(s). Type 'yes' to proceed: `,
    );
    rl.close();
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('Aborted. No changes made.');
      return;
    }
  }

  // -------- Apply --------
  const nowIso = new Date().toISOString();
  let rowSuccess = 0;
  let rowFail = 0;
  let auditFail = 0;

  for (const p of plans) {
    const updates: Record<string, unknown> = { updated_at: nowIso };
    for (const c of p.changes) updates[c.field] = c.after;
    if (p.setNeedsReview && !p.alreadyNeedsReview) updates.needs_review = true;

    const { error: updErr } = await supabase
      .from('quality_logs')
      .update(updates)
      .eq('id', p.id);

    if (updErr) {
      console.error(`  Update failed for ${p.id}: ${updErr.message}`);
      rowFail += 1;
      continue;
    }

    // One audit_log row per changed field
    const auditRows = p.changes.map(c => ({
      log_entry_id: p.id,
      action: 'UPDATE',
      field_name: c.field,
      old_value: c.before === null ? null : JSON.stringify(c.before),
      new_value: c.after === null ? null : JSON.stringify(c.after),
      changed_by: CHANGED_BY,
      changed_at: nowIso,
      target_type: 'quality_log',
      target_id: p.id,
      notes: c.notes.length > 0
        ? `Batch 005.28 taxonomy normalization. ${c.notes.join(' | ')}`
        : 'Batch 005.28 taxonomy normalization.',
    }));

    // If newly flagged needs_review, also emit an audit row for that
    if (p.setNeedsReview && !p.alreadyNeedsReview) {
      auditRows.push({
        log_entry_id: p.id,
        action: 'UPDATE',
        field_name: 'needs_review',
        old_value: 'false',
        new_value: 'true',
        changed_by: CHANGED_BY,
        changed_at: nowIso,
        target_type: 'quality_log',
        target_id: p.id,
        notes:
          'Batch 005.28 taxonomy normalization flagged this row for human review (Interpretation C default or cross-field pollution).',
      });
    }

    const { error: auditErr } = await supabase.from('audit_log').insert(auditRows);
    if (auditErr) {
      console.error(`  Update OK for ${p.id} but audit insert failed: ${auditErr.message}`);
      auditFail += 1;
    }

    rowSuccess += 1;
  }

  console.log(
    `\nDone. ${rowSuccess} row(s) updated, ${rowFail} failed, ${auditFail} with audit-write errors.`,
  );

  if (rowFail > 0) process.exit(1);
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
