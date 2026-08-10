import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

/**
 * AES-256-GCM encryption for tokens stored at rest in ig_token
 * (plan.md §5, TOKEN_ENCRYPTION_KEY env var) -- defense-in-depth since the
 * repo is public (git-native architecture). Output format is
 * "{ivHex}:{authTagHex}:{ciphertextHex}", a single string safe to store in
 * a TEXT column.
 */
export function encryptToken(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error(`encryptToken: key must be 32 bytes (64 hex chars), got ${key.length} bytes`);
  }
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptToken(encrypted: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error(`decryptToken: key must be 32 bytes (64 hex chars), got ${key.length} bytes`);
  }
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("decryptToken: malformed encrypted value (expected ivHex:authTagHex:ciphertextHex)");
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const authTag = Buffer.from(authTagHex!, "hex");
  const ciphertext = Buffer.from(ciphertextHex!, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf-8");
}
