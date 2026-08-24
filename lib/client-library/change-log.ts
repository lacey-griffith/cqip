// Batch #3 — Change Log widget: the decisions the widget makes about a row,
// as pure functions so tests/change-log.test.ts can pin them. The component
// itself stays untested, as every other route does.
//
// Spec: docs/specs/batch-change-log-widget.md. Cite by section number.
//
// TWO RULES IN HERE ARE LOAD-BEARING AND BOTH ARE ABOUT NOT OVERCLAIMING:
//   §4  an approximate date may never render as if it were exact
//   §5  attribution is script-vs-human ONLY, never which human pass
// Both are enforced STRUCTURALLY below rather than by convention, because this
// project's standing defect pattern (G5a, five instances) is a claim recorded as
// verified when it was not.

// -------------------------------------------------------------------------
// The row shape, as read. `target_type`/`target_id` are nullable in the table;
// the widget's population is target_type = 'directive_brand_status' (spec §2),
// but the type stays honest about the column.
// -------------------------------------------------------------------------
export interface AuditRowLike {
  id: string;
  target_type: string | null;
  target_id: string | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
}

export const CELL_TARGET_TYPE = 'directive_brand_status';
export const DIRECTIVE_TARGET_TYPE = 'directive';

// ⚠ ONLY A `status` ROW IS A RESOLVE EVENT (Karen HIGH-1, 2026-08-24).
//
// The first build took the latest per-cell row regardless of `field_name`, so a
// later NOTE edit became the cell's "exact resolve date". Real production row:
// cell ea9cd7c5 went todo→done on 2026-07-25 by
// `system:convert-reconciliation`, and the widget rendered **Jul 29, 2026,
// exact, no qualifier, By: Manual** — wrong date, wrong actor, no marker. That
// is the §4 violation this module claims to make unreachable, entering through
// CLASSIFICATION rather than through rendering. The structural guard on
// `resolveDisplay` never saw it, because by then the moment was already labelled
// exact.
//
// 28 of 542 cell rows are `note`; 514 are `status`. Filtering costs no coverage:
// every done cell holding ANY cell row also holds a `status` row (387 = 387,
// probed 2026-08-24), so this narrows WHICH row wins, never how many cells have
// one. The mechanism it closes is unbounded — a note edit next year would
// otherwise present next year's date as the resolve date for a cell finished
// today.
export const RESOLVE_FIELD = 'status';

