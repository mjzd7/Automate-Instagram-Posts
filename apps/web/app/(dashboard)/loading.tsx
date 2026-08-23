export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" data-testid="route-skeleton" aria-busy="true" aria-label="Loading">
      <div>
        <div className="h-7 w-40 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-2 h-3 w-72 animate-pulse rounded bg-white/5" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[104px] animate-pulse rounded-2xl border border-white/10 bg-[rgba(18,18,22,0.85)]"
          />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl border border-white/10 bg-[rgba(18,18,22,0.85)]" />
    </div>
  );
}
