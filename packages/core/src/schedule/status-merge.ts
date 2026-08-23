import type { PipelineEntry, PipelineEntryStatus } from "./generator.js";

/** Sentinel settings.accountId under which pipeline state is stored. */
export const PIPELINE_STATUS_ACCOUNT = "__pipeline__";

export function statusKey(month: string): string {
  return `statuses:${month}`;
}

export type EntryStatusMap = Partial<Record<string, Extract<PipelineEntryStatus, "published" | "failed" | "skipped">>>;

/**
 * Zips executed batch results onto their due entries by index (the runner
 * executes due entries in order). Entries beyond the results array were
 * never attempted (e.g. consecutive-failure abort) and stay unrecorded --
 * they keep their planned status honestly.
 */
export function zipStatuses(
  due: Pick<PipelineEntry, "id">[],
  items: Array<{ status: string }>,
): EntryStatusMap {
  const map: EntryStatusMap = {};
  const n = Math.min(due.length, items.length);
  for (let i = 0; i < n; i += 1) {
    const status = items[i]?.status;
    if (status === "published" || status === "failed" || status === "skipped") {
      const id = due[i]?.id;
      if (id) map[id] = status;
    }
  }
  return map;
}

/** Merges newly observed statuses over previously stored ones. */
export function mergeStatuses(existing: EntryStatusMap, incoming: EntryStatusMap): EntryStatusMap {
  return { ...existing, ...incoming };
}

export function parseStatuses(raw: string | undefined): EntryStatusMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as EntryStatusMap;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
