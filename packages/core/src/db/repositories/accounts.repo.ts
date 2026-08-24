import { eq } from "drizzle-orm";
import type { Account } from "../../config/accounts";
import type { Db } from "../client";
import { accounts } from "../schema";

/**
 * Idempotent upsert from data/accounts.json into the accounts table
 * (plan.md §7's seed-db --sync-accounts). JSON array/object fields are
 * stored as TEXT per schema.ts, so category focus and posting hours are
 * serialized here rather than pushed to callers.
 */
export async function upsertAccount(db: Db, account: Account) {
  const row = {
    id: account.id,
    igUserId: account.igUserId,
    fbPageId: account.fbPageId,
    threadsUserId: account.threadsUserId,
    categoryFocus: JSON.stringify(account.categoryFocus),
    timezone: account.timezone,
    postingHoursLocal: JSON.stringify(account.postingHoursLocal),
    active: account.active,
  };
  await db
    .insert(accounts)
    .values(row)
    .onConflictDoUpdate({ target: accounts.id, set: row });
}

export async function findAccountRow(db: Db, id: string) {
  const rows = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return rows[0];
}

export async function listAccountRows(db: Db) {
  return db.select().from(accounts);
}
