# Batch sync-guard — skip-if-empty guard + sync audit rows

**Status:** SPEC rev 2 — Jenny pre-flight APPROVE-WITH-FINDINGS, all findings folded below
(2 HIGH, 6 MEDIUM, 7 LOW). Committed as commit 1 **before** the build opens, per the
CLAUDE.md §15 PROCESS note.
**Date:** 2026-08-08
**Gate profile:** behaviour change to an existing production write path; failure mode is
silent data loss. No migration, no schema change, no new route. **Jenny pre-flight: YES**
(done). Karen post-flight after build.

---

## 0. Done-definition

1. A `quality_logs` row holding a human-entered value survives a sync pass in which the
   corresponding Jira QA-tab field is empty.
2. A non-empty incoming Jira value still overwrites, exactly as today.
3. A row with no existing value and an empty incoming value stays empty — no write, no
   audit row, no regression.
4. Every sync-originated change to a **guarded** field writes an `audit_log` row. (Not
   every written column — see §4.6, which records the residual §13 r2 gap rather than
   implying it is closed.)
5. Gates, stated honestly because two of the three cannot do what a naive reading implies
   (Jenny MEDIUM-2):
   - **`tsc --noEmit`** — covers `lib/sync/sync-field-guard.ts` **only**. `tsconfig.json:33`
     excludes `supabase/functions`, so the edge function is *never* type-checked. Do not
     report tsc as evidence the deployed file is sound.
   - **ESLint — zero *new* findings on touched files.** "Clean" is unachievable:
     `jira-sync/index.ts` carries a **baseline of 8 errors + 1 warning** (`no-explicit-any`
     at 72×2, 129, 130, 142, 143, 144, 151; unused `anonKey` at 12). Baseline captured
     2026-08-08; assert the delta, not absence. (Rev 1 added "four of those sit on the exact
     lines this batch edits" — **false**, Karen LOW-1: the first hunk starts at old line 157
     and `mapJiraFields` is untouched, so every baseline finding precedes the diff. The gate
     result is unaffected; the claim overstated entanglement.)
   - **Test suite green**, including the drift test — which per §5 is the *only* gate that
     reaches the deployed code path at all.

---

## 1. The defect

`supabase/functions/jira-sync/index.ts`.

`mapJiraFields()` coerces every absent Jira field to an empty value:

```ts
mapped.who_owns_fix     = whoOwnsFix?.child?.value ?? whoOwnsFix?.value ?? null; // 133
mapped.issue_category   = fields[...]?.map(...) ?? [];   // 142
mapped.issue_subtype    = fields[...]?.map(...) ?? [];   // 143
mapped.resolution_type  = fields[...]?.map(...) ?? [];   // 144
mapped.severity         = fields[...]?.value    ?? null; // 147
mapped.root_cause_final = fields[...]?.map(...) ?? [];   // 151
```

`updateData` (447–464) then writes all of them **unconditionally** (update at 466). So when
the Jira QA tab is empty, the sync writes `[]` / `null` over whatever a human entered in
CQIP.

The Jira QA tab is empty for most synced tickets *by design*: the Jira-side automation
("Clear QA Fields On Transition", CLAUDE.md §6) clears all QA fields on entry to `Dev QA`
or `Dev Client Review`. **The empty-overwrite is the normal path, not an edge case.**

### Why it went unnoticed since 2026-05-26

The sync writes these fields with **no `audit_log` row**. Its only audit row is the
auto-advance `STATUS_CHANGE` (482–494). The clear left no trace: the trail shows the human's
write and nothing after it, which reads as "the value is still there."

---

## 2. Evidence (probed read-only against production, 2026-08-08)

Five rows, all `is_deleted=false`, all with `updated_at` in the `2026-08-08T12:00:0*Z`
window — consecutive seconds, i.e. one pass of the sync loop:

| row | ticket | status | human write |
|---|---|---|---|
| `b77c1d57` | NBLYCRO-1380 | Blocked | 2026-05-26 |
| `a6111337` | NBLYCRO-1432 | Blocked | 2026-06-05 |
| `a57c357c` | NBLYCRO-1137 | Pending Verification | 2026-06-15 |
| `bf5fc1d7` | NBLYCRO-178 | Pending Verification | 2026-06-23 |
| `67079106` | NBLYCRO-1087 | Pending Verification | 2026-06-05 |

