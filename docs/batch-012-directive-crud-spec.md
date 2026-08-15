# Batch 012 — Pulse: directive CRUD (edit · soft-delete · archive)

**Status:** SPEC — commit 1, docs only. Build has not started.
**Source:** `HANDOFF — Directive CRUD (edit · soft-delete · archive)`, Lacey via
Claudette, 2026-08-15. Every locked decision in §1 below is transcribed from that
handoff; nothing there was reinterpreted.
**Gate:** **Jenny pre-flight REQUIRED before COMMIT 3** (see §9 — the gate moves
one commit later than the handoff placed it, and §9 says why). Karen post-flight.
Lacey smoke + push.
**Follows:** the Pulse matrix filter/grid batch (`5795a89`). Same file.

This spec is committed **before the build opens**, per the §15 PROCESS note. Two
earlier Pulse batches opened against an authority that existed only outside the
repo; one of them cost a whole batch. Cite this file by section number.

---

## 0. Four findings that change the batch before it starts

All four were probed against production on 2026-08-15, not inferred. Each one
moves work that the handoff placed somewhere else.

### 0.1 The archive flag ALREADY EXISTS. Commit 2 shrinks.

The handoff's commit plan asks for a "soft-delete/archive flag". Migration 024
already ships one:

```sql
status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
```

That is decision **A** ("one flag") already satisfied by the schema, and
`DIRECTIVE_STATUSES` in `lib/client-library/directives.ts` already mirrors it.
**Soft-delete is `status = 'archived'`. No new column.** Adding one would create
the two-flag state decision A exists to forbid.

So COMMIT 2's migration carries **only** the unique constraint (§5).

### 0.2 The unique constraint can land cleanly — verified, not assumed.

A unique constraint added to a table that already violates it fails at apply
time, in production, halfway through a deploy. Probed 2026-08-15 across all 89
directive rows:

| Check | Duplicates found |
|---|---|
| `(project_key, title)` exact, all statuses | **0** |
| `(project_key, title)` exact, active only | **0** |
| `(project_key, lower(trim(collapse-ws(title))))`, all statuses | **0** |

The third row matters: it means we are not choosing between a constraint that
lands and a constraint that is strict enough to be useful. Both are available
today. §5 picks.

### 0.3 The directive count moved AGAIN. Do not write it down.

| As of | NBLY active | Global active | Total rows |
|---|---|---|---|
| 2026-07-31 | 82 | — | — |
| 2026-08-03 | 83 | — | — |
| 2026-08-14 | 86 | 87 | 1,393 cells |
| **2026-08-15 (this probe)** | **87** | **88** | **89 directives** |

Every single re-probe has moved. This spec therefore contains **no directive
count that any code may read**, and §8 requires the same of the implementation:
if a number is needed, derive it. The KPI strip already works this way and its
own comment says why.

Composition today: 88 active (87 NBLYCRO + 1 SPLCRO) + 1 archived (NBLYCRO).

### 0.4 ⚠ Editing `project_key` silently corrupts the KPI strip. This is the big one.

**The handoff does not mention it, and the locked "no special confirmation"
decision (§1 row B) was made without it on the table.**

`directive_brand_status` rows are keyed to `brand_id`. Move a directive from
NBLYCRO to SPLCRO and its 16 cells still point at **NBLY brands**. Then:

- `loadProject('SPLCRO')` loads the directive (its `project_key` now says SPL)
  and, because the cell read is scoped by `directive_id`, **loads its 16 NBLY
  cells too**.
- The matrix renders SPLCRO's brand columns. None of them match. The row renders
  **entirely hollow**.
- `computeMatrixKpis` scopes cells by *directive id*, not by brand — so those 16
  NBLY cells **are counted** into SPLCRO's outstanding-cell KPIs while rendering
  nowhere.

That is counted-but-invisible: the precise defect `countHiddenOwedCells` was
built to catch for paused brands, arriving through a door that guard does not
watch. And it is silent — no error, no warning, a plausible-looking number.

