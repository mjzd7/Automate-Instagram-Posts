import { fileURLToPath } from "node:url";
import { loadAccounts } from "../src/config/accounts.js";
import { loadEnv } from "../src/config/env.js";
import { openDb } from "../src/db/client.js";
import { commitBatch } from "../src/git/commit-batch.js";
import { refreshTokens } from "../src/pipeline/refresh-token.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function main(): Promise<void> {
  const env = loadEnv();
  const accounts = await loadAccounts(`${repoRoot}/data/accounts.json`);

  const githubRepoSlug = process.env.GITHUB_REPOSITORY;
  if (!githubRepoSlug) {
    throw new Error("run-token-refresh: GITHUB_REPOSITORY env var is required (owner/repo)");
  }

  const dbHandle = await openDb(`file:${repoRoot}/data/app.db`);
  try {
    const results = await refreshTokens({ db: dbHandle.db, accounts, env, githubRepoSlug });

    const refreshedCount = results.filter((r) => r.igRefreshed || r.threadsRefreshed).length;
    const errored = results.filter((r) => r.error);
    const dateIso = new Date().toISOString().slice(0, 10);
    await commitBatch({
      cwd: repoRoot,
      message: `token-refresh: ${dateIso} ${refreshedCount}/${results.length} accounts refreshed`,
    });

    console.log(`run-token-refresh: ${refreshedCount}/${results.length} accounts refreshed`);
    if (errored.length > 0) {
      console.error(`run-token-refresh: errors for ${errored.map((r) => r.accountId).join(", ")}`);
      process.exitCode = 1;
    }
  } finally {
    dbHandle.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
