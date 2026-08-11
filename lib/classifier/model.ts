// Model call for the AI root-cause classifier.
//
// Spec: docs/HANDOFF-root-cause-classifier.md §11.1 (Worker route — LOCKED),
// as completed by §13.7 (which model, which transport, which secret).
//
// TRANSPORT: plain fetch, NO SDK. Every external call in this repo already works
// that way (lib/sharepoint/graph-client.ts, lib/jira/search.ts); adding an SDK
// changes the Worker bundle and the OpenNext build for one endpoint. "Add the
// SDK" is the default assumption and it is the wrong one here.
//
// ENV IS READ INSIDE THE FUNCTION, never at module scope. lib/jira/client.ts
// throws at import for exactly this reason and CLAUDE.md §3 warns about it;
// lib/jira/search.ts is the pattern being copied. A module-scope read would break
// `next build`, which collects page data by evaluating route modules.

import type { ClassifierPayload } from './payload';

// A single named constant, never a literal at the call site (§13.7). A classifier
// whose model changes silently makes the correction rate a moving target — which
// is the §15 shared-ancestor failure applied to validation rather than to code.
export const CLASSIFIER_MODEL = 'claude-opus-5';

// Worker-only rotation surface (§13.7, r27). Rotating this cannot break Jira
// sync, SharePoint drafting, or config reads — one surface, unlike the SharePoint
// token's four.
export const CLASSIFIER_API_KEY_ENV = 'CQIP_ANTHROPIC_API_KEY';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export class ClassifierNotConfiguredError extends Error {
  constructor() {
    super(`${CLASSIFIER_API_KEY_ENV} is not set`);
    this.name = 'ClassifierNotConfiguredError';
  }
}

export class ClassifierModelError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ClassifierModelError';
  }
}

export interface RawSuggestion {
  /** Straight from the model — NOT yet vocabulary-checked. */
  root_causes: unknown;
  /** Straight from the model — never persisted; see confidence.ts. */
  confidence: unknown;
  /**
   * The model that actually SERVED the response, from the API's own `model`
   * field — not `CLASSIFIER_MODEL`, which is only what we asked for.
   *
   * Karen MEDIUM-3. `fallbacks: 'default'` routes a safety refusal to a
   * different model server-side and returns its answer as a normal 200, so the
   * pinned constant stops describing what answered. §2 makes the correction rate
   * the batch's ENTIRE validation mechanism, and an aggregate that silently
   * mixes two models cannot be separated after the fact. Recorded in the audit
   * `notes` so it is recoverable per row.
   *
   * Undefined only when `parseModelText` is called directly (its own tests do).
   */
  served_model?: string;
}

const SYSTEM_PROMPT = [
  'You classify the root cause of a CRO experiment rework event for a quality-tracking system.',
  '',
  'You will receive a JSON object describing one rework event: the Jira ticket summary, any',
  'human-written prose about it, the workflow transition that triggered it, the client brand,',
  'and the test type. Some fields may be null.',
  '',
  'Choose the root cause values that the evidence actually supports, from the allowed list only.',
  'Most events have exactly one root cause; some genuinely have more than one. Do not pad the',
  'list to look thorough, and do not guess to avoid returning a single value.',
  '',
  'If the evidence does not identify a cause, return the value that says so rather than picking',
  'the most likely-sounding option — an honest "not yet determined" is more useful to a human',
  'reviewer than a plausible wrong answer, because a human confirms or corrects every suggestion',
  'you make and their correction rate is how this classifier is measured.',
  '',
  'Report your confidence as a number from 0 to 1: how likely it is that a careful human reading',
  'the same evidence would choose the same values.',
].join('\n');

