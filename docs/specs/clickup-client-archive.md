# ClickUp Client Archive · full scope

**Relocated from `CLAUDE.md` §15 on 2026-08-23** by the second extraction pass
(§13 r41 remedy 3 / r42). **This file is live scope authority — it is NOT the
archive, and r40 does not apply to it.** Current sequencing, mode and open
actions stay in CLAUDE.md §15; read those there, not here.

Board rev 8.1: ClickUp Phase 2/3 is sequence **#7** — behind **#5 006 Teams
dispatch**, Jenny-gated.

---

### ClickUp Client Archive — proposed, discovery-first (scoped 2026-07-09)
Sequenced **behind 006**, exact slot TBD. One-time importer producing
**overview-only** records (title / client / brand / date, maybe a url-id) —
**NO** milestones or quality_logs — in an **isolated** table (no FK; must NOT
feed live coverage KPIs); admin-editable; a new "Client Archive" page for
growth / all-time context. **Discovery gate (before any ClickUp fetch):** a
Jira-first read-only key-coverage scan. **AC answered 2026-07-09 (CROSS §6):
there is NO structured Jira custom field carrying a ClickUp ID/URL** — the
ClickUp URL lives in the **Jira issue description**, so the dedup strategy is
**description-regex + fuzzy match**, not an exact custom-field key. Full brief
DRAFTED (v1, 2026-07-10): `docs/HANDOFF-clickup-archive-discovery.md` — supersedes
v0; adds the LOCKED effort/delivery metric model (design/dev/delivered = "ever
reached" Active Design / Active Dev / DCR; total effort = UNION, counted once) +
an isolation amendment (archive PAGE may read a live Jira aggregate; coverage KPIs
never read the archive). **Discovery Step A DONE (2026-07-10):** Jira-first
key-coverage scan across NBLYCRO + SPLCRO + FPOO — 1,232 ClickUp-referencing
tickets, **100% parseable ids**, 1,153 unique (exact-dedup allowlist), so the fuzzy
pile ≈ 0. But Jira only reaches back to 2025-09 (migration window), so it settled
**dedup, not sizing** — the entire pre-2025 history lives only in ClickUp. Next:
Step B (ClickUp sample-Space probe + Step B′ status-history retrievability),
token handled out-of-band, still sequenced behind 006. **FPOO** is a real but
**ARCHIVED** CRO project (no longer an active client; historical data only) —
**in scope** for all-time / Client Archive counts, **excluded** from
active-client and live-coverage views; it carried 268 of the 1,232 Step-A
tickets. Active CRO projects: NBLYCRO · SPLCRO. All CRO projects incl. archived:
NBLYCRO · SPLCRO · FPOO.
**Discovery is COMPLETE; the importer is the open work.** The full discovery
record — Step A/B/B′, the freezer crawl, the corrected scope rules and the
locked headline — is in `docs/claude-archive/CLAUDE-16-2026-07.md` (r42), with
the machine-readable source of truth in `docs/clickup-archive/`.
- **🔒 LOCKED HEADLINE — 14,785 worked-on / 13,858 delivered** (Lacey-confirmed
  2026-07-12). **NOT 15,681** (wrong scope) and **NOT 16,761** (transcribed,
  wrong scope). This is the number that goes to the page.
- **Authoritative scope rules:** `scope_rules_authoritative` in
  `docs/clickup-archive/crawl-manifest-corrected-2026-07-12.json`. Any future
  crawl must reproduce the footprint exactly.
- [ ] **Phase 2 ETL** — reads the committed 1,153-id twin allowlist at
      `docs/clickup-archive/jira-twin-allowlist.json` directly; **no re-scan**
      (it is the recovered 2026-07-10 extraction and is NOT re-derivable from
      today's drifted Jira). Jenny-gated: migration + mutation + new route.
- [ ] **Phase 3** — the Client Archive page. Isolation contract: the page may
      read a live Jira aggregate; **coverage KPIs never read the archive.**
- [ ] **⚠ PRE-DECOMMISSION, IRREVERSIBLE — request the ClickUp workspace export
      while the workspace still exists.** It is the only way to obtain
      **per-task status history**: the API exposes only current status and
      `orderindex`, and `time_in_status` returns 403 on this plan, so the
      freezer crawl **cannot** capture it. Owner-run, non-blocking, not yet
      attempted. **Restored to §15 2026-08-22 (Karen re-review MEDIUM-2)** — the
      clause-3 pass carried it into the archive with its narrative, where §13
      r40 makes it history rather than a live obligation. It is the one item on
      this list with a deadline set by someone else.
- [ ] **Move the gitignored raw crawl** (~464 MB, descriptions + assignee PII)
      to durable storage. It must never be committed.
Both phases stay sequenced behind Batch 006.

