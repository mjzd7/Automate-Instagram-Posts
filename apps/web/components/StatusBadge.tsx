const STATUS_STYLES: Record<string, string> = {
  published: "bg-white text-black",
  failed: "border border-red-500/40 text-red-400",
  planned: "border border-white/10 text-slate-muted",
  skipped: "border border-white/10 text-slate-muted",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-amber-live/15 text-amber-live";
  return (
    <span
      data-testid="status-badge"
      className={`inline-block rounded-md px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${style}`}
    >
      {status}
    </span>
  );
}
