# QA Field Reference

**Purpose:** This document defines every field on a CQIP
quality log entry — what each value means, when to use it,
and how the fields relate to each other. Used by the team
when filling out the QA tab in Jira (which becomes a CQIP
log) and by leadership when interpreting dashboard reports.

**Status:** Living document. Updates require admin commit
to keep this aligned with the Jira-side option lists.

**Pairs with:**
- `docs/root-cause-taxonomy-mapping.md` (historical
  normalization mapping)
- `docs/root-cause-audit-2026-05-20.md` (drift audit)

---

## Purpose & Mission

**Purpose.** CQIP provides a centralized, systematic record
of all rework events encountered during CRO experiments
across every active client project. It captures issue type,
severity, origin, root cause, ownership, and resolution to
enable visibility, accountability, and actionable insights.

**Mission.** To track all CRO quality events with clarity
across every client, provide visibility into ownership and
resolution, identify recurring and high-impact problems, and
support continuous improvement and efficient resource
prioritization.

---

## Field reference

Fields are grouped by purpose: identification, classification,
analysis, resolution, ownership.

---

### Identification

#### Date (`triggered_at`)

When the issue was first identified or detected. For
webhook-created logs, this is the Jira transition timestamp
that triggered the log. For manually-created or CSV-imported
logs, this is the date the issue was first reported.

Used to track timelines, identify volume trends over time,
and measure resolution speed.

---

#### Client / Brand (`client_brand`)

The specific client brand associated with this issue —
e.g., "MLY - Molly Maid" or "SPL - Spotloan."

Stored in the format `CODE - Display Name` (canonical per
§13 rule 28). Sourced verbatim from the resolved
`brands.jira_value`.

Used to measure which client accounts generate the most or
highest-impact problems and to scope reports per-client.

---

#### Project (`project_key`)

The Jira project the ticket lives in — e.g., `NBLYCRO`,
`SPLCRO`. Defines which client engagement the issue belongs
to. Brands roll up under projects.

---

#### Jira Ticket (`jira_ticket_id`, `jira_ticket_url`)

Direct link to the related Jira ticket for quick access to
task details, discussion, and progress. The ticket ID format
follows Jira's standard (`PROJECT-1234`).

---

#### Summary (`jira_summary`)

A concise, one-sentence description of what the issue is.
Pulled from the Jira ticket's summary field on creation,
kept synchronized via the 6-hour sync.

---

#### Log Number (`log_number`)

Per-ticket counter. The first rework event for a ticket is
log_number 1; if the same ticket gets sent back again, the
next log is log_number 2, and so on. Useful for identifying
chronic problem tickets — anything with log_number 3+ is a
candidate for deeper investigation.

---

### Classification

#### Severity (`severity`)

How impactful or urgent the issue is. Helps prioritize work
across multiple open issues and drives alert escalation.

| Value | Meaning |
|-------|---------|
| **Critical** | Breaking lead flow, affecting leads being submitted or calls, hindering test functionality. Drop other work to address. |
| **High** | Affects testability or breaks functionality, but the test isn't entirely down. Address before next handoff. |
| **Medium** | Test is affected but still functioning. Not entirely broken. Address in current sprint. |
| **Low** | Visual issues not interfering with functionality. Can be batched with other polish. |

---

#### Issue Category (`issue_category`)

Broad bucket describing what kind of problem this is. Use the
category to triage; use Subtype to pinpoint.

Canonical values below are Jira-verbatim per N2 Policy A (Batch
005.28). Spacing reflects Jira's option strings exactly so the
dashboard edit dialog and the Jira QA tab share the same option
list literally (§13 rule 29).