All five now hold `[]` on all four sync-written taxonomy columns and `NULL` on `severity` +
`who_owns_fix`. Each has an `audit_log` row proving the prior human value (e.g. `b77c1d57`
`root_cause_final` `[]` → `["Unclear/ Conflicting Requirements"]` by `lacey@cqip.local`).
**No audit row records the clear.**

`audit_log` held **1,557 rows at 2026-08-08**. (CLAUDE.md §16 records 1,438 on 2026-08-03 —
this is a newer reading, not a contradiction. Stamped per the §15 lesson that an unstamped
prod measurement rots inside a work session.)

### 2.1 Three corrections to the reported scope

Stated because the brief's field list was written before this evidence existed.

**(a) `root_cause_initial` was NOT blanked by the sync — it was never set.**
It does not appear in the sync's `updateData` at all. It is written in exactly one place,
`jira-webhook/index.ts:541`, at log creation (§13 r3, frozen snapshot), and the edit route
excludes it (enforced by `ALLOWED_FIELDS`, `app/api/logs/edit/route.ts:25–35`; the comment
at :38 describes that mechanism, it is not the mechanism). Across the whole `audit_log` the
**only** writer of a `root_cause_initial` audit row is `system:normalize-quality-log-fields`
(36 rows) — never a human, never the sync.

It reads `[]` on those five rows because it has been `[]` since creation: the same
Jira-automation clearing described in §1 means the QA tab is empty at sendback time, so the
r3 "snapshot" captures nothing. Measured: **74 of 83** webhook-created logs have an empty
`root_cause_initial`, versus **0 of 38** CSV-imported logs.

> Real finding, **not this batch's to fix.** §13 r3's root-cause snapshot is structurally a
> no-op for webhook-created logs. Filed to §15 — changing it means changing *when* the
> snapshot is taken, a Jira-workflow decision, not a guard.

**(b) The confirmed loss is 5 rows, not 6.** A first sweep flagged a sixth (`f44754df` /
NBLYCRO-1239). Its timeline disproves it: on 2026-05-01T18:01:09 the row shows
`root_cause_final old="" new=null` **by `lacey@cqip.local`** — a human clear, correctly
audited. It is also `Resolved`, hence outside the sync's working set. The brief's count of 5
is right; my first sweep's heuristic over-counted.

**(c) There is no pending loss.** All 33 rows currently in the sync working set are already
empty on all seven guarded fields (re-measured after the widening: 0 working-set rows
carry a non-empty `root_cause_description` either). Nothing further is at risk on the next
run. The guard
protects **future** human entries; recovery of the 5 damaged rows is a separate decision
(§6.1).

### 2.2 Scope extension (decided by Lacey, 2026-08-08)

`severity` and `who_owns_fix` are lost by the identical mechanism on the identical five rows
— 10 further confirmed field losses (`severity` `"Low"`/`"Medium"` → `NULL`, `who_owns_fix`
`"VN Team"`/`"CRO Dev"` → `NULL`). Both are human-editable via `/api/logs/edit`
`ALLOWED_FIELDS`. The brief scoped the fix to taxonomy fields only; shown this evidence,
Lacey extended it.

**Guarded set is therefore six fields, not four** — and became **seven** after Karen
post-flight MEDIUM-2 added `root_cause_description` (§3.2).

---

## 3. Commit 1 — skip-if-empty guard

### 3.1 Semantics

For each guarded field, if the incoming Jira value is *empty*, **omit the key from
`updateData` entirely** — do not write `null`, do not write `[]`, omit. Non-empty incoming
values overwrite as today.

"Empty" means `null` / `undefined`, an array of length 0, or an empty/whitespace-only
string. Scalars are trimmed **for the emptiness test only** — a non-empty value is stored
verbatim, so no stored value changes shape.

### 3.2 Guarded fields (7)

