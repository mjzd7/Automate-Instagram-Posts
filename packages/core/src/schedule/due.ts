import type { PipelineFile, PipelineEntry } from "./generator";
import { localDateIso, localHour } from "./wall-time";

/**
 * Binding-lite runner contract: returns this account's PLANNED entries whose
 * account-local wall time (date + hour) matches `now`. The batch runner
 * executes exactly these when a current-month pipeline file exists, and
 * falls back to legacy ad-hoc behaviour when it does not.
 */
export function dueEntries(file: PipelineFile, accountId: string, now: Date, timezone: string): PipelineEntry[] {
  const date = localDateIso(now, timezone);
  const hour = localHour(now, timezone);
  return file.entries.filter(
    (entry) => entry.accountId === accountId && entry.status === "planned" && entry.date === date && entry.hour === hour,
  );
}
