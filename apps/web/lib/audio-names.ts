import { decryptToken } from "core/src/crypto/token-encryption";
import { getToken } from "core/src/db/repositories/ig-token.repo";
import { getAccounts, getDbHandle } from "@/lib/db";

const GRAPH = "https://graph.facebook.com/v22.0";
const CONCURRENCY = 6;

/**
 * audioId -> "Title — Artist", resolved against the IG audio endpoint and
 * memoized for the server process lifetime. Vercel's read-only FS rules out
 * persistent caching; 55 distinct ids cost ~1s once per lambda instance.
 * Failures are cached as null so one bad id can't re-hit the API every load.
 */
const cache = new Map<string, string | null>();

interface Credentials {
  token: string;
  igUserId: string;
}

let credentials: Credentials | null = null;

async function getCredentials(): Promise<Credentials | null> {
  if (credentials) return credentials;
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) return null;
  const [accounts, { db, close }] = await Promise.all([getAccounts(), getDbHandle()]);
  try {
    const account = accounts[0];
    if (!account) return null;
    const tokenRow = await getToken(db, account.id);
    if (!tokenRow) return null;
    credentials = { token: decryptToken(tokenRow.accessTokenEncrypted, key), igUserId: account.igUserId };
    return credentials;
  } finally {
    close();
  }
}

async function fetchTitle(audioId: string, creds: Credentials): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH}/${audioId}?fields=title,display_artist&user_id=${creds.igUserId}&access_token=${creds.token}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { title?: string; display_artist?: string };
    const label = [body.title, body.display_artist].filter(Boolean).join(" — ");
    return label || null;
  } catch {
    return null;
  }
}

export async function resolveAudioTitles(audioIds: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const missing: string[] = [];
  for (const id of audioIds) {
    if (cache.has(id)) {
      result.set(id, cache.get(id) ?? null);
    } else {
      missing.push(id);
    }
  }
  if (missing.length > 0) {
    const creds = await getCredentials();
    if (creds) {
      for (let i = 0; i < missing.length; i += CONCURRENCY) {
        const batch = missing.slice(i, i + CONCURRENCY);
        const settled = await Promise.allSettled(batch.map((id) => fetchTitle(id, creds)));
        batch.forEach((id, j) => {
          const title = settled[j]?.status === "fulfilled" ? (settled[j] as PromiseFulfilledResult<string | null>).value : null;
          cache.set(id, title);
          result.set(id, title);
        });
      }
    } else {
      for (const id of missing) {
        cache.set(id, null);
        result.set(id, null);
      }
    }
  }
  return result;
}
