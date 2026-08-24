import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { posts, series } from "../../db/schema.js";
import { countPublishedSince } from "../../db/repositories/posts.repo.js";
import { loadSeries, type SeriesConfig } from "../../config/series.js";
import { composeSeriesCard } from "../images/compose-series-card.js";
import {
  parsePackItems,
  selectApprovedItems,
  type PackItem,
} from "../quotes/content-pack.js";
import { dueSlots, selectSlotContent } from "./slot-scheduler.js";

// Series batch runner — copy-adaptation of pipeline/generate-and-publish-batch.ts
// conventions (§4.0 isolation): injectable clock/ids, rolling-24h hard-stop
// rate cap, posting-hour gate, consecutive-failure abort. Divergence: content
// comes from approved git-native packs through the slot scheduler instead of
// external quote APIs; post rows insert here with seriesId/archetype.

const HARD_STOP_POSTS_PER_DAY = 22;
const CONSECUTIVE_FAILURE_ABORT = 3;
const DEFAULT_POSTING_HOURS = [9, 21];

export interface SeriesBatchAccount {
  id: string;
  timezone: string;
  postingHoursLocal?: number[];
}

export interface SeriesBatchOptions {
  db?: Db;
  accountId?: string;
  repoRoot?: string;
  series?: SeriesConfig[];
  packsRoot?: string;
  account?: SeriesBatchAccount;
  backgroundProvider?: () => Promise<Buffer>;
  dryRun?: boolean;
  ignoreRateCap?: boolean;
  ignorePostingHour?: boolean;
  now?: () => Date;
  idGenerator?: () => string;
}

export interface SeriesBatchItemResult {
  seriesId: string;
  action: "composed" | "skip" | "fallback";
  itemId?: string;
  jpegLength?: number;
  reason?: string;
}

export interface SeriesBatchResult {
  skippedReason?: "rate-cap" | "not-posting-hour" | "no-due-slots";
  items: SeriesBatchItemResult[];
}

function getLocalHour(date: Date, timezone: string): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(date);
  return parseInt(formatted, 10) % 24;
}

async function loadMonthPack(packsRoot: string, seriesId: string, month: string): Promise<PackItem[]> {
  try {
    const raw = await readFile(path.join(packsRoot, seriesId, `${month}.json`), "utf-8");
    return parsePackItems(JSON.parse(raw) as unknown);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw cause;
  }
}

async function incrementSeriesCounter(db: Db, seriesId: string, atIso: string): Promise<void> {
  await db
    .insert(series)
    .values({ id: seriesId, counter: 1, lastPostedAt: atIso })
    .onConflictDoUpdate({
      target: series.id,
      set: { counter: sql`${series.counter} + 1`, lastPostedAt: atIso },
    });
}

async function recordPublishedPost(
  db: Db,
  fields: {
    postId: string;
    accountId: string;
    templateId: string;
    scheduledFor: string;
    seriesId: string;
    archetype: string | null;
    publishedAt: string;
  },
): Promise<void> {
  await db.insert(posts).values({
    id: fields.postId,
    accountId: fields.accountId,
    templateId: fields.templateId,
    captionTemplateId: "series-default",
    mode: "dark",
    status: "published",
    scheduledFor: fields.scheduledFor,
    publishedAt: fields.publishedAt,
    seriesId: fields.seriesId,
    archetype: fields.archetype,
  });
}

export async function runSeriesBatch(options: SeriesBatchOptions): Promise<SeriesBatchResult> {
  const now = options.now ?? (() => new Date());
  const dryRun = options.dryRun ?? true;
  const currentTime = now();
  const month = currentTime.toISOString().slice(0, 7);

  const allSeries: SeriesConfig[] =
    options.series ?? (await loadSeries(path.join(options.repoRoot ?? process.cwd(), "data", "series.json")));

  const due = dueSlots(currentTime, allSeries);
  if (due.length === 0) {
    return { skippedReason: "no-due-slots", items: [] };
  }

  const liveGateActive = !dryRun && options.db !== undefined && options.accountId !== undefined;
  if (liveGateActive) {
    const since = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000).toISOString();
    if (!options.ignoreRateCap) {
      const publishedCount = await countPublishedSince(options.db!, options.accountId!, since);
      if (publishedCount >= HARD_STOP_POSTS_PER_DAY) {
        return { skippedReason: "rate-cap", items: [] };
      }
    }
    if (!options.ignorePostingHour) {
      const hours = options.account?.postingHoursLocal ?? DEFAULT_POSTING_HOURS;
      const localHour = getLocalHour(currentTime, options.account?.timezone ?? "UTC");
      if (!hours.includes(localHour)) {
        return { skippedReason: "not-posting-hour", items: [] };
      }
    }
  }

  const packsRoot =
    options.packsRoot ?? path.join(options.repoRoot ?? process.cwd(), "data", "content-packs");
  const background =
    options.backgroundProvider ??
    (() =>
      sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#1B2431" } })
        .jpeg()
        .toBuffer());

  const items: SeriesBatchItemResult[] = [];
  let consecutiveFailures = 0;

  for (const slot of due) {
    if (consecutiveFailures >= CONSECUTIVE_FAILURE_ABORT) break;

    const packItems = await loadMonthPack(packsRoot, slot.seriesId, month);
    const approved = selectApprovedItems(packItems);
    const decision = selectSlotContent(slot.seriesId, approved);

    if (decision.kind === "skip") {
      items.push({ seriesId: slot.seriesId, action: "skip", reason: decision.reason });
      continue;
    }
    if (decision.kind === "fallback") {
      items.push({
        seriesId: slot.seriesId,
        action: "fallback",
        reason: "empty pack; legacy provider chain handles this series",
      });
      continue;
    }

    const seriesConfig = allSeries.find((s) => s.id === slot.seriesId);
    if (!seriesConfig) {
      items.push({ seriesId: slot.seriesId, action: "skip", reason: "series missing from config" });
      continue;
    }
    const templateId = seriesConfig.templateIds[0] ?? "hook-cover";
    const item = approved.find((candidate) => candidate.id === decision.item.id);
    if (!item) {
      items.push({ seriesId: slot.seriesId, action: "skip", reason: "selected item vanished from approved pool" });
      continue;
    }

    try {
      const jpeg = await composeSeriesCard({ backgroundBuffer: await background(), templateId, item });

      if (liveGateActive) {
        const postId = (options.idGenerator ?? (() => crypto.randomUUID()))();
        await recordPublishedPost(options.db!, {
          postId,
          accountId: options.accountId!,
          templateId,
          scheduledFor: currentTime.toISOString(),
          seriesId: slot.seriesId,
          archetype: item.archetype ?? null,
          publishedAt: currentTime.toISOString(),
        });
        await incrementSeriesCounter(options.db!, slot.seriesId, currentTime.toISOString());
      }

      items.push({
        seriesId: slot.seriesId,
        action: "composed",
        itemId: item.id,
        jpegLength: jpeg.length,
      });
    } catch (cause) {
      consecutiveFailures++;
      const message = cause instanceof Error ? cause.message : String(cause);
      items.push({ seriesId: slot.seriesId, action: "skip", reason: `compose failed: ${message}` });
    }
  }

  return { items };
}
