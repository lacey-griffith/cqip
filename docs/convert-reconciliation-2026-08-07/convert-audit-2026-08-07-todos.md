# Convert reconciliation 2026-08-07 — full session record

Full-account crawl (13 active projects, 1,007 goals) diffed against the Pulse
matrix in both directions, plus execution of the 07-25 rename cleanup and the
upsell naming standardization. Supersedes the earlier version of this file.

## Matrix corrections (executed in Pulse)
- Deleted duplicate directive `Add [Rev] Total Page Views`
  (7a479326-...; zero audit rows, clean delete)
- Flipped Done (goal verified active): JUK Clicks Hero Reviews (1004123885) ·
  MLY Clicks Hero Reviews ([MLY 72] 1004123841) · JUK Clicks Warranty CTA
  ([JUK 13] 1004118275) · PDS Views Special Offers ([PDS 20] 1004112147).
  Ruling: test-prefixed goals satisfy generic directives.
- Flipped N/A (brand can't satisfy): RBW calendar trio (goals archived
  "[dnu - no cal]" — RBW has no calendar step) · MRE cell on the MRA-owned
  upsell directive · all non-owner cells on brand-owned upsell directives
  (MRE Offer, MRR Cross Sell (MRE))
- Created `Remove Submits Form Lead - Combined` directive (decision: retire
  the Convert-native combined goal; GTM variant survives). Done: GUY/MRR/MRA
  (goals archived). To do: the 10 brands where it's still active.
- Archived old `Submits Form Lead - Combined` directive (kept, not deleted —
  carries 07-25 audit history)
- Renamed 3 directive titles to the upsell convention (ASV Offer / MRA Offer /
  MRE Offer) + `Upsell Goal Configuration` → `[Upsell] Goal Configuration`

## Convert-side execution (via authenticated API, all verified by re-read)
**Rename cleanup (07-25 CSV, 110 rows) — fully dispositioned:**
- 100 renames executed across all 13 brands, zero failures
- 5 dropped permanently: MRA FLF renumber ×4 (MRA's step order is genuinely
  different — the CSV was wrong, not the names) · RBW time-on-step-3 (goal
  archived "[dnu - no cal]", correctly untouched)
- 1 deferred: MLY 100480832 "FLF: Step #2 Reached - Calendar/Apt Details" —
  revisit at MLY V2 trigger time; split into two step goals if that matches
  MLY's FLF (pairs with the existing "MLY second FLF goal" open item)
- Endpoint: POST /accounts/{acct}/projects/{pid}/goals/{id}/update
  (also takes status active/archived — future archive tasks are scriptable).
  Nonce goes stale; re-harvest from a UI XHR on 412.

**Upsell goal naming convention (decided 2026-08-07):**
`[Upsell] Selects <TARGET> Offer|Cross Sell (<OWNER>)` — owner is the project
the goal lives in; every brand gets one own-offer + one cross-sell goal.
All upsell directives/goals carry the [Upsell] prefix.
Renamed to convention: ASV ×2, MRA ×2 (incl. Selects PDS Cross Sell (MRA),
target confirmed), MRE ×2, MRH ×2. Dead V1 placeholders (Upsell Selection /
Upsell Section on MDG/RBW/FSP/PDS) deliberately not renamed — archive
candidates, not polish candidates.

## Decisions log
- Test-prefixed Convert goals satisfy generic directives
- Convert-native Submits Form Lead - Combined is being retired brand-wide;
  [GTM] variant is the survivor (v2.3 template consequence below)
- Generic upsell directives (Selects Any / Presented / Clicks Submit CTA)
  stay To-do on all brands: "probably all will run upsells, only some have" —
  closes the July handoff §4 question as keep-To-do
- MRA FLF step order is real, not a labeling error — never "fix" it

## Handoffs / feature asks (Claudette, one message, sent 2026-08-07)
1. Unique constraint + dupe check on directive titles (needs Jenny)
2. Bulk cell editing in the matrix (must keep per-cell audit_log writes)
3. Brand-applicability picker at directive creation (fan-out control)

## Open items
- [ ] MLY FLF rename/split — at MLY V2 trigger time
- [ ] v2.3 template: retire `submitsFormLead_Combined` key (goal being
      removed brand-wide → silent no-op fires); fold into the
      V2_TRIGGER_TEMPLATE_REFERENCE.md v2.2 bump
- [ ] Archive remaining active Submits Form Lead - Combined goals per brand
      as the Remove directive gets worked (10 brands)
- [ ] Build [Rev] Total Page Views in GUY/JUK/MLY/MOJ/MRR (with each V2
      trigger ship)
- [ ] Archive dead V1 upsell placeholder goals (MDG/RBW/FSP/PDS)
- [ ] Future directives for new upsell goals not yet in the matrix:
      MRH Offer / MRA Cross Sell (MRH) / PDS Cross Sell (MRA)
