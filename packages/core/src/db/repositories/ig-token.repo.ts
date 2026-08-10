import { eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { igToken } from "../schema.js";

export async function getToken(db: Db, accountId: string) {
  const rows = await db.select().from(igToken).where(eq(igToken.accountId, accountId)).limit(1);
  return rows[0];
}

export async function upsertToken(
  db: Db,
  accountId: string,
  fields: {
    accessTokenEncrypted: string;
    expiresAt: string;
    threadsAccessTokenEncrypted?: string | null;
    threadsExpiresAt?: string | null;
  },
) {
  await db
    .insert(igToken)
    .values({ accountId, ...fields })
    .onConflictDoUpdate({
      target: igToken.accountId,
      set: { ...fields, updatedAt: new Date().toISOString() },
    });
}
