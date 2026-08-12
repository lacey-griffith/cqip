# HANDOFF — Logs page batch (render-only + AI review surface)

**For:** Claudette (via Lacey) · **Date:** 2026-08-11 · **Author:** DC
**Repo:** `lacey-griffith/cqip` · `cqip.l-hay.workers.dev`
**Gate:** **No Jenny** — no migration, no new route, no new mutation surface. Karen post-flight. Lacey smoke + push.
**Depends on:** classifier-1 commits 1–4. **Migration 028 VERIFIED APPLIED against prod
2026-08-12** — `ai_review_pending`, `ai_confidence_band` and `ai_suggested_root_cause` all
return 200. This is a re-probe, not an inherited claim (§13 r32 / R21): CLAUDE.md §15.5 still
recorded the column as absent with a 42703, dated 2026-08-11.

---

> ## ⚠️ REVISION 1 — Lacey amendments, 2026-08-12
>
> Three amendments, all folded **before** the build opened per the CLAUDE.md §15 PROCESS note.
> Each came out of a read-only prod probe run against this spec's own preconditions, so they are
> corrections to *measured* state, not scope changes.
>
> 1. **§5** — the suggestion strip ships **UNEXERCISED** and must be reported that way.
> 2. **§2** — new **B5**, ordered ahead of B1, and it **blocks C2**.
> 3. **The unapplied-migration block is retired.** Migration 028 is applied (header, above), so
>    Karen's HIGH-2 "the reachable state is the error box" no longer holds and the ordering block
>    in CLAUDE.md §15.5 is stale. **HIGH-2's other half survives untouched and is still the
>    reason Part C exists:** `/dashboard/reports` has no middleware admin gate (`middleware.ts`
>    gates `/dashboard/settings/*` only), so the surface moves to the admin-only logs page.
>    Retiring the migration half must not be read as retiring the finding.
>
> **Amendment 3 lands where the block actually is.** The instruction named §1 of this spec; §1 is
> Part A and carries no HIGH-2 line, and §3 C1's HIGH-2 citation mentions only the admin gate.
> The unapplied-028 assertion lives in CLAUDE.md §15.5. Recorded rather than silently resolved,
> because a fix applied to the wrong section reads as done and leaves the real claim standing.

---

## 0. One-line open

Three changes to the Quality Logs page, in one batch because they touch the same
file: a dismiss guard on the edit modal, a filter-bar rework, and the AI
suggestion strip that replaces the standalone review queue.

**Build in the stated order.** The guard changes dismiss behaviour that the
suggestion strip then inherits — building the strip first means reworking it.

---

## 1. Part A — Edit-log modal dirty-state dismiss guard

### Problem

Outside-click and Esc close the edit modal and discard unsaved edits with no
warning. Observed repeatedly in real use: a full classification entered, one
stray click, everything gone.

### Behaviour

| Trigger | Form pristine | Form dirty |
|---|---|---|
| Outside click | closes | **blocked** — confirm to discard |
| Esc | closes | **blocked** — confirm to discard |
| X button | closes | confirm to discard |
| Cancel button | closes | confirm to discard |
| Save | closes on success | closes on success |

"Dirty" = any field differs from the values the modal opened with. Track against
the opening snapshot, not against a submitted flag.

The confirm step is a simple two-option prompt — discard, or keep editing.
Default focus on keep editing.

### Explicitly rejected — do not build

**1-minute autosave.** Rejected for three reasons, all recorded so this does not
get relitigated:

1. Partial writes to prod — a half-filled classification becomes real data.
2. Audit-log noise in the exact trail the sync-guard batch just started
   producing, which is now load-bearing evidence.
3. It clears `needs_review` per §13 r29 on a half-filled row.

---

## 2. Part B — Filter bar rework

### B5 — Two empty review chips — SETTLE BEFORE BUILDING C2

**Ordered first despite the number, because it gates C2.**

Measured against prod 2026-08-12: **`needs_review = true` matches ZERO rows.** So the existing
"Needs review" chip renders permanently without a count, and `logs/page.tsx:500`'s
*"All caught up — no reviews pending"* is its **live state today**, not an edge case.

Adding "AI suggested" beside it therefore puts **two empty review chips side by side** — a
different design problem than the one-chip page C2 was written against. Candidates, none
pre-selected:

- merge both into a single review filter,
- hide a chip at zero,
- keep both, always with counts.

**Read both chips' live behaviour and propose before building. Do not decide this alone, and do
not build C2 until it is settled.**

### B1 — Add a search input

Free-text search across ticket key, ticket title, and brand. Client-side over
already-loaded rows, consistent with the Pulse matrix controls pattern (§15,
matrix controls batch — search · status filter · sort, all client-side).

Debounce, no route change, no server round-trip.

### B2 — Brand dropdown renders wrong

**This is the one item not specified here.** The defect is real and observed, but
it has not been characterised — read the live UI and the component before
building. Report what you find and what you propose before fixing it, rather than
guessing at the intended behaviour.

Likely candidates given the codebase: brand list not paged (the PostgREST
1,000-row cap has bitten this project once, a 9-day silent truncation — use
`fetchAllPaged()` if the source could exceed it), or brand strings rendering as
raw jira values rather than display names, or the dropdown not reflecting the
active selection.

### B3 — Reduce vertical space

The filter block currently occupies a large share of the viewport above the
first row. Tighten it. The date range, brand, severity, and status controls all
stay — this is spacing and grouping, not removal.

