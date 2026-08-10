# HANDOFF — AI root-cause classifier, Phase 1

**For:** Claudette (via Lacey) · **Date:** 2026-08-10 · **Author:** DC
**Repo:** `lacey-griffith/cqip` · `cqip.l-hay.workers.dev`
**Gate:** **Jenny pre-flight** — migration + new mutation route. Karen post-flight. Lacey smoke + push.
**Read order:** this doc → `CLAUDE.md` §13 (r3, r29, r37) + §15 via `cqip-shared` → build.

> ## ⚠️ REVISION 2 GOVERNS — read §13 before building
>
> Jenny pre-flight (2026-08-10) returned **DO NOT BUILD YET — 2 CRITICAL, 5 HIGH**. All findings
> are folded into **§13**, which is **normative and supersedes the sections it names**. §1–§12
> are preserved verbatim as the original contract; where §13 supersedes a line, the original is
> left in place so the reasoning that produced it stays auditable — **but §13 wins.**
>
> The two CRITICALs, in one line each, because they change what gets built:
> - **The `Confirm` action as specced would silently destroy human classifications on 58 of 91
>   non-deleted rows** — the same column, direction and invisibility as the defect §13 r37 was
>   written to close two days earlier. §13.1 makes it unconstructable.
> - **§4 and §8 COMMIT 3 demand mutually exclusive behaviour from one route**, so §10 item 3 —
>   named a test, not a comment — cannot be written as specced. §13.2 names the discriminator.

---

## 0. One-line open

A suggester that proposes `root_cause_final` values into a separate AI column,
with its own review-pending flag and a review queue surface. **It never writes
the canonical field.** Phase 1 uses only data CQIP already holds — no Rovo, no
Copilot, no new external integration.

---

## 1. Why it's incoming

Measured 2026-08-10 against the last 30 non-deleted `quality_logs`:

**26 of 30 have never received a human classification entry.** The four that have
are: one 1.5-minute entry, one 3-hour, one 1-day, one 2-day — and the most recent
of those four is a smoke-test edit from the sync-guard batch, not real work.

Consequence: the taxonomy fields are populated on roughly 13% of logs, so every
metric derived from them describes a small, self-selected slice. The gap is not
laziness and not a backlog — the QA tab in Jira is not yet part of team habit, and
that is human behaviour outside the platform's control. Automation is the only
lever available.

**Frame this forward, not backward.** The backlog case is weak — ~66 unclassified
rows is an afternoon of manual work. The case is every log from here on.

---

## 2. The reframe that unparks this

This batch was parked 2026-08-10 for lack of a validation answer key: only ~20
rows had a human-written `root_cause_final`, dropping to ~15 once the five
sync-damaged rows were excluded, and lower still once a second system identity was
found inflating the `system:%` provenance filter.

**The answer key does not need to pre-exist.** The classifier suggests; Lacey
confirms or corrects on rows she was already touching; **the correction rate is
the validation.** It builds its own answer key as it runs, and n grows instead of
being audited toward zero.

That change is what makes the batch viable. Do not reintroduce a
"score-against-history" step — at n≈15 it cannot distinguish a good classifier
from a lucky one.

---

## 3. Phase 1 scope — LOCKED

### The feedstock is already in the database

No external call is needed to start. On four of the five sync-damaged rows,
`resolution_notes` stated the root cause in plain prose:

- "Client requested copy change after development. Client previously approved the design with the same copy."
- "This experiment was approved in February and sat for awhile causing the page to have shifted..."
- "During Dev Client Review it was determined to run other tests before continuing..."

Phase 1 reads, per log: `jira_summary` · `resolution_notes` · `notes` ·
`issue_details` · `trigger_from_status` · `trigger_to_status` · `client_brand` ·
`test_type`.

**Explicitly NOT read:** `root_cause_final` · `root_cause_initial` ·
`ai_suggested_root_cause` · `issue_category` · `issue_subtype` ·
`resolution_type`. See §5 (blinding).

### Writes

