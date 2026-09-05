import { describe, expect, it, vi } from "vitest";
import {
  buildDebugTokenUrl,
  checkTokenScopes,
  parseDebugTokenResponse,
} from "../../src/instagram/debug-token.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("buildDebugTokenUrl", () => {
  it("encodes input_token and app access token as query params", () => {
    const url = buildDebugTokenUrl("ig-token-123", "app-id|app-secret");
    expect(url).toContain("graph.facebook.com/");
    expect(url).toContain("input_token=ig-token-123");
    expect(url).toContain(`access_token=${encodeURIComponent("app-id|app-secret")}`);
  });
});

describe("parseDebugTokenResponse", () => {
  it("maps a valid response to scopes + expiry", () => {
    const result = parseDebugTokenResponse({
      data: {
        is_valid: true,
        scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
        expires_at: 1790000000,
        app_id: "111",
      },
    });
    expect(result.isValid).toBe(true);
    expect(result.scopes).toContain("instagram_content_publish");
    expect(result.expiresAt).not.toBe("never");
    expect(result.appId).toBe("111");
  });

  it("treats expires_at=0 as never-expiring", () => {
    const result = parseDebugTokenResponse({ data: { is_valid: true, scopes: [], expires_at: 0 } });
    expect(result.expiresAt).toBe("never");
  });

  it("tolerates a missing scopes field", () => {
    const result = parseDebugTokenResponse({ data: { is_valid: false } });
    expect(result.isValid).toBe(false);
    expect(result.scopes).toEqual([]);
  });

  it("throws when the response has no data envelope", () => {
    expect(() => parseDebugTokenResponse({})).toThrow(/missing data/i);
  });
});

describe("checkTokenScopes", () => {
  it("resolves each account's decrypted token, calls debug_token once per account", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { is_valid: true, scopes: ["instagram_basic"], expires_at: 0 },
      }),
    );
    const results = await checkTokenScopes({
      accounts: [{ id: "acc-a" }, { id: "acc-b" }],
      resolveAccessToken: async (accountId) => `${accountId}-decrypted`,
      metaAppId: "app-id",
      metaAppSecret: "app-secret",
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toContain("input_token=acc-a-decrypted");
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      accountId: "acc-a",
      ok: true,
      isValid: true,
      scopes: ["instagram_basic"],
      expiresAt: "never",
      missingCore: ["instagram_content_publish", "pages_read_engagement", "pages_show_list"],
      missingCommentStack: ["instagram_manage_comments", "instagram_manage_engagement"],
    });
  });

  it("reports an error result when an account has no stored token", async () => {
    const fetchImpl = vi.fn();
    const results = await checkTokenScopes({
      accounts: [{ id: "ghost" }],
      resolveAccessToken: async () => {
        throw new Error("no ig_token row");
      },
      metaAppId: "app-id",
      metaAppSecret: "app-secret",
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(results[0]).toEqual({ accountId: "ghost", ok: false, error: "no ig_token row" });
  });

  it("throws up front when META app credentials are absent", async () => {
    await expect(
      checkTokenScopes({
        accounts: [],
        resolveAccessToken: async () => "",
      }),
    ).rejects.toThrow(/META_APP_ID|META_APP_SECRET/);
  });
});
