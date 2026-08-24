import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { promisify } from "node:util";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { repoRoot } from "@/lib/repo-paths";

const execFileAsync = promisify(execFile);

/**
 * Renders a real composited post image by shelling out to
 * packages/core/scripts/render-preview.ts under tsx (see docs/LEARNINGS.md
 * FR-006 for why: compositor.ts's relative-import chain is too large to
 * duplicate as a Turbopack-safe boundary file). execFile with an args array
 * (not a shell string) avoids command injection from user-supplied quote
 * text -- same pattern as git/commit-batch.ts.
 */

/**
 * Locates tsx's CLI entry inside the pnpm store without relying on
 * node_modules/.bin symlinks, which don't survive serverless bundle
 * tracing. Returns null when the store layout isn't present.
 */
function resolveTsxCli(): string | null {
  const store = join(repoRoot, "node_modules", ".pnpm");
  if (!existsSync(store)) return null;
  for (const entry of readdirSync(store)) {
    if (!entry.startsWith("tsx@")) continue;
    const candidate = join(store, entry, "node_modules", "tsx", "dist", "cli.mjs");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const template = searchParams.get("template");
  const mode = searchParams.get("mode");
  const quote = searchParams.get("quote");
  const author = searchParams.get("author");

  if (!template || !mode || !quote) {
    return NextResponse.json({ error: "template, mode, and quote query params are required" }, { status: 400 });
  }

  const scriptArgs = ["scripts/render-preview.ts", "--template", template, "--mode", mode, "--quote", quote];
  if (author) scriptArgs.push("--author", author);

  // Prefer the store-resolved tsx CLI (works in traced serverless bundles);
  // fall back to npx for non-pnpm layouts where the store doesn't exist.
  const tsxCli = resolveTsxCli();
  const cmd = tsxCli ? process.execPath : "npx";
  const args = tsxCli ? [tsxCli, ...scriptArgs] : ["tsx", ...scriptArgs];

  try {
    const { stdout } = await execFileAsync(cmd, args, {
      cwd: `${repoRoot}/packages/core`,
      maxBuffer: 20 * 1024 * 1024,
    });
    const buffer = Buffer.from(stdout.trim(), "base64");
    return new NextResponse(buffer, {
      headers: { "content-type": "image/jpeg", "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("preview render failed:", error);
    return NextResponse.json({ error: "render failed" }, { status: 500 });
  }
}
