import sharp from "sharp";
import { composeImage } from "../src/images/compositor.js";
import { scoreSuitability } from "../src/images/suitability-scorer.js";
import { findTemplate } from "../src/images/templates.js";
import type { Darkness } from "../src/images/darkness-classifier.js";

// Runs under tsx (not bundled by Next.js) -- see docs/LEARNINGS.md FR-006:
// compositor.ts's own relative-import chain (constants.js/grain.js/scrim.js/
// text-render.js/darkness-classifier.js/suitability-scorer.js/templates.js,
// all .js-suffixed) is too large to duplicate as a Turbopack-safe boundary
// file the way dashboard-queries.ts did for 3 simple queries, so apps/web's
// /api/preview route shells out to this script instead of importing the
// compositor chain directly. Prints ONLY a base64 JPEG to stdout -- no other
// console.log calls in this file, so the caller can read stdout directly.

const DARK_SOLID = { r: 26, g: 26, b: 30 };
const LIGHT_SOLID = { r: 240, g: 237, b: 230 };

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

async function main(): Promise<void> {
  const templateId = arg("template");
  const mode = arg("mode") as Darkness | undefined;
  const quote = arg("quote");
  const author = arg("author");

  if (!templateId || !mode || !quote) {
    throw new Error("render-preview: --template, --mode, and --quote are required");
  }
  if (mode !== "dark" && mode !== "light") {
    throw new Error(`render-preview: --mode must be "dark" or "light", got "${mode}"`);
  }

  const template = findTemplate(templateId);
  const color = mode === "dark" ? DARK_SOLID : LIGHT_SOLID;
  const backgroundBuffer = await sharp({
    create: { width: 1080, height: 1350, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer();

  const suitability = await scoreSuitability(backgroundBuffer);
  const jpeg = await composeImage({ backgroundBuffer, quoteText: quote, author, template, mode, suitability });

  process.stdout.write(jpeg.toString("base64"));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