| Value | Meaning |
|-------|---------|
| **CRO Implementation** | Issues introduced by CRO-authored variation code, snippets, injected CSS, or DOM manipulation. The variation itself is the source. |
| **Experiment Configuration** | Problems within the experiment platform setup (Convert, etc.) — targeting, audience, goals, activation conditions, snippet behavior. |
| **Client Website Code** | Issues in the client's baseline site (CSS, JS, layout, backend) that interrupt CRO work or variation behavior. Granularity (frontend vs backend) lives in Subtype. |
| **Client Data/Feed** | Inconsistent, incorrect, or unclean data provided by the client. Includes mismatched slugs, phone numbers, source-file discrepancies, low-quality assets. |
| **Third Party Tool** | Issues caused by a known vendor relationship — Convert, GA, a CDP, etc. A vendor we have a contact with and can engage. |
| **Process/ Communication** | Delays or errors from miscommunication, unclear handoffs, or workflow breakdowns. Mislabeled tasks, missing QA details, incorrect status movement. |
| **Experiment Concept** | The test's direction, functionality, or expectations changed after work began. Often paired with a "Requirement or Scope Change" root cause. |
| **Missing Information / Access** | Required information, assets, instructions, or credentials weren't provided. Use the Subtype to specify what was missing. |
| **External Factor** | Issues caused by uncontrollable environmental shifts — browser updates, network/CDN changes, OS updates. Distinct from Third Party Tool: no vendor relationship to engage. |

---

#### Issue Subtype (`issue_subtype`)

Granular symptom or mechanism — what specifically went wrong.
Use alongside Category to drill down. Multi-select.

Sub-grouped here for readability; in Jira this is a flat
single-list multi-select.

**Implementation symptoms** (where Category = CRO Implementation
or Client Website Code typically)
| Value | Meaning |
|-------|---------|
| Javascript Error | JS exception thrown, console error, broken behavior |
| CSS/ Styling Issue | Visual styles wrong, missing, or conflicting |
| Layout Broken | Page or component layout collapsed or shifted |
| Element Not Loading | Expected element doesn't appear on the page |
| Content Missing | Copy, image, or other content absent from rendered page |
| Page Flash/ Flicker | Visible flash of original content before variation applies |
| Variation Not Rendering | The variation code ran but its changes aren't visible |
| Visual Overlap | Elements rendering on top of each other or misaligned |

**Tracking / Event symptoms**
| Value | Meaning |
|-------|---------|
| Event Not Firing | Expected tracking event not sent to analytics |
| Incorrect Event Values | Tracking event fires with wrong parameters |
| Experiment Trigger not Firing | Variation activation event not registering |
| Duplicate Event | Event firing more than once when it should fire once |

**Experiment configuration symptoms**
| Value | Meaning |
|-------|---------|
| Incorrect Traffic Allocation | Variation distribution doesn't match configured split |
| Variant Assignment Issue | Users assigned to wrong variation or reassigned mid-session |
| Audience Condition Issue | Audience targeting matches users it shouldn't or misses users it should |

**Targeting symptoms**
| Value | Meaning |
|-------|---------|
| Device Targeting Issue | Mobile/desktop/tablet targeting misfiring |
| Location Targeting Issue | Geo-targeting includes or excludes wrong locations |
| Mobile/ Responsive Issue | Layout/behavior breaks on specific viewports or devices |
| Cookie/ Session Logic Issue | Session detection, cookie handling, or persistence broken |

**Integration & data symptoms**
| Value | Meaning |
|-------|---------|
| Client Frontend Conflict | Client's frontend code interferes with CRO variation |
| Client Backend Issue | Client's backend (CMS, API, server) causing variation problem |
| CMS Conflict | Content management system overriding or interfering |
| Data Mismatch | Data values don't match between sources |
| Data Mapping Issue | Data field mapping incorrect between source and destination |
| Product / Service Data Missing | Specific product or service data absent from feed |
| Feed Update Error | Data feed update failed or applied incorrectly |

**Third party tool symptoms**
| Value | Meaning |
|-------|---------|
| Vendor Script Conflict | A third-party script interferes with the variation |
| API Failure | Third-party API call returns error or unexpected response |
| External Tool Change | A vendor changed something on their side (Convert, GA, etc.) |