### B4 — General usability pass

Active-filter count and Reset already exist and work; keep them. Anything else
here is your judgement — flag what you changed in the commit message so Karen
can review intent, not just diff.

---

## 3. Part C — AI suggestion strip (replaces the standalone queue)

### C1 — Retire the standalone queue

- Remove `components/reports/ai-review-queue.tsx`.
- Remove its mount from `app/dashboard/reports/page.tsx`.
- Confirm nothing else imports it before deleting.

**Reason, keep this:** moving the surface onto the admin-only logs page closes
Karen's HIGH-2 from the classifier batch — `/dashboard/reports` has no middleware
admin gate. **Do not** solve HIGH-2 by adding a gate to Reports. The surface is
leaving that page.

### C2 — "AI suggested" filter chip

New chip in the filter bar alongside "Needs review". Filters
`ai_review_pending = true`. Shows a count.

Note the naming collision and do not conflate them: `ai_review_pending` (an AI
suggested something, no human has ruled on it) is unrelated to
`log_status = 'Pending Verification'` (a Jira workflow state). They are different
concepts with similar names.

### C3 — Suggestion strip inside the edit modal

When `ai_review_pending = true`, render a strip **directly below** the
Root cause (final) field containing:

- the suggested value(s)
- a confidence **band** — high / medium / low. Not a raw float. A float invites a
  threshold and a threshold invites auto-confirm, which is the classifier spec
  §9 named failure mode.
- the source prose the suggestion was derived from, quoted, with the field it
  came from named ("From resolution notes: …")
- two actions: **Confirm** · **Reject**

The source prose is what makes review fast — the reviewer should not have to open
Jira to check the suggestion.

### C4 — Action semantics

| Action | `root_cause_final` | `ai_suggested_root_cause` | `ai_review_pending` |
|---|---|---|---|
| Confirm | receives the suggestion verbatim | retained | cleared |
| Reject | untouched | cleared | cleared |
| Correct via the normal dropdown | receives the human's choice | retained | cleared |
| General row save, no ruling | untouched | untouched | **untouched** |

That last row is a test, not a comment. `needs_review` clears on any save per
§13 r29 — `ai_review_pending` must not inherit that behaviour, which is the whole
reason it is a separate column.

Record the outcome shape per classifier spec §6 — exact / partial / miss /
rejected. Set overlap, not string equality; `root_cause_final` is an array.

---

## 4. Out of scope — do NOT build

- Any change to the classifier lib, the classify route, or the ai-review route.
  Commits 1–4 of classifier-1 are provider-agnostic and unaffected.
- An admin gate on `/dashboard/reports` — see C1.
- Auto-confirm at any confidence level.
- Bulk confirm across multiple rows. One log at a time in v1.
- The collapse-on-failure UX item from the backlog. It overlaps this file — check
  whether Part A's dirty tracking makes it trivial, and if so **report that
  rather than building it.**
- G7 grid tab-stop burden. Recorded against restyle batch 4, do not fold here.

---

## 5. Verification

> ### ⚠ THE SUGGESTION STRIP CANNOT BE SMOKE-TESTED THIS BATCH
>
> Measured against prod 2026-08-12: **`ai_review_pending = true` on 0 of 122 rows**,
> `ai_suggested_root_cause` non-null on **0 of 122**, and no model credential is minted — so the
> classifier has never run and cannot run.
>
> **The strip's only reachable state today is ABSENT.** The strip itself, the band pill, the
> prose block and the Confirm / Reject actions therefore ship **UNEXERCISED**, and must be
> written that way in the commit message and in CLAUDE.md §15.5. **Do not describe them as
> verified.** Exercising them is Lacey's, after the mint and a classify run.
>
> What *is* verifiable this batch: that the strip does not render when the flag is false (the
> live case), the C4 semantics table as unit tests over pure functions, and the §13 r29-style
> structural assertions that a general save leaves the flag untouched.

- Dirty modal: outside click blocked, Esc blocked, both offer discard.
- Pristine modal: outside click and Esc close freely.
- Search filters on key, title, and brand.
- `ai_review_pending` survives a general row save; clears only on confirm,
  reject, or an explicit correction.
- Confirm copies the suggestion verbatim into `root_cause_final`.
- Reject leaves `root_cause_final` untouched.
- Multi-value suggestions round-trip as arrays, not comma strings. The audit
  trail already contains one legacy bare-comma write
  (`Client Request, Design/Visual`) — do not reproduce that shape.
- Nothing imports the deleted queue component.

---

## 6. Commits

```
1  this spec, docs only
2  Part A — dismiss guard
3  Part B — filter bar (B2 findings reported before the fix lands)
4  Part C — retire queue + chip + suggestion strip
5  Karen fold
```

**Two Lacey gates sit inside this sequence** (consequence of REVISION 1, recorded here so the
commit list does not read as unblocked):

| gate | blocks | released by |
|---|---|---|
| **B2** — brand dropdown defect uncharacterised | the B2 fix in commit 3 | findings + proposal reported, Lacey picks |
| **B5** — two empty review chips | **C2, therefore commit 4** | findings + proposal reported, Lacey picks |

Commit 2 (Part A) is unblocked by both and proceeds first, as §0 requires. C1 and C3 are
unblocked; only C2 waits, so commit 4 may be split if the B5 answer lags.

Atomic `CLAUDE.md` per r23 on each. **Do not push.** Report back → Karen.
