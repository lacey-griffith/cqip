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

**Conservation delta: +42,837 characters**, against a pre-split total of
631,268. That figure **includes the two oracle artifacts themselves** —
`ORACLE.md` and `oracle-pre-split.json`, **exactly 4,510 characters**. An earlier
statement of +38,327 excluded them as measurement rather than content; the
exclusion was defensible but unstated, so it read as a 4,510-character
discrepancy (Karen M13). **Both figures are now given, with the difference
named.** The remainder is new banners, pointer stubs, r40/r41/r42, the r23/r32/r34
amendments, the §16 index and the per-move archive notes.

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
