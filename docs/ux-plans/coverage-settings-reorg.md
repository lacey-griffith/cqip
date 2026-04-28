# Coverage + Settings Navigation Reorg — UX Plan

**Status:** Discovery / proposal. No code changes yet. Awaits Lacey's
approve / modify / defer decision before any implementation batch is
scoped.

**Author:** Claude (Batch 004.4.5 — UX discovery)
**Date:** 2026-04-26

---

## 1. Current State Inventory

### 1a. Coverage-related routes

#### `/dashboard/coverage` — anyone signed in
Read-only-friendly. Loads `brands`, `test_milestones`, `quality_logs`
in parallel and renders:

| Section | Tasks supported |
|---|---|
| Header | Sync Jira (admin button — present on Coverage / Logs / Reports) |
| KPI strip (4) | View tests this week / last week / rolling 28 / this month |
| Tests-delivered strip (2) | View YTD / all-time totals |
| Sticky action bar | Toggle paused-brand visibility, export to Excel |
| Brand table | Sort by 9 columns (brand, the four time windows, rework count, rework ratio, status). Click a row → opens `BrandDetailDrawer`. |
| `BrandDetailDrawer` | Per-brand drill-down: 4 KPI tiles, 6-month bar chart, last-28-day milestone list, paused indicator. **Admin "Manage milestones" button does a `window.location.href` redirect** to `/settings/coverage?brand=<id>`. |

#### `/dashboard/settings/coverage` — admin only
Single scrolling page with four stacked workflows:

| Section | Tasks supported | Component |
|---|---|---|
| **"Add manual milestone" form** | Create a milestone the webhook missed (incl. soft-delete restore branch) | `ManageMilestonesDialog` (inline, despite the name) |
| **Milestone list table** | Filter by brand, edit `reached_at` + `notes`, soft-delete | same component |
| **"QA Automation Config" card** | List every brand, open `EditBrandQaConfigDrawer` to edit Forge-facing config | inline card + `EditBrandQaConfigDrawer` |
| **"Paused brands" + "Pause an active brand"** | Pause/unpause brands, edit pause reason | inline cards + small form |

#### `BrandDetailDrawer.onManageMilestones` — cross-page bleed
The drawer's only outbound nav: closes the drawer, sets
`window.location.href` to `/settings/coverage?brand=<id>`, full
navigation. Returning to the coverage page is an admin's manual job.

### 1b. Settings hub (`/dashboard/settings/page.tsx`)

Seven cards, no grouping:

| # | Card | Audience | Frequency | Lives at |
|---|---|---|---|---|
| 1 | Profile | everyone | occasional | `/settings/profile` |
| 2 | Alert Rules | admin | rare config | `/settings/alerts` |
| 3 | Projects | admin | rare config | `/settings/projects` |
| 4 | Users | admin | onboarding (occasional) | `/settings/users` |
| 5 | Change Log | admin | forensics (occasional) | `/settings/audit` |
| 6 | Client Coverage | admin | mixed (Lacey: bi-weekly QA edits + rare milestone work) | `/settings/coverage` |
| 7 | System Info | admin | rare (deploy verification) | `/settings/system` |

Top-level nav (`components/layout/nav.tsx`) has: Dashboard, Client
Coverage, Logs, Reports, Profile. Admins additionally see "Settings".
No deep links into specific settings sub-pages from the sidebar.

### 1c. Tasks × frequency × audience

| Task | Frequency | Audience | Current location | Path length |
|---|---|---|---|---|
| View brand coverage status | daily–weekly | everyone (5 read-only + 2 admin) | `/coverage` | 1 click |
| Drill into one brand | weekly | everyone | drawer on `/coverage` | 2 clicks |
| Export coverage to Excel | weekly | admin (Xandor) | `/coverage` action bar | 1 click |
| **Edit QA Automation Config** | **bi-weekly–monthly (Lacey hot spot)** | admin (Lacey) | `/settings/coverage` → scroll → drawer | **3 clicks + scroll** |
| Pause a brand | rare | admin (Lacey) | `/settings/coverage` → "Pause an active brand" sub-form | 3 clicks + scroll |
| Unpause / edit pause reason | rare | admin | `/settings/coverage` → "Paused brands" card | 3 clicks + scroll |
| Add manual milestone | rare–occasional | admin | `/settings/coverage` → top form | 3 clicks |
| Edit / soft-delete milestone | rare | admin | `/settings/coverage` → milestone table | 3 clicks |
| Restore soft-deleted milestone | rare | admin (auto-detected on duplicate add) | same | 3 clicks |
| Read change log | occasional | admin | `/settings/audit` | 2 clicks |
| Verify deploy | rare | admin | `/settings/system` | 2 clicks |

