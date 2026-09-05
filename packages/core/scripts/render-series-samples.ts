import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { loadSeries } from "../src/config/series.js";
import { composeSeriesCard } from "../src/multi-series/images/compose-series-card.js";
import { parsePackItems } from "../src/multi-series/quotes/content-pack.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

async function placeholderBackground(): Promise<Buffer> {
  return sharp({
    create: { width: 1080, height: 1350, channels: 3, background: "#1B2431" },
  })
    .jpeg()
    .toBuffer();
}

async function main(): Promise<void> {
  const outDir = `${repoRoot}data/dry-run`;
  await mkdir(outDir, { recursive: true });

  const series = await loadSeries(`${repoRoot}data/series.json`);
  const background = await placeholderBackground();
  let rendered = 0;

  for (const s of series) {
    const packDir = `${repoRoot}data/content-packs/${s.id}`;
    let files: string[] = [];
    try {
      files = (await readdir(packDir)).filter((f) => f.endsWith(".json")).sort().reverse();
    } catch {
      console.warn(`no packs for ${s.id}, skipping`);
      continue;
    }
    if (files.length === 0) continue;

    const items = parsePackItems(JSON.parse(await readFile(`${packDir}/${files[0]}`, "utf-8")));
    const templateId = s.templateIds[0]!;

    for (const item of items) {
      const jpeg = await composeSeriesCard({ backgroundBuffer: background, templateId, item });
      const outPath = `${outDir}/${item.id}.jpg`;
      await writeFile(outPath, jpeg);
      rendered++;
      console.log(`OK ${item.id}: ${templateId}`);
    }
  }

  console.log(`\n${rendered} sample card(s) in ${outDir}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
