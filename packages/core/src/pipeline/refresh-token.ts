import type { Account } from "../config/accounts.js";
import type { Env } from "../config/env.js";
import { decryptToken, encryptToken } from "../crypto/token-encryption.js";
import type { Db } from "../db/client.js";
import { getToken, upsertToken } from "../db/repositories/ig-token.repo.js";
import { mirrorSecretToGitHub } from "../github/secrets.js";
import { refreshLongLivedToken } from "../instagram/client.js";
import { refreshThreadsToken } from "../threads/client.js";
import { sendDiscordNotification } from "../notify/discord.js";

// plan.md §2.10.
const TOKEN_REFRESH_TRIGGER_WINDOW_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RefreshTokenOptions {
  db: Db;
  accounts: Account[];
  env: Env;
  githubRepoSlug: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface AccountRefreshResult {
  accountId: string;
  igRefreshed: boolean;
  threadsRefreshed: boolean;
  error?: string;
}

function isDue(expiresAtIso: string, now: Date): boolean {
  const msUntilExpiry = new Date(expiresAtIso).getTime() - now.getTime();
  return msUntilExpiry <= TOKEN_REFRESH_TRIGGER_WINDOW_DAYS * DAY_MS;
}

/**
 * Weekly token-refresh pass (plan.md §7.20): for each account, refresh the
 * IG (and Threads, if linked) long-lived token if within
 * TOKEN_REFRESH_TRIGGER_WINDOW_DAYS of expiry, write the new encrypted
 * token to the DB, and best-effort mirror it to a GitHub Actions secret as
 * a human-recoverable backup. One account's failure doesn't stop the
 * others -- each is independently try/caught and reported.
 */
export async function refreshTokens(options: RefreshTokenOptions): Promise<AccountRefreshResult[]> {
  const { db, accounts, env } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const results: AccountRefreshResult[] = [];

  for (const account of accounts) {
    const result: AccountRefreshResult = { accountId: account.id, igRefreshed: false, threadsRefreshed: false };
    try {
      const tokenRow = await getToken(db, account.id);
      if (!tokenRow) {
        result.error = "no ig_token row for this account";
        results.push(result);
        continue;
      }

      let accessTokenEncrypted = tokenRow.accessTokenEncrypted;
      let expiresAt = tokenRow.expiresAt;
      let threadsAccessTokenEncrypted = tokenRow.threadsAccessTokenEncrypted ?? null;
      let threadsExpiresAt = tokenRow.threadsExpiresAt ?? null;

      const currentTime = now();

      if (isDue(expiresAt, currentTime)) {
        const currentToken = decryptToken(accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
        const refreshed = await refreshLongLivedToken(currentToken, fetchImpl);
        accessTokenEncrypted = encryptToken(refreshed.accessToken, env.TOKEN_ENCRYPTION_KEY);
        expiresAt = new Date(currentTime.getTime() + refreshed.expiresInSeconds * 1000).toISOString();
        result.igRefreshed = true;

        if (env.GH_PAT_FOR_SECRETS) {
          try {
            await mirrorSecretToGitHub(
              options.githubRepoSlug,
              `IG_TOKEN_${account.id.toUpperCase()}`,
              refreshed.accessToken,
              env.GH_PAT_FOR_SECRETS,
              fetchImpl,
            );
          } catch {
            // Backup mirror failing must not fail the actual refresh.
          }
        }
      }

      if (account.threadsUserId && threadsAccessTokenEncrypted && threadsExpiresAt && isDue(threadsExpiresAt, currentTime)) {
        const currentThreadsToken = decryptToken(threadsAccessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
        const refreshed = await refreshThreadsToken(currentThreadsToken, fetchImpl);
        threadsAccessTokenEncrypted = encryptToken(refreshed.accessToken, env.TOKEN_ENCRYPTION_KEY);
        threadsExpiresAt = new Date(currentTime.getTime() + refreshed.expiresInSeconds * 1000).toISOString();
        result.threadsRefreshed = true;

        if (env.GH_PAT_FOR_SECRETS) {
          try {
            await mirrorSecretToGitHub(
              options.githubRepoSlug,
              `THREADS_TOKEN_${account.id.toUpperCase()}`,
              refreshed.accessToken,
              env.GH_PAT_FOR_SECRETS,
              fetchImpl,
            );
          } catch {
            // Backup mirror failing must not fail the actual refresh.
          }
        }
      }

      if (result.igRefreshed || result.threadsRefreshed) {
        await upsertToken(db, account.id, {
          accessTokenEncrypted,
          expiresAt,
          threadsAccessTokenEncrypted,
          threadsExpiresAt,
        });
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      try {
        await sendDiscordNotification(
          env.DISCORD_WEBHOOK_URL,
          {
            title: `Token refresh failed for ${account.id}`,
            description: result.error,
            level: "failure",
          },
          fetchImpl,
        );
      } catch {
        // Discord itself being down must not crash the refresh pass.
      }
    }
    results.push(result);
  }

  return results;
}
