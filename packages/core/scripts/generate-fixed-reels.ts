import { composeVideoReel } from "../src/pipeline/video-compositor.js";
import { join } from "path";
import type { MetaAudioTrack } from "../src/audio/meta-audio-client.js";

// Mocking the Meta Graph API response for /ig_audio
const MOCK_IG_API_RESPONSE: MetaAudioTrack[] = [
  {
    audioId: "ig-trending-101",
    title: "Interstellar Theme (Slowed)",
    displayArtist: "Hans Zimmer",
    durationMs: 45000,
    audioType: "music",
    downloadUrl: "https://raw.githubusercontent.com/mjzd7/Automate-Instagram-Posts/main/data/audio/fallback/mindset.mp3",
    isAdsEligible: true,
    category: "mindset"
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
  { text: "A smooth sea never made a skilled sailor.", author: "Franklin D. Roosevelt", category: "stoic" },
  { text: "Discipline is doing what you hate to do.", author: "Mike Tyson", category: "discipline" },
  { text: "Your mind is a weapon. Keep it loaded.", author: "David Goggins", category: "mindset" },
  { text: "Knowledge speaks, but wisdom listens.", author: "Jimi Hendrix", category: "wisdom" },
  { text: "True love is born from understanding.", author: "Gautama Buddha", category: "love" }
];

async function run() {
  const artifactDir = "/Users/mm/.gemini/antigravity-cli/brain/dd1de802-bb53-4ae4-92c5-3c23d3dfed02";
  
  console.log("Generating 5 aesthetic reels with chessboard theme and memory...");

  // In production, generate-and-publish-batch tracks this in DB
  const usedAudioIds: string[] = [];

  for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    if (!q) continue;
    // Alternating mode (chessboard)
    const mode = i % 2 === 0 ? "dark" : "light";
    
    // Filter the mock tracks to simulate Anti-Fatigue Memory
    const freshTracks = MOCK_IG_API_RESPONSE.filter(t => !usedAudioIds.includes(t.audioId));
    
    const outputFile = join(artifactDir, `fixed-reel-${i + 1}-${q.category}-${mode}.mp4`);
    console.log(`\n=== Generating Reel ${i + 1}/5 for category: ${q.category} [Mode: ${mode}] ===`);
    try {
      await composeVideoReel(
        q.text, 
        q.category, 
        outputFile, 
        freshTracks, 
        false, 
        mode,
        q.author
      );
      
      // We must extract the chosen track ID in our test script.
      // Since video-compositor.ts does not return it, we'll just mock recording the used tracks
      // based on the freshTracks pool to ensure variation!
      if (freshTracks.length > 0 && freshTracks[0]) {
        usedAudioIds.push(freshTracks[0].audioId);
      }
      
      console.log(`Finished ${outputFile}`);
    } catch (err) {
      console.error(`Failed to generate reel ${i + 1}:`, err);
    }
  }
}

run().catch(console.error);
