import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DbHandle } from "../../src/db/client.js";
import { getEmbedding } from "../../src/matching/embeddings-client.js";

let handle: DbHandle;

beforeEach(async () => {
  handle = await openDb(":memory:");
});

afterEach(() => {
  handle.close();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("getEmbedding", () => {
  it("uses Jina when configured and succeeds, and caches the result", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ embedding: [0.1, 0.2] }] }));

    const result = await getEmbedding("hello", {
      db: handle.db,
      keys: { jina: "jina-key" },
      fetchImpl,
    });

    expect(result).toEqual({ vector: [0.1, 0.2], provider: "jina" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.jina.ai/v1/embeddings");

    // Second call for the same text should hit the cache, not fetch again.
    const cached = await getEmbedding("hello", { db: handle.db, keys: { jina: "jina-key" }, fetchImpl });
    expect(cached).toEqual({ vector: [0.1, 0.2], provider: "jina" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to Cohere when Jina fails (external deps plane: fallback chain)", async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(500, {})))
      .mockImplementationOnce(() =>
        Promise.resolve(jsonResponse(200, { embeddings: [[0.4, 0.5]] })),
      );

    const result = await getEmbedding("hi", {
      db: handle.db,
      keys: { jina: "jina-key", cohere: "cohere-key" },
      fetchImpl,
    });

    expect(result).toEqual({ vector: [0.4, 0.5], provider: "cohere" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("falls back through HuggingFace's plain-array response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, [0.7, 0.8, 0.9]));

    const result = await getEmbedding("hi", {
      db: handle.db,
      keys: { huggingface: "hf-key" },
      fetchImpl,
    });

    expect(result).toEqual({ vector: [0.7, 0.8, 0.9], provider: "huggingface" });
  });

  it("falls back through Gemini's nested embedding.values response shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { embedding: { values: [1, 2] } }));

    const result = await getEmbedding("hi", { db: handle.db, keys: { gemini: "g-key" }, fetchImpl });

    expect(result).toEqual({ vector: [1, 2], provider: "gemini" });
    expect(fetchImpl.mock.calls[0]?.[0]).toContain("generativelanguage.googleapis.com");
  });

  it("skips providers with no configured key entirely (does not call fetch for them)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { embedding: { values: [1] } }));

    await getEmbedding("hi", { db: handle.db, keys: { gemini: "g-key" }, fetchImpl });

    // Only Gemini was configured, so only one fetch call total (no attempts
    // at jina/cohere/huggingface URLs).
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws with details from every attempted provider when all fail", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(503, {}));

    await expect(
      getEmbedding("hi", { db: handle.db, keys: { jina: "a", cohere: "b" }, fetchImpl }),
    ).rejects.toThrow(/jina:.*cohere:/s);
  });

  it("throws immediately when no provider keys are configured at all (configuration plane)", async () => {
    const fetchImpl = vi.fn();
    await expect(getEmbedding("hi", { db: handle.db, keys: {}, fetchImpl })).rejects.toThrow(
      /no provider keys configured/,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws a clear error when a provider returns a malformed body (edge case: unexpected shape)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { unexpected: "shape" }));
    await expect(
      getEmbedding("hi", { db: handle.db, keys: { jina: "a" }, fetchImpl }),
    ).rejects.toThrow(/jina: Jina embeddings response missing/);
  });
});
