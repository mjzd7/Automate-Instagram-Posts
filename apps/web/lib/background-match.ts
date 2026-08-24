import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { repoRoot } from "@/lib/repo-paths";
import { resolveTsxCli } from "@/lib/tsx-cli";

const execFileAsync = promisify(execFile);

export interface BackgroundExplanation {
  matched: boolean;
  similarity?: number;
  embeddingProvider?: string;
  candidateCount: number;
  chosen: {
    sourceUrl: string;
    description: string;
    darkness: string;
    source?: string;
  } | null;
  runnersUp: Array<{ description: string; similarity: number; source?: string }>;
  error?: string;
}

/**
 * Runs the pipeline's real background-selection flow for a quote (candidate
 * gathering + embedding-similarity ranking) and returns the data needed to
 * explain WHY a background was chosen. Shells out to core's
 * explain-background.ts under tsx -- same FR-006 seam as /api/preview: core's
 * .js-suffixed import chain is required by tsx/Node and unresolvable by
 * Turbopack, so the flow must run out-of-process.
 */
export async function explainBackgroundChoice(
  quote: string,
  mode: "dark" | "light",
  category = "general",
  excludeUrls: string[] = [],
): Promise<BackgroundExplanation> {
  const fail = (error: string): BackgroundExplanation => ({
    matched: false,
    candidateCount: 0,
    chosen: null,
    runnersUp: [],
    error,
  });

  const scriptArgs = ["scripts/explain-background.ts", "--quote", quote, "--mode", mode, "--category", category];
  for (const url of excludeUrls) scriptArgs.push("--exclude-url", url);
  const tsxCli = resolveTsxCli();
  const cmd = tsxCli ? process.execPath : "npx";
  const args = tsxCli ? [tsxCli, ...scriptArgs] : ["tsx", ...scriptArgs];

  try {
    const { stdout } = await execFileAsync(cmd, args, {
      cwd: `${repoRoot}/packages/core`,
      maxBuffer: 20 * 1024 * 1024,
      timeout: 90_000,
    });
    return JSON.parse(stdout.trim()) as BackgroundExplanation;
  } catch (error) {
    console.error("background explanation failed:", error);
    return fail("background matching failed");
  }
}
