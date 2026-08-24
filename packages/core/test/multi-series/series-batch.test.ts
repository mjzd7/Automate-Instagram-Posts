import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type DbHandle } from "../../src/db/client.js";
import { series as seriesTable } from "../../src/db/schema.js";
import * as postsRepo from "../../src/db/repositories/posts.repo.js";
import { runSeriesBatch } from "../../src/multi-series/pipeline/series-batch.js";
import type { PackItem } from "../../src/multi-series/quotes/content-pack.js";

const MONDAY_10AM = new Date("2026-08-24T10:00:00Z");

const SERIES_FIXTURE = [
  {
    id: "hook-lab",
    name: "Hook Lab",
    templateIds: ["hook-cover"],
    captionPromptRef: "captions/hook-lab.txt",
    hashtagCategory: "motivational",
    slots: [{ dayOfWeek: 1, slot: "am" as const }],
    maxPerDay: 1,
    active: true,
  },
  {
    id: "mindset-manual",
    name: "Mindset Manual",
    templateIds: ["framework-carousel"],
    captionPromptRef: "captions/manual.txt",
    hashtagCategory: "mindset",
    slots: [{ dayOfWeek: 1, slot: "am" as const }],
    maxPerDay: 1,
    active: true,
  },
  {
    id: "season-reset",
    name: "Season Reset",
    templateIds: ["hook-cover"],
    captionPromptRef: "captions/season.txt",
    hashtagCategory: "mindset",
    slots: [{ dayOfWeek: 1, slot: "am" as const }],
    maxPerDay: 1,
    active: true,
  },
];

const ACCOUNT = { id: "acct1", timezone: "UTC", postingHoursLocal: [9, 21] };

let handle: DbHandle;
let packsRoot: string;

function draftItem(overrides: Partial<PackItem> = {}): PackItem {
  return {
    id: "hook-lab-2026-08-001",
    seriesId: "hook-lab",
    archetype: null,
    text: "Your 5 AM routine is just procrastination in a fancy suit.",
    framework: null,
    captionQuestion: null,
    utilityLine: null,
    ctaTag: null,
    status: "approved",
    generatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

async function seedPack(seriesId: string, items: PackItem[]): Promise<void> {
  const dir = join(packsRoot, seriesId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "2026-08.json"), JSON.stringify(items));
}

beforeEach(async () => {
  handle = await openDb(":memory:");
  packsRoot = join(tmpdir(), `series-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
});

afterEach(() => {
  handle.close();
});

describe("runSeriesBatch", () => {
  it("composes approved items, skips format-bound empties, falls back for generics (Monday AM)", async () => {
    await seedPack("hook-lab", [draftItem()]);
    // mindset-manual: no pack at all (format-bound -> skip)
    // season-reset: no pack at all (generic -> fallback)

    const result = await runSeriesBatch({
      series: SERIES_FIXTURE,
      packsRoot,
      account: ACCOUNT,
      now: () => MONDAY_10AM,
      dryRun: true,
    });

    expect(result.skippedReason).toBeUndefined();
    expect(result.items.map((i) => i.seriesId)).toEqual(["hook-lab", "mindset-manual", "season-reset"]);
    expect(result.items[0]).toMatchObject({ action: "composed", itemId: "hook-lab-2026-08-001" });
    expect(result.items[0]?.jpegLength).toBeGreaterThan(10_000);
    expect(result.items[1]?.action).toBe("skip");
    expect(result.items[2]?.action).toBe("fallback");
  }, 30_000);

  it("consumes only approved items — drafts never reach composition", async () => {
    await seedPack("hook-lab", [
      draftItem({ id: "draft-one", status: "draft", text: "DRAFT TEXT SHOULD NOT APPEAR" }),
      draftItem({ id: "approved-one", status: "approved", text: "Approved hook line." }),
    ]);
    const result = await runSeriesBatch({
      series: SERIES_FIXTURE.filter((s) => s.id === "hook-lab"),
      packsRoot,
      account: ACCOUNT,
      now: () => MONDAY_10AM,
      dryRun: true,
    });
    expect(result.items[0]?.action).toBe("composed");
    expect(result.items[0]?.itemId).toBe("approved-one");
  });

  it("stops with rate-cap before composing when 24h publish count hits the hard stop", async () => {
    for (let i = 0; i < 22; i++) {
      const postId = `seed-${i}`;
      await postsRepo.insertPendingPost(handle.db, {
        id: postId,
        accountId: ACCOUNT.id,
        templateId: "t",
        captionTemplateId: "c",
        mode: "dark",
        scheduledFor: MONDAY_10AM.toISOString(),
      });
      await postsRepo.markPublished(handle.db, postId, {
        igMediaId: null,
        igPermalink: null,
        threadsPostId: null,
        storiesMediaId: null,
        publishedAt: MONDAY_10AM.toISOString(),
      });
    }

    const result = await runSeriesBatch({
      db: handle.db,
      accountId: ACCOUNT.id,
      series: SERIES_FIXTURE,
      packsRoot,
      account: ACCOUNT,
      now: () => MONDAY_10AM,
      dryRun: false,
    });

    expect(result.skippedReason).toBe("rate-cap");
    expect(result.items).toHaveLength(0);
  });

  it("skips outside posting hours unless ignored (non-dry-run)", async () => {
    const result = await runSeriesBatch({
      db: handle.db,
      accountId: ACCOUNT.id,
      series: SERIES_FIXTURE,
      packsRoot,
      account: ACCOUNT,
      now: () => new Date("2026-08-24T03:00:00Z"),
      dryRun: false,
    });
    expect(result.skippedReason).toBe("not-posting-hour");
  });

  it("increments the series counter exactly once per composed post on real runs", async () => {
    await seedPack("mindset-manual", [
      draftItem({
        id: "mindset-manual-2026-08-001",
        seriesId: "mindset-manual",
        framework: { title: "The 1-1-1 Night", steps: ["A", "B", "C"] },
        utilityLine: "Try tonight.",
        text: "The 1-1-1 Night",
      }),
    ]);
    const result = await runSeriesBatch({
      db: handle.db,
      accountId: ACCOUNT.id,
      series: SERIES_FIXTURE.filter((s) => s.id === "mindset-manual"),
      packsRoot,
      account: ACCOUNT,
      now: () => MONDAY_10AM,
      dryRun: false,
      ignorePostingHour: true,
    });
    expect(result.items[0]?.action).toBe("composed");

    const rows = await handle.db.select().from(seriesTable);
    expect(rows[0]?.id).toBe("mindset-manual");
    expect(rows[0]?.counter).toBe(1);
    expect(rows[0]?.lastPostedAt).toBeTruthy();
  });
});
