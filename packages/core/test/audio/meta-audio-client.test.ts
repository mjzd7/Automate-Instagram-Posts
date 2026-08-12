import { describe, expect, it, vi } from "vitest";
import { searchMetaAudioTracks } from "../../src/audio/meta-audio-client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("meta-audio-client", () => {
  it("fetches audio tracks and filters for commercially eligible tracks", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        audio: [
          {
            audio_id: "track-101",
            title: "Ambient Piano",
            display_artist: "Artist A",
            duration_in_ms: 120000,
            audio_type: "music",
            download_url: "https://example.com/audio1.mp3",
            is_ads_eligible: true,
          },
          {
            audio_id: "track-102",
            title: "Pop Track",
            display_artist: "Artist B",
            duration_in_ms: 180000,
            audio_type: "music",
            is_ads_eligible: false,
          },
        ],
      }),
    );

    const tracks = await searchMetaAudioTracks({
      igUserId: "user-123",
      accessToken: "token-abc",
      query: "ambient piano",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(tracks.length).toBe(1);
    expect(tracks[0]).toEqual({
      audioId: "track-101",
      title: "Ambient Piano",
      displayArtist: "Artist A",
      durationMs: 120000,
      audioType: "music",
      downloadUrl: "https://example.com/audio1.mp3",
      previewUrl: undefined,
      isAdsEligible: true,
    });
  });

  it("returns empty array on API error or network failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, { error: "Server Error" }));
    const tracks = await searchMetaAudioTracks({
      igUserId: "user-123",
      accessToken: "token-abc",
      fetchImpl,
    });
    expect(tracks).toEqual([]);
  });
});
