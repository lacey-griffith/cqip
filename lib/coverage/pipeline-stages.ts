// Single source of truth for the Coverage pipeline stage → Jira-status map
// and the overlay-tag definitions (Batch 010). The prose companion is
// docs/batch-010-pipeline-stage-map.md — keep the two in sync (§13 rule 23).
//
// The data layer (app/api/coverage/pipeline/route.ts) imports these consts;
// status strings are defined here ONCE and never scattered across the route
// or the page.

export type PipelineStage = 'strategy' | 'design' | 'dev' | 'queued' | 'live';

// Render order for the pipeline table columns.
export const PIPELINE_STAGES: readonly PipelineStage[] = [
  'strategy',
  'design',
  'dev',
  'queued',
  'live',
] as const;

// Human labels for the stage columns.
export const STAGE_LABELS: Record<PipelineStage, string> = {
  strategy: 'Strategy',
  design: 'Design',
  dev: 'Dev',
  queued: 'Queued',
  live: 'Live',
};

// Stage → the Jira statuses that roll up into it. `Active Development` is
// kept alongside `Active Dev` so the map is portable across projects that
// name the status either way (NBLYCRO/SPLCRO use `Active Dev` today).
//
// Done + Reporting are deliberately absent — they are NOT counted in any
// column (see EXCLUDED_STATUSES).
export const STAGE_STATUSES: Record<PipelineStage, readonly string[]> = {
  strategy: ['Strategy'],
  design: ['Active Design', 'Design QA', 'Ready for Design', 'Design Client Review'],
  dev: ['Active Dev', 'Active Development', 'Dev QA', 'Ready for Dev', 'Dev Client Review'],
  queued: ['Queued'],
  live: ['Live'],
};

// Statuses explicitly excluded from the live pipeline (documented so a
// reader knows their omission from STAGE_STATUSES is intentional, not a gap).
export const EXCLUDED_STATUSES: readonly string[] = ['Done', 'Reporting'];

// Flat union of every counted status — drives the single JQL `status IN (...)`
// clause per project.
export const ALL_STAGE_STATUSES: readonly string[] = PIPELINE_STAGES.flatMap(
  (stage) => STAGE_STATUSES[stage],
);

// Jira issue types excluded from the pipeline query. These are auto-generated
// workflow scaffolding sub-tasks (three per parent story, parked in Strategy)
// — never pipeline work, and they carry no brand of their own (the brand lives
// on the parent). Including them inflated `unresolved_count` by 252 on NBLYCRO
// while contributing zero real work. Drives an `AND issuetype NOT IN (...)`
// clause on the per-project query. Add future checklist types here.
export const EXCLUDED_ISSUE_TYPES: readonly string[] = [
  'Strategy Review Checklist',
  'Design Review Checklist',
  'Dev Review Checklist',
];

// Reverse lookup: Jira status → pipeline stage (or null when excluded/unknown).
const STATUS_TO_STAGE: Map<string, PipelineStage> = new Map(
  PIPELINE_STAGES.flatMap((stage) =>
    STAGE_STATUSES[stage].map((status) => [status, stage] as const),
  ),
);

export function stageForStatus(status: string | null | undefined): PipelineStage | null {
  if (!status) return null;
  return STATUS_TO_STAGE.get(status) ?? null;
}

// -----------------------------------------------------------------------
// Overlay tags. Stored on the Jira multi-select custom field
// `customfield_12528` ("CRO Labels"). Match on the option `value` string
// with exact Jira casing (verified against production 2026-06-03).
// -----------------------------------------------------------------------

export const OVERLAY_FIELD_ID = 'customfield_12528';

export type OverlayKey = 'needs_info' | 'troubleshooting' | 'on_hold';

export const OVERLAY_KEYS: readonly OverlayKey[] = [
  'needs_info',
  'troubleshooting',
  'on_hold',
] as const;

// UI labels for the overlay toggles.
export const OVERLAY_LABELS: Record<OverlayKey, string> = {
  needs_info: 'Needs Info',
  troubleshooting: 'Troubleshooting',
  on_hold: 'On Hold',
};

// Exact Jira `CRO Labels` option values (casing matters — these are matched
// literally against the multi-select option `.value`).
export const OVERLAY_TAG_VALUES: Record<OverlayKey, string> = {
  needs_info: 'Needs info',
  troubleshooting: 'Troubleshooting',
  on_hold: 'On hold',
};

// Reverse lookup: Jira tag value → overlay key.
const TAG_VALUE_TO_OVERLAY: Map<string, OverlayKey> = new Map(
  OVERLAY_KEYS.map((key) => [OVERLAY_TAG_VALUES[key], key] as const),
);

export function overlayKeyForTag(tagValue: string | null | undefined): OverlayKey | null {
  if (!tagValue) return null;
  return TAG_VALUE_TO_OVERLAY.get(tagValue) ?? null;
}

// -----------------------------------------------------------------------
// Response shapes for GET /api/coverage/pipeline. Defined here (a pure,
// server-dep-free module) so both the route and the client page import the
// same contract.
// -----------------------------------------------------------------------

export type StageCounts = Record<PipelineStage, number>;

// Per-overlay, per-stage subset counts (e.g. how many Dev-stage tickets
// carry the "Needs info" tag).
export type OverlayStageCounts = Record<OverlayKey, StageCounts>;

export interface PipelineTicket {
  key: string;
  url: string;
  summary: string;
  stage: PipelineStage;
  tags: string[];      // all CRO Labels values present on the ticket
  age_label: string;   // approx age in stage (statuscategorychangedate, v1)
}

export interface PipelineBrand {
  brand_code: string;
  counts: StageCounts;
  overlays: OverlayStageCounts;
  tickets: PipelineTicket[];
}

export interface PipelineResponse {
  brands: PipelineBrand[];
  unresolved_count: number;  // tickets whose brand could not be resolved
  errors: string[];          // per-project fetch errors (partial-success transparency)
}

export function emptyStageCounts(): StageCounts {
  return { strategy: 0, design: 0, dev: 0, queued: 0, live: 0 };
}

export function emptyOverlayStageCounts(): OverlayStageCounts {
  return {
    needs_info: emptyStageCounts(),
    troubleshooting: emptyStageCounts(),
    on_hold: emptyStageCounts(),
  };
}
