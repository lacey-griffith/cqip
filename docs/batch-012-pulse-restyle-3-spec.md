# SPEC — Batch 012 Pulse, restyle batch 3 of 4: hover-inspect + note surfacing

**For:** Claudette · **Drafted by:** DC · **Date:** 2026-08-02 (rev 2)
**Repo:** `lacey-griffith/cqip` · `cqip.l-hay.workers.dev` · v2.6 · tip `3c2624e` (pushed)
**Commit destination:** `docs/batch-012-pulse-restyle-3-spec.md`

**rev 2 changes:** gates 0a/0b CLEARED with results recorded · §1 corrected — the brand
page ALREADY renders notes persistently · §2.7 rewritten from "build" to "refactor" ·
the handoff's citation location corrected (project knowledge, not the repo).

---

## §0 Gate profile

Render/interaction only. NO migration · NO schema · NO route · NO mutation surface ·
NO new fetch · NO new dep → no Jenny (E-track).

**Version:** recommend v2.6 → v2.7. Shared note module + a changed public lib API is the
bar the restyle core bumped for. Lacey's call at ship.

### §0.1 GATE 0a — CLEARED 2026-08-02
Brand page holds `note` at both fetch sites (`:278` initial load, `:371` refetch
reconcile), threads it through `applyOptimistic` (`:387-391`), passes
`initialNote={cell.note}` (`:789`). No fetch change. Gate profile unchanged.

### §0.2 GATE 0b — CLEARED 2026-08-02
`###` count between `## 15.5.` and `## 16.` is **0**. §15.5 clean after `3c2624e`.

---

## §1 What is true today — verified against source

**The matrix.** The cell `<button>` (`pulse/page.tsx`) carries:

```
disabled={!clickable}                                                          // :1066
title={`${CELL_STATUS_LABEL[status]}${cell?.note ? ` — ${cell.note}` : ''}`}    // :1077
{cell?.note ? <span className="sr-only">has note</span> : null}                // :1101
```

So on the matrix the note is already reachable on hover via the **native tooltip**, and
its existence is already announced to screen readers. There is no **rendered** indicator,
so you cannot tell which of ~1,312 cells carry a note without hovering each one.

And `clickable = isAdmin && !!cell`, so non-admins get `<button disabled>` — out of the
tab order, no mouse events in most browsers, which also suppresses its own `title`.

**The brand page.** Already renders the note as **persistent text** under the title
(`:733-738`, a `<p className="mt-1 text-xs">` with a `Note:` prefix, no hover, visible to
everyone). This was shipped, and rev 1 of this spec described it as unbuilt. It is not.

**So the real gap is narrower than rev 1 claimed:** notes are visible on the brand page,
hover-reachable for admins on the matrix, and **unreachable for read-only users on the
matrix only.** That surface is what this batch fixes.

