import path from "node:path";
import { existsSync } from "node:fs";

/**
 * Locates the repo root without assuming CWD: Vercel serverless bundles
 * place files differently than dev/build, so walk upward until a directory
 * containing data/accounts.json is found. REPO_ROOT env wins if provided.
 */
function findRepoRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "..", ".."),
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "data", "accounts.json"))) return candidate;
  }
  return candidates[candidates.length - 1]!;
}

export const repoRoot = process.env.REPO_ROOT ?? findRepoRoot();
