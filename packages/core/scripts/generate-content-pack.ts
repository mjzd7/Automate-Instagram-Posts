import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generatePackItems } from "../src/multi-series/generation/generate-pack.js";
import { makeGeminiGenerator } from "../src/multi-series/generation/gemini-client.js";
import { SERIES_IDS, type SeriesId } from "../src/multi-series/generation/prompts.js";
import { parsePackItems } from "../src/multi-series/quotes/content-pack.js";

interface CliArgs {
  series: SeriesId;
  count: number;
  month?: string;
  model?: string;
}

function parseArgs(): CliArgs {
  function arg(name: string): string | undefined {
    const prefix = `--${name}=`;
    return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
  }
  const series = arg("series");
  if (!series || !SERIES_IDS.includes(series as SeriesId)) {
    throw new Error(`--series is required and must be one of: ${SERIES_IDS.join(", ")}`);
  }
  const count = Number(arg("count") ?? 10);
  if (!Number.isInteger(count) || count < 1 || count > 60) {
    throw new Error("--count must be an integer between 1 and 60");
  }
  return { series: series as SeriesId, count, month: arg("month"), model: arg("model") };
}

async function main(): Promise<void> {
  const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(`${repoRoot}/.env.local`);
    } catch {
      try {
        process.loadEnvFile(`${repoRoot}/.env`);
      } catch {}
    }
  }

  const args = parseArgs();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required to generate packs");
  }

  const now = new Date();
  const month = args.month ?? now.toISOString().slice(0, 7);
  const generate = makeGeminiGenerator(apiKey, args.model ? { model: args.model } : {});

  console.log(`Generating ${args.count} "${args.series}" drafts for ${month}...`);
  const { items, dropped } = await generatePackItems(args.series, args.count, generate, now);

  const packDir = fileURLToPath(
    new URL(`../../../data/content-packs/${args.series}/`, import.meta.url),
  );
  await mkdir(packDir, { recursive: true });
  const packPath = new URL(`${month}.json`, `file://${packDir}`);

  let existingRaw: string | null = null;
  try {
    existingRaw = await readFile(packPath, "utf-8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
  }
  const existingItems = existingRaw === null ? [] : parsePackItems(JSON.parse(existingRaw));

  const knownIds = new Set(existingItems.map((item) => item.id));
  const fresh = items.filter((item) => !knownIds.has(item.id));
  await writeFile(packPath, `${JSON.stringify([...existingItems, ...fresh], null, 2)}\n`);

  console.log(`Wrote ${fresh.length} new draft item(s) to ${packPath}`);
  for (const item of dropped) {
    console.warn(
      `Dropped #${item.index + 1}: ${item.violations.map((v) => v.rule).join(", ")}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
