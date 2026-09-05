// Read-only diagnostic: reports what each stored IG token can actually do.
// Usage: pnpm --filter core exec tsx scripts/check-token-scopes.ts
// Prints scopes/expiry/gaps per account. NEVER prints token values.
import { fileURLToPath } from "node:url";
import { loadAccounts } from "../src/config/accounts.js";
import { decryptToken } from "../src/crypto/token-encryption.js";
import { openDb } from "../src/db/client.js";
import { checkTokenScopes } from "../src/instagram/debug-token.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function main(): Promise<void> {
  const env = await import("../src/config/env.js").then((m) => m.loadEnv());
  const accounts = await loadAccounts(`${repoRoot}/data/accounts.json`);
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    throw new Error("check-token-scopes: META_APP_ID and META_APP_SECRET must be set");
  }

  const dbHandle = await openDb(`file:${repoRoot}/data/app.db`);
  try {
    const { getToken } = await import("../src/db/repositories/ig-token.repo.js");
    const results = await checkTokenScopes({
      accounts,
      resolveAccessToken: async (accountId) => {
        const row = await getToken(dbHandle.db, accountId);
        if (!row) throw new Error(`no ig_token row for ${accountId}`);
        return decryptToken(row.accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
      },
      metaAppId: env.META_APP_ID,
      metaAppSecret: env.META_APP_SECRET,
    });

    for (const r of results) {
      if (!r.ok) {
        console.log(`${r.accountId}: ERROR ${r.error ?? "invalid token"}`);
        continue;
      }
      console.log(
        `${r.accountId}: valid=${r.isValid} expires=${r.expiresAt}\n  scopes: ${(r.scopes ?? []).join(", ") || "(none)"}`,
      );
      if ((r.missingCore ?? []).length > 0) {
        console.log(`  MISSING core: ${r.missingCore?.join(", ")}`);
      }
      if ((r.missingCommentStack ?? []).length > 0) {
        console.log(`  MISSING comment stack (Phase 2 blocker): ${r.missingCommentStack?.join(", ")}`);
      }
    }
    const anyInvalid = results.some((r) => !r.ok);
    process.exitCode = anyInvalid ? 1 : 0;
  } finally {
    dbHandle.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
