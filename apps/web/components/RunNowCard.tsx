"use client";

import { useFormStatus } from "react-dom";
import { triggerPostRun } from "@/lib/actions/runner-actions";

export function RunNowForm({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <form action={triggerPostRun} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending || disabled}
        data-testid="run-now"
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors duration-200 ease-brand outline-none hover:bg-platinum focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Dispatching…" : "Run post.yml now"}
      </button>
      {disabled && (
        <span className="font-mono text-[11px] text-slate-muted">
          set DASHBOARD_ACTIONS_PAT (Actions: write) to enable
        </span>
      )}
    </form>
  );
}
