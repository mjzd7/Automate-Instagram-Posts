"use client";

import { TriNodeMark } from "@/components/TriNodeMark";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[rgba(18,18,22,0.85)] p-8 text-center shadow-titanium backdrop-blur-[20px]">
      <div className="mb-4 flex justify-center text-white">
        <TriNodeMark size={36} />
      </div>
      <h1 className="font-display text-xl font-bold tracking-tight text-white">Something broke.</h1>
      <p className="mt-2 font-mono text-xs text-slate-muted">The dashboard hit an unexpected error.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-white px-4 py-2 font-mono text-sm font-medium text-black transition-colors duration-200 ease-brand outline-none hover:bg-platinum focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        Retry
      </button>
    </div>
  );
}
