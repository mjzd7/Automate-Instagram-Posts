import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { composeStory } from "../src/images/story-compositor.js";
import { scoreSuitability } from "../src/images/suitability-scorer.js";
import { findTemplate, STORY_TEMPLATES } from "../src/images/templates.js";
import type { Darkness } from "../src/images/darkness-classifier.js";

const DARK_BG = { r: 25, g: 30, b: 45 };

async function main(): Promise<void> {
  const outDir = "preview/stories";
  await mkdir(outDir, { recursive: true });

  const backgroundBuffer = await sharp({
    create: { width: 1080, height: 1920, channels: 3, background: DARK_BG },
  })
    .jpeg()
    .toBuffer();

  const suitability = await scoreSuitability(backgroundBuffer);
  const sampleQuote = "Opportunities don't happen. You create them.";
  const sampleAuthor = "Chris Grosser";
  const template = findTemplate("bold-modern");
  const mode: Darkness = "dark";

  console.log(`Rendering story template previews to ${outDir}...`);

  for (const storyTpl of STORY_TEMPLATES) {
    const result = await composeStory({
      backgroundBuffer,
      quoteText: sampleQuote,
      author: sampleAuthor,
      template,
      mode,
      suitability,
      accountHandle: "@success.for.sure",
      storyTemplateId: storyTpl.id,
    });

    const filename = `${outDir}/${storyTpl.id}.jpg`;
    await writeFile(filename, result.imageBuffer);
    console.log(`  ✓ Saved ${filename} (${result.linkStickerZone.width}x${result.linkStickerZone.height} sticker zone)`);
  }

  console.log("All story preview templates rendered successfully!");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
