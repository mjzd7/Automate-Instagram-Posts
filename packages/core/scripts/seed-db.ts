import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadAccounts } from "../src/config/accounts.js";
import { loadCategories } from "../src/config/categories.js";
import { loadEnv } from "../src/config/env.js";
import { encryptToken } from "../src/crypto/token-encryption.js";
import { openDb } from "../src/db/client.js";
import { upsertAccount } from "../src/db/repositories/accounts.repo.js";
import { insertBackground, type NewBackground } from "../src/db/repositories/backgrounds.repo.js";
import { categories } from "../src/db/schema.js";
import { upsertToken } from "../src/db/repositories/ig-token.repo.js";
import { insertQuote, type NewQuote } from "../src/db/repositories/quotes.repo.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

interface AccountSeedEntry {
  accessToken: string;
  expiresInSeconds: number;
  threadsAccessToken?: string;
  threadsExpiresInSeconds?: number;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

// data/categories.json is static reference data with no seed flag of its
// own (plan.md §10 only names accounts/tokens/quotes/backgrounds); every
// invocation keeps it in sync since quotes.category_id and
// accounts.category_focus both depend on it existing.
async function syncCategories(db: Awaited<ReturnType<typeof openDb>>["db"]): Promise<void> {
  const rows = await loadCategories(`${repoRoot}/data/categories.json`);
  for (const row of rows) {
    await db
      .insert(categories)
      .values(row)
      .onConflictDoUpdate({ target: categories.id, set: row });
  }
  console.log(`seed-db: synced ${rows.length} categories`);
}

async function syncAccounts(db: Awaited<ReturnType<typeof openDb>>["db"]): Promise<void> {
  const accounts = await loadAccounts(`${repoRoot}/data/accounts.json`);
  for (const account of accounts) {
    await upsertAccount(db, account);
  }
  console.log(`seed-db: synced ${accounts.length} accounts`);
}

async function seedTokens(db: Awaited<ReturnType<typeof openDb>>["db"], tokenEncryptionKey: string): Promise<void> {
  const seedPath = `${repoRoot}/secrets/accounts-seed.json`;
  const seed = await readJson<Record<string, AccountSeedEntry>>(seedPath);
  const now = Date.now();
  for (const [accountId, entry] of Object.entries(seed)) {
    await upsertToken(db, accountId, {
      accessTokenEncrypted: encryptToken(entry.accessToken, tokenEncryptionKey),
      expiresAt: new Date(now + entry.expiresInSeconds * 1000).toISOString(),
      threadsAccessTokenEncrypted: entry.threadsAccessToken
        ? encryptToken(entry.threadsAccessToken, tokenEncryptionKey)
        : null,
      threadsExpiresAt:
        entry.threadsAccessToken && entry.threadsExpiresInSeconds
          ? new Date(now + entry.threadsExpiresInSeconds * 1000).toISOString()
          : null,
    });
  }
  console.log(`seed-db: seeded tokens for ${Object.keys(seed).length} accounts`);
  console.log(`seed-db: delete ${seedPath} now -- it holds plaintext tokens and must never be committed`);
}

async function seedQuotes(db: Awaited<ReturnType<typeof openDb>>["db"]): Promise<void> {
  const quotes = await readJson<NewQuote[]>(`${repoRoot}/data/seed/quotes.json`);
  for (const quote of quotes) {
    await insertQuote(db, { ...quote, source: quote.source ?? "curated" });
  }
  console.log(`seed-db: seeded ${quotes.length} curated quotes`);
}

async function seedBackgrounds(db: Awaited<ReturnType<typeof openDb>>["db"]): Promise<void> {
  const backgrounds = await readJson<NewBackground[]>(`${repoRoot}/data/seed/backgrounds.json`);
  for (const background of backgrounds) {
    await insertBackground(db, { ...background, source: background.source ?? "curated" });
  }
  console.log(`seed-db: seeded ${backgrounds.length} curated backgrounds`);
  if (backgrounds.length === 0) {
    console.log(
      "seed-db: data/seed/backgrounds.json is empty -- this is expected, backgrounds are fetched live from " +
        "Unsplash at post time (images/background-provider.ts); add curated entries there only as an optional " +
        "enhancement.",
    );
  }
}

async function main(): Promise<void> {
  const flags = new Set(process.argv.slice(2));
  if (flags.size === 0) {
    throw new Error(
      "seed-db: no flags given. Usage: seed-db.ts [--sync-accounts] [--seed-tokens] [--seed-quotes] [--seed-backgrounds]",
    );
  }

  const dbHandle = await openDb(`file:${repoRoot}/data/app.db`);
  try {
    await syncCategories(dbHandle.db);

    if (flags.has("--sync-accounts")) {
      await syncAccounts(dbHandle.db);
    }
    if (flags.has("--seed-tokens")) {
      const env = loadEnv();
      await seedTokens(dbHandle.db, env.TOKEN_ENCRYPTION_KEY);
    }
    if (flags.has("--seed-quotes")) {
      await seedQuotes(dbHandle.db);
    }
    if (flags.has("--seed-backgrounds")) {
      await seedBackgrounds(dbHandle.db);
    }
  } finally {
    dbHandle.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
