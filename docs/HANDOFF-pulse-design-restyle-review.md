# HANDOFF — Pulse design restyle review (Claude Design mockups, 2026-07-25)

**Status:** Design review complete. No build started. This doc is the source
of truth for scoping the restyle batch and for picking back up in a fresh
chat once Claudette's pass lands.
**Inputs reviewed:** `Pulse_Directive_Matrix__standalone_.html`,
`Pulse_Brand_Page__standalone_.html` (both fully interactive DC mockups,
read in full — not just screenshots), plus 4 reference screenshots including
one brand-page variant (Grounds Guys) with no matching HTML source.
**Ground rule:** this is a **restyle against** the current live Matrix +
Brand page implementation, not a replacement. Every item below is judged
against whether it changes visuals only, or changes data/behavior.

---

## 1. Safe to restyle as-is — matches shipped behavior 1:1

No logic change, no schema, pure visual/skin work:

- **Status tabs "Open / Rolled out / All"** — this is the shipped
  Open/Resolved/All filter (matrix-controls batch, 2026-07-25), relabeled
  "Resolved" → "Rolled out." Cosmetic only.
- **"Paused brands hidden (N)" toggle** — exact match to the shipped
  hide-paused-brands feature.
- **Done / To do / N/A legend + cell visual language** — consistent with
  current semantics; new colors/shapes fine, meaning unchanged.
- **Brand page inline row editing** (click row → Done/To do/N/A pills + note
  field + Save) — this is the shipped `CellEditStrip` pattern (brand-page
  inline editing batch, 2026-07-25), restyled with a colored left rail +
  circular completion ring instead of current treatment. Skin, not new
  behavior.
- **Directive descriptions/notes under titles** — already real and live
  (e.g. "Add [Rev] Total Page Views" already carries a description in prod).
  Not new.

## 2. Real and derivable, worth building — new UI surface, not a pure skin

Legitimate additions; flag to Claudette as new render work (small, no schema),
not as "just CSS":

- **KPI strip** (Directive coverage %, Outstanding cells, Fully rolled out,
  Brands) — fully computable from data the matrix-controls batch already
  derives (the resolve classifier + Outstanding counts). Cheap because the
  math already exists.
- **Hover-to-inspect column highlighting + readout bar** (e.g. "ASV × Clicks
  Print Offer → To do") — no data-model impact, but real interaction-
  engineering effort (hover state cascading across a large grid). Don't let
  this get waved through as trivial.
- **Per-brand Change Log widget** on the brand page — a filtered slice of
  `audit_log`, which already exists and is already written on every status
  change (hard requirement since the goal-load batch). Good candidate: real
  data, just needs a new read + UI. No new writes.

## 3. OPEN DECISION — directive "family" grouping (Revenue Signals, Clicks,
   Funnel & Validation, Scroll Depth, Form Submissions, Page Views, Upsell,
   Chat, Configuration)

**This categorization does not exist in the data model.** Every directive
today is `type = 'goal'`. The mockup invents these 9 families via a
hardcoded client-side string-match on directive titles.

Two real paths, very different cost — **needs Lacey's call before any build
touches grouping:**

- **Client-side heuristic** (pattern-match titles at render time) — cheap,
  but brittle: a new directive with an unexpected title silently lands in
  the wrong bucket or none.
- **Real `family`/`category` field on `directives`** — reliable, but that's
  schema + migration + Jenny gate, not a render-layer batch.

**Do not bundle "grouped by family" into a restyle batch until this is
decided.**

## 4. OUT OF SCOPE — the "Client Page" (e.g. mockup's Spotloan CRO tab) is
   NOT a restyle target — it's an entirely unbuilt future product surface

Mark as **"Coming soon"** in nav (reuse the mockup's own "Convert Config —
Syncing soon" badge pattern for this). Do not hand any of this to Claudette
as part of a restyle batch. What it actually implies, none of which exists
today:

- **Internal updates feed** — team-only posts tagged Deploy/Client
  comms/Blocker/Note, pinning, a composer. New table, new writes, new UI.
- **Code library** — versioned snippets per client (JS/CSS/HTML), Live/
  Blocked/Archived states, expandable viewer, "Open in Convert" link. New
  table with real versioning semantics.
- **Engagement facts** — contact, Jira board, GA4 property, test cadence.
  New metadata fields.
- **Team assignment** — new relationship data.

This is realistically as large as Phase C/D combined — its own schema, its
own mutation routes, its own Jenny gates. Treat as a fully separate future
batch, scoped from scratch later, not derived from this mockup.

**One product question buried in here, worth answering before it becomes a
future-batch spec (not urgent, just don't forget it):** is the "Client
page" meant to eventually *replace* the existing single-brand treatment
(SPL already gets a collapsed one-brand nav entry → its brand page, per the
cross-project nav batch), or does it sit *alongside* the brand page as a
third, richer surface? Changes nav structure, not just page content.

## 5. Mockup scaffolding — NOT signal, do not port

- The hash-based pseudo-random status generator (`stateFor` function in the
  mockup JS) — fake data for the design preview only. Real pages use real
  data, always.
- Hardcoded counts (13 brands, a simplified ~50-directive subset of the real
  69) — illustrative only, not authoritative.

## 6. Known gap — one reference screenshot has no matching source

`pulse-brand-page-grounds-guys.png` shows a brand-page variant (bulk edit
button, brand coverage %, "largest gap" callout, different Change Log
placement) with **no accompanying interactive HTML** — unlike the Glass
Doctor brand view and Matrix, which both have full DC mockup source. Can't
verify its exact interaction model the way the other two could be verified.
Treat as directional/visual reference only until a real interactive version
exists, or ask Design for the matching source file.

---

## 7. Recommended scope for the FIRST restyle batch

**Include:** Matrix + Brand page visual treatment — color language, KPI
strip, hover/inspect readout, Change Log widget (§1 + §2 above).

**Exclude:**
- Family/grouping feature (§3) — until Lacey picks a path.
- The entire Client Page (§4) — mark "Coming soon" placeholder only, no
  build.

This keeps the first pass genuinely scoped as a restyle, not an accidental
launch of three unstarted product surfaces under a design-pass banner.

---

## 8. Next steps when picking this back up (fresh chat)

1. Confirm this doc has landed in project knowledge (Lacey pastes it in
   manually — Claude can't write to project knowledge directly).
2. Settle §3 (family grouping path) if not already decided.
3. Draft the actual Claudette prompt for the scoped restyle batch (§7),
   once §3 is settled or explicitly deferred.
4. Standard gate: render/visual work → no schema/route/migration expected →
   confirm no-Jenny; Karen post-flight as usual; Lacey click-through is the
   real bar, same as every other Pulse batch this week.
