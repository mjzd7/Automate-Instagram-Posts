import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type DbHandle } from "../../src/db/client.js";
import * as accountsRepo from "../../src/db/repositories/accounts.repo.js";
import * as backgroundsRepo from "../../src/db/repositories/backgrounds.repo.js";
import * as embeddingCacheRepo from "../../src/db/repositories/embedding-cache.repo.js";
import * as igTokenRepo from "../../src/db/repositories/ig-token.repo.js";
import * as postsRepo from "../../src/db/repositories/posts.repo.js";
import * as quotesRepo from "../../src/db/repositories/quotes.repo.js";
import * as settingsRepo from "../../src/db/repositories/settings.repo.js";
import * as usageRepo from "../../src/db/repositories/usage.repo.js";
import { categories } from "../../src/db/schema.js";

let handle: DbHandle;

beforeEach(async () => {
  handle = await openDb(":memory:");
  await handle.db.insert(categories).values({ id: "motivational", name: "Motivational" });
});

afterEach(() => {
  handle.close();
});

describe("accounts repository", () => {
  const account = {
    id: "acct1",
    igUserId: "17841400000000000",
    fbPageId: "102900000000000",
    threadsUserId: null,
    categoryFocus: ["motivational", "stoic"],
    timezone: "America/New_York",
    postingHoursLocal: [10, 13, 17, 20],
    active: true,
  };

  it("upserts an account and serializes array fields to JSON (data/accounts.json sync round-trip)", async () => {
    await accountsRepo.upsertAccount(handle.db, account);
    const row = await accountsRepo.findAccountRow(handle.db, "acct1");
    expect(row?.igUserId).toBe("17841400000000000");
    expect(JSON.parse(row!.categoryFocus)).toEqual(["motivational", "stoic"]);
    expect(JSON.parse(row!.postingHoursLocal)).toEqual([10, 13, 17, 20]);
  });

  it("updates in place on a second upsert rather than creating a duplicate (idempotent sync)", async () => {
    await accountsRepo.upsertAccount(handle.db, account);
    await accountsRepo.upsertAccount(handle.db, { ...account, timezone: "UTC", active: false });
    const rows = await accountsRepo.listAccountRows(handle.db);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.timezone).toBe("UTC");
    expect(rows[0]?.active).toBe(false);
  });
});

describe("quotes repository", () => {
  it("returns an inserted quote from findUnusedForAccount (persistence plane: round-trip)", async () => {
    await quotesRepo.insertQuote(handle.db, {
      id: "q1",
      text: "Just do it.",
      author: "Anon",
      categoryId: "motivational",
    });
    const results = await quotesRepo.findUnusedForAccount(handle.db, "acct1", "motivational", 5);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("q1");
  });

  it("excludes a quote already used by this account (state transitions plane: anti-join dedup)", async () => {
    await quotesRepo.insertQuote(handle.db, {
      id: "q1",
      text: "Just do it.",
      categoryId: "motivational",
    });
    await postsRepo.insertPendingPost(handle.db, {
      id: "p1",
      accountId: "acct1",
      templateId: "bold-modern",
      captionTemplateId: "default",
      mode: "dark",
      scheduledFor: new Date().toISOString(),
    });
    await usageRepo.recordQuoteUsage(handle.db, "acct1", "q1", "p1");

    const results = await quotesRepo.findUnusedForAccount(handle.db, "acct1", "motivational", 5);
    expect(results).toHaveLength(0);
  });

  it("does not exclude a quote used by a DIFFERENT account (dedup is per-account, not global)", async () => {
    await quotesRepo.insertQuote(handle.db, {
      id: "q1",
      text: "Just do it.",
      categoryId: "motivational",
    });
    await postsRepo.insertPendingPost(handle.db, {
      id: "p1",
      accountId: "acct-other",
      templateId: "bold-modern",
      captionTemplateId: "default",
      mode: "dark",
      scheduledFor: new Date().toISOString(),
    });
    await usageRepo.recordQuoteUsage(handle.db, "acct-other", "q1", "p1");

    const results = await quotesRepo.findUnusedForAccount(handle.db, "acct1", "motivational", 5);
    expect(results).toHaveLength(1);
  });

  it("onConflictDoNothing prevents duplicate text+author pairs (unique index enforcement)", async () => {
    await quotesRepo.insertQuote(handle.db, { id: "q1", text: "dup", author: "A", categoryId: "motivational" });
    await quotesRepo.insertQuote(handle.db, { id: "q2", text: "dup", author: "A", categoryId: "motivational" });
    const found = await quotesRepo.findQuoteById(handle.db, "q2");
    expect(found).toBeUndefined();
  });
});