| field | type | why guarded |
|---|---|---|
| `issue_category` | `TEXT[]` | taxonomy, human-editable |
| `issue_subtype` | `TEXT[]` | taxonomy, human-editable |
| `root_cause_final` | `TEXT[]` | taxonomy, human-editable |
| `resolution_type` | `TEXT[]` | taxonomy, human-editable |
| `severity` | `TEXT` | human-editable (§2.2) |
| `who_owns_fix` | `TEXT` | human-editable (§2.2) |
| `root_cause_description` | `TEXT` | human-**authored**, not editable (§3.3 correction) |

### 3.3 Explicitly NOT guarded (9) — and why the set is provably complete

`jira_summary`, `client_brand`, `detected_by`, `reproducibility`, `experiment_paused`,
`preventable`, `documentation_updated`, `process_improvement_needed`, `updated_at`.

**`updateData` has exactly 16 keys. 7 guarded + 9 unguarded = 16.** This is a complete
partition of what the sync writes, not a sample — which converts "did I miss a field?" from
a judgement call into a checkable claim (Jenny §2).

The decision rule is **"can this column hold human work the sync can destroy"**, which has
two sources: `ALLOWED_FIELDS ∩ updateData` yields the six human-EDITABLE columns, and
`root_cause_description` is added because it is human-**authored** via the CSV import even
though it is not editable (see the correction below).
`log_status`, `resolution_notes` and `notes` are human-editable but absent from `updateData`
(`log_status` is written only by the separate, already-audited auto-advance block at
477–480). No other automated writer touches these columns: only `jira-sync` (recurring) and
`jira-webhook` (creation only); everything else is a one-shot script.

`client_brand` in particular **must** keep writing unconditionally — §13 r28 depends on it.
The four booleans are genuine `false`, not absent, and `false` is not "empty". `updated_at`
being unguarded also means `updateData` can never become empty, so there is no degenerate
zero-column update.

> **CORRECTION (Karen post-flight MEDIUM-2).** Rev 1 of this section claimed *"nothing
> unguarded can hold a human-entered value to protect."* **That is false.** **32 non-deleted
> rows hold human-authored prose in `root_cause_description`**, imported from the CSV's
> "Issue Details" column (§11) — e.g. `92111cdb` / NBLYCRO-101, *"Images provided by client
> are low quality and grainy…"*. All 38 CSV-imported rows are `Resolved`, and that status is
> the **only** thing keeping them out of the sync's working set. `log_status` **is** in
> `ALLOWED_FIELDS`, so an admin reopening a resolved log — a supported action, and one the
> `f44754df` audit trail shows Lacey performing in both directions — pulls the row in. The
> next sync then writes `root_cause_description: null` (probed: all working-set tickets
> return `null` for `customfield_12909`), **unguarded and therefore unaudited**: silent, and
> identical in shape to the defect this batch fixes.
>
> **RESOLVED, by widening the guard rather than only fixing the prose (Lacey,
> 2026-08-09).** Karen's recommendation was a documentation correction; Lacey chose the
> stronger fix. `root_cause_description` is now guarded, so an empty
> `customfield_12909` can no longer null that prose, and — because the guarded set is also
> the audited set — any real change to it now writes an `audit_log` row where previously
> there was none.
>
> **This means the decision rule changed, and that is the durable part.** It was
> `ALLOWED_FIELDS ∩ updateData` — *"can a human edit this in CQIP"*. Editability turned out
> to be a **proxy** for the thing actually being protected, and an incomplete one: this
> column is not editable and holds real human work anyway. The rule is now *"can this column
> hold human work the sync can destroy"*, which has two sources — editable (six) and
> authored-by-import (one). Anyone adding a column to `updateData` must apply the second
> test too, not just check `ALLOWED_FIELDS`.

> `root_cause_description` is the one judgement call: Jira-sourced free text, not
> human-editable in CQIP, so it stays unguarded per the brief's "do not change behaviour for
> non-taxonomy fields." See §6.3 and §4.5 — it carries a separate latent hazard.

### 3.4 What this does NOT do — and the residual divergence

Keeping both values and flagging misalignment is a **separate gated batch**. This guard
simply declines to overwrite.

Two honest limits:

