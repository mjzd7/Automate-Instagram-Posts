import { openDb } from "../src/db/client.js";
import { clearOldQuoteUsage, insertQuote, type NewQuote } from "../src/db/repositories/quotes.repo.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function main() {
  console.log("[Quote-Refresh] Starting 38-day quote pool refresh...");
  const dbHandle = await openDb(`file:${repoRoot}/data/app.db`);

  try {
    // Step 1: Clear quote usage records older than 38 days
    const recycledCount = await clearOldQuoteUsage(dbHandle.db, 38);
    console.log(`[Quote-Refresh] Cleared usage tracking for quotes older than 38 days (${recycledCount} entries reset).`);

    // Step 2: Ensure all curated quotes from data/seed/quotes.json are present
    const quotesJsonPath = `${repoRoot}/data/seed/quotes.json`;
    const rawQuotes = await readFile(quotesJsonPath, "utf-8");
    const curatedQuotes = JSON.parse(rawQuotes) as NewQuote[];

    let newInserted = 0;
    for (const q of curatedQuotes) {
      await insertQuote(dbHandle.db, { ...q, source: q.source ?? "curated" });
      newInserted++;
    }

    console.log(`[Quote-Refresh] Verified ${curatedQuotes.length} curated quotes in DB.`);
    console.log("[Quote-Refresh] Quote pool refresh completed successfully.");
  } finally {
    dbHandle.close();
  }
}

main().catch((err) => {
  console.error("[Quote-Refresh] Error during quote pool refresh:", err);
  process.exitCode = 1;
});
