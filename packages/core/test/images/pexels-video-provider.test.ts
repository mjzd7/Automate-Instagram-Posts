import { describe, expect, it, vi } from "vitest";
import { fetchPexelsVideo } from "../../src/images/pexels-video-provider.js";

describe("fetchPexelsVideo", () => {
  it("fetches and parses portrait video files from Pexels Video API", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          videos: [
            {
              id: 998877,
              duration: 12,
              width: 1080,
              height: 1920,
              video_files: [
                {
                  id: 1122,
                  quality: "hd",
                  file_type: "video/mp4",
                  width: 1080,
                  height: 1920,
                  link: "https://example.com/video-1080p.mp4",
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const video = await fetchPexelsVideo("moody rain", "test-key", mockFetch);
    expect(video.id).toBe("pexels-vid-998877");
    expect(video.url).toBe("https://example.com/video-1080p.mp4");
    expect(video.width).toBe(1080);
    expect(video.height).toBe(1920);
  });
});