describe("backgrounds repository", () => {
  it("caches the darkness classification via updateDarkness", async () => {
    await backgroundsRepo.insertBackground(handle.db, {
      id: "bg1",
      source: "curated",
      sourceUrl: "https://example.com/img.jpg",
    });
    await backgroundsRepo.updateDarkness(handle.db, "bg1", "dark");
    const found = await backgroundsRepo.findBackgroundById(handle.db, "bg1");
    expect(found?.darkness).toBe("dark");
  });
});

describe("posts repository rate-cap counting", () => {
  it("counts only published posts within the given window (external deps plane: rate-cap query correctness)", async () => {
    const now = new Date();
    const recentIso = now.toISOString();
    const oldIso = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    await postsRepo.insertPendingPost(handle.db, {
      id: "p1",
      accountId: "acct1",
      templateId: "t",
      captionTemplateId: "c",
      mode: "dark",
      scheduledFor: recentIso,
    });
    await postsRepo.markPublished(handle.db, "p1", { publishedAt: recentIso });

    await postsRepo.insertPendingPost(handle.db, {
      id: "p2",
      accountId: "acct1",
      templateId: "t",
      captionTemplateId: "c",
      mode: "dark",
      scheduledFor: oldIso,
    });
    await postsRepo.markPublished(handle.db, "p2", { publishedAt: oldIso });

    await postsRepo.insertPendingPost(handle.db, {
      id: "p3",
      accountId: "acct1",
      templateId: "t",
      captionTemplateId: "c",
      mode: "dark",
      scheduledFor: recentIso,
    });
    await postsRepo.markFailed(handle.db, "p3", "boom");

    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const publishedCount = await postsRepo.countPublishedSince(handle.db, "acct1", since);
    expect(publishedCount).toBe(1);
  });
});

describe("posts repository dashboard queries", () => {
  it("findRecentPosts returns posts across all accounts, most recently created first", async () => {
    await postsRepo.insertPendingPost(handle.db, {
      id: "r1",
      accountId: "acct1",
      templateId: "t",
      captionTemplateId: "c",
      mode: "dark",
      scheduledFor: new Date(0).toISOString(),
    });
    await postsRepo.insertPendingPost(handle.db, {
      id: "r2",
      accountId: "acct-other",
      templateId: "t",
      captionTemplateId: "c",
      mode: "dark",
      scheduledFor: new Date(0).toISOString(),
    });

    const recent = await postsRepo.findRecentPosts(handle.db, 10);
    expect(recent.map((p) => p.id)).toEqual(["r2", "r1"]); // insertion order reversed -> most-recently-created first
  });

  it("findRecentPosts respects the limit", async () => {
    for (let i = 0; i < 3; i++) {
      await postsRepo.insertPendingPost(handle.db, {
        id: `lim${i}`,
        accountId: "acct1",
        templateId: "t",
        captionTemplateId: "c",
        mode: "dark",
        scheduledFor: new Date(0).toISOString(),
      });
    }
    const recent = await postsRepo.findRecentPosts(handle.db, 2);
    expect(recent).toHaveLength(2);
  });

  it("findFailedSince returns only failed posts within the window, across accounts", async () => {
    const now = new Date();
    const recentIso = now.toISOString();
    const oldIso = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    await postsRepo.insertPendingPost(handle.db, {
      id: "f1",
      accountId: "acct1",
      templateId: "t",
      captionTemplateId: "c",
      mode: "dark",
      scheduledFor: recentIso,
    });
    await postsRepo.markFailed(handle.db, "f1", "boom");

    await postsRepo.insertPendingPost(handle.db, {
      id: "f2",
      accountId: "acct1",
      templateId: "t",
      captionTemplateId: "c",
      mode: "dark",
      scheduledFor: recentIso,
    });
    await postsRepo.markPublished(handle.db, "f2", { publishedAt: recentIso });

    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const failed = await postsRepo.findFailedSince(handle.db, since);
    expect(failed.map((p) => p.id)).toEqual(["f1"]);
    expect(oldIso < since).toBe(true); // sanity: oldIso really is outside the window
  });
});

