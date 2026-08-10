/**
 * scripts/normalize-stored-quotes.ts
 *
 * One-shot migration: scans every row in the `quotes` table and applies
 * normalizeQuoteCapitalization to rows whose text passes isApiTitleCase
 * (i.e. was stored before the normaliser was wired into the provider).
 *
 * Safe to run multiple times — idempotent (normalising an already-normalised
 * string produces the same string, so a second run is a no-op on every row).
 *
 * Usage:
 *   pnpm --filter core exec tsx scripts/normalize-stored-quotes.ts <db-path>
 */
import { normalizeQuoteCapitalization } from "../src/content-filter/capitalization-normalizer.js";
import { openDb } from "../src/db/client.js";
import { findAllQuotes, updateQuoteText } from "../src/db/repositories/quotes.repo.js";

const dbPath = process.argv[2];
if (!dbPath) {
  console.error("Usage: tsx scripts/normalize-stored-quotes.ts <path-to-db-file>");
  process.exit(1);
}

const { db, close } = await openDb(dbPath);
const rows = await findAllQuotes(db);

let updated = 0;
let unchanged = 0;

for (const row of rows) {
  const normalized = normalizeQuoteCapitalization(row.text);
  if (normalized !== row.text) {
    await updateQuoteText(db, row.id, normalized);
    console.log(`  updated [${row.id.slice(0, 8)}]: "${row.text}" → "${normalized}"`);
    updated++;
  } else {
    unchanged++;
  }
}

close();
console.log(`\nDone. ${updated} rows updated, ${unchanged} unchanged.`);