- `ai_suggested_root_cause` (exists) — the suggestion, as an array
- `ai_confidence_score` (exists) — model-reported confidence
- **`ai_review_pending`** (NEW, boolean, default false) — the review queue flag

### Does not write

`root_cause_final`, ever. Not behind a confidence threshold, not behind a config
flag. A human confirming in the UI is the only path into the canonical field.

---

## 4. Why a new column and not `needs_review`

`needs_review` clears on **any** save of the row per §13 r29 — the edit itself is
treated as the review decision. Reusing it means: Lacey opens a row to fix
resolution notes, saves, and an unreviewed AI suggestion is now silently
unflagged. The suggestion stays in the column and reads as fact six months later.

`ai_review_pending` clears **only** on an explicit confirm-or-reject action
against the suggestion. Nothing else clears it. A general row save must leave it
untouched — this is a test, not a comment.

---

## 5. Blinding — non-negotiable

The classifier must not receive the existing `root_cause_final` for a row it is
classifying. If it can see the answer, it is copying, not classifying, and the
correction rate becomes meaningless as validation.

Enforce at the query layer, not in the prompt — select only the §3 field list.
A test should assert the payload sent to the model contains none of the excluded
fields.

---

## 6. Scoring is set overlap, not string equality

`root_cause_final` is a Postgres array. A row can legitimately carry multiple
root causes — the restored data includes three-value entries. So a
confirm/correct outcome has four shapes, not two:

```
exact      suggested set == confirmed set
partial    non-empty intersection, sets differ
miss       empty intersection
rejected   human cleared the suggestion entirely
```

Record which shape each review produced. "Match rate" as a single percentage
hides the partials, and the partials are where the classifier is most useful and
most misleading.

---

## 7. Vocabulary constraint

Suggestions must come from the canonical Jira option set for
`root_cause_final` — 13 values per `root-cause-taxonomy-mapping.md` §Field 2.
Verbatim strings, character-for-character, including the spacing quirks in the
live data (`"Unknown/ Needs Investigation"`, `"Late Assets/ Info"`,
`"Unclear/ Conflicting Requirements"`).

Anything the model returns outside that set is dropped and logged, not stored.
Do not add options to the constraint to accommodate model output.

**Related, do not fix here:** taxonomy drift exists in live data —
`issue_category = "Client Request"` is a root-cause value in a category field, and
`"Styling Change Request"` / `"Copy Change Request"` are not among the 29 documented
subtypes. That is a separate audit item in the rev-5 backlog. Read around it; do
not correct it in this batch.

---

## 8. Commits

**COMMIT 1 — migration**
- Add `ai_review_pending boolean NOT NULL DEFAULT false` to `quality_logs`.
- No backfill. Existing `ai_suggested_root_cause` values (if any) stay unflagged;
  confirm the column is currently empty across all rows before assuming this.

**COMMIT 2 — classifier module + route**
- `lib/classifier/` — payload builder (blinded per §5), vocabulary validator
  (§7), response parser (array output).
- One mutation route, admin-only, that classifies a batch of logs and writes the
  three AI columns. Rate-limit or cap batch size; this calls a model per log.
- Writes an `audit_log` row per classified log, `changed_by = 'system:classifier'`
  (matching the `system:` convention — note that sync currently writes
  `log_status` under a *bare* identity, which is a known separate defect; do not
  copy that pattern).
- No cron. Manual trigger only in Phase 1.

**COMMIT 3 — review queue surface**
- A filtered view of logs where `ai_review_pending = true`, showing the
  suggestion, the confidence, and the prose it was derived from side by side.
- Two explicit actions per row: **Confirm** (copies suggestion into
  `root_cause_final`, clears `ai_review_pending`) and **Reject** (clears the
  suggestion and the flag, leaves `root_cause_final` untouched).
- Correcting rather than confirming: the existing constrained edit dialog handles
  it; the flag clears on that path too, and the outcome shape (§6) is recorded.
- A general row save elsewhere in the app must NOT clear `ai_review_pending`.

**COMMIT 4 — Karen fold** (per the pattern every batch in §16 follows)

---

## 9. Out of scope Phase 1 — do NOT build

