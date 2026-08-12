import { describe, expect, it, vi } from "vitest";
import { publishToStories } from "../../src/instagram/stories-client.js";
import type { IGCredentials } from "../../src/instagram/client.js";

const creds: IGCredentials = { accessToken: "test-token", igUserId: "17841400000000000" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const noSleep = () => Promise.resolve();

describe("publishToStories", () => {
  it("creates a STORIES-type container, waits, and publishes", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "creation-1" }))
      .mockResolvedValueOnce(jsonResponse(200, { status_code: "FINISHED" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "story-media-1" }));

    const result = await publishToStories("https://example.com/img.jpg", creds, fetchImpl, noSleep);
    expect(result).toEqual({ mediaId: "story-media-1" });

    const [, createInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const createBody = JSON.parse(createInit.body as string);
    expect(createBody.media_type).toBe("STORIES");
    expect(createBody.image_url).toBe("https://example.com/img.jpg");
  });

  it("throws with the Graph API error message when container creation fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "Bad image" } }));
    await expect(publishToStories("bad-url", creds, fetchImpl, noSleep)).rejects.toThrow(/Bad image/);
  });

  it("does not attempt publish if the container never finishes (error path plane)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "creation-1" }))
      .mockResolvedValue(jsonResponse(200, { status_code: "ERROR" }));
    await expect(publishToStories("https://example.com/img.jpg", creds, fetchImpl, noSleep)).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("creates a STORIES-type container with video_url when publishing an MP4 video story with audio", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "video-creation-1" }))
      .mockResolvedValueOnce(jsonResponse(200, { status_code: "FINISHED" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "story-video-media-1" }));

    const videoUrl = "https://raw.githubusercontent.com/user/repo/main/data/posts/acc1/2026-08-11-post1-story.mp4";
    const result = await publishToStories(videoUrl, creds, fetchImpl, noSleep);

    expect(result).toEqual({ mediaId: "story-video-media-1" });

    const [, createInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const createBody = JSON.parse(createInit.body as string);
    expect(createBody.media_type).toBe("STORIES");
    expect(createBody.video_url).toBe(videoUrl);
    expect(createBody.image_url).toBeUndefined();
  });
});