// -------------------------------------------------------------------------
// §5 — ATTRIBUTION CEILING. Script vs human. That is the entire vocabulary.
//
// Every UI edit writes `changed_by = l.hay@fusion92.com`, so the data cannot
// distinguish one human pass from another. The specific trap the archive records:
// there is NO `system:v21-trigger-backport` writer in audit_log at all — that
// loader was abandoned and never run, and its items became UI hand-entry. So
// "V2.1 entries" are not separable from any other UI edit.
//
// The labels are deliberately COARSE. Do not add a third, and do not surface
// `changed_by` verbatim next to one — an email beside "Manual" invites the reader
// to infer a specific pass, which is exactly the unsupported claim.
// -------------------------------------------------------------------------
export const ACTOR_KINDS = ['script', 'human'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const ACTOR_LABEL: Record<ActorKind, string> = {
  script: 'Automated',
  human: 'Manual',
};

/**
 * `system:` prefix → script; anything else → human.
 *
 * Prefix rather than an allowlist of known script identities, deliberately: a new
 * script would otherwise be silently labelled "Manual", which is the direction
 * that overclaims. §13 records that a second system identity already writes
 * `log_status` under a BARE identity — so a `system:%` filter undercounts scripts,
 * and the failure here must be toward "script", never toward "a human did this".
 */
export function actorKind(changedBy: string): ActorKind {
  return changedBy.startsWith('system:') ? 'script' : 'human';
}

export function actorLabel(changedBy: string): string {
  return ACTOR_LABEL[actorKind(changedBy)];
}

// -------------------------------------------------------------------------
// §4 — THE DEGRADED PATH. Decided by Lacey 2026-08-22, unchanged.
//
// 252 of 620 done cells (40.6%, probed 2026-08-24) hold no per-cell audit row.
// They render as "Resolved — date unknown", showing the directive-level date
// MARKED APPROXIMATE. Never substitute that date without the marker.
//
// ⚠ AND THIS IS PERMANENT UI, NOT A TRANSITIONAL STATE (spec §1.1). Done cells
// grew 539 → 620 while the uncovered set went 255 → 252 — nearly every NEW done
// cell gets a per-cell row, so the gap is a FROZEN historical backlog. It shrinks
// as a share of the widget forever and never reaches zero. Style it as
// deliberate, never as an error or a loading skeleton.
// -------------------------------------------------------------------------
export type ResolveProvenance = 'per-cell' | 'directive-approximate' | 'none';

export interface ResolveMoment {
  provenance: ResolveProvenance;
  /** ISO timestamp, or null when nothing is known at all. */
  at: string | null;
  actor: ActorKind | null;
}

export interface CellKey {
  cellId: string;
  directiveId: string;
}

/**
 * Latest row wins. Ties broken by nothing — an exact tie on `changed_at` is
 * indistinguishable in the data and picking either is honest, so the first is
 * kept rather than pretending an order exists.
 */
export function latestRow(rows: readonly AuditRowLike[]): AuditRowLike | null {
  let best: AuditRowLike | null = null;
  for (const r of rows) {
    if (best === null || Date.parse(r.changed_at) > Date.parse(best.changed_at)) best = r;
  }
  return best;
}

export function resolveMomentFor(
  cell: CellKey,
  perCellRows: ReadonlyMap<string, readonly AuditRowLike[]>,
  directiveRows: ReadonlyMap<string, readonly AuditRowLike[]>,
): ResolveMoment {
  // Only `status` rows. See RESOLVE_FIELD above — this filter is the fix for a
  // confirmed wrong-date-and-wrong-actor defect, not a tidy-up.
  const exact = latestRow((perCellRows.get(cell.cellId) ?? []).filter((r) => r.field_name === RESOLVE_FIELD));
  if (exact) {
    return { provenance: 'per-cell', at: exact.changed_at, actor: actorKind(exact.changed_by) };
  }

  const summary = latestRow(directiveRows.get(cell.directiveId) ?? []);
  if (summary) {
    // ⚠ THE ACTOR IS DELIBERATELY NULL HERE, and this is not an oversight.
    // A directive-level row says who touched the DIRECTIVE, not who resolved
    // THIS CELL. Carrying it across would attribute a specific actor to a cell
    // on no evidence — the same overclaim as substituting the date, one column
    // over, and it would be far harder to spot because the date carries a marker
    // and an actor badge would not.
    return { provenance: 'directive-approximate', at: summary.changed_at, actor: null };
  }

  return { provenance: 'none', at: null, actor: null };
}

// -------------------------------------------------------------------------
// Rendering the moment. Returns a STRUCTURE, not a string, so the component
// cannot render the date without its qualifier: for an approximate moment
// `primary` never contains a date at all, and the date only exists inside
// `qualifier`. Getting this wrong requires deleting a field, not forgetting a
// conditional.
// -------------------------------------------------------------------------
export interface ResolveDisplay {
  /** The headline. Never a bare date for an approximate moment. */
  primary: string;
  /** Non-null IFF the date is approximate or absent. Must be rendered. */
  qualifier: string | null;
  /** True when `primary` is a trustworthy per-cell date. */
  exact: boolean;
}

export const UNKNOWN_DATE_TEXT = 'Resolved — date unknown';

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function resolveDisplay(m: ResolveMoment): ResolveDisplay {
  if (m.provenance === 'per-cell' && m.at) {
    const day = formatDay(m.at);
    // An unparseable timestamp must not be reported as an exact date (Karen LOW).
    // formatDay returns an em-dash there, and "—" with exact:true is a claim.
    if (day === '—') return { primary: UNKNOWN_DATE_TEXT, qualifier: 'unreadable timestamp', exact: false };
    return { primary: day, qualifier: null, exact: true };
  }
  if (m.provenance === 'directive-approximate' && m.at) {
    return {
      primary: UNKNOWN_DATE_TEXT,
      qualifier: `directive updated ~${formatDay(m.at)} (approximate)`,
      exact: false,
    };
  }
  return { primary: UNKNOWN_DATE_TEXT, qualifier: 'no audit trail', exact: false };
}

// -------------------------------------------------------------------------
// §3 / §7.2 — THE READ MUST NOT RENDER SHORT.
//
// audit_log is at 1,690 rows against PostgREST's 1,000-row cap, and a capped
// read comes back short WITHOUT an error. Worse than incomplete: with no
// ORDER BY, rows arrive in physical HEAP order, and MVCC writes an updated row's
// new version to the heap tail — so the rows past the cap are the RECENTLY EDITED
// ones. A truncated change log drops THE NEWEST CHANGES FIRST, which is the exact
// opposite of what a reader assumes a change log is showing them.
//
// So: count-verify against a separate count:'exact', head:true and refuse to
// render on a mismatch. Gate 0 itself used this method.
// -------------------------------------------------------------------------
export interface ReadCheck {
  ok: boolean;
  message: string | null;
}

export function verifyCompleteRead(describe: string, expected: number | null, received: number): ReadCheck {
  // ⚠ `Number.isFinite`, NOT `expected === null` (Karen HIGH-3, 2026-08-24).
  // supabase-js parses the count as `parseInt(contentRange.split('/')[1])`, so a
  // `content-range: */*` response yields **NaN, not null** — and `NaN ?? null` is
  // NaN. The first build's `expected === null` branch was therefore DEAD against
  // the real client, and what users actually got was
  // "the exact count is NaN", which is nonsense rather than a failure message.
  if (expected === null || !Number.isFinite(expected)) {
    return {
      ok: false,
      message: `${describe}: no usable exact count, so completeness cannot be verified. Refusing to render.`,
    };
  }

  // ⚠ ONLY A SHORT READ FAILS (Karen MEDIUM-1, 2026-08-24).
  //
  // The first build failed both directions, and that was wrong. There are four
  // independent count→read windows per page load and audit_log takes tens of
  // rows a day, so ONE ordinary save between the count and the read made
  // `received > expected` and killed the entire panel — with a message that
  // explained a SHORT read while the read had been long. An over-read cannot
  // hide rows, which is the only thing this check exists to catch. A row arriving
  // mid-load is normal operation, not corruption.
  //
  // The fail-closed direction is kept exactly as strict: `received < expected` is
  // the cap's signature and is never rendered.
  if (received >= expected) return { ok: true, message: null };
  return {
    ok: false,
    message:
      `${describe}: read ${received} rows but the exact count is ${expected} — ${expected - received} missing. ` +
      `A short read drops the MOST RECENT changes first (heap order + MVCC), so this is not rendered.`,
  };
}

// -------------------------------------------------------------------------
// ⚠ C1 — "NO ROWS" AND "NOT ALLOWED TO SEE ROWS" ARE DIFFERENT, AND CONFLATING
// THEM MADE THIS WIDGET LIE (Karen CRITICAL-1, 2026-08-24).
//
// `audit_log` has exactly one SELECT policy — `audit_log_select_admin`, qual
// `is_admin()`. There are three active read-only users. For them RLS filters the
// `count:'exact'` query and the paged read IDENTICALLY to zero, with no error, so
// the completeness check passed and the panel rendered:
//
//     "0 of 639 finished cells (0.0%) have an exact resolve date"
//
// with 639 rows reading "no audit trail". Every one of those cells HAS an audit
// trail. §4 asked for the degraded state to look deliberate rather than like a
// failure, which is exactly what made this invisible — and it landed on the
// read-only viewer, the audience §6 reasoned about while wrongly asserting the
// panel shows nothing a Pulse viewer cannot already see.
//
// A zero-row audit read alongside a non-zero cell read is therefore treated as a
// PERMISSION state, never as data. It fails toward "cannot show you" instead of
// toward a fabricated 0%: a genuinely empty audit_log with finished cells is
// indistinguishable from no permission, and of the two possible wrong answers
// only one asserts a false fact about the data.
// -------------------------------------------------------------------------
export type AuditAccess = 'readable' | 'not-permitted';

export function auditAccess(doneCellCount: number, cellAuditRowCount: number): AuditAccess {
  if (doneCellCount > 0 && cellAuditRowCount === 0) return 'not-permitted';
  return 'readable';
}

export const NOT_PERMITTED_TEXT =
  'Change history is not available for your account. It requires admin access.';

// -------------------------------------------------------------------------
// Ordering. Newest first — a change log's only defensible default.
//
// Rows with no date at all sort LAST rather than being dropped: §4's whole point
// is that an unknown row is shown, not hidden.
// -------------------------------------------------------------------------
export interface ChangeLogEntry extends CellKey {
  moment: ResolveMoment;
  brandCode: string;
  directiveTitle: string;
}

export function sortEntries(entries: readonly ChangeLogEntry[]): ChangeLogEntry[] {
  return [...entries].sort((a, b) => {
    const ta = a.moment.at ? Date.parse(a.moment.at) : null;
    const tb = b.moment.at ? Date.parse(b.moment.at) : null;
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta;
  });
}

// -------------------------------------------------------------------------
// Coverage summary — the honest header line. Reported, never hardcoded: these
// counts have moved on every single probe (539 → 620 done cells between 08-03
// and 08-24), so the widget states what IT read, dated by the read.
// -------------------------------------------------------------------------
export interface CoverageSummary {
  total: number;
  exact: number;
  approximate: number;
  unknown: number;
  /** null when total is 0 — a percentage of nothing is not 0%, it is undefined. */
  exactPct: number | null;
}

export function summarize(entries: readonly ChangeLogEntry[]): CoverageSummary {
  let exact = 0, approximate = 0, unknown = 0;
  for (const e of entries) {
    if (e.moment.provenance === 'per-cell') exact += 1;
    else if (e.moment.provenance === 'directive-approximate') approximate += 1;
    else unknown += 1;
  }
  const total = entries.length;
  return { total, exact, approximate, unknown, exactPct: total === 0 ? null : (exact / total) * 100 };
}
