"use client";

import { useFormStatus } from "react-dom";

export function SaveScheduleButton({ accountId }: { accountId: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid={`${accountId}-save`}
      className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors duration-200 ease-brand outline-none hover:bg-platinum focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save schedule"}
    </button>
  );
}
