import { createHash } from "node:crypto";
import type { Db } from "../db/client.js";
import { cacheEmbedding, getCachedEmbedding } from "../db/repositories/embedding-cache.repo.js";

export type EmbeddingProvider = "jina" | "cohere" | "huggingface" | "gemini";

export interface EmbeddingResult {
  vector: number[];
  provider: EmbeddingProvider;
}

export interface EmbeddingsClientConfig {
  db: Db;
  keys: Partial<Record<EmbeddingProvider, string>>;
  fetchImpl?: typeof fetch;
}

function hashText(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}

// Exact request/response contracts per plan.md §7.6. Each function throws on
// a non-2xx response or malformed body so the fallback loop in getEmbedding
// can move on to the next provider.

async function embedWithJina(text: string, apiKey: string, fetchImpl: typeof fetch): Promise<number[]> {
  const res = await fetchImpl("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "jina-embeddings-v3", input: [text] }),
  });
  if (!res.ok) throw new Error(`Jina embeddings request failed: ${res.status}`);
  const body = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const vector = body.data?.[0]?.embedding;
  if (!vector) throw new Error("Jina embeddings response missing data[0].embedding");
  return vector;
}

async function embedWithCohere(text: string, apiKey: string, fetchImpl: typeof fetch): Promise<number[]> {
  const res = await fetchImpl("https://api.cohere.com/v1/embed", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ texts: [text], model: "embed-english-v3.0", input_type: "search_document" }),
  });
  if (!res.ok) throw new Error(`Cohere embed request failed: ${res.status}`);
  const body = (await res.json()) as { embeddings?: number[][] };
  const vector = body.embeddings?.[0];
  if (!vector) throw new Error("Cohere embed response missing embeddings[0]");
  return vector;
}

async function embedWithHuggingFace(
  text: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<number[]> {
  const res = await fetchImpl(
    "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text }),
    },
  );
  if (!res.ok) throw new Error(`HuggingFace inference request failed: ${res.status}`);
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body) || body.length === 0 || typeof body[0] !== "number") {
    throw new Error("HuggingFace inference response was not a plain numeric array");
  }
  return body as number[];
}

async function embedWithGemini(text: string, apiKey: string, fetchImpl: typeof fetch): Promise<number[]> {
  const res = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "models/gemini-embedding-001", content: { parts: [{ text }] } }),
    },
  );
  if (!res.ok) throw new Error(`Gemini embedContent request failed: ${res.status}`);
  const body = (await res.json()) as { embedding?: { values?: number[] } };
  const vector = body.embedding?.values;
  if (!vector) throw new Error("Gemini embedContent response missing embedding.values");
  return vector;
}

const PROVIDER_CHAIN: Array<{
  provider: EmbeddingProvider;
  run: (text: string, apiKey: string, fetchImpl: typeof fetch) => Promise<number[]>;
}> = [
  { provider: "jina", run: embedWithJina },
  { provider: "cohere", run: embedWithCohere },
  { provider: "huggingface", run: embedWithHuggingFace },
  { provider: "gemini", run: embedWithGemini },
];

/**
 * Produces an embedding for `text`, trying providers in the plan.md §7.6
 * fallback order (only providers with a configured key are attempted),
 * with DB caching keyed by a SHA-256 hash of the input text. Throws only if
 * every configured provider fails -- callers (image-quote-matcher.ts,
 * duplicate-detector.ts) decide how to degrade from there.
 */
export async function getEmbedding(text: string, config: EmbeddingsClientConfig): Promise<EmbeddingResult> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const textHash = hashText(text);

  const cached = await getCachedEmbedding(config.db, textHash);
  if (cached) {
    return { vector: JSON.parse(cached.vector) as number[], provider: cached.provider as EmbeddingProvider };
  }

  const errors: string[] = [];
  for (const { provider, run } of PROVIDER_CHAIN) {
    const apiKey = config.keys[provider];
    if (!apiKey) continue;
    try {
      const vector = await run(text, apiKey, fetchImpl);
      try {
        await cacheEmbedding(config.db, {
          textHash,
          inputText: text,
          vector: JSON.stringify(vector),
          provider,
        });
      } catch {
        // cache is an optimization -- a read-only FS (Vercel) must not fail the embed
      }
      return { vector, provider };
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    `All embedding providers failed or were unconfigured for this text:\n${errors.join("\n") || "(no provider keys configured)"}`,
  );
}
