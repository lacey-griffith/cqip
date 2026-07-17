// Batch 012 — Client Library, Phase B (Monitoring Ingest). Pure helpers +
// canonical value sets for monitoring_findings. Shared by the ingest route,
// the admin status route, the page, and tests/monitoring-findings.test.ts so
// the enums, brand resolution, upsert merge, and status filtering are defined
// exactly once (mirrors the lib/client-library/directives.ts split — logic
// lives in lib; routes/page/test import it).

export const MONITORING_SOURCES = ['convert', 'manual'] as const;
export type MonitoringSource = (typeof MONITORING_SOURCES)[number];

export const ISSUE_TYPES = [
  'no_conversions',
  'no_visitors',
  'high_bounce',
  'low_engagement',
  'error',
  'other',
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const FINDING_SEVERITIES = ['critical', 'medium', 'low'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_STATUSES = ['new', 'actioned', 'dismissed'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

// Admin status route only ever sets one of these (spec §3).
export const ADMIN_STATUSES = ['actioned', 'dismissed'] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

export function isMonitoringSource(v: unknown): v is MonitoringSource {
  return typeof v === 'string' && (MONITORING_SOURCES as readonly string[]).includes(v);
}

export function isIssueType(v: unknown): v is IssueType {
  return typeof v === 'string' && (ISSUE_TYPES as readonly string[]).includes(v);
}

export function isFindingSeverity(v: unknown): v is FindingSeverity {
  return typeof v === 'string' && (FINDING_SEVERITIES as readonly string[]).includes(v);
}

export function isAdminStatus(v: unknown): v is AdminStatus {
  return typeof v === 'string' && (ADMIN_STATUSES as readonly string[]).includes(v);
}

// -------------------------------------------------------------------------
// Brand resolution (spec §2). The tool sends a brand string that is either a
// brand_code (e.g. "MRR") or a jira_value (e.g. "MRR - Mr Rooter Plumbing").
// Resolve brand_code primary, then jira_value fallback — mirroring the
// buildCoverageRows literal-string match. Unresolved → null (still ingested).
// -------------------------------------------------------------------------
export interface ResolvableBrand {
  id: string;
  brand_code: string;
  jira_value: string;
}

export function resolveBrandId(
  brandInput: string | null | undefined,
  brands: ReadonlyArray<ResolvableBrand>,
): string | null {
  if (typeof brandInput !== 'string') return null;
  const trimmed = brandInput.trim();
  if (trimmed.length === 0) return null;
  const byCode = brands.find((b) => b.brand_code === trimmed);
  if (byCode) return byCode.id;
  const byJira = brands.find((b) => b.jira_value === trimmed);
  return byJira ? byJira.id : null;
}

// -------------------------------------------------------------------------
// Parse + validate one incoming finding (spec §2). Does NOT resolve the
// brand (the route holds the brands list and does that separately). `now`
// is injectable so detected_at defaulting is deterministic in tests.
// -------------------------------------------------------------------------
export interface RawFinding {
  source?: unknown;
  external_ref?: unknown;
  brand?: unknown; // brand string (code or jira value); resolved by the route
  convert_test_id?: unknown;
  issue_type?: unknown;
  severity?: unknown;
  summary?: unknown;
  detail?: unknown;
  detected_at?: unknown;
}

// A validated finding, minus brand_id (which the route resolves + attaches).
export interface ParsedFinding {
  source: MonitoringSource;
  external_ref: string | null;
  brand: string | null; // the raw brand string, for the route to resolve
  convert_test_id: string | null;
  issue_type: IssueType;
  severity: FindingSeverity | null;
  summary: string;
  detail: unknown;
  detected_at: string; // ISO
}

export type ParseResult =
  | { ok: true; value: ParsedFinding }
  | { ok: false; error: string };

function asTrimmedOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function coerceDetectedAt(v: unknown, now: Date): string {
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return now.toISOString();
}

export function parseFinding(raw: RawFinding, now: Date = new Date()): ParseResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'finding must be an object' };
  }
  if (!isMonitoringSource(raw.source)) {
    return { ok: false, error: "source must be one of 'convert', 'manual'" };
  }
  if (!isIssueType(raw.issue_type)) {
    return {
      ok: false,
      error:
        "issue_type must be one of 'no_conversions', 'no_visitors', 'high_bounce', 'low_engagement', 'error', 'other'",
    };
  }
  const summary = asTrimmedOrNull(raw.summary);
  if (!summary) {
    return { ok: false, error: 'summary is required' };
  }
  // severity is optional; if present it must be valid.
  let severity: FindingSeverity | null = null;
  if (raw.severity !== undefined && raw.severity !== null) {
    if (!isFindingSeverity(raw.severity)) {
      return { ok: false, error: "severity must be one of 'critical', 'medium', 'low'" };
    }
    severity = raw.severity;
  }

  return {
    ok: true,
    value: {
      source: raw.source,
      external_ref: asTrimmedOrNull(raw.external_ref),
      brand: asTrimmedOrNull(raw.brand),
      convert_test_id: asTrimmedOrNull(raw.convert_test_id),
      issue_type: raw.issue_type,
      severity,
      summary,
      detail: raw.detail ?? null,
      detected_at: coerceDetectedAt(raw.detected_at, now),
    },
  };
}

