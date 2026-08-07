# Convert audit 2026-08-07 — record + remaining actions

Full-account crawl (13 active projects, 1,007 goals) diffed against the Pulse
matrix, both directions: outstanding cells checked for existing goals, Done
cells checked for missing/archived goals.

## Completed 2026-08-07 (matrix now 81 directives / 380 outstanding)
- Deleted duplicate directive `Add [Rev] Total Page Views`
  (7a479326-eff5-4e25-b497-562bfbfd5b97; zero audit rows, clean delete)
- Flipped Done, goal verified active:
  JUK Clicks Hero Reviews (1004123885) · MLY Clicks Hero Reviews
  ([MLY 72] 1004123841) · JUK Clicks Warranty CTA ([JUK 13] 1004118275) ·
  PDS Views Special Offers ([PDS 20] 1004112147)
  Ruling: test-prefixed goals satisfy generic directives.
- Flipped N/A, brand can't satisfy:
  RBW FLF Step #3 / Time On Step 3 / Step 3 Validation (goals archived
  "[dnu - no cal]" — RBW has no calendar step) · MRE [Upsell] Selects Offer 1
  (MRA) (MRA-tagged; MRE's own goal is Selects MRE Offer)
- Created directive `Remove Submits Form Lead - Combined` (decision: retire
  the Convert-native combined goal; GTM variant is the survivor).
  Done: GUY 1004113650 · MRR 100423041 · MRA 1004101324 (all archived).
  To do (goal still active): ASV 100496090 · MDG 1004101056 · PDS 100492051 ·
  RBW 1004117399 · MLY 1004101323 · FSP 1004103135 · JUK 1004108644 ·
  MOJ 1004100862 · MRH 100491956 · MRE 1004101887
- Archived old `Submits Form Lead - Combined` directive (not deleted —
  carries 07-25 audit history)
- Verified [Rev] Total Page Views: exists+active on MRA/ASV/MDG/PDS/RBW/FSP/
  MRH/MRE; ABSENT on GUY/JUK/MLY/MOJ/MRR — the 5 outstanding cells are correct

## Handoffs to send
- [ ] Xandor: execute the 110-row rename cleanup
      (docs/convert-reconciliation-2026-07-25/rename-cleanup.csv) in Convert.
      Never ran; 69 Done cells only verify through that mapping, and drift is
      still accumulating (MRH Clicks Testimonial CTA renamed since 07-25).
- [ ] Claudette (Jenny gate): unique constraint / dupe check on directive
      titles — migration 024 gap, today's dupe is the proof case.

## Open decisions (capture, not urgent)
- [ ] Upsell goal naming convention: new goals use
      `[Upsell] Selects <BRAND> Offer` / `Selects Cross Offer` (MRE, MRH);
      directive titles use old per-product names. Pick one side.
- [ ] v2.3 template: retire `submitsFormLead_Combined` key — with the
      Convert-native goal being removed brand-wide, every trigger firing it
      is a silent no-op once its brand's goal archives. Fold into the
      V2_TRIGGER_TEMPLATE_REFERENCE.md v2.2 bump.
- [ ] Build [Rev] Total Page Views in GUY/JUK/MLY/MOJ/MRR (blocked-ish on
      each brand's V2 trigger shipping; goal is useless unfired)
- [ ] MLY second FLF goal so Step #1/#2 track separately (07-25 carryover)