§4.4 specifies the fix. It is the reason `project_key` editing is the highest-risk
line in this batch, not the most convenient one.

---

## 1. Locked decisions (transcribed — do not relitigate)

| # | Question | Answer |
|---|---|---|
| 1 | Who may edit? | **All admins.** Not owner-only. |
| 2 | Which fields? | **All of them**, including `project_key`. |
| 3 | Where? | **In-place row editing** with a save button. |
| 4 | Create? | **Already works** — out of scope. |
| 5 | Delete? | **Soft.** Never hard-delete. |
| 6 | The 16 brand cells? | **Kept.** Never deleted. |
| 7 | Archived findable? | **Yes** — `Hide archived` checkbox, default on. |
| 8 | Duplicate titles? | **Blocked.** |
| 9 | Audit log? | **Yes**, same as quality logs. |
| 10 | Type changeable after creation? | **Yes.** Discovery changes classification. |
| A | Soft-delete and archive — one flag or two? | **One flag.** |
| B | `project_key` editable? | **Yes** — a wrong project must be correctable. |

**No bespoke confirmation dialog on `project_key`.** One prompt pattern for the
whole row; the dirty-state prompt (§3) is the only guard and the audit row (§6)
is the record. §4.4 satisfies this **without** adding a confirm step — the
warning it specifies is an inline label inside the already-open editor, not a
second modal. Read §4.4 before deciding it violates this row.

---

## 2. Archived is NOT completed

**Load-bearing. Do not collapse it.**

- **Archived** — a lifecycle flag. "No longer tracked."
- **Resolved** — a *derived* state, computed across all brands per directive by
  `summarizeDirectiveCells` / `resolveStateFrom`.

If archive is treated as completion, coverage begins counting retired directives
as achievements. Finding **G1** in the QMS baseline already names a moving
denominator as the platform's most serious measurement weakness; this makes it
worse and harder to see.

### 2.1 The prohibition gets a MECHANISM, not a comment

`computeMatrixKpis(directives, cells, brands)` computes
`coveragePct = resolved ÷ directives.length`. Today the page hands it an
active-only array because `loadProject` filters `.eq('status','active')`. §4.2
removes that filter. From that moment, **a display toggle would move the
denominator** — archive counted as completion, exactly what §2 forbids, reachable
by clicking a checkbox.

Discipline is not enough here, and the batch has a repair pattern for this
already (`PANEL_MAX_HEIGHT`, `rulingWriteValues`): make it **unconstructable, not
watched**.

- `MatrixDirectiveLike` gains `status: DirectiveStatus`.
- `computeMatrixKpis` **filters `status === 'active'` internally**, before any
  count. It cannot count an archived directive even when handed one.
- Test with an independent oracle: pass a mixed array, assert every KPI field
  equals the value for the active-only subset. Mutate by deleting the filter —
  that test must fail.

This is the one place in the batch where a passing test could otherwise encode
the defect (§13 r38): a test that only ever passes active rows proves nothing.

---

## 3. Part A — in-place row editing

- Click a directive row into edit mode; fields become editable in place; a save
  button commits.
- **Dirty-state prompt on dismiss**, matching the shipped logs-page pattern
  (`HANDOFF-logs-page-batch.md` §1). Esc, outside-click and cancel all route
  through **one** `requestClose`. Pristine exits freely.
- **Reuse `lib/logs/edit-dirty.ts`'s SHAPE, not its types.** That module is
  log-specific (`EditFormSnapshot` is the nine log fields). Do not widen it to
  serve two callers. Write `lib/client-library/directive-edit-dirty.ts` with the
  same contract, and carry its load-bearing rule verbatim:

  > **The snapshot and the form's initial values come from ONE function.** The
  > editor seeds its fields FROM the snapshot it stores. Two transcriptions of
  > one mapping drift the moment a field is added, after which the form opens
  > dirty — or opens clean and never notices a change — with tsc clean and every
  > test green.

