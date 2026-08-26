import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  BADGE_TEXT,
  CHECK_IDS,
  brandConfigChecks,
  brandConfigComplete,
  worstState,
  type Check,
  type ProjectBrandFacts,
} from '../lib/onboarding/checks';

// Spec: docs/specs/batch-single-brand-onboarding.md §3.
//
// WHAT THESE TESTS PROVE AND WHAT THEY DO NOT (spec §3.1). brandConfigChecks()
// does not exist on main, so none of this can be run red against main first. The
// thing broken on main is the SYSTEM — HDCRO is misconfigured in prod and
// nothing surfaces it — not an assertion. The guard against a function that
// cannot fail is structural: the three prod fixtures below are verbatim copies
// of real rows read from hupklpjruveleaahufmw on 2026-08-26, and two of them
// must come back clean. A function that degenerated to "always blocking" fails
// PROD_NBLYCRO and PROD_SPLCRO; one that degenerated to "always ok" fails
// PROD_HDCRO.
//
// `assert.ok(x)` does not narrow for tsc, and tests/ IS typechecked by
// next build. Same helper as tests/change-log.test.ts.
function present<T>(v: T | null | undefined, what: string): T {
  assert.ok(v !== null && v !== undefined, `expected ${what} to be present`);
  return v;
}

function only(checks: Check[], id: string): Check {
  const hit = checks.filter(c => c.id === id);
  assert.equal(hit.length, 1, `expected exactly one ${id}, got ${hit.length}`);
  return present(hit[0], id);
}

function ids(checks: Check[]): string[] {
  return checks.map(c => c.id).sort();
}

// -------------------------------------------------------------------------
// Prod fixtures. Read 2026-08-26 from projects + brands. Do not "tidy" these
// values — their whole job is to be what production actually contains.
// -------------------------------------------------------------------------

const PROD_HDCRO: ProjectBrandFacts = {
  jira_project_key: 'HDCRO',
  brand_model: 'multi_brand',
  brand_jira_field_id: 'customfield_12220',
  default_brand_id: null,
  activeBrandCount: 0,
  defaultBrandProjectKey: null,
};

const PROD_NBLYCRO: ProjectBrandFacts = {
  jira_project_key: 'NBLYCRO',
  brand_model: 'multi_brand',
  brand_jira_field_id: 'customfield_12220',
  default_brand_id: null,
  activeBrandCount: 16,
  defaultBrandProjectKey: null,
};

const PROD_SPLCRO: ProjectBrandFacts = {
  jira_project_key: 'SPLCRO',
  brand_model: 'single_brand',
  brand_jira_field_id: null,
  default_brand_id: '1dab302a-c02f-433d-87b5-d0f8ea53a2de',
  activeBrandCount: 1,
  defaultBrandProjectKey: 'SPLCRO',
};

const facts = (over: Partial<ProjectBrandFacts> = {}): ProjectBrandFacts => ({
  ...PROD_SPLCRO,
  ...over,
});

// -------------------------------------------------------------------------
// §3 required cases — the three prod rows
// -------------------------------------------------------------------------

test('prod HDCRO — multi-brand with zero brands and no fallback blocks', () => {
  const checks = brandConfigChecks(PROD_HDCRO);
  const hit = only(checks, CHECK_IDS.MULTI_BRAND_NO_TARGETS);
  assert.equal(hit.state, 'blocking');
  assert.equal(brandConfigComplete(PROD_HDCRO), false);
  // The detail must name the consequence, not just the misconfiguration — this
  // is the null-overwrite in spec §0.4 and it is the reason the finding blocks.
  assert.match(hit.detail, /null client_brand/);
  assert.notEqual(hit.fix, '');
});

test('prod NBLYCRO — multi-brand with 16 brands is clean', () => {
  const checks = brandConfigChecks(PROD_NBLYCRO);
  assert.deepEqual(ids(checks), [CHECK_IDS.OK]);
  assert.equal(brandConfigComplete(PROD_NBLYCRO), true);
  assert.equal(worstState(checks), 'ok');
});

test('prod SPLCRO — single-brand with its own default brand is clean', () => {
  const checks = brandConfigChecks(PROD_SPLCRO);
  assert.deepEqual(ids(checks), [CHECK_IDS.OK]);
  assert.equal(brandConfigComplete(PROD_SPLCRO), true);
});

test('single-brand with no default brand blocks', () => {
  const f = facts({ default_brand_id: null, defaultBrandProjectKey: null });
  const hit = only(brandConfigChecks(f), CHECK_IDS.SINGLE_BRAND_NO_DEFAULT);
  assert.equal(hit.state, 'blocking');
  assert.equal(brandConfigComplete(f), false);
});

