import { and, desc, eq, gte } from "drizzle-orm";
import type { Db } from "../client.js";
import { audioUsage } from "../schema.js";

/**
 * Log the use of a specific audio track for a post to maintain history
 * for the anti-fatigue memory system.
 */
export async function logAudioUsage(db: Db, accountId: string, audioId: string, postId: string) {
  await db.insert(audioUsage).values({ accountId, audioId, postId });
}

/**
 * Get a list of audio IDs used by an account since a specific ISO date
 * (typically 14 days ago) to filter them out of future selections.
 */
export async function getRecentlyUsedAudio(db: Db, accountId: string, sinceIso: string): Promise<string[]> {
  const rows = await db
    .select({ audioId: audioUsage.audioId })
    .from(audioUsage)
    .where(and(eq(audioUsage.accountId, accountId), gte(audioUsage.usedAt, sinceIso)))
    .orderBy(desc(audioUsage.usedAt));

  return rows.map((r) => r.audioId);
}