- The confirm is a **nested Dialog** (§13 r26). Radix routes Esc to the topmost
  layer only, so Esc at the prompt keeps editing, free.
- **Editable fields, enumerated against migration 024 — not inferred:**
  `project_key` · `title` · `directive_type` · `description` · `status`.
  `id`, `created_by`, `created_at` are not editable. `updated_at` is set
  server-side.
- `directive_type` values come from `DIRECTIVE_TYPES`; labels from
  `MATRIX_TYPE_FILTER_LABEL`. **Do not spell the four types again** — a second
  spelling of a closed set is the defect `CELL_STATUS_LABEL` and
  `MATRIX_CELL_FILTER_LABEL` were both consolidated to remove.
- **Autosave is rejected**, same reasoning as the logs batch: partial writes
  become real data, and every keystroke would emit audit rows into a trail §6
  makes load-bearing.

---

## 4. Part B — soft delete + archive

One flag (§0.1). One control.

### 4.1 Delete

Sets `status = 'archived'`. The directive leaves the default matrix view.
**Its cells are untouched** — decision 6. Verified reachable today: the one
archived directive in prod still holds all 16 of its cells.

**Restore is IN SCOPE.** `status` is one of the editable fields (§3), so an
archived directive can be set back to `active` from the same editor. This is not
scope creep — without it, an all-admins soft-delete has no undo path through the
UI, and "soft delete" that cannot be undone is a hard delete with extra steps.

### 4.2 `Hide archived`

Checkbox beside `Hide paused`, **default on**, mirroring its placement and
markup. Unchecking reveals archived directives, visibly marked.

**Load both sets, always; filter at render.** `loadProject` drops
`.eq('status','active')` and loads every directive for the project, plus cells
for all of them. Rationale:

- Toggling must not trigger a refetch, or the row appears before its cells and
  renders **hollow** — the pagination-hotfix symptom, manufactured on purpose.
- The archived set is tiny and grows only by archiving.
- The cell read is already `fetchAllPaged`, so it absorbs the extra rows.

The safety this trades away is exactly what §2.1's structural filter buys back.

### 4.3 The existing archived-search signal must not contradict the new view

The previous batch added `archivedTitles` + `countArchivedMatchingSearch`,
rendering *"N archived directives match your search and are not shown."*

Once archived rows CAN be shown, that sentence is false whenever `Hide archived`
is off. So:

- Delete the separate `archivedTitles` fetch; derive the count from the single
  directive load. **One fetch, one source** — two reads of the same fact is the
  divergence hazard this module exists to prevent.
- Render the signal **only when `hideArchived` is true**.
- Give it the same one-click escape the paused warning has: *"Show archived"*.

This closes the live defect the handoff names — `Submits Form Lead - Combined`
is archived in prod right now (added by direct SQL) and reads as "found nothing"
to anyone searching for it.

**And it closes a falsified claim, which is the more durable half.** Karen's
LOW-8 recorded archiving as *verified unreachable* on 2026-07-29. That audit
examined `app/api/` only, so the direct-SQL path was outside its scope. Standing
lesson, already recorded: **a "no writer exists" claim must state which surfaces
were checked.**

### 4.4 ⚠ Changing `project_key` — REQUIRED, or §0.4 ships

A `project_key` change **must re-fan-out the cells in the same write**:

1. Delete the directive's existing `directive_brand_status` rows.
2. Insert fresh cells for the **new** project's active brands, via the existing
   `fanOutCells` (paused → `n_a`, else `todo`) — the same function create uses,
   so the two paths cannot drift.
3. Audit it: one row, `field_name = 'directive_brand_status'`,
   `new_value = 're-fanned to N brands on project move'`, mirroring the create
   route's fan-out summary row.

Per-brand status **is destroyed** by this, and that is the honest outcome — those
statuses describe brands the directive no longer belongs to. Keeping them is the
silent miscount in §0.4.

**Surfacing it without breaking the §1 row-B lock:** while `project_key` is
changed *and unsaved*, the open editor shows an inline warning —

