import { fileURLToPath } from "node:url";
import { openDb } from "../src/db/client.js";
import { loadEnv } from "../src/config/env.js";
import { loadAccounts } from "../src/config/accounts.js";
import { getToken } from "../src/db/repositories/ig-token.repo.js";
import { decryptToken } from "../src/crypto/token-encryption.js";
import { findRecentPublishedPostsWithMediaId, updatePostViews } from "../src/db/repositories/posts.repo.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function main() {
  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(`${repoRoot}/.env.local`);
    } catch {
      try {
        process.loadEnvFile(`${repoRoot}/.env`);
      } catch {
        // Ignore if neither exists
      }
    }
  }

  const env = loadEnv();
  const accounts = await loadAccounts(`${repoRoot}/data/accounts.json`);
  const dbHandle = await openDb(`file:${repoRoot}/data/app.db`);

  try {
    const activeAccounts = accounts.filter((a) => a.active);
    console.log(`[Metrics] Starting view counts sync for ${activeAccounts.length} active accounts...`);

    // Sync views for posts published in the last 30 days
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const account of activeAccounts) {
      console.log(`[Metrics] Fetching token for account "${account.id}"...`);
      const tokenRow = await getToken(dbHandle.db, account.id);
      if (!tokenRow) {
        console.warn(`[Metrics] No token row found for account "${account.id}". Skipping.`);
        continue;
      }

      const token = decryptToken(tokenRow.accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
      const postsToSync = await findRecentPublishedPostsWithMediaId(dbHandle.db, cutoffDate);
      const accountPosts = postsToSync.filter((p) => p.accountId === account.id);

      console.log(`[Metrics] Found ${accountPosts.length} posts to sync for account "${account.id}".`);

      for (const post of accountPosts) {
        if (!post.igMediaId) continue;
        console.log(`[Metrics] Syncing views for post ${post.id} (IG Media ID: ${post.igMediaId})...`);

        try {
          // Meta API reels insights endpoint (metric=plays)
          const url = `https://graph.facebook.com/v22.0/${post.igMediaId}/insights?metric=plays&access_token=${token}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (!res.ok) {
            console.warn(`[Metrics] Meta Graph API returned HTTP ${res.status} for post ${post.id}.`);
            continue;
          }

          const json = (await res.json()) as {
            data?: Array<{
              name?: string;
              values?: Array<{ value: number }>;
            }>;
          };

          const playsMetric = json.data?.find((d) => d.name === "plays");
          const views = playsMetric?.values?.[0]?.value ?? 0;

          console.log(`[Metrics] Post ${post.id} has ${views} views. Saving to DB.`);
          await updatePostViews(dbHandle.db, post.id, views);
        } catch (err) {
          console.error(`[Metrics] Failed to fetch views for post ${post.id}:`, err);
        }
      }
    }
    console.log("[Metrics] Views sync completed successfully.");
  } finally {
    dbHandle.close();
  }
}

main().catch((err) => {
  console.error("[Metrics] Fatal error running metrics sync:", err);
  process.exitCode = 1;
});
