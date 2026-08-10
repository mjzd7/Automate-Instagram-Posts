import type { Db } from "../db/client.js";
import { findRecentQuoteEmbeddings } from "../db/repositories/usage.repo.js";
import { cosineSimilarity } from "./cosine-similarity.js";
import { getEmbedding, type EmbeddingsClientConfig } from "./embeddings-client.js";

export const DUPLICATE_SIMILARITY_THRESHOLD = 0.92;
export const DUPLICATE_LOOKBACK_COUNT = 200;

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  /** highest similarity found against the lookback set, if embeddings were available */
  maxSimilarity?: number;
  /** true if the check was skipped because embeddings were unavailable (plan.md §7.8 degradation) */
  skipped: boolean;
}

/**
 * Near-duplicate (paraphrase) detection for a candidate quote, per plan.md
 * §7.8: embed the candidate, compare against this account's most recent
 * DUPLICATE_LOOKBACK_COUNT used-quote embeddings, and flag as a duplicate
 * if any similarity meets DUPLICATE_SIMILARITY_THRESHOLD. If embeddings are
 * unavailable, the check is skipped (not treated as "not a duplicate") --
 * exact-text dedup via quote_usage's anti-join still applies independently
 * of this check.
 */
export async function checkDuplicate(
  db: Db,
  accountId: string,
  candidateText: string,
  config: EmbeddingsClientConfig,
): Promise<DuplicateCheckResult> {
  let candidateEmbedding: Awaited<ReturnType<typeof getEmbedding>>;
  try {
    candidateEmbedding = await getEmbedding(candidateText, config);
  } catch {
    return { isDuplicate: false, skipped: true };
  }

  const recent = await findRecentQuoteEmbeddings(db, accountId, DUPLICATE_LOOKBACK_COUNT);

  let maxSimilarity = 0;
  for (const entry of recent) {
    if (entry.provider !== candidateEmbedding.provider) continue;
    const vector = JSON.parse(entry.vector) as number[];
    const similarity = cosineSimilarity(candidateEmbedding.vector, vector);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
    }
  }

  return {
    isDuplicate: maxSimilarity >= DUPLICATE_SIMILARITY_THRESHOLD,
    maxSimilarity,
    skipped: false,
  };
}
