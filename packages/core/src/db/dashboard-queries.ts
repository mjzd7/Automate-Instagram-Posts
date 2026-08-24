import { and, count, desc, eq, getTableColumns, gte, sql } from "drizzle-orm";
import type { Db } from "./client";
import { posts, quotes } from "./schema";

/**
 * Read-only query re-implementations for apps/web, mirroring
 * db/repositories/posts.repo.ts's countPublishedSince/findRecentPosts/
 * findFailedSince exactly. Duplicated (not imported from posts.repo.ts)
 * because posts.repo.ts's own `../schema.js`/`.js`-suffixed relative
 * imports are required for tsx/Node ESM at runtime (verified: Node's ESM
 * loader needs the real extension) but Next.js's Turbopack bundler cannot
 * resolve that same `.js`-suffix-pointing-at-a-.ts-file convention for a
 * transpiled workspace package (verified empirically) -- extensionless
 * imports work for Turbopack but would break tsx. Two different runtimes
 * with incompatible extension requirements on the same source; this file
 * is the small, explicit seam rather than rewriting posts.repo.ts (and
 * everything else tsx/the pipeline depends on) to accommodate the bundler.
 * Keep in sync with posts.repo.ts if either changes.
 */

export async function countPublishedSince(db: Db, accountId: string, sinceIso: string) {
  const rows = await db
    .select({ value: count() })
    .from(posts)
    .where(and(eq(posts.accountId, accountId), eq(posts.status, "published"), gte(posts.publishedAt, sinceIso)));
  return rows[0]?.value ?? 0;
}

export async function findRecentPosts(db: Db, limit: number) {
  return db
    .select({ ...getTableColumns(posts), quoteText: quotes.text, quoteAuthor: quotes.author })
    .from(posts)
    .leftJoin(quotes, eq(posts.quoteId, quotes.id))
    .orderBy(desc(posts.createdAt), sql`posts.rowid desc`)
    .limit(limit);
}

export async function findFailedSince(db: Db, sinceIso: string) {
  return db
    .select()
    .from(posts)
    .where(and(eq(posts.status, "failed"), gte(posts.createdAt, sinceIso)))
    .orderBy(desc(posts.createdAt), sql`rowid desc`);
}

/** Most recent posts (any status) for one account -- dashboard History page account filter. */
export async function findPostsForAccount(db: Db, accountId: string, limit: number) {
  return db
    .select({ ...getTableColumns(posts), quoteText: quotes.text, quoteAuthor: quotes.author })
    .from(posts)
    .leftJoin(quotes, eq(posts.quoteId, quotes.id))
    .where(eq(posts.accountId, accountId))
    .orderBy(desc(posts.createdAt), sql`posts.rowid desc`)
    .limit(limit);
}
