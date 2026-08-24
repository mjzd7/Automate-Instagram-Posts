import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { embeddingCache } from "../schema";

export async function getCachedEmbedding(db: Db, textHash: string) {
  const rows = await db
    .select()
    .from(embeddingCache)
    .where(eq(embeddingCache.textHash, textHash))
    .limit(1);
  return rows[0];
}

export async function cacheEmbedding(
  db: Db,
  fields: { textHash: string; inputText: string; vector: string; provider: string },
) {
  await db.insert(embeddingCache).values(fields).onConflictDoNothing();
}
