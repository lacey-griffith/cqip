'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';

export default function DocsPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      setIsAdmin(data?.role === 'admin');
    })();
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-center gap-3">
          <Image src="/cqip-logo.svg" alt="" width={40} height={40} priority />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Help</p>
            <h1 className="mt-1 text-3xl font-semibold text-[color:var(--f92-dark)]">CQIP Documentation</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-[color:var(--f92-gray)]">
          A plain-English guide to what CQIP does, how logs show up here, and — most
          importantly — how to fill out the Jira QA tab when you send a ticket back so the
          rest of the team gets useful reports.
        </p>
        <a
          href="/dashboard/docs/qa-fields"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:var(--f92-orange)] px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          Open QA Field Reference →
        </a>
      </div>

      <Section id="what-is-cqip" title="What is CQIP?">
        <p>
          CQIP stands for <strong>CRO Quality Intelligence Platform</strong>. It tracks every
          time a Jira ticket gets sent back to development or design after QA or client
          review — what the team calls a &ldquo;rework event&rdquo; or &ldquo;sendback.&rdquo;
        </p>
        <p>
          CQIP watches Jira for those sendbacks, logs them automatically, and gives the team a
          dashboard, filters, and reports so we can see patterns — which clients have the most
          rework, which issue types keep coming up, which root causes are worth a process
          review. The team previously tracked this in a manual spreadsheet; CQIP does it
          without anyone lifting a finger.
        </p>
      </Section>

      <Section id="how-logs-are-created" title="How logs are created">
        <p>
          You don&apos;t create logs by hand. Jira and CQIP handle it automatically.
        </p>
        <p>A log is created the moment a Jira ticket moves:</p>
        <ul>
          <li>
            <strong>From</strong> Dev QA, Dev Client Review, Queued, Live, or Done
          </li>
          <li>
            <strong>Back to</strong> Active Development or Active Design
          </li>
        </ul>
        <p>
          That backward transition is the definition of a sendback. CQIP pulls the ticket&apos;s
          fields from Jira, stamps the log with the date and time, and puts it on the Logs
          page. If the same ticket gets sent back more than once, each additional rework bumps
          the log number (log 1, log 2, log 3…). Those are the &ldquo;3 sendbacks&rdquo; badges
          you see on grouped rows.
        </p>
        <p>
          Moving a ticket <em>forward</em> (Active Dev → Dev QA) never creates a log. Only
          backward movement counts.
        </p>
      </Section>

      <Section id="statuses" title="Understanding log statuses">
        <ul>
          <li>
            <strong>Open</strong> — the sendback was just detected and nobody has touched the
            CQIP log yet.
          </li>
          <li>
            <strong>In Progress</strong> — someone is actively working on the rework.
          </li>
          <li>
            <strong>Blocked</strong> — work is paused waiting on something (a decision, a
            client response, an external dependency).
          </li>
          <li>
            <strong>Pending Verification</strong> — the fix is in, waiting on QA confirmation.
            CQIP sets this automatically when the ticket moves back to Dev QA or Dev Client
            Review.
          </li>
          <li>
            <strong>Resolved</strong> — the rework is done, verified, and closed out.
          </li>
        </ul>
      </Section>

      <Section id="dashboard" title="Reading the dashboard">
        <h3>KPI cards</h3>
        <ul>
          <li>
            <strong>Total Logs</strong> — how many sendback events have been logged this
            calendar month.
          </li>
          <li>
            <strong>Open</strong> — month-to-date logs that nobody has picked up yet.
          </li>
          <li>
            <strong>In Progress</strong> — month-to-date logs that someone is working on.
          </li>
          <li>
            <strong>Critical</strong> — open or in-progress logs flagged as Critical severity.
            A real &ldquo;drop what you&apos;re doing&rdquo; number. Zero is the goal.
          </li>
          <li>
            <strong>Top Root Cause</strong> — the most-cited final root cause this month. A
            repeated pattern here is a process-improvement signal.
          </li>
        </ul>
        <h3>Charts</h3>
        <ul>
          <li>
            <strong>Rework Volume (Weekly)</strong> — how many sendbacks happened per week
            over the last three months. Watch for spikes or trends.
          </li>
          <li>
            <strong>Issue Category Breakdown</strong> — donut chart of sendbacks grouped by
            issue category. Tells you what kind of problems we keep hitting.
          </li>
          <li>
            <strong>Severity Distribution</strong> — bar chart of sendbacks by severity.
            Ordered Low → Critical.
          </li>
          <li>
            <strong>Top Root Causes</strong> — top 8 most-cited final root causes. Mix
            trend-over-time (the chart) with this (the list) to find process-improvement
            targets.
          </li>
        </ul>
      </Section>

      <Section id="coverage" title="Reading the Coverage page">
        <p>
          The Coverage page shows brand health two ways — what&apos;s already been{' '}
          <strong>delivered</strong> (the Output table) and what&apos;s currently{' '}
          <strong>in flight</strong> (the Pipeline table, pulled live from Jira each
          time the page loads). It&apos;s visible to every signed-in user and is
          read-only — there&apos;s nothing to fill in here.
        </p>

        <h3>Pipeline stages</h3>
        <p>
          The Pipeline table buckets live work into five stages:{' '}
          <strong>Strategy → Design → Dev → Queued → Live</strong>. The numbers are
          live Jira ticket counts. Tickets in <em>Done</em> and <em>Reporting</em> are
          deliberately excluded — the pipeline is about work that&apos;s still moving.
          Click any count to open a drawer listing that stage&apos;s tickets, each
          linking back to Jira.
        </p>

        <h3>Overlay tags</h3>
        <p>
          Four overlay tags can badge the pipeline counts:{' '}
          <strong>Needs Info</strong>, <strong>Troubleshooting</strong>,{' '}
          <strong>On Hold</strong>, and <strong>Awaiting Client Input</strong>. Toggle
          them on above the Pipeline table. They are <em>visual overlays only</em> —
          they badge the counts to show how many tickets in each stage carry that tag;
          they do <strong>not</strong> filter rows out. When one or more overlays is
          on, each stage count also shows a <strong>&ldquo;None N&rdquo;</strong> chip:
          the number of tickets in that stage carrying none of the active tags.
        </p>

        <h3>Milestone drought</h3>
        <p>
          A brand that has reached <strong>2 or fewer</strong> delivered milestones in
          the last 28 days shows a <strong>DROUGHT</strong> pill on the Output table —
          a flag that delivery for that brand has gone quiet.
        </p>

        <h3>The KPI row</h3>
        <p>
          Nine cards run across the top of the page. They are <strong>full-scope</strong>:
          they describe the whole program and deliberately <em>ignore</em> the
          project / brand filter. The filter re-scopes the tables below it, not these
          cards.
        </p>
        <ul>
          <li>
            <strong>Two teal long-range cards</strong> — Tests This Year and Tests All
            Time. The teal accent flags the long-range view.
          </li>
          <li>
            <strong>Four time-window cards</strong> — This Week, Last Week, Rolling 28
            Days, and This Month — milestone and sendback counts over each window.
          </li>
          <li>
            <strong>Three operational KPIs</strong> — the ones people ask about most,
            defined precisely below.
          </li>
        </ul>
        <dl className="space-y-3">
          <Field
            name="Overall Health %"
            description={<>
              Of all active, non-paused brands, the percentage <strong>not</strong> in
              drought. &ldquo;Covered&rdquo; means <strong>more than 2</strong>{' '}
              milestones in the last 28 days — a brand sitting at exactly 2 reads as
              uncovered, matching the DROUGHT pill on the Output table. Reads
              &ldquo;—&rdquo; when there are no active, non-paused brands.
            </>}
          />
          <Field
            name="Brands Covered (N/M)"
            description={<>
              The same measure as Overall Health, in count form — e.g. <strong>7/13</strong>{' '}
              means 7 of 13 active, non-paused brands are covered. Identical numerator
              and denominator to Overall Health %. Subtitle reads &ldquo;Last 28
              days.&rdquo;
            </>}
          />
          <Field
            name="Quality Score %"
            description={<>
              Of the distinct tickets <em>delivered</em> in the last 28 days (tickets
              that first reached Dev Client Review in that window), the percentage with{' '}
              <strong>zero rework</strong> in that same window. Counts distinct tickets,
              not rework events — a ticket bounced three times still counts once. Higher
              is better. Reads &ldquo;—&rdquo; when nothing was delivered in the window.
            </>}
          />
        </dl>
        <p className="text-xs italic text-[color:var(--f92-gray)]">
          The coverage threshold is currently a flat 2 milestones for every brand. It
          will switch to each brand&apos;s contracted target in a future release.
        </p>
      </Section>

      <Section id="filters" title="Using filters and reports">
        <h3>Filters on the Logs page</h3>
        <p>
          The collapsible filter bar at the top lets you narrow by date range, client brand,
          severity, and status. The brand filter is type-to-search if you have a long client
          list. Every column header on the table sorts — click once for ascending, again for
          descending, and a chevron indicates direction.
        </p>
        <h3>Quick date pills</h3>
        <p>
          Above the filter bar you&apos;ll find &ldquo;All time,&rdquo; &ldquo;Last 30
          days,&rdquo; &ldquo;Last 60 days,&rdquo; and &ldquo;Last 90 days.&rdquo; They set the
          date range for you. Clicking the already-selected pill returns to &ldquo;All
          time.&rdquo; Manual date edits clear the pill selection.
        </p>
        <h3>Saved reports</h3>
        <p>
          Over on the Reports page, pick a filter combination you use often and click
          &ldquo;Save Report&rdquo; with a name. Recall it later in one click. Admins see all
          saved reports; everyone else sees only their own.
        </p>
        <h3>Exports</h3>
        <p>
          From the Reports page, every named report has two buttons: <strong>Export CSV</strong>{' '}
          (raw data, ready for spreadsheets) and <strong>Export PDF</strong> (uses the
          browser&apos;s print dialog to save a clean, branded PDF of the current report).
        </p>
      </Section>

      <Section id="jira-qa" title="When Sending a Ticket Back — How to Fill Out the QA Tab">
        <p>
          Before (or immediately after) moving a Jira ticket back to Active Dev or Active
          Design, open the <strong>QA tab</strong> on the ticket and fill in as many of the
          fields below as you can. These fields feed directly into CQIP. The more complete
          they are, the more useful our reports and trend analysis become.
        </p>
        <dl className="space-y-3">
          <Field
            name="Detected By"
            description="Who found the issue? Select your name. This helps us see patterns in detection sources and credit the people catching things."
          />
          <Field
            name="Experiment Paused"
            description="Was the live experiment paused because of this? Yes or No. Pausing during an active test has traffic and data implications — we track it so we know when it happened."
          />
          <Field
            name="Issue Category"
            description={<>
              The broad bucket describing what kind of problem the sendback was — the
              top-level triage of where the issue came from. Pick the single
              best-fitting category, then use Issue Subtype to pinpoint the specific
              symptom. This is a big driver of the Issue Category Breakdown chart, so
              picking consistently matters. For the current option list and what each
              value means, see the{' '}
              <a href="/dashboard/docs/qa-fields#classification" className="font-medium text-[color:var(--f92-orange)] underline hover:brightness-95">QA Field Reference</a>.
            </>}
          />
          <Field
            name="Issue Subtype"
            description="More specific than the category. If Issue Category is &ldquo;Functional bug,&rdquo; the subtype might be &ldquo;form submit&rdquo; or &ldquo;redirect failure.&rdquo; Helps with drill-down."
          />
          <Field
            name="Reproducibility"
            description={<>
              Can this issue be consistently recreated? Pick one:
              <ul className="mt-1 list-disc pl-5">
                <li><strong>Always</strong> — fires every time, predictably.</li>
                <li><strong>Sometimes</strong> — intermittent; happens under certain conditions but not every run.</li>
                <li><strong>Rarely</strong> — edge case or one-off that&apos;s hard to reproduce.</li>
              </ul>
            </>}
          />
          <Field
            name="Severity (CRO)"
            description={<>
              How bad is this?
              <ul className="mt-1 list-disc pl-5">
                <li><strong>Critical</strong> — something is completely broken. Users can&apos;t submit leads, experiment is down, revenue flow affected.</li>
                <li><strong>High</strong> — major visual or functional issue that significantly affects the experience, but not a total outage.</li>
                <li><strong>Medium</strong> — noticeable issue that affects quality but doesn&apos;t block users from completing their goal.</li>
                <li><strong>Low</strong> — minor polish item. Small visual inconsistency, a nice-to-fix.</li>
              </ul>
            </>}
          />
          <Field
            name="Resolution Type"
            description={<>
              How the issue was actually fixed — the category of the fix that closed it
              out. This is distinct from Root Cause: Root Cause is <em>why</em> it
              happened, Resolution Type is <em>how</em> it was resolved. Helps us see
              which kinds of fixes keep recurring. For the current option list and what
              each value means, see the{' '}
              <a href="/dashboard/docs/qa-fields#resolution" className="font-medium text-[color:var(--f92-orange)] underline hover:brightness-95">QA Field Reference</a>.
            </>}
          />
          <Field
            name="Root Cause (CRO)"
            description="Why did this happen? Be as specific as you can. This is the single most valuable field in the whole system — it&apos;s what drives the &ldquo;Top Root Causes&rdquo; chart and the Root Cause Breakdown report. A vague answer here makes process-improvement hard."
          />
          <Field
            name="Root Cause Description"
            description="Free-text. Add extra context, screenshots-of-the-thinking, or &ldquo;it happened because X led to Y.&rdquo; The dropdown Root Cause gives a category; this field gives the story."
          />
          <Field
            name="Preventable"
            description="Could this have been caught earlier — in spec review, QA pass, design handoff? An honest Yes helps us find upstream process gaps. A No is also useful — some things are truly unforeseeable."
          />
          <Field
            name="Documentation Updated"
            description="Did you update any process docs, SOPs, or checklists as a result of this sendback? Yes/No."
          />
          <Field
            name="Process Improvement Needed"
            description="Does this sendback point to a gap in our process that we should fix? Checking Yes flags it for review in the next retro."
          />
        </dl>
        <Callout>
          The more completely these fields are filled in, the more useful CQIP&apos;s reports
          and trend analysis become. Incomplete fields show up as blanks or &ldquo;—&rdquo; in
          the dashboard — and they don&apos;t contribute to the charts. Treat the QA tab like
          a short post-mortem for the rework, not paperwork.
        </Callout>
      </Section>

      {isAdmin ? (
        <Section id="users" title="Managing users (admin only)">
          <p>
            Settings → Users lets you create username/password accounts for teammates. The
            login flow uses first-name-style usernames (<code>lacey</code>, <code>xandor</code>,{' '}
            <code>katy</code>) — no email required. Assign Admin or Viewer when creating.
          </p>
          <p>
            Role changes and activation toggles save immediately. The &ldquo;Reset
            password&rdquo; button emails a Supabase reset link (only works for email-backed
            accounts, not username-only locals). &ldquo;Delete&rdquo; is a soft delete — it
            flips <code>is_active</code> to false and bans the auth account so the user can&apos;t
            sign in. Toggle the &ldquo;Show inactive&rdquo; switch to see deactivated
            accounts.
          </p>
        </Section>
      ) : null}

      <Section id="glossary" title="Glossary">
        <dl className="space-y-3">
          <Term term="Rework event / sendback">
            A Jira ticket that moved backward in the workflow — from a QA or review stage back
            to Active Dev or Active Design. CQIP creates one log per detected sendback. The
            two terms mean the same thing; &ldquo;sendback&rdquo; is what the UI says.
          </Term>
          <Term term="Trigger transition">
            The specific Jira status change that produced the log. CQIP records both the
            &ldquo;from&rdquo; and the &ldquo;to&rdquo; status.
          </Term>
          <Term term="Log number">
            The per-ticket counter. First sendback on a ticket is log 1, second is log 2, etc.
            A log number of 3+ is CQIP&apos;s &ldquo;repeat offender&rdquo; marker.
          </Term>
          <Term term="Root cause (initial vs. final)">
            Initial root cause is the value on the Jira ticket the moment CQIP created the
            log. Final root cause is the most recent value, refreshed on each periodic Jira
            sync. Final can change as the team investigates; initial never does.
          </Term>
          <Term term="Soft delete">
            CQIP never hard-deletes logs or users. Deleting just marks the row{' '}
            <code>is_deleted = true</code> (or for users, <code>is_active = false</code>).
            Admins can still see deleted records; default views hide them.
          </Term>
          <Term term="Critical">
            Severity level reserved for &ldquo;something is broken, traffic is affected, fix
            this now.&rdquo; Surfaces on the dashboard as its own KPI.
          </Term>
        </dl>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm md:p-8">
      <h2 id={id} className="text-xl font-semibold text-[color:var(--f92-navy)]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[color:var(--f92-dark)] [&_h3]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-widest [&_h3]:text-[color:var(--f92-gray)] [&_strong]:text-[color:var(--f92-navy)] [&_em]:text-[color:var(--f92-gray)] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_code]:rounded [&_code]:bg-[color:var(--f92-tint)] [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs">
        {children}
      </div>
    </Card>
  );
}

function Field({ name, description }: { name: string; description: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-[color:var(--f92-navy)]">{name}</dt>
      <dd className="mt-1 text-[color:var(--f92-dark)]">{description}</dd>
    </div>
  );
}

function Term({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-[color:var(--f92-navy)]">{term}</dt>
      <dd className="mt-1 text-[color:var(--f92-dark)]">{children}</dd>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-[color:var(--f92-orange)]/30 bg-[color:var(--f92-tint)] p-4 text-sm text-[color:var(--f92-dark)]">
      <p className="font-semibold text-[color:var(--f92-orange)]">Why this matters</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}