// Ask the model for one row's classification.
//
// The allowed vocabulary is passed in (read from quality_log_taxonomy by the
// caller, per §13.3) and used two ways: as an `enum` in the structured-output
// schema, which constrains generation, and in the system prompt for context.
//
// THE VOCABULARY CHECK IN vocabulary.ts IS STILL REQUIRED and is not dead code
// behind this enum, for three reasons: a refusal or a max_tokens stop yields
// non-conforming output; the checker also de-duplicates repeats, which the enum
// does not; and if structured outputs are ever unavailable the checker is the only
// guard left. §7's "dropped and logged, never stored" is a property of the
// pipeline, not of one request parameter.
export async function requestClassification(
  payload: ClassifierPayload,
  activeVocabulary: readonly string[],
  fetchFn: typeof fetch = fetch,
): Promise<RawSuggestion> {
  const apiKey = process.env[CLASSIFIER_API_KEY_ENV];
  if (!apiKey) throw new ClassifierNotConfiguredError();

  if (activeVocabulary.length === 0) {
    // Refuse rather than send an empty enum. An empty vocabulary means the
    // taxonomy read failed or queried the wrong field_name — see vocabulary.ts's
    // warning about 'root_cause' vs 'root_cause_final'. Sending it anyway would
    // produce a 100% OOV drop rate that reads as a model failure.
    throw new ClassifierModelError('Active root_cause vocabulary is empty — refusing to classify');
  }

  const response = await fetchFn(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Server-side fallback: Claude Opus 5's safety classifiers can decline a
      // request (HTTP 200 with stop_reason 'refusal'), and "default" routes by
      // refusal category rather than pinning a model we would then owe a
      // migration for.
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLASSIFIER_MODEL,
      max_tokens: 16000,
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: {
        // Classification over short prose — not a task that needs the ceiling.
        effort: 'medium',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              root_causes: {
                type: 'array',
                items: { type: 'string', enum: [...activeVocabulary] },
              },
              confidence: { type: 'number' },
            },
            required: ['root_causes', 'confidence'],
            additionalProperties: false,
          },
        },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ClassifierModelError(
      `Model request failed: ${response.status} ${detail.slice(0, 300)}`,
      response.status,
    );
  }

  const body = await response.json();

  // Check stop_reason BEFORE reading content. A refusal returns HTTP 200 with an
  // empty or partial content array, so indexing content[0] unconditionally
  // breaks — and a mid-stream refusal would hand back a truncated answer that
  // looks complete.
  if (body?.stop_reason === 'refusal') {
    throw new ClassifierModelError(
      `Model declined the request (category: ${body?.stop_details?.category ?? 'unknown'})`,
    );
  }

  // Karen LOW-1. Adaptive thinking and the answer share this max_tokens budget, so
  // a long thinking pass can truncate the JSON mid-string. Without this check the
  // truncation surfaces from parseModelText as "Model returned unparseable JSON" —
  // which reads as a MODEL problem and sends the next reader looking at the prompt,
  // when the actual fix is the token budget. Same failure either way (the row is
  // counted failed and nothing is written); only the diagnosis differs, and a
  // misleading diagnosis is what costs the time.
  if (body?.stop_reason === 'max_tokens') {
    throw new ClassifierModelError(
      'Model response hit the max_tokens budget and was truncated — raise max_tokens or lower thinking effort, this is not a model-output problem',
    );
  }

  const text = (body?.content ?? [])
    .filter((b: { type?: string }) => b?.type === 'text')
    .map((b: { text?: string }) => b.text ?? '')
    .join('');

  // `body.model` is what ANSWERED, which is not necessarily CLASSIFIER_MODEL —
  // see RawSuggestion.served_model.
  return {
    ...parseModelText(text),
    ...(typeof body?.model === 'string' ? { served_model: body.model } : {}),
  };
}

// Pure, exported, and separately tested: the parse is where malformed model
// output turns into either a usable suggestion or a clean failure, and it must
// never throw something the per-row catch cannot describe.
export function parseModelText(text: string): RawSuggestion {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ClassifierModelError('Model returned unparseable JSON');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new ClassifierModelError('Model returned a non-object');
  }
  const obj = parsed as Record<string, unknown>;
  // root_causes must be an array. Anything else — a bare string, null, a number —
  // is a shape failure rather than an out-of-vocabulary value, and conflating the
  // two would let a malformed response be recorded as a model accuracy problem.
  if (!Array.isArray(obj.root_causes)) {
    throw new ClassifierModelError('Model response is missing a root_causes array');
  }
  return { root_causes: obj.root_causes, confidence: obj.confidence };
}
