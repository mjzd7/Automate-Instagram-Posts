import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fetchTrendingHashtags } from "../src/hashtags/trending.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function main() {
  console.log("Fetching daily trends for India (IN)...");
  
  try {
    const hashtags = await fetchTrendingHashtags("IN");
    
    console.log(`Generated hashtags: ${hashtags.join(", ")}`);
    
    const outPath = `${repoRoot}/data/trending-hashtags.json`;
    await fs.writeFile(outPath, JSON.stringify(hashtags, null, 2) + "\n", "utf-8");
    console.log(`Successfully wrote ${hashtags.length} hashtags to ${outPath}`);
    
  } catch (error) {
    console.error("Failed to fetch or parse Google Trends data:", error);
    process.exitCode = 1;
  }
}

main();
