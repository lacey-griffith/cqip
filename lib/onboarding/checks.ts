// Batch "single-brand onboarding" — the brand-config completeness check, as a
// pure function so tests/onboarding-checks.test.ts can pin it and so the same
// list drives the Settings → Projects badge, the project banner and CI.
//
// Spec: docs/specs/batch-single-brand-onboarding.md. Cite by section number.
//
// WHY THIS FILE EXISTS AT ALL (spec §0.4). jira-sync/index.ts:630 writes
// `client_brand` in the UNGUARDED column block — r37's sync guard does not cover
// it. resolveBrandForSync() returns clientBrandString: null when a multi_brand
// project's configured field matches no brand or alias and default_brand_id is
// NULL. That null is then written over whatever was there. So a misconfigured
// project is not a cosmetic problem; it is a data-destroying one, and the whole
// point of these findings is that misconfiguration stops being silent.
//
// The prior defect this guards against (spec §0.1): the misconfiguration is
// created SUCCESSFULLY. There is no constraint violation, no error, no signal.
// Nothing except this function will tell anyone.
//
// Shape note: `checks(facts) => Check[]` is deliberately the shape Batch 013 §2
// extends with Jira-credential, Teams and OneDrive facts. Same signature,
// additive — 013 does not rewrite this, it adds to it.

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export type CheckState = 'ok' | 'warning' | 'blocking';

export interface Check {
  /** Stable id, so the UI can key rows and tests can assert without matching prose. */
  id: string;
  state: CheckState;
  /** What is true right now. Never a recommendation. */
  detail: string;
  /** The action that clears it. Empty string when state is 'ok'. */
  fix: string;
}

/**
 * Everything the brand-config checks need, and nothing else. `activeBrandCount`
 * and `defaultBrandProjectKey` are joined by the caller — this module does no
 * I/O, which is what makes the prod-row fixtures in the test file honest.
 *
 * `defaultBrandProjectKey` is the `brands.project_key` of the row that
 * `default_brand_id` points at, or null when `default_brand_id` is null OR when
 * the id resolves to nothing. Those two cases are distinguished by
 * `default_brand_id` itself, not by this field.
 */
export interface ProjectBrandFacts {
  jira_project_key: string;
  brand_model: 'multi_brand' | 'single_brand';
  brand_jira_field_id: string | null;
  default_brand_id: string | null;
  activeBrandCount: number;
  defaultBrandProjectKey: string | null;
}

export const CHECK_IDS = {
  SINGLE_BRAND_NO_DEFAULT: 'single_brand.default_brand_missing',
  // Neutral ids: both models can reach these two.
  DEFAULT_BRAND_FOREIGN: 'brand_config.default_brand_foreign',
  DEFAULT_BRAND_UNRESOLVED: 'brand_config.default_brand_unresolved',
  SINGLE_BRAND_EXTRA_BRANDS: 'single_brand.extra_active_brands',
  MULTI_BRAND_NO_FIELD: 'multi_brand.brand_field_missing',
  MULTI_BRAND_NO_TARGETS: 'multi_brand.no_resolvable_brands',
  OK: 'brand_config.ok',
} as const;

// -------------------------------------------------------------------------
// The checks
// -------------------------------------------------------------------------

function singleBrandChecks(facts: ProjectBrandFacts): Check[] {
  const out: Check[] = [];
  const key = facts.jira_project_key;

  if (!facts.default_brand_id) {
    // The 019 CHECK constraint forbids this combination at the DB level, so it
    // should be unreachable. It is checked anyway: the constraint is one
    // migration away from being dropped, and a blocking finding costs nothing.
    out.push({
      id: CHECK_IDS.SINGLE_BRAND_NO_DEFAULT,
      state: 'blocking',
      detail: `${key} is single-brand but has no default brand set, so no ticket can resolve to a brand.`,
      fix: 'Add a brand for this project, then set it as the default brand.',
    });
  } else if (facts.defaultBrandProjectKey === null) {
    out.push({
      id: CHECK_IDS.DEFAULT_BRAND_UNRESOLVED,
      state: 'blocking',
      detail: `${key}'s default brand id does not resolve to a brand row.`,
      fix: 'Re-select the default brand for this project.',
    });
  } else if (facts.defaultBrandProjectKey !== key) {
    out.push({
      id: CHECK_IDS.DEFAULT_BRAND_FOREIGN,
      state: 'blocking',
      detail: `${key}'s default brand belongs to ${facts.defaultBrandProjectKey}, so its tickets would be attributed to another client.`,
      fix: `Set the default brand to one whose project is ${key}.`,
    });
  }

  if (facts.activeBrandCount > 1) {
    // Not blocking: resolution is still deterministic (single_brand skips field
    // extraction entirely and always uses default_brand_id). But it means
    // somebody modelled a multi-brand client as single-brand, and the extra
    // brands will never receive a ticket.
    out.push({
      id: CHECK_IDS.SINGLE_BRAND_EXTRA_BRANDS,
      state: 'warning',
      detail: `${key} is single-brand but has ${facts.activeBrandCount} active brands; every ticket resolves to the default and the others receive nothing.`,
      fix: 'Switch to multi-brand, or deactivate the brands that are not in use.',
    });
  }

  return out;
}

