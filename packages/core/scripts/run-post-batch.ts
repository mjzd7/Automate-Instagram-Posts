import "../src/images/fonts-init.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { findAccount, loadAccounts } from "../src/config/accounts.js";
import { loadEnv } from "../src/config/env.js";
import { openDb } from "../src/db/client.js";
import { commitBatch } from "../src/git/commit-batch.js";
import { generateAndPublishBatch, HASHTAG_CATEGORIES_PATH } from "../src/pipeline/generate-and-publish-batch.js";

// packages/core/scripts/ -> packages/core/ -> packages/ -> repo root. Computed
// from this file's own location (not process.cwd()) so the script behaves
// the same whether invoked from the repo root or via `pnpm --filter core exec`.
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

function parseAccountArg(argv: string[]): string {
  const idx = argv.indexOf("--account");
  const value = idx === -1 ? undefined : argv[idx + 1];
  if (!value) {
    throw new Error("run-post-batch: --account <id> is required");
  }
  return value;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const accountId = parseAccountArg(argv);
  const dryRun = argv.includes("--dry-run");
  const force = argv.includes("--force");
  const single = argv.includes("--single");

  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(`${repoRoot}/.env.local`);
    } catch {
      try {
        process.loadEnvFile(`${repoRoot}/.env`);
      } catch {
        // Ignored if neither exists
      }
    }
  }

  const env = loadEnv();
  const accounts = await loadAccounts(`${repoRoot}/data/accounts.json`);
  const account = findAccount(accounts, accountId);

  const githubRepoSlug = process.env.GITHUB_REPOSITORY ?? "mjzd7/Automate-Instagram-Posts";

  const hashtagPools = JSON.parse(await readFile(`${repoRoot}/${HASHTAG_CATEGORIES_PATH}`, "utf-8")) as Record<
    string,
    string[]
  >;

  const dbHandle = await openDb(`file:${repoRoot}/data/app.db`);
  try {
    const result = await generateAndPublishBatch({
      db: dbHandle.db,
      account,
      env,
      repoRoot,
      githubRepoSlug,
      hashtagPools,
      dryRun,
      ignorePostingHour: force,
      batchSize: single ? 1 : undefined,
    });

    if (result.skippedReason) {
      console.log(`run-post-batch: skipped (${result.skippedReason})`);
      return;
    }

    if (dryRun) {
      for (const item of result.items) {
        console.log(`run-post-batch: [dry-run] ${item.status} -- ${item.composedImagePath ?? item.errorMessage}`);
      }
      return;
    }

    const succeeded = result.items.filter((item) => item.status === "published").length;
    const attempted = result.items.length;
    const dateIso = new Date().toISOString().slice(0, 10);
    // plan.md §2.9 GIT_COMMIT_MESSAGE_FORMAT.
    const message = `post-batch: ${accountId} ${dateIso} ${attempted} posts (${succeeded}/${attempted} succeeded)`;
    await commitBatch({ cwd: repoRoot, message });

    console.log(`run-post-batch: ${succeeded}/${attempted} succeeded`);
    // Per-item failures are already isolated and Discord-alerted inside the
    // pipeline; only fail the Actions job loudly when the whole batch went
    // to zero -- a signal something systemic (e.g. an expired token) broke,
    // not routine single-post flakiness.
    if (attempted > 0 && succeeded === 0) {
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
