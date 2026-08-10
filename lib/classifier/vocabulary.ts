// Vocabulary constraint + out-of-vocabulary handling for the AI root-cause
// classifier.
//
// Spec: docs/HANDOFF-root-cause-classifier.md §7, as revised by §13.3.
//
// THERE IS NO HARDCODED LIST AND NO HARDCODED COUNT HERE, DELIBERATELY.
// §7 said "13 values per root-cause-taxonomy-mapping.md §Field 2". That document
// says FOURTEEN (:133), migration 020 seeds fourteen and asserts root_cause=14,
// and production has fourteen active. Building to thirteen would drop one
// legitimate canonical value as out-of-vocabulary, with no principled way to
// choose which one — so §13.3 deleted the number rather than correcting it.
// Writing "14" here would just re-arm the same drift for whenever Lacey adds a
// fifteenth option.
//
// The vocabulary is read at request time from quality_log_taxonomy. That also
// satisfies §13 r29 ("constrained at every write surface") by construction and
// keeps this aligned with the edit route's validator, which does the same lookup.
//
// ⚠ THE FIELD NAME IS 'root_cause', NOT 'root_cause_final'. One Jira field
// (customfield_12905) backs both root_cause_initial and root_cause_final, so the
// taxonomy stores the singular. Querying the column name instead returns an
// EMPTY vocabulary and a 100% OOV drop rate — which looks like a model failure
// rather than a bug, and is why it is called out here and not left to inference.
export const ROOT_CAUSE_TAXONOMY_FIELD = 'root_cause' as const;

export interface VocabularyCheck {
  /** Values present in the active taxonomy, in the order the model returned them. */
  accepted: string[];
  /** Values the model invented. Dropped, never stored — logged by the caller. */
  dropped: string[];
}

// Match canonical values EXACTLY — character for character, per §7 and §13 r28's
// literal-string reasoning. The live taxonomy carries deliberate spacing quirks
// ("Unknown/ Needs Investigation", "Late Assets/ Info",
// "Unclear/ Conflicting Requirements"): no space before the slash, one after. A
// tolerant matcher that normalised whitespace or case would "helpfully" accept a
// near-miss and write a value that is not in the taxonomy, which is precisely the
// drift Batch 005.28 existed to end — 18+ near-duplicate variants that silently
// split charts and broke the Repeat Root Cause alert's exact-string match.
//
// So: no trimming, no case-folding, no fuzzy matching. A near-miss is a drop.
// §7 is explicit that the vocabulary is never widened to accommodate model
// output, and quietly widening the MATCHER is the same thing by another route.
// The r29 re-validation used by the review route before anything lands in
// root_cause_final. Extracted as a pure function rather than left inline in the
// route because a source-grep test cannot prove inline logic still runs — a
// mutation that wrapped the block in `if (false)` passed the whole suite. With
// the logic here it is directly unit-testable.
//
// Returns the values that are NOT in the active taxonomy. An empty input returns
// an empty array, so the caller needs no length guard — one fewer condition that
// could be flipped.
export function findInvalidTaxonomyValues(
  values: readonly string[],
  activeVocabulary: readonly string[],
): string[] {
  const allowed = new Set(activeVocabulary);
  return values.filter((v) => !allowed.has(v));
}

export function checkVocabulary(
  suggested: readonly unknown[],
  activeVocabulary: readonly string[],
): VocabularyCheck {
  const allowed = new Set(activeVocabulary);
  const accepted: string[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();

  for (const raw of suggested) {
    if (typeof raw !== 'string') {
      // A non-string element is not a canonical value and cannot become one.
      dropped.push(String(raw));
      continue;
    }
    if (!allowed.has(raw)) {
      dropped.push(raw);
      continue;
    }
    // De-duplicate: root_cause_final is a set in meaning even though Postgres
    // stores an array, and a model can repeat itself. Duplicates are collapsed
    // rather than dropped — they are not OOV, so counting them as drops would
    // overstate the model's error rate, which §2 makes the validation signal.
    if (seen.has(raw)) continue;
    seen.add(raw);
    accepted.push(raw);
  }

  return { accepted, dropped };
}
