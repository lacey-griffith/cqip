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
          A short tour of the CRO Quality Intelligence Platform — how logs are created, what each
          dashboard surface tells you, and how to get data out.
        </p>
      </div>

      <Section id="what-is-cqip" title="What is CQIP?">
        <p>
          CQIP (CRO Quality Intelligence Platform) tracks <strong>rework events</strong> across the
          Fusion92 CRO department. A rework event is a Jira ticket that&apos;s been sent backwards
          in its workflow — typically from a QA or review stage back to active development or design
          — meaning something needs to be redone. CQIP automatically detects those transitions, logs
          them with the surrounding context, and gives you analytics, alerts, and saved reports on
          top.
        </p>
      </Section>

      <Section id="how-logs-are-created" title="How logs are created">
        <p>
          A Jira webhook fires on every issue update. CQIP creates a quality log when{' '}
          <strong>all of the following</strong> are true:
        </p>
        <ul>
          <li>The ticket&apos;s project is in the active projects list (Settings → Projects).</li>
          <li>
            The ticket transitioned <em>to</em> Active Dev, Active Development, or Active Design.
          </li>
          <li>
            It transitioned <em>from</em> Dev QA, Dev Client Review, Queued, Live, or Done — i.e.
            backwards in the workflow.
          </li>
        </ul>
        <p>
          Forward movement (e.g. Active Dev → Dev QA) does <em>not</em> create a log. Each new
          rework on the same ticket increments the <strong>log number</strong>, so a ticket with
          three sendbacks shows up in Logs grouped under one row with a &ldquo;3 sendbacks&rdquo;
          badge.
        </p>
      </Section>

      <Section id="statuses" title="Understanding log statuses">
        <ul>
          <li>
            <strong>Open</strong> — the rework was just detected. No one has started working on it
            in CQIP yet.
          </li>
          <li>
            <strong>In Progress</strong> — someone is actively addressing the rework.
          </li>
          <li>
            <strong>Blocked</strong> — work has paused waiting on an external dependency or
            decision.
          </li>
          <li>
            <strong>Pending Verification</strong> — the fix is in QA. Auto-set when the Jira ticket
            moves back to Dev QA or Dev Client Review.
          </li>
          <li>
            <strong>Resolved</strong> — the rework is complete and verified.
          </li>
        </ul>
      </Section>

      <Section id="dashboard" title="Reading the dashboard">
        <p>The dashboard surfaces five KPIs and four charts.</p>
        <h3>KPI cards</h3>
        <ul>
          <li>
            <strong>Total Logs</strong> — quality logs created this calendar month.
          </li>
          <li>
            <strong>Open</strong> — month-to-date logs in the Open status.
          </li>
          <li>
            <strong>In Progress</strong> — month-to-date logs being actively worked.
          </li>
          <li>
            <strong>Critical</strong> — open or in-progress logs flagged severity = Critical.
          </li>
          <li>
            <strong>Top Root Cause</strong> — the most-frequent root_cause_final this month.
          </li>
        </ul>
        <h3>Charts</h3>
        <ul>
          <li>
            <strong>Rework Volume (Weekly)</strong> — logs grouped by the week they triggered, last
            three months.
          </li>
          <li>
            <strong>Issue Category Breakdown</strong> — donut chart of all logs grouped by
            issue_category.
          </li>
          <li>
            <strong>Severity Distribution</strong> — bar chart sorted Low → Critical.
          </li>
          <li>
            <strong>Top Root Causes</strong> — top 8 most-cited final root causes.
          </li>
        </ul>
      </Section>

      <Section id="filters" title="Using filters and reports">
        <p>
          The Logs page filters by date range, client brand (typeahead-searchable), severity, and
          status. The Reports page extends the same filter set with issue category, root cause, and
          test type, and lets you save the filter combination as a named report.
        </p>
        <p>
          Saved reports are private to you by default. Admins can see all saved reports for
          oversight.
        </p>
      </Section>

      <Section id="exports" title="Exporting data">
        <p>
          From Reports, the <strong>Export CSV</strong> and <strong>Export Excel</strong> buttons
          download whatever rows currently match your filters. The CSV is plain comma-separated; the
          Excel export is a single sheet with column headers and is suitable for sharing with
          non-CQIP stakeholders.
        </p>
      </Section>

      {isAdmin ? (
        <Section id="users" title="Managing users (admin only)">
          <p>
            Settings → Users lets you create local username/password accounts, assign Admin or
            Viewer roles, send password reset emails (for non-local accounts), and deactivate
            accounts. Deactivation is a soft delete: the user_profiles row is marked inactive and
            the auth account is banned. Toggle &ldquo;Show inactive&rdquo; to manage previously
            deactivated accounts.
          </p>
        </Section>
      ) : null}

      <Section id="glossary" title="Glossary">
        <dl className="space-y-3">
          <Term term="Rework event">
            A Jira ticket transition that moves backward in the CRO workflow. CQIP creates one
            quality log per detected rework event.
          </Term>
          <Term term="Trigger transition">
            The Jira status change that produced the log. CQIP records both the &ldquo;from&rdquo;
            and &ldquo;to&rdquo; status.
          </Term>
          <Term term="Log number">
            Per-ticket counter. The first rework on a ticket is log 1, the second is log 2, and so
            on. Lets you spot tickets that get sent back repeatedly.
          </Term>
          <Term term="Root cause (initial / final)">
            Initial is the root_cause value when the log was created. Final is the most recent
            value, updated by Jira sync. Final can change as the team investigates.
          </Term>
          <Term term="Soft delete">
            Logs and users are never hard-deleted. They&apos;re marked inactive and hidden from
            default views; admins can still see them.
          </Term>
          <Term term="Sendback">
            Same idea as a rework event — used in the UI for brevity.
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
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[color:var(--f92-dark)] [&_h3]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-widest [&_h3]:text-[color:var(--f92-gray)] [&_strong]:text-[color:var(--f92-navy)] [&_em]:text-[color:var(--f92-gray)] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:text-[color:var(--f92-dark)]">
        {children}
      </div>
    </Card>
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
