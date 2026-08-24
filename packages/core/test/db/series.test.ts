import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type DbHandle } from "../../src/db/client.js";
import { posts, series } from "../../src/db/schema.js";

let handle: DbHandle;

beforeEach(async () => {
  handle = await openDb(":memory:");
});

afterEach(() => {
  handle.close();
});

describe("series table (multi-series pipeline state)", () => {
  it("round-trips a series row with default counter and nullable lastPostedAt (persistence plane)", async () => {
    await handle.db.insert(series).values({ id: "mindset-manual" });
    const rows = await handle.db.select().from(series);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("mindset-manual");
    expect(rows[0]?.counter).toBe(0);
    expect(rows[0]?.lastPostedAt).toBeNull();
  });
});

describe("posts.seriesId / posts.archetype columns", () => {
  it("persists and returns series attribution on a post (persistence plane)", async () => {
    await handle.db.insert(series).values({ id: "hook-lab", counter: 2 });
    await handle.db.insert(posts).values({
      id: "p1",
      accountId: "acct1",
      templateId: "hook-cover",
      captionTemplateId: "default",
      mode: "dark",
      status: "pending",
      scheduledFor: new Date().toISOString(),
      seriesId: "hook-lab",
      archetype: "stat",
    });
    const rows = await handle.db.select().from(posts);
    expect(rows[0]?.seriesId).toBe("hook-lab");
    expect(rows[0]?.archetype).toBe("stat");
  });

  it("leaves seriesId/archetype null for legacy-style posts without them (back-compat plane)", async () => {
    await handle.db.insert(posts).values({
      id: "p2",
      accountId: "acct1",
      templateId: "classic",
      captionTemplateId: "default",
      mode: "light",
      status: "pending",
      scheduledFor: new Date().toISOString(),
    });
    const rows = await handle.db.select().from(posts);
    expect(rows[0]?.seriesId).toBeNull();
    expect(rows[0]?.archetype).toBeNull();
  });
});
