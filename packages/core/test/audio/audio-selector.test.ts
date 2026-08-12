import { describe, expect, it } from "vitest";
import { selectStoryAudio } from "../../src/audio/audio-selector.js";
import type { MetaAudioTrack } from "../../src/audio/meta-audio-client.js";

const sampleTracks: MetaAudioTrack[] = [
  {
    audioId: "track-stoic",
    title: "Stoic Reflection",
    displayArtist: "Artist 1",
    durationMs: 180000,
    audioType: "music",
    isAdsEligible: true,
    category: "stoic",
  },
  {
    audioId: "track-stoic-02",
    title: "Stoic Meditation 2",
    displayArtist: "Artist 1B",
    durationMs: 160000,
    audioType: "music",
    isAdsEligible: true,
    category: "stoic",
  },
  {
    audioId: "track-business",
    title: "Business Lofi",
    displayArtist: "Artist 2",
    durationMs: 120000,
    audioType: "music",
    isAdsEligible: true,
    category: "business",
  },
];

describe("audio-selector", () => {
  it("selects audio track matching post category", () => {
    const result = selectStoryAudio({
      category: "stoic",
      mode: "dark",
      quoteLength: 12,
      availableTracks: sampleTracks,
      random: () => 0,
    });

    expect(result.track.audioId).toBe("track-stoic");
    expect(result.peakStartSecond).toBe(8);
    expect(result.durationSeconds).toBe(15);
  });

  it("applies anti-repetition filter to exclude recently used audio tracks", () => {
    const result = selectStoryAudio({
      category: "stoic",
      mode: "dark",
      quoteLength: 12,
      recentAudioIds: ["track-stoic"],
      availableTracks: sampleTracks,
      random: () => 0,
    });

    expect(result.track.audioId).toBe("track-stoic-02");
  });

  it("falls back gracefully to FALLBACK_AUDIO_CATALOG when availableTracks is empty", () => {
    const result = selectStoryAudio({
      category: "business",
      mode: "light",
      quoteLength: 25,
      availableTracks: [],
    });

    expect(result.track).toBeDefined();
    expect(result.durationSeconds).toBe(15);
  });
});
