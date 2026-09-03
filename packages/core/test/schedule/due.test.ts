import { describe, expect, it } from "vitest";
import { dueEntries } from "../../src/schedule/due.js";
import type { PipelineFile } from "../../src/schedule/generator.js";

const FILE: PipelineFile = {
  month: "2026-09",
  seed: "seed1",
  generatedAt: "2026-08-24T00:00:00.000Z",
  entries: [
    { id: "main:2026-09-03:9", accountId: "main", date: "2026-09-03", hour: 9, templateId: "bold-modern", categoryId: "success", status: "planned" },
    { id: "main:2026-09-03:12", accountId: "main", date: "2026-09-03", hour: 12, templateId: "bold-modern", categoryId: "success", status: "planned" },
    { id: "main:2026-09-03:16", accountId: "main", date: "2026-09-03", hour: 16, templateId: "bold-modern", categoryId: "success", status: "planned" },
    { id: "main:2026-09-03:19", accountId: "main", date: "2026-09-03", hour: 19, templateId: "bold-modern", categoryId: "success", status: "planned" },
    { id: "main:2026-09-04:9", accountId: "main", date: "2026-09-04", hour: 9, templateId: "bold-modern", categoryId: "success", status: "planned" },
    { id: "other:2026-09-03:9", accountId: "other", date: "2026-09-03", hour: 9, templateId: "bold-modern", categoryId: "success", status: "planned" },
  ],
};

describe("dueEntries", () => {
  it("returns planned entries on or before the current local hour today", () => {
    // 13:00 IST on 2026-09-03 (07:30 UTC)
    const now = new Date("2026-09-03T07:30:00.000Z");
    const due = dueEntries(FILE, "main", now, "Asia/Kolkata");
    expect(due.map((d) => d.id)).toEqual(["main:2026-09-03:9", "main:2026-09-03:12"]);
  });

  it("filters out entries already recorded as published/failed/skipped in liveStatuses", () => {
    const now = new Date("2026-09-03T07:30:00.000Z"); // 13:00 IST
    const liveStatuses = { "main:2026-09-03:9": "published" as const };
    const due = dueEntries(FILE, "main", now, "Asia/Kolkata", liveStatuses);
    expect(due.map((d) => d.id)).toEqual(["main:2026-09-03:12"]);
  });

  it("does not return future hours or dates", () => {
    // 08:00 IST on 2026-09-03 (02:30 UTC)
    const now = new Date("2026-09-03T02:30:00.000Z");
    const due = dueEntries(FILE, "main", now, "Asia/Kolkata");
    expect(due).toEqual([]);
  });

  it("filters by account ID strictly", () => {
    const now = new Date("2026-09-03T07:30:00.000Z");
    const due = dueEntries(FILE, "other", now, "Asia/Kolkata");
    expect(due.map((d) => d.id)).toEqual(["other:2026-09-03:9"]);
  });
});
