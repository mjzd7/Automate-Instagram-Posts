import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fetchTrendingHashtags } from "../src/hashtags/trending.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

const FALLBACK_HASHTAGS = [
  "#success", "#motivation", "#business", "#entrepreneur", 
  "#mindset", "#wealth", "#growth", "#leadership", 
  "#grind", "#hustle"
];

async function main() {
  console.log("Fetching daily trends for India (IN)...");
  
  let hashtags: string[];
  try {
    hashtags = await fetchTrendingHashtags("IN");
    console.log(`Generated hashtags from Google Trends: ${hashtags.join(", ")}`);
  } catch (error) {
    console.warn("Failed to fetch Google Trends data, using evergreen fallback list:", error instanceof Error ? error.message : String(error));
    hashtags = FALLBACK_HASHTAGS;
  }
  
  try {
    const outPath = `${repoRoot}/data/trending-hashtags.json`;
    await fs.writeFile(outPath, JSON.stringify(hashtags, null, 2) + "\n", "utf-8");
    console.log(`Successfully wrote ${hashtags.length} hashtags to ${outPath}`);
  } catch (writeError) {
    console.error("Failed to write trending-hashtags.json:", writeError);
    process.exitCode = 1;
  }
}

main();
