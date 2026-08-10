import sodium from "libsodium-wrappers";

/**
 * Mirrors a token to a GitHub Actions repository secret, per plan.md
 * §7.20: Turso isn't in play (this project is git-native), but the same
 * "backup outside the primary read path" reasoning applies -- protects
 * against a corrupted/unreadable data/app.db. Not the pipeline's own read
 * path; a human-recoverable fallback only.
 *
 * Flow verified against docs.github.com/en/rest/actions/secrets:
 *   1. GET .../actions/secrets/public-key -> {key_id, key}
 *   2. Encrypt with libsodium's crypto_box_seal using that public key
 *   3. PUT .../actions/secrets/{name} body {encrypted_value, key_id}
 */
export async function mirrorSecretToGitHub(
  repoSlug: string,
  secretName: string,
  secretValue: string,
  githubToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  const keyRes = await fetchImpl(`https://api.github.com/repos/${repoSlug}/actions/secrets/public-key`, {
    headers,
  });
  if (!keyRes.ok) {
    throw new Error(`mirrorSecretToGitHub: failed to fetch public key: HTTP ${keyRes.status}`);
  }
  const keyBody = (await keyRes.json()) as { key_id?: string; key?: string };
  if (!keyBody.key_id || !keyBody.key) {
    throw new Error("mirrorSecretToGitHub: public-key response missing key_id/key");
  }

  await sodium.ready;
  const publicKey = sodium.from_base64(keyBody.key, sodium.base64_variants.ORIGINAL);
  const encryptedValue = sodium.to_base64(
    sodium.crypto_box_seal(secretValue, publicKey),
    sodium.base64_variants.ORIGINAL,
  );

  const putRes = await fetchImpl(`https://api.github.com/repos/${repoSlug}/actions/secrets/${secretName}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyBody.key_id }),
  });
  if (!putRes.ok) {
    throw new Error(`mirrorSecretToGitHub: failed to set secret: HTTP ${putRes.status}`);
  }
}