### 1d. Duplicated / split flows

- **Per-brand drill-down vs per-brand admin actions are split across two routes.** `/coverage`'s drawer shows the brand's data; `/settings/coverage`'s sections own the brand's mutations. The drawer's only escape into mutation flows is a hard nav.
- **Two pause UIs in one card.** Active brands pause via a select-driven sub-form at the bottom; paused brands resume via a button on each row card. Same operation, two layouts.
- **Milestone restoration is hidden inside the "Add" path** (auto-detected on `(ticket, milestone_type)` collision). Discoverable only by adding a duplicate.
- **`ManageMilestonesDialog` is misnamed** — renders inline, not as a modal. New contributors expect a Radix dialog.

---

## 2. Problem Statement

1. **The hot-spot task lives 3 clicks deep.** Editing QA Automation
   Config is Lacey's most frequent admin task (bi-weekly+); it requires
   navigating Sidebar → Settings → Coverage → scroll → drawer. Every
   other admin task on `/settings/coverage` is rare. A high-frequency
   workflow is sharing real estate with rare data fixes.
2. **Cross-page bleed loses context.** From `/coverage`, an admin
   inspects a brand's drawer, decides to fix a missing milestone, and
   gets `window.location.href`'d to `/settings/coverage?brand=<id>`.
   They lose their sort order, their scroll position, and their drawer
   state. After the fix, they must navigate back manually.
3. **"Settings" implies rare config.** QA Automation Config is
   operational (per-brand business config consumed by the Forge app),
   not system config. Burying it under Settings sets the wrong mental
   model.
4. **Settings hub mixes audiences and cadences without grouping.**
   Profile (everyone, occasional), QA Coverage (admin, frequent),
   Projects/Alerts/Users (admin, rare), Audit/System (admin,
   technical). The flat 7-card grid signals nothing about which is
   which.
5. **Milestone restoration is undiscoverable.** It's a side-effect of
   trying to add a duplicate, not a first-class action. Admins who want
   to undo a soft-delete have to know the trick.

---

## 3. Proposed Reorganization

### 3a. Core principle
**Bring high-frequency admin tasks closer to the data they touch.**
Coverage operations (QA config, pause, milestones) belong under
`/coverage`. Reserve `/settings` for genuine system / account config.

### 3b. Per-task placements

| Task | Proposed placement | Rationale |
|---|---|---|
| View coverage / drill into a brand | `/coverage` (unchanged) | Already correct. |
| Export to Excel | `/coverage` action bar (unchanged) | Already correct. |
| **Edit QA Automation Config** | **Brand detail drawer (admin action button) + per-row kebab on the coverage table** | Lacey hot spot; one click from the brand she cares about, OR one click from the row. |
| Pause / unpause a brand | New `BrandPauseDrawer` opened from the brand detail drawer's admin actions, OR per-row kebab | Reason input belongs in a focused surface, not buried in a settings sub-form. |
| Add manual milestone | Header button on `/coverage` ("+ Add milestone") → new `AddMilestoneDrawer` | Discoverable, no scroll, doesn't require pre-selecting a brand. |
| Edit / delete / restore milestone | New `ManageMilestonesDrawer` opened from the brand detail drawer's admin actions, scoped to that brand by default | Restoration becomes visible: drawer offers a "Show deleted" toggle, exposing the soft-deleted rows for one-click restore. |
| Read change log | `/settings/audit` (unchanged path) | Right-sized for forensics today. Stays under Settings. |
| Verify deploy | `/settings/system` (unchanged path) | Engineering chore. Stays under Settings. |
| Configure projects / alerts / users | `/settings/{projects,alerts,users}` (unchanged paths) | Genuine config. Already in the right home. |
| Edit profile | `/settings/profile` (unchanged path) | Already in the right home. |

### 3c. Coverage page becomes the canonical Coverage hub

For admins, `/coverage` gains:
- Header button: "+ Add milestone" → opens `AddMilestoneDrawer`.
- Per-row kebab on the brand table: View details, Edit QA Config,
  Pause / Unpause.
