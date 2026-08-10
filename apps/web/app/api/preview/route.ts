import { execFile } from "node:child_process";
import { promisify } from "node:util";
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
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const template = searchParams.get("template");
  const mode = searchParams.get("mode");
  const quote = searchParams.get("quote");
  const author = searchParams.get("author");

  if (!template || !mode || !quote) {
    return NextResponse.json({ error: "template, mode, and quote query params are required" }, { status: 400 });
  }

  const args = ["tsx", "scripts/render-preview.ts", "--template", template, "--mode", mode, "--quote", quote];
  if (author) args.push("--author", author);

  try {
    const { stdout } = await execFileAsync("npx", args, {
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
