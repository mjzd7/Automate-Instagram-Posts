import { readFile } from "node:fs/promises";
import type { PipelineFile } from "core/src/schedule/generator";

function baseDir(): string {
  return process.env.DATA_DIR ?? ".";
}

export function pipelineFilePath(month: string): string {
  return `${baseDir()}/data/pipeline/${month}.json`;
}

/**
 * Reads the pipeline file fresh from raw.githubusercontent when the repo slug
 * is known, falling back to the build-time snapshot on disk. The snapshot is
 * stale right after a dashboard generate: writeJsonFile commits to GitHub and
 * only the NEXT Vercel deploy refreshes the bundled copy, so reading the
 * snapshot alone made "Generate month" look like a no-op until redeploy.
 */
export async function loadPipelineFile(month: string): Promise<PipelineFile | null> {
  const slug = process.env.GITHUB_REPO_SLUG;
  if (slug) {
    try {
      const branch = process.env.GITHUB_BRANCH ?? "main";
      const res = await fetch(`https://raw.githubusercontent.com/${slug}/${branch}/data/pipeline/${month}.json`, {
        cache: "no-store",
      });
      if (res.ok) {
        return JSON.parse(await res.text()) as PipelineFile;
      }
    } catch {
      // fall through to the local snapshot (offline / rate-limited raw fetch)
    }
  }
  try {
    const raw = await readFile(pipelineFilePath(month), "utf-8");
    return JSON.parse(raw) as PipelineFile;
  } catch {
    return null;
  }
}