function multiBrandChecks(facts: ProjectBrandFacts): Check[] {
  const out: Check[] = [];
  const key = facts.jira_project_key;

  if (!facts.brand_jira_field_id) {
    out.push({
      id: CHECK_IDS.MULTI_BRAND_NO_FIELD,
      state: 'blocking',
      detail: `${key} is multi-brand but has no Jira brand field configured, so there is nothing to read a brand from.`,
      fix: 'Set the Jira brand field id (Neighborly uses customfield_12220).',
    });
  }

  // The HDCRO case, live in prod as of 2026-08-26. Nothing to match against and
  // no fallback, so resolveBrandForSync() returns null for every ticket and
  // jira-sync:630 writes that null into client_brand unconditionally.
  if (facts.activeBrandCount === 0 && !facts.default_brand_id) {
    out.push({
      id: CHECK_IDS.MULTI_BRAND_NO_TARGETS,
      state: 'blocking',
      detail: `${key} has no active brands and no default brand, so every synced ticket resolves to no brand and sync writes a null client_brand over any existing value.`,
      fix: 'Add at least one brand for this project, or set a default brand as the fallback.',
    });
  }

  if (facts.default_brand_id && facts.defaultBrandProjectKey === null) {
    out.push({
      id: CHECK_IDS.DEFAULT_BRAND_UNRESOLVED,
      state: 'blocking',
      detail: `${key}'s default brand id does not resolve to a brand row.`,
      fix: 'Re-select the default brand for this project, or clear it.',
    });
  } else if (facts.default_brand_id && facts.defaultBrandProjectKey !== key) {
    out.push({
      id: CHECK_IDS.DEFAULT_BRAND_FOREIGN,
      state: 'blocking',
      detail: `${key}'s fallback brand belongs to ${facts.defaultBrandProjectKey}, so unmatched tickets would be attributed to another client.`,
      fix: `Set the fallback brand to one whose project is ${key}, or clear it.`,
    });
  }

  return out;
}

/**
 * All brand-config findings for one project. Returns exactly one 'ok' Check when
 * nothing is wrong, so callers never have to distinguish "checked and clean"
 * from "not checked" by an empty array.
 */
export function brandConfigChecks(facts: ProjectBrandFacts): Check[] {
  const found =
    facts.brand_model === 'single_brand'
      ? singleBrandChecks(facts)
      : multiBrandChecks(facts);

  if (found.length === 0) {
    return [
      {
        id: CHECK_IDS.OK,
        state: 'ok',
        detail: `${facts.jira_project_key} brand configuration is complete.`,
        fix: '',
      },
    ];
  }
  return found;
}

/** True when no finding blocks. Warnings do not block. Drives the row badge. */
export function brandConfigComplete(facts: ProjectBrandFacts): boolean {
  return !brandConfigChecks(facts).some(c => c.state === 'blocking');
}

/** Worst state present, for a single badge per row. */
export function worstState(checks: Check[]): CheckState {
  if (checks.some(c => c.state === 'blocking')) return 'blocking';
  if (checks.some(c => c.state === 'warning')) return 'warning';
  return 'ok';
}

export const BADGE_TEXT: Record<CheckState, string> = {
  ok: 'Configured',
  warning: 'Check config',
  blocking: 'Brand config incomplete',
};
