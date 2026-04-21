'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, Sector, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { ActiveAlertsPanel } from '@/components/dashboard/active-alerts-panel';
import { CollapsibleCard } from '@/components/dashboard/collapsible-card';
import { useTheme } from '@/components/layout/theme-provider';
import { useToast } from '@/components/layout/toaster';
import { useLoadingMessage } from '@/lib/easter-eggs/use-loading-message';
import { supabase } from '@/lib/supabase/client';

interface KPIData {
  totalLogsThisMonth: number;
  openCount: number;
  inProgressCount: number;
  criticalIssuesOpen: number;
  mostFrequentRootCause: string | null;
}

interface ChartData {
  volumeByWeek: Array<{ week: string; count: number }>;
  issueCategory: Array<{ name: string; value: number }>;
  severityDistribution: Array<{ severity: string; count: number }>;
  rootCauseFrequency: Array<{ cause: string; count: number }>;
}

function LoadingPanel() {
  const message = useLoadingMessage();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center py-12">
        <p className="text-[color:var(--f92-gray)]">{message}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KPIData>({
    totalLogsThisMonth: 0,
    openCount: 0,
    inProgressCount: 0,
    criticalIssuesOpen: 0,
    mostFrequentRootCause: null,
  });

  const [charts, setCharts] = useState<ChartData>({
    volumeByWeek: [],
    issueCategory: [],
    severityDistribution: [],
    rootCauseFrequency: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const gridStroke = isDark ? '#2D3148' : '#E8D5C4';
  const axisColor = isDark ? '#94A3B8' : '#6B7280';
  const cursorFill = isDark ? 'rgba(42,47,69,0.6)' : '#FEF6EE';
  const tooltipContentStyle = {
    background: isDark ? '#1E2235' : '#FFFFFF',
    border: `1px solid ${isDark ? '#2D3148' : '#E8D5C4'}`,
    borderRadius: 12,
    color: isDark ? '#E2E8F0' : '#1A1A2E',
    padding: '8px 12px',
  } as const;
  const tooltipLabelStyle = {
    color: isDark ? '#E2E8F0' : '#1A1A2E',
    fontWeight: 600,
  } as const;
  const tooltipItemStyle = {
    color: isDark ? '#CBD5E1' : '#1A1A2E',
  } as const;

  const [pieHover, setPieHover] = useState<{ name: string; value: number } | null>(null);
  const { toast } = useToast();
  const [cleanStreakDays, setCleanStreakDays] = useState<number | null>(null);

  // 1-in-5 chance per mount to drop a tiny celebratory glyph next to the
  // "all clear" KPI when critical = 0. Computed in an effect (client-only)
  // so SSR and hydration agree on the initial null value.
  const [sparkleEmoji, setSparkleEmoji] = useState<string | null>(null);
  useEffect(() => {
    if (Math.random() < 1 / 5) {
      setSparkleEmoji(Math.random() < 0.5 ? '🎊' : '⭐');
    }
  }, []);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);

        // Get current date and month start
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Fetch all logs for the month (not deleted)
        const { data: monthLogs, error: monthError } = await supabase
          .from('quality_logs')
          .select('*')
          .eq('is_deleted', false)
          .gte('triggered_at', monthStart)
          .lte('triggered_at', now.toISOString());

        if (monthError) throw monthError;

        // Fetch all logs for chart data (last 3 months)
        const { data: allLogs, error: allError } = await supabase
          .from('quality_logs')
          .select('*')
          .eq('is_deleted', false)
          .gte('triggered_at', new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString());

        if (allError) throw allError;

        // Calculate KPIs
        const openCount = (monthLogs || []).filter(l => l.log_status === 'Open').length;
        const inProgressCount = (monthLogs || []).filter(l => l.log_status === 'In Progress').length;
        const criticalIssuesOpen = (monthLogs || [])
          .filter(l => l.severity === 'Critical' && ['Open', 'In Progress'].includes(l.log_status))
          .length;

        // Find most frequent root cause this month
        const rootCauseCounts: { [key: string]: number } = {};
        (monthLogs || []).forEach(log => {
          if (log.root_cause_final && Array.isArray(log.root_cause_final) && log.root_cause_final.length > 0) {
            log.root_cause_final.forEach((cause: string) => {
              rootCauseCounts[cause] = (rootCauseCounts[cause] || 0) + 1;
            });
          }
        });

        const mostFrequentRootCause = Object.keys(rootCauseCounts).length > 0
          ? Object.keys(rootCauseCounts).reduce((a, b) =>
              rootCauseCounts[a] > rootCauseCounts[b] ? a : b
            )
          : null;

        setKpi({
          totalLogsThisMonth: monthLogs?.length || 0,
          openCount,
          inProgressCount,
          criticalIssuesOpen,
          mostFrequentRootCause,
        });

        // Prepare chart data
        if (allLogs && allLogs.length > 0) {
          // Rework volume by week
          const volumeByWeek: { [key: string]: number } = {};
          (allLogs || []).forEach(log => {
            const date = new Date(log.triggered_at);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
            const weekKey = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            volumeByWeek[weekKey] = (volumeByWeek[weekKey] || 0) + 1;
          });

          setCharts(prev => ({
            ...prev,
            volumeByWeek: Object.entries(volumeByWeek)
              .map(([week, count]) => ({ week, count }))
              .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime()),
          }));

          // Issue category breakdown
          const categoryCount: { [key: string]: number } = {};
          (allLogs || []).forEach(log => {
            if (log.issue_category && Array.isArray(log.issue_category)) {
              log.issue_category.forEach((cat: string) => {
                categoryCount[cat] = (categoryCount[cat] || 0) + 1;
              });
            }
          });

          setCharts(prev => ({
            ...prev,
            issueCategory: Object.entries(categoryCount).map(([name, value]) => ({ name, value })),
          }));

          // Severity distribution
          const severityCount: { [key: string]: number } = {};
          (allLogs || []).forEach(log => {
            const severity = log.severity || 'Unknown';
            severityCount[severity] = (severityCount[severity] || 0) + 1;
          });

          const severityOrder = ['Low', 'Medium', 'High', 'Critical'];
          const severityRows = severityOrder
            .filter(s => severityCount[s] !== undefined)
            .map(s => ({ severity: s, count: severityCount[s] }));
          const unknownExtras = Object.entries(severityCount)
            .filter(([s]) => !severityOrder.includes(s))
            .map(([severity, count]) => ({ severity, count }));

          setCharts(prev => ({
            ...prev,
            severityDistribution: [...severityRows, ...unknownExtras],
          }));

          // Root cause frequency
          const rootCauseCount: { [key: string]: number } = {};
          (allLogs || []).forEach(log => {
            if (log.root_cause_final && Array.isArray(log.root_cause_final)) {
              log.root_cause_final.forEach((cause: string) => {
                rootCauseCount[cause] = (rootCauseCount[cause] || 0) + 1;
              });
            }
          });

          setCharts(prev => ({
            ...prev,
            rootCauseFrequency: Object.entries(rootCauseCount)
              .map(([cause, count]) => ({ cause, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 8),
          }));
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();

    // Egg #5 — clean streak: how many days since the most recent log?
    (async () => {
      const { data } = await supabase
        .from('quality_logs')
        .select('triggered_at')
        .eq('is_deleted', false)
        .order('triggered_at', { ascending: false })
        .limit(1);
      const latest = data?.[0]?.triggered_at;
      if (!latest) {
        setCleanStreakDays(null);
        return;
      }
      const days = Math.floor((Date.now() - new Date(latest).getTime()) / (1000 * 60 * 60 * 24));
      setCleanStreakDays(days);
    })();
  }, []);

  const severityColors: { [key: string]: string } = {
    Critical: '#DC2626',
    High: '#F97316',
    Medium: '#EAB308',
    Low: '#9CA3AF',
    Unknown: '#6B7280',
  };

  const renderActiveCategory = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, midAngle } = props;
    const RAD = Math.PI / 180;
    const offset = 10;
    const dx = Math.cos(-RAD * midAngle) * offset;
    const dy = Math.sin(-RAD * midAngle) * offset;
    return (
      <g
        style={{ transition: 'transform 200ms ease-out' }}
        transform={`translate(${dx}, ${dy})`}
      >
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    );
  };

  const categoryColors = [
    '#F47920', // orange (primary)
    '#1E2D6B', // navy
    '#DC2626', // critical red
    '#F97316', // high orange
    '#EAB308', // medium yellow
    '#9CA3AF', // low gray
    '#3B82F6', // blue
    '#8B5CF6', // purple
  ];

  if (loading) {
    return <LoadingPanel />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">Error loading dashboard: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">Quality Intelligence Platform</h1>
            <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
              Monitor rework events, analyze trends, and track quality metrics across your CRO projects.
            </p>
          </div>
          {cleanStreakDays !== null && cleanStreakDays >= 7 ? (
            <button
              type="button"
              onClick={() => toast('🚀 The team is crushing it!')}
              className="cqip-streak-bounce inline-flex items-center gap-2 rounded-full border border-[color:var(--f92-border)] bg-[color:var(--f92-tint)] px-3 py-1.5 text-xs font-semibold text-[color:var(--f92-navy)] transition hover:bg-[color:var(--f92-warm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
              aria-label={`${cleanStreakDays}-day clean streak`}
            >
              <span aria-hidden="true">🌟</span>
              {cleanStreakDays}-day clean streak!
            </button>
          ) : null}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Total Logs This Month */}
        <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase text-[color:var(--f92-gray)]">Total Logs</p>
          <p className="mt-3 text-4xl font-bold text-[color:var(--f92-navy)]">{kpi.totalLogsThisMonth}</p>
          <p className="mt-2 text-xs text-[color:var(--f92-gray)]">This month</p>
        </Card>

        {/* Open Count */}
        <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase text-[color:var(--f92-gray)]">Open</p>
          <p className="mt-3 text-4xl font-bold text-blue-500">{kpi.openCount}</p>
          <p className="mt-2 text-xs text-[color:var(--f92-gray)]">Requires action</p>
        </Card>

        {/* In Progress Count */}
        <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase text-[color:var(--f92-gray)]">In Progress</p>
          <p className="mt-3 text-4xl font-bold text-indigo-500">{kpi.inProgressCount}</p>
          <p className="mt-2 text-xs text-[color:var(--f92-gray)]">Being worked on</p>
        </Card>

        {/* Critical Issues Open */}
        <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase text-[color:var(--f92-gray)]">Critical</p>
          <p className="mt-3 text-4xl font-bold text-red-600">{kpi.criticalIssuesOpen}</p>
          <p className="mt-2 text-xs text-[color:var(--f92-gray)]">
            {kpi.criticalIssuesOpen === 0 ? (
              <>All systems normal{sparkleEmoji ? <span className="ml-1" aria-hidden="true">{sparkleEmoji}</span> : null}</>
            ) : (
              'Open/In Progress'
            )}
          </p>
        </Card>

        {/* Most Frequent Root Cause */}
        <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase text-[color:var(--f92-gray)]">Top Root Cause</p>
          <p className="mt-3 line-clamp-2 text-sm font-semibold text-[color:var(--f92-navy)]">
            {kpi.mostFrequentRootCause || 'N/A'}
          </p>
          <p className="mt-2 text-xs text-[color:var(--f92-gray)]">This month</p>
        </Card>
      </div>

      {/* Active Alerts Panel */}
      <ActiveAlertsPanel />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Rework Volume by Week */}
        <CollapsibleCard title="Rework Volume (Weekly)">
          {charts.volumeByWeek.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.volumeByWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="week" fontSize={12} stroke={axisColor} tick={{ fill: axisColor }} />
                <YAxis fontSize={12} stroke={axisColor} tick={{ fill: axisColor }} />
                <Tooltip
                  cursor={{ fill: cursorFill }}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="count" fill="#F47920" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[color:var(--f92-gray)]">No data available</p>
          )}
        </CollapsibleCard>

        {/* Issue Category Breakdown */}
        <CollapsibleCard title="Issue Category Breakdown">
          {charts.issueCategory.length > 0 ? (
            <div className="relative">
              {pieHover ? (
                <div
                  className="absolute right-2 top-2 z-10 rounded-xl border border-[color:var(--f92-border)] bg-[color:var(--f92-surface)] px-3 py-2 text-xs shadow-md"
                  role="status"
                  aria-live="polite"
                >
                  <p className="font-semibold text-[color:var(--f92-navy)]">{pieHover.name}</p>
                  <p className="mt-0.5 text-[color:var(--f92-dark)]">
                    {pieHover.value}{' '}
                    <span className="text-[color:var(--f92-gray)]">
                      ({((pieHover.value / charts.issueCategory.reduce((s, c) => s + c.value, 0)) * 100).toFixed(1)}%)
                    </span>
                  </p>
                </div>
              ) : null}
              <ResponsiveContainer width="100%" height={240} className="donut-chart">
                <PieChart>
                  <Pie
                    data={charts.issueCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    activeShape={renderActiveCategory}
                    isAnimationActive={false}
                    onMouseEnter={(slice: { name?: string; value?: number }) =>
                      setPieHover({ name: slice.name ?? '', value: slice.value ?? 0 })
                    }
                    onMouseLeave={() => setPieHover(null)}
                  >
                    {charts.issueCategory.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={categoryColors[index % categoryColors.length]}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-[color:var(--f92-gray)]">No data available</p>
          )}
        </CollapsibleCard>

        {/* Severity Distribution */}
        <CollapsibleCard title="Severity Distribution">
          {charts.severityDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.severityDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="severity" fontSize={12} stroke={axisColor} tick={{ fill: axisColor }} />
                <YAxis fontSize={12} stroke={axisColor} tick={{ fill: axisColor }} />
                <Tooltip
                  cursor={{ fill: cursorFill }}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="count" fill="#1E2D6B" radius={[8, 8, 0, 0]}>
                  {charts.severityDistribution.map((item, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={severityColors[item.severity] || severityColors['Unknown']}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[color:var(--f92-gray)]">No data available</p>
          )}
        </CollapsibleCard>

        {/* Root Cause Frequency */}
        <CollapsibleCard title="Top Root Causes">
          {charts.rootCauseFrequency.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={charts.rootCauseFrequency}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis type="number" fontSize={12} stroke={axisColor} tick={{ fill: axisColor }} />
                <YAxis dataKey="cause" type="category" fontSize={11} width={195} stroke={axisColor} tick={{ fill: axisColor }} />
                <Tooltip
                  cursor={{ fill: cursorFill }}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="count" fill="#F47920" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[color:var(--f92-gray)]">No data available</p>
          )}
        </CollapsibleCard>
      </div>
    </div>
  );
}
