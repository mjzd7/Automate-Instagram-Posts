import type { Account } from "../config/accounts.js";
import { daysInMonth, resolveWallTime } from "./wall-time";

export type PipelineEntryStatus = "planned" | "published" | "failed" | "skipped";

export interface PipelineEntry {
  /** `${accountId}:${localDate}:${localHour}` — deterministic, dedupable. */
  id: string;
  accountId: string;
  /** Account-local calendar date, YYYY-MM-DD. */
  date: string;
  /** Account-local wall-clock hour, 0-23. */
  hour: number;
  templateId?: string;
  categoryId?: string;
  status: PipelineEntryStatus;
}

export interface PipelineFile {
  month: string;
  seed: string;
  generatedAt: string;
  entries: PipelineEntry[];
}

export interface GenerateOptions {
  /** All template ids the pipeline may assign (code-defined templates). */
  templateIdsArray: string[];
  now?: () => Date;
}

/** FNV-1a 32-bit — stable across engines; no Math.random anywhere here. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function pipelineSeed(month: string, accounts: Pick<Account, "id">[]): string {
  const canonical = accounts
    .map((a) => a.id)
    .sort()
    .join(",");
  return `${month}:${fnv1a(canonical).toString(16)}`;
}

/**
 * Greedy max-min-gap selection over sorted-unique hours: pick `cap` entries,
 * each next hour maximising distance to the chosen set (tiebreak earliest).
 * Deterministic spread under any cap.
 */
export function selectHours(hours: number[], cap: number): number[] {
  const uniqueSorted = [...new Set(hours)].sort((a, b) => a - b);
  if (cap >= uniqueSorted.length) return uniqueSorted;
  if (cap <= 0) return [];
  const first = uniqueSorted[0];
  if (first === undefined) return [];
  const chosen: number[] = [first];
  while (chosen.length < cap) {
    let best = -1;
    let bestDist = -1;
    for (const candidate of uniqueSorted) {
      if (chosen.includes(candidate)) continue;
      const dist = Math.min(...chosen.map((c) => Math.abs(candidate - c)));
      if (dist > bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    if (best < 0) break;
    chosen.push(best);
  }
  return chosen.sort((a, b) => a - b);
}

/**
 * Builds the full planned entry set for one month. Pure: same inputs always
 * yield identical output. DST handling lives entirely in resolveWallTime —
 * spring-forward gaps are skipped, fall-back repeats schedule once.
 */
export function generateMonth(month: string, accounts: Account[], options: GenerateOptions): PipelineFile {
  const generatedAt = (options.now ?? (() => new Date()))().toISOString();
  const seed = pipelineSeed(month, accounts);
  const seedBase = fnv1a(seed);
  const entries: PipelineEntry[] = [];

  accounts.forEach((account, accountIndex) => {
    if (!account.active || (account.paused ?? false)) return;
    const cap = account.dailyCap ?? account.postingHoursLocal.length;
    const blackouts = new Set(account.blackoutDates ?? []);
    const templates =
      account.enabledTemplates && account.enabledTemplates.length > 0
        ? account.enabledTemplates.filter((t) => options.templateIdsArray.includes(t))
        : options.templateIdsArray;

    for (let day = 1; day <= daysInMonth(month); day += 1) {
      const dateIso = `${month}-${String(day).padStart(2, "0")}`;
      if (blackouts.has(dateIso)) continue;
      const hours = selectHours(account.postingHoursLocal, cap);
      for (const hour of hours) {
        const resolved = resolveWallTime(dateIso, hour, account.timezone);
        if (!resolved.exists) continue;
        entries.push({
          id: `${account.id}:${dateIso}:${hour}`,
          accountId: account.id,
          date: dateIso,
          hour,
          templateId: templates.length > 0 ? templates[(seedBase + accountIndex * 31 + day) % templates.length] : undefined,
          categoryId: account.categoryFocus[(day - 1) % account.categoryFocus.length],
          status: "planned",
        });
      }
    }
  });

  return { month, seed, generatedAt, entries };
}

/**
 * Regen contract: existing ids are preserved in ANY status (executed history
 * is immutable and regenerated slots never duplicate); only NEW ids are
 * appended as planned; planned rows whose slot vanished are pruned.
 */
export function regenerateMonth(existing: PipelineFile, next: PipelineFile): PipelineFile {
  const nextIds = new Set(next.entries.map((e) => e.id));
  const kept = existing.entries.filter((e) => nextIds.has(e.id) || e.status !== "planned");
  const keptIds = new Set(kept.map((e) => e.id));
  const additions = next.entries.filter((e) => !keptIds.has(e.id));
  return { ...next, entries: [...kept, ...additions].sort((a, b) => a.id.localeCompare(b.id)) };
}
