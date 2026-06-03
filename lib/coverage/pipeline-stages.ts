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
