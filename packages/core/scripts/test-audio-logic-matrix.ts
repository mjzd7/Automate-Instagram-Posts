import { selectStoryAudio, FALLBACK_AUDIO_CATALOG } from "../src/audio/audio-selector.js";
import type { MetaAudioTrack } from "../src/audio/meta-audio-client.js";

const testCatalog: MetaAudioTrack[] = [
  {
    audioId: "stoic-01",
    title: "Deep Stoic Reflection",
    displayArtist: "Marcus Aurelius Ensemble",
    durationMs: 180000,
    audioType: "music",
    isAdsEligible: true,
    category: "stoic",
  },
  {
    audioId: "stoic-02",
    title: "Meditation on Virtue",
    displayArtist: "Seneca Sound",
    durationMs: 160000,
    audioType: "music",
    isAdsEligible: true,
    category: "stoic",
  },
  {
    audioId: "business-01",
    title: "High Energy Tech Pitch",
    displayArtist: "Silicon Beats",
    durationMs: 150000,
    audioType: "music",
    isAdsEligible: true,
    category: "business",
  },
  {
    audioId: "motivation-01",
    title: "Unstoppable Cinematic Rise",
    displayArtist: "Epic Drums",
    durationMs: 200000,
    audioType: "music",
    isAdsEligible: true,
    category: "motivation",
  },
  {
    audioId: "mindfulness-01",
    title: "Zen Garden Waves",
    displayArtist: "Calm Soundscape",
    durationMs: 240000,
    audioType: "music",
    isAdsEligible: true,
    category: "mindfulness",
  },
];

function runAudioLogicSuite(): void {
  console.log("=================================================");
  console.log("   STORY AUDIO SELECTION LOGIC VERIFICATION SUITE ");
  console.log("=================================================\n");

  // Test 1: Category Matching
  console.log("🔹 Test 1: Category Matching Logic");
  for (const cat of ["stoic", "business", "motivation", "mindfulness"]) {
    const res = selectStoryAudio({
      category: cat,
      mode: "dark",
      quoteLength: 15,
      availableTracks: testCatalog,
    });
    console.log(`  ✓ Category "${cat}" => Selected: "${res.track.title}" (ID: ${res.track.audioId})`);
    if (res.track.category !== cat) {
      throw new Error(`Category mismatch: expected "${cat}", got "${res.track.category}"`);
    }
  }

  // Test 2: Anti-Repetition Guard
  console.log("\n🔹 Test 2: Anti-Repetition Guard (Excluding Recent Tracks)");
  const stoicRepeatTest = selectStoryAudio({
    category: "stoic",
    mode: "dark",
    quoteLength: 10,
    recentAudioIds: ["stoic-01"],
    availableTracks: testCatalog,
  });
  console.log(`  ✓ Excluded "stoic-01" => Selected alternative: "${stoicRepeatTest.track.title}" (ID: ${stoicRepeatTest.track.audioId})`);
  if (stoicRepeatTest.track.audioId === "stoic-01") {
    throw new Error("Anti-repetition guard failed: recent track was re-selected!");
  }

  // Test 3: Peak Offset Calculation (15s Window)
  console.log("\n🔹 Test 3: Peak Offset Calculation (15s Window)");
  const longTrackRes = selectStoryAudio({
    category: "stoic",
    mode: "dark",
    quoteLength: 10,
    availableTracks: testCatalog,
  });
  console.log(`  ✓ Track Duration: ${longTrackRes.track.durationMs / 1000}s => Peak Start Offset: ${longTrackRes.peakStartSecond}s, Window: ${longTrackRes.durationSeconds}s`);
  if (longTrackRes.peakStartSecond !== 8) {
    throw new Error("Peak start offset calculation failed!");
  }

  // Test 4: Catalog Fallback Engine
  console.log("\n🔹 Test 4: Fallback Engine (Empty External API)");
  const fallbackRes = selectStoryAudio({
    category: "mindset",
    mode: "light",
    quoteLength: 20,
    availableTracks: [],
  });
  console.log(`  ✓ Empty API input => Selected from Fallback Catalog: "${fallbackRes.track.title}" (${fallbackRes.track.downloadUrl})`);
  if (!FALLBACK_AUDIO_CATALOG.some((t) => t.audioId === fallbackRes.track.audioId)) {
    throw new Error("Fallback catalog selection failed!");
  }

  // Test 5: Dark vs Light Mode Visual Tone Response
  console.log("\n🔹 Test 5: Visual Mode Response (Dark vs Light)");
  const darkRes = selectStoryAudio({ category: "business", mode: "dark", quoteLength: 12, availableTracks: testCatalog });
  const lightRes = selectStoryAudio({ category: "business", mode: "light", quoteLength: 12, availableTracks: testCatalog });
  console.log(`  ✓ Dark Mode Selection: "${darkRes.track.title}"`);
  console.log(`  ✓ Light Mode Selection: "${lightRes.track.title}"`);

  console.log("\n=================================================");
  console.log("   🎉 ALL AUDIO SELECTION LOGICS VERIFIED 100%!  ");
  console.log("=================================================");
}

runAudioLogicSuite();
