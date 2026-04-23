// Severity + status → shadcn Badge variant maps. Lifted out of
// app/dashboard/logs/page.tsx so the dashboard LogDrawer can reuse the
// same color mapping without re-implementing. Both consumers import the
// `getSeverityVariant` / `getStatusVariant` helpers below.

export const severityVariant = {
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
} as const;

export type SeverityVariant = (typeof severityVariant)[keyof typeof severityVariant] | 'default';

export const statusVariant = {
  Open: 'open',
  'In Progress': 'in_progress',
  Blocked: 'blocked',
  'Pending Verification': 'pending',
  Resolved: 'resolved',
} as const;

export type StatusVariant = (typeof statusVariant)[keyof typeof statusVariant] | 'default';

export function getSeverityVariant(severity: string): SeverityVariant {
  return (severityVariant as Record<string, SeverityVariant>)[severity] ?? 'default';
}

export function getStatusVariant(status: string): StatusVariant {
  return (statusVariant as Record<string, StatusVariant>)[status] ?? 'default';
}
