import { loadAccounts } from "core/src/config/accounts";
import { loadCategories } from "core/src/config/categories";
import { openReadOnlyDb } from "core/src/db/read-only-client";
import { repoRoot } from "./repo-paths";

/**
 * Read-only access to the same data/app.db the pipeline commits. Freshness
 * is bounded by the last deploy (Vercel redeploys on every push the
 * pipeline makes) -- this is not a live connection, per plan.md §11.
 */
export function getDbHandle() {
  return openReadOnlyDb(`${repoRoot}/data/app.db`);
}

export async function getAccounts() {
  return loadAccounts(`${repoRoot}/data/accounts.json`);
}

export async function getCategories() {
  return loadCategories(`${repoRoot}/data/categories.json`);
}
