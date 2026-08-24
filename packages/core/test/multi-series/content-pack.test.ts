import { describe, expect, it } from "vitest";
import {
  loadApprovedItems,
  parsePackItems,
  selectApprovedItems,
  type PackItem,
} from "../../src/multi-series/quotes/content-pack.js";

function validItem(overrides: Partial<PackItem> = {}): PackItem {
  return {
    id: "confession-2026-09-001",
    seriesId: "confession-cards",
    archetype: null,
    text: "Replaying that conversation from 2019 while running a 7-minute mile.",
    captionQuestion: "Discipline or motivation — which dragged you through this week?",
    utilityLine: null,
    ctaTag: null,
    status: "approved",
    generatedAt: "2026-08-22T00:00:00Z",
    ...overrides,
  };
}

describe("parsePackItems", () => {
  it("accepts a valid pack array", () => {
    const items = parsePackItems([validItem()]);
    expect(items).toHaveLength(1);
    expect(items[0]?.seriesId).toBe("confession-cards");
  });

  it("accepts an optional framework block (mindset-manual items)", () => {
    const items = parsePackItems([
      validItem({
        seriesId: "mindset-manual",
        framework: { title: "The 3-3-3 Morning", steps: ["Journal 3 min", "Pick 3 priorities", "3 deep-work blocks"] },
      }),
    ]);
    expect(items[0]?.framework?.steps).toHaveLength(3);
  });

  it("rejects a framework with fewer than 3 steps", () => {
    expect(() =>
      parsePackItems([
        validItem({ seriesId: "mindset-manual", framework: { title: "The 1-1-1", steps: ["only one"] } }),
      ]),
    ).toThrow(/steps/);
  });

  it("rejects a missing text field (input validation plane)", () => {
    const { text: _text, ...withoutText } = validItem();
    expect(() => parsePackItems([withoutText])).toThrow(/text/);
  });

  it("rejects an unknown status value (input validation plane)", () => {
    const malformed = { ...validItem(), status: "pending-review" };
    expect(() => parsePackItems([malformed])).toThrow(/status/);
  });

  it("rejects duplicate item ids within one pack (ids are consumption keys)", () => {
    expect(() => parsePackItems([validItem(), validItem()])).toThrow(/duplicate/i);
  });

  it("rejects a non-array top-level value", () => {
    expect(() => parsePackItems(validItem())).toThrow();
  });
});

describe("selectApprovedItems", () => {
  it("returns only approved items, oldest first (consumption order plane)", () => {
    const pack = [
      validItem({ id: "a", generatedAt: "2026-09-02T00:00:00Z" }),
      validItem({ id: "b", status: "draft", generatedAt: "2026-09-01T00:00:00Z" }),
      validItem({ id: "c", status: "rejected", generatedAt: "2026-09-03T00:00:00Z" }),
      validItem({ id: "d", generatedAt: "2026-09-01T12:00:00Z" }),
    ];
    const items = selectApprovedItems(pack);
    expect(items.map((i) => i.id)).toEqual(["d", "a"]);
  });

  it("filters by seriesId when given (multi-series isolation plane)", () => {
    const pack = [
      validItem({ id: "a", seriesId: "confession-cards" }),
      validItem({ id: "b", seriesId: "hook-lab" }),
    ];
    const items = selectApprovedItems(pack, "hook-lab");
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("b");
  });
});

describe("loadApprovedItems", () => {
  it("throws on a missing pack file (external deps plane)", async () => {
    await expect(loadApprovedItems("/nonexistent/pack.json")).rejects.toThrow();
  });
});
