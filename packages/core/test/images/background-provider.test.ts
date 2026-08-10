import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type DbHandle } from "../../src/db/client.js";
import { insertBackground, findBackgroundById } from "../../src/db/repositories/backgrounds.repo.js";
import { getCandidateBackgrounds } from "../../src/images/background-provider.js";
import { solidColorImage } from "./fixtures.js";

let handle: DbHandle;

beforeEach(async () => {
  handle = await openDb(":memory:");
});

afterEach(() => {
  handle.close();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const safePassBody = { responses: [{ safeSearchAnnotation: { adult: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" } }] };
const safeFailBody = { responses: [{ safeSearchAnnotation: { adult: "LIKELY", violence: "UNLIKELY", racy: "UNLIKELY" } }] };

async function router(routes: Record<string, () => Promise<Response> | Response>): Promise<typeof fetch> {
  const impl: typeof fetch = (input) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [substring, respond] of Object.entries(routes)) {
      if (url.includes(substring)) return Promise.resolve(respond());
    }
    return Promise.resolve(jsonResponse(500, { error: "unmocked" }));
  };
  return impl;
}

describe("getCandidateBackgrounds", () => {
  it("returns a curated background using its cached darkness, without downloading the image", async () => {
    await insertBackground(handle.db, {
      id: "bg1",
      source: "curated",
      sourceUrl: "https://example.com/img.jpg",
      description: "a photo",
      categoryId: "motivational",
    });
    // pre-cache darkness so no image download should be needed for this one
    const { updateDarkness } = await import("../../src/db/repositories/backgrounds.repo.js");
    await updateDarkness(handle.db, "bg1", "dark");

    let imageDownloaded = false;
    const fetchImpl = await router({
      "vision.googleapis.com": () => jsonResponse(200, safePassBody),
      "example.com/img.jpg": () => {
        imageDownloaded = true;
        return jsonResponse(500, {});
      },
    });

    const results = await getCandidateBackgrounds(handle.db, "acct1", "motivational", 5, {
      visionApiKey: "key",
      fetchImpl,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: "bg1", darkness: "dark" });
    expect(imageDownloaded).toBe(false);
  });

  it("computes and caches darkness for a curated candidate with no cached value", async () => {
    await insertBackground(handle.db, {
      id: "bg1",
      source: "curated",
      sourceUrl: "https://example.com/img.jpg",
      categoryId: "motivational",
    });
    const solidBlack = await solidColorImage(100, 100, { r: 0, g: 0, b: 0 });

    const fetchImpl = await router({
      "vision.googleapis.com": () => jsonResponse(200, safePassBody),
      "example.com/img.jpg": () => new Response(solidBlack),
    });

    const results = await getCandidateBackgrounds(handle.db, "acct1", "motivational", 5, {
      visionApiKey: "key",
      fetchImpl,
    });

    expect(results[0]?.darkness).toBe("dark");
    const cached = await findBackgroundById(handle.db, "bg1");
    expect(cached?.darkness).toBe("dark");
  });

  it("excludes a curated candidate that fails SafeSearch", async () => {
    await insertBackground(handle.db, {
      id: "bg1",
      source: "curated",
      sourceUrl: "https://example.com/bad.jpg",
      categoryId: "motivational",
    });
    const fetchImpl = await router({ "vision.googleapis.com": () => jsonResponse(200, safeFailBody) });
    const results = await getCandidateBackgrounds(handle.db, "acct1", "motivational", 5, {
      visionApiKey: "key",
      fetchImpl,
    });
    expect(results).toHaveLength(0);
  });

  it("fails closed (excludes the candidate) when the Vision API call itself throws", async () => {
    await insertBackground(handle.db, {
      id: "bg1",
      source: "curated",
      sourceUrl: "https://example.com/img.jpg",
      categoryId: "motivational",
    });
    const fetchImpl = await router({ "vision.googleapis.com": () => jsonResponse(500, {}) });
    const results = await getCandidateBackgrounds(handle.db, "acct1", "motivational", 5, {
      visionApiKey: "key",
      fetchImpl,
    });
    expect(results).toHaveLength(0);
  });

  it("tops up from Unsplash when the curated pool is short, and inserts the result into the DB", async () => {
    const solidWhite = await solidColorImage(100, 100, { r: 255, g: 255, b: 255 });
    const fetchImpl = await router({
      "vision.googleapis.com": () => jsonResponse(200, safePassBody),
      "api.unsplash.com": () =>
        jsonResponse(200, {
          id: "unsplash-1",
          urls: { regular: "https://images.unsplash.com/photo-1" },
          description: "bright sky",
          user: { name: "Photographer" },
        }),
      "images.unsplash.com/photo-1": () => new Response(solidWhite),
    });

    const results = await getCandidateBackgrounds(handle.db, "acct1", "motivational", 1, {
      visionApiKey: "key",
      unsplashAccessKey: "unsplash-key",
      fetchImpl,
      idGenerator: () => "generated-id",
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: "generated-id", darkness: "light" });
    const stored = await findBackgroundById(handle.db, "generated-id");
    expect(stored?.source).toBe("unsplash");
    expect(stored?.externalId).toBe("unsplash-1");
  });

  it("does not attempt Unsplash top-up when unsplashAccessKey is not configured", async () => {
    const fetchImpl = await router({});
    const results = await getCandidateBackgrounds(handle.db, "acct1", "motivational", 5, {
      visionApiKey: "key",
      fetchImpl,
    });
    expect(results).toHaveLength(0);
  });

  it("stops topping up gracefully (returns partial results) when Unsplash itself fails", async () => {
    const fetchImpl = await router({ "api.unsplash.com": () => jsonResponse(500, {}) });
    const results = await getCandidateBackgrounds(handle.db, "acct1", "motivational", 3, {
      visionApiKey: "key",
      unsplashAccessKey: "key",
      fetchImpl,
    });
    expect(results).toHaveLength(0);
  });
});