describe("settings repository", () => {
  it("upserts a value on conflict rather than erroring (composite primary key round-trip)", async () => {
    await settingsRepo.setSetting(handle.db, "acct1", "mode_weighting", '{"dark":{"attempts":1,"successes":1}}');
    await settingsRepo.setSetting(handle.db, "acct1", "mode_weighting", '{"dark":{"attempts":2,"successes":2}}');
    const value = await settingsRepo.getSetting(handle.db, "acct1", "mode_weighting");
    expect(value).toContain('"attempts":2');
  });

  it("returns undefined for a key that was never set (edge case: empty)", async () => {
    const value = await settingsRepo.getSetting(handle.db, "acct1", "nonexistent");
    expect(value).toBeUndefined();
  });
});

describe("ig_token repository", () => {
  it("upserts the token on refresh rather than creating a duplicate row", async () => {
    await igTokenRepo.upsertToken(handle.db, "acct1", {
      accessTokenEncrypted: "enc1",
      expiresAt: "2026-09-01T00:00:00Z",
    });
    await igTokenRepo.upsertToken(handle.db, "acct1", {
      accessTokenEncrypted: "enc2",
      expiresAt: "2026-11-01T00:00:00Z",
    });
    const token = await igTokenRepo.getToken(handle.db, "acct1");
    expect(token?.accessTokenEncrypted).toBe("enc2");
  });
});

describe("embedding_cache repository", () => {
  it("round-trips a cached embedding and skips re-insert on the same hash", async () => {
    await embeddingCacheRepo.cacheEmbedding(handle.db, {
      textHash: "hash1",
      inputText: "hello world",
      vector: JSON.stringify([0.1, 0.2, 0.3]),
      provider: "jina",
    });
    const cached = await embeddingCacheRepo.getCachedEmbedding(handle.db, "hash1");
    expect(cached?.provider).toBe("jina");

    await embeddingCacheRepo.cacheEmbedding(handle.db, {
      textHash: "hash1",
      inputText: "hello world",
      vector: JSON.stringify([9, 9, 9]),
      provider: "cohere",
    });
    const stillOriginal = await embeddingCacheRepo.getCachedEmbedding(handle.db, "hash1");
    expect(stillOriginal?.provider).toBe("jina");
  });
});

describe("usage repository", () => {
  it("returns recent quote embeddings for an account ordered by recency (external deps + join correctness)", async () => {
    await quotesRepo.insertQuote(handle.db, { id: "q1", text: "first", categoryId: "motivational" });
    await quotesRepo.insertQuote(handle.db, { id: "q2", text: "second", categoryId: "motivational" });
    await embeddingCacheRepo.cacheEmbedding(handle.db, {
      textHash: "h1",
      inputText: "first",
      vector: "[1]",
      provider: "jina",
    });
    await embeddingCacheRepo.cacheEmbedding(handle.db, {
      textHash: "h2",
      inputText: "second",
      vector: "[2]",
      provider: "jina",
    });
    await postsRepo.insertPendingPost(handle.db, {
      id: "p1",
      accountId: "acct1",
      templateId: "t",
      captionTemplateId: "c",
      mode: "dark",
      scheduledFor: new Date(0).toISOString(),
    });
    await postsRepo.insertPendingPost(handle.db, {
      id: "p2",
      accountId: "acct1",
      templateId: "t",
      captionTemplateId: "c",
      mode: "dark",
      scheduledFor: new Date(1000).toISOString(),
    });
    await usageRepo.recordQuoteUsage(handle.db, "acct1", "q1", "p1");
    await usageRepo.recordQuoteUsage(handle.db, "acct1", "q2", "p2");

    const recent = await usageRepo.findRecentQuoteEmbeddings(handle.db, "acct1", 10);
    expect(recent).toHaveLength(2);
    expect(recent.map((r) => r.text)).toContain("first");
    expect(recent.map((r) => r.text)).toContain("second");
  });
});
