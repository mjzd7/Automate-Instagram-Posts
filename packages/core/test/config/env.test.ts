import { describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";

const validHexKey = "a".repeat(64);

function baseEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    TOKEN_ENCRYPTION_KEY: validHexKey,
    GOOGLE_CLOUD_VISION_API_KEY: "gcv-key",
    UNSPLASH_ACCESS_KEY: "unsplash-key",
    API_NINJAS_KEY: "ninjas-key",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/abc",
    JINA_API_KEY: "jina-key",
    ...overrides,
  };
}

describe("loadEnv", () => {
  it("accepts a fully valid env with the primary embeddings key set", () => {
    const env = loadEnv(baseEnv() as NodeJS.ProcessEnv);
    expect(env.JINA_API_KEY).toBe("jina-key");
    expect(env.TOKEN_ENCRYPTION_KEY).toBe(validHexKey);
  });

  it("accepts a valid env when only a non-primary embeddings key is set (input validation plane: alternate valid combination)", () => {
    const env = loadEnv(
      baseEnv({ JINA_API_KEY: undefined, GEMINI_API_KEY: "gemini-key" }) as NodeJS.ProcessEnv,
    );
    expect(env.GEMINI_API_KEY).toBe("gemini-key");
  });

  it("rejects an env with no embeddings provider key at all, naming the reason (state transitions plane: invalid config must not silently proceed)", () => {
    expect(() => loadEnv(baseEnv({ JINA_API_KEY: undefined }) as NodeJS.ProcessEnv)).toThrow(
      /at least one embeddings provider key/,
    );
  });

  it("rejects a malformed TOKEN_ENCRYPTION_KEY (edge case plane: wrong length / non-hex)", () => {
    expect(() =>
      loadEnv(baseEnv({ TOKEN_ENCRYPTION_KEY: "too-short" }) as NodeJS.ProcessEnv),
    ).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("rejects a missing required field with the field name in the error, not a generic message (configuration plane)", () => {
    const env = baseEnv();
    delete (env as Record<string, string | undefined>).GOOGLE_CLOUD_VISION_API_KEY;
    expect(() => loadEnv(env as NodeJS.ProcessEnv)).toThrow(/GOOGLE_CLOUD_VISION_API_KEY/);
  });

  it("rejects an invalid DISCORD_WEBHOOK_URL (input validation plane)", () => {
    expect(() =>
      loadEnv(baseEnv({ DISCORD_WEBHOOK_URL: "not-a-url" }) as NodeJS.ProcessEnv),
    ).toThrow(/DISCORD_WEBHOOK_URL/);
  });

  it("treats GH_PAT_FOR_SECRETS as optional (configuration plane: feature off)", () => {
    const env = loadEnv(baseEnv() as NodeJS.ProcessEnv);
    expect(env.GH_PAT_FOR_SECRETS).toBeUndefined();
  });
});
