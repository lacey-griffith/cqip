'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { ActiveAlertsPanel } from '@/components/dashboard/active-alerts-panel';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

          setCharts(prev => ({
            ...prev,
            severityDistribution: Object.entries(severityCount).map(([severity, count]) => ({
              severity,
              count,
            })),
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
  }, []);

  const severityColors: { [key: string]: string } = {
    Critical: '#DC2626',
    High: '#F97316',
    Medium: '#EAB308',
    Low: '#9CA3AF',
    Unknown: '#6B7280',
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
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
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
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">Quality Intelligence Platform</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
          Monitor rework events, analyze trends, and track quality metrics across your CRO projects.
        </p>
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
          <p className="mt-2 text-xs text-[color:var(--f92-gray)]">Open/In Progress</p>
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
        <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-[color:var(--f92-navy)]">Rework Volume (Weekly)</h3>
          {charts.volumeByWeek.length > 0 ? (
            <ResponsiveContainer width="100%" height={240} className="mt-4">
              <BarChart data={charts.volumeByWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D5C4" />
                <XAxis dataKey="week" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip cursor={{ fill: '#FEF6EE' }} />
                <Bar dataKey="count" fill="#F47920" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No data available</p>
          )}
        </Card>

        {/* Issue Category Breakdown */}
        <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-[color:var(--f92-navy)]">Issue Category Breakdown</h3>
          {charts.issueCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={240} className="mt-4">
              <PieChart>
                <Pie
                  data={charts.issueCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {charts.issueCategory.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={categoryColors[index % categoryColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No data available</p>
          )}
        </Card>

        {/* Severity Distribution */}
        <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-[color:var(--f92-navy)]">Severity Distribution</h3>
          {charts.severityDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={240} className="mt-4">
              <BarChart data={charts.severityDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D5C4" />
                <XAxis dataKey="severity" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip cursor={{ fill: '#FEF6EE' }} />
                <Bar
                  dataKey="count"
                  fill="#1E2D6B"
                  radius={[8, 8, 0, 0]}
                >
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
            <p className="mt-4 text-sm text-gray-500">No data available</p>
          )}
        </Card>

        {/* Root Cause Frequency */}
        <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-[color:var(--f92-navy)]">Top Root Causes</h3>
          {charts.rootCauseFrequency.length > 0 ? (
            <ResponsiveContainer width="100%" height={240} className="mt-4">
              <BarChart
                data={charts.rootCauseFrequency}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E8D5C4" />
                <XAxis type="number" fontSize={12} />
                <YAxis dataKey="cause" type="category" fontSize={11} width={195} />
                <Tooltip cursor={{ fill: '#FEF6EE' }} />
                <Bar dataKey="count" fill="#F47920" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No data available</p>
          )}
        </Card>
      </div>
    </div>
  );
}