- **The guard protects the empty case only.** If Jira holds a *non-empty* value and a human
  changes that field in CQIP, the sync still reverts the human on the next pass — most
  plausibly on `severity`. This is unchanged by the batch. It is rare in practice *because*
  the Jira automation clears QA fields (§1), which is exactly why the empty case dominates;
  but "protects human values" would over-promise, so it is stated.
- **CQIP↔Jira divergence is the accepted end state**, not a bug to fix later, because §13 r5
  forbids writes to Jira. The otherwise-obvious fix — push the CQIP value back to Jira — is
  rule-prohibited.

Also unchanged (§13 r29): the sync writes taxonomy values with **no**
`quality_log_taxonomy` validation, while the edit route validates every one
(`route.ts:86–137`). Post-guard, a non-empty Jira value still overwrites a validated human
value with an unvalidated one. r29 says "constrained at every write surface"; this batch
deliberately leaves that alone — noted in §6.7 rather than silently inherited.

---

## 4. Commit 2 — audit rows on sync writes

### 4.1 Semantics

After a **successful** `quality_logs` update, emit one `audit_log` row per **guarded** field
whose value actually changed. No change → no row (a quiet sync stays quiet).

### 4.2 Row shape

Matches the convention Batch 004.9 already established in this file (482–494) — both the
legacy `log_entry_id` and the generic `target_type`/`target_id` pair are set.

```
log_entry_id : log.id
target_type  : 'quality_log'
target_id    : log.id
action       : 'UPDATE'
field_name   : <column>
old_value    : serialized prior value
new_value    : serialized new value
changed_by   : 'system:jira-sync'
notes        : 'Updated via Jira sync'
```

Verified by Jenny to satisfy both constraints as they actually exist:
`target_type='quality_log' AND log_entry_id IS NOT NULL` satisfies the first branch of
`audit_log_target_shape_chk` as last redefined in `025_monitoring_findings.sql:112–118`;
`action='UPDATE'` is in the `001_initial_schema.sql:70–72` set. Descriptive `field_name`
carries the detail — the same reconciliation Batch auth.2 made rather than extending the
CHECK. Service role bypasses RLS.

Setting both target shapes is correct per r15 / Batch 004.9 precedent — **but not because
the rows would otherwise be invisible.** `app/dashboard/settings/audit/page.tsx:132` already
treats null `target_type` + set `log_entry_id` as `quality_log`, so they would render either
way (Jenny LOW-3). Correctness, not necessity.

**Serialization:** arrays → `JSON.stringify` (`["Client Request"]`), matching what the edit
dialog currently sends; scalars → the string, or `null`. Comparison is on the serialized
form.

### 4.3 `changed_by`

`'system:jira-sync'`, per §13 r20 (`system:<cron-name>` for cron-context writers; there is no
`auth.uid()` here). The precedent `system:drought-evaluator` is likewise the *function* name
rather than the pg_cron job name, so this matches exactly. The function serves both cron and
the manual proxy; per-run attribution already lives in `sync_runs.triggered_by`.

The pre-existing auto-advance row (492) keeps bare `'system'`. **Corrected reasoning (Jenny
MEDIUM-1):** an earlier draft justified this as "changing it would alter historical filter
results" — that is **false**. `audit_log` is append-only; a code change touches only future
rows. The decision stands for two sound reasons instead: (a) §13 r20 *explicitly* carves this
row out as a predating exception, so leaving it is rule-sanctioned; (b) changing it would
split one event type across two `changed_by` values, so an operator filtering `'system'`
would silently stop catching new auto-advance rows.

### 4.4 The trigger-guard question from the brief

The brief asks to confirm the `auth.uid() IS NOT NULL` guard still permits the service-role
path. **It does not apply here at all.** That trigger
(`user_profiles_protect_privileged_columns`, migrations 016 + 022) is attached solely to
`user_profiles` — those are the only two `CREATE TRIGGER` statements in the entire migration
set, and they are the same trigger on the same table. `quality_logs` and `audit_log` carry
none, so the sync's service-role writes were never subject to it.

### 4.5 Correctness prerequisite — the unchecked update

`await supabase.from('quality_logs').update(...)` (466) **never destructures `error`**.
supabase-js resolves with `{ error }` rather than throwing, so today a failed update is
silent *and* still increments `logsUpdated` (496). Auditing on top of that would record
changes that did not happen. The error is therefore checked, and a failure throws into the
existing per-log catch (counted `logsFailed`, no audit row). **Required for §4.1 to be
truthful, not an opportunistic extra.**

