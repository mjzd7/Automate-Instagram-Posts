import sodium from "libsodium-wrappers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type DbHandle } from "../../src/db/client.js";
import { encryptToken, decryptToken } from "../../src/crypto/token-encryption.js";
import { getToken, upsertToken } from "../../src/db/repositories/ig-token.repo.js";
import { refreshTokens } from "../../src/pipeline/refresh-token.js";
import type { Account } from "../../src/config/accounts.js";
import type { Env } from "../../src/config/env.js";

const validKey = "a".repeat(64);

let handle: DbHandle;

const baseEnv: Env = {
  TOKEN_ENCRYPTION_KEY: validKey,
  GOOGLE_CLOUD_VISION_API_KEY: "v",
  UNSPLASH_ACCESS_KEY: "u",
  DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/x/y",
  JINA_API_KEY: "j",
  META_APP_ID: "fake-id",
  META_APP_SECRET: "fake-secret",
};

const baseAccount: Account = {
  id: "acct1",
  igUserId: "17841400000000000",
  fbPageId: "102900000000000",
  threadsUserId: null,
  categoryFocus: ["motivational"],
  timezone: "UTC",
  postingHoursLocal: [12],
  active: true,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const soon = () => new Date("2026-08-07T00:00:00Z");
const nearExpiry = new Date(soon().getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days out, within the 10-day window
const farExpiry = new Date(soon().getTime() + 55 * 24 * 60 * 60 * 1000).toISOString(); // 55 days out, not due

beforeEach(async () => {
  handle = await openDb(":memory:");
});

afterEach(() => {
  handle.close();
});

describe("refreshTokens", () => {
  it("refreshes an IG token that is within the 10-day trigger window", async () => {
    await upsertToken(handle.db, "acct1", {
      accessTokenEncrypted: encryptToken("old-ig-token", validKey),
      expiresAt: nearExpiry,
    });
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes("graph.facebook.com")) {
        return Promise.resolve(jsonResponse(200, { access_token: "new-ig-token", expires_in: 5184000 }));
      }
      return Promise.resolve(jsonResponse(500, {}));
    });

    const results = await refreshTokens({
      db: handle.db,
      accounts: [baseAccount],
      env: baseEnv,
      githubRepoSlug: "owner/repo",
      fetchImpl,
      now: soon,
    });

    expect(results).toEqual([{ accountId: "acct1", igRefreshed: true, threadsRefreshed: false }]);
    const updated = await getToken(handle.db, "acct1");
    expect(decryptToken(updated!.accessTokenEncrypted, validKey)).toBe("new-ig-token");
  });

  it("does not refresh a token that is not yet within the trigger window", async () => {
    await upsertToken(handle.db, "acct1", {
      accessTokenEncrypted: encryptToken("still-good-token", validKey),
      expiresAt: farExpiry,
    });
    const fetchImpl = vi.fn();
    const results = await refreshTokens({
      db: handle.db,
      accounts: [baseAccount],
      env: baseEnv,
      githubRepoSlug: "owner/repo",
      fetchImpl,
      now: soon,
    });
    expect(results).toEqual([{ accountId: "acct1", igRefreshed: false, threadsRefreshed: false }]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("also refreshes the Threads token when linked and within its own trigger window", async () => {
    const threadsAccount: Account = { ...baseAccount, threadsUserId: "17841400000000001" };
    await upsertToken(handle.db, "acct1", {
      accessTokenEncrypted: encryptToken("ig-token", validKey),
      expiresAt: farExpiry, // IG not due
      threadsAccessTokenEncrypted: encryptToken("old-threads-token", validKey),
      threadsExpiresAt: nearExpiry, // Threads due
    });
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes("graph.threads.net/refresh_access_token")) {
        return Promise.resolve(jsonResponse(200, { access_token: "new-threads-token", expires_in: 5184000 }));
      }
      return Promise.resolve(jsonResponse(500, {}));
    });

    const results = await refreshTokens({
      db: handle.db,
      accounts: [threadsAccount],
      env: baseEnv,
      githubRepoSlug: "owner/repo",
      fetchImpl,
      now: soon,
    });

    expect(results).toEqual([{ accountId: "acct1", igRefreshed: false, threadsRefreshed: true }]);
    const updated = await getToken(handle.db, "acct1");
    expect(decryptToken(updated!.threadsAccessTokenEncrypted!, validKey)).toBe("new-threads-token");
    // IG token untouched.
    expect(decryptToken(updated!.accessTokenEncrypted, validKey)).toBe("ig-token");
  });

  it("mirrors the refreshed token to a GitHub secret when GH_PAT_FOR_SECRETS is configured", async () => {
    await upsertToken(handle.db, "acct1", {
      accessTokenEncrypted: encryptToken("old", validKey),
      expiresAt: nearExpiry,
    });
    await sodium.ready;
    const keypair = sodium.crypto_box_keypair();
    const publicKeyB64 = sodium.to_base64(keypair.publicKey, sodium.base64_variants.ORIGINAL);

    let secretPutCalled = false;
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes("graph.facebook.com")) {
        return Promise.resolve(jsonResponse(200, { access_token: "new", expires_in: 5184000 }));
      }
      if (url.includes("public-key")) {
        return Promise.resolve(jsonResponse(200, { key_id: "k1", key: publicKeyB64 }));
      }
      if (url.includes("/actions/secrets/")) {
        secretPutCalled = true;
        return Promise.resolve(jsonResponse(201, {}));
      }
      return Promise.resolve(jsonResponse(500, {}));
    });

    await refreshTokens({
      db: handle.db,
      accounts: [baseAccount],
      env: { ...baseEnv, GH_PAT_FOR_SECRETS: "gh-pat" },
      githubRepoSlug: "owner/repo",
      fetchImpl,
      now: soon,
    });

    expect(secretPutCalled).toBe(true);
  });

  it("does not attempt to mirror a secret when GH_PAT_FOR_SECRETS is not configured", async () => {
    await upsertToken(handle.db, "acct1", {
      accessTokenEncrypted: encryptToken("old", validKey),
      expiresAt: nearExpiry,
    });
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes("graph.facebook.com")) {
        return Promise.resolve(jsonResponse(200, { access_token: "new", expires_in: 5184000 }));
      }
      return Promise.resolve(jsonResponse(500, { error: "should not be called" }));
    });
    await refreshTokens({
      db: handle.db,
      accounts: [baseAccount],
      env: baseEnv,
      githubRepoSlug: "owner/repo",
      fetchImpl,
      now: soon,
    });
    const calledUrls = fetchImpl.mock.calls.map((c) => c[0] as string);
    expect(calledUrls.some((u) => u.includes("public-key"))).toBe(false);
  });

  it("records an error for an account with no ig_token row and continues to the next account", async () => {
    const secondAccount: Account = { ...baseAccount, id: "acct2" };
    await upsertToken(handle.db, "acct2", { accessTokenEncrypted: encryptToken("t", validKey), expiresAt: nearExpiry });
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      url.includes("graph.facebook.com")
        ? Promise.resolve(jsonResponse(200, { access_token: "new", expires_in: 5184000 }))
        : Promise.resolve(jsonResponse(500, {})),
    );

    const results = await refreshTokens({
      db: handle.db,
      accounts: [baseAccount, secondAccount], // acct1 (baseAccount) has no token row seeded
      env: baseEnv,
      githubRepoSlug: "owner/repo",
      fetchImpl,
      now: soon,
    });

    expect(results.find((r) => r.accountId === "acct1")).toEqual({
      accountId: "acct1",
      igRefreshed: false,
      threadsRefreshed: false,
      error: "no ig_token row for this account",
    });
    expect(results.find((r) => r.accountId === "acct2")?.igRefreshed).toBe(true);
  });

  it("records an error and sends a Discord alert when the refresh call itself fails, without crashing the whole pass", async () => {
    await upsertToken(handle.db, "acct1", { accessTokenEncrypted: encryptToken("old", validKey), expiresAt: nearExpiry });
    let discordCalled = false;
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.includes("graph.facebook.com")) return Promise.resolve(jsonResponse(401, {}));
      if (url.includes("discord.com")) {
        discordCalled = true;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(jsonResponse(500, {}));
    });

    const results = await refreshTokens({
      db: handle.db,
      accounts: [baseAccount],
      env: baseEnv,
      githubRepoSlug: "owner/repo",
      fetchImpl,
      now: soon,
    });

    expect(results[0]?.error).toMatch(/401/);
    expect(discordCalled).toBe(true);
  });
});
