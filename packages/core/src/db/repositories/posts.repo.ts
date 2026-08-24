import { and, count, desc, eq, gte, isNotNull, lt, sql, gt } from "drizzle-orm";
import type { Db } from "../client";
import { posts } from "../schema";

export interface NewPost {
  id: string;
  accountId: string;
  quoteId?: string | null;
  backgroundId?: string | null;
  audioId?: string | null;
  templateId: string;
  captionTemplateId: string;
  mode: "dark" | "light";
  scheduledFor: string;
}

export async function insertPendingPost(db: Db, post: NewPost) {
  await db.insert(posts).values({ ...post, status: "pending" });
}

export async function markPublished(
  db: Db,
  id: string,
  fields: {
    composedImagePath?: string | null;
    igMediaId?: string | null;
    igPermalink?: string | null;
    threadsPostId?: string | null;
    storiesMediaId?: string | null;
    publishedAt: string;
  },
) {
  await db
    .update(posts)
    .set({ status: "published", ...fields })
    .where(eq(posts.id, id));
}

export async function markFailed(db: Db, id: string, errorMessage: string) {
  await db.update(posts).set({ status: "failed", errorMessage }).where(eq(posts.id, id));
}

export async function setComposedImagePath(db: Db, id: string, composedImagePath: string) {
  await db.update(posts).set({ composedImagePath }).where(eq(posts.id, id));
}

/** Rolling-24h publish count for an account — plan.md §2.6 rate-cap check. */
export async function countPublishedSince(db: Db, accountId: string, sinceIso: string) {
  const rows = await db
    .select({ value: count() })
    .from(posts)
    .where(
      and(eq(posts.accountId, accountId), eq(posts.status, "published"), gte(posts.publishedAt, sinceIso)),
    );
  return rows[0]?.value ?? 0;
}

export async function findPublishedForAccount(db: Db, accountId: string, limit: number) {
  // publishedAt is captured once per batch run and shared by every item in
  // it (see pipeline/generate-and-publish-batch.ts), so same-batch posts
  // always tie on publishedAt -- rowid breaks ties in real insertion order.
  return db
    .select()
    .from(posts)
    .where(and(eq(posts.accountId, accountId), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt), sql`rowid desc`)
    .limit(limit);
}

/**
 * Most recent posts across all accounts, any status -- dashboard Overview
 * page. createdAt has only second-level granularity (SQLite datetime('now')),
 * so a batch's several posts can share the same value -- rowid (SQLite's
 * implicit insertion-order column) breaks ties deterministically instead of
 * leaving same-second rows in an arbitrary order.
 */
export async function findRecentPosts(db: Db, limit: number) {
  return db
    .select()
    .from(posts)
    .orderBy(desc(posts.createdAt), sql`rowid desc`)
    .limit(limit);
}

/** Posts that failed within the given window, across all accounts -- dashboard Overview page alert surface. */
export async function findFailedSince(db: Db, sinceIso: string) {
  return db
    .select()
    .from(posts)
    .where(and(eq(posts.status, "failed"), gte(posts.createdAt, sinceIso)))
    .orderBy(desc(posts.createdAt), sql`rowid desc`);
}

/** Published posts with a still-on-disk image older than the retention cutoff (plan.md §2.9 IMAGE_RETENTION_DAYS). */
export async function findPrunableImages(db: Db, accountId: string, beforeIso: string) {
  return db
    .select({ id: posts.id, composedImagePath: posts.composedImagePath })
    .from(posts)
    .where(
      and(
        eq(posts.accountId, accountId),
        eq(posts.status, "published"),
        lt(posts.publishedAt, beforeIso),
        isNotNull(posts.composedImagePath),
      ),
    );
}

export async function clearComposedImagePath(db: Db, id: string) {
  await db.update(posts).set({ composedImagePath: null }).where(eq(posts.id, id));
}

/** Find recent published posts with active media ID for metrics tracking. */
export async function findRecentPublishedPostsWithMediaId(db: Db, sinceIso: string) {
  return db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.status, "published"),
        isNotNull(posts.igMediaId),
        gte(posts.publishedAt, sinceIso)
      )
    );
}

/** Update view counts for a specific post. */
export async function updatePostViews(db: Db, id: string, views: number) {
  await db
    .update(posts)
    .set({ views })
    .where(eq(posts.id, id));
}

/** Queries for high-performing viral audio IDs (top percentile views) that have not been used recently. */
export async function findViralAudioIdsForReuse(
  db: Db,
  accountId: string,
  minViewsPercentile = 0.15, // top 15%
  cooldownDays = 5 // 5 days cooldown
): Promise<string[]> {
  const history = await db
    .select({ audioId: posts.audioId, views: posts.views })
    .from(posts)
    .where(
      and(
        eq(posts.accountId, accountId),
        eq(posts.status, "published"),
        isNotNull(posts.views),
        isNotNull(posts.audioId),
        gt(posts.views, 0)
      )
    );

  if (history.length === 0) return [];

  // Sort descending to find the views threshold
  const sortedHistory = [...history].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  const thresholdIdx = Math.max(0, Math.floor(sortedHistory.length * minViewsPercentile));
  const thresholdViews = sortedHistory[thresholdIdx]?.views ?? 0;

  if (thresholdViews <= 0) return [];

  // Filter out recent ones (used in cooldown window)
  const cooldownCutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000).toISOString();
  const recentPosts = await db
    .select({ audioId: posts.audioId })
    .from(posts)
    .where(
      and(
        eq(posts.accountId, accountId),
        eq(posts.status, "published"),
        isNotNull(posts.audioId),
        gte(posts.publishedAt, cooldownCutoff)
      )
    );
  const recentAudioIds = new Set(recentPosts.map((p) => p.audioId).filter(Boolean));

  // Find candidate audio IDs that meet the views threshold
  const eligibleCandidates = history.filter(
    (p) => p.audioId && (p.views ?? 0) >= thresholdViews && !recentAudioIds.has(p.audioId)
  );

  return [...new Set(eligibleCandidates.map((c) => c.audioId!))];
}


