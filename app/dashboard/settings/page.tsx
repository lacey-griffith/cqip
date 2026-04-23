'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';

const settingsSections = [
  {
    title: 'Profile',
    description: 'Update your avatar color and change your password.',
    href: '/dashboard/settings/profile',
    icon: '👤',
  },
  {
    title: 'Alert Rules',
    description: 'Configure automated alerts for quality monitoring and issue detection.',
    href: '/dashboard/settings/alerts',
    icon: '🔔',
  },
  {
    title: 'Projects',
    description: 'Manage project configurations and settings.',
    href: '/dashboard/settings/projects',
    icon: '📁',
  },
  {
    title: 'Users',
    description: 'Manage user accounts and permissions.',
    href: '/dashboard/settings/users',
    icon: '👥',
  },
  {
    title: 'Change Log',
    description: 'Admin-only audit trail of every create, update, delete, and status change.',
    href: '/dashboard/settings/audit',
    icon: '📜',
  },
  {
    title: 'Client Coverage',
    description: 'Admin-only: add, edit, or delete test milestones.',
    href: '/dashboard/settings/coverage',
    icon: '🎯',
  },
  {
    title: 'System Info',
    description: 'Build version and deploy status. Admin-only.',
    href: '/dashboard/settings/system',
    icon: '⚙️',
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">System Configuration</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
          Manage system settings, user permissions, and configuration options.
        </p>
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="border-[color:var(--f92-border)] bg-white p-6 shadow-sm transition hover:shadow-md cursor-pointer">
              <div className="text-2xl mb-3">{section.icon}</div>
              <h3 className="text-lg font-semibold text-[color:var(--f92-navy)] mb-2">
                {section.title}
              </h3>
              <p className="text-sm text-[color:var(--f92-gray)]">
                {section.description}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
