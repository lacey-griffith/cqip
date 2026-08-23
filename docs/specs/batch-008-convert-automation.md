# Batch 008 — Convert.com test deployment automation · full scope

**Relocated from `CLAUDE.md` §15 on 2026-08-23** by the second extraction pass
(§13 r41 remedy 3 / r42). **This file is live scope authority — it is NOT the
archive, and r40 does not apply to it.** Current sequencing, mode and open
actions stay in CLAUDE.md §15; read those there, not here.

Board rev 8.1 places 008 at sequence **#9**, dependent on **#8 Convert direct
read — which it may fold into. Check the collision before scoping either.**

---

### Batch 008 — Convert.com test deployment automation
**Sequenced after Batch 012 (resequence 2026-07-15).** 008 **consumes Batch
012's Phase B monitoring-ingest surface** instead of rebuilding a
targeting/monitoring layer; the former "Per-brand config pages" prereq is
absorbed into Batch 012, so 008 no longer carries a standalone prereq batch.
*(If the 012/008 overlap resolution changes, only this note moves.)*

Big-boy integration. Director of CRO requested a tool that lets the
team pull active A/B tests for a given brand, then convert a winning
variation into a deployment with a single click — pause test,
create deployment from variation, rename per a formula, activate.
NBLY-only initially, but spec assumes brand model is CRUD-ready so
new clients can be onboarded without code changes (overlaps with
Batch 004.99 multi-client readiness work).

Discovery work the batch needs to start with:
- Convert.com API auth model — service accounts? per-user OAuth?
  API keys per project? Document the actual mechanism.
- Rate limits and the pause/deploy state machine — what's atomic?
  Can the four-step sequence happen in one API session, or is
  there polling between steps? What's the failure mode if step 3
  of 4 fails (half-deployed states are dangerous)?
- Brand → Convert project mapping — CQIP knows brands, Convert
  knows projects/accounts. Need a translation table; probably a
  new column on `brands` (e.g. `convert_project_id`).
- The naming formula (Lacey to provide) — derivable from Jira
  ticket data? from CQIP-known fields? from a manual input at
  click time?
- UI placement — extend `/dashboard/coverage`, or new
  `/dashboard/deployments` page?
- Failure / rollback semantics — destructive 4-step action needs
  confirmation dialog, audit trail (who clicked, what got renamed
  to what, did all 4 steps succeed), and idempotency.

Implementation sketch (post-discovery):
- `lib/convert/client.ts` — Convert API client
- New page or page extension for listing active tests by brand
- Single-click deploy button with confirmation dialog
- `convert_deployments` audit table (or extend existing `audit_log`
  with `target_type='convert_deployment'`) recording every
  deploy attempt + per-step success/failure
- New env var(s) for Convert API credentials + per-brand mapping

Realistic scope: 2-4 week build, not a weekend project. The
"single push" hides a multi-step orchestrator with error handling,
idempotency, and rollback semantics.