Two comments claim notes are invisible — `status-cell.tsx:142-145` (the legend's "would
be a lie") and `pulse/page.tsx:1097-1100`. Correct both in this batch. Do not leave a
comment standing that the batch falsifies; that is defect shape (2) from the week.

---

## §2 Deliverables

### §2.1 Shared note module — ONE definition
New pure module (suggest `lib/client-library/cell-note.ts`).

- `hasNote(note: string | null | undefined): boolean` → `note != null && note.trim() !== ''`.
  Whitespace-only counts as NO note. `CellEditStrip` saves `note.trim() || null`, but
  historical rows predate it.
- A pure `buildCellReadout(...)` returning the readout model (brand label, directive
  title, status label, note or null) so the readout is testable without a DOM.
- Both surfaces import both. **Zero second definitions** — Karen counts consumers.

### §2.2 Matrix — note indicator
A rendered mark wherever `hasNote` is true. **This is the load-bearing deliverable:** it
makes notes findable by scanning. The readout is only how you read one once found. Must
not enlarge the cell, shift grid rhythm, or eat into the 24×24 hit area.

### §2.3 Matrix — readout bar
Driven by **hover AND focus**, identically. Shows `BRAND × directive → Status` plus the
note, or an explicit "No note" — never an empty region, which reads as broken. One polite
`aria-live` region, `aria-atomic`, persistent in the DOM.

### §2.4 Matrix — column + row highlight
Highlight the hovered/focused cell's column (including the brand header) and its row.
The first column is `sticky left-0` with an opaque `--f92-surface` background; a row
highlight that skips it will look broken. Handle it.

### §2.5 Legend
Add the note entry. `StatusLegend`'s own comment says a legend entry for an unrendered
indicator would be a lie; the converse holds once §2.2 lands.

### §2.6 Non-admin markup — remove `<button disabled>`
Required. The readout exists *for* the read-only viewer, and a disabled button kills
hover, focus and tooltip for exactly that person. This is also the standing "never a
disabled control" rule, which the brand page honors and the matrix never has.

**Locked shape:** the cell stays a real `<button>` for everyone.
- **Admins** — click opens the editor, unchanged (5870dae). Dot remains the edit target.
- **Non-admins** — `aria-disabled="true"`, never `disabled`; no mutation handler; **click
  pins/unpins the readout.** That gives the control an honest job instead of being a
  button that does nothing, and it is the only note path that works on touch, where
  there is no hover at all.
- Accessible names differ between the two cases. Exactly one tab stop per cell either way.

### §2.7 Brand page — refactor onto the shared module, do NOT redesign
The persistent note render already exists at `:733-738`. **Do not rebuild it and do not
restyle it.** Point it at `hasNote` from §2.1 so the two surfaces cannot disagree about
what counts as a note — today an all-whitespace note would render an empty `Note:` label
there, and the matrix's `cell?.note` truthiness check would call it a note too, so both
are wrong in the same direction by luck rather than by contract.

Keep the `Note:` prefix unless the shared renderer makes it redundant; if you change it,
say why in the commit message. This is the second consumer that proves the seam.

### §2.8 Remove the native `title` note
Once §2.3 ships, `title` is a second competing hover surface on the same element —
different delay, different position, same content. Drop the note from it; keep the status
in the accessible name.

---

## §3 Hard constraints

- **No `hover:` utility on `StatusCellBox`.** `status-cell.tsx:18-23` carries an explicit
  DO-NOT with the 3363629 rationale. Hover lives on the parent `<button>`.
- **Do NOT move `globals.css` into a layer.** 194 utility call sites app-wide resolve to
  F92 values only because it is unlayered.
- **Vocabulary verbatim:** To do · In progress · Done · Blocked · N/A. Derived: Open ·
  Resolved. "Rolled out" banned — check rendered strings, not the comment claiming it.
- `TERMINAL_CELL_STATUSES` stays an explicit list, not the complement of `OWED`.
- The **dot stays the sole edit target and sole tab stop**. The readout is a readout.
- **Derive every count at runtime.** Prod went 76 → 82 directives inside one batch and
  gained a project mid-batch. No hardcoded totals, including in fixtures.
- `components/layout/pulse-client-nav.tsx` diff must be **0 lines**.
- No inline hex. **Any new token measured on EVERY surface it touches, including outside
  Pulse** — the bar set for the focus ring and missed on `--severity-*`.
- **Performance:** naive hover state re-renders ~1,312 cells per cell-to-cell mouse move.
  Pick an approach and state what you picked and what it costs in the commit message.

---

## §4 Tests

Existing **128 stay green**, including the 9 pinning the verbatim guard.

New, minimum:
1. `hasNote` — `null` false · `undefined` false · `''` false · `'   '` false · `'x'` true.
2. `buildCellReadout` — normal cell · cell with note · **cell-less cell** (brand added
   after the directive: status `n_a`, no note, readout still renders).
3. Readout model never returns an empty note field — null or text, never `''`.
4. **Mutation-verify:** rewrite `hasNote` as `note != null` and confirm the whitespace
   case fails. Report which mutations you ran and what failed. A test that passes on the
   broken version is not a test.

---

## §5 Verification bar

- **Compiled CSS, not the class list** — highlight rules, the indicator, any `::after`
  content. Every class can be present and the effect still dead.
- **Prove the `title` note is gone** from the built output, not from your own diff.
- Readout announces **once** per cell, not twice.
- Keyboard: tab through cells; readout tracks focus identically to hover.
- Non-admin path exercised as a non-admin, not inferred from code.
- **Both themes by eye** — not self-satisfiable. Say so and hand it to Lacey.

---

## §6 Out of scope

Family grouping (deferred, flat list) · Client page ("Coming soon" badge only) · bulk
edit (new mutation, Jenny) · E3 comments/timeline/lifecycle dates · monitoring panel
stays non-collapsible · per-cell audit coverage + Change Log widget (batch 4; MEDIUM-6
unanswered).

---

## §7 Commits

1. **Docs-only** — this spec + `docs/HANDOFF-pulse-design-restyle-review.md` committed
   verbatim + the §15.5 in-flight entry.

   On the handoff: its by-path citation lives in `CQIP-batch-outline.md` in **project
   knowledge**, not in the repo — a repo grep correctly returns zero. Committing it makes
   the planning doc's reference resolvable and gives batches 3 and 4 an in-repo scope
   source. Its §2 is the "don't wave hover-inspect through as trivial" line; its §7 is the
   include/exclude for the restyle sequence.

2. **Code** — atomic CLAUDE.md update per §13 r23.

**Also for §15, Claudette's corrective, and it is correct:** commit the spec *before* the
build session opens, not during it. This is the second time a Pulse batch has opened
against an authority that existed only outside the repo — the first was the abandoned V2.1
loader, where every in-repo check passed and the mapping was still wrong because the brief
was not in the repo. Worth a §13 rule.

**DO NOT PUSH.** Karen post-flight, findable recorded verdict → Lacey smoke → Lacey pushes.

---
---

# PROMPT FOR CLAUDETTE — paste from here down

```
Restyle batch 3 unblocked. Both docs are now on disk — drop them into docs/ and
commit as commit 1:
  docs/batch-012-pulse-restyle-3-spec.md          (rev 2, canonical)
  docs/HANDOFF-pulse-design-restyle-review.md     (verbatim, retroactive)

Gates 0a and 0b are CLEARED and recorded in the spec — don't re-run them.

Read the spec; it is canonical over this prompt. Three corrections from rev 1, all
yours to hold me to:

 1. §2.7 is a REFACTOR, not a build. You were right — the brand page already
    renders notes persistently at :733-738. Point it at the shared hasNote so the
    surfaces can't disagree about what counts as a note. Do NOT rebuild or restyle
    that render.
 2. §1 is corrected. Notes are visible on the brand page today. The real gap is
    the matrix, for read-only users only.
 3. The handoff's citation is in project knowledge, not the repo. Your grep was
    right; my wording was wrong.

Build §2.1–§2.8. §2.6 carries the locked non-admin shape (real <button>,
aria-disabled not disabled, click pins the readout — the only touch path). §2.2,
the rendered note indicator, is the load-bearing piece.

Hard constraints §3, tests §4, verification bar §5. Mutation-verify hasNote and
report what you ran. State your hover-performance approach and its cost in the
commit message.

Two commits, docs first, atomic CLAUDE.md per r23. Add the §15 note that specs get
committed before the build session opens — second time this has bitten a Pulse
batch. DO NOT PUSH. Report back → Karen, verdict findable.
```
