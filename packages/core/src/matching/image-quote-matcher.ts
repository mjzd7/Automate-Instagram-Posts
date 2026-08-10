import { cosineSimilarity } from "./cosine-similarity.js";
import { getEmbedding, type EmbeddingsClientConfig } from "./embeddings-client.js";

export interface BackgroundCandidate {
  id: string;
  description: string;
}

export interface MatchResult {
  backgroundId: string;
  /** true if the pick was made via embedding similarity; false if embeddings were unavailable and this was a random fallback pick (plan.md §7.7). */
  matched: boolean;
  similarity?: number;
}

/**
 * Picks the best-matching background for a quote from a pool of candidates
 * (plan.md §7.7). Embeds the quote once, embeds each candidate's
 * description, and compares only embeddings that share the same provider
 * (per plan.md §7.6's same-provider-comparison constraint) -- a candidate
 * whose embedding ended up on a different provider than the quote's (e.g.
 * because the primary provider failed only for that one call) is excluded
 * from similarity ranking rather than compared across vector spaces.
 */
export async function matchBestBackground(
  quoteText: string,
  candidates: BackgroundCandidate[],
  config: EmbeddingsClientConfig,
): Promise<MatchResult> {
  if (candidates.length === 0) {
    throw new Error("matchBestBackground: no candidates provided");
  }

  let quoteEmbedding: Awaited<ReturnType<typeof getEmbedding>> | undefined;
  try {
    quoteEmbedding = await getEmbedding(quoteText, config);
  } catch {
    quoteEmbedding = undefined;
  }

  if (!quoteEmbedding) {
    return randomFallback(candidates);
  }

  let best: { id: string; similarity: number } | undefined;
  for (const candidate of candidates) {
    let candidateEmbedding: Awaited<ReturnType<typeof getEmbedding>> | undefined;
    try {
      candidateEmbedding = await getEmbedding(candidate.description, config);
    } catch {
      continue;
    }
    if (candidateEmbedding.provider !== quoteEmbedding.provider) {
      continue;
    }
    const similarity = cosineSimilarity(quoteEmbedding.vector, candidateEmbedding.vector);
    if (!best || similarity > best.similarity) {
      best = { id: candidate.id, similarity };
    }
  }

  if (!best) {
    return randomFallback(candidates);
  }

  return { backgroundId: best.id, matched: true, similarity: best.similarity };
}

function randomFallback(candidates: BackgroundCandidate[]): MatchResult {
  const index = Math.floor(Math.random() * candidates.length);
  const candidate = candidates[index];
  if (!candidate) {
    throw new Error("matchBestBackground: randomFallback selected an out-of-range index");
  }
  return { backgroundId: candidate.id, matched: false };
}
