// lib/classifier/* — AI root-cause classifier, Phase 1.
//
// Spec: docs/HANDOFF-root-cause-classifier.md §10, as extended by §13.10.
//
// FOUR OF LACEY'S NON-NEGOTIABLES ARE TESTS HERE, NOT COMMENTS — in her priority
// order, which is also the order of the sections below:
//
//   1. The classifier never writes root_cause_final.  ← had NO verification item
//      in §10 at all. The single most important guarantee in the batch was the one
//      thing nothing checked (Jenny).
//   2. Blinding is enforced at the query layer, and the test asserts on the REAL
//      outgoing payload object — not a reconstruction, which would share an
//      ancestor with the thing under test (CLAUDE.md §15, four recorded times).
//   3. ai_review_pending clears ONLY on explicit confirm/reject.
//   4. Out-of-vocabulary output is dropped, never stored, and the vocabulary is
//      never widened to accommodate the model.
//
// Run: npx tsx --test tests/classifier.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildClassifierPayload,
  CLASSIFIER_READ_FIELDS,
  CLASSIFIER_BLINDED_FIELDS,
} from '../lib/classifier/payload';
import {
  checkVocabulary,
  findInvalidTaxonomyValues,
  ROOT_CAUSE_TAXONOMY_FIELD,
} from '../lib/classifier/vocabulary';
import {
  deriveConfidenceBand,
  CONFIDENCE_BANDS,
  isConfidenceBand,
} from '../lib/classifier/confidence';
import {
  buildClassifierUpdate,
  CLASSIFIER_WRITE_FIELDS,
  CLASSIFIER_CHANGED_BY,
  classifyReviewOutcome,
  buildSuggestionAuditRow,
  buildReviewOutcomeAuditRow,
} from '../lib/classifier/suggestion';
import {
  parseModelText,
  CLASSIFIER_MODEL,
  ClassifierModelError,
  requestClassification,
  CLASSIFIER_API_KEY_ENV,
} from '../lib/classifier/model';

const REPO = process.cwd();
function readOrFail(path: string): string {
  const full = join(REPO, path);
  assert.ok(existsSync(full), `expected ${full} — run tests from the repo root`);
  return readFileSync(full, 'utf8');
}

// The live vocabulary, as of the 2026-08-10 prod probe. Used as a fixture only —
// production reads it from quality_log_taxonomy at request time (§13.3), and
// nothing in lib/classifier hardcodes it.
const VOCAB = [
  'CRO Code Error',
  'Experiment Setup Error',
  'Missing Assets/ Info',
  'Process Gap',
  'QA Gap',
  'Client Side Code Issue',
  'Client Data/ Feed Issue',
  'Third Party Tool Change',
  'Requirement or Scope Change',
  'Client Request',
  'Unknown/ Needs Investigation',
  'External Factor/ Environment Change',
  'Unclear/ Conflicting Requirements',
  'Late Assets/ Info',
];

// ---------------------------------------------------------------------------
// NON-NEGOTIABLE 1 — the classifier never writes root_cause_final
// ---------------------------------------------------------------------------

test('NN1: the classifier write set is exactly the three AI columns', () => {
  const update = buildClassifierUpdate(['Process Gap'], 'high');
  assert.deepEqual(Object.keys(update).sort(), [...CLASSIFIER_WRITE_FIELDS].sort());
});

test('NN1: root_cause_final is not a key of the classifier update, ever', () => {
  // `in` distinguishes absent from present-and-null. Present-and-null would still
  // destroy the stored value — the distinction the sync-guard batch turned on.
  for (const band of CONFIDENCE_BANDS) {
    for (const values of [[], ['Process Gap'], ['Process Gap', 'QA Gap']]) {
      const update = buildClassifierUpdate(values, band) as unknown as Record<string, unknown>;
      assert.equal('root_cause_final' in update, false);
      assert.equal('root_cause_initial' in update, false);
    }
  }
});

