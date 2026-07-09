'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { CoverageRow, Milestone } from '@/lib/coverage/queries';
import { startOfRolling28 } from '@/lib/coverage/queries';

interface BrandDetailDrawerProps {
  row: CoverageRow | null;
  milestones: Milestone[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Short axis label ("Mar") for a "YYYY-MM" bucket key.
function monthLabel(monthIso: string): string {
  const [y, m] = monthIso.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

// Full label ("March 2026") for the selected-month list header.
function monthYearLabel(monthIso: string): string {
  const [y, m] = monthIso.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Is a timestamp inside the calendar month named by a "YYYY-MM" key?
function inMonth(iso: string, monthIso: string): boolean {
  const [y, m] = monthIso.split('-').map(Number);
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const start = new Date(y, m - 1, 1).getTime();
  const end = new Date(y, m, 1).getTime();
  return t >= start && t < end;
}

export function BrandDetailDrawer({ row, milestones, open, onOpenChange }: BrandDetailDrawerProps) {
  // Chart range (Batch 005.5 #1) + clicked-month filter (#2). Hooks run
  // unconditionally (before the null-guard below).
  const [rangeMonths, setRangeMonths] = useState<6 | 12>(6);
  const [selectedMonthIso, setSelectedMonthIso] = useState<string | null>(null);

  // Reset the month filter whenever the drawer opens or the brand changes, so a
  // stale selection never carries across brands / reopens. Render-time reset
  // per React's "adjusting state on a prop change" pattern (no effect → avoids
  // set-state-in-effect); React re-renders immediately with the reset value.
  const resetKey = `${row?.brand.id ?? ''}:${open}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setSelectedMonthIso(null);
  }

  if (!row) return null;

  const { brand } = row;
  const rolling28Start = startOfRolling28().getTime();
  const recentMilestones = milestones
    .filter(m => !m.is_deleted && m.brand_id === brand.id && new Date(m.reached_at).getTime() >= rolling28Start)
    .sort((a, b) => new Date(b.reached_at).getTime() - new Date(a.reached_at).getTime())
    .slice(0, 20);

  // Bar-chart series follows the range dropdown (#1): 12mo reuses the 005.4
  // `monthly12` field, 6mo the existing `monthly`.
  const series = rangeMonths === 12 ? row.monthly12 : row.monthly;
  const chartData = series.map(m => ({ label: monthLabel(m.monthIso), monthIso: m.monthIso, count: m.count }));

  // List scope (#2): a clicked month filters to that month's milestones for this
  // brand; otherwise the default rolling-28d list. Client-side over data already
  // held — no new fetch.
  const monthMilestones = selectedMonthIso
    ? milestones
        .filter(m => !m.is_deleted && m.brand_id === brand.id && inMonth(m.reached_at, selectedMonthIso))
        .sort((a, b) => new Date(b.reached_at).getTime() - new Date(a.reached_at).getTime())
    : null;
  const listItems = monthMilestones ?? recentMilestones;
  const selectedLabel = selectedMonthIso ? monthYearLabel(selectedMonthIso) : null;

  function toggleMonth(iso: string) {
    setSelectedMonthIso(prev => (prev === iso ? null : iso));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{brand.display_name}</SheetTitle>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[color:var(--f92-gray)]">
            <span>{brand.brand_code}</span>
            {brand.is_paused ? (
              <Badge variant="default">Paused</Badge>
            ) : row.droughtFlag ? (
              <Badge variant="critical">Drought</Badge>
            ) : (
              <Badge variant="resolved">Active</Badge>
            )}
          </div>
        </SheetHeader>

        {/* Brand Wellness CTA — opens the read-only milestone-history proof for
            this brand on /dashboard/reports (deep-linked via ?wellnessBrand).
            Loose wiring (a plain Link, no new props): 005.2 re-homes this CTA
            when the drawer is rebuilt. */}
        <Link
          href={`/dashboard/reports?wellnessBrand=${brand.id}`}
          className="mt-4 inline-flex items-center gap-1 rounded-full border border-[color:var(--f92-border)] bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--f92-navy)] transition hover:border-[color:var(--f92-orange)] hover:text-[color:var(--f92-orange)]"
        >
          View Brand Wellness →
        </Link>

        {brand.is_paused ? (
          <div className="mt-4 rounded-xl border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] p-3 text-sm text-[color:var(--f92-dark)]">
            <p className="font-medium">Paused</p>
            {brand.paused_reason ? <p className="mt-1 text-xs text-[color:var(--f92-gray)]">{brand.paused_reason}</p> : null}
          </div>
        ) : null}

        {/* KPI cards — This Week / Last Week / Rolling 28d (Batch 005.5 #3
            dropped THIS MONTH: it duplicated the bar chart's current month and
            the Rolling 28d drought window). 3-up grid, no orphaned cell. */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[color:var(--f92-border)] bg-white p-3">
            <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">This Week</p>
            <p className="mt-1 text-2xl font-bold text-[color:var(--f92-navy)]">{row.testsCurrentWeek}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--f92-border)] bg-white p-3">
            <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Last Week</p>
            <p className="mt-1 text-2xl font-bold text-[color:var(--f92-navy)]">{row.testsLastWeek}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--f92-border)] bg-white p-3">
            <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Rolling 28d</p>
            <p className="mt-1 text-2xl font-bold text-[color:var(--f92-navy)]">{row.testsRolling28}</p>
          </div>
        </div>

        <div className="mt-6">
          {/* Range dropdown (#1) replaces the old static "Last 6 months" label. */}
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="brand-range" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              Deliveries by month
            </label>
            <select
              id="brand-range"
              value={rangeMonths}
              onChange={e => {
                setRangeMonths(Number(e.target.value) === 12 ? 12 : 6);
                setSelectedMonthIso(null); // range change clears the month filter
              }}
              className="rounded-md border border-[color:var(--f92-border)] bg-white px-2 py-1 text-xs text-[color:var(--f92-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
            >
              <option value={6}>Last 6 Months</option>
              <option value={12}>Last 12 Months</option>
            </select>
          </div>
          <div className="mt-2 [&_.recharts-bar-rectangle]:cursor-pointer">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData}>
                <XAxis dataKey="label" fontSize={11} stroke="#6B7280" />
                <YAxis fontSize={11} stroke="#6B7280" allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'var(--f92-tint)' }}
                  contentStyle={{
                    backgroundColor: 'var(--f92-surface)',
                    border: '1px solid var(--f92-border)',
                    borderRadius: 8,
                    color: 'var(--f92-dark)',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--f92-dark)', fontWeight: 600 }}
                  itemStyle={{ color: 'var(--f92-dark)' }}
                />
                {/* Clickable bars (#2): click a month → filter the list below;
                    the selected bar reads selected (navy outline), others dim. */}
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  onClick={(_, index) => {
                    const iso = chartData[index]?.monthIso;
                    if (iso) toggleMonth(iso);
                  }}
                >
                  {chartData.map(d => (
                    <Cell
                      key={d.monthIso}
                      fill="var(--f92-orange)"
                      fillOpacity={selectedMonthIso && selectedMonthIso !== d.monthIso ? 0.3 : 1}
                      stroke={selectedMonthIso === d.monthIso ? 'var(--f92-navy)' : undefined}
                      strokeWidth={selectedMonthIso === d.monthIso ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[10px] text-[color:var(--f92-lgray)]">Click a month to filter the list below.</p>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              {selectedMonthIso
                ? `Tests in ${selectedLabel} (${listItems.length})`
                : `Tests in last 28 days (${recentMilestones.length})`}
            </p>
            {selectedMonthIso ? (
              <button
                type="button"
                onClick={() => setSelectedMonthIso(null)}
                className="text-[10px] font-medium text-[color:var(--f92-navy)] transition hover:text-[color:var(--f92-orange)] hover:underline"
              >
                ← last 28 days
              </button>
            ) : null}
          </div>
          {listItems.length === 0 ? (
            <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
              {selectedMonthIso ? `No tests in ${selectedLabel}.` : 'No tests recorded in the last 28 days.'}
            </p>
          ) : (
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {listItems.map(m => (
                <li key={m.id} className="rounded-xl border border-[color:var(--f92-border)] bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    {m.jira_ticket_url ? (
                      <a
                        href={m.jira_ticket_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-[color:var(--f92-orange)] hover:underline"
                      >
                        {m.jira_ticket_id}
                      </a>
                    ) : (
                      <span className="font-medium text-[color:var(--f92-dark)]">{m.jira_ticket_id}</span>
                    )}
                    <span className="text-xs text-[color:var(--f92-gray)]">{formatDate(m.reached_at)}</span>
                  </div>
                  {m.jira_summary ? (
                    <p className="mt-1 text-xs text-[color:var(--f92-gray)] line-clamp-2">{m.jira_summary}</p>
                  ) : null}
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-[color:var(--f92-lgray)]">
                    {m.source} · {formatDateTime(m.reached_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