- **Rovo integration.** Phase 2. It buys access to Jira comments and description
  bodies that CQIP does not currently sync. Worth having, not needed to start,
  and it adds an auth scope and an external dependency to a batch that otherwise
  has neither.
- **Copilot / Teams context.** Phase 3, and human-relayed by construction —
  Copilot has no write path into CQIP.
- **Auto-confirm above a confidence threshold.** This is the G5a failure mode
  with a number attached to it.
- **Cron scheduling.** Manual trigger until the correction rate is known.
- **Classifying `issue_category` / `issue_subtype` / `resolution_type`.** One
  field first. The taxonomy drift in §7 makes the others riskier.

---

## 10. Verification

- Blinded payload contains no excluded field (test asserts on the outgoing object).
- Out-of-vocabulary model output is dropped and logged, not stored.
- `ai_review_pending` survives a general row save; clears only on confirm/reject.
- Confirm copies the suggestion verbatim into `root_cause_final`.
- Reject leaves `root_cause_final` untouched.
- An `audit_log` row exists per classified log.
- Multi-value suggestions round-trip as arrays, not comma strings — the audit
  trail already contains one legacy bare-comma write (`Client Request, Design/Visual`);
  do not reproduce that shape.

---

## 11. Open questions for Lacey — answer before Jenny

1. **Which model, and where does the call originate?** Worker route or Supabase
   edge function. The sync lives in an edge function; the admin routes live in the
   Worker. Different secret surfaces.
2. **Confidence scale.** Model-reported number, or a derived band (high/med/low)?
   A raw float invites a threshold, and a threshold invites auto-confirm.
3. **Batch size cap** on the manual trigger.
4. **Does the review queue live under Reports, or on the logs page as a filter?**
   The logs page is already getting a render-only batch — check for collision
   before building.

---

## 12. Sequencing note

This sits **behind QMS Rec 1** in the rev-5 outline. Rec 1 is nearly free and
measures a different exposure (ticket-lag on delivery metrics, not taxonomy
coverage). It also stays mandatory under the locked Q1 = provability-to-client.

Rec 1's ~30-ticket hand pass may double as an independent check on the
classifier — **but not as the classifier's own evidence.** If the classifier
supplies Rec 1's numbers, the check is satisfiable by the artifact that produced
the value, which violates S5.

---

*Do not push. Report back → Karen.*

---

# 13. REVISION 2 — Jenny pre-flight folds (NORMATIVE)

**Status:** Jenny pre-flight 2026-08-10, verdict DO-NOT-BUILD-YET (2 CRITICAL · 5 HIGH · 4 MEDIUM
· 5 LOW). All folded here **before** the build opened, per the `CLAUDE.md` §15 PROCESS note. This
section supersedes the sections it names. Every production figure below was probed read-only and
is stamped, because §16 records repeatedly that an unstamped measurement rots inside a session.

**Measured against production 2026-08-10** (`quality_logs`, 122 rows, 91 non-deleted):

| fact | value |
|---|---|
| `root_cause_final` **non-empty** | **58 / 91** — the CRITICAL-1 population |
| `root_cause_final` empty `{}` | 27 |
| `root_cause_final` NULL | 6 |
| multi-value (>1) / three-value | 13 / 2 |
| `ai_suggested_root_cause` non-null | **0 / 122** — §8 COMMIT 1's precondition, CONFIRMED |
| `ai_confidence_score` non-null | 0 / 122 |
| active `root_cause` taxonomy rows | **14** (not 13 — see §13.3) |
| rows with zero prose feedstock | **0 / 91** |
| `audit_log` total | **1,597** |
| `audit_log` `action='AI_SUGGESTION'` | **0** — the verb is free |

