import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPexelsVideo } from "../../src/pipeline/video-fetcher.js";

const ORIGINAL_ENV = { ...process.env };

function setRequiredEnv(): void {
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  process.env.GOOGLE_CLOUD_VISION_API_KEY = "vision-key";
  process.env.UNSPLASH_ACCESS_KEY = "unsplash-key";
  process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/x/y";
  process.env.JINA_API_KEY = "jina-key";
  process.env.PEXELS_API_KEY = "pexels-key";
}

interface MockFile {
  link: string;
  width: number;
  height: number;
}

function pexelsResponse(files: MockFile[], duration = 20): Response {
  return new Response(
    JSON.stringify({
      videos: [{ duration, video_files: files.map((f) => ({ ...f, file_type: "video/mp4" })) }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

const REJECTED_4K: MockFile = { link: "https://rejected.example/v.mp4", width: 2160, height: 3840 };
const FRESH_4K: MockFile = { link: "https://fresh.example/v.mp4", width: 2160, height: 3840 };

describe("fetchPexelsVideo", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("returns the best 4K portrait candidate from the first query when nothing is excluded", async () => {
    setRequiredEnv();
    const fetchImpl = vi.fn(async () => pexelsResponse([REJECTED_4K]));
    vi.stubGlobal("fetch", fetchImpl);

    const result = await fetchPexelsVideo("discipline", "dark", undefined);

    expect(result?.url).toBe(REJECTED_4K.link);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("skips excluded links and falls through to later queries for a fresh candidate", async () => {
    setRequiredEnv();
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      const query = new URL(url).searchParams.get("query") ?? "";
      if (query === "discipline dark moody black night no people") {
        return pexelsResponse([REJECTED_4K]);
      }
      return pexelsResponse([FRESH_4K]);
    });
    vi.stubGlobal("fetch", fetchImpl);

    const result = await fetchPexelsVideo("discipline", "dark", undefined, new Set([REJECTED_4K.link]));

    expect(result?.url).toBe(FRESH_4K.link);
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("returns null after exhausting the whole query ladder when every candidate is excluded", async () => {
    setRequiredEnv();
    const fetchImpl = vi.fn(async () => pexelsResponse([REJECTED_4K]));
    vi.stubGlobal("fetch", fetchImpl);

    const result = await fetchPexelsVideo("discipline", "dark", undefined, new Set([REJECTED_4K.link]));

    expect(result).toBeNull();
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(9); // baseQueries + fallback ladder
  });
});