- Brand detail drawer footer: "Edit QA Config", "Manage Milestones",
  "Pause Brand" buttons (admin only).

For read-only users `/coverage` is unchanged. Every new affordance is
gated on `isAdmin`.

### 3d. `/settings/coverage` is deleted

After phased migration completes, the page file is removed. The route
keeps a one-release-cycle 301 redirect to `/coverage` so any
bookmarked URLs (or stale BrandDetailDrawer code paths if a stale
bundle is in someone's tab) don't 404. The redirect can drop in the
next release after that.

### 3e. Settings hub regrouped into three sections

| Section | Cards | Audience |
|---|---|---|
| **Account** | Profile | everyone |
| **Configuration** | Projects, Alert Rules, Users | admin |
| **Diagnostics** | Change Log, System Info | admin |

The Coverage Management card disappears (the page is deleted). Section
headers are visual labels — not a structural change to URLs.

### 3f. Audit vs System grouping (open question answered)

Keep them as separate cards but co-locate them under a shared
"Diagnostics" section. They serve different purposes (forensic
business trail vs deploy verification) but share a frequency profile
(rare admin reads) and a "this is for digging in" mental model. Audit
goes first because it's more user-facing.

---

## 4. Wireframes

### 4a. `/coverage` (admin view)

```
┌─────────────────────────────────────────────────────────────────┐
│ COVERAGE                                          [Sync Jira]  │
│ Client Coverage                                                 │
│ Tests by brand. ≤2 in last 28d flagged.                         │
└─────────────────────────────────────────────────────────────────┘

┌──────┬──────┬──────┬──────┐  ┌──────────┬──────────┐
│ Wk   │ LWk  │ 28d  │ Mo   │  │ YTD      │ All-Time │
│  12  │  10  │  47  │  18  │  │   234    │  1,847   │
└──────┴──────┴──────┴──────┘  └──────────┴──────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ☐ Show paused      [+ Add milestone]      [Export to Excel]    │  ← admin-only "+ Add milestone"
└─────────────────────────────────────────────────────────────────┘

┌─ Brand list ──────────────────────────────────────────────────────────┐
│ Brand        Wk  LWk  28d  Mo  RW28  RR    Trend       Status    ⋮  │
│ ───────────────────────────────────────────────────────────────────  │
│ Aire Serv     2   3    8    4   1    0.13  ▁▃▅▆▇▆     Active     ⋮  │ ← row kebab (admin only)
│ Five Star     0   1    1    0   0    0.00  ▁▁▁▁▂▁     Drought    ⋮  │     • View details
│ Glass Doctor  3   2   12    5   0    0.00  ▁▂▄▅▆▆     Active     ⋮  │     • Edit QA Config
│ Grounds Guys  1   2    5    3   2    0.40  ▁▂▃▄▅▃     Active     ⋮  │     • Pause / Unpause
│ ...                                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 4b. Brand detail drawer (admin actions footer)

```
┌────────────────────────────────────────┐
│ Aire Serv          [ASV] [Active]   ✕  │
├────────────────────────────────────────┤
│ This Wk  Last Wk  Rolling28  Month    │
│   2         3         8        4      │
├────────────────────────────────────────┤
│ Last 6 months                         │
│ ▁▃▅▆▇▆ (bar chart)                    │
├────────────────────────────────────────┤
│ Tests in last 28 days (8)             │
│ NBLYCRO-1452  Apr 24, 4:51 PM         │
│ NBLYCRO-1438  Apr 22, 11:02 AM        │
│ ...                                   │
├────────────────────────────────────────┤
│ ── ADMIN ─────────────────────────    │
│ [Edit QA Config]                      │
│ [Manage milestones]                   │
│ [Pause brand]                         │
└────────────────────────────────────────┘
```

Read-only users do not see the ADMIN footer band at all (hidden, not
disabled — disabled buttons feel like a permission tease).

### 4c. `AddMilestoneDrawer` (new — replaces inline form)

```
┌────────────────────────────────────────┐
│ Add milestone                       ✕  │
├────────────────────────────────────────┤
│ Jira ticket                            │
│ [NBLYCRO-1234         ]                │
│                                        │
│ Brand                                  │
│ [Aire Serv (ASV) ▼]                    │
│                                        │
│ Reached at                             │
│ [2026-04-26T14:30]                     │
│                                        │
│ Notes (optional)                       │
│ [.....................................│
│  ....................................] │
│                                        │
│ [Add milestone]    [Cancel]            │
└────────────────────────────────────────┘
```

Restore-soft-deleted prompt: same `window.confirm()` pattern as today
when the server reports a `(ticket, milestone_type)` already exists
soft-deleted.

### 4d. `ManageMilestonesDrawer` (new — opened from brand detail drawer)

```
┌────────────────────────────────────────┐
│ Manage milestones — Aire Serv      ✕  │
├────────────────────────────────────────┤
│ [+ Add manual milestone for this brand]│
│                                        │
│ Show: ●Active  ☐ Include deleted       │
├────────────────────────────────────────┤
│ Ticket          Reached     Source  ⋯  │
│ ────────────────────────────────────── │
│ NBLYCRO-1452    Apr 24      webhook ⋯  │  ⋯ → Edit / Soft-delete
│ NBLYCRO-1438    Apr 22      manual  ⋯  │
│ NBLYCRO-1401    Apr 18      backfill⋯  │
│ ...                                    │
└────────────────────────────────────────┘
```

The "Include deleted" toggle is the **explicit restore surface** —
soft-deleted rows render with a "Restore" action instead of
Edit/Delete, replacing today's hidden auto-detect-on-duplicate flow.

### 4e. Settings hub (regrouped)

```
┌─────────────────────────────────────────────────────────────────┐
│ Settings                                                         │
│ Manage your account and (admin) system configuration.            │
└─────────────────────────────────────────────────────────────────┘

ACCOUNT
┌────────────────┐
│ 👤 Profile     │
│ Avatar, theme, │
│ password.      │
└────────────────┘

CONFIGURATION (admin)
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ 📁 Projects    │ │ 🔔 Alert Rules │ │ 👥 Users       │
│ Jira projects. │ │ Severity, etc. │ │ Accounts.      │
└────────────────┘ └────────────────┘ └────────────────┘

DIAGNOSTICS (admin)
┌────────────────┐ ┌────────────────┐
│ 📜 Change Log  │ │ ⚙️ System Info │
│ Audit trail.   │ │ Build / commit.│
└────────────────┘ └────────────────┘
```

---

## 5. Files Affected

### New files

| File | Complexity | Notes |
|---|---|---|
| `components/coverage/add-milestone-drawer.tsx` | small/medium | Lifts the "Add manual milestone" form out of `manage-milestones-dialog.tsx`. Keeps the restore-on-duplicate prompt. |
| `components/coverage/manage-milestones-drawer.tsx` | medium | Wraps the existing list/edit/soft-delete UI in a Sheet; adds the "Include deleted → Restore" affordance. Brand-scoped by default; can be unscoped via toggle. |
| `components/coverage/brand-pause-drawer.tsx` | small | Pause-with-reason drawer + unpause button. Replaces the two split paste sections. |
| `components/coverage/brand-row-actions.tsx` | small | Per-row kebab dropdown on the coverage table. |

### Edited files

| File | Complexity | Change |
|---|---|---|
| `app/dashboard/coverage/page.tsx` | **heavy** | Adds admin row kebab, header "+ Add milestone" button, drawer state for the new admin flows, threads `isAdmin` through. |
| `components/coverage/brand-detail-drawer.tsx` | small/medium | Replaces `onManageMilestones` `window.location.href` redirect with an inline admin-action footer band that opens nested drawers. |
| `app/dashboard/settings/page.tsx` | trivial | Regroups cards into Account / Configuration / Diagnostics sections; removes the Coverage Management card. |
| `components/coverage/manage-milestones-dialog.tsx` | small | Eventually deleted (Phase 3). Until then, keep working — both old and new entry points coexist during phase transitions. |
| `CLAUDE.md` | small | §3 file paths, §16 shipped log. |

### Deleted files (Phase 3 only — not Phase 1 or 2)

| File | Notes |
|---|---|
| `app/dashboard/settings/coverage/page.tsx` | Replaced with redirect, then removed entirely the next release cycle. |
| `components/coverage/manage-milestones-dialog.tsx` | Superseded by the two new drawers. |

### Routing / bookmark breakage

- `/dashboard/settings/coverage` and `/dashboard/settings/coverage?brand=<id>`
  → 301 redirect to `/dashboard/coverage` (with optional
  `?openBrand=<id>` query param) for one release cycle.
- The redirect target needs to read `openBrand` and auto-open the
  brand detail drawer for that brand id. Trivial state lift.
- No external systems link into `/settings/coverage` (verified — Forge
  consumes `/api/brands/*`, not the UI).

---

## 6. Phased Implementation Plan

Each phase is independently shippable. Each phase's "done" state is a
real, usable improvement on its own — not a partial migration that
requires the next phase to make sense.

### Phase 1 — Inline admin actions in the brand detail drawer (small)

**Goal:** Lacey's hot-spot task (Edit QA Config) goes from 3 clicks +
scroll → 2 clicks, no nav.

- Add admin-only footer band to `BrandDetailDrawer` with "Edit QA
  Config" and "Pause / Unpause" buttons.
- Wire "Edit QA Config" to open the existing `EditBrandQaConfigDrawer`
  nested inside the brand drawer (or in sequence — Sheet/Sheet
  composition works).
- Add `BrandPauseDrawer` for the pause flow (reason input).
- `/settings/coverage` is unchanged; it still owns milestone
  management, which is fine because that's lower-frequency.
- The `BrandDetailDrawer.onManageMilestones` redirect stays as-is for
  now.

**Ship signal:** Lacey reports that the QA-config flow feels native
and she stops opening Settings to do it.

### Phase 2 — Coverage page row kebab + header "+ Add milestone" (small/medium)

**Goal:** Admin row kebab makes Pause / Edit QA Config one click from
the table (skips the brand drawer when the admin already knows what
they want). Header button discloses milestone-add as a first-class
action.

- Add `BrandRowActions` kebab to the coverage table rows (admin
  gated). Items: View details, Edit QA Config, Pause / Unpause.
- Add `+ Add milestone` button to `/coverage` action bar (admin
  gated) → opens new `AddMilestoneDrawer`.
- `/settings/coverage` still owns the milestone list view (edit /
  delete / restore). Phase 2 only addresses the *add* surface.

**Honest tradeoff:** Phase 2's kebab is partly aesthetic — Phase 1
already covers the workflows via the brand drawer. The kebab buys
1-click skip when you already know the brand. Worth it for Lacey's
frequent edits, less essential for Xandor.

### Phase 3 — Manage Milestones drawer + retire `/settings/coverage` (medium)

**Goal:** End state. The settings page is deleted.

- Build `ManageMilestonesDrawer` opened from the brand detail
  drawer's "Manage milestones" admin button (scoped to the open
  brand by default; "Include deleted" toggle exposes soft-deleted
  rows for explicit restore).
- Remove the `BrandDetailDrawer.onManageMilestones` redirect — wire
  to the new drawer instead.
- Add a route handler at `/dashboard/settings/coverage/route.ts` (or
  similar) that 301-redirects to `/dashboard/coverage?openBrand=<id>`
  if the `?brand=` query param is present, else to `/coverage`.
- Delete `app/dashboard/settings/coverage/page.tsx` and
  `components/coverage/manage-milestones-dialog.tsx`.
- Regroup Settings hub cards into Account / Configuration /
  Diagnostics. Remove Coverage Management card.

**Depends on:** Phase 1 + Phase 2 already shipped.

### Phase 4 — Visual polish (cosmetic, optional)

**Goal:** the "5.1 Coverage page layout cleanup" item from §15.

- Consolidate the four KPI cards + two delivered cards into a tighter
  row.
- Reduce padding.
- Move "Show paused brands" + "Export to Excel" into a tighter
  header section.

**Honest tradeoff:** Pure visual / density work. Independently
shippable but easily skipped if the post-Phase-3 layout already feels
right. Recommend deferring until Phase 3 has settled.

---

## 7. Risks + Open Questions

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Brand detail drawer becomes crowded | medium | Group admin actions in a labeled footer band, separated from read-only data. Hidden entirely for read-only users. |
| Read-only chrome leak | low | `isAdmin` flag already exists; thread it through every new drawer prop. Add explicit prop tests / type-level requirement. |
| Stale browser bundle hits the deleted `/settings/coverage` | low | 301 redirect keeps the URL alive for a release cycle. Stale `BrandDetailDrawer` code paths pointing there get caught by the same redirect. |
| Coverage page state grows unwieldy (drawer state × 4) | medium | Three options: lift to a state machine / reducer; use URL query params (`?openBrand=X&action=qa`) for shareability; or keep the four `useState` slots but extract the orchestrating logic into a custom hook. Recommend a small `useCoverageDrawers()` hook in Phase 1 to keep the page component readable. |
| Row kebab adds horizontal density to a wide table | medium | Make the kebab cell narrow (≤32px), confirm at admin's typical viewport width before shipping Phase 2. Phase 1 doesn't add it, so this risk is deferrable. |
| Mid-cycle URL change confuses an admin who bookmarked `/settings/coverage` | low | Flag in Slack when Phase 3 ships, and the redirect is the safety net regardless. |

### Open questions for Lacey

1. **Pause flow surface.** Drawer (with reason input) every time, or a
   confirm-only modal for unpause? Recommend: drawer for pause (reason
   wanted), instant action with toast for unpause.
2. **Read-only admin chrome.** Hide the entire "ADMIN" footer band on
   the brand detail drawer for read-only users, or show greyed-out
   buttons? Recommend: hide. Disabled buttons feel like a permission
   tease.
3. **Unified "Brand admin" drawer with tabs (alternative to
   multi-drawer).** Tabs: Details / QA Config / Milestones / Pause.
   Bigger UI bet, simpler conceptually for Lacey because there's only
   one entry point. Worth a vote — the current multi-drawer proposal
   is the conservative choice.
4. **Coverage page sort default.** Today defaults to "status desc"
   (drought floats up). With admins now landing here for QA-config
   edits, does that default still make sense, or should admins land
   sorted alphabetically? Recommend: keep status desc — drought
   visibility is the page's primary value prop; QA edits are a
   secondary use even for Lacey.
5. **Audit log surface.** Stay under Settings, or graduate to a
   top-level nav entry given how often it's referenced for
   forensics? Recommend: stay under Settings (still infrequent for
   most admins). Revisit if forensics frequency increases.
6. **Manage Milestones drawer scope default.** Brand-scoped (today's
   `?brand=<id>` behavior) or unscoped (all brands, with optional
   filter)? Recommend: scoped by default when opened from a brand
   drawer; unscoped when opened from the page header (which Phase 2
   doesn't add — could be a Phase 5 if needed).

### Read-only impact

The proposal does not change anything visible to read-only users
(Katy, Mark, Jacob, Randy, Zach). Their `/coverage` view, drawer, and
KPI strip stay identical. No user testing required for the read-only
population.

---

## 8. Recommendation

### Single batch or multiple?

**Two batches.** Phase 1+2 bundle naturally as "admin actions move to
Coverage" — they share the brand drawer + page-level UI plumbing.
Phase 3 ships separately as "delete the old settings page" once 1+2
have proven stable in production. Phase 4 (cosmetic) is genuinely
optional — defer or skip.

### Realistic estimate

- **Batch A (Phase 1+2):** ~1 batch. Mostly drawer + kebab + new
  drawer wiring. Reuses `EditBrandQaConfigDrawer` and existing API
  routes.
- **Batch B (Phase 3):** ~1 batch. Drawer + redirect + deletion.
  Smaller surface but touches more files for the cleanup.
- **Total:** 2 batches. Phase 4 is half a batch of polish and
  shouldn't be force-counted.

### Priority

**Post-demo, Batch 005.** Pre-demo is risky: `BrandDetailDrawer` is
the most-clicked surface in the app, and a mid-week refactor could
regress it on a high-stakes day. The current layout works; it's
suboptimal, not broken.

If the demo goes well and there's appetite to ship admin polish next,
Batch A (Phase 1+2) is the right entry point — it's the part that
actually shortens Lacey's daily clicks.

---

## Appendix — Karen self-review (per spec)

- **Inventory completeness.** Yes: every Coverage-related task and
  every Settings hub card is enumerated, plus the cross-page
  `window.location.href` bleed, the `?brand=<id>` query-param
  contract, the misnamed `ManageMilestonesDialog`, and the hidden
  restore flow.
- **Aesthetic vs grounded.** Phase 1 is grounded in Lacey's stated
  bi-weekly+ frequency (the click-count win is concrete). Phase 2's
  row kebab is partly aesthetic — flagged honestly. Phase 4 is
  cosmetic — flagged as such.
- **Phase independence.** Phase 1 and 2 are genuinely independent.
  Phase 3 depends on 1+2 having shipped (deleting `/settings/coverage`
  assumes its functions live elsewhere) — flagged in Phase 3's
  "Depends on" line.
- **Honest tradeoffs.** Density risk on the brand drawer; coverage
  page state-management risk; row kebab taking horizontal space;
  read-only chrome leak risk. All called out without hedging.
