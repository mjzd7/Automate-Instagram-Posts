import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../client";
import { posts, series } from "../schema";

export interface SeriesRow {
  id: string;
  counter: number;
  lastPostedAt: string | null;
}

export interface SeriesSignal {
  seriesId: string;
  count: number;
  views: number;
}

export interface EpisodeRow {
  id: string;
  publishedAt: string | null;
}

export async function getAllSeriesRows(db: Db): Promise<SeriesRow[]> {
  return db
    .select({ id: series.id, counter: series.counter, lastPostedAt: series.lastPostedAt })
    .from(series);
}

export async function getPublishedSignalsBySeries(db: Db): Promise<Map<string, SeriesSignal>> {
  const rows = await db
    .select({
      seriesId: posts.seriesId,
      count: sql<number>`count(*)`,
      views: sql<number>`coalesce(sum(${posts.views}), 0)`,
    })
    .from(posts)
    .where(eq(posts.status, "published"))
    .groupBy(posts.seriesId);
  const map = new Map<string, SeriesSignal>();
  for (const row of rows) {
    if (row.seriesId === null) continue;
    map.set(row.seriesId, { seriesId: row.seriesId, count: Number(row.count), views: Number(row.views) });
  }
  return map;
}

export async function getSeriesState(db: Db, seriesId: string): Promise<SeriesRow | undefined> {
  const rows = await db
    .select({ id: series.id, counter: series.counter, lastPostedAt: series.lastPostedAt })
    .from(series)
    .where(eq(series.id, seriesId))
    .limit(1);
  return rows[0];
}

export async function getPublishedEpisodesAsc(db: Db, targetSeriesId: string): Promise<EpisodeRow[]> {
  return db
    .select({ id: posts.id, publishedAt: posts.publishedAt })
    .from(posts)
    .where(and(eq(posts.seriesId, targetSeriesId), eq(posts.status, "published")))
    .orderBy(asc(posts.publishedAt));
}
