import { and, eq, notInArray, sql } from "drizzle-orm";
import type { Db } from "../client";
import { backgroundUsage, backgrounds } from "../schema";

export interface NewBackground {
  id: string;
  source: string;
  externalId?: string | null;
  sourceUrl: string;
  description?: string | null;
  attribution?: string | null;
  categoryId?: string | null;
  darkness?: "dark" | "light" | null;
}

export async function findUnusedForAccount(
  db: Db,
  accountId: string,
  limit: number,
  categoryId?: string,
  targetDarkness?: "dark" | "light",
) {
  const used = db
    .select({ backgroundId: backgroundUsage.backgroundId })
    .from(backgroundUsage)
    .where(eq(backgroundUsage.accountId, accountId));

  return db
    .select()
    .from(backgrounds)
    .where(
      and(
        eq(backgrounds.active, true),
        notInArray(backgrounds.id, used),
        categoryId ? eq(backgrounds.categoryId, categoryId) : undefined,
        targetDarkness ? eq(backgrounds.darkness, targetDarkness) : undefined,
      ),
    )
    .orderBy(sql`RANDOM()`)
    .limit(limit);
}

export async function insertBackground(db: Db, background: NewBackground) {
  await db.insert(backgrounds).values(background).onConflictDoNothing();
}

export async function updateDarkness(db: Db, id: string, darkness: "dark" | "light") {
  await db.update(backgrounds).set({ darkness }).where(eq(backgrounds.id, id));
}

export async function findBackgroundById(db: Db, id: string) {
  const rows = await db.select().from(backgrounds).where(eq(backgrounds.id, id)).limit(1);
  return rows[0];
}