// -------------------------------------------------------------------------
// The rest of the matrix
// -------------------------------------------------------------------------

test('multi-brand with no Jira brand field blocks', () => {
  const f = facts({
    brand_model: 'multi_brand',
    brand_jira_field_id: null,
    default_brand_id: null,
    activeBrandCount: 3,
    defaultBrandProjectKey: null,
  });
  const hit = only(brandConfigChecks(f), CHECK_IDS.MULTI_BRAND_NO_FIELD);
  assert.equal(hit.state, 'blocking');
});

test('multi-brand with zero brands but a fallback brand is not blocked', () => {
  const f = facts({
    jira_project_key: 'XCRO',
    brand_model: 'multi_brand',
    brand_jira_field_id: 'customfield_12220',
    default_brand_id: 'b-1',
    activeBrandCount: 0,
    defaultBrandProjectKey: 'XCRO',
  });
  assert.equal(brandConfigComplete(f), true);
});

test("a default brand belonging to another project blocks — single-brand", () => {
  const f = facts({ defaultBrandProjectKey: 'NBLYCRO' });
  const hit = only(brandConfigChecks(f), CHECK_IDS.DEFAULT_BRAND_FOREIGN);
  assert.equal(hit.state, 'blocking');
  assert.match(hit.detail, /NBLYCRO/);
});

test("a fallback brand belonging to another project blocks — multi-brand", () => {
  const f = facts({
    jira_project_key: 'XCRO',
    brand_model: 'multi_brand',
    brand_jira_field_id: 'customfield_12220',
    default_brand_id: 'b-1',
    activeBrandCount: 4,
    defaultBrandProjectKey: 'NBLYCRO',
  });
  const hit = only(brandConfigChecks(f), CHECK_IDS.DEFAULT_BRAND_FOREIGN);
  assert.equal(hit.state, 'blocking');
});

test('a default brand id that resolves to nothing blocks, in both models', () => {
  for (const model of ['single_brand', 'multi_brand'] as const) {
    const f = facts({
      brand_model: model,
      brand_jira_field_id: model === 'multi_brand' ? 'customfield_12220' : null,
      default_brand_id: 'deleted-uuid',
      activeBrandCount: model === 'multi_brand' ? 2 : 1,
      defaultBrandProjectKey: null,
    });
    const hit = only(brandConfigChecks(f), CHECK_IDS.DEFAULT_BRAND_UNRESOLVED);
    assert.equal(hit.state, 'blocking', model);
  }
});

test('single-brand with extra active brands warns but does not block', () => {
  const f = facts({ activeBrandCount: 5 });
  const checks = brandConfigChecks(f);
  const hit = only(checks, CHECK_IDS.SINGLE_BRAND_EXTRA_BRANDS);
  assert.equal(hit.state, 'warning');
  assert.match(hit.detail, /5 active brands/);
  assert.equal(brandConfigComplete(f), true);
  assert.equal(worstState(checks), 'warning');
});

test('a clean project returns exactly one ok check, never an empty array', () => {
  for (const f of [PROD_NBLYCRO, PROD_SPLCRO]) {
    const checks = brandConfigChecks(f);
    assert.equal(checks.length, 1);
    assert.equal(present(checks[0], 'ok check').state, 'ok');
    assert.equal(present(checks[0], 'ok check').fix, '');
  }
});

test('every non-ok finding carries a fix, and every ok finding does not', () => {
  const all: ProjectBrandFacts[] = [
    PROD_HDCRO,
    PROD_NBLYCRO,
    PROD_SPLCRO,
    facts({ default_brand_id: null, defaultBrandProjectKey: null }),
    facts({ defaultBrandProjectKey: 'NBLYCRO' }),
    facts({ activeBrandCount: 5 }),
    facts({ brand_model: 'multi_brand', brand_jira_field_id: null, default_brand_id: null, defaultBrandProjectKey: null, activeBrandCount: 2 }),
  ];
  for (const f of all) {
    for (const c of brandConfigChecks(f)) {
      if (c.state === 'ok') assert.equal(c.fix, '', c.id);
      else assert.notEqual(c.fix, '', c.id);
      assert.notEqual(c.detail, '', c.id);
    }
  }
});

test('badge text exists for all three states', () => {
  assert.deepEqual(Object.keys(BADGE_TEXT).sort(), ['blocking', 'ok', 'warning']);
  for (const v of Object.values(BADGE_TEXT)) assert.notEqual(v, '');
});
