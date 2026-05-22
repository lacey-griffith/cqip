'use client';

// QA Field Reference page — dashboard rendering of
// docs/qa-field-reference.md. Mirrors the MD file's structure with
// inline JSX (matching the existing /dashboard/docs page pattern;
// project has no MDX or remark/rehype setup, so a runtime markdown
// fetch is deliberately avoided for v1).
//
// Source of truth: docs/qa-field-reference.md. If you edit there,
// reflect canonical-list changes here as well. Canonical strings on
// this page are Jira-verbatim per N2 Policy A (Batch 005.28) so the
// dropdown labels users see in the edit dialog match what they see
// here.
//
// Access: all authenticated users (admin and read-only).

import Image from 'next/image';
import { Card } from '@/components/ui/card';

const TAXONOMY_NOTE =
  'Canonical strings on this page mirror Jira verbatim — including some inconsistent spacing like "Process/ Communication" vs "Missing Information / Access". This is intentional: the dashboard edit dialog and the Jira tab use the exact same option strings, so a value entered in either surface validates against the other (§13 rule 29).';

export default function QaFieldsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-center gap-3">
          <Image src="/cqip-logo.svg" alt="" width={40} height={40} priority />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Reference</p>
            <h1 className="mt-1 text-3xl font-semibold text-[color:var(--f92-dark)]">QA Field Reference</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-[color:var(--f92-gray)]">
          Every field on a CQIP quality log — what each value means, when to use it, and how
          the fields relate. Used when filling out the Jira QA tab and when reading dashboard
          reports. Source: <code className="rounded bg-[color:var(--f92-tint)] px-1 font-mono text-xs">docs/qa-field-reference.md</code>.
        </p>
        <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-2 text-xs">
          <a className="rounded-full border border-[color:var(--f92-border)] px-3 py-1 text-[color:var(--f92-navy)] hover:border-[color:var(--f92-orange)] hover:text-[color:var(--f92-orange)]" href="#identification">Identification</a>
          <a className="rounded-full border border-[color:var(--f92-border)] px-3 py-1 text-[color:var(--f92-navy)] hover:border-[color:var(--f92-orange)] hover:text-[color:var(--f92-orange)]" href="#classification">Classification</a>
          <a className="rounded-full border border-[color:var(--f92-border)] px-3 py-1 text-[color:var(--f92-navy)] hover:border-[color:var(--f92-orange)] hover:text-[color:var(--f92-orange)]" href="#analysis">Analysis</a>
          <a className="rounded-full border border-[color:var(--f92-border)] px-3 py-1 text-[color:var(--f92-navy)] hover:border-[color:var(--f92-orange)] hover:text-[color:var(--f92-orange)]" href="#resolution">Resolution</a>
          <a className="rounded-full border border-[color:var(--f92-border)] px-3 py-1 text-[color:var(--f92-navy)] hover:border-[color:var(--f92-orange)] hover:text-[color:var(--f92-orange)]" href="#ownership">Ownership</a>
        </nav>
      </div>

      <Section id="identification" title="Identification">
        <Field name="Date (triggered_at)">When the issue was first identified or detected. For webhook-created logs, this is the Jira transition timestamp that triggered the log.</Field>
        <Field name="Client / Brand (client_brand)">The specific client brand associated with this issue — e.g. <code>MLY - Molly Maid</code>, <code>SPL - Spotloan</code>. Stored verbatim from the resolved brand row&apos;s <code>jira_value</code> per §13 rule 28.</Field>
        <Field name="Project (project_key)">The Jira project the ticket lives in — e.g. <code>NBLYCRO</code>, <code>SPLCRO</code>.</Field>
        <Field name="Jira Ticket (jira_ticket_id, jira_ticket_url)">Direct link to the related Jira ticket. ID format: <code>PROJECT-1234</code>.</Field>
        <Field name="Summary (jira_summary)">One-sentence description of the issue, pulled from the Jira ticket summary, kept in sync via the 6-hour Jira sync.</Field>
        <Field name="Log Number (log_number)">Per-ticket counter. log_number 3+ is the &ldquo;repeat offender&rdquo; marker — candidates for deeper investigation.</Field>
      </Section>

      <Section id="classification" title="Classification">
        <h3 className="mt-2">Severity</h3>
        <p>How impactful or urgent the issue is. Helps prioritize work and drives alert escalation. Single-select.</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-semibold">Critical</td><td>Breaking lead flow, affecting leads or calls, hindering test functionality. Drop other work.</td></tr>
          <tr><td className="font-semibold">High</td><td>Affects testability or breaks functionality, but the test isn&apos;t entirely down. Address before next handoff.</td></tr>
          <tr><td className="font-semibold">Medium</td><td>Test is affected but still functioning. Address in current sprint.</td></tr>
          <tr><td className="font-semibold">Low</td><td>Visual issues not interfering with functionality. Can be batched with other polish.</td></tr>
        </Table>

        <h3>Issue Category (issue_category)</h3>
        <p>Broad bucket describing what kind of problem this is. Triage with Category; pinpoint with Subtype.</p>
        <p className="text-xs italic text-[color:var(--f92-gray)]">{TAXONOMY_NOTE}</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-mono">CRO Implementation</td><td>Issues introduced by CRO-authored variation code, snippets, injected CSS, or DOM manipulation. The variation itself is the source.</td></tr>
          <tr><td className="font-mono">Experiment Configuration</td><td>Problems within the experiment platform setup (Convert, etc.) — targeting, audience, goals, activation conditions, snippet behavior.</td></tr>
          <tr><td className="font-mono">Client Website Code</td><td>Issues in the client&apos;s baseline site (CSS, JS, layout, backend) that interrupt CRO work or variation behavior. Granularity lives in Subtype.</td></tr>
          <tr><td className="font-mono">Client Data/Feed</td><td>Inconsistent, incorrect, or unclean data provided by the client. Mismatched slugs, phone numbers, source-file discrepancies, low-quality assets.</td></tr>
          <tr><td className="font-mono">Third Party Tool</td><td>Issues caused by a known vendor relationship — Convert, GA, a CDP, etc. We have a contact and can engage.</td></tr>
          <tr><td className="font-mono">Process/ Communication</td><td>Delays or errors from miscommunication, unclear handoffs, or workflow breakdowns. Mislabeled tasks, missing QA details, incorrect status movement.</td></tr>
          <tr><td className="font-mono">Missing Information / Access</td><td>Required information, assets, instructions, or credentials weren&apos;t provided. Use the Subtype to specify what was missing.</td></tr>
          <tr><td className="font-mono">Experiment Concept</td><td>The test&apos;s direction, functionality, or expectations changed after work began. Often paired with a &ldquo;Requirement or Scope Change&rdquo; root cause.</td></tr>
          <tr><td className="font-mono">External Factor</td><td>Uncontrollable environmental shifts — browser updates, network/CDN changes, OS updates. Distinct from Third Party Tool: no vendor relationship to engage.</td></tr>
          <tr><td className="font-mono">Client Request</td><td>The client explicitly asked for a change that introduced the issue or required rework. Use the Subtype to specify what kind of change (Copy, Image / Asset, Link / URL, Styling, Layout, Functionality).</td></tr>
        </Table>

        <h3>Issue Subtype (issue_subtype)</h3>
        <p>Granular symptom or mechanism — what specifically went wrong. Multi-select. Sub-grouped here for readability; in Jira this is a flat single-list multi-select.</p>

        <p className="mt-3 font-semibold text-[color:var(--f92-navy)]">Implementation symptoms</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-mono">Javascript Error</td><td>JS exception thrown, console error, broken behavior</td></tr>
          <tr><td className="font-mono">CSS/ Styling Issue</td><td>Visual styles wrong, missing, or conflicting</td></tr>
          <tr><td className="font-mono">Layout Broken</td><td>Page or component layout collapsed or shifted</td></tr>
          <tr><td className="font-mono">Element Not Loading</td><td>Expected element doesn&apos;t appear on the page</td></tr>
          <tr><td className="font-mono">Content Missing</td><td>Copy, image, or other content absent from rendered page</td></tr>
          <tr><td className="font-mono">Page Flash/ Flicker</td><td>Visible flash of original content before variation applies</td></tr>
          <tr><td className="font-mono">Variation Not Rendering</td><td>The variation code ran but its changes aren&apos;t visible</td></tr>
          <tr><td className="font-mono">Visual Overlap</td><td>Elements rendering on top of each other or misaligned</td></tr>
        </Table>

        <p className="mt-3 font-semibold text-[color:var(--f92-navy)]">Tracking / Event symptoms</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-mono">Event Not Firing</td><td>Expected tracking event not sent to analytics</td></tr>
          <tr><td className="font-mono">Incorrect Event Values</td><td>Tracking event fires with wrong parameters</td></tr>
          <tr><td className="font-mono">Experiment Trigger not Firing</td><td>Variation activation event not registering</td></tr>
          <tr><td className="font-mono">Duplicate Event</td><td>Event firing more than once when it should fire once</td></tr>
        </Table>

        <p className="mt-3 font-semibold text-[color:var(--f92-navy)]">Experiment configuration symptoms</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-mono">Incorrect Traffic Allocation</td><td>Variation distribution doesn&apos;t match configured split</td></tr>
          <tr><td className="font-mono">Variant Assignment Issue</td><td>Users assigned to wrong variation or reassigned mid-session</td></tr>
          <tr><td className="font-mono">Audience Condition Issue</td><td>Audience targeting matches users it shouldn&apos;t or misses users it should</td></tr>
        </Table>

        <p className="mt-3 font-semibold text-[color:var(--f92-navy)]">Targeting symptoms</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-mono">Device Targeting Issue</td><td>Mobile/desktop/tablet targeting misfiring</td></tr>
          <tr><td className="font-mono">Location Targeting Issue</td><td>Geo-targeting includes or excludes wrong locations</td></tr>
          <tr><td className="font-mono">Mobile/ Responsive Issue</td><td>Layout/behavior breaks on specific viewports or devices</td></tr>
          <tr><td className="font-mono">Cookie/ Session Logic Issue</td><td>Session detection, cookie handling, or persistence broken</td></tr>
        </Table>

        <p className="mt-3 font-semibold text-[color:var(--f92-navy)]">Integration &amp; data symptoms</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-mono">Client Frontend Conflict</td><td>Client&apos;s frontend code interferes with CRO variation</td></tr>
          <tr><td className="font-mono">Client Backend Issue</td><td>Client&apos;s backend (CMS, API, server) causing variation problem</td></tr>
          <tr><td className="font-mono">CMS Conflict</td><td>Content management system overriding or interfering</td></tr>
          <tr><td className="font-mono">Data Mismatch</td><td>Data values don&apos;t match between sources</td></tr>
          <tr><td className="font-mono">Data Mapping Issue</td><td>Data field mapping incorrect between source and destination</td></tr>
          <tr><td className="font-mono">Product / Service Data Missing</td><td>Specific product or service data absent from feed</td></tr>
          <tr><td className="font-mono">Feed Update Error</td><td>Data feed update failed or applied incorrectly</td></tr>
        </Table>

        <p className="mt-3 font-semibold text-[color:var(--f92-navy)]">Third-party tool symptoms</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-mono">Vendor Script Conflict</td><td>A third-party script interferes with the variation</td></tr>
          <tr><td className="font-mono">API Failure</td><td>Third-party API call returns error or unexpected response</td></tr>
          <tr><td className="font-mono">External Tool Change</td><td>A vendor changed something on their side (Convert, GA, etc.)</td></tr>
        </Table>

        <p className="mt-3 font-semibold text-[color:var(--f92-navy)]">Process &amp; briefing symptoms</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-mono">Requirements Unclear</td><td>Brief is ambiguous, contradictory, or open to interpretation</td></tr>
          <tr><td className="font-mono">Missing Requirements</td><td>Specific requirements missing from the brief</td></tr>
          <tr><td className="font-mono">Change not Communicated</td><td>A change happened upstream but wasn&apos;t relayed to team</td></tr>
          <tr><td className="font-mono">Incorrect Instructions</td><td>Provided instructions led to a different outcome than intended</td></tr>
          <tr><td className="font-mono">Missing Assets</td><td>Required creative, copy, or files weren&apos;t provided</td></tr>
          <tr><td className="font-mono">Missing Access/ Credentials</td><td>Required logins, API keys, or access not granted</td></tr>
        </Table>

        <p className="mt-3 font-semibold text-[color:var(--f92-navy)]">Environmental symptoms (Category = External Factor)</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-mono">Browser Update</td><td>A browser update broke something we depend on</td></tr>
          <tr><td className="font-mono">Network/ CDN Issue</td><td>Transient network problem, CDN propagation lag, or routing issue</td></tr>
          <tr><td className="font-mono">OS or Device Updates</td><td>A device OS update changed behavior we depend on</td></tr>
        </Table>

        <p className="mt-3 font-semibold text-[color:var(--f92-navy)]">Client change requests (Category = Client Request)</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-mono">Copy Change Request</td><td>Client requested a change to text, copy, headlines, body content, or labels.</td></tr>
          <tr><td className="font-mono">Image / Asset Change Request</td><td>Client requested a change to images, logos, videos, or downloadable files.</td></tr>
          <tr><td className="font-mono">Link / URL Change Request</td><td>Client requested a change to internal or external links, anchor targets, or URL structures.</td></tr>
          <tr><td className="font-mono">Styling Change Request</td><td>Client requested a change to color, font, visual treatment, or spacing.</td></tr>
          <tr><td className="font-mono">Layout Change Request</td><td>Client requested a change to page structure, grid, or element positioning.</td></tr>
          <tr><td className="font-mono">Functionality Change Request</td><td>Client requested a change to behavior, interactions, form fields, or other functional elements.</td></tr>
        </Table>

        <h3>Reproducibility (reproducibility)</h3>
        <p>How consistently the issue can be reproduced. Single-select.</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-semibold">Always Occurs</td><td>Reproducible on every attempt, every session</td></tr>
          <tr><td className="font-semibold">Occurs Sometimes</td><td>Reproducible some of the time; conditions partially understood</td></tr>
          <tr><td className="font-semibold">Rare / Edge Case</td><td>Only reproducible under specific, uncommon conditions</td></tr>
          <tr><td className="font-semibold">Could Not Reproduce</td><td>Reported but couldn&apos;t reliably reproduce during investigation</td></tr>
        </Table>
      </Section>

      <Section id="analysis" title="Analysis">
        <Field name="Issue Details (issue_details)">Free-text context: steps to reproduce, affected components, observed vs expected behavior. This is what a future reviewer reads months later — write enough that context isn&apos;t lost.</Field>
        <Field name="Affected URL (affected_url)">The exact URL where the issue occurs. Skip if not URL-specific (global script error, etc.).</Field>
        <Field name="Screenshot URLs (screenshot_urls)">Links to visual evidence. Use the GoFullPage extension for full-page captures when relevant.</Field>
        <Field name="Root Cause - Initial (root_cause_initial)">Your first assessment of why the issue may have happened. Captured at log creation and <strong>frozen</strong>; never changes even as investigation evolves. Compare to Root Cause - Final later to measure how often the initial read was right.</Field>

        <h3>Root Cause - Final (root_cause_final)</h3>
        <p>The confirmed root cause after investigation or resolution. This is what gets reported.</p>
        <p className="text-xs italic text-[color:var(--f92-gray)]">{TAXONOMY_NOTE}</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-mono">CRO Code Error</td><td>A bug in CRO-authored variation code (logic error, missing case, type bug).</td></tr>
          <tr><td className="font-mono">Experiment Setup Error</td><td>The experiment&apos;s configuration was wrong (targeting, goals, activation, snippet config) but the variation code itself was sound.</td></tr>
          <tr><td className="font-mono">Missing Assets/ Info</td><td>Required assets, copy, or instructions were never provided. Work couldn&apos;t proceed because something didn&apos;t exist.</td></tr>
          <tr><td className="font-mono">Process Gap</td><td>The workflow / process itself had a flaw — missing step, unclear ownership, no QA checkpoint where one was needed.</td></tr>
          <tr><td className="font-mono">QA Gap</td><td>A QA step existed but failed to catch the issue — reviewer missed it, test was incomplete, edge case not covered.</td></tr>
          <tr><td className="font-mono">Client Side Code Issue</td><td>The client&apos;s baseline website code (HTML, CSS, JS, CMS, backend) caused the problem.</td></tr>
          <tr><td className="font-mono">Client Data/ Feed Issue</td><td>The client-provided data was incorrect, incomplete, or malformed.</td></tr>
          <tr><td className="font-mono">Third Party Tool Change</td><td>A known vendor (Convert, GA, etc.) changed their behavior. We have a relationship to engage.</td></tr>
          <tr><td className="font-mono">Requirement or Scope Change</td><td>Requirements changed after work began. The work was correct against the original spec.</td></tr>
          <tr><td className="font-mono">Client Request</td><td>The client explicitly asked for a change that introduced the issue or required rework.</td></tr>
          <tr><td className="font-mono">Unknown/ Needs Investigation</td><td>Root cause not yet determined. Use when investigation is genuinely incomplete — don&apos;t use as a default for unclear cases.</td></tr>
          <tr><td className="font-mono">External Factor/ Environment Change</td><td>Browser, OS, network, CDN, or other uncontrollable environmental shift. No vendor to engage.</td></tr>
          <tr><td className="font-mono">Unclear/ Conflicting Requirements</td><td>Information WAS provided but was ambiguous, incomplete, or led to a different outcome than intended.</td></tr>
          <tr><td className="font-mono">Late Assets/ Info</td><td>Information was provided eventually but past the point of usefulness — a timing/sequencing failure rather than a content failure.</td></tr>
        </Table>
      </Section>

      <Section id="resolution" title="Resolution">
        <h3 className="mt-2">Status (log_status)</h3>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-semibold">Open</td><td>Log created, no action yet started</td></tr>
          <tr><td className="font-semibold">In Progress</td><td>Active investigation or resolution work happening</td></tr>
          <tr><td className="font-semibold">Blocked</td><td>Waiting on an external dependency or person</td></tr>
          <tr><td className="font-semibold">Pending Verification</td><td>Fix applied, awaiting verification (auto-set when ticket moves back to Dev QA / Dev Client Review)</td></tr>
          <tr><td className="font-semibold">Resolved</td><td>Fix verified and complete</td></tr>
        </Table>

        <Field name="Resolution Notes (resolution_notes)">Free-text. Include the fix applied, any changes made, and verification steps.</Field>

        <h3>Resolution Type (resolution_type)</h3>
        <p>The category of fix applied. Multi-select.</p>
        <Table headers={['Value', 'Meaning']}>
          <tr><td className="font-mono">CRO Code Fix</td><td>Updated variation code, snippet, or CRO-authored asset</td></tr>
          <tr><td className="font-mono">Experiment Configuration Update</td><td>Changed targeting, audience, goal, or activation in the experiment platform</td></tr>
          <tr><td className="font-mono">Analytics Tracking Fix</td><td>Corrected event firing, parameters, or analytics integration</td></tr>
          <tr><td className="font-mono">Design Adjustment</td><td>Visual change to address layout, styling, or design intent</td></tr>
          <tr><td className="font-mono">Client Code Fix</td><td>Client made a change to their baseline website</td></tr>
          <tr><td className="font-mono">Client Data Fix</td><td>Client corrected provided data, file, or feed</td></tr>
          <tr><td className="font-mono">Process Improvement</td><td>Workflow, checklist, or handoff updated to prevent recurrence</td></tr>
          <tr><td className="font-mono">Documentation Update</td><td>Documentation added or revised to clarify expectations</td></tr>
          <tr><td className="font-mono">No Fix Needed</td><td>Investigation complete; no action required (false alarm, expected behavior, etc.)</td></tr>
        </Table>

        <Field name="Detected By (detected_by)">Who first identified or reported the issue. Pulled from the Jira ticket&apos;s user-picker field.</Field>
        <Field name="Error Identified In (trigger_from_status)">The Jira status the ticket was in when the issue was caught. Common values: Dev QA, Dev Client Review, Queued, Live, Done.</Field>
      </Section>

      <Section id="ownership" title="Ownership">
        <h3 className="mt-2">Who Owns The Fix? (who_owns_fix)</h3>
        <p>The team or role responsible for resolving the issue. Cascading select.</p>
        <Table headers={['Top-level', 'Meaning']}>
          <tr><td className="font-semibold">CRO Dev</td><td>A member of the CRO development team owns the fix</td></tr>
          <tr><td className="font-semibold">VN Team</td><td>The VN (Vietnam) team owns the fix</td></tr>
          <tr><td className="font-semibold">Client</td><td>The client team owns the fix (e.g., they need to update their site or data)</td></tr>
          <tr><td className="font-semibold">Other</td><td>Some other party — specify in resolution notes</td></tr>
        </Table>

        <Field name="Experiment Paused (experiment_paused)">Boolean. Was the experiment paused as part of resolving this issue? Tracks operational impact.</Field>
        <Field name="Preventable (preventable)">Boolean. Could this issue have been caught earlier with existing processes? Useful for process-improvement targeting.</Field>
        <Field name="Process Improvement Needed (process_improvement_needed)">Boolean. Does this issue indicate a process change should be made to prevent recurrence?</Field>
        <Field name="Documentation Updated (documentation_updated)">Boolean. Was documentation updated as part of resolving this issue? Drives the &ldquo;lessons learned&rdquo; loop.</Field>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm md:p-8">
      <h2 id={id} className="text-xl font-semibold text-[color:var(--f92-navy)]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[color:var(--f92-dark)] [&_h3]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-widest [&_h3]:text-[color:var(--f92-gray)] [&_strong]:text-[color:var(--f92-navy)] [&_em]:text-[color:var(--f92-gray)] [&_code]:rounded [&_code]:bg-[color:var(--f92-tint)] [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs">
        {children}
      </div>
    </Card>
  );
}

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-[color:var(--f92-navy)]">{name}</p>
      <p className="mt-1 text-[color:var(--f92-dark)]">{children}</p>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-md border border-[color:var(--f92-border)]">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-[color:var(--f92-warm)] text-[color:var(--f92-navy)]">
          <tr>
            {headers.map(h => (
              <th key={h} className="border-b border-[color:var(--f92-border)] px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-t [&_td]:border-[color:var(--f92-border)] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top">
          {children}
        </tbody>
      </table>
    </div>
  );
}