> Moving to SPLCRO rebuilds this directive's brand cells (16 → 1). Per-brand
> status will be lost.

Both counts derived, never literal (§0.3). This is **a label inside a form the
admin already opened**, not a confirmation step: nothing extra to dismiss, no
second modal, one prompt pattern preserved. It is the minimum that keeps a
destructive effect from being invisible.

**Flagged for Lacey — the one item in this batch I would not ship unread:** the
lock in §1 row B was chosen against a bespoke confirm dialog, and I have not
added one. But cell destruction was not in view when it was chosen. If the
inline warning is judged insufficient, the alternatives are (a) block
`project_key` changes on directives holding any non-default cell, or (b) accept
a confirm step for this field alone. Default if unanswered: ship the inline
warning as specified.

---

## 5. Part C — duplicate title blocking

Enforce at **both** layers. The constraint is the guarantee; the route check is
the message.

- **Migration (COMMIT 2):** `CREATE UNIQUE INDEX IF NOT EXISTS
  idx_directives_project_title ON directives(project_key, title);`
- **Routes:** both `POST /api/admin/directives` and the new PATCH pre-check and
  return a usable 409. Blocking creation closes the standing backlog item the
  create route has carried since Phase A — it performs **no** duplicate check
  today, which is why `countHiddenByFilters` had to mitigate on the render side.

### 5.1 Scope: across ALL statuses. Recommended, with the trade stated.

Uniqueness spans archived rows too. **Why, and it is not the obvious reason:** a
partial index on `status='active'` would let a duplicate title exist while
archived, and then **restore (§4.1) would fail at the database** with a
constraint error on an operation the user has every reason to expect to work.
Full uniqueness makes restore always safe.

The cost: archiving `X` no longer frees the name `X`. An admin retiring a
directive and creating a same-named replacement is blocked and must rename. Prod
already shows the workaround in use — `Submits Form Lead - Combined` (archived)
sits beside `Remove Submits Form Lead - Combined` (active).

**Open for Lacey.** Default if unanswered: full uniqueness across all statuses.

### 5.2 Exact-match only

The index is on the raw `title`. Case/whitespace variants are **not** blocked —
`"Chat Started"` and `"chat  started"` would both be allowed. §0.2 confirms zero
such near-duplicates exist today, so a stricter functional index
(`lower(regexp_replace(title,'\s+',' ','g'))`) would also land cleanly and is the
better guard.

**Open for Lacey.** Default if unanswered: exact-match, because it is what the
handoff says and the stricter form can be added later against the same clean
data. Recorded here so "we only blocked exact duplicates" is a decision rather
than an oversight.

---

## 6. Part D — audit rows

Every directive mutation writes `audit_log` rows on the quality-logs convention:
`field_name` / `old_value` / `new_value` / `changed_by`, one row per changed
field. Diff against the row as loaded; unchanged fields emit nothing.

- `target_type = 'directive'`, `target_id = <directive id>`. Migration 024
  already admits this in `audit_log_target_shape_chk` — **no constraint change.**
- `action`: reuse `'UPDATE'` with a descriptive `field_name`. The
  `audit_log.action` CHECK has its own closed set; do not invent a value.
- `changed_by` is **server-derived** via `getChangedBy()` on the **cookie-bound**
  client (§13 r19). A client-supplied `changed_by` is warned and discarded, as
  both existing directive routes already do.
- **`project_key` especially.** That field silently moves which project's
  coverage denominator the directive lands in, and the audit row is the only
  record it happened — the `alert_rules` edit of 2026-08-03 is the standing
  example of a change with no trail.
- Archive/restore writes `field_name = 'status'`, `'active' → 'archived'`.

**Do not copy the sync's identity defect.** `jira-sync` writes its auto-advance
row under a bare `'system'` rather than `system:*`, so provenance queries
filtering `system:%` miss it. Anything non-interactive here uses `system:`.

---

## 7. Out of scope

- Directive **creation** — shipped and working. Touched only for §5's duplicate
  check.
