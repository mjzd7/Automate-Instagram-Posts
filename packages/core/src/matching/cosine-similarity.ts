/**
 * Standard cosine similarity: dot(a,b) / (|a| * |b|). Per plan.md §7.6,
 * never compare vectors produced by different embedding providers to each
 * other -- dimensionality and vector space differ per provider. Callers are
 * responsible for that constraint; this function only validates dimension
 * equality, which is a necessary but not sufficient check (two providers
 * could coincidentally share a dimension count).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: vector length mismatch (${a.length} vs ${b.length})`);
  }
  if (a.length === 0) {
    throw new Error("cosineSimilarity: vectors must not be empty");
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
