import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "../../src/crypto/token-encryption.js";

const validKey = "a".repeat(64); // 32 bytes hex

describe("encryptToken / decryptToken", () => {
  it("round-trips a token correctly", () => {
    const encrypted = encryptToken("my-secret-access-token", validKey);
    expect(decryptToken(encrypted, validKey)).toBe("my-secret-access-token");
  });

  it("produces a different ciphertext each time (random IV, no pattern leakage)", () => {
    const a = encryptToken("same-plaintext", validKey);
    const b = encryptToken("same-plaintext", validKey);
    expect(a).not.toBe(b);
  });

  it("produces the documented ivHex:authTagHex:ciphertextHex format", () => {
    const encrypted = encryptToken("token", validKey);
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/); // 12-byte IV -> 24 hex chars
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/); // 16-byte GCM auth tag -> 32 hex chars
  });

  it("fails to decrypt with the wrong key (security plane)", () => {
    const encrypted = encryptToken("secret", validKey);
    const wrongKey = "b".repeat(64);
    expect(() => decryptToken(encrypted, wrongKey)).toThrow();
  });

  it("fails to decrypt if the ciphertext was tampered with (security plane: GCM auth tag catches modification)", () => {
    const encrypted = encryptToken("secret", validKey);
    const parts = encrypted.split(":");
    const origCt = parts[2]!;
    const modifiedCt = (origCt[0] === "0" ? "1" : "0") + origCt.slice(1);
    const tampered = `${parts[0]}:${parts[1]}:${modifiedCt}`;
    expect(() => decryptToken(tampered, validKey)).toThrow();
  });

  it("rejects a key that isn't exactly 32 bytes (edge case)", () => {
    expect(() => encryptToken("x", "tooshort")).toThrow(/32 bytes/);
    expect(() => decryptToken("a:b:c", "tooshort")).toThrow(/32 bytes/);
  });

  it("throws a clear error on a malformed encrypted value (edge case: unexpected shape)", () => {
    expect(() => decryptToken("not-the-right-format", validKey)).toThrow(/malformed/);
  });

  it("round-trips unicode content correctly (edge case)", () => {
    const encrypted = encryptToken("token-with-émoji-🔑", validKey);
    expect(decryptToken(encrypted, validKey)).toBe("token-with-émoji-🔑");
  });
});
