# IMPORTER SPEC — Phase 1: Schema + Migration (FINAL)

**Batch:** ClickUp Client Archive importer · **Type:** one-time extraction
**Gating:** Jenny-gated (migration + mutation + new route) · sequenced behind 006
**Author:** DC + Lacey · **Date:** 2026-07-11
**Pairs with:** `docs/HANDOFF-clickup-archive-discovery.md` (discovery, Step A + Step B final)
**Status:** Phase 1 of 4 (Schema → ETL → Page/live-read → Karen/smoke/push). This
phase is schema + migration only. No ETL, no page, no crawl.

---

## 0. Context (don't re-litigate)

- Discovery is **complete**. Headline: **16,761 worked-on / 15,827 delivered**
  (ideation + pre-work stripped; best-effort orderindex floor accepted, 98.2% self-
  classifying).
- ClickUp is being **decommissioned** → this is a **one-time extraction**, not a sync.
  Extract once, freeze into `client_archive`, never re-crawl. The "and counting" live
  climb comes entirely from Jira, never from re-reading ClickUp.
- Metric model (locked): **effort** = ever reached an Active phase (coarse: LIMBO ∪
  DONE ∪ strategy-CF##); **delivered** = reached a Client Review / DONE-type. Delivered
  ≤ effort always.
- **Isolation contract** is the spine: `client_archive` never feeds live coverage KPIs.

---

## 1. Table: `client_archive`

Isolated table. **No FK into any live table** (`brands` / `projects` /
`test_milestones` / `quality_logs`). The only FK it carries is *internal to the
archive island* (→ `parent_clients`, §2), which does not violate isolation.

### Identity
```
id                uuid pk
source            enum('clickup_import','manual')   -- never 'jira'; Jira is read
                    live as an aggregate, never stored here
clickup_task_id   text
clickup_url       text
```

### Client / brand (two-level: handles parents + singulars)
```
source_list_id    text
source_list_name  text        -- verbatim "CODE - Name" (e.g. "SPL - Spotloan")
client_code       text null   -- parsed: "SPL","DWH","CF","ADM","BRI"...
client_name       text        -- parsed: "Spotloan","David Weekley Homes"...
client_key        text        -- NORMALIZED merge key; how multi-location clients
                    unify ("[Archive] Spotloan" + "SPL - Spotloan" → "spotloan")
parent_client_id  uuid null   -- FK → parent_clients (§2). null = singular client
cqip_brand_ref    text null   -- SOFT name-match to a CQIP brand (NO FK). Resolves
                    active/frozen at READ time. null / no match = frozen client.
```

### Twin fix — dissolves the double-count
```
is_jira_twin      bool default false   -- clickup_task_id ∈ Step-A 1,153 allowlist
```
- **Twins are imported, not excluded** — with `work_date` = ClickUp `date_created`, so
  the growth chart buckets by TRUE work date, not the Sept–Nov 2025 migration artifact.
- **Dedup boundary = the exact-id allowlist, NOT a date cutoff.** The migration ran
  *rolling* Sept→Nov 2025 with genuinely-new Jira work created in the same window, so no
  clean date seam exists. Exact-id is the arbiter (Step A gave 100% exact-key coverage):
  ```
  ALL-TIME TOTAL = archive worked-on (all through-migration tasks, true ClickUp dates)
                 + live Jira aggregate WHERE task id ∉ the 1,153 allowlist
  ```
  A twin is counted **once, in the archive**, with its real date, and excluded from the
  live half **by id** regardless of when it was created. Dates drive the chart; the
  allowlist drives dedup — two separate jobs.

### Metrics
```
is_effort         bool        -- worked on: LIMBO ∪ DONE ∪ strategy-CF##
is_delivered      bool        -- DONE-type (reached a Client Review / past)
work_date         date        -- ClickUp date_created = TRUE work date (§6 discovery)
delivered_date    date null   -- date_done proxy where present
```

### Future-accuracy (nullable; populate ONLY if a ClickUp export lands)
```
reached_design    bool null       -- kept for v2 accurate history; mostly null pre-Jira
reached_design_at date null
reached_dev       bool null
reached_dev_at    date null
reached_dcr       bool null
reached_dcr_at    date null
```
`time_in_status` is plan-gated (403); granular history is only recoverable via an
owner-run ClickUp export (possible but not guaranteed). These columns hold null until/
unless that export materializes; the coarse `is_effort`/`is_delivered` carry the page
regardless. No decision blocked on the export — schema works either way.

### Provenance / review
```
source_status     text        -- raw ClickUp status at extraction
source_orderindex int          -- orderindex used for bucket classification
needs_review      bool default false   -- the 99 unknown-status tasks + fuzzy dedup
imported_at       timestamptz          -- the one-time extraction run
created_at        timestamptz default now()
updated_at        timestamptz default now()
```

### Indexes
```
client_key · parent_client_id · work_date · (is_effort, is_delivered)
· is_jira_twin · needs_review
```

---

## 2. Table: `parent_clients` (controlled parent list)

Replaces free-text `parent_client` so roll-ups aren't typo-fragile, and so a new
parent onboards via an INSERT rather than a migration.

```
id            uuid pk
name          text unique      -- "NBLY", "Sonrava" ...
display_name  text             -- "Neighborly", "Sonrava"
kind          enum('parent','singular')  -- structural hint reused by onboarding
created_at    timestamptz default now()
```

- Known parents at import: **NBLY** (its brand set), **Sonrava** (BRI · DW · WD · PT).
- Singular clients (Spotloan, ADM, DWH, most of the 246-list archive folder) have
  `client_archive.parent_client_id = null`.
- **FK note for Jenny:** `client_archive.parent_client_id → parent_clients.id` is
  *internal to the archive island*. Isolation forbids FKs into **live** tables
  (brands/projects/coverage) — an internal archive→archive FK is permitted and does
  not breach the contract.

---

## 3. Classification rules the migration must encode (applied in Phase 2 ETL)

Recorded here so the schema's columns have defined meaning:
- **NEVER-STARTED / ideation (excluded from worked-on):** open · setup · strategy* ·
  test ideas · experiment plan · creative queue · draft strategy · backlog · dev queue
- **LIMBO (effort; best-effort floor):** creative · qa (creative) [+variant
  `qa(creative)` → Design QA] · needs approval (creative) · development · qa (dev) ·
  needs approval (dev)
- **DONE (effort + delivered):** queued experiments · live · reporting · reporting
  backlog · troubleshooting · implement · completed (won/lost/null) · closed · push
  live · nbly content team · nbly product dev · approval (dev) [→ Dev Client Review]
- **STRATEGY EXCEPTION (title-rule):** `strategy` is pre-work EXCEPT tasks whose title
  carries a test number (`^[A-Z]{2,3}\s?\d+`, e.g. "CF 33", "MLY 34") → worked-on. 216
  matched at discovery (155 Archive · 45 NBLY · 11 Sonrava · 5 CRO Projects).
- **STANDING RULE — unknown status → `needs_review`, never a default bucket.** 99 tasks
  across 11 statuses held out at discovery (incl. `bucket` 73). Done-ish-looking
  variants (complete/wins/losses/null) stayed `needs_review` deliberately.

---

## 4. Isolation contract (Jenny checklist — state in the migration file)

- No FK from `client_archive` into any live table (brands/projects/test_milestones/
  quality_logs). The only FK is internal (→ `parent_clients`).
- Nothing JOINs `client_archive` into coverage / drought / quality-score queries.
- The archive page reads its own table **+ a one-directional live Jira aggregate**
  (archive reads live; coverage never reads archive).
- **A poisoned archive row can never move a live KPI.** This is the guarantee.

---

## 5. Out of scope for Phase 1 (do NOT build here)
- The ETL crawl/classification (Phase 2).
- The page + live Jira aggregate read (Phase 3).
- Any populate of the `reached_*` granular columns (only if an export lands, later).
- Client onboarding process — **separate backlog batch**, not this importer. New
  clients are net-new (no prior archive/Jira history); only returning/paused brands
  carry stored state, already CQIP-side.

---

## 6. Open before Phase 2
- ~~Confirm the 1,153 allowlist is exported/available to the ETL as the twin-match set.~~
  **CLEARED (2026-07-12)** — committed at `docs/clickup-archive/jira-twin-allowlist.json`
  (1,153 unique ids, verified valid; the recovered original 2026-07-10 Step-A extraction).
  Phase 2 ETL reads it directly as the twin-match set; see `docs/clickup-archive/README.md`.
- Multi-location client merge (Spotloan = left-and-returned, confirmed) → `client_key`
  normalization + manual-link fallback for stragglers.
- `cqip_brand_ref` name-match reliability for active-state resolution.
