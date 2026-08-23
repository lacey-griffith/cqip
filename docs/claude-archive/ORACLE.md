# Pre-split oracle — CLAUDE.md split batch

Captured at `a0fab19`, **before any content moved**. Machine-readable copy:
`oracle-pre-split.json`.

## Invariant 1 — obligation conservation

**49 unchecked `- [ ]` checkbox tokens in §15.** All 49 must still be in
**CLAUDE.md §15** after the split — never in the archive.

**This is a count of checkbox TOKENS, not of live obligations.** One of the 49
(`Give the matrix a signal for archived directives`) carries `✅ SHIPPED
2026-08-18 … this item is CLOSED` in its own body. The oracle conserves it
anyway; conserving a dead obligation is benign, dropping a live one is not.

## Invariant 2 — byte conservation

CLAUDE.md + every archive file + every extracted doc must equal the pre-split
total plus only enumerable new headers, banners and pointer stubs. Nothing is
deleted, only relocated.

## Stated limit

**Neither invariant catches an obligation expressed as prose with no checkbox**,
and the MIXED content in §15 is ~84k chars of mostly prose. The cut rule's
asymmetric default (§13, when uncertain it stays) is the primary control; these
two invariants are the backstop, not the other way round.

## Post-split result (recorded 2026-08-22)

**Conservation delta: +70,280 characters as measured at `f374676`**, against a
pre-split total of 631,268 — CLAUDE.md plus `docs/schema.md`,
`docs/repo-structure.md` and everything in `docs/claude-archive/`.

**The figure carries a commit because it is part of what it measures.** This
file is inside the sum, so editing it moves the number; dating is the escape,
per §13 **r43**. Re-derive rather than quoting this line.

The two oracle artifacts — `ORACLE.md` and `oracle-pre-split.json` — are
**5,144 characters at `f374676`**, and are included above. The remainder is new
banners, pointer stubs, r40/r41/r42/r43, the r23/r32/r34 amendments, the §16
index, the per-move archive notes and the clause-3 citation stubs.

> **⚠ THIS BLOCK WAS WRONG IN BOTH NUMBERS AND THE ERROR IS THE REASON r43
> EXISTS.** It read **+42,837** and **"exactly 4,510"**. The correct delta was
> already in that session's own verification output and had been quoted in the
> Karen handoff — it was **transcribed from stale output, not re-derived**, into
> the one document whose entire job is measurement. Wrong by ~21,000, it would
> have manufactured a future false alarm about the thing the split most needs to
> be trusted on: whether content was lost. Corrected 2026-08-22 (Karen re-review
> HIGH-3). An earlier figure of **+38,327** also appears in the batch history; it
> excluded the two artifacts deliberately but did not say so.

## Baseline (characters, not bytes — bytes run ~+1.0% here)

| Section | Chars |
|---|---:|
| **TOTAL CLAUDE.md** | **631,268** |
| CRITICAL: Read This First | 24,792 |
| §3 Repository Structure | 18,658 |
| §5 Database Schema | 33,604 |
| §13 Key Business Rules | 39,827 |
| §15 Pending / Active TODOs | 104,471 |
| §15.5 In-Flight Batches | 1,072 |
| §16 Shipped Features Log | 386,111 |
| title + §1–§14 (all) | 138,983 |
