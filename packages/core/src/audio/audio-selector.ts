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
  quoteLength: number; // Character count of the quote
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
 * 6-Step Audio Selection Engine implementing psychological retention strategies.
 */
export function selectStoryAudio(input: SelectAudioInput): SelectedAudioResult {
  const { category, mode, quoteLength, recentAudioIds = [], availableTracks, random = Math.random } = input;

  // Step 1: Mathematical Pacing & Loop Calculation
  // Assuming average 5 characters per word and 200 words per minute reading speed
  const wordCount = Math.max(1, quoteLength / 5);
  const readingTimeSeconds = (wordCount / 200) * 60;
  // Exact duration with 1s padding, clamped between 5s and 15s for optimal loops
  const durationSeconds = Math.max(5, Math.min(15, Math.ceil(readingTimeSeconds + 1.0)));

  // Step 2 & 3: Pool initialization and Commercial Filter
  const pool = availableTracks.length > 0 ? availableTracks : [...FALLBACK_AUDIO_CATALOG];
  let commercialTracks = pool.filter((t) => t.isAdsEligible !== false);

  if (commercialTracks.length === 0) {
    commercialTracks = [...FALLBACK_AUDIO_CATALOG];
  }

  // Step 4: Anti-Fatigue Memory (Filter out recently used tracks)
  const freshTracks = commercialTracks.filter((t) => !recentAudioIds.includes(t.audioId));
  let candidates = freshTracks.length > 0 ? freshTracks : commercialTracks;

  // Step 5: Granular Sentiment & "Vibe" Shortlisting
  // If dark mode, prioritize minor key/ambient tracks (e.g., stoic/mindset).
  // If light mode, prioritize upbeat/epic tracks.
  // We use the fallback catalog's category as a proxy for mood in this simple implementation.
  let moodCandidates = candidates.filter((t) => {
    if (mode === "dark") {
      return t.category === "mindset" || t.category === "mindfulness" || t.category?.toLowerCase() === category.toLowerCase();
    }
    return t.category === "motivation" || t.category === "business" || t.category?.toLowerCase() === category.toLowerCase();
  });

  if (moodCandidates.length === 0) {
    moodCandidates = candidates;
  }

  const chosenTrack = moodCandidates[Math.floor(random() * moodCandidates.length)] ?? FALLBACK_AUDIO_CATALOG[0]!;

  // Step 6: Peak Audio Extraction & Drop Alignment
  // We offset by 8s by default to hit the beat drop (unless it's a very short track)
  const peakStartSecond = chosenTrack.durationMs > 30000 ? 8 : 0;

  return {
    track: chosenTrack,
    peakStartSecond,
    durationSeconds,
  };
}