Two consequences, stated so a later failure is diagnosed rather than blamed on this batch:

- **The sync pill still shows green.** `recordRunEnd(...'success'...)` at 518 fires
  regardless of `logsFailed`. Failed updates move from silent-success into the
  `logs_failed` count — visible in the pill's detail dialog, not in its colour (Jenny LOW-6).
- **A latent `root_cause_description` hazard becomes loud rather than silent.**
  `mapJiraFields` does `fields[customfield_12909] ?? null` (149) with no ADF extraction,
  while §7 documents that field as a **Paragraph** — Jira API v3 returns ADF *objects* — into
  a `TEXT` column. **Probed 2026-08-08 (Jenny MEDIUM-5): all 33 working-set tickets return
  `null` for `customfield_12909`; 0 non-empty.** So the hazard is latent, not live, and this
  batch cannot trip it today. If someone later fills that field in Jira, the error check
  turns what is currently a silent corruption into a loud `logs_failed`. That is the better
  failure direction, and it is why this is recorded rather than pre-emptively fixed.

### 4.6 §13 r2 is NARROWED, not satisfied — recorded deliberately (Jenny HIGH-2)

r2 requires *every* UPDATE to `quality_logs` to write an `audit_log` row. This batch audits
**7 of the 16** written columns. `client_brand`, `jira_summary`, `detected_by`,
`reproducibility`, `root_cause_description` and the four booleans can still change with no
audit row.

Stated plainly so neither this spec nor §4.1 reads as full coverage: **r2 was already
violated — the sync audited nothing at all. This batch moves it from 0/16 to 6/16.** The 6
are exactly the human-editable set, i.e. the ones where an unrecorded change destroys work,
which is the documented harm.

Full closure is deliberately deferred, not overlooked, because it is not free:
`audit_log` is **already over the PostgREST 1,000-row cap at 1,557 rows**, and
`/dashboard/logs` reads it **unranged** for the sendback-count badge (§15). Auditing 15
columns instead of 6 pushes a known-silent-truncation consumer closer to firing. Filed to
§15 to land with that pagination fix.

---

## 5. Verification

### 5.1 Where the logic lives, and why

Pure logic lives in `lib/sync/sync-field-guard.ts` and is unit-tested. The Deno function
inlines a **verbatim copy** inside marker comments, honouring the file's own self-contained
contract (`index.ts:2–3`).

**Why not `supabase/functions/_shared/` (Jenny MEDIUM-6):** an earlier draft argued imports
were effectively unavailable because Deno is not installed locally. That conflates testing
with resolution and is wrong — `_shared/` is an officially supported Supabase convention and
would kill the §6.5 duplication outright. The actual argument is narrower and is the one
that stands: **there is no `_shared/` directory today, so it is new ground, and I cannot
bundle-test it here (no Deno, and `supabase functions serve` needs Docker). Introducing an
unverifiable deploy-time resolution change inside a silent-data-loss fix on a production
write path is the wrong risk to take in this batch.** `_shared/` is the right long-term
answer and is filed to §6.5.

### 5.2 The drift test — the batch's primary oracle

Because `tsc` never sees the edge function (§0.5), the drift test is **the only gate tying
the tested module to the deployed code.** Without it, testing the module proves nothing
about the function — precisely the "reference and value share no independent oracle" failure
CLAUDE.md §15 records four times. The existing unenforced `keep the two in sync` comment on
`resolveBrandForSync` (`index.ts:218`) is the same hazard, unguarded.

**Identity contract (Jenny MEDIUM-4 — "character-identical" is unbuildable as literally
written, since a module exports and an inlined copy cannot):**

- Both files delimit the shared body with `// --- SYNC-FIELD-GUARD:BEGIN ---` and
  `// --- SYNC-FIELD-GUARD:END ---`.
- The test extracts the text strictly between the markers from each file.
- **Exactly one normalization** is applied, to the lib copy only: a leading `export ` at the
  start of a line is stripped. Nothing else — no whitespace collapsing, no comment stripping
  — so the comparison stays honest.
