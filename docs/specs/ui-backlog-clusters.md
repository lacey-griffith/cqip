# UI backlog clusters (no named action at relocation time) · full scope

**Relocated from `CLAUDE.md` §15 on 2026-08-23** by the second extraction pass
(§13 r41 remedy 3 / r42). **This file is live scope authority — it is NOT the
archive, and r40 does not apply to it.** Current sequencing, mode and open
actions stay in CLAUDE.md §15; read those there, not here.

Five §15 subsections that named no action and carried no citation, so under r42
they relocated whole. Each left a one-line pointer in §15.

---

### Login-activity read side (count + heatmap) — backlog (recording LIVE 2026-07-06)
`login_events` recording is **LIVE** — the table + fire-and-forget write
path shipped as Batch login-events (commit `21df742`; plumbing only, see
§16), so real history is accruing now. This backlog item is the **read
side only**: a per-user login count and GitHub-style contribution heatmap
on the admin users page, reading `login_events` (admin-SELECT RLS already
in place). Read-only, no schema change. Open decision (deferred to that
batch, per spec §8): heatmap visibility all-admins vs owner-only. Waits
until enough real history has accrued to be worth rendering.


### Brand Wellness — v1 SHIPPED 2026-07-07 (see §16); v2 deferred
**v1 shipped** as the Brand Wellness report (`components/reports/brand-wellness-report.tsx`
on `/dashboard/reports` + a Reggie-drawer CTA) — a read-only proof of a
brand's real milestone history. Karen post-flight PASS-WITH-FINDINGS; the
one MEDIUM was closed by follow-up commits 3 + 4 (≤28d `brand_jira_value`
fallback scoping so the proof view can't contradict the drought flag in the
rolling-28d window + an Output-table orphan-milestone footer). **v2 remains
deferred:**
- **Rework overlay** — milestones vs sendbacks on one axis.
- **Export/share — downloadable, styled Brand Wellness report:** brand
  multi-select (1 / 2 / 5 / all) feeding a single richly-formatted document
  (likely PDF or branded doc). Builds on existing branded-export infra
  (`downloadBrandedXlsx` / `branded-csv`). Read-only, likely no Jenny; own
  batch. Adjacent to — not the same as — the "multi-brand compare" v2 stub
  (compare = a view; this = a combined export).
- **Multi-brand compare** — a view (distinct from the combined export above).
- **Per-dot "unresolved — not counted" timeline badge** (Karen's suggestion).

(v1 TODO comments in the component mark rework overlay + export/share +
compare.) Note: Batch 005.2
(Coverage Ledger redesign) will re-home the Brand Wellness drawer CTA when
the drawer is rebuilt.




### Admin drawer changes (`brand-admin-drawer.tsx`) (scoped 2026-07-09)
Two items:
- **(a) QA-URL-pattern editor removal — HOLD (was GATED; AC answered
  2026-07-09).** AC confirmed there is **no Forge write path** for the
  preview/live QA-URL config: the Brands API is DC-owned and AC/Forge is
  **read-only**, and the would-be writer (Forge Phase 2d) is **unbuilt**.
  Removing the dashboard editor would therefore **strand the config** (nothing
  else can set it), so **KEEP the editor + column** — this item is on HOLD, not
  a near-term build. Revisit only if/when a Forge write path (Phase 2d) exists.
- **(b) Remove the redundant Filter-by-brand control — SHIPPED with Batch 005.5
  (2026-07-09, see §16)** as the #4 ride-along (`hideBrandFilter` prop on
  `ManageMilestonesDialog`).


### Later / deferred — ledger + coverage (from Lacey's 2026-07-09 review)
- **Resizable ledger columns (#6b)** — a real feature (width state + drag +
  persistence + survive-sort), not polish. Reassess after 005.4's bar-alignment
  fix (#6a) — may be moot.
- **Ledger alert-color palette (#7)** — the segment purples / gray / blue read
  too close to tell apart; Lacey researching a palette → a `globals.css` token
  swap when delivered.
- **Expanded-panel layout (#8/#9)** — Full-detail moved up + equal-height /
  bottom-aligned expanded panel. With **Claude Design**; folds into a ledger
  batch on return.
- **Add-milestone form polish** — with **Claude Design** (admin drawer).
- **Coverage "true all-time incl. pre-Jira" decision** — whether the ClickUp
  archive count bridges onto the coverage page or stays archive-only. Tied to
  ClickUp; parked.


### Dashboard polish cluster + Pipeline sortable columns + rework indicator (scoped 2026-07-03)
Standalone entry — NOT part of Batch 005.2 (different page). Three grouped
items: (1) dashboard polish — KPI hover popovers, stacked issue-category
chart, Recent Activity panel; (2) sortable Pipeline table columns on
`/dashboard/coverage`; (3) a rework indicator that distinguishes
zero-delivery weeks from genuinely quiet weeks.