test('NN1: the classify ROUTE never mentions root_cause_final as a write target', () => {
  // The unit test above pins the builder; this pins the deployed route, which
  // could bypass the builder entirely with an inline update object.
  const src = readOrFail('app/api/admin/logs/classify/route.ts');
  assert.ok(
    !/root_cause_final\s*:/.test(src),
    'classify route must not assign root_cause_final in any object literal',
  );
  assert.ok(
    /buildClassifierUpdate\(/.test(src),
    'classify route must build its update via buildClassifierUpdate',
  );

  // Karen HIGH-1. The object-literal ban above was the ONLY ban, and it does not
  // see ASSIGNMENT — so `update.root_cause_final = accepted` immediately after the
  // builder returns passed tsc and the whole suite while writing the canonical
  // field on every classified row. That is not a hypothetical: §13 r37 records the
  // identical bypass on the sync guard two days earlier, and states the ban must
  // cover "both dot and bracket notation". It was not ported. It is now.
  //
  // Worded to match the sync guard's own test on purpose, so the two read alike.
  assert.ok(
    !/\.\s*root_cause_final\s*=/.test(src),
    'classify route must not assign onto root_cause_final in dot notation (r37 bypass shape)',
  );
  assert.ok(
    !/\[\s*['"`]root_cause_final['"`]\s*\]\s*=/.test(src),
    'classify route must not assign onto root_cause_final in bracket notation (r37 bypass shape)',
  );
  // root_cause_initial is frozen at creation by §13 r3 and belongs to nobody here.
  assert.ok(
    !/\.\s*root_cause_initial\s*=|\[\s*['"`]root_cause_initial['"`]\s*\]\s*=|root_cause_initial\s*:/.test(
      src,
    ),
    'classify route must not write root_cause_initial in any form',
  );
});

test('NN1: ai_confidence_score is never written by the classifier', () => {
  // §13.4 leaves it unwritten deliberately. Writing the raw float "for reference"
  // would recreate the orderable number §11.2 exists to eliminate.
  const update = buildClassifierUpdate(['QA Gap'], 'medium') as unknown as Record<string, unknown>;
  assert.equal('ai_confidence_score' in update, false);
  const src = readOrFail('app/api/admin/logs/classify/route.ts');
  assert.ok(!/ai_confidence_score/.test(src), 'classify route must not touch ai_confidence_score');
});

// ---------------------------------------------------------------------------
// NON-NEGOTIABLE 2 — blinding, asserted on the real outgoing payload
// ---------------------------------------------------------------------------

// The eight readable fields, written out as LITERALS rather than imported.
//
// Karen MEDIUM-1. This assertion previously compared the payload keys against
// CLASSIFIER_READ_FIELDS — the very array buildClassifierPayload iterates to build
// them. The expectation moved with the value, so deleting a field from the
// whitelist passed the suite: the shared-ancestor pattern §15 records four times,
// where the oracle is not independent of the artifact under test. §13.10 names
// "drop one field from the payload whitelist" as a mutation that MUST fail, and it
// did not.
//
// Blinding itself was never broken — a narrowed feedstock silently degrades
// suggestion quality with no error, which is the failure this now catches.
// Duplicating the list is the point: it must be edited twice, deliberately.
const EXPECTED_PAYLOAD_KEYS = [
  'jira_summary',
  'resolution_notes',
  'notes',
  'issue_details',
  'trigger_from_status',
  'trigger_to_status',
  'client_brand',
  'test_type',
].sort();

test('NN2: the payload key set is EXACTLY the eight readable fields (whitelist)', () => {
  // A whitelist, not a denylist of the six excluded names. A denylist passes
  // forever as columns are added; this fails the moment a seventh key appears.
  const row = {
    id: 'log-1',
    jira_summary: 'Carousel broke on mobile',
    resolution_notes: 'Client asked for a copy change after dev.',
    notes: null,
    issue_details: 'Text overflowed the container.',
    trigger_from_status: 'Dev QA',
    trigger_to_status: 'Active Dev',
    client_brand: 'MRA - Mr Appliance',
    test_type: 'A/B',
    // Everything below is blinded and must not survive into the payload.
    root_cause_final: ['CRO Code Error'],
    root_cause_initial: ['CRO Code Error'],
    ai_suggested_root_cause: ['QA Gap'],
    issue_category: ['CRO Implementation'],
    issue_subtype: ['CSS/ Styling Issue'],
    resolution_type: ['CRO Code Fix'],
  };
  const payload = buildClassifierPayload(row);
  // Anchored to EXPECTED_PAYLOAD_KEYS, not to CLASSIFIER_READ_FIELDS — see the note
  // on that constant. Also assert the two agree, so a whitelist edit fails HERE
  // with a clear message rather than only in the sparse-row test below.
  assert.deepEqual(Object.keys(payload).sort(), EXPECTED_PAYLOAD_KEYS);
  assert.deepEqual(
    [...CLASSIFIER_READ_FIELDS].sort(),
    EXPECTED_PAYLOAD_KEYS,
    'CLASSIFIER_READ_FIELDS drifted from the eight fields the spec blinds around',
  );
});

test('NN2: no blinded field appears in the payload, by key or by value', () => {
  const row = {
    jira_summary: 'summary',
    root_cause_final: ['SENTINEL_ANSWER'],
    root_cause_initial: ['SENTINEL_ANSWER'],
    ai_suggested_root_cause: ['SENTINEL_ANSWER'],
    issue_category: ['SENTINEL_ANSWER'],
    issue_subtype: ['SENTINEL_ANSWER'],
    resolution_type: ['SENTINEL_ANSWER'],
  };
  const payload = buildClassifierPayload(row) as Record<string, unknown>;
  for (const blinded of CLASSIFIER_BLINDED_FIELDS) {
    assert.equal(blinded in payload, false, `${blinded} must not be a payload key`);
  }
  // Serialize and check the sentinel never leaks through some other key — this is
  // what catches an accidental JSON.stringify(row) into a prompt template.
  assert.ok(
    !JSON.stringify(payload).includes('SENTINEL_ANSWER'),
    'no blinded VALUE may appear anywhere in the serialized payload',
  );
});

test('NN2: the payload shape is stable when fields are missing', () => {
  // All eight keys always present, so the whitelist assertion above is meaningful
  // for sparse rows too. Prod 2026-08-10: 0 of 91 non-deleted rows have no prose,
  // but 35 lack `notes` and 54 lack `issue_details`.
  const payload = buildClassifierPayload({ jira_summary: 'only this' });
  assert.deepEqual(Object.keys(payload).sort(), EXPECTED_PAYLOAD_KEYS);
  assert.equal(payload.notes, null);
  assert.equal(payload.jira_summary, 'only this');
});

test('NN2: whitespace-only prose normalises to null, not to a blank string', () => {
  const payload = buildClassifierPayload({ jira_summary: '   ', notes: '' });
  assert.equal(payload.jira_summary, null);
  assert.equal(payload.notes, null);
});

test('NN2: the classify route narrows its own select and never uses select(*)', () => {
  // §13.9's real hole: with a full row in scope one variable away from the
  // payload, JSON.stringify(row) into a prompt is an easy accident. The payload
  // test catches the mistake; the narrow select makes it hard to make.
  const src = readOrFail('app/api/admin/logs/classify/route.ts');
  assert.ok(
    !/\.select\(\s*['"`]\*/.test(src),
    'classify route must not select(*) — it would put blinded fields in scope',
  );
  assert.ok(
    /CLASSIFIER_READ_FIELDS/.test(src),
    'the select must be built from CLASSIFIER_READ_FIELDS so it cannot drift',
  );
});

// ---------------------------------------------------------------------------
// NON-NEGOTIABLE 3 — ai_review_pending clears only on explicit confirm/reject
// ---------------------------------------------------------------------------

test('NN3: the edit route never references ai_review_pending', () => {
  // §4 / §13.2. A general row save must leave the flag untouched, and the only
  // structural way to guarantee that is for the edit route not to know the column
  // exists.
  const src = readOrFail('app/api/logs/edit/route.ts');
  assert.ok(
    !/ai_review_pending/.test(src),
    'POST /api/logs/edit must not reference ai_review_pending — see spec §4 and §13.2',
  );
});

test('NN3: ai_review_pending is absent from the edit route ALLOWED_FIELDS', () => {
  // Belt and braces on the test above: even a future reference must not make the
  // column settable from a generic client payload.
  const src = readOrFail('app/api/logs/edit/route.ts');
  const allowed = src.slice(src.indexOf('ALLOWED_FIELDS'), src.indexOf('TAXONOMY_VALIDATION'));
  assert.ok(allowed.length > 0, 'could not locate ALLOWED_FIELDS block');
  assert.ok(!/ai_review_pending/.test(allowed), 'ai_review_pending must not be editable');
  assert.ok(!/ai_suggested_root_cause/.test(allowed), 'the AI suggestion must not be editable');
  assert.ok(!/ai_confidence_band/.test(allowed), 'the confidence band must not be editable');
});

test('NN3: exactly one route clears ai_review_pending, and it is the review route', () => {
  const review = readOrFail('app/api/admin/logs/ai-review/route.ts');
  assert.ok(
    /ai_review_pending:\s*false/.test(review),
    'the review route must be the writer that clears the flag',
  );
  // The classifier SETS it (true) and must never clear it.
  const classify = readOrFail('app/api/admin/logs/classify/route.ts');
  assert.ok(
    !/ai_review_pending:\s*false/.test(classify),
    'the classify route must not clear the flag',
  );
});

test('NN3: the review route does not copy the needs_review implicit-clear pattern', () => {
  // route.ts:146-153 clears needs_review on ANY save when already set. It is the
  // established local convention, which is exactly why copying it is the path of
  // least resistance — and it is the behaviour §4 exists to prevent. The review
  // route must clear only on an explicit action, so it must require one.
  const src = readOrFail('app/api/admin/logs/ai-review/route.ts');
  assert.ok(/action must be one of/.test(src), 'an explicit action must be required');
  assert.ok(/isAction\(body\.action\)/.test(src), 'the action must be validated, not inferred');
});

// ---------------------------------------------------------------------------
// NON-NEGOTIABLE 4 — OOV dropped, never stored, vocabulary never widened
// ---------------------------------------------------------------------------

test('NN4: invented values are dropped, canonical values kept', () => {
  const { accepted, dropped } = checkVocabulary(
    ['Process Gap', 'Vibes Were Off', 'QA Gap'],
    VOCAB,
  );
  assert.deepEqual(accepted, ['Process Gap', 'QA Gap']);
  assert.deepEqual(dropped, ['Vibes Were Off']);
});

test('NN4: a near-miss on the spacing quirks is a DROP, not a helpful match', () => {
  // The live taxonomy has no space before the slash and one after. A tolerant
  // matcher would accept these and write a value that is not in the taxonomy —
  // which is the drift Batch 005.28 existed to end (18+ near-duplicate variants
  // that silently split charts and broke the Repeat Root Cause exact-string match).
  const nearMisses = [
    'Unknown / Needs Investigation', // space added before the slash
    'Unknown/Needs Investigation', // space removed after
    'unknown/ needs investigation', // case
    'Late Assets/ Info ', // trailing whitespace
    'Missing Assets /Info',
  ];
  const { accepted, dropped } = checkVocabulary(nearMisses, VOCAB);
  assert.deepEqual(accepted, [], 'no near-miss may be accepted');
  assert.equal(dropped.length, nearMisses.length);
});

test('NN4: the three canonical spacing quirks ARE accepted verbatim', () => {
  // The other half of the previous test: strictness must not reject the real ones.
  const exact = [
    'Unknown/ Needs Investigation',
    'Late Assets/ Info',
    'Unclear/ Conflicting Requirements',
  ];
  const { accepted, dropped } = checkVocabulary(exact, VOCAB);
  assert.deepEqual(accepted, exact);
  assert.deepEqual(dropped, []);
});

test('NN4: non-string elements are dropped, not coerced into a match', () => {
  const { accepted, dropped } = checkVocabulary([null, 42, { v: 'QA Gap' }, 'QA Gap'], VOCAB);
  assert.deepEqual(accepted, ['QA Gap']);
  assert.equal(dropped.length, 3);
});

test('NN4: duplicates are collapsed, not counted as drops', () => {
  // A repeat is not an out-of-vocabulary value. Counting it as a drop would
  // overstate the model's error rate, and §2 makes that rate the validation.
  const { accepted, dropped } = checkVocabulary(['QA Gap', 'QA Gap'], VOCAB);
  assert.deepEqual(accepted, ['QA Gap']);
  assert.deepEqual(dropped, []);
});

test('NN4: nothing in lib/classifier hardcodes the vocabulary or its size', () => {
  // §13.3: §7's "13" was wrong (the doc it cites says 14, migration 020 seeds 14,
  // prod has 14 active). The number was DELETED rather than corrected, so writing
  // either number back here would re-arm the same drift.
  for (const file of ['vocabulary.ts', 'model.ts', 'suggestion.ts', 'payload.ts']) {
    const src = readOrFail(`lib/classifier/${file}`);
    const code = src
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
      .join('\n');
    assert.ok(
      !/'CRO Code Error'|"CRO Code Error"/.test(code),
      `${file} must not hardcode a canonical value`,
    );
  }
  assert.equal(ROOT_CAUSE_TAXONOMY_FIELD, 'root_cause');
});

test('NN4: the taxonomy field is root_cause, not root_cause_final', () => {
  // Querying the column name yields an EMPTY vocabulary and a 100% OOV drop rate
  // — which reads as a model failure rather than a bug. Pinned so a "tidy-up"
  // rename cannot introduce it silently.
  assert.equal(ROOT_CAUSE_TAXONOMY_FIELD, 'root_cause');
  for (const file of ['app/api/admin/logs/classify/route.ts', 'app/api/admin/logs/ai-review/route.ts']) {
    const src = readOrFail(file);
    assert.ok(
      !/field_name['"]?\s*,\s*['"]root_cause_final/.test(src) &&
        !/eq\('field_name',\s*'root_cause_final'/.test(src),
      `${file} must not query the taxonomy by column name`,
    );
  }
});

test('NN4: both routes SCOPE the taxonomy read to field_name — widening is banned', () => {
  // Karen MEDIUM-1 (M6). Deleting `.eq('field_name', ROOT_CAUSE_TAXONOMY_FIELD)`
  // widens the vocabulary from the 14 active root_cause rows to all 78 across four
  // fields, and the suite passed. That is not a cosmetic scope error: the model's
  // enum AND the r29 re-validation on confirm both widen together, so an
  // issue_subtype like 'CSS/ Styling Issue' becomes an acceptable ROOT CAUSE and
  // confirm writes it into root_cause_final — re-creating exactly the cross-field
  // pollution Batch 005.28's normalizer existed to clean up, while passing r29 on
  // both surfaces because both surfaces got the same wrong list.
  for (const file of [
    'app/api/admin/logs/classify/route.ts',
    'app/api/admin/logs/ai-review/route.ts',
  ]) {
    const src = readOrFail(file);
    assert.ok(
      /\.eq\(\s*['"]field_name['"]\s*,\s*ROOT_CAUSE_TAXONOMY_FIELD\s*\)/.test(src),
      `${file} must scope its quality_log_taxonomy read to field_name = ROOT_CAUSE_TAXONOMY_FIELD`,
    );
  }
});

test('NN4: a value from ANOTHER taxonomy field is dropped, not accepted', () => {
  // The behavioural half of the check above. A source assertion proves the filter
  // is written; this proves what the filter is FOR — that the vocabulary gate is a
  // pure function of the list it is handed, so a widened list is the only way these
  // values could ever be accepted. Values below are real rows from
  // quality_log_taxonomy under issue_subtype / issue_category / resolution_type
  // (prod, 2026-08-10) — never valid root causes.
  const foreign = [
    'CSS/ Styling Issue', // issue_subtype
    'Client Request', // issue_category — note the collision, see below
    'CRO Code Fix', // resolution_type
    'Incorrect Traffic Allocation', // issue_subtype
  ];
  const { accepted, dropped } = checkVocabulary(foreign, VOCAB);

  // 'Client Request' is deliberately in this list: it exists BOTH as an
  // issue_category and as a root_cause (migration 021 added the category; the root
  // cause predates it). So it is legitimately accepted here, and that is the point
  // — the gate is scoped by the LIST, not by the string, which is precisely why the
  // field_name filter is the thing doing the work.
  assert.deepEqual(accepted, ['Client Request']);
  assert.deepEqual(dropped.sort(), [
    'CRO Code Fix',
    'CSS/ Styling Issue',
    'Incorrect Traffic Allocation',
  ]);
});

// ---------------------------------------------------------------------------
// Confidence band (§11.2 / §13.4)
// ---------------------------------------------------------------------------

test('confidence: bands derive from the number and the number is never returned', () => {
  assert.equal(deriveConfidenceBand(0.95), 'high');
  assert.equal(deriveConfidenceBand(0.8), 'high');
  assert.equal(deriveConfidenceBand(0.79), 'medium');
  assert.equal(deriveConfidenceBand(0.5), 'medium');
  assert.equal(deriveConfidenceBand(0.49), 'low');
  assert.equal(deriveConfidenceBand(0), 'low');
  for (const v of [0, 0.5, 0.8, 1]) assert.ok(isConfidenceBand(deriveConfidenceBand(v)));
});

test('confidence: unusable input becomes low, never null and never a throw', () => {
  // A missing confidence signal is not grounds for discarding a valid suggestion,
  // and certainly not for treating it as trustworthy.
  for (const bad of [undefined, null, NaN, Infinity, -1, 1.5, 'high', {}, []]) {
    assert.equal(deriveConfidenceBand(bad), 'low', `${JSON.stringify(bad)} must be low`);
  }
});

test('confidence: the band is one of exactly three literals, spelled out', () => {
  assert.deepEqual([...CONFIDENCE_BANDS], ['high', 'medium', 'low']);
  // 'med' is rejected on purpose — migration 028's CHECK is the contract, and
  // abbreviating one of three values costs a migration later.
  assert.equal(isConfidenceBand('med'), false);
  assert.equal(isConfidenceBand('HIGH'), false);
});

test('audit: the suggestion row records the SERVED model, not the model we asked for', async () => {
  // Karen MEDIUM-3. `fallbacks: 'default'` means a refusal is answered by a
  // DIFFERENT model at HTTP 200, so CLASSIFIER_MODEL is only the request. §2 makes
  // the correction rate the batch's entire validation, and an aggregate that
  // silently mixes two models is not separable afterward. Tested rather than
  // asserted in prose, because a comment claiming this is exactly the
  // claim-outruns-mechanism shape Karen keeps finding.
  const served = 'claude-opus-4-8-fallback';
  const fakeFetch = (async () =>
    new Response(
      JSON.stringify({
        model: served,
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify({ root_causes: ['QA Gap'], confidence: 0.9 }) }],
      }),
      { status: 200 },
    )) as unknown as typeof fetch;

  process.env[CLASSIFIER_API_KEY_ENV] = 'test-key';
  const raw = await requestClassification(
    buildClassifierPayload({ jira_summary: 's' }),
    VOCAB,
    fakeFetch,
  );
  assert.equal(raw.served_model, served);

  const row = buildSuggestionAuditRow('log-1', ['QA Gap'], 'high', 'lacey@fusion92.com', raw.served_model);
  assert.ok(
    row.notes?.includes(served),
    'the served model must reach the audit trail, or a fallback answer is indistinguishable',
  );
  // And when the API does not report one, say so rather than guessing the constant.
  const noModel = buildSuggestionAuditRow('log-1', ['QA Gap'], 'high', 'lacey@fusion92.com', undefined);
  assert.ok(noModel.notes?.includes('unreported'));
  assert.ok(!noModel.notes?.includes(CLASSIFIER_MODEL));
});

test('model: a max_tokens truncation is diagnosed as a budget problem, not bad output', async () => {
  // Karen LOW-1. Adaptive thinking shares max_tokens with the answer, so a long
  // thinking pass truncates the JSON. Without this the failure reads "Model
  // returned unparseable JSON" and sends the next reader to the prompt when the fix
  // is the budget. Both paths fail safe; only the diagnosis differs.
  process.env[CLASSIFIER_API_KEY_ENV] = 'test-key';
  const truncated = (async () =>
    new Response(
      JSON.stringify({
        model: CLASSIFIER_MODEL,
        stop_reason: 'max_tokens',
        content: [{ type: 'text', text: '{"root_causes":["QA Ga' }],
      }),
      { status: 200 },
    )) as unknown as typeof fetch;

  await assert.rejects(
    () =>
      requestClassification(
        buildClassifierPayload({ jira_summary: 's' }),
        VOCAB,
        truncated,
      ),
    (err: unknown) => {
      assert.ok(err instanceof ClassifierModelError);
      assert.match(err.message, /max_tokens/);
      assert.doesNotMatch(err.message, /unparseable/);
      return true;
    },
  );
});

test('confidence: the raw model number is never persisted anywhere', () => {
  const src = readOrFail('app/api/admin/logs/classify/route.ts');
  // The float reaches deriveConfidenceBand and dies there. If it were being
  // stored, ai_confidence_score would have to appear — and NN1 already pins that
  // it does not. This asserts the positive: the band is what gets written.
  assert.ok(/deriveConfidenceBand\(raw\.confidence\)/.test(src));
  assert.ok(/ai_confidence_band/.test(readOrFail('lib/classifier/suggestion.ts')));
});

// ---------------------------------------------------------------------------
// §6 outcome shapes — set overlap, not string equality
// ---------------------------------------------------------------------------

test('outcome: exact / partial / miss / rejected', () => {
  assert.equal(classifyReviewOutcome(['A'], ['A']), 'exact');
  assert.equal(classifyReviewOutcome(['A', 'B'], ['A', 'B']), 'exact');
  assert.equal(classifyReviewOutcome(['A', 'B'], ['A']), 'partial');
  assert.equal(classifyReviewOutcome(['A'], ['A', 'B']), 'partial');
  assert.equal(classifyReviewOutcome(['A'], ['B']), 'miss');
  assert.equal(classifyReviewOutcome(['A'], []), 'rejected');
});

test('outcome: set equality is order-insensitive', () => {
  // root_cause_final is an array in storage but a set in meaning.
  assert.equal(classifyReviewOutcome(['A', 'B'], ['B', 'A']), 'exact');
  assert.equal(classifyReviewOutcome(['A', 'B', 'C'], ['C', 'B', 'A']), 'exact');
});

test('outcome: rejected is checked BEFORE miss', () => {
  // An empty confirmed set also has an empty intersection, so testing miss first
  // would swallow every rejection — and the two mean different things. A rejection
  // says "no root cause applies"; a miss says "wrong about which".
  assert.equal(classifyReviewOutcome([], []), 'rejected');
  assert.equal(classifyReviewOutcome(['A', 'B', 'C'], []), 'rejected');
});

test('outcome: multi-value round-trips as an array, never a comma string', () => {
  // §10 item 7. The audit trail contains one legacy bare-comma write; do not
  // reproduce that shape. Prod 2026-08-10: 13 non-deleted rows are multi-value,
  // two carry three values.
  const row = buildReviewOutcomeAuditRow('log-1', 'exact', ['A', 'B', 'C'], 'x@y.com');
  assert.equal(row.old_value, '["A","B","C"]');
  assert.ok(!/A, B/.test(String(row.old_value)), 'must not be a comma-joined string');
  assert.deepEqual(JSON.parse(String(row.old_value)), ['A', 'B', 'C']);
});

// ---------------------------------------------------------------------------
// audit_log row shapes (§13.5) — asserted by SHAPE, not by existence
// ---------------------------------------------------------------------------

test('audit: the suggestion row satisfies both CHECK constraints', () => {
  // action CHECK (migration 001) allows CREATE/UPDATE/DELETE/STATUS_CHANGE/
  // AI_SUGGESTION. audit_log_target_shape_chk (as last redefined in migration 025)
  // needs target_type='quality_log' AND a non-null log_entry_id.
  const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'AI_SUGGESTION'];
  const row = buildSuggestionAuditRow('log-1', ['Process Gap'], 'high', 'lacey@fusion92.com');
  assert.ok(ACTIONS.includes(row.action), `${row.action} is not in the action CHECK`);
  assert.equal(row.action, 'AI_SUGGESTION');
  assert.equal(row.target_type, 'quality_log');
  assert.equal(row.log_entry_id, 'log-1');
  assert.equal(row.target_id, 'log-1');
  assert.equal(row.changed_by, CLASSIFIER_CHANGED_BY);
  assert.equal(row.field_name, 'ai_suggested_root_cause');
  assert.equal(row.new_value, '["Process Gap"]');
  assert.equal(row.old_value, null);
});

test('audit: the suggestion row records the band AND who triggered the batch', () => {
  // r20's system identity loses "who ran it" — the trigger attribution goes in
  // notes so that stays answerable.
  const row = buildSuggestionAuditRow('log-1', ['QA Gap'], 'medium', 'lacey@fusion92.com');
  assert.match(String(row.notes), /Confidence band: medium/);
  assert.match(String(row.notes), /lacey@fusion92\.com/);
});

test('audit: changed_by follows r20 and matches its three siblings', () => {
  assert.equal(CLASSIFIER_CHANGED_BY, 'system:root-cause-classifier');
  assert.ok(CLASSIFIER_CHANGED_BY.startsWith('system:'));
  // Not the bare 'system' the sync and webhook use — 149 prod rows carry that,
  // and a provenance filter on 'system:%' misses every one of them.
  assert.notEqual(CLASSIFIER_CHANGED_BY, 'system');
});

test('audit: the outcome row is GROUP BY-able — a bare literal, not prose', () => {
  // §2 makes the correction rate the batch's only validation, and prose in notes
  // cannot be aggregated.
  for (const outcome of ['exact', 'partial', 'miss', 'rejected'] as const) {
    const row = buildReviewOutcomeAuditRow('log-1', outcome, null, 'x@y.com');
    assert.equal(row.new_value, outcome, 'new_value must be the bare literal');
    assert.equal(row.field_name, 'ai_review_outcome');
    assert.equal(row.notes, null, 'the outcome must not be buried in notes');
  }
});

test('audit: the outcome row carries the PRE-EXISTING value in old_value', () => {
  // r37's ten-week-invisibility lesson: the trail has to show what was there
  // before, or a later reader sees a write with nothing behind it.
  const row = buildReviewOutcomeAuditRow('log-1', 'exact', ['CRO Code Error'], 'x@y.com');
  assert.equal(row.old_value, '["CRO Code Error"]');
  const none = buildReviewOutcomeAuditRow('log-1', 'exact', null, 'x@y.com');
  assert.equal(none.old_value, null);
});

// ---------------------------------------------------------------------------
// Model call: inert without a key; parse failures are clean
// ---------------------------------------------------------------------------

test('model: the model id is a single named constant', () => {
  assert.equal(CLASSIFIER_MODEL, 'claude-opus-5');
  const src = readOrFail('lib/classifier/model.ts');
  // Exactly one occurrence of the literal — the constant's own definition.
  assert.equal((src.match(/'claude-opus-5'/g) ?? []).length, 1);
});

test('model: the route returns not_configured when the key is absent', () => {
  // §13.7. The only item testable before a key exists, and the one that proves
  // the route is deployable-and-inert rather than broken.
  // COMMENTS ARE STRIPPED FIRST. This test needed two separate fixes and both
  // are worth recording, because each let a mutation through:
  //   1. A bare `guardAt < dbAt` passes when the guard is DELETED — indexOf
  //      returns -1 and -1 is less than anything. Presence must be asserted
  //      before ordering.
  //   2. Even then it passed, because the route's own header comment contains
  //      the string "not_configured" and sits above the taxonomy read. Any
  //      source-grep assertion that reasons about POSITION has to strip prose
  //      first, or it measures the documentation rather than the code.
  const src = readOrFail('app/api/admin/logs/classify/route.ts');
  const code = src
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n');

  const guardAt = code.indexOf('not_configured');
  const dbAt = code.indexOf('quality_log_taxonomy');
  assert.notEqual(guardAt, -1, 'the not_configured guard must exist in code, not just in a comment');
  assert.notEqual(dbAt, -1, 'the taxonomy read must exist (else the ordering is vacuous)');
  assert.ok(
    guardAt < dbAt,
    'the key check must precede any database work so an unconfigured deploy is unambiguous',
  );
});

test('model: env is read inside the function, never at module scope', () => {
  // lib/jira/client.ts throws at import for exactly this reason; a module-scope
  // read would break `next build`, which evaluates route modules to collect page
  // data.
  const src = readOrFail('lib/classifier/model.ts');
  const beforeFirstFn = src.slice(0, src.indexOf('export async function'));
  assert.ok(
    !/process\.env\[/.test(beforeFirstFn),
    'no process.env read may happen at module scope',
  );
});

test('model: parseModelText fails cleanly on malformed output', () => {
  assert.throws(() => parseModelText('not json'), ClassifierModelError);
  assert.throws(() => parseModelText('[]'), ClassifierModelError);
  assert.throws(() => parseModelText('null'), ClassifierModelError);
  assert.throws(() => parseModelText('{"confidence":0.9}'), ClassifierModelError);
  // A bare string where an array belongs is a SHAPE failure, not an OOV value —
  // conflating them would record a malformed response as a model accuracy problem.
  assert.throws(() => parseModelText('{"root_causes":"QA Gap"}'), ClassifierModelError);
});

test('model: parseModelText passes the raw values through unvalidated', () => {
  // The parse must not silently filter — vocabulary checking is a separate step so
  // the drop can be logged (§7).
  const out = parseModelText('{"root_causes":["QA Gap","Invented"],"confidence":0.7}');
  assert.deepEqual(out.root_causes, ['QA Gap', 'Invented']);
  assert.equal(out.confidence, 0.7);
});

// ---------------------------------------------------------------------------
// §13.1 — Confirm cannot silently destroy an existing root_cause_final
// ---------------------------------------------------------------------------

test('CRITICAL-1: selection excludes rows that already have a root_cause_final', () => {
  const src = readOrFail('app/api/admin/logs/classify/route.ts');
  assert.ok(
    /root_cause_final\.is\.null,root_cause_final\.eq\.\{\}/.test(src),
    'the candidate query must exclude non-empty root_cause_final',
  );
  assert.ok(
    /\.is\('ai_suggested_root_cause',\s*null\)/.test(src),
    'the candidate query must exclude rows that already carry a suggestion (idempotency)',
  );
  assert.ok(
    /\.eq\('ai_review_pending',\s*false\)/.test(src),
    'the candidate query must exclude rows with a review already pending',
  );
  assert.ok(/limit\(BATCH_CAP\)/.test(src), 'the batch must be capped');
});

test('CRITICAL-1: the review route re-checks at write time and refuses', () => {
  // Selection is a snapshot. r37 records that a NON-EMPTY Jira value still wins on
  // sync, so a row can acquire a classification between classify and confirm.
  const src = readOrFail('app/api/admin/logs/ai-review/route.ts');
  assert.ok(/root_cause_final is already set/.test(src), 'must refuse, not overwrite');
  assert.ok(/status:\s*409/.test(src), 'the refusal must be a conflict, not a silent skip');
  assert.ok(
    /action !== 'reject' && !isEmptyArray\(previousRootCauseFinal\)/.test(src),
    'the re-check must gate confirm and correct, but not reject',
  );
});

test('CRITICAL-1: reject leaves root_cause_final untouched — not even a key', () => {
  const src = readOrFail('app/api/admin/logs/ai-review/route.ts');
  // Slice the reject block ONLY — up to the `else`, not through it, since the
  // else branch is where the confirm/correct write legitimately lives.
  const start = src.indexOf("if (action === 'reject')");
  const end = src.indexOf('} else {', start);
  assert.ok(start > 0 && end > start, 'could not locate the reject branch');
  const rejectBranch = src.slice(start, end);
  assert.ok(
    !/root_cause_final/.test(rejectBranch),
    'the reject branch must not mention root_cause_final at all',
  );
  // And the canonical write must be in the else, so the two paths cannot merge.
  assert.ok(
    /update\.root_cause_final = confirmedValues;/.test(src.slice(end)),
    'the canonical write must live only on the non-reject path',
  );
});

test('r29: findInvalidTaxonomyValues flags retired and invented values', () => {
  // Behaviour, not a source-grep. The previous version of this test asserted only
  // that the route's SOURCE contained the taxonomy table name and the error
  // string — so a mutation wrapping the whole block in `if (false)` kept both
  // strings present and passed. The logic now lives in a pure function and is
  // tested directly.
  assert.deepEqual(findInvalidTaxonomyValues(['QA Gap'], VOCAB), []);
  assert.deepEqual(findInvalidTaxonomyValues([], VOCAB), [], 'empty input needs no guard');
  assert.deepEqual(findInvalidTaxonomyValues(['Invented'], VOCAB), ['Invented']);
  // The case r29 exists for: a value that WAS canonical when suggested and has
  // since been retired. is_active exists precisely so values can be retired, and
  // the confirm may happen days after the suggestion.
  const afterRetirement = VOCAB.filter((v) => v !== 'QA Gap');
  assert.deepEqual(findInvalidTaxonomyValues(['QA Gap'], afterRetirement), ['QA Gap']);
  assert.deepEqual(
    findInvalidTaxonomyValues(['Process Gap', 'QA Gap'], afterRetirement),
    ['QA Gap'],
    'only the retired value is flagged',
  );
});

test('r29: the review route wires the validator in unconditionally', () => {
  // HONEST LIMIT, stated rather than implied: a source assertion proves the call
  // is present, not that it still executes. `if (false) { ... }` around it would
  // evade this check — which is why the LOGIC is unit-tested above and why the
  // route deliberately carries no length guard, leaving no condition to flip.
  // No source-level test can close this fully.
  const src = readOrFail('app/api/admin/logs/ai-review/route.ts');
  assert.ok(/findInvalidTaxonomyValues\(/.test(src), 'the review route must call the validator');
  assert.ok(/not in the active root_cause taxonomy/.test(src), 'and reject invalid values');

  // Comments are stripped before the negative check. The first version of this
  // assertion matched the route's own comment *explaining* that the wrapper is
  // absent — a source-grep test reading prose about the thing it forbids. Any
  // negative source assertion needs this; the positive ones above do not.
  const code = src
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n');
  assert.ok(
    !/if \(confirmedValues\.length > 0\)/.test(code),
    'the validation must not be re-wrapped in a length guard',
  );
});

test('§13.11: no bulk or select-all confirm exists', () => {
  // Bulk confirm is auto-confirm with a human's finger resting on it, and
  // auto-confirm is §9's named failure mode.
  const src = readOrFail('app/api/admin/logs/ai-review/route.ts');
  assert.ok(/log_id is required/.test(src), 'the review route must act on ONE log at a time');
  assert.ok(!/log_ids/.test(src), 'no plural log_ids parameter may exist');
});
