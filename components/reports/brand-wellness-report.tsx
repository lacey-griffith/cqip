'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Milestone } from '@/lib/coverage/queries';

// Brand Wellness — read-only "proof" of a brand's real milestone history so a
// correct drought flag (e.g. MOJ: genuinely 0 milestones in rolling-28d) can be
// self-served instead of misread as "the coverage table is broken."
//
// SELF-CONTAINED: its own brand-picker + 30/60/90 range toggle (NOT the shared
// from/to card controls, NOT the ReportKind union) so Batch 005.2 can re-home it
// trivially. Owns its own fetch + state.
//
// TODO(brand-wellness v2): rework overlay (milestones vs sendbacks on one axis),
//   export / share, multi-brand compare. Out of scope for v1.

const RANGES = [30, 60, 90] as const;
type RangeDays = (typeof RANGES)[number];
const DAY_MS = 86_400_000;

interface BrandLite {
  id: string;
  display_name: string;
  jira_value: string;
  brand_code: string;
}

// Brand ↔ milestone resolution: brand_id primary, brand_jira_value fallback.
// NOTE: the drought counter (buildCoverageRows/countInWindow) and the Reggie
// drawer both match by brand_id ONLY. The jira_value fallback here is scoped to
// rows whose brand_id never resolved at ingest (§13 r18) — it surfaces genuinely
// -belonging legacy milestones a real-history proof should show, and for a brand
// with working resolution it is identical to brand_id-only in the recent window,
// so it never contradicts the drought flag for those brands.
function belongsToBrand(m: Milestone, brand: BrandLite): boolean {
  if (m.brand_id === brand.id) return true;
  return m.brand_id == null && m.brand_jira_value === brand.jira_value;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function daysAgo(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

export function BrandWellnessReport() {
  const [brands, setBrands] = useState<BrandLite[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<RangeDays>(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Mirror the coverage page: fetch all active brands + all non-deleted
      // milestones once, then filter client-side. Milestone volume is low
      // (one per delivered test) so a single fetch is cheap and lets the brand
      // picker + range toggle re-derive instantly with no refetch.
      const [brandsRes, msRes] = await Promise.all([
        supabase
          .from('brands')
          .select('id, display_name, jira_value, brand_code')
          .eq('is_active', true)
          .order('display_name', { ascending: true }),
        supabase
          .from('test_milestones')
          .select('id, jira_ticket_id, jira_ticket_url, jira_summary, brand_id, brand_jira_value, milestone_type, reached_at, source, is_deleted')
          .eq('is_deleted', false),
      ]);
      if (cancelled) return;
      if (brandsRes.error || msRes.error) {
        console.error(brandsRes.error || msRes.error);
        setError('Unable to load Brand Wellness data.');
        setLoading(false);
        return;
      }
      const loadedBrands = (brandsRes.data ?? []) as BrandLite[];
      setBrands(loadedBrands);
      setMilestones((msRes.data ?? []) as Milestone[]);

      // Deep-link preselect from the Reggie drawer CTA (?wellnessBrand=<id>).
      const param =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('wellnessBrand')
          : null;
      if (param && loadedBrands.some(b => b.id === param)) {
        setSelectedId(param);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBrand = useMemo(
    () => brands.find(b => b.id === selectedId) ?? null,
    [brands, selectedId],
  );

  // All-time, newest first — the headline needs the true last milestone so a
  // drought brand proves "last delivery was N days ago", not "No milestones".
  const brandMilestones = useMemo(() => {
    if (!selectedBrand) return [] as Milestone[];
    return milestones
      .filter(m => belongsToBrand(m, selectedBrand))
      .sort((a, b) => new Date(b.reached_at).getTime() - new Date(a.reached_at).getTime());
  }, [milestones, selectedBrand]);

  const lastMilestone = brandMilestones[0] ?? null;

  // Pin "now" at mount — a lazy useState initializer is render-safe, whereas
  // Date.now() inside a useMemo is flagged impure-during-render. The range
  // window is relative to page load, which is fine for a report view.
  const [nowMs] = useState(() => Date.now());
  const rangeStartMs = useMemo(() => nowMs - rangeDays * DAY_MS, [nowMs, rangeDays]);

  const inRange = useMemo(
    () => brandMilestones.filter(m => new Date(m.reached_at).getTime() >= rangeStartMs),
    [brandMilestones, rangeStartMs],
  );

  const scatterData = useMemo(
    () =>
      inRange.map(m => ({
        x: new Date(m.reached_at).getTime(),
        y: 1,
        ticket: m.jira_ticket_id,
        reachedISO: m.reached_at,
      })),
    [inRange],
  );

  return (
    <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Report</p>
          <h2 className="mt-1 text-2xl font-semibold text-[color:var(--f92-dark)]">Brand Wellness</h2>
          <p className="mt-1 text-sm text-[color:var(--f92-gray)]">
            A brand&apos;s real milestone history — proof of when tests were actually delivered. A gap on the
            timeline is a genuine gap, not a broken table.
          </p>
        </div>
      </div>

      {/* Controls: brand picker + range toggle (self-contained) */}
      <div className="mt-5 flex flex-wrap items-end gap-4">
        <div className="min-w-[16rem]">
          <Label htmlFor="wellness-brand" className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
            Brand
          </Label>
          <Select value={selectedId ?? ''} onValueChange={value => setSelectedId(value)}>
            <SelectTrigger id="wellness-brand">
              <SelectValue placeholder={loading ? 'Loading brands…' : 'Select a brand'} />
            </SelectTrigger>
            <SelectContent>
              {brands.map(b => (
                <SelectItem key={b.id} value={b.id}>
                  {b.display_name} ({b.brand_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Range</p>
          <div className="mt-1 flex gap-2">
            {RANGES.map(r => (
              <Button
                key={r}
                type="button"
                size="sm"
                variant={rangeDays === r ? 'default' : 'outline'}
                onClick={() => setRangeDays(r)}
              >
                {r}d
              </Button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : !selectedBrand ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] p-8 text-center text-sm text-[color:var(--f92-gray)]">
          Pick a brand to see its milestone history.
        </div>
      ) : (
        <>
          {/* Headline — all-time last milestone (drought proof) */}
          <div className="mt-6 rounded-2xl border border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] p-4">
            {lastMilestone ? (
              <p className="text-sm text-[color:var(--f92-dark)]">
                <span className="font-semibold">Last milestone:</span> {fmtDate(lastMilestone.reached_at)}
                {' · '}
                <span className={cn(daysAgo(lastMilestone.reached_at) > 28 && 'font-semibold text-[color:var(--f92-orange)]')}>
                  {daysAgo(lastMilestone.reached_at)} days ago
                </span>
                {' · '}
                {lastMilestone.jira_ticket_url ? (
                  <a
                    href={lastMilestone.jira_ticket_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[color:var(--f92-orange)] hover:underline"
                  >
                    {lastMilestone.jira_ticket_id}
                  </a>
                ) : (
                  <span>{lastMilestone.jira_ticket_id}</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-[color:var(--f92-dark)]">No milestones on record.</p>
            )}
          </div>

          {/* Dot timeline — one dot per non-deleted milestone across the range,
              on a real time axis so gaps read visually. */}
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              Milestones in the last {rangeDays} days ({inRange.length})
            </p>
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={110}>
                <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[rangeStartMs, nowMs]}
                    scale="time"
                    tickFormatter={(ms: number) =>
                      new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    }
                    fontSize={11}
                    stroke="#6B7280"
                    tickCount={6}
                  />
                  <YAxis type="number" dataKey="y" domain={[0, 2]} hide />
                  <ZAxis type="number" range={[90, 90]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      backgroundColor: 'var(--f92-surface)',
                      border: '1px solid var(--f92-border)',
                      borderRadius: 8,
                      color: 'var(--f92-dark)',
                      fontSize: 12,
                    }}
                    formatter={(_value, _name, entry: { payload?: { ticket?: string } }) => [
                      entry?.payload?.ticket ?? '',
                      'Ticket',
                    ]}
                    labelFormatter={label => fmtDate(new Date(Number(label)).toISOString())}
                  />
                  <Scatter data={scatterData} fill="#F47920" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            {inRange.length === 0 ? (
              <p className="mt-1 text-xs text-[color:var(--f92-gray)]">
                No milestones in the last {rangeDays} days
                {lastMilestone ? ` — the last one was ${daysAgo(lastMilestone.reached_at)} days ago.` : '.'}
              </p>
            ) : null}
          </div>

          {/* Milestone list — newest first */}
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">
              Milestone list ({inRange.length})
            </p>
            {inRange.length === 0 ? (
              <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
                No milestones in this range.
              </p>
            ) : (
              <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto">
                {inRange.map(m => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--f92-border)] bg-white p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium text-[color:var(--f92-dark)]">{fmtDate(m.reached_at)}</span>
                      <span className="text-xs uppercase tracking-widest text-[color:var(--f92-gray)]">
                        {m.milestone_type}
                      </span>
                      {m.jira_ticket_url ? (
                        <a
                          href={m.jira_ticket_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[color:var(--f92-orange)] hover:underline"
                        >
                          {m.jira_ticket_id}
                        </a>
                      ) : (
                        <span className="text-[color:var(--f92-dark)]">{m.jira_ticket_id}</span>
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-[color:var(--f92-lgray)]">
                      {m.source}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
