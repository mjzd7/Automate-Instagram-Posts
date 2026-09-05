import { readFile } from "node:fs/promises";
import { parseSeries, type SeriesConfig } from "core/src/config/series";
import { repoRoot } from "./repo-paths";

function resolveDataPath(relPath: string): string {
  const base = process.env.DATA_DIR;
  return base ? `${base}/${relPath}` : `${repoRoot}/${relPath}`;
}

export const SERIES_FILE_PATH = "data/series.json";

/**
 * Fresh-reads series definitions from raw.githubusercontent when the repo slug
 * is known, falling back to the build-time snapshot on disk -- same freshness
 * contract as loadPipelineFile(): a dashboard write commits to GitHub and only
 * the next deploy refreshes the bundled copy.
 */
export async function loadSeriesConfig(): Promise<SeriesConfig[]> {
  const slug = process.env.GITHUB_REPO_SLUG;
  if (slug) {
    try {
      const branch = process.env.GITHUB_BRANCH ?? "main";
      const res = await fetch(`https://raw.githubusercontent.com/${slug}/${branch}/${SERIES_FILE_PATH}`, {
        cache: "no-store",
      });
      if (res.ok) {
        return parseSeries(JSON.parse(await res.text()));
      }
    } catch {
      // fall through to the local snapshot
    }
  }
  const raw = await readFile(resolveDataPath(SERIES_FILE_PATH), "utf-8");
  return parseSeries(JSON.parse(raw));
}

export interface PackItem {
  id: string;
  seriesId: string;
  archetype: string | null;
  text: string;
  status: string;
  generatedAt: string;
}

function parsePackItems(raw: unknown): PackItem[] {
  if (!Array.isArray(raw)) throw new Error("pack file must be a JSON array");
  const items: PackItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.text !== "string") continue;
    items.push({
      id: row.id,
      seriesId: typeof row.seriesId === "string" ? row.seriesId : "",
      archetype: typeof row.archetype === "string" ? row.archetype : null,
      text: row.text,
      status: typeof row.status === "string" ? row.status : "draft",
      generatedAt: typeof row.generatedAt === "string" ? row.generatedAt : "",
    });
  }
  return items;
}

async function loadPackFile(seriesId: string, month: string): Promise<PackItem[]> {
  const relPath = `data/content-packs/${seriesId}/${month}.json`;
  const slug = process.env.GITHUB_REPO_SLUG;
  if (slug) {
    try {
      const branch = process.env.GITHUB_BRANCH ?? "main";
      const res = await fetch(`https://raw.githubusercontent.com/${slug}/${branch}/${relPath}`, {
        cache: "no-store",
      });
      if (res.ok) {
        return parsePackItems(JSON.parse(await res.text()));
      }
    } catch {
      // fall through to the local snapshot
    }
  }
  try {
    const raw = await readFile(resolveDataPath(relPath), "utf-8");
    return parsePackItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Scans the current month plus two prior months; missing files count as empty packs. */
export async function loadPackItems(seriesId: string): Promise<PackItem[]> {
  const now = new Date();
  const months: string[] = [];
  for (let offset = 0; offset < 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const batches = await Promise.all(months.map((month) => loadPackFile(seriesId, month)));
  const seen = new Set<string>();
  const merged: PackItem[] = [];
  for (const batch of batches) {
    for (const item of batch) {
      if (item.seriesId !== seriesId || seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}
