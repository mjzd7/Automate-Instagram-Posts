import { describe, expect, it } from "vitest";
import { generatePackItems } from "../../src/multi-series/generation/generate-pack.js";

function jsonOf(value: unknown): string {
  return JSON.stringify(value);
}

function fenced(value: unknown): string {
  return "```json\n" + JSON.stringify(value) + "\n```";
}

describe("generatePackItems", () => {
  it("builds draft items with sequential month ids from a fake provider", async () => {
    const fake: (prompt: string) => Promise<string> = async () =>
      jsonOf({
        text: "That 6am alarm you snoozed twice today is the exact one the version of you that you envy did not.",
      });
    const { items, dropped } = await generatePackItems(
      "confession-cards",
      2,
      fake,
      new Date("2026-09-15T00:00:00Z"),
    );
    expect(items.map((i) => i.id)).toEqual([
      "confession-cards-2026-09-001",
      "confession-cards-2026-09-002",
    ]);
    expect(items.every((i) => i.status === "draft")).toBe(true);
    expect(dropped).toEqual([]);
  });

  it("strips markdown fences around model JSON", async () => {
    const fake: (prompt: string) => Promise<string> = async () =>
      fenced({ archetype: "stat", text: "99% quit on day 4" });
    const { items } = await generatePackItems(
      "hook-lab",
      1,
      fake,
      new Date("2026-09-15T00:00:00Z"),
    );
    expect(items[0]?.archetype).toBe("stat");
    expect(items[0]?.text).toBe("99% quit on day 4");
  });

  it("drops items that violate the moderation lint instead of failing the batch", async () => {
    const fake: (prompt: string) => Promise<string> = async () =>
      jsonOf({ text: "GET RICH 🔥 FAST 💰 NOW 🚀" });
    const { items, dropped } = await generatePackItems(
      "hook-lab",
      1,
      fake,
      new Date("2026-09-15T00:00:00Z"),
    );
    expect(items).toHaveLength(0);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]?.violations.map((v) => v.rule)).toContain("banned-claim");
  });

  it("drops unparsable model responses but keeps the batch alive", async () => {
    const fake: (prompt: string) => Promise<string> = async () => "not json at all";
    const { items, dropped } = await generatePackItems(
      "fill-the-blank",
      1,
      fake,
      new Date("2026-09-15T00:00:00Z"),
    );
    expect(items).toHaveLength(0);
    expect(dropped[0]?.violations[0]?.rule).toBe("unparsable");
  });

  it("throws when the provider itself fails (loud, not silent)", async () => {
    const fake: (prompt: string) => Promise<string> = async () => {
      throw new Error("503 from provider");
    };
    await expect(
      generatePackItems("villain-roasts", 1, fake, new Date("2026-09-15T00:00:00Z")),
    ).rejects.toThrow(/503/);
  });

  it("passes linted metadata through: fill-the-blank keeps captionQuestion, roasts keep ctaTag", async () => {
    const blankFake: (prompt: string) => Promise<string> = async () =>
      jsonOf({ text: "Success is 10% talent and 90% {{BLANK}}", captionQuestion: "Talent or system?" });
    const blank = await generatePackItems("fill-the-blank", 1, blankFake, new Date("2026-09-15T00:00:00Z"));
    expect(blank.items[0]?.captionQuestion).toBe("Talent or system?");

    const roastFake: (prompt: string) => Promise<string> = async () =>
      jsonOf({
        text: "Your screen time report is a horror story",
        ctaTag: "Send this to your accountability partner.",
      });
    const roast = await generatePackItems("villain-roasts", 1, roastFake, new Date("2026-09-15T00:00:00Z"));
    expect(roast.items[0]?.ctaTag).toBe("Send this to your accountability partner.");
  });

  it("maps mindset-manual framework blocks into items", async () => {
    const manualFake: (prompt: string) => Promise<string> = async () =>
      jsonOf({
        framework: { title: "The 3-3-3 Morning", steps: ["Journal 3 min", "Pick 3 priorities", "3 deep-work blocks"] },
        utilityLine: "Try it tomorrow morning.",
        text: "The 3-3-3 Morning — journal, prioritize, focus.",
      });
    const { items } = await generatePackItems("mindset-manual", 1, manualFake, new Date("2026-09-15T00:00:00Z"));
    expect(items[0]?.framework?.title).toBe("The 3-3-3 Morning");
    expect(items[0]?.utilityLine).toBe("Try it tomorrow morning.");
  });
});
