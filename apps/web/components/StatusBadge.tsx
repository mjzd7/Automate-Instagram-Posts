export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "published"
      ? "bg-primary/20 text-primary"
      : status === "failed"
        ? "bg-red-500/20 text-red-400"
        : "bg-white/10 text-text-secondary";
  return <span className={`rounded-control px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>;
}