// -------------------------------------------------------------------------
// Upsert merge (spec §2). On re-post of an existing (source, external_ref):
// update summary / detail / severity / detected_at / updated_at, but LEAVE
// status untouched — a dismissed/actioned finding must not resurrect to
// 'new', and a still-'new' one just stays 'new'. Encoded as: the update
// patch NEVER contains a `status` key.
// -------------------------------------------------------------------------
export interface FindingInsertRow {
  source: MonitoringSource;
  external_ref: string | null;
  brand_id: string | null;
  convert_test_id: string | null;
  issue_type: IssueType;
  severity: FindingSeverity | null;
  summary: string;
  detail: unknown;
  detected_at: string;
  // status intentionally omitted — the column defaults to 'new'.
}

export function buildInsertRow(f: ParsedFinding, brandId: string | null): FindingInsertRow {
  return {
    source: f.source,
    external_ref: f.external_ref,
    brand_id: brandId,
    convert_test_id: f.convert_test_id,
    issue_type: f.issue_type,
    severity: f.severity,
    summary: f.summary,
    detail: f.detail,
    detected_at: f.detected_at,
  };
}

export interface FindingUpdatePatch {
  summary: string;
  detail: unknown;
  severity: FindingSeverity | null;
  detected_at: string;
  updated_at: string;
  // NO status — the human's decision is preserved (spec §2).
}

export function buildUpdatePatch(f: ParsedFinding, updatedAtIso: string): FindingUpdatePatch {
  return {
    summary: f.summary,
    detail: f.detail,
    severity: f.severity,
    detected_at: f.detected_at,
    updated_at: updatedAtIso,
  };
}

// Dedupe key for matching an incoming finding to an existing row. Only
// meaningful when external_ref is non-null (the partial unique index).
export function dedupeKey(source: MonitoringSource, externalRef: string | null): string | null {
  return externalRef === null ? null : `${source}::${externalRef}`;
}

// -------------------------------------------------------------------------
// Panel helpers (spec §4). Findings feeding the "Needs action" panel are the
// status='new' ones; sort by severity (critical → medium → low → unset) then
// detected_at desc.
// -------------------------------------------------------------------------
export const SEVERITY_RANK: Record<FindingSeverity, number> = {
  critical: 0,
  medium: 1,
  low: 2,
};

export function severityRank(severity: FindingSeverity | null): number {
  return severity === null ? 3 : SEVERITY_RANK[severity];
}

// Only the fields the panel comparator reads. Callers with richer rows
// (extra props) still satisfy this structurally.
export interface PanelFinding {
  severity: FindingSeverity | null;
  detected_at: string;
}

export function isNew(f: { status: FindingStatus }): boolean {
  return f.status === 'new';
}

export function countNew(findings: ReadonlyArray<{ status: FindingStatus }>): number {
  return findings.reduce((n, f) => (f.status === 'new' ? n + 1 : n), 0);
}

// Sort comparator for the panel: severity asc-rank (critical first) then
// detected_at desc (newest first). Pure; caller filters to status='new'.
export function compareForPanel(a: PanelFinding, b: PanelFinding): number {
  const rankDiff = severityRank(a.severity) - severityRank(b.severity);
  if (rankDiff !== 0) return rankDiff;
  return b.detected_at.localeCompare(a.detected_at);
}
