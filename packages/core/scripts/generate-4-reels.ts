import { composeVideoReel } from "../src/pipeline/video-compositor.js";
import { join } from "path";

const quotes = [
  { text: "Your potential is endless. Go do what you were created to do.", category: "motivational" },
  { text: "He who fears death will never do anything worthy of a man who is alive.", category: "stoic" },
  { text: "Love is not about possession. Love is about appreciation.", category: "love" },
  { text: "The successful warrior is the average man, with laser-like focus.", category: "discipline" }
];

async function run() {
  const artifactDir = "/Users/mm/.gemini/antigravity-cli/brain/dd1de802-bb53-4ae4-92c5-3c23d3dfed02";
  
  for (let i = 0; i < quotes.length; i++) {
    const q = quotes[i];
    if (!q) continue;
    const outputFile = join(artifactDir, `reel-${i + 1}-${q.category}.mp4`);
    console.log(`\n=== Generating Reel ${i + 1}/4 for category: ${q.category} ===`);
    try {
      await composeVideoReel(q.text, q.category, outputFile);
      console.log(`Finished ${outputFile}`);
    } catch (err) {
      console.error(`Failed to generate reel ${i + 1}:`, err);
    }
  }
}

run().catch(console.error);
