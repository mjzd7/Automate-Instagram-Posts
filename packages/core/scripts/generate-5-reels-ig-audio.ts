import { composeVideoReel } from "../src/pipeline/video-compositor.js";
import { join } from "path";
import type { MetaAudioTrack } from "../src/audio/meta-audio-client.js";

// Mocking the Meta Graph API response for /ig_audio
// This perfectly simulates exactly what Meta returns for trending commercial audio,
// allowing us to test the pipeline without needing a live User Access Token.
const MOCK_IG_API_RESPONSE: MetaAudioTrack[] = [
  {
    audioId: "ig-trending-101",
    title: "Interstellar Theme (Slowed)",
    displayArtist: "Hans Zimmer",
    durationMs: 45000,
    audioType: "music",
    downloadUrl: "https://raw.githubusercontent.com/mjzd7/Automate-Instagram-Posts/main/data/audio/fallback/mindset.mp3",
    isAdsEligible: true,
    category: "mindset" // We use categories to mock Meta's internal classification
  },
  {
    audioId: "ig-trending-102",
    title: "Villian Arc",
    displayArtist: "Trending Sounds",
    durationMs: 35000,
    audioType: "music",
    downloadUrl: "https://raw.githubusercontent.com/mjzd7/Automate-Instagram-Posts/main/data/audio/fallback/motivation.mp3",
    isAdsEligible: true,
    category: "discipline"
  },
  {
    audioId: "ig-trending-103",
    title: "Aesthetic Lofi Chill",
    displayArtist: "Lofi Girl",
    durationMs: 50000,
    audioType: "music",
    downloadUrl: "https://raw.githubusercontent.com/mjzd7/Automate-Instagram-Posts/main/data/audio/fallback/business.mp3",
    isAdsEligible: true,
    category: "wisdom"
  },
  {
    audioId: "ig-trending-104",
    title: "Golden Hour (Instrumental)",
    displayArtist: "JVKE",
    durationMs: 40000,
    audioType: "music",
    downloadUrl: "https://raw.githubusercontent.com/mjzd7/Automate-Instagram-Posts/main/data/audio/fallback/mindfulness.mp3",
    isAdsEligible: true,
    category: "love"
  },
  {
    audioId: "ig-trending-105",
    title: "Unstoppable Drive",
    displayArtist: "Epic Cinematic",
    durationMs: 60000,
    audioType: "music",
    downloadUrl: "https://raw.githubusercontent.com/mjzd7/Automate-Instagram-Posts/main/data/audio/fallback/motivation.mp3",
    isAdsEligible: true,
    category: "stoic"
  }
];

const quotes = [
  { text: "A smooth sea never made a skilled sailor.", category: "stoic" },
  { text: "Discipline is doing what you hate to do, but doing it like you love it.", category: "discipline" },
  { text: "Your mind is a weapon. Keep it loaded.", category: "mindset" },
  { text: "Knowledge speaks, but wisdom listens.", category: "wisdom" },
  { text: "True love is born from understanding.", category: "love" }
];

async function run() {
  const artifactDir = "/Users/mm/.gemini/antigravity-cli/brain/dd1de802-bb53-4ae4-92c5-3c23d3dfed02";
  
  console.log("Simulating Meta Graph API GET /ig_audio response...");
  console.log(`Fetched ${MOCK_IG_API_RESPONSE.length} trending tracks from Meta.\n`);

  for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    if (!q) continue;
    const outputFile = join(artifactDir, `ig-reel-${i + 1}-${q.category}.mp4`);
    console.log(`=== Generating Reel ${i + 1}/5 for category: ${q.category} ===`);
    try {
      // Pass the mock IG Audio tracks as the 4th parameter
      await composeVideoReel(q.text, q.category, outputFile, MOCK_IG_API_RESPONSE);
      console.log(`Finished ${outputFile}\n`);
    } catch (err) {
      console.error(`Failed to generate reel ${i + 1}:`, err);
    }
  }
}

run().catch(console.error);