**Process & briefing symptoms**
| Value | Meaning |
|-------|---------|
| Requirements Unclear | Brief is ambiguous, contradictory, or open to interpretation |
| Missing Requirements | Specific requirements missing from the brief |
| Change not Communicated | A change happened upstream but wasn't relayed to team |
| Incorrect Instructions | Provided instructions led to a different outcome than intended |
| Missing Assets | Required creative, copy, or files weren't provided |
| Missing Access/ Credentials | Required logins, API keys, or access not granted |

**Environmental symptoms** (where Category = External Factor)
| Value | Meaning |
|-------|---------|
| Browser Update | A browser update broke something we depend on |
| Network/ CDN Issue | Transient network problem, CDN propagation lag, or routing issue |
| OS or Device Updates | A device OS update changed behavior we depend on |

---

#### Reproducibility (`reproducibility`)

How consistently the issue can be reproduced. Single-select.

| Value | Meaning |
|-------|---------|
| **Always Occurs** | Reproducible on every attempt, every session |
| **Occurs Sometimes** | Reproducible some of the time; conditions partially understood |
| **Rare / Edge Case** | Only reproducible under specific, uncommon conditions |
| **Could Not Reproduce** | Reported but couldn't reliably reproduce during investigation |

---

### Analysis

#### Issue Details (`issue_details`)

Free-text context that explains the issue in depth: steps to
reproduce, affected components, observed vs expected
behavior. Helps the team understand, troubleshoot, and
resolve the issue efficiently.

This is the field that future you (or another reviewer) will
read months later when auditing a log. Write enough that the
context isn't lost.

---

#### Affected URL (`affected_url`)

The exact URL where the issue occurs. Helps developers, QA,
and PMs quickly reproduce and verify the problem.

Skip or omit if the issue isn't URL-specific (e.g., a global
script error affecting all pages).

---

#### Screenshot URLs (`screenshot_urls`)

Links to visual evidence showing the issue occurring.
Supports faster debugging and clear communication. Use the
GoFullPage extension or similar to capture full-page
screenshots when relevant.

---

#### Root Cause - Initial (`root_cause_initial`)

Your first assessment of why the issue may have happened.
Captured at log creation time and **frozen** — even as the
investigation evolves, this value never changes. Compare to
`root_cause_final` later to measure how often the initial
read was right.

Use the same option list as Root Cause - Final.

---

#### Root Cause - Final (`root_cause_final`)

The confirmed root cause after investigation or resolution.
This is what gets reported.

Canonical values below are Jira-verbatim per N2 Policy A.

| Value | Meaning |
|-------|---------|
| **CRO Code Error** | A bug in CRO-authored variation code (logic error, missing case, type bug). |
| **Experiment Setup Error** | The experiment's configuration was wrong (targeting, goals, activation, snippet config) but the variation code itself was sound. |
| **Process Gap** | The workflow / process itself had a flaw — missing step, unclear ownership, no QA checkpoint where one was needed. |
| **QA Gap** | A QA step existed but failed to catch the issue — reviewer missed it, test was incomplete, edge case not covered. |
| **Client Side Code Issue** | The client's baseline website code (HTML, CSS, JS, CMS, backend) caused the problem. |
| **Client Data/ Feed Issue** | The client-provided data was incorrect, incomplete, or malformed. |
| **Third Party Tool Change** | A known vendor (Convert, GA, etc.) changed their behavior. We have a relationship to engage. |
| **Requirement or Scope Change** | Requirements changed after work began. The work was correct against the original spec. |
| **Client Request** | The client explicitly asked for a change that introduced the issue or required rework. |
| **Missing Assets/ Info** | Required assets, copy, or instructions were never provided. Work couldn't proceed because something didn't exist. |
| **Unclear/ Conflicting Requirements** | Information WAS provided but was ambiguous, incomplete, or led to a different outcome than intended. |
| **Late Assets/ Info** | Information was provided eventually but past the point of usefulness — a timing/sequencing failure rather than a content failure. |
| **External Factor/ Environment Change** | Browser, OS, network, CDN, or other uncontrollable environmental shift. No vendor to engage. |
| **Unknown/ Needs Investigation** | Root cause not yet determined. Use this when investigation is genuinely incomplete — don't use as a default for unclear cases. |

