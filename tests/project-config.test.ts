import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  DEFAULT_BRAND_FIELD_ID,
  PROJECT_KEY_PATTERN,
  isBrandModel,
  validateBrandConfig,
  type BrandConfigContext,
  type BrandConfigInput,
} from '../lib/onboarding/project-config';

// Spec: docs/specs/batch-single-brand-onboarding.md §2.1, §3.2.
//
// These are the three §2.1 rules, plus the cases the DB CHECK at 019:90-93
// cannot express. Karen is directed at whether these rules and that constraint
// can disagree (§4), so the last test in this file asserts the one-directional
// relationship explicitly: everything accepted here also satisfies the
// constraint. The reverse is deliberately false — the constraint accepts
// defaulted-not-configured, which is the whole defect.

function ok(r: ReturnType<typeof validateBrandConfig>) {
  assert.equal(r.ok, true, r.ok ? '' : `expected ok, got: ${r.error}`);
  assert.ok(r.ok);
  return r.value;
}

function fail(r: ReturnType<typeof validateBrandConfig>) {
  assert.equal(r.ok, false, 'expected failure');
  assert.ok(!r.ok);
  assert.notEqual(r.error, '');
  return r;
}

const CTX: BrandConfigContext = { projectKey: 'SPLCRO', defaultBrandProjectKey: 'SPLCRO' };
const input = (over: Partial<BrandConfigInput> = {}): BrandConfigInput => ({
  brand_model: 'single_brand',
  brand_jira_field_id: null,
  default_brand_id: 'brand-uuid',
  ...over,
});

// -------------------------------------------------------------------------
// Rule 1 — multi_brand requires a field id, default brand optional
// -------------------------------------------------------------------------

test('multi-brand without a field id is rejected, naming the field', () => {
  const r = fail(
    validateBrandConfig(input({ brand_model: 'multi_brand', brand_jira_field_id: null, default_brand_id: null }), {
      projectKey: 'HDCRO',
      defaultBrandProjectKey: null,
    }),
  );
  assert.equal(r.field, 'brand_jira_field_id');
});

test('multi-brand with a field id and no default brand is accepted', () => {
  const v = ok(
    validateBrandConfig(
      input({ brand_model: 'multi_brand', brand_jira_field_id: DEFAULT_BRAND_FIELD_ID, default_brand_id: null }),
      { projectKey: 'NBLYCRO', defaultBrandProjectKey: null },
    ),
  );
  assert.equal(v.brand_jira_field_id, DEFAULT_BRAND_FIELD_ID);
  assert.equal(v.default_brand_id, null);
});

test('multi-brand may also carry a fallback brand — 019:84-87 permits it', () => {
  const v = ok(
    validateBrandConfig(
      input({ brand_model: 'multi_brand', brand_jira_field_id: DEFAULT_BRAND_FIELD_ID, default_brand_id: 'b-1' }),
      { projectKey: 'NBLYCRO', defaultBrandProjectKey: 'NBLYCRO' },
    ),
  );
  assert.equal(v.default_brand_id, 'b-1');
});

// -------------------------------------------------------------------------
// Rule 2 — single_brand requires a default brand that belongs to the project
// -------------------------------------------------------------------------

test('single-brand without a default brand is rejected', () => {
  const r = fail(validateBrandConfig(input({ default_brand_id: null }), { ...CTX, defaultBrandProjectKey: null }));
  assert.equal(r.field, 'default_brand_id');
});

test("single-brand with another project's brand is rejected, naming that project", () => {
  const r = fail(validateBrandConfig(input(), { projectKey: 'SPLCRO', defaultBrandProjectKey: 'NBLYCRO' }));
  assert.equal(r.field, 'default_brand_id');
  assert.match(r.error, /NBLYCRO/);
});

test('single-brand with a default brand id that resolves to nothing is rejected', () => {
  const r = fail(validateBrandConfig(input(), { projectKey: 'SPLCRO', defaultBrandProjectKey: null }));
  assert.equal(r.field, 'default_brand_id');
});