> Two figures in Jenny's report were measured against a **silently truncated** read and are
> corrected here: `audit_log` is **1,597** rows (she wrote 1,557, which was 08-08's reading), and
> bare-`system` audit rows number **149** (she wrote 141). PostgREST caps an unranged select at
> 1,000 with no error — my own first pass hit it too, and only a `count: 'exact', head: true`
> probe plus a paged read caught it. The §15 unranged-select lesson applies to *verification
> queries*, not just app code.

---

## 13.1 CRITICAL-1 — `Confirm` must not be able to destroy an existing `root_cause_final`

**Supersedes §8 COMMIT 3's `Confirm` description.**

§3 blinds the classifier from `root_cause_final`, so it cannot know a value is there. §8 COMMIT 3
lists what the queue renders — suggestion, confidence, source prose — and the **existing value is
not in that list**, so the reviewer cannot see it either. `Confirm` then copies over it with no
precondition and no old-value capture. That is the same column, the same direction and the same
invisibility as the defect §13 r37 exists to close: *"the trail showed the human's write and
nothing after it, which reads as 'the value is still there.'"*

**Adopted: Jenny's option (a) — exclude at selection — plus two defence-in-depth measures**, because
selection alone is a snapshot and r37 states that a **non-empty** Jira value still wins on sync, so
a row can gain a value between classify and confirm (Jenny LOW-5):

1. **Selection excludes non-empty** (see §13.6). Makes the common case unconstructable.
2. **The confirm route re-checks at write time** and refuses with 409 if `root_cause_final` is
   non-empty, naming the edit dialog as the correct path. Closes the sync-moved-it window.
3. **The queue renders the current `root_cause_final`** — read at render time, never snapshotted —
   and the audit row's `old_value` carries whatever was there.

This also *raises* the batch's value rather than narrowing it: **33 rows** are eligible, and they
are exactly the unclassified population §1 says the batch exists for. At the §11.3 cap of 25 that
drains in **two runs**.

> **The line §2 vs §13.1 will otherwise blur, drawn explicitly:** showing a human the existing
> value so she does not destroy it is a **data-safety affordance**. Computing an automated
> agreement score against the 58 pre-existing values is the **score-against-history step §2
> forbids** — at n≈58 it cannot distinguish a good classifier from a lucky one. Render the value;
> never grade against it.

## 13.2 CRITICAL-2 — the discriminator between "general save" and "review action"

**Supersedes §8 COMMIT 3's "the existing constrained edit dialog handles it; the flag clears on
that path too."**

There is exactly **one** edit surface, `POST /api/logs/edit`, and a general save and a correction
arrive as byte-identical requests. So §4's requirement and §8 COMMIT 3's sentence cannot both hold,
and §10 item 3 is unwritable as specced.

**Adopted: Jenny's option (i) — a separate route.**

- **`POST /api/logs/ai-review`** owns all three outcomes: `confirm`, `reject`, `correct`. It is the
  only writer of `ai_review_pending = false`.
- **`/api/logs/edit` never touches `ai_review_pending`**, and the column is **NOT** added to
  `ALLOWED_FIELDS`, so no generic client payload can set or clear it. A row edited through the
  normal dialog therefore stays pending — which is exactly §4's requirement, now by construction.
- **Do not copy `route.ts:146-153`.** That is the implicit clear-if-set pattern for `needs_review`,
  and it is the established local convention, which is precisely why copying it is the path of
  least resistance and would reproduce the defect §4 was written to prevent.
- `correct` carries the corrected array and is **re-validated against the taxonomy** (§13.5).

**Deviation from §8 recorded plainly:** the edit dialog is no longer the correction path in Phase 1.
It remains available for ordinary edits; it simply does not resolve an AI review.

## 13.3 HIGH-1 — the vocabulary is read from the database, and no number is written down

**Supersedes §7's "13 values".**

§7 cites `docs/root-cause-taxonomy-mapping.md` §Field 2 for "13". **That document says 14**
(`:133`, "Canonical Jira options (14, …)"), migration 020 seeds 14 and asserts `root_cause=14`, and
prod has 14 active. Building to 13 would drop one legitimate canonical value as OOV with no
principled way to choose which.

**The number is deleted, not corrected.** The vocabulary is read at request time from
`quality_log_taxonomy WHERE field_name = 'root_cause' AND is_active = true`. This satisfies §13 r29
by construction, keeps the classifier aligned with the edit route's validator
(`app/api/logs/edit/route.ts:90-137`, which does exactly this lookup), and makes the question moot
when Lacey adds a 15th option. §7's three spacing-quirk examples stay as illustration only.

> **Trap, stated because it fails silently:** the taxonomy `field_name` is **`root_cause`**, not
> `root_cause_final` — one Jira field (`customfield_12905`) backs both columns, and
> `route.ts:43` maps `root_cause_final → 'root_cause'`. Querying the column name yields an **empty
> vocabulary and a 100% OOV drop rate**, which reads as a model failure rather than a bug.

## 13.4 HIGH-2 — confidence is a CHECK-constrained TEXT band; the migration is TWO columns

**Supersedes §3's "Writes" list and §8 COMMIT 1's single-column migration.**

`ai_confidence_score` is `NUMERIC` (`001_initial_schema.sql:54`) and cannot hold `'high'`. Encoding
the band as `1/2/3` recreates the orderable number §11.2 exists to eliminate, after which §9's
named failure mode is one `ORDER BY` away.

- **Add `ai_confidence_band TEXT`** with `CHECK (ai_confidence_band IS NULL OR ai_confidence_band
  IN ('high','medium','low'))`.
- **`ai_confidence_score` is struck from the write list** and stays unwritten and unused in Phase 1.
  Its emptiness is intentional, not a bug.
- **`'medium'`, spelled out** — §11.2 said "med" colloquially; the CHECK is the contract and
  abbreviating one of three costs a migration later.
- **The migration is two columns.** §5's gate header and §8 COMMIT 1 both said one; this is the
  correction, recorded so Karen's post-flight does not read it as scope creep.

## 13.5 HIGH-3 + r29 — the `audit_log` shapes, and the confirm path re-validates

**Fills the gap in §6/§8 COMMIT 3, which required recording the outcome shape but named no home.**

`audit_log` is sufficient — **no schema change.** Verified against the constraints as they exist:
`action='AI_SUGGESTION'` is already in the `001:70-72` CHECK with **0 rows in prod**, and
`target_type='quality_log'` + non-null `log_entry_id` satisfies `audit_log_target_shape_chk` as
last redefined in `025_monitoring_findings.sql:112-118`.

| | classifier suggestion | review outcome |
|---|---|---|
| `action` | `AI_SUGGESTION` | `UPDATE` |
| `field_name` | `ai_suggested_root_cause` | `ai_review_outcome` |
| `old_value` | `null` | **the pre-existing `root_cause_final`** |
| `new_value` | the suggested set, JSON | `exact` \| `partial` \| `miss` \| `rejected` |
| `changed_by` | `system:root-cause-classifier` | server-derived via `getChangedBy()` |

`new_value` on the outcome row is deliberately a bare literal so it is directly `GROUP BY`-able —
prose in `notes` is not, and "the correction rate is the validation" (§2) needs the aggregate.

**Follow the sync's row shape, not the edit route's:** `jira-sync` sets `log_entry_id` +
`target_type` + `target_id` (`:315-318`); `app/api/logs/edit/route.ts:174-181` omits `target_type`,
which passes only via three-valued logic and is the source of the NULL-`target_type` rows Batch
004.9 tried to clean up.

**r29 — the confirm path re-validates against the taxonomy** rather than trusting the stored
suggestion, for three independent reasons: r29 is unconditional ("every write surface"); the
suggestion is validated at classify time and confirmed possibly days later, and a taxonomy row can
be deactivated in between (`is_active` exists for exactly that); and a model-originated value read
back out of a column is not a trusted input. **Reuse the edit route's validator — one validator,
two callers, so it cannot drift.**

## 13.6 HIGH-4 — selection predicate and idempotency

**Fills the gap in §8 COMMIT 2, which said only "classifies a batch of logs".**

```
WHERE is_deleted = false
  AND ai_review_pending = false          -- never clobber pending review state
  AND ai_suggested_root_cause IS NULL    -- never re-suggest
  AND (root_cause_final IS NULL OR root_cause_final = '{}')   -- §13.1
ORDER BY triggered_at DESC
LIMIT 25
```

Two consecutive runs must not re-classify a row. Zero eligible rows returns a **count, not an
error**. Eligible today: **33**, draining in two runs.

## 13.7 HIGH-5 — no credential exists; the route ships inert

**Fills the half of §11.1 that was not answered.**

Verified: no AI SDK in `package.json`, no `ANTHROPIC_*` in `.env.local` or `.env.example`, no `ant`
CLI, and **none of the 16 Worker secrets** is a model key. So commit 2 cannot call a model when it
lands.

- **Route answers `500 not_configured` until the secret exists** — deployable and inert, exactly
  the Batch telemetry-ac precedent.
- **Model: `claude-opus-5`**, as a single named constant, never a literal at the call site. A
  classifier whose model changes silently makes the correction rate a moving target — the §15
  shared-ancestor shape applied to validation.
- **Plain `fetch`, no new dependency.** Every external call here already works that way
  (`lib/sharepoint/graph-client.ts`, `lib/jira/search.ts`); adding an SDK changes the Worker bundle
  for one endpoint. "Add the SDK" is the default assumption and it is the wrong one.
- **Secret `CQIP_ANTHROPIC_API_KEY`**, documented in §4 + `.env.example`, **Worker-only** rotation
  surface (one surface, per r27).
- **Read env inside the handler, never at module scope** — `lib/jira/client.ts` throws at import
  and CLAUDE.md §3 warns about it; `lib/jira/search.ts` is the pattern.

## 13.8 MEDIUMs and LOWs, folded

- **MEDIUM-1 — `/dashboard/reports` has no admin gate.** `middleware.ts:71-72` gates
  `/dashboard/settings/*` only; the reports page has no `isAdmin` state at all. Confirm/reject are
  admin-only, **enforced server-side** (r6), with the affordance gated client-side. Per the Batch
  012 Pulse precedent, non-admins get a plain **inert element, never a disabled button**. Placement
  follows `BrandWellnessReport` — a self-contained card outside the `ReportKind` union, which is
  the established template for §11.4's answer.
- **MEDIUM-2 — §1 and §2's figures are not reproducible and are struck.** §1's "roughly 13%" does
  not reconcile with 58/91 = 64% non-empty; §2's "~20 rows" does not reconcile with **54**
  human-attributed `root_cause_final` audit writes (41 `lacey@cqip.local` + 7 `l.hay@fusion92.com`
  + 6 `Lacey`; plus 35 from `system:normalize-quality-log-fields`). They may hold under a narrower
  definition, but the definition is unstated, so they are unfalsifiable premises in a doc CLAUDE.md
  §0 tells future sessions to trust. **§1's forward-looking case stands on its own and does not
  need them** — and the measured 33-unclassified figure is a stronger justification anyway.
- **MEDIUM-3 — §4's wording.** `needs_review` clears on any save **through the single edit route**
  (`route.ts:146-153`), and only when already true; sync and webhook never touch it. The precision
  matters because §13.2's fix depends on there being exactly one such route.
- **MEDIUM-4 — r19/r20.** Confirm/reject/correct are human-triggered and derive `changed_by`
  server-side via `getChangedBy()` on the cookie-bound client (r19). The classifier's identity is
  renamed **`system:root-cause-classifier`** to match `system:jira-sync` /
  `system:drought-evaluator` / `system:normalize-quality-log-fields`; `system:classifier` is
  thinner than any existing identity. r20 is scoped to *cron* writers and this is manual-trigger —
  still correct here, because there is no meaningful `auth.uid()` attribution for a machine
  classification even with a human on the button; the triggering admin's email goes in `notes`.
- **LOW-1 — `CLAUDE.md` §14 lists "AI root cause classification" as NOT in scope for V1.** Must be
  updated in the same commit (r23), plus a §15.5 in-flight entry (r34).
- **LOW-3 — the AI columns are declared but no JSX consumes them.** So §4's "reads as fact six
  months later" is not a live path today. If COMMIT 3 surfaces the suggestion on the detail page it
  must be **visibly labelled unconfirmed** while `ai_review_pending` is true.
- **LOW-4 — bare `system` is written by the sync AND the webhook** (`jira-webhook:570`), **149**
  rows. Consequence worth keeping: any provenance filter using `system:%` **misses all 149**.
- **§12's citations do not resolve.** `QMS Rec 1`, `rev-5 outline`, `S5` and `G5a` appear nowhere in
  the repo. This is the out-of-repo-authority pattern §15 records twice. **Nothing in commits 1–4
  may depend on any of them**; §12 governs sequencing only.

## 13.9 Blinding — the structure that makes §5 testable

§5's query-layer placement is correct and survives review unchanged. Two conditions make the test
strong rather than nominal:

1. **The payload builder is a pure exported function** — `buildClassifierPayload(row) → object` in
   `lib/classifier/`. Assembled inline in the handler, the test could only assert on a
   reconstruction, and reference and value would share an ancestor — the §15 failure recorded four
   times.
2. **Assert the payload's key set is exactly the eight §3 fields** — a whitelist, not a denylist of
   the six excluded names. A denylist passes forever as new columns arrive; a whitelist fails when
   a *seventh* field appears.

**The real hole:** if the route `select('*')` for any reason, a full row sits one variable away
from the payload and `JSON.stringify(row)` into a prompt is an easy accident. So the route's own
select is **narrowed to the eight fields plus `id`**. The payload test catches the mistake; the
narrow select makes it hard to make.

**Acknowledged, not a defect:** `notes` / `resolution_notes` are read and can contain a root-cause
string verbatim — that *is* the feedstock (§3's three quoted examples are exactly this). Recorded so
nobody later "fixes" the blinding by stripping the prose the classifier runs on. `root_cause_initial`
is a r3 snapshot of the same Jira field and **is** the answer on many rows; §3 correctly excludes it.

## 13.10 §10 verification — six additions

§10's seven items stand, with item 3 unwritable until §13.2 and items 4/6 strengthened. Added:

1. **The classifier never writes `root_cause_final`** — the #1 non-negotiable had **no item at
   all**. Assert the classify route's update object contains only the three AI columns.
2. **Confirm cannot silently overwrite a non-empty `root_cause_final`** (§13.1).
3. **The route returns 500 `not_configured` with no key** — the only item testable before a key
   exists.
4. **The band is one of three literals and the raw model number is never persisted** (§13.4).
5. **Selection is idempotent** — two consecutive runs do not re-classify a row (§13.6).
6. **Confirm/reject are admin-only, enforced server-side** (§13.8).

Item 6 is upgraded from existence-only to **shape**: `action`, `field_name`, `changed_by`,
`target_type`. §16's telemetry-ac entry records four mutations that stayed invisible until
full-string assertions were forced.

**Mutation pass required:** delete the `ai_review_pending` guard (a test must fail); widen the
vocabulary lookup to all `field_name`s (OOV tests must fail); drop one field from the payload
whitelist (the whitelist test must fail).

## 13.11 §9 — the accidental paths, ranked

1. **Auto-confirm.** The accidental path *is* §13.4: a sortable number, then a filter, then a
   "Confirm all high" button. The CHECK-constrained TEXT band is the structural prevention.
   **Corollary now binding: no bulk or select-all action on the review queue.** Bulk confirm is
   auto-confirm with a human's finger resting on it.
2. **Classifying the other three fields.** The accidental path is a *generic* `classify(field)`
   abstraction — the natural, "good" design, one config line from doing all four. **`root_cause` is
   hardcoded in Phase 1.** §9's own reasoning (the §7 taxonomy drift) applies only to the other
   three, so the generic version is strictly more dangerous.
3. **Cron.** Manual-trigger only; the accidental path is adding it to an existing pg_cron job or to
   `deploy.yml`. No new shared secret beyond §13.7's, so no r27 rotation burden.
4. **Score-against-history.** See the boxed line in §13.1.
5. Rovo / Copilot — no accidental path; genuinely out of reach without new auth scopes.
