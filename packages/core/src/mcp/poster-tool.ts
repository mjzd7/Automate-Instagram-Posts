import { readFile } from "node:fs/promises";
import { getSetting } from "../db/repositories/settings.repo.js";
import type { Db } from "../db/client";
import { parseStatuses, statusKey } from "../schedule/status-merge.js";
import type { PipelineFile } from "../schedule/generator.js";

export interface PosterToolInput {
  month?: string;
}

export interface PosterEntryView {
  id: string;
  accountId: string;
  date: string;
  hour: number;
  templateId?: string;
  categoryId?: string;
  status: string;
}

export interface PosterPipelineState {
  month: string;
  found: boolean;
  seed?: string;
  generatedAt?: string;
  counts: Record<string, number>;
  pausedAccounts: string[];
  inactiveAccounts: string[];
  entries: PosterEntryView[];
  statusSource: "live" | "file" | "none";
}

function baseDir(): string {
  return process.env.DATA_DIR ?? ".";
}

function defaultMonth(now = new Date()): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getPipelineState(db: Db, input: PosterToolInput): Promise<PosterPipelineState> {
  const month = /^\d{4}-\d{2}$/.test(input.month ?? "") ? (input.month as string) : defaultMonth();

  const [accountsRaw, fileRaw, statusesRaw] = await Promise.all([
    readFile(`${baseDir()}/data/accounts.json`, "utf-8").catch(() => "[]"),
    readFile(`${baseDir()}/data/pipeline/${month}.json`, "utf-8").catch(() => null),
    getSetting(db, "__pipeline__", statusKey(month)),
  ]);

  const accounts = (JSON.parse(accountsRaw) as Array<{ id: string; active: boolean; paused?: boolean }>);
  let file: PipelineFile | null = null;
  try {
    file = fileRaw ? (JSON.parse(fileRaw) as PipelineFile) : null;
  } catch {
    file = null;
  }
  const liveStatuses = parseStatuses(statusesRaw);

  const entries: PosterEntryView[] = (file?.entries ?? []).map((entry) => ({
    id: entry.id,
    accountId: entry.accountId,
    date: entry.date,
    hour: entry.hour,
    templateId: entry.templateId,
    categoryId: entry.categoryId,
    status: liveStatuses[entry.id] ?? entry.status,
  }));

  const counts: Record<string, number> = {};
  for (const entry of entries) counts[entry.status] = (counts[entry.status] ?? 0) + 1;

  return {
    month,
    found: file !== null,
    seed: file?.seed,
    generatedAt: file?.generatedAt,
    counts,
    pausedAccounts: accounts.filter((a) => a.paused === true).map((a) => a.id),
    inactiveAccounts: accounts.filter((a) => a.active === false).map((a) => a.id),
    entries,
    statusSource: Object.keys(liveStatuses).length > 0 ? "live" : file ? "file" : "none",
  };
}