---

### Resolution

#### Status (`log_status`)

The current state of the log entry.

| Value | Meaning |
|-------|---------|
| **Open** | Log created, no action yet started |
| **In Progress** | Active investigation or resolution work happening |
| **Blocked** | Waiting on an external dependency or person |
| **Pending Verification** | Fix applied, awaiting verification (auto-set when ticket moves back to Dev QA / Dev Client Review) |
| **Resolved** | Fix verified and complete |

---

#### Resolution Notes (`resolution_notes`)

Free-text. Include the fix applied, any changes made, and
verification steps. Documents the outcome so others can
understand what was done and prevents repeat issues.

---

#### Resolution Type (`resolution_type`)

The category of fix applied. Multi-select.

| Value | Meaning |
|-------|---------|
| **CRO Code Fix** | Updated variation code, snippet, or CRO-authored asset |
| **Experiment Configuration Update** | Changed targeting, audience, goal, or activation in the experiment platform |
| **Analytics Tracking Fix** | Corrected event firing, parameters, or analytics integration |
| **Design Adjustment** | Visual change to address layout, styling, or design intent |
| **Client Code Fix** | Client made a change to their baseline website |
| **Client Data Fix** | Client corrected provided data, file, or feed |
| **Process Improvement** | Workflow, checklist, or handoff updated to prevent recurrence |
| **Documentation Update** | Documentation added or revised to clarify expectations |
| **No Fix Needed** | Investigation complete; no action required (false alarm, expected behavior, etc.) |

---

#### Detected By (`detected_by`)

Who first identified or reported the issue. Pulled from the
Jira ticket's user picker field.

Used to understand which roles or individuals are catching
issues early vs late.

---

#### Error Identified In (`trigger_from_status`)

The Jira status the ticket was in when the issue was caught.
Indicates where in the workflow the problem was detected.

For webhook-created logs, this is the `from` side of the
Jira status transition that triggered the log. Common
values: Dev QA, Dev Client Review, Queued, Live, Done.

---

### Ownership

#### Who Owns The Fix? (`who_owns_fix`)

The team or role responsible for resolving the issue.
Cascading select.

| Top-level | Meaning |
|-----------|---------|
| **CRO Dev** | A member of the CRO development team owns the fix |
| **VN Team** | The VN (Vietnam) team owns the fix |
| **Client** | The client team owns the fix (e.g., they need to update their site or data) |
| **Other** | Some other party — specify in resolution notes |

---

#### Experiment Paused (`experiment_paused`)

Boolean. Was the experiment paused as part of resolving this
issue? Tracks operational impact.

---

#### Preventable (`preventable`)

Boolean. Could this issue have been caught earlier with
existing processes? Useful for identifying process
improvements.

---

#### Process Improvement Needed (`process_improvement_needed`)

Boolean. Does this issue indicate a process change should be
made to prevent recurrence?

---

#### Documentation Updated (`documentation_updated`)

Boolean. Was documentation updated as part of resolving this
issue? Drives the "lessons learned" loop.

---

## Tools

**GoFullPage extension** — for capturing full-page
screenshots when linking visual evidence to a log:
https://chromewebstore.google.com/detail/gofullpage-full-page-scre/fdpohaocaechififmbbbbbknoalclacl

---

*Last updated: 2026-05-20 | Batch 005.28 — canonical lists updated to Jira-verbatim per N2 Policy A; Targeting / Audience removed from Issue Category; OS or Device Update renamed to OS or Device Updates*
