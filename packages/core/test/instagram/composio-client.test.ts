import { describe, expect, it, vi } from "vitest";
import { publishViaComposio, publishViaComposioStories, publishViaComposioReels } from "../../src/instagram/composio-client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("publishViaComposio", () => {
  it("creates media container and publishes via Composio v3.1 tools", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { id: "container-999" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: {
            id: "comp-media-123",
            permalink: "https://instagram.com/p/C123456/",
          },
        }),
      );

    const result = await publishViaComposio({
      imageUrl: "https://example.com/quote.jpg",
      caption: "Inspiring quote #motivation",
      apiKey: "test-composio-key",
      igUserId: "ig-user-999",
      fetchImpl,
    });

    expect(result).toEqual({
      mediaId: "comp-media-123",
      permalink: "https://instagram.com/p/C123456/",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url1, init1] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url1).toBe("https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_CREATE_MEDIA_CONTAINER");
    expect(init1.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-api-key": "test-composio-key",
    });

    const [url2] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(url2).toBe("https://backend.composio.dev/api/v3.1/tools/execute/INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH");
  });

  it("throws clear error message when Composio returns a non-200 response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: "Invalid Composio API key" }));

    await expect(
      publishViaComposio({
        imageUrl: "https://example.com/quote.jpg",
        caption: "Test",
        apiKey: "bad-key",
        fetchImpl,
      }),
    ).rejects.toThrow("Composio create container error (401)");
  });
});

describe("publishViaComposioStories", () => {
  it("publishes MP4 video story using video_url and STORIES media_type via Composio", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { id: "story-video-container-1" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: {
            id: "comp-story-video-123",
          },
        }),
      );

    const videoUrl = "https://raw.githubusercontent.com/user/repo/main/data/posts/acc1/2026-08-11-story.mp4";
    const result = await publishViaComposioStories({
      imageUrl: videoUrl,
      caption: "",
      apiKey: "test-composio-key",
      igUserId: "ig-user-999",
      fetchImpl,
    });

    expect(result).toEqual({
      mediaId: "comp-story-video-123",
      permalink: undefined,
    });

    const [, init1] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body1 = JSON.parse(init1.body as string);
    expect(body1.arguments.media_type).toBe("STORIES");
    expect(body1.arguments.video_url).toBe(videoUrl);
    expect(body1.arguments.image_url).toBeUndefined();
  }, 15000);
});

describe("publishViaComposioReels", () => {
  it("publishes MP4 as a Reel with REELS media_type, video_url, caption and share_to_feed=true", async () => {
    const fetchImpl = vi
      .fn()
      // Step 1: create container
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { id: "reel-container-1" } }),
      )
      // Step 2: publish (igUserId is passed explicitly, so user-info fetch is skipped)
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { id: "reel-media-123" } }),
      );

    const videoUrl = "https://automate-instagram-posts.vercel.app/api/media/main/2026-08-13-story.mp4";
    const result = await publishViaComposioReels({
      imageUrl: videoUrl,
      caption: "Test caption #reels",
      apiKey: "test-composio-key",
      igUserId: "ig-user-999",
      fetchImpl,
    });

    expect(result).toEqual({ mediaId: "reel-media-123", permalink: undefined });

    const [, init1] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body1 = JSON.parse(init1.body as string);
    expect(body1.arguments.media_type).toBe("REELS");
    expect(body1.arguments.video_url).toBe(videoUrl);
    expect(body1.arguments.caption).toBe("Test caption #reels");
    expect(body1.arguments.share_to_feed).toBe(true);
  }, 20000);
});
