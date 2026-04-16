export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[color:var(--f92-border)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--f92-navy)]">Dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--f92-dark)]">Welcome to CQIP</h1>
        <p className="mt-2 text-sm text-[color:var(--f92-gray)]">
          Monitor rework events, analyze trends, and review ticket history from your CRO projects.
        </p>
      </div>
    </div>
  );
}
