import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[color:var(--f92-bg)] px-6 py-16 text-[color:var(--f92-dark)]">
      <div className="w-full max-w-lg rounded-3xl border border-[color:var(--f92-border)] bg-[color:var(--f92-surface)] p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 inline-flex h-20 w-20 rotate-[-12deg] items-center justify-center">
          <Image src="/cqip-logo.svg" alt="" width={80} height={80} priority />
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">404</p>
        <h1 className="mt-2 text-3xl font-semibold">
          Hmm... this page got sent back to development <span aria-hidden="true">👀</span>
        </h1>
        <p className="mt-3 text-sm text-[color:var(--f92-gray)]">
          Don&apos;t worry, we logged it.
        </p>
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--f92-orange)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--f92-surface)]"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
