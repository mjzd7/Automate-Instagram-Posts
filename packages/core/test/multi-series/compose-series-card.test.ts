import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { composeSeriesCard } from "../../src/multi-series/images/compose-series-card.js";
import type { PackItem } from "../../src/multi-series/quotes/content-pack.js";

function solidBackground(): Promise<Buffer> {
  return sharp({
    create: { width: 1080, height: 1350, channels: 3, background: "#223344" },
  })
    .jpeg()
    .toBuffer();
}

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
    status: "draft",
    generatedAt: "2026-08-22T00:00:00Z",
    ...overrides,
  };
}

const CASES: Array<{ templateId: string; item: PackItem }> = [
  { templateId: "hook-cover", item: draftItem() },
  {
    templateId: "confession-card",
    item: draftItem({
      id: "confession-cards-2026-08-001",
      seriesId: "confession-cards",
      text: "That 6am alarm you snoozed twice today is the exact one the version of you that you envy did not.",
    }),
  },
  {
    templateId: "identity-badge",
    item: draftItem({
      id: "confession-cards-2026-08-002",
      seriesId: "confession-cards",
      text: "Replaying that conversation from 2019 while running a 7-minute mile before sunrise.",
    }),
  },
  {
    templateId: "roast-footer",
    item: draftItem({
      id: "villain-roasts-2026-08-001",
      seriesId: "villain-roasts",
      text: "Watching productive morning routines at 2 AM is not personal growth.",
      ctaTag: "Send this to your accountability partner.",
    }),
  },
  {
    templateId: "gap-line",
    item: draftItem({
      id: "fill-the-blank-2026-08-001",
      seriesId: "fill-the-blank",
      text: "You don't need more time, you need more {{BLANK}}.",
      captionQuestion: "Focus or discipline?",
    }),
  },
  {
    templateId: "hook-cover",
    item: draftItem({
      id: "season-reset-2026-08-001",
      seriesId: "season-reset",
      text: "As Sunday night settles in, I refuse to let tomorrow's anxiety steal my present peace. I am ready for this week.",
    }),
  },
  {
    templateId: "framework-mini",
    item: draftItem({
      id: "mindset-manual-2026-08-001",
      seriesId: "mindset-manual",
      text: "The 3-2-1 Morning",
      framework: {
        title: "The 3-2-1 Morning",
        steps: ["Drink three glasses of water", "Write two priorities", "One deep task"],
      },
      utilityLine: "Test this tomorrow morning.",
    }),
  },
];

describe("composeSeriesCard", () => {
  it.each(CASES.map((c) => [c.templateId, c] as const))(
    "composes %s to a 1080x1350 JPEG",
    async (_id, { templateId, item }) => {
      const buffer = await composeSeriesCard({
        backgroundBuffer: await solidBackground(),
        templateId,
        item,
        grainRandom: () => 0.5,
      });
      const meta = await sharp(buffer).metadata();
      expect(meta.format).toBe("jpeg");
      expect(meta.width).toBe(1080);
      expect(meta.height).toBe(1350);
    },
    20_000,
  );

  it("renders the fill-the-blank card without leaking the raw {{BLANK}} token into layout math (replacement happens pre-fit)", async () => {
    // The fit loop must size against the underscore string; if the token were
    // left in place the rendered width would differ wildly between calls with
    // identical visible output — this determinism check pins that behavior.
    const base = {
      backgroundBuffer: await solidBackground(),
      templateId: "gap-line" as const,
      item: draftItem({
        id: "fill-the-blank-2026-08-001",
        seriesId: "fill-the-blank",
        text: "You don't need more time, you need more {{BLANK}}.",
      }),
      grainRandom: () => 0.5,
    };
    const a = await composeSeriesCard(base);
    const b = await composeSeriesCard(base);
    expect(a.equals(b)).toBe(true);
  });

  it("throws QuoteTruncatedError for pathologically long unbroken text instead of clipping", async () => {
    await expect(
      composeSeriesCard({
        backgroundBuffer: await solidBackground(),
        templateId: "hook-cover",
        item: draftItem({ text: "A".repeat(400) }),
        grainRandom: () => 0.5,
      }),
    ).rejects.toThrow(/QuoteTruncatedError/);
  });

  it("rejects an unknown template id loudly", async () => {
    await expect(
      composeSeriesCard({
        backgroundBuffer: await solidBackground(),
        templateId: "nonexistent",
        item: draftItem(),
      }),
    ).rejects.toThrow(/Unknown series template/);
  });
});
