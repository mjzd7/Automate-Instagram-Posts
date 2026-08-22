import { describe, expect, it, vi } from "vitest";
import { publishToReels, type PublishToReelsOptions } from "../../src/instagram/reels-client.js";

const creds = { accessToken: "test-token", igUserId: "17841400000000000" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const noSleep = () => Promise.resolve();

function reelFetchMock() {
  return vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(200, { id: "creation-123" })) // container create
    .mockResolvedValueOnce(jsonResponse(200, { status_code: "FINISHED" })) // status poll
    .mockResolvedValueOnce(jsonResponse(200, { id: "media-456" })); // media_publish
}

function containerCreateBody(fetchImpl: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
  expect(url).toContain(`/${creds.igUserId}/media`);
  return JSON.parse(init.body as string);
}

describe("publishToReels", () => {
  it("sends audio_configuration on container creation when options.audioId is set (licensed-track attribution)", async () => {
    const fetchImpl = reelFetchMock();
    const result = await publishToReels("https://example.com/reel.mp4", "cap", creds, fetchImpl, noSleep, {
      audioId: "1784140000999",
    });
    expect(result).toEqual({ mediaId: "media-456" });
    const body = containerCreateBody(fetchImpl);
    expect(body).toMatchObject({
      media_type: "REELS",
      video_url: "https://example.com/reel.mp4",
      caption: "cap",
      access_token: "test-token",
    });
    expect(JSON.parse(body.audio_configuration as string)).toEqual({
      audio_id: "1784140000999",
      audio_volume: 100,
      video_volume: 0,
    });
    expect(body.audio_id).toBeUndefined();
  });

  it("omits audio_configuration when options.audioId is not set (original-audio behaviour preserved)", async () => {
    const fetchImpl = reelFetchMock();
    await publishToReels("https://example.com/reel.mp4", "cap", creds, fetchImpl, noSleep);
    const body = containerCreateBody(fetchImpl);
    expect(body.audio_configuration).toBeUndefined();
  });

  it("still sends cover_url alongside audio_configuration when both options are set", async () => {
    const fetchImpl = reelFetchMock();
    await publishToReels("https://example.com/reel.mp4", "cap", creds, fetchImpl, noSleep, {
      coverUrl: "https://example.com/cover.jpg",
      audioId: "42",
    } satisfies PublishToReelsOptions);
    const body = containerCreateBody(fetchImpl);
    expect(body.cover_url).toBe("https://example.com/cover.jpg");
    expect(JSON.parse(body.audio_configuration as string)).toMatchObject({ audio_id: "42" });
  });
});
