# ClickUp Archive — twin allowlist (Step-A dedup artifact)

**Status:** ✅ **PRESENT** — `jira-twin-allowlist.json` is committed and verified.
**Pairs with:** `docs/importer-spec-phase1-schema.md` (Phase 1 schema spec, §1 twin fix + §6 open item #1) · `docs/HANDOFF-clickup-archive-discovery.md` (Step A, §5).
**Landed:** 2026-07-12 (regenerated from the original Step-A scan data, provided by Lacey).

---

## What this directory is for

Phase 2 of the ClickUp Client Archive importer dedups migrated tickets by **exact
ClickUp task id** — a ticket that exists in both ClickUp and Jira ("a twin") is counted
**once, in the archive, with its true ClickUp date**, and excluded from the live-Jira
half **by id** (see the Phase 1 spec §1 "Twin fix"). The dedup boundary is the
**id-allowlist, not a date cutoff** — the Sep–Nov 2025 migration ran rolling, overlapping
genuinely-new Jira work, so no clean date seam exists.

That allowlist is the **1,153 unique ClickUp ids** found by the Step-A Jira scan
(2026-07-10). The ETL reads it as the twin-match set.

## The artifact

```
docs/clickup-archive/jira-twin-allowlist.json
```

Flat JSON array of ClickUp task ids as strings:

```json
["1cyfv5h", "1ex6pq2", "863fr8dv7", "868gzkmfe", "..."]
```

**Verified 2026-07-12:** valid JSON array, all elements strings, **1,153 total = 1,153
unique, 0 duplicates** — matches the discovery record (1,232 referencing Jira tickets →
1,153 unique ids; 108 multi-ticket ids). Per-project provenance from Step A: NBLYCRO 930 ·
FPOO 268 · SPLCRO 34.

## Phase 2 contract (still required)

**Phase 2's ETL MUST hard-fail if this file is absent or fails to parse — never default
to an empty allowlist.** An empty array would silently make the ETL treat every ClickUp
task as net-new (zero twins → double-counting the ~1,153 migrated tickets across the
archive + live halves). The guard stays regardless of the file being present today: a
future move/rename/corruption must stop the run, not proceed with zero twins.

## ⚠ Many-to-one is BY DESIGN — dedup on id-membership, not id-uniqueness

The allowlist is built from **any** `app.clickup.com/t/<id>` mention in a Jira
description. NBLY runs **proliferation work**: one ClickUp origin test is shipped to
multiple brands as *separate* Jira tickets, each referencing the same ancestor ClickUp
id. So **one ClickUp id legitimately maps to many Jira tickets** — these sibling tickets
are **distinct work** (different dates / statuses / brands), **not** duplicate migration
copies. This is many-to-one by design.

The only sourced figure for this is the rollup — **108 ids appear on more than one Jira
ticket** (TRANSCRIBED from the discovery record, `HANDOFF §5`; the Jira scan's raw
per-ticket→id mapping is not committed, so this is not re-derivable from repo files). No
per-multiplicity breakdown (how many ids appear on exactly 2 / 3 / 5 tickets) has a
sourced origin — do not quote one.

Consequences for Phase 2:
- **Dedup MUST be id-membership** — "is this ClickUp task id present in the allowlist?" —
  and must **NEVER** assume "each id maps to exactly one Jira ticket." A uniqueness
  assumption would mis-handle the 108 proliferated ids.
- **Any-mention vs primary-link** differs by only **2 ids** — immaterial. Keep the
  conservative **any-mention** rule: over-inclusion in the allowlist can only ever exclude
  a ClickUp card from the live half, never double-count it.

---

## Provenance / how it was produced

The Step-A scan (2026-07-10) was a read-only Jira pass over the three CRO projects that
carry migrated ClickUp history — **NBLYCRO · SPLCRO · FPOO** (FPOO is archived but
in-scope for the all-time archive) — matching tickets whose **Description** free-text
contains a parseable `app.clickup.com/t/<id>` link. There is **no structured Jira custom
field** carrying the ClickUp id (AC-confirmed, CROSS §6); it is description-regex only.

This file is **the original 2026-07-10 Step-A extraction recovered** (the preserved scan
output), **not a fresh re-scan** — which is why it matches the discovery numbers exactly
(1,232 referencing tickets → 1,153 unique ids). Committed here 2026-07-12.

### To regenerate / re-verify (read-only, no writes)

Re-run only if the allowlist is lost again or needs refreshing (new migrations, deleted
tickets):

1. **Scope:** `project IN (NBLYCRO, SPLCRO, FPOO) AND description ~ "clickup.com"`.
2. **Extract** every `app.clickup.com/t/<id>` id from each matched Description.
3. **Dedupe** to the set of unique ClickUp ids.
4. **Expect** ~1,232 referencing tickets → **1,153** unique ids (100% parseable). A
   material drift from 1,153 should be reconciled before Phase 2 trusts the set.
5. **Persist** the unique ids as a flat JSON string array back to this path.

The Atlassian Jira MCP (`searchJiraIssuesUsingJql`) or the repo's Jira client
(`lib/jira/search.ts`) can both run the scan.

---

## Freezer snapshot — the full raw ClickUp crawl (2026-07-12)

A **one-shot freezer crawl** of the CRO-archive source now exists so the data survives
ClickUp decommission. Read-only crawl, same method as the 07-11 Step-B probe
(`GET /list/{id}/task?include_closed=true&subtasks=false`, no status pre-filter, no
bucketing baked into raw), scoped to the four CRO-archive spaces.

| File | Path | Size | Commit? |
|---|---|---|---|
| **Raw** (full task objects — descriptions + assignees + custom_fields) | `docs/clickup-archive/raw/clickup-full-crawl-2026-07-12.jsonl` | ~464 MB | **NO — gitignored (PII). Durable home: restricted SharePoint (see below).** |
| **Metadata** (id·url·name·list·space·folder·status·orderindex·dates — **no PII**) | `docs/clickup-archive/crawl-metadata-2026-07-12.json` | ~16 MB | Lacey's call (large but PII-free) |
| **Manifest** (counts + headline + delta + scope + needs_review dump) | `docs/clickup-archive/crawl-manifest-2026-07-12.json` | ~4 KB | yes |

**Durable home of the raw freezer (post-decommission):** the 464 MB raw `.jsonl` is **not
in git** (PII: descriptions + assignee names/emails). It has been moved to a **restricted,
Lacey-only-access folder in Fusion92 SharePoint (CRO site)**. No link is recorded here by
design — ask Lacey for access. This is the durable copy that survives ClickUp shutdown; the
gitignored working copy in `docs/clickup-archive/raw/` is transient (local only).

Crawl: **36,922 top-level tasks · 337 lists · 545 API calls · 0 errors.** Scope = the 4
CRO-archive spaces (`CRO Projects · Neighborly · Sonrava · CRO Internal Projects`); the
other 5 Fusion92 spaces (SEO, 2× Sandbox, personal, standalone ADM) were **excluded** as
non-CRO-archive (recorded in the manifest `scope` block).

### ✅ CANONICAL & 🔒 LOCKED — corrected footprint (Lacey-confirmed 2026-07-12) → this is the page number

The earlier crawls scanned mismatched scopes; **neither 15,681 nor 16,761 is correct.** This
is the **LOCKED, authoritative footprint** — any future crawl MUST reproduce it exactly (the
`scope_rules_authoritative` block in `crawl-manifest-corrected-2026-07-12.json` is the source
of truth):

| Area | Rule (LOCKED) | Tasks | Worked-on |
|---|---|--:|--:|
| ADM space | **ONLY** `ADM - CRO` (folderless list `901103430868`; excl. ADM-SEO, ADM-Design). NEW crawl. | 207 | 64 |
| CRO Projects | the 4 `hidden`-folder client lists (DWH · FPOO · LF · SPL); **excl. Conversion Fanatics `901103171325` AND both `New Client Template` lists `901100831704`/`901100831691`** | 702 | 450 |
| CRO Internal Projects | **`Client Archive` folder ONLY** (excl. the other 12 folders) | 31,009 | 12,757 |
| Neighborly | all lists | 2,869 | 1,342 |
| Sonrava | all lists | 344 | 172 |
| **TOTAL** | | **35,131** | **14,785** |

**CANONICAL HEADLINE: 14,785 worked-on / 13,858 delivered** (delivered ≤ worked-on ✓).
Buckets: never_started 20,299 · limbo 715 · strategy_cf 212 · done 13,858 · **needs_review
47** (the corrected footprint is clean; the 557 seen earlier was 12 dropped non-CRO folders).
**Distinct clients/brands: 262 client-codes / 267 list surfaces** (worked-on) · 264 / 269
across all tasks.

**Worked-on by year:** 2019 · 1,742 | 2020 · 1,721 | 2021 · 3,276 | 2022 · **3,678 (peak)**
| 2023 · 2,250 | 2024 · 1,364 | 2025 · 753 | 2026 · 1.

**Final scope lock (2026-07-12):** the 2 `New Client Template` lists (53 tasks, all
`never_started`, **0 worked-on**) were **dropped** — headline unchanged (they carried no
worked-on), all-tasks directory count dropped by exactly those 2 list surfaces
(271→269 / 266→264); worked-on directory unchanged. `ADM - CRO` is a **folderless list**
(not a folder) — captured as the single in-scope list. No further refinements open.

**Artifacts:** page source = `crawl-metadata-corrected-2026-07-12.json` (LOCKED footprint,
35,131 rows) + `crawl-manifest-corrected-2026-07-12.json` (headline + by-year + distinct +
`scope_rules_authoritative`). The full-capture `crawl-metadata-2026-07-12.json` (incl. ADM-CRO)
and the gitignored raw `.jsonl` are retained as the complete freezer. **Client Archive
completeness verified:** 248 folder lists live, 245 with tasks, 3 zero-task (complete, not
partial).

---

### Historical — why the earlier scope-mismatched numbers differed (superseded by the corrected footprint above)

Recomputed from the (wrong-scope) full-space crawl: **15,681 worked-on / 14,734 delivered**
→ delta **−1,080 / −1,093** vs the 07-11 prose figures. Diagnosis (sharpened 2026-07-12 by a
scope diff + a count-only `archived=true` probe):

- **Classification logic is verified correct** — **Neighborly (2,869 tasks → 1,342
  worked-on) and Sonrava (344 → 172) reproduce 07-11 EXACTLY.** Not a mapping bug.
- **The two crawls were NOT scoped identically.** 07-11's table counted the **Client
  Archive FOLDER** (246 lists / 34,720 tasks). This 07-12 crawl fanned out over the
  **whole CRO Internal Projects SPACE** = 285 lists across **13 folders**. Comparing
  like-for-like, the **Client Archive folder alone** this crawl = **245 lists / 31,009
  tasks** → a **−3,711** folder-level gap (the 12 extra non-archive folders —
  `Weekly Checklists`, `Client Admin`, `Internal Projects Archive`, etc., ~1,823 tasks —
  masked it down to the misleading −1,888 space-vs-folder figure). CRO Projects: same 5
  client lists hold 824 tasks vs 07-11's 1,039 → **−215**.
- **`needs_review` rose 99 → 557 because of the SPACE-vs-FOLDER scope, not archiving.**
  The extra 12 folders use non-CRO-test workflows (day-of-week kanbans, per-person boards,
  ops/content statuses: `posted to slack`, `archive completed`, `with client`, `active`,
  `upcoming`). Those correctly fell to `needs_review` (never force-bucketed) — good
  behavior, but noise vs the test-effort headline.
- **Archived state is NOT the gap (probed, count-only 2026-07-12).** `archived=true` across
  both spaces = **450 tasks total** — **only 70 in the Client Archive folder** (347 whole
  CRO Internal Projects space; 103 CRO Projects). Adding them: 31,009 + 70 = 31,079, still
  **−3,641** vs 34,720. So a re-crawl with `archived=true` neither closes the gap nor is
  worth it for reconciliation.
- **My crawl did NOT truncate.** Pagination verified: 150 lists exceeded 100 tasks and
  paginated correctly (largest 381/370/359…); the 3 lists at exact-100 multiples were
  probed and have zero tasks beyond the stop. The freezer is complete for its scope.
- **Residual gap = real-world mutation, unverifiable.** With classification, scope,
  archived, and pagination all ruled out, the ~−3,600 like-for-like Client Archive gap is
  most plausibly **the source changing between 07-11 and 07-12** (bulk delete/reorg during
  active decommission) — which **cannot be diffed because 07-11's raw is gone** (the exact
  reason this freezer exists). A secondary possibility is imprecision in the transcribed
  34,720 itself (its raw was never saved). **Do not treat 15,681/14,734 as "the corrected
  headline" nor 16,761/15,827 as ground truth — they are two snapshots ~1 day apart of a
  mutating, being-decommissioned source. This 07-12 raw is now the best available ground
  truth going forward.**

### Status of the 07-11 prose headline
16,761 / 15,827 remains **transcribed-only** in `HANDOFF` + spec §0 and is **still not
reproducible** from any artifact (its own raw was never saved). This 07-12 freezer does
**not** retroactively verify it — it stands beside it with a flagged delta.

**Optional, non-blocking, owner-run:** a ClickUp workspace data export (Settings →
Import/Export) before shutdown could add per-task **status history** (this crawl and the
API only capture *current* status + `orderindex`; `time_in_status` returns 403 on this
plan — `HANDOFF §5` B′). Not required; this pass did the API crawl only and did **not**
attempt the export.
