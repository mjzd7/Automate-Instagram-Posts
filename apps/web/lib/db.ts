import { loadAccounts } from "core/src/config/accounts";
import { loadCategories } from "core/src/config/categories";
import { openReadOnlyDb } from "core/src/db/read-only-client";
import { repoRoot } from "./repo-paths";

/**
 * Read-only access to the same data/app.db the pipeline commits. Freshness
 * is bounded by the last deploy (Vercel redeploys on every push the
 * pipeline makes) -- this is not a live connection, per plan.md §11.
 *
 * DATA_DIR / DATABASE_PATH env overrides exist solely for deterministic
 * Playwright fixtures; unset in every real environment these resolve to the
 * repo's data/ directory exactly as before.
 */
function dataPath(file: string): string {
  const base = process.env.DATA_DIR;
  // Same layout contract as lib/writer.ts local mode: <base>/data/<file>.
  return base ? `${base}/data/${file}` : `${repoRoot}/data/${file}`;
}

export function getDbHandle() {
  return openReadOnlyDb(process.env.DATABASE_PATH ?? dataPath("app.db"));
}

export async function getAccounts() {
  return loadAccounts(dataPath("accounts.json"));
}

export async function getCategories() {
  return loadCategories(dataPath("categories.json"));
}
