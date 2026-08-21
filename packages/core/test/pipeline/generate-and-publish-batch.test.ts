import * as reelVideoComposer from "../../src/images/reel-video-composer.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/images/reel-video-composer.js", () => ({
  createReelFromFeedImage: vi.fn().mockResolvedValue({ videoBuffer: Buffer.from("mock-reel-video"), durationSeconds: 15 })
}));

vi.mock("../../src/pipeline/video-compositor.js", () => ({
  composeVideoReel: vi.fn().mockImplementation(async (text, category, storyAbsolutePath) => {
    const fs = await import("node:fs/promises");
    const coverPath = storyAbsolutePath.replace(/\.mp4$/, "-cover.jpg");
    await fs.mkdir(storyAbsolutePath.slice(0, storyAbsolutePath.lastIndexOf("/")), { recursive: true });
    await fs.writeFile(storyAbsolutePath, Buffer.from("mock-video"));
    await fs.writeFile(coverPath, Buffer.from("mock-cover"));
    return { videoPath: storyAbsolutePath, coverImagePath: coverPath };
  })
}));
import { openDb, type DbHandle } from "../../src/db/client.js";
import { insertQuote } from "../../src/db/repositories/quotes.repo.js";
import { insertBackground, updateDarkness } from "../../src/db/repositories/backgrounds.repo.js";
import { upsertToken } from "../../src/db/repositories/ig-token.repo.js";
import { categories, posts } from "../../src/db/schema.js";
import { encryptToken } from "../../src/crypto/token-encryption.js";
import { generateAndPublishBatch } from "../../src/pipeline/generate-and-publish-batch.js";
import type { Account } from "../../src/config/accounts.js";
import type { Env } from "../../src/config/env.js";
import { solidColorImage } from "../images/fixtures.js";

const validKey = "a".repeat(64);

let handle: DbHandle;
let scratchDir: string;

const baseEnv: Env = {
  TOKEN_ENCRYPTION_KEY: validKey,
  GOOGLE_CLOUD_VISION_API_KEY: "vision-key",
  UNSPLASH_ACCESS_KEY: "unsplash-key",
  DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/x/y",
  JINA_API_KEY: "jina-key",
};

