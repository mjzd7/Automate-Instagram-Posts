import { describe, expect, it, vi } from "vitest";
import { openDb, type DbHandle } from "../../src/db/client.js";
import { cacheEmbedding } from "../../src/db/repositories/embedding-cache.repo.js";
import { insertQuote } from "../../src/db/repositories/quotes.repo.js";
import { insertPendingPost } from "../../src/db/repositories/posts.repo.js";
import { recordQuoteUsage } from "../../src/db/repositories/usage.repo.js";
import { categories } from "../../src/db/schema.js";
import { checkDuplicate } from "../../src/matching/duplicate-detector.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function seedUsedQuote(
  handle: DbHandle,
  accountId: string,
  quoteId: string,
  text: string,
  vector: number[],
  provider = "jina",
) {
  await handle.db.insert(categories).values({ id: "motivational", name: "Motivational" }).onConflictDoNothing();
  await insertQuote(handle.db, { id: quoteId, text, categoryId: "motivational" });
  await insertPendingPost(handle.db, {
    id: `post-${quoteId}`,
    accountId,
    templateId: "t",
    captionTemplateId: "c",
    mode: "dark",
    scheduledFor: new Date().toISOString(),
  });
  await recordQuoteUsage(handle.db, accountId, quoteId, `post-${quoteId}`);
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(text, "utf-8").digest("hex");
  await cacheEmbedding(handle.db, { textHash: hash, inputText: text, vector: JSON.stringify(vector), provider });
}

describe("checkDuplicate", () => {
  it("flags a near-identical paraphrase as a duplicate (similarity above threshold)", async () => {
    const handle = await openDb(":memory:");
    try {
      await seedUsedQuote(handle, "acct1", "q1", "The journey matters more than the destination", [1, 0.01]);
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ embedding: [1, 0] }] }));

      const result = await checkDuplicate(handle.db, "acct1", "The path matters more than the end", {
        db: handle.db,
        keys: { jina: "key" },
        fetchImpl,
      });

      expect(result.skipped).toBe(false);
      expect(result.isDuplicate).toBe(true);
      expect(result.maxSimilarity).toBeGreaterThanOrEqual(0.92);
    } finally {
      handle.close();
    }
  });

  it("does not flag a genuinely different quote", async () => {
    const handle = await openDb(":memory:");
    try {
      await seedUsedQuote(handle, "acct1", "q1", "The journey matters more than the destination", [1, 0]);
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ embedding: [0, 1] }] }));

      const result = await checkDuplicate(handle.db, "acct1", "Discipline beats motivation every time", {
        db: handle.db,
        keys: { jina: "key" },
        fetchImpl,
      });

      expect(result.isDuplicate).toBe(false);
    } finally {
      handle.close();
    }
  });

  it("scopes the lookback to the given account (state transitions plane: per-account dedup)", async () => {
    const handle = await openDb(":memory:");
    try {
      await seedUsedQuote(handle, "other-account", "q1", "identical text", [1, 0]);
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ embedding: [1, 0] }] }));

      const result = await checkDuplicate(handle.db, "acct1", "identical text", {
        db: handle.db,
        keys: { jina: "key" },
        fetchImpl,
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.maxSimilarity).toBe(0);
    } finally {
      handle.close();
    }
  });

  it("excludes lookback entries embedded on a different provider", async () => {
    const handle = await openDb(":memory:");
    try {
      await seedUsedQuote(handle, "acct1", "q1", "same text different provider", [1, 0], "cohere");
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { data: [{ embedding: [1, 0] }] }));

      const result = await checkDuplicate(handle.db, "acct1", "same text different provider query", {
        db: handle.db,
        keys: { jina: "key" },
        fetchImpl,
      });

      expect(result.maxSimilarity).toBe(0);
      expect(result.isDuplicate).toBe(false);
    } finally {
      handle.close();
    }
  });

  it("skips the check (does not falsely say 'not a duplicate') when embeddings are entirely unavailable", async () => {
    const handle = await openDb(":memory:");
    try {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}));
      const result = await checkDuplicate(handle.db, "acct1", "anything", {
        db: handle.db,
        keys: { jina: "key" },
        fetchImpl,
      });
      expect(result.skipped).toBe(true);
      expect(result.isDuplicate).toBe(false);
    } finally {
      handle.close();
    }
  });
});