- The normalized strings must be identical. On mismatch the test fails **with a line-level
  diff naming the first divergent line**, not a bare `false`.
- The test also asserts both markers exist exactly once in each file, so deleting a marker
  fails loudly instead of silently comparing empty strings against each other.

### 5.3 Cases

| # | scenario | expectation |
|---|---|---|
| 1 | existing human value, incoming empty | key omitted; stored value survives |
| 2 | existing human value, incoming non-empty | overwritten with Jira's value |
| 3 | no existing value, incoming empty | key omitted; stays empty; **no audit row** |
| 4 | incoming `[]`, `null`, `undefined`, `''`, `'   '` | all treated as empty |
| 5 | incoming `false` on a boolean field | NOT guarded, still written |
| 6 | changed guarded field | exactly one audit row, correct old/new |
| 7 | unchanged guarded field | zero audit rows |
| 8 | unguarded field (e.g. `client_brand`) | always written, never audited |

### 5.4 Mutation checks

A test that passes against the broken code is not a test. Each must be run and shown to fail:

1. Revert the guard to unconditional assignment → **case 1 must fail.**
2. Treat `false` as empty → **case 5 must fail.**
3. Drop the change-comparison in the audit builder → **case 7 must fail.**
4. **Omit-vs-write-null (Jenny §7):** make the guard write `null` instead of omitting the
   key → must fail. A naive "the value is unchanged" assertion passes this mutation while
   the code still destroys data, so this is the mutation that proves the tests pin the real
   contract.
5. Edit the lib module without editing the inlined copy → **drift test must fail.**

---

## 6. Out of scope / filed to §15

1. **Recovery of the 5 damaged rows.** Prior values are recoverable from `audit_log`, but
   restoring them is a production data write and Lacey's call — not bundled into a code fix.
2. **`root_cause_initial` is structurally always empty** for webhook-created logs (§2.1a);
   §13 r3's snapshot captures nothing. Needs a Jira-workflow decision.
3. **`root_cause_description`** left unguarded (§3.3) and carries the latent ADF hazard
   (§4.5).
4. **The bare `'system'`** on the auto-advance audit row (§4.3).
5. **`mapJiraFields` / `resolveBrandForSync` are duplicated** between `jira-sync` and
   `jira-webhook`, held together only by a comment. The webhook has the *same* `?? []`
   coercion (`jira-webhook/index.ts:333–344`) — harmless there because it runs at row
   creation where there is no prior value to destroy, but it is the same shape and must not
   be assumed safe forever. `_shared/` (§5.1) is the structural fix.
6. **Full §13 r2 closure** for the other 9 sync-written columns, to land with the
   `audit_log` pagination fix (§4.6).
7. **§13 r29** — the sync writes taxonomy values unvalidated against
   `quality_log_taxonomy` (§3.4).
8. **`/dashboard/settings/audit` shows only the most recent 500** of 1,557 rows
   (`page.tsx:87`), so new sync rows push human rows out of the visible window faster.

---

## 7. Commits and documentation obligations

**Commit 1** — this spec + skip-if-empty guard + `lib/sync/sync-field-guard.ts` + tests +
CLAUDE.md:
- **§13 r7 must be amended (Jenny HIGH-1).** r7 currently says sync *"updates all QA tab
  fields."* After this guard that is **false** — it updates all except six, conditionally.
  r7 is the rule a future session reads to understand sync behaviour; leaving it stale
  invites a later batch to reinstate unconditional writes with every test still green,
  because no test pins r7's prose. Amend in the same commit per r23.
- **New §13 rule** stating the guard's contract (empty Jira never overwrites; non-empty
  always wins; the guarded set is `ALLOWED_FIELDS ∩ updateData`). This is business
  behaviour now, not an implementation detail.
- **§15.5 in-flight entry** per r34.

**Commit 2** — audit rows + the §4.5 error check + tests + CLAUDE.md §15 entries for the
eight §6 items.

**On ship** (not this session): §16 entry, §15.5 entry deleted in the same commit per r34,
footer date stamp. No version bump — no new structural surface.

**DO NOT PUSH.** Report to Karen.
