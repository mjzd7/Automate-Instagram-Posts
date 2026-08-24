import { decryptToken } from "core/src/crypto/token-encryption";
import { fetchAccountOverview, fetchReachForPosts, type AccountOverview, type ReachMap } from "core/src/instagram/insights";
import { getToken } from "core/src/db/repositories/ig-token.repo";
import { getAccounts, getDbHandle } from "@/lib/db";

export class AnalyticsUnavailableError extends Error {}

export interface AnalyticsBundle extends AccountOverview {
  reach: ReachMap;
}

/**
 * Decrypts the account's stored token and pulls live Insights data.
 * Requires TOKEN_ENCRYPTION_KEY in the environment (Vercel env per SETUP.md).
 */
export async function getAccountAnalytics(
  accountId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnalyticsBundle> {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new AnalyticsUnavailableError(
      "TOKEN_ENCRYPTION_KEY is not configured here — cannot decrypt the stored IG token for Insights.",
    );
  }
  const [accounts, { db, close }] = await Promise.all([getAccounts(), getDbHandle()]);
  try {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new AnalyticsUnavailableError(`unknown account ${accountId}`);
    const tokenRow = await getToken(db, accountId);
    if (!tokenRow) throw new AnalyticsUnavailableError(`no stored IG token for "${accountId}"`);
    const accessToken = decryptToken(tokenRow.accessTokenEncrypted, key);
    const overview = await fetchAccountOverview(accessToken, account.igUserId, fetchImpl);
    // Best-effort tier: read_insights-gated; nulls render as em-dashes.
    let reach: ReachMap = {};
    try {
      reach = await fetchReachForPosts(accessToken, overview.posts, fetchImpl);
    } catch {
      reach = {};
    }
    return { ...overview, reach };
  } finally {
    close();
  }
}
