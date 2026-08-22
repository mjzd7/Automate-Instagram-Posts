import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="font-mono text-5xl font-extrabold tracking-tight text-white">404</p>
      <p className="font-mono text-xs uppercase tracking-wider text-slate-muted">This route does not exist.</p>
      <Link
        href="/"
        data-testid="back-home"
        className="rounded-lg border border-white/10 px-4 py-2 font-mono text-sm text-slate-muted outline-none transition-colors duration-200 ease-brand hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
      >
        Back to overview
      </Link>
    </main>
  );
}
