import type { PipelineFile, PipelineEntry } from "./generator.js";
import { localDateIso, localHour } from "./wall-time.js";
import type { EntryStatusMap } from "./status-merge.js";

/**
 * Binding-lite runner contract: returns this account's PLANNED entries whose
 * account-local wall time (date + hour) is due on or before `now` on the current date.
 * The batch runner executes exactly these when a current-month pipeline file exists,
 * and falls back to legacy ad-hoc behaviour when it does not.
 */
export function dueEntries(
  file: PipelineFile,
  accountId: string,
  now: Date,
  timezone: string,
  liveStatuses?: EntryStatusMap,
): PipelineEntry[] {
  const date = localDateIso(now, timezone);
  const hour = localHour(now, timezone);
  return file.entries.filter((entry) => {
    if (entry.accountId !== accountId) return false;
    if (entry.date !== date || entry.hour > hour) return false;
    const effectiveStatus = liveStatuses?.[entry.id] ?? entry.status;
    return effectiveStatus === "planned";
  });
}

