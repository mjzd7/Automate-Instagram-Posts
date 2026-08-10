import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;
    if (!path || path.length === 0) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const relativePath = join(...path);
    // Sanitize path to prevent directory traversal
    if (relativePath.includes("..") || relativePath.startsWith("/")) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const repoRoot = process.cwd();
    const filePath = join(repoRoot, "data", "posts", relativePath);

    try {
      const buffer = await readFile(filePath);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch {
      // Fallback: try fetching from raw.githubusercontent.com on Alpha or main branch
      const rawUrls = [
        `https://raw.githubusercontent.com/mjzd7/Automate-Instagram-Posts/Alpha/data/posts/${relativePath}`,
        `https://raw.githubusercontent.com/mjzd7/Automate-Instagram-Posts/main/data/posts/${relativePath}`,
      ];

      for (const url of rawUrls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            return new NextResponse(arrayBuffer, {
              status: 200,
              headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*",
              },
            });
          }
        } catch {}
      }

      return new NextResponse("Image Not Found", { status: 404 });
    }
  } catch (err) {
    console.error("Media route error:", err);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
