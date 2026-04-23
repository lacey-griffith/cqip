'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { CoverageRow, Milestone } from '@/lib/coverage/queries';
import { startOfRolling28 } from '@/lib/coverage/queries';

interface BrandDetailDrawerProps {
  row: CoverageRow | null;
  milestones: Milestone[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  onManageMilestones: () => void;
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

function monthLabel(monthIso: string): string {
  const [y, m] = monthIso.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

export function BrandDetailDrawer({ row, milestones, open, onOpenChange, isAdmin, onManageMilestones }: BrandDetailDrawerProps) {
  if (!row) return null;

  const { brand } = row;
  const rolling28Start = startOfRolling28().getTime();
  const recentMilestones = milestones
    .filter(m => !m.is_deleted && m.brand_id === brand.id && new Date(m.reached_at).getTime() >= rolling28Start)
    .sort((a, b) => new Date(b.reached_at).getTime() - new Date(a.reached_at).getTime())
    .slice(0, 20);

  const chartData = row.monthly.map(m => ({ month: monthLabel(m.monthIso), count: m.count }));

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

        {brand.is_paused ? (
          <div className="mt-4 rounded-xl border border-[color:var(--f92-border)] bg-[color:var(--f92-warm)] p-3 text-sm text-[color:var(--f92-dark)]">
            <p className="font-medium">Paused</p>
            {brand.paused_reason ? <p className="mt-1 text-xs text-[color:var(--f92-gray)]">{brand.paused_reason}</p> : null}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
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
          <div className="rounded-xl border border-[color:var(--f92-border)] bg-white p-3">
            <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">This Month</p>
            <p className="mt-1 text-2xl font-bold text-[color:var(--f92-navy)]">{row.testsCurrentMonth}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Last 6 months</p>
          <div className="mt-2">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData}>
                <XAxis dataKey="month" fontSize={11} stroke="#6B7280" />
                <YAxis fontSize={11} stroke="#6B7280" allowDecimals={false} />
                <Tooltip cursor={{ fill: '#FEF6EE' }} />
                <Bar dataKey="count" fill="#F47920" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-widest text-[color:var(--f92-gray)]">Tests in last 28 days ({recentMilestones.length})</p>
          {recentMilestones.length === 0 ? (
            <p className="mt-2 text-sm text-[color:var(--f92-gray)]">No tests recorded in the last 28 days.</p>
          ) : (
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {recentMilestones.map(m => (
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

        {isAdmin ? (
          <div className="mt-6">
            <Button variant="secondary" size="sm" onClick={onManageMilestones}>
              Manage milestones
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
