import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { composeCarouselDeck } from "../src/multi-series/images/compose-carousel-deck.js";
import { loadApprovedItems } from "../src/multi-series/quotes/content-pack.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const artifactDir = "/Users/mm/.gemini/antigravity-cli/brain/0704bd6a-9dda-48fd-885f-c249ec8e70c6";

async function main() {
  const items = await loadApprovedItems(join(repoRoot, "data/content-packs/mindset-manual/2026-09.json"));
  const sampleItem = items[0]!;

  console.log("Composing 5-Slide Carousel Deck for:", sampleItem.framework?.title || sampleItem.id);

  const darkSolid = await sharp({
    create: { width: 1080, height: 1350, channels: 3, background: { r: 12, g: 12, b: 16 } },
  }).jpeg().toBuffer();

  const lightSolid = await sharp({
    create: { width: 1080, height: 1350, channels: 3, background: { r: 248, g: 246, b: 242 } },
  }).jpeg().toBuffer();

  // Render Dark Mode Deck
  const darkSlides = await composeCarouselDeck({
    backgroundBuffer: darkSolid,
    item: sampleItem,
    mode: "dark",
    seriesName: "MINDSET MANUAL",
  });

  // Render Light Mode Deck
  const lightSlides = await composeCarouselDeck({
    backgroundBuffer: lightSolid,
    item: sampleItem,
    mode: "light",
    seriesName: "MINDSET MANUAL",
  });

  await mkdir(join(repoRoot, "data/dry-run"), { recursive: true });

  for (let i = 0; i < darkSlides.length; i++) {
    const filename = `carousel-mindset-slide-${i + 1}-dark.jpg`;
    await writeFile(join(repoRoot, "data/dry-run", filename), darkSlides[i]!);
    await writeFile(join(artifactDir, filename), darkSlides[i]!);
    console.log(`✅ Saved ${filename} (${darkSlides[i]!.length} bytes)`);
  }

  for (let i = 0; i < lightSlides.length; i++) {
    const filename = `carousel-mindset-slide-${i + 1}-light.jpg`;
    await writeFile(join(repoRoot, "data/dry-run", filename), lightSlides[i]!);
    await writeFile(join(artifactDir, filename), lightSlides[i]!);
    console.log(`✅ Saved ${filename} (${lightSlides[i]!.length} bytes)`);
  }

  console.log("\n🎉 Successfully rendered complete 5-slide viral carousel decks in both Dark and Light modes!");
}

main().catch(console.error);
