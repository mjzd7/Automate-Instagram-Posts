import { describe, expect, it, vi } from "vitest";
import { openDb, type DbHandle } from "../../src/db/client.js";
import { matchBestBackground } from "../../src/matching/image-quote-matcher.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function withDb(fn: (handle: DbHandle) => Promise<void>) {
  const handle = await openDb(":memory:");
  try {
    await fn(handle);
  } finally {
    handle.close();
  }
}

describe("matchBestBackground", () => {
  it("picks the candidate whose embedding has the highest cosine similarity to the quote", async () => {
    await withDb(async (handle) => {
      const vectors: Record<string, number[]> = {
        "a quote about the ocean": [1, 0],
        "mountains at dawn": [0, 1],
        "calm blue sea": [0.99, 0.1],
      };
      const fetchImpl = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { input: string[] };
        const vector = vectors[body.input[0] ?? ""] ?? [0, 0];
        return Promise.resolve(jsonResponse(200, { data: [{ embedding: vector }] }));
      });

      const result = await matchBestBackground(
        "a quote about the ocean",
        [
          { id: "bg-mountain", description: "mountains at dawn" },
          { id: "bg-sea", description: "calm blue sea" },
        ],
        { db: handle.db, keys: { jina: "key" }, fetchImpl },
      );

      expect(result.matched).toBe(true);
      expect(result.backgroundId).toBe("bg-sea");
    });
  });

  it("falls back to a random pick when the quote itself can't be embedded (external deps plane: total failure)", async () => {
    await withDb(async (handle) => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
      const result = await matchBestBackground(
        "unembeddable",
        [{ id: "only-candidate", description: "x" }],
        { db: handle.db, keys: { jina: "key" }, fetchImpl },
      );
      expect(result.matched).toBe(false);
      expect(result.backgroundId).toBe("only-candidate");
    });
  });

  it("excludes a candidate embedded on a different provider than the quote (same-provider constraint)", async () => {
    await withDb(async (handle) => {
      // Quote embeds fine via jina. The one candidate's description is
      // pre-cached under a DIFFERENT provider (cohere), simulating a case
      // where an earlier call fell back but this call's primary succeeded.
      const { cacheEmbedding } = await import("../../src/db/repositories/embedding-cache.repo.js");
      const { createHash } = await import("node:crypto");
      const hash = createHash("sha256").update("mismatched candidate", "utf-8").digest("hex");
      await cacheEmbedding(handle.db, {
        textHash: hash,
        inputText: "mismatched candidate",
        vector: JSON.stringify([1, 0]),
        provider: "cohere",
      });

      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ embedding: [1, 0] }] }));

      const result = await matchBestBackground(
        "the quote",
        [{ id: "mismatched-bg", description: "mismatched candidate" }],
        { db: handle.db, keys: { jina: "key" }, fetchImpl },
      );

      // No candidate survives the same-provider filter, so it falls back to
      // the random pick among all candidates rather than a false match.
      expect(result.matched).toBe(false);
      expect(result.backgroundId).toBe("mismatched-bg");
    });
  });

  it("throws when given an empty candidate list (input validation plane)", async () => {
    await withDb(async (handle) => {
      await expect(
        matchBestBackground("q", [], { db: handle.db, keys: {}, fetchImpl: vi.fn() }),
      ).rejects.toThrow(/no candidates/);
    });
  });
});