test("multi-brand with another project's fallback brand is rejected too", () => {
  const r = fail(
    validateBrandConfig(
      input({ brand_model: 'multi_brand', brand_jira_field_id: DEFAULT_BRAND_FIELD_ID, default_brand_id: 'b-1' }),
      { projectKey: 'SPLCRO', defaultBrandProjectKey: 'NBLYCRO' },
    ),
  );
  assert.equal(r.field, 'default_brand_id');
});

// -------------------------------------------------------------------------
// Rule 3 — single_brand forces the field id to null
// -------------------------------------------------------------------------

test('switching to single-brand nulls a leftover field id rather than keeping it', () => {
  const v = ok(validateBrandConfig(input({ brand_jira_field_id: DEFAULT_BRAND_FIELD_ID }), CTX));
  assert.equal(v.brand_jira_field_id, null);
  assert.equal(v.brand_model, 'single_brand');
});

// -------------------------------------------------------------------------
// Normalization
// -------------------------------------------------------------------------

test('whitespace-only strings normalize to null, not to a blank value', () => {
  const r = fail(
    validateBrandConfig(input({ brand_model: 'multi_brand', brand_jira_field_id: '   ', default_brand_id: null }), {
      projectKey: 'HDCRO',
      defaultBrandProjectKey: null,
    }),
  );
  assert.equal(r.field, 'brand_jira_field_id');
});

test('surrounding whitespace is trimmed off accepted values', () => {
  const v = ok(
    validateBrandConfig(
      input({ brand_model: 'multi_brand', brand_jira_field_id: '  customfield_12220  ', default_brand_id: null }),
      { projectKey: 'HDCRO', defaultBrandProjectKey: null },
    ),
  );
  assert.equal(v.brand_jira_field_id, 'customfield_12220');
});

test('isBrandModel rejects anything else, including near-misses', () => {
  assert.equal(isBrandModel('multi_brand'), true);
  assert.equal(isBrandModel('single_brand'), true);
  for (const bad of ['multibrand', 'MULTI_BRAND', '', null, undefined, 0, {}]) {
    assert.equal(isBrandModel(bad), false, String(bad));
  }
});

// -------------------------------------------------------------------------
// Project key shape
// -------------------------------------------------------------------------

test('project key pattern accepts the three live keys and rejects malformed ones', () => {
  for (const good of ['NBLYCRO', 'SPLCRO', 'HDCRO', 'AB']) {
    assert.equal(PROJECT_KEY_PATTERN.test(good), true, good);
  }
  for (const bad of ['nblycro', 'A', '1ABC', 'AB-CD', 'AB CD', 'AB_CD', '']) {
    assert.equal(PROJECT_KEY_PATTERN.test(bad), false, bad);
  }
});

// -------------------------------------------------------------------------
// The relationship to the DB constraint (§4, Karen's directed question)
// -------------------------------------------------------------------------

test('everything these rules accept also satisfies the 019:90-93 CHECK', () => {
  const candidates: Array<[BrandConfigInput, BrandConfigContext]> = [
    [input({ brand_model: 'multi_brand', brand_jira_field_id: 'customfield_12220', default_brand_id: null }), { projectKey: 'X', defaultBrandProjectKey: null }],
    [input({ brand_model: 'multi_brand', brand_jira_field_id: 'customfield_1', default_brand_id: 'b' }), { projectKey: 'X', defaultBrandProjectKey: 'X' }],
    [input({ brand_model: 'single_brand', brand_jira_field_id: null, default_brand_id: 'b' }), { projectKey: 'X', defaultBrandProjectKey: 'X' }],
    [input({ brand_model: 'single_brand', brand_jira_field_id: 'customfield_12220', default_brand_id: 'b' }), { projectKey: 'X', defaultBrandProjectKey: 'X' }],
  ];
  let accepted = 0;
  for (const [i, ctx] of candidates) {
    const r = validateBrandConfig(i, ctx);
    if (!r.ok) continue;
    accepted += 1;
    const satisfiesCheck =
      (r.value.brand_model === 'multi_brand' && r.value.brand_jira_field_id !== null) ||
      (r.value.brand_model === 'single_brand' && r.value.default_brand_id !== null);
    assert.equal(satisfiesCheck, true, `${r.value.brand_model} would violate the CHECK`);
  }
  // Guards against the assertion above passing because nothing was accepted.
  assert.equal(accepted, candidates.length);
});
