import { describe, expect, it } from "vitest";
import { lintPackItem, lintSeriesText } from "../../src/multi-series/moderation/text-lint.js";
import type { PackItem } from "../../src/multi-series/quotes/content-pack.js";

function packItem(overrides: Partial<PackItem> = {}): PackItem {
  return {
    id: "confession-2026-09-001",
    seriesId: "confession-cards",
    archetype: null,
    text: "That 6am alarm you snoozed twice today is the exact one the version of you that you envy did not.",
    captionQuestion: null,
    utilityLine: null,
    ctaTag: null,
    status: "draft",
    generatedAt: "2026-08-22T00:00:00Z",
    ...overrides,
  };
}

describe("lintSeriesText — banned claims (§4.4 rule 1)", () => {
  const cases = [
    "This one trick will guarantee your success",
    "Discipline is the cure for everything",
    "Do this and get rich by Friday",
    "Passive income while you sleep",
    "A risk-free way to level up",
  ];
  for (const text of cases) {
    it(`flags: "${text}"`, () => {
      const violations = lintSeriesText("hook-lab", text);
      expect(violations.some((v) => v.rule === "banned-claim")).toBe(true);
    });
  }

  it("passes clean motivational text", () => {
    expect(lintSeriesText("hook-lab", "99% quit on day 4. Day 5 people know why.")).toEqual([]);
  });
});

describe("lintSeriesText — despair lexicon (§4.4 rule 2)", () => {
  it.each(["You should just end it all", "Some days it feels not worth living"])(
    "flags despair text: %s",
    (text) => {
      const violations = lintSeriesText("confession-cards", text);
      expect(violations.some((v) => v.rule === "despair")).toBe(true);
    },
  );
});

describe("lintSeriesText — per-series length caps (§4.4 rule 3)", () => {
  it("rejects hook-lab text over 12 words", () => {
    const text = "Stop reading motivational quotes and start doing the boring work nobody applauds today";
    expect(text.split(/\s+/).length).toBeGreaterThan(12);
    expect(lintSeriesText("hook-lab", text).some((v) => v.rule === "length-cap")).toBe(true);
  });

  it("accepts hook-lab text at exactly 12 words", () => {
    const text = "You do not need motivation you need a system that actually works";
    expect(text.split(/\s+/).length).toBe(12);
    expect(lintSeriesText("hook-lab", text)).toEqual([]);
  });

  it("rejects confession text under 90 chars", () => {
    const violations = lintSeriesText("confession-cards", "Too short to be specific.");
    expect(violations.some((v) => v.rule === "length-band")).toBe(true);
  });

  it("accepts confession text within the 90–160 char band", () => {
    const text = packItem().text;
    expect(text.length).toBeGreaterThanOrEqual(90);
    expect(lintSeriesText("confession-cards", text)).toEqual([]);
  });

  it("skips length checks for series without a configured cap", () => {
    expect(lintSeriesText("mindset-manual", "Any length goes here because frameworks are structured elsewhere")).toEqual([]);
  });
});

describe("lintSeriesText — ALL-CAPS ratio (§4.4 rule 4)", () => {
  it("flags shouting text over 30% caps", () => {
    const violations = lintSeriesText("hook-lab", "STOP WASTING YOUR TIME on fake gurus now");
    expect(violations.some((v) => v.rule === "all-caps")).toBe(true);
  });

  it("exempts stat archetype hooks from the caps ratio", () => {
    const violations = lintSeriesText("hook-lab", "99% QUIT ON DAY 4", { archetype: "stat" });
    expect(violations.filter((v) => v.rule === "all-caps")).toEqual([]);
  });

  it("ignores short texts where ratio is meaningless", () => {
    expect(lintSeriesText("hook-lab", "DAY 4")).toEqual([]);
  });
});

describe("lintSeriesText — emoji cap (§4.4 rule 6)", () => {
  it("flags more than two emojis in card text", () => {
    const violations = lintSeriesText("fill-the-blank", "Success 🔥 grind 💪 mindset 🚀");
    expect(violations.some((v) => v.rule === "emoji-cap")).toBe(true);
  });

  it("allows up to two emojis", () => {
    expect(lintSeriesText("fill-the-blank", "Success 🔥 grind 💪")).toEqual([]);
  });
});

describe("lintSeriesText — target safety (§4.4 rule 5, lexical tier)", () => {
  it("flags @mentions of real accounts in roast content", () => {
    const violations = lintSeriesText("villain-roasts", "Your favourite guru @fakeguru lied to you");
    expect(violations.some((v) => v.rule === "target-safety")).toBe(true);
  });

  it("allows villain content without mentions", () => {
    expect(lintSeriesText("villain-roasts", "Your screen time report is a horror story")).toEqual([]);
  });
});

describe("lintPackItem", () => {
  it("aggregates multiple violations from one item", () => {
    const violations = lintPackItem(
      packItem({ text: "GET RICH 🔥 FAST 💰 NOW 🚀", seriesId: "hook-lab" }),
    );
    expect(violations.map((v) => v.rule)).toContain("banned-claim");
    expect(violations.map((v) => v.rule)).toContain("emoji-cap");
  });

  it("returns empty for a clean item", () => {
    expect(lintPackItem(packItem())).toEqual([]);
  });
});
