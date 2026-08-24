import { desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import { backgroundUsage, embeddingCache, quoteUsage, quotes } from "../schema";

export async function recordQuoteUsage(db: Db, accountId: string, quoteId: string, postId: string) {
  await db.insert(quoteUsage).values({ accountId, quoteId, postId });
}

export async function recordBackgroundUsage(
  db: Db,
  accountId: string,
  backgroundId: string,
  postId: string,
) {
  await db.insert(backgroundUsage).values({ accountId, backgroundId, postId });
}

/**
 * Most-recently-used quote embeddings for an account, for
 * duplicate-detector.ts's near-duplicate check (plan.md §7.8,
 * DUPLICATE_LOOKBACK_COUNT). Joins quote_usage -> quotes -> embedding_cache
 * so only quotes that were actually successfully embedded and cached come
 * back (a quote used before embeddings were available simply won't
 * contribute to the lookback set, which is the correct degrade-gracefully
 * behavior rather than an error).
 */
export async function findRecentQuoteEmbeddings(db: Db, accountId: string, limit: number) {
  return db
    .select({
      quoteId: quoteUsage.quoteId,
      text: quotes.text,
      vector: embeddingCache.vector,
      provider: embeddingCache.provider,
      usedAt: quoteUsage.usedAt,
    })
    .from(quoteUsage)
    .innerJoin(quotes, eq(quotes.id, quoteUsage.quoteId))
    .innerJoin(embeddingCache, eq(embeddingCache.inputText, quotes.text))
    .where(eq(quoteUsage.accountId, accountId))
    .orderBy(desc(quoteUsage.usedAt))
    .limit(limit);
}
