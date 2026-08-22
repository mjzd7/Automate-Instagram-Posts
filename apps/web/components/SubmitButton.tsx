"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./ui";
import type { ReactNode } from "react";

export function SubmitButton({ children, pendingLabel = "Working…" }: { children: ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? pendingLabel : children}</Button>;
}
