import { and, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { settings } from "../schema.js";

export async function getSetting(db: Db, accountId: string, key: string): Promise<string | undefined> {
  const rows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.accountId, accountId), eq(settings.key, key)))
    .limit(1);
  return rows[0]?.value;
}

export async function setSetting(db: Db, accountId: string, key: string, value: string) {
  await db
    .insert(settings)
    .values({ accountId, key, value })
    .onConflictDoUpdate({
      target: [settings.accountId, settings.key],
      set: { value, updatedAt: new Date().toISOString() },
    });
}
