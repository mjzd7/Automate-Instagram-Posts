import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@/lib/repo-paths";

/**
 * Locates tsx's CLI entry inside the pnpm store without relying on
 * node_modules/.bin symlinks, which don't survive serverless bundle
 * tracing. Returns null when the store layout isn't present.
 */
export function resolveTsxCli(): string | null {
  const store = join(repoRoot, "node_modules", ".pnpm");
  if (!existsSync(store)) return null;
  for (const entry of readdirSync(store)) {
    if (!entry.startsWith("tsx@")) continue;
    const candidate = join(store, entry, "node_modules", "tsx", "dist", "cli.mjs");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
