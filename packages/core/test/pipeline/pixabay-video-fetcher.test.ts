import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPixabayVideo } from "../../src/pipeline/pixabay-video-fetcher.js";

const ORIGINAL_ENV = { ...process.env };

function setRequiredEnv(withPixabayKey: boolean): void {
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  process.env.GOOGLE_CLOUD_VISION_API_KEY = "vision-key";
  process.env.UNSPLASH_ACCESS_KEY = "unsplash-key";
  process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/x/y";
  process.env.JINA_API_KEY = "jina-key";
  if (withPixabayKey) {
    process.env.PIXABAY_API_KEY = "pixabay-key";
  } else {
    delete process.env.PIXABAY_API_KEY;
  }
}

interface MockFormat {
  url: string;
  width: number;
  height: number;
}

function pixabayResponse(formats: Record<string, MockFormat>, duration = 20): Response {
  return new Response(
    JSON.stringify({ total: formats.length, hits: [{ duration, videos: formats }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("fetchPixabayVideo", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("returns null without touching the API when PIXABAY_API_KEY is unset", async () => {
    setRequiredEnv(false);
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    const result = await fetchPixabayVideo("discipline", "dark", undefined);

    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("prefers the large format from the first query when nothing is excluded", async () => {
    setRequiredEnv(true);
    const fetchImpl = vi.fn(async () =>
      pixabayResponse({
        large: { url: "https://pix.example/large.mp4", width: 1080, height: 1920 },
        tiny: { url: "https://pix.example/tiny.mp4", width: 360, height: 640 },
      }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    const result = await fetchPixabayVideo("discipline", "dark", undefined);

    expect(result?.url).toBe("https://pix.example/large.mp4");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("skips excluded links and falls through to later queries for a fresh candidate", async () => {
    setRequiredEnv(true);
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const query = new URL(typeof input === "string" ? input : input.toString()).searchParams.get("q") ?? "";
      if (query === "discipline dark moody black night no people") {
        return pixabayResponse({ large: { url: "https://pix.example/rejected.mp4", width: 1080, height: 1920 } });
      }
      return pixabayResponse({ large: { url: "https://pix.example/fresh.mp4", width: 1080, height: 1920 } });
    });
    vi.stubGlobal("fetch", fetchImpl);

    const result = await fetchPixabayVideo("discipline", "dark", undefined, new Set(["https://pix.example/rejected.mp4"]));

    expect(result?.url).toBe("https://pix.example/fresh.mp4");
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("returns null after exhausting the ladder when every candidate is excluded", async () => {
    setRequiredEnv(true);
    const fetchImpl = vi.fn(async () =>
      pixabayResponse({ large: { url: "https://pix.example/rejected.mp4", width: 1080, height: 1920 } }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    const result = await fetchPixabayVideo("discipline", "dark", undefined, new Set(["https://pix.example/rejected.mp4"]));

    expect(result).toBeNull();
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(9);
  });
});
