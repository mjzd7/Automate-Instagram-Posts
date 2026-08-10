import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type DbHandle } from "../../src/db/client.js";
import { countPublishedSince, findFailedSince, findPostsForAccount, findRecentPosts } from "../../src/db/dashboard-queries.js";
import { insertPendingPost, markFailed, markPublished } from "../../src/db/repositories/posts.repo.js";
import { categories } from "../../src/db/schema.js";

let handle: DbHandle;

beforeEach(async () => {
  handle = await openDb(":memory:");
  await handle.db.insert(categories).values({ id: "motivational", name: "Motivational" });
});

afterEach(() => {
  handle.close();
});

// Mirrors test/db/repositories.test.ts's posts-repository coverage --
// dashboard-queries.ts deliberately duplicates posts.repo.ts's query logic
// (see the file's own header comment for why), so it needs its own
// equivalent tests rather than inheriting posts.repo.ts's.
describe("dashboard-queries (apps/web read path)", () => {
  it("countPublishedSince counts only published posts within the window", async () => {
    const now = new Date();
    const recentIso = now.toISOString();
    const oldIso = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    await insertPendingPost(handle.db, { id: "p1", accountId: "a1", templateId: "t", captionTemplateId: "c", mode: "dark", scheduledFor: recentIso });
    await markPublished(handle.db, "p1", { publishedAt: recentIso });

    await insertPendingPost(handle.db, { id: "p2", accountId: "a1", templateId: "t", captionTemplateId: "c", mode: "dark", scheduledFor: oldIso });
    await markPublished(handle.db, "p2", { publishedAt: oldIso });

    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    expect(await countPublishedSince(handle.db, "a1", since)).toBe(1);
  });

  it("findRecentPosts returns posts across accounts, most recently created first", async () => {
    await insertPendingPost(handle.db, { id: "r1", accountId: "a1", templateId: "t", captionTemplateId: "c", mode: "dark", scheduledFor: new Date(0).toISOString() });
    await insertPendingPost(handle.db, { id: "r2", accountId: "a2", templateId: "t", captionTemplateId: "c", mode: "dark", scheduledFor: new Date(0).toISOString() });

    const recent = await findRecentPosts(handle.db, 10);
    expect(recent.map((p) => p.id)).toEqual(["r2", "r1"]);
  });

  it("findFailedSince returns only failed posts within the window", async () => {
    const now = new Date();
    const recentIso = now.toISOString();

    await insertPendingPost(handle.db, { id: "f1", accountId: "a1", templateId: "t", captionTemplateId: "c", mode: "dark", scheduledFor: recentIso });
    await markFailed(handle.db, "f1", "boom");

    await insertPendingPost(handle.db, { id: "f2", accountId: "a1", templateId: "t", captionTemplateId: "c", mode: "dark", scheduledFor: recentIso });
    await markPublished(handle.db, "f2", { publishedAt: recentIso });

    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const failed = await findFailedSince(handle.db, since);
    expect(failed.map((p) => p.id)).toEqual(["f1"]);
  });

  it("findPostsForAccount returns posts of any status for one account only, most recent first", async () => {
    await insertPendingPost(handle.db, { id: "p1", accountId: "a1", templateId: "t", captionTemplateId: "c", mode: "dark", scheduledFor: new Date(0).toISOString() });
    await markFailed(handle.db, "p1", "boom");
    await insertPendingPost(handle.db, { id: "p2", accountId: "a1", templateId: "t", captionTemplateId: "c", mode: "dark", scheduledFor: new Date(0).toISOString() });
    await markPublished(handle.db, "p2", { publishedAt: new Date(0).toISOString() });
    await insertPendingPost(handle.db, { id: "p3", accountId: "a2", templateId: "t", captionTemplateId: "c", mode: "dark", scheduledFor: new Date(0).toISOString() });

    const forA1 = await findPostsForAccount(handle.db, "a1", 10);
    expect(forA1.map((p) => p.id)).toEqual(["p2", "p1"]);
  });
});