const baseAccount: Account = {
  id: "acct1",
  igUserId: "17841400000000000",
  fbPageId: "102900000000000",
  threadsUserId: null,
  categoryFocus: ["motivational"],
  timezone: "UTC",
  postingHoursLocal: [12],
  active: true,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function seedContent(db: DbHandle["db"], count: number) {
  await db.insert(categories).values({ id: "motivational", name: "Motivational" }).onConflictDoNothing();
  for (let i = 0; i < count; i++) {
    await insertQuote(db, { id: `q${i}`, text: `Quote number ${i} about staying strong.`, categoryId: "motivational" });
    await insertBackground(db, {
      id: `bg${i}`,
      source: "curated",
      sourceUrl: `https://example.com/bg${i}.jpg`,
      description: "a calming photo",
      categoryId: "motivational",
    });
    await updateDarkness(db, `bg${i}`, "dark");
  }
}

type RouteHandler = (url: string) => Response | Promise<Response>;

/** Router covering every external host generateAndPublishBatch touches. */
async function makeFetchImpl(overrides: Partial<Record<string, RouteHandler>> = {}) {
  const solidBg = await solidColorImage(600, 800, { r: 10, g: 10, b: 10 });
  const defaults: Record<string, RouteHandler> = {
    "vision.googleapis.com": () =>
      jsonResponse(200, { responses: [{ safeSearchAnnotation: { adult: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" } }] }),
    "example.com/bg": () => new Response(solidBg),
    "api.jina.ai": () => jsonResponse(200, { data: [{ embedding: [1, 0, 0] }] }),
    "graph.facebook.com": (url: string) => {
      if (url.includes("ig_audio")) {
        return jsonResponse(200, {
          audio: [
            {
              audio_id: "meta-track-1",
              title: "Meta Ambient Track",
              display_artist: "Meta Artist",
              duration_in_ms: 180000,
              download_url: "https://example.com/audio.mp3",
              is_ads_eligible: true,
            },
          ],
        });
      }
      if (url.includes("/media_publish")) return jsonResponse(200, { id: "ig-media-1" });
      if (url.includes("/comments")) return jsonResponse(200, { id: "comment-1" });
      if (url.includes("fields=status_code")) return jsonResponse(200, { status_code: "FINISHED" });
      if (url.includes("fields=permalink")) return jsonResponse(200, { permalink: "https://instagram.com/p/x" });
      return jsonResponse(200, { id: "ig-creation-1" }); // container create
    },
    "discord.com": () => new Response(null, { status: 204 }),
  };
  const merged = { ...defaults, ...overrides };
  const impl: typeof fetch = (input) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [substring, respond] of Object.entries(merged)) {
      if (respond && url.includes(substring)) return Promise.resolve(respond(url));
    }
    return Promise.resolve(jsonResponse(500, { error: "unmocked route: " + url }));
  };
  return impl;
}

beforeEach(async () => {
  handle = await openDb(":memory:");
  scratchDir = `/private/tmp/claude-501/-Users-mm-orca-projects-Automate-Instagram-Posts/5ab51503-e1d9-4628-b0f8-0446a7f028f2/scratchpad/pipeline-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await upsertToken(handle.db, "acct1", {
    accessTokenEncrypted: encryptToken("ig-access-token", validKey),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
});

afterEach(() => {
  handle.close();
});

const noSleep = () => Promise.resolve();
const noJitterRandom = () => 0.5; // midpoint -- keeps jitter math deterministic without needing to mock timers

describe("generateAndPublishBatch", () => {
  it("skips with rate-cap when the account already published >= HARD_STOP_POSTS_PER_DAY today", async () => {
    // Seed 22 already-published posts in the last 24h.
    const { insertPendingPost, markPublished } = await import("../../src/db/repositories/posts.repo.js");
    for (let i = 0; i < 22; i++) {
      await insertPendingPost(handle.db, {
        id: `p${i}`,
        accountId: "acct1",
        templateId: "t",
        captionTemplateId: "c",
        mode: "dark",
        scheduledFor: new Date().toISOString(),
      });
      await markPublished(handle.db, `p${i}`, { publishedAt: new Date().toISOString() });
    }
    const fetchImpl = await makeFetchImpl();
    const result = await generateAndPublishBatch({
      db: handle.db,
      account: baseAccount,
      env: baseEnv,
      repoRoot: scratchDir,
      githubRepoSlug: "owner/repo",
      hashtagPools: { motivational: ["#tag1", "#tag2"], general: ["#g1"] },
      fetchImpl,
      sleepImpl: noSleep,
      now: () => new Date("2026-08-07T12:00:00Z"),
    });
    expect(result).toEqual({ skippedReason: "rate-cap", items: [] });
  });

  it("skips with not-posting-hour when the current local hour isn't in postingHoursLocal", async () => {
    const fetchImpl = await makeFetchImpl();
    const result = await generateAndPublishBatch({
      db: handle.db,
      account: { ...baseAccount, postingHoursLocal: [3] },
      env: baseEnv,
      repoRoot: scratchDir,
      githubRepoSlug: "owner/repo",
      hashtagPools: { motivational: ["#tag1"], general: [] },
      fetchImpl,
      sleepImpl: noSleep,
      now: () => new Date("2026-08-07T12:00:00Z"), // hour 12, not in [3]
    });
    expect(result).toEqual({ skippedReason: "not-posting-hour", items: [] });
  });

  it("throws immediately if there is no ig_token row for the account", async () => {
    const handle2 = await openDb(":memory:"); // no token seeded
    const fetchImpl = await makeFetchImpl();
    await expect(
      generateAndPublishBatch({
        db: handle2.db,
        account: baseAccount,
        env: baseEnv,
        repoRoot: scratchDir,
        githubRepoSlug: "owner/repo",
        hashtagPools: { motivational: ["#tag1"], general: [] },
        fetchImpl,
        sleepImpl: noSleep,
        now: () => new Date("2026-08-07T12:00:00Z"),
      }),
    ).rejects.toThrow(/no ig_token row/);
    handle2.close();
  });

  it("runs a full batch of 5, publishing to Feed + Stories, recording posts/usage/mode outcomes", async () => {
    await seedContent(handle.db, 10);
    const fetchImpl = await makeFetchImpl();

    const result = await generateAndPublishBatch({
      db: handle.db,
      account: baseAccount,
      env: baseEnv,
      repoRoot: scratchDir,
      githubRepoSlug: "owner/repo",
      hashtagPools: { motivational: Array.from({ length: 20 }, (_, i) => `#tag${i}`), general: [] },
      fetchImpl,
      sleepImpl: noSleep,
      randomImpl: noJitterRandom,
      now: () => new Date("2026-08-07T12:00:00Z"),
    });

    expect(result.items).toHaveLength(5);
    expect(result.items.every((item) => item.status === "published")).toBe(true);

    const { countPublishedSince } = await import("../../src/db/repositories/posts.repo.js");
    const count = await countPublishedSince(handle.db, "acct1", new Date(0).toISOString());
    expect(count).toBe(5);
  }, 60000);

  it("marks a per-item failure and continues the batch rather than aborting (external dep failure isolation)", async () => {
    await seedContent(handle.db, 10);
    let ignoreFirstFeedCreate = true;
    const fetchImpl = await makeFetchImpl({
      "graph.facebook.com": (url: string) => {
        if (!url.includes("ig_audio") && !url.includes("media_publish") && !url.includes("comments") && !url.includes("fields=") && ignoreFirstFeedCreate) {
          ignoreFirstFeedCreate = false;
          return jsonResponse(400, { error: { message: "Simulated container failure" } });
        }
        if (url.includes("/media_publish")) return jsonResponse(200, { id: "ig-media-1" });
        if (url.includes("/comments")) return jsonResponse(200, { id: "comment-1" });
        if (url.includes("fields=status_code")) return jsonResponse(200, { status_code: "FINISHED" });
        if (url.includes("fields=permalink")) return jsonResponse(200, { permalink: "https://instagram.com/p/x" });
        return jsonResponse(200, { id: "ig-creation-1" });
      },
    });

    const result = await generateAndPublishBatch({
      db: handle.db,
      account: baseAccount,
      env: baseEnv,
      repoRoot: scratchDir,
      githubRepoSlug: "owner/repo",
      hashtagPools: { motivational: Array.from({ length: 20 }, (_, i) => `#tag${i}`), general: [] },
      fetchImpl,
      sleepImpl: noSleep,
      randomImpl: noJitterRandom,
      now: () => new Date("2026-08-07T12:00:00Z"),
    });

    expect(result.items).toHaveLength(5);
    expect(result.items[0]?.status).toBe("failed");
    expect(result.items.slice(1).every((item) => item.status === "published")).toBe(true);
  }, 60000);

  it("aborts the remaining batch after 3 consecutive item failures", async () => {
    await seedContent(handle.db, 10);
    const fetchImpl = await makeFetchImpl({
      "graph.facebook.com": () => jsonResponse(400, { error: { message: "Always fails" } }),
    });

    const result = await generateAndPublishBatch({
      db: handle.db,
      account: baseAccount,
      env: baseEnv,
      repoRoot: scratchDir,
      githubRepoSlug: "owner/repo",
      hashtagPools: { motivational: Array.from({ length: 20 }, (_, i) => `#tag${i}`), general: [] },
      fetchImpl,
      sleepImpl: noSleep,
      randomImpl: noJitterRandom,
      now: () => new Date("2026-08-07T12:00:00Z"),
    });

    expect(result.items).toHaveLength(3);
    expect(result.items.every((item) => item.status === "failed")).toBe(true);
  }, 60000);

  it("dry run composes real images without an ig_token row, without the posting-hour gate, and never calls the social APIs", async () => {
    const handle2 = await openDb(":memory:"); // deliberately no ig_token row seeded
    await seedContent(handle2.db, 10);
    let socialApiCalled = false;
    const fetchImpl = await makeFetchImpl({
      "graph.facebook.com": () => {
        socialApiCalled = true;
        return jsonResponse(200, { id: "should-not-be-called" });
      },
    });

    const result = await generateAndPublishBatch({
      db: handle2.db,
      account: { ...baseAccount, postingHoursLocal: [3] }, // current hour (12) deliberately excluded
      env: baseEnv,
      repoRoot: scratchDir,
      githubRepoSlug: "owner/repo",
      hashtagPools: { motivational: Array.from({ length: 20 }, (_, i) => `#tag${i}`), general: [] },
      fetchImpl,
      sleepImpl: noSleep,
      randomImpl: noJitterRandom,
      now: () => new Date("2026-08-07T12:00:00Z"),
      dryRun: true,
    });

    expect(result.skippedReason).toBeUndefined();
    expect(result.items).toHaveLength(5);
    expect(result.items.every((item) => item.status === "composed")).toBe(true);
    expect(result.items.every((item) => typeof item.composedImagePath === "string")).toBe(true);
    expect(socialApiCalled).toBe(false);

    const { countPublishedSince } = await import("../../src/db/repositories/posts.repo.js");
    expect(await countPublishedSince(handle2.db, "acct1", new Date(0).toISOString())).toBe(0);
    handle2.close();
  }, 60000);

  it("prunes composited images for posts published more than IMAGE_RETENTION_DAYS ago, keeps recent ones", async () => {
    await seedContent(handle.db, 10);
    const { insertPendingPost, markPublished } = await import("../../src/db/repositories/posts.repo.js");

    const oldPath = "data/posts/acct1/old.jpg";
    const recentPath = "data/posts/acct1/recent.jpg";
    await mkdir(`${scratchDir}/data/posts/acct1`, { recursive: true });
    await writeFile(`${scratchDir}/${oldPath}`, Buffer.from("old"));
    await writeFile(`${scratchDir}/${recentPath}`, Buffer.from("recent"));

    // "now" is 2026-08-07T12:00Z; retention cutoff is 3 days back (2026-08-04T12:00Z).
    await insertPendingPost(handle.db, {
      id: "old1",
      accountId: "acct1",
      templateId: "t",
      captionTemplateId: "c",
      mode: "dark",
      scheduledFor: "2026-08-01T12:00:00Z",
    });
    await markPublished(handle.db, "old1", { publishedAt: "2026-08-01T12:00:00Z", composedImagePath: oldPath });

    await insertPendingPost(handle.db, {
      id: "recent1",
      accountId: "acct1",
      templateId: "t",
      captionTemplateId: "c",
      mode: "dark",
      scheduledFor: "2026-08-06T12:00:00Z",
    });
    await markPublished(handle.db, "recent1", { publishedAt: "2026-08-06T12:00:00Z", composedImagePath: recentPath });

    const fetchImpl = await makeFetchImpl();
    await generateAndPublishBatch({
      db: handle.db,
      account: baseAccount,
      env: baseEnv,
      repoRoot: scratchDir,
      githubRepoSlug: "owner/repo",
      hashtagPools: { motivational: Array.from({ length: 20 }, (_, i) => `#tag${i}`), general: [] },
      fetchImpl,
      sleepImpl: noSleep,
      randomImpl: noJitterRandom,
      now: () => new Date("2026-08-07T12:00:00Z"),
    });

    await expect(readFile(`${scratchDir}/${oldPath}`)).rejects.toThrow();
    expect((await readFile(`${scratchDir}/${recentPath}`)).toString()).toBe("recent");

    const oldRow = (await handle.db.select().from(posts).where(eq(posts.id, "old1")))[0];
    const recentRow = (await handle.db.select().from(posts).where(eq(posts.id, "recent1")))[0];
    expect(oldRow?.composedImagePath).toBeNull();
    expect(recentRow?.composedImagePath).toBe(recentPath);
  }, 60000);

  it("publishes via Composio when COMPOSIO_API_KEY is set", async () => {
    await seedContent(handle.db, 2);
    const composioFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("backend.composio.dev")) {
        return jsonResponse(200, { data: { id: "comp-123", permalink: "https://instagram.com/p/C123/" } });
      }
      if (url.includes("vision.googleapis.com")) {
        return jsonResponse(200, { responses: [{ safeSearchAnnotation: { adult: "VERY_UNLIKELY", violence: "VERY_UNLIKELY", racy: "VERY_UNLIKELY" } }] });
      }
      if (url.includes("api.jina.ai")) {
        return jsonResponse(200, { data: [{ embedding: [0.1, 0.2, 0.3] }] });
      }
      if (url.includes("example.com")) {
        const buf = await solidColorImage(64, 64, { r: 10, g: 10, b: 10 });
        return new Response(buf, { status: 200, headers: { "content-type": "image/png" } });
      }
      return jsonResponse(404, {});
    });

    const envWithComposio: Env = { ...baseEnv, COMPOSIO_API_KEY: "comp-key-123" };
    const result = await generateAndPublishBatch({
      db: handle.db,
      account: baseAccount,
      env: envWithComposio,
      repoRoot: scratchDir,
      githubRepoSlug: "owner/repo",
      hashtagPools: { motivational: Array.from({ length: 20 }, (_, i) => `#tag${i}`), general: [] },
      fetchImpl: composioFetch,
      sleepImpl: noSleep,
      randomImpl: noJitterRandom,
      now: () => new Date("2026-08-07T12:00:00Z"),
    });

    expect(result.skippedReason).toBeUndefined();
    expect(result.items.length).toBeGreaterThan(0);
    const publishedPost = (await handle.db.select().from(posts))[0];
    expect(publishedPost?.igMediaId).toBe("comp-123");
    expect(publishedPost?.igPermalink).toBe("https://instagram.com/p/C123/");
  }, 60000);
});
