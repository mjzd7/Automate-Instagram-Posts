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
  /** Embedding provider whose vector space the comparison ran in (same-provider constraint). */
  provider?: string;
  /** All successfully scored candidates, best first -- lets explain-surfaces show runner-ups. */
  scores?: Array<{ id: string; similarity: number }>;
}

export interface MatchOptions {
  /**
   * Descriptions of recently used backgrounds -- candidates whose description
   * embedding is >0.9 similar to any of them are skipped (best non-similar
   * pick wins) so consecutive posts don't share a visual family. When every
   * candidate is too similar, the best overall still wins.
   */
  recentDescriptions?: string[];
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
  options?: MatchOptions,
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
  const scores: Array<{ id: string; similarity: number }> = [];
  const embeddingsById = new Map<string, Awaited<ReturnType<typeof getEmbedding>>>();
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
    scores.push({ id: candidate.id, similarity });
    embeddingsById.set(candidate.id, candidateEmbedding);
    if (!best || similarity > best.similarity) {
      best = { id: candidate.id, similarity };
    }
  }

  if (!best) {
    return randomFallback(candidates);
  }

  scores.sort((a, b) => b.similarity - a.similarity);

  // Diversity guard: walk ranked candidates and skip any whose description is
  // near-identical to a recently used background's.
  const recentDescriptions = options?.recentDescriptions ?? [];
  let pick = best;
  if (recentDescriptions.length > 0 && scores.length > 1) {
    const recentEmbeddings: Awaited<ReturnType<typeof getEmbedding>>[] = [];
    for (const description of recentDescriptions) {
      try {
        recentEmbeddings.push(await getEmbedding(description, config));
      } catch {
        // an un-embeddable recent description simply doesn't constrain the pick
      }
    }
    const diverse = scores.find((s) => {
      const embedding = embeddingsById.get(s.id);
      if (!embedding) return false;
      return !recentEmbeddings.some(
        (r) => r.provider === embedding.provider && cosineSimilarity(embedding.vector, r.vector) > 0.9,
      );
    });
    if (diverse) pick = { id: diverse.id, similarity: diverse.similarity };
  }

  return {
    backgroundId: pick.id,
    matched: true,
    similarity: pick.similarity,
    provider: quoteEmbedding.provider,
    scores,
  };
}

function randomFallback(candidates: BackgroundCandidate[]): MatchResult {
  const index = Math.floor(Math.random() * candidates.length);
  const candidate = candidates[index];
  if (!candidate) {
    throw new Error("matchBestBackground: randomFallback selected an out-of-range index");
  }
  return { backgroundId: candidate.id, matched: false };
}
