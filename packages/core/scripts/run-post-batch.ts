import "../src/images/fonts-init.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { findAccount, loadAccounts } from "../src/config/accounts.js";
import { loadEnv } from "../src/config/env.js";
import { openDb } from "../src/db/client.js";
import { commitBatch } from "../src/git/commit-batch.js";
import { generateAndPublishBatch, HASHTAG_CATEGORIES_PATH } from "../src/pipeline/generate-and-publish-batch.js";
import { dueEntries } from "../src/schedule/due";
import type { PipelineFile } from "../src/schedule/generator";

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

function parseCountArg(argv: string[]): number | undefined {
  const idx = argv.indexOf("--count") !== -1 ? argv.indexOf("--count") : argv.indexOf("--batch-size");
  if (idx !== -1 && argv[idx + 1]) {
    const val = parseInt(argv[idx + 1]!, 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const accountId = parseAccountArg(argv);
  const dryRun = argv.includes("--dry-run");
  const force = argv.includes("--force");
  const single = argv.includes("--single");
  const countArg = parseCountArg(argv);
  const batchSize = countArg ?? (single ? 1 : undefined);

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

  // Kill-switch (dashboard Schedules page): a paused account never posts
  // unless a human forces the run.
  if (account.paused && !force && !dryRun) {
    console.log(`run-post-batch: account ${accountId} is paused; exiting`);
    return;
  }

  const githubRepoSlug = process.env.GITHUB_REPOSITORY ?? "mjzd7/Automate-Instagram-Posts";

  const hashtagPools = JSON.parse(await readFile(`${repoRoot}/${HASHTAG_CATEGORIES_PATH}`, "utf-8")) as Record<
    string,
    string[]
  >;
  try {
    const trending = JSON.parse(await readFile(`${repoRoot}/data/trending-hashtags.json`, "utf-8")) as string[];
    hashtagPools.trending = trending;
  } catch {
    console.warn("run-post-batch: No trending-hashtags.json found, skipping trending injection.");
  }

  // Binding-lite contract: when a current-month pipeline file exists it
  // governs this account -- execute exactly its due planned slots and skip
  // otherwise. Absent file -> legacy ad-hoc behaviour. --force bypasses.
  let effectiveBatchSize = batchSize;
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (!force) {
    try {
      const raw = JSON.parse(
        await readFile(`${repoRoot}/data/pipeline/${month}.json`, "utf-8"),
      ) as PipelineFile;
      const due = dueEntries(raw, accountId, now, account.timezone);
      console.log(`run-post-batch: pipeline ${month} governs ${accountId} (${due.length} due)`);
      if (due.length === 0) {
        console.log(`run-post-batch: nothing due in pipeline for ${accountId}; exiting`);
        return;
      }
      effectiveBatchSize = batchSize ?? due.length;
    } catch {
      console.log(`run-post-batch: no pipeline file for ${month}; legacy ad-hoc mode`);
    }
  }

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
      ignoreRateCap: force,
      batchSize: effectiveBatchSize,
      noDelay: true,
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
