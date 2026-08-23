# Batch 007 — Custom Jira Boards · full scope

**Relocated from `CLAUDE.md` §15 on 2026-08-23** by the second extraction pass
(§13 r41 remedy 3 / r42). **This file is live scope authority — it is NOT the
archive, and r40 does not apply to it.** Current sequencing, mode and open
actions stay in CLAUDE.md §15; read those there, not here.

Board rev 8.1 places 007 at sequence **#13**, mode `auto`.

---

### Batch 007 (post-006, hard prereq: 004.99 + SPL onboarding) — Custom Jira Boards
Internal Kanban-style board view inside CQIP mirroring active tickets
across all onboarded CRO Jira projects. Functions as a CRO-native
replacement for the standard Jira board, with quality_logs context
integrated next to each ticket. Direct team request; high priority
once multi-client foundation is in place.

**Initial scope: read-only.** §13 rule 5 (CQIP read-only against Jira)
remains intact for v1. Drag-drop / write-back is a follow-on batch
once the read-only board has lived in production for a few weeks
and team feedback informs the write model.

**Decisions locked at scope time (2026-05-06):**
- Read-only first; read-write as natural follow-on batch
- Real-time sync via webhook (extend jira-webhook to cache all
  ticket state, not just rework events)
- Multi-board UX: per-client board (NBLY, SPL, future) plus a
  "View All" combined view; same status columns + structure
  across all
- Brand-level filtering on per-client boards; global filter
  system (built-in + user-custom) on all views
- v1 columns only (status); swimlanes deferred to v2 unless
  team friction surfaces during use
- Card content: ticket ID, title, status, severity, brand,
  assignee, sendback count, age, plus any custom-field tags;
  expandable as needs emerge
- Performance: server-side filtering + per-column pagination
  (~50 tickets per column initial load, infinite scroll for
  more) + client-side virtual scrolling per @tanstack/react-virtual
- Cache layer: new `jira_tickets` table populated by webhook,
  read-side served from cache (Jira API never hit at render time)
- Permissions: same view for admins + read-only users (no
  per-action gating in v1)
- Ticket detail: click card opens unified drawer (ticket header
  + status + assignee + brand + custom tags on top, associated
  quality_logs underneath via existing LogDetailDrawer pattern;
  per §13 rule 26 drawer-on-drawer is supported)
- New page: `/dashboard/board` (or `/dashboard/boards` —
  decide at implementation), linked in main nav alongside
  Dashboard, Coverage, etc.

**Decisions banked 2026-07-03 (`docs/batch-outline-2026-07-03.md`) —
promoted from the discovery list below:**
- **Saved views: URL params + per-user saved views + default-view-on-login**
  (uses the `board_views` table already in the sketch). Flow: Jira-like
  default layout → user customizes → saves to profile → their default
  loads on board entry.
- **Filter bar: Jira-parity** (per Lacey's screenshot) — quick filters
  (Exclude Paused Brands / Roadmap / In Progress / QA / With Client /
  Needs Attention / No holds / Assigned to me / Unassigned / Recently
  Updated), brand pills (ASV…WDG), a grouping control.
- **Card density: compact default, comfortable as a user toggle.**
- **Cache freshness: "last synced" indicator + manual "sync now" CTA**
  showing success/failure (sync_runs pattern precedent from Batch 005.10).

DISCOVERY DECISIONS STILL OPEN AT IMPLEMENTATION:
- Exact route path (`/board` vs `/boards`)
- Whether "View All" collapses to a single combined column
  set or shows per-client column groups

IMPLEMENTATION SKETCH — relocated to `docs/claude-archive/CLAUDE-16-2026-07.md`
(r42). It is an unbuilt design sketch, not an obligation; **re-derive it against
the codebase as it stands when 007 actually starts** rather than treating a
2026-05-06 sketch as a plan. The parts that bind are the locked decisions above,
not the sketch. Effort was estimated at 3-5 weeks for read-only v1, +2-4 for the
read-write follow-on — an estimate, never validated.

**Why high priority:** team request, replaces a daily-use external
tool with a CRO-context-aware view, reuses CQIP's existing data
model (quality_logs, brands, milestones) rather than duplicating it.
