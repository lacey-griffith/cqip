// Batch "single-brand onboarding" §2.1 — the brand-config validation rules, as a
// pure function so the route and its tests share one implementation.
//
// Spec: docs/specs/batch-single-brand-onboarding.md. Cite by section number.
//
// WHY THESE RULES DUPLICATE A DB CONSTRAINT ON PURPOSE. Migration 019:90-93
// already CHECKs (multi_brand → brand_jira_field_id NOT NULL) OR (single_brand →
// default_brand_id NOT NULL). But 019:36-39 gives brand_jira_field_id the column
// default 'customfield_12220', so the constraint is satisfied by accident on
// every insert that omits the column — which is exactly how HDCRO ended up
// silently misconfigured (§0.1). The constraint cannot tell "configured" from
// "defaulted"; these rules can, because they run on what the user submitted.
//
// The constraint also cannot express the two rules that matter most in practice:
// that a single-brand project's default brand must BELONG to that project (§2.1),
// and that brand_jira_field_id must be nulled when switching to single-brand.
// A cross-table predicate is not expressible in a CHECK.
//
// Karen is directed at whether these rules and the DB constraint can disagree
// (spec §4). They can only disagree in the safe direction: everything these
// rules accept also satisfies the constraint. The reverse is not true, and is
// the point.

export type BrandModel = 'multi_brand' | 'single_brand';

export interface BrandConfigInput {
  brand_model: BrandModel;
  brand_jira_field_id: string | null;
  default_brand_id: string | null;
}

/**
 * Facts the caller resolves before validating. `defaultBrandProjectKey` is the
 * `brands.project_key` of the row `default_brand_id` points at, or null when the
 * id is absent OR resolves to nothing — those two are told apart by
 * `default_brand_id` itself.
 */
export interface BrandConfigContext {
  projectKey: string;
  defaultBrandProjectKey: string | null;
}

export interface ValidationFailure {
  ok: false;
  /** The column the user needs to change. Lets the form focus the right input. */
  field: keyof BrandConfigInput;
  /** A sentence for a human. Never a constraint-violation string. */
  error: string;
}

export interface ValidationSuccess {
  ok: true;
  /**
   * Normalized values to write. NOT the input echoed back: single-brand forces
   * brand_jira_field_id to null, and empty strings become null.
   */
  value: BrandConfigInput;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export function isBrandModel(value: unknown): value is BrandModel {
  return value === 'multi_brand' || value === 'single_brand';
}

function trimToNull(value: string | null): string | null {
  if (value === null) return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

export function validateBrandConfig(
  input: BrandConfigInput,
  ctx: BrandConfigContext,
): ValidationResult {
  const fieldId = trimToNull(input.brand_jira_field_id);
  const defaultBrandId = trimToNull(input.default_brand_id);

  if (input.brand_model === 'single_brand') {
    if (!defaultBrandId) {
      return {
        ok: false,
        field: 'default_brand_id',
        error:
          'A single-brand project needs a default brand. Add a brand for this project first, then select it here.',
      };
    }
    if (ctx.defaultBrandProjectKey === null) {
      return {
        ok: false,
        field: 'default_brand_id',
        error: 'That brand no longer exists. Pick another.',
      };
    }
    if (ctx.defaultBrandProjectKey !== ctx.projectKey) {
      return {
        ok: false,
        field: 'default_brand_id',
        error: `That brand belongs to ${ctx.defaultBrandProjectKey}. The default brand must belong to ${ctx.projectKey}, or its tickets would be attributed to another client.`,
      };
    }
    // Forced, not merely allowed to be null: the single-brand resolution path
    // skips field extraction entirely (jira-sync/index.ts:417-425), so a
    // leftover field id is dead config that would mislead the next reader.
    return {
      ok: true,
      value: {
        brand_model: 'single_brand',
        brand_jira_field_id: null,
        default_brand_id: defaultBrandId,
      },
    };
  }

  if (!fieldId) {
    return {
      ok: false,
      field: 'brand_jira_field_id',
      error:
        'A multi-brand project needs the Jira field its brand is read from. Neighborly uses customfield_12220.',
    };
  }

  // default_brand_id is OPTIONAL here, and permitted by 019:84-87 as the
  // documented final fallback for tickets whose brand field is empty. When it is
  // supplied it must still be this project's brand.
  if (defaultBrandId) {
    if (ctx.defaultBrandProjectKey === null) {
      return {
        ok: false,
        field: 'default_brand_id',
        error: 'That fallback brand no longer exists. Pick another or clear it.',
      };
    }
    if (ctx.defaultBrandProjectKey !== ctx.projectKey) {
      return {
        ok: false,
        field: 'default_brand_id',
        error: `That brand belongs to ${ctx.defaultBrandProjectKey}. The fallback brand must belong to ${ctx.projectKey}, or unmatched tickets would be attributed to another client.`,
      };
    }
  }

  return {
    ok: true,
    value: {
      brand_model: 'multi_brand',
      brand_jira_field_id: fieldId,
      default_brand_id: defaultBrandId,
    },
  };
}

/** The default a new multi-brand project is prefilled with in the form. */
export const DEFAULT_BRAND_FIELD_ID = 'customfield_12220';

/**
 * Jira project keys are uppercase alphanumeric. Enforced here because the key is
 * the join column for brands.project_key and quality_logs.project_key — a typo'd
 * key produces a project no ingestion will ever match, and there is no FK to
 * catch it.
 */
export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,29}$/;
