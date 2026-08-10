import path from "node:path";

/**
 * apps/web -> repo root. Uses process.cwd() rather than the CLI scripts'
 * import.meta.url trick (packages/core/scripts/*.ts) -- Next.js guarantees
 * process.cwd() is the app directory it was started from (dev, build, and
 * Vercel with root directory set to apps/web per docs/SETUP.md), whereas
 * import.meta.url can resolve to a bundled/virtual path under Turbopack.
 */
export const repoRoot = path.resolve(process.cwd(), "..", "..");
