import sodium from "libsodium-wrappers";
import { describe, expect, it, vi } from "vitest";
import { mirrorSecretToGitHub } from "../../src/github/secrets.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("mirrorSecretToGitHub", () => {
  it("fetches the public key, encrypts the value with it, and PUTs the secret", async () => {
    await sodium.ready;
    const keypair = sodium.crypto_box_keypair();
    const publicKeyB64 = sodium.to_base64(keypair.publicKey, sodium.base64_variants.ORIGINAL);

    let putBody: { encrypted_value: string; key_id: string } | undefined;
    const fetchImpl = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
      if (input.includes("public-key")) {
        return Promise.resolve(jsonResponse(200, { key_id: "key-id-1", key: publicKeyB64 }));
      }
      if (input.includes("/actions/secrets/") && init?.method === "PUT") {
        putBody = JSON.parse(init.body as string);
        return Promise.resolve(jsonResponse(201, {}));
      }
      return Promise.resolve(jsonResponse(500, {}));
    });

    await mirrorSecretToGitHub("owner/repo", "IG_TOKEN_acct1", "the-secret-value", "gh-pat", fetchImpl);

    expect(putBody).toBeDefined();
    expect(putBody!.key_id).toBe("key-id-1");

    // Real round-trip: decrypt what was actually sent using the real
    // keypair's private key, proving genuine libsodium sealed-box
    // encryption happened, not just that some string was PUT.
    const ciphertext = sodium.from_base64(putBody!.encrypted_value, sodium.base64_variants.ORIGINAL);
    const decrypted = sodium.crypto_box_seal_open(ciphertext, keypair.publicKey, keypair.privateKey, "text");
    expect(decrypted).toBe("the-secret-value");
  });

  it("throws if the public-key request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(404, {}));
    await expect(
      mirrorSecretToGitHub("owner/repo", "SECRET", "value", "bad-token", fetchImpl),
    ).rejects.toThrow(/public key/);
  });

  it("throws if the PUT request fails", async () => {
    await sodium.ready;
    const keypair = sodium.crypto_box_keypair();
    const publicKeyB64 = sodium.to_base64(keypair.publicKey, sodium.base64_variants.ORIGINAL);
    const fetchImpl = vi.fn().mockImplementation((input: string) => {
      if (input.includes("public-key")) {
        return Promise.resolve(jsonResponse(200, { key_id: "k1", key: publicKeyB64 }));
      }
      return Promise.resolve(jsonResponse(403, {}));
    });
    await expect(
      mirrorSecretToGitHub("owner/repo", "SECRET", "value", "gh-pat", fetchImpl),
    ).rejects.toThrow(/failed to set secret/);
  });
});