- Any change to the derived-resolve predicate, or to the verbatim
  `state !== 'resolved'` guard.
- Restyle batch 4 of 4.
- **G7 grid tab-stop burden.** Recorded against batch 4 — but this batch's
  addition is stated in §8.
- Bulk edit or bulk delete. One directive at a time.
- Hard delete. Ever.

---

## 8. Verification

Behavioural, in the order a reviewer can actually run them.

**Permissions**
- All admins can edit — not owner-only.
- Non-admins get plain inert markup, **never `<button disabled>`** (standing
  rule; the matrix's own pre-existing `disabled={!clickable}` is out of scope but
  do not add a second instance).
- The PATCH route enforces admin server-side regardless of what renders; RLS
  (`directives_admin_write`) is the backstop.

**Editing**
- Dirty prompt fires on all three dismiss paths; pristine exits freely; Esc at
  the prompt keeps the editor open.
- `directive_type` persists and the TYPE filter reflects it immediately.
- `description` and `title` persist.

**`project_key` (§4.4)**
- Moving a directive moves it between projects.
- Its cells are **re-fanned to the new project's brands** — verify by direct
  query, not by the UI.
- Its old cells are gone — again by direct query.
- The inline warning renders with **derived** counts while the change is unsaved.
- **The §0.4 regression test:** after a move, the destination project's KPI strip
  contains no cell belonging to a brand outside that project.

**Archive**
- Delete archives; the row leaves the default view; **all 16 cells survive** —
  by direct query.
- `Hide archived` defaults on. Unchecking reveals archived rows, marked.
- `Submits Form Lead - Combined` becomes findable.
- Restore returns it to active.

**§2 — the prohibition**
- KPI totals, `coveragePct` and every count are **identical** with `Hide
  archived` on and off. This is the batch's single most important assertion.
- The mixed-array unit test in §2.1 passes, and fails when the internal filter is
  deleted.

**Duplicates**
- Blocked at the route with a usable message, and by constraint (verify the
  constraint independently — a route check alone would pass this test).
- Migration applies against prod-shaped data without violation (§0.2).

**Counts and a11y**
- No literal directive count anywhere in the shipped code (§0.3).
- **State the tab stops this batch adds**, measured, not estimated: one edit
  affordance per visible row, plus the `Hide archived` checkbox, plus the fields
  of at most one open editor. Report the number against a derived row count.
- The archived signal and its "Show archived" escape share the existing single
  polite live region — do not add a second.

**Both themes.** Every contrast figure computed by the repo's script, which
first reproduces four already-documented values before being trusted. The last
batch's estimated figures were all wrong.

---

## 9. Commits

```
1  this spec, docs only
2  migration — unique (project_key, title)          [§0.1: flag already exists]
3  PATCH route + audit rows                          ← JENNY PRE-FLIGHT BEFORE THIS
4  matrix-controls: status on MatrixDirectiveLike + KPI filter + tests   [§2.1]
5  in-place row editing UI + dirty guard             [§3]
6  Hide archived control + archived rendering        [§4.2, §4.3]
7  Karen fold
```

Atomic `CLAUDE.md` per r23 on each.

**The Jenny gate moves from before commit 2 to before commit 3, and stays
required.** The handoff placed it before the migration because that commit was to
carry a new column plus a constraint. §0.1 removes the column; commit 2 is now a
single unique index on data proven non-violating (§0.2). The privileged surface
Jenny exists to pre-flight is the **new mutation route** in commit 3 — a PATCH
that can move a directive between projects and destroy cells. Gating there
reviews the risk rather than the index. If that reasoning is not accepted, gate
before commit 2 and lose nothing but ordering.

**Commit 4 lands before the UI on purpose.** The §2.1 structural filter must
exist before any code path can hand `computeMatrixKpis` an archived directive.
Building the toggle first would put the defect in the tree between two commits.

**Do not push.** Report back → Karen.

---

*Spec committed 2026-08-15, before the build opened. Prod figures in §0 were
probed the same day and will be stale; re-probe rather than citing them.*
