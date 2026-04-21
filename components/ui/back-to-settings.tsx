'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function BackToSettings() {
  return (
    <Link
      href="/dashboard/settings"
      className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--f92-orange)] transition hover:underline focus-visible:outline-none focus-visible:underline"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      Back to Settings
    </Link>
  );
}
