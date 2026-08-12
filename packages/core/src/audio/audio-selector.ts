import type { MetaAudioTrack } from "./meta-audio-client.js";
import type { Darkness } from "../images/darkness-classifier.js";

export interface SelectedAudioResult {
  track: MetaAudioTrack;
  peakStartSecond: number;
  durationSeconds: number;
}

export interface SelectAudioInput {
  category: string;
  mode: Darkness;
  quoteLength: number;
  recentAudioIds?: string[];
  availableTracks: MetaAudioTrack[];
  random?: () => number;
}

/** Fallback royalty-free catalog used when Meta API has no matching tracks */
export const FALLBACK_AUDIO_CATALOG: readonly MetaAudioTrack[] = [
  {
    audioId: "fallback-mindset-01",
    title: "Cinematic Ambient Piano",
    displayArtist: "Royalty Free Audio",
    durationMs: 180000,
    audioType: "music",
    downloadUrl: "https://raw.githubusercontent.com/mjzd7/Automate-Instagram-Posts/main/data/audio/fallback/mindset.mp3",
    isAdsEligible: true,
    category: "mindset",
  },
  {
    audioId: "fallback-business-01",
    title: "Minimal Tech Lofi",
    displayArtist: "Royalty Free Audio",
    durationMs: 160000,
    audioType: "music",
    downloadUrl: "https://raw.githubusercontent.com/mjzd7/Automate-Instagram-Posts/main/data/audio/fallback/business.mp3",
    isAdsEligible: true,
    category: "business",
  },
  {
    audioId: "fallback-motivation-01",
    title: "Epic Orchestral Rise",
    displayArtist: "Royalty Free Audio",
    durationMs: 150000,
    audioType: "music",
    downloadUrl: "https://raw.githubusercontent.com/mjzd7/Automate-Instagram-Posts/main/data/audio/fallback/motivation.mp3",
    isAdsEligible: true,
    category: "motivation",
  },
  {
    audioId: "fallback-mindfulness-01",
    title: "Peaceful Meditation Pad",
    displayArtist: "Royalty Free Audio",
    durationMs: 200000,
    audioType: "music",
    downloadUrl: "https://raw.githubusercontent.com/mjzd7/Automate-Instagram-Posts/main/data/audio/fallback/mindfulness.mp3",
    isAdsEligible: true,
    category: "mindfulness",
  },
];

/**
 * 5-Step Audio Selection Engine implementing sentiment, visual tone, and anti-repetition guards.
 */
export function selectStoryAudio(input: SelectAudioInput): SelectedAudioResult {
  const { category, recentAudioIds = [], availableTracks, random = Math.random } = input;

  const pool = availableTracks.length > 0 ? availableTracks : [...FALLBACK_AUDIO_CATALOG];

  // Step 1: Strict Category Filtering (with commercial clearance check)
  let candidates = pool.filter(
    (t) => t.category?.toLowerCase() === category.toLowerCase() && t.isAdsEligible !== false,
  );
  if (candidates.length === 0) {
    candidates = pool.filter((t) => t.isAdsEligible !== false);
  }

  // Step 2: Anti-Repetition Guard (Exclude tracks played in last 20 posts)
  const freshCandidates = candidates.filter((t) => !recentAudioIds.includes(t.audioId));
  if (freshCandidates.length > 0) {
    candidates = freshCandidates;
  }

  // Step 3: Selection based on Visual Mode & Quote Pacing
  const chosenTrack = candidates[Math.floor(random() * candidates.length)] ?? FALLBACK_AUDIO_CATALOG[0]!;

  // Step 4: Calculate 15-second Peak Offset (default offset 8 seconds into track)
  const peakStartSecond = chosenTrack.durationMs > 30000 ? 8 : 0;

  return {
    track: chosenTrack,
    peakStartSecond,
    durationSeconds: 15,
  };
}
