import { and, eq, notInArray, sql } from "drizzle-orm";
import type { Db } from "../client.js";
import { quoteUsage, quotes } from "../schema.js";

export interface NewQuote {
  id: string;
  text: string;
  author?: string | null;
  categoryId: string;
  source?: string;
}

/**
 * Anti-join dedup: quotes in the requested category, active, that this
 * account has never used (plan.md §7.3 example query).
 */
export async function findUnusedForAccount(
  db: Db,
  accountId: string,
  categoryId: string,
  limit: number,
) {
  const used = db
    .select({ quoteId: quoteUsage.quoteId })
    .from(quoteUsage)
    .where(eq(quoteUsage.accountId, accountId));

  return db
    .select()
    .from(quotes)
    .where(
      and(
        eq(quotes.categoryId, categoryId),
        eq(quotes.active, true),
        notInArray(quotes.id, used),
      ),
    )
    .orderBy(sql`RANDOM()`)
    .limit(limit);
}

export async function insertQuote(db: Db, quote: NewQuote) {
  await db.insert(quotes).values(quote).onConflictDoNothing();
}

export async function findQuoteById(db: Db, id: string) {
  const rows = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  return rows[0];
}

export async function findQuoteByText(db: Db, text: string) {
  const normalized = text.trim().toLowerCase();
  const rows = await db.select().from(quotes).where(sql`LOWER(TRIM(${quotes.text})) = ${normalized}`).limit(1);
  return rows[0];
}

export async function isQuoteTextUsedForAccount(db: Db, accountId: string, text: string): Promise<boolean> {
  const normalized = text.trim().toLowerCase();
  const rows = await db
    .select({ id: quotes.id })
    .from(quotes)
    .innerJoin(quoteUsage, eq(quotes.id, quoteUsage.quoteId))
    .where(and(eq(quoteUsage.accountId, accountId), sql`LOWER(TRIM(${quotes.text})) = ${normalized}`))
    .limit(1);
  return rows.length > 0;
}

/** Updates the text of a single quote row by id. Used by the retroactive capitalisation migration. */
export async function updateQuoteText(db: Db, id: string, text: string) {
  await db.update(quotes).set({ text }).where(eq(quotes.id, id));
}

/** Returns all quote rows. Used only by one-shot migration scripts. */
export async function findAllQuotes(db: Db) {
  return db.select({ id: quotes.id, text: quotes.text }).from(quotes);
}

