import { describe, expect, it } from "vitest";
import { composeViralReelImage, composeViralReelOverlay } from "../../src/images/viral-compositor.js";
import { solidColorImage } from "./fixtures.js";

describe("viral-compositor", () => {
  it("renders Twitter/X dark card template", async () => {
    const backgroundBuffer = await solidColorImage(1080, 1920, { r: 15, g: 23, b: 42 });
    const buffer = await composeViralReelImage({
      backgroundBuffer,
      quoteText: "Seek wealth, not money or status. Wealth is having assets that earn while you sleep.",
      author: "Naval Ravikant",
      style: "twitter-dark",
      category: "wealth"
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("renders Apple Notes dark checklist template", async () => {
    const backgroundBuffer = await solidColorImage(1080, 1920, { r: 24, g: 24, b: 27 });
    const buffer = await composeViralReelImage({
      backgroundBuffer,
      quoteText: "You have power over your mind - not outside events. Realize this, and you will find strength.",
      author: "Marcus Aurelius",
      style: "apple-notes",
      category: "stoic"
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("renders Swiss Minimalist Editorial Typography template", async () => {
    const backgroundBuffer = await solidColorImage(1080, 1920, { r: 10, g: 10, b: 10 });
    const buffer = await composeViralReelImage({
      backgroundBuffer,
      quoteText: "The first rule of compounding: Never interrupt it unnecessarily.",
      author: "Charlie Munger",
      style: "editorial-luxury",
      category: "business"
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("renders classic Apple Liquid Glass template with full finishing", async () => {
    const backgroundBuffer = await solidColorImage(1080, 1920, { r: 20, g: 30, b: 50 });
    const buffer = await composeViralReelImage({
      backgroundBuffer,
      quoteText: "No man is free who is not master of himself.",
      author: "Epictetus",
      style: "classic-glass",
      category: "discipline"
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("renders a transparent PNG overlay for video b-roll", async () => {
    const buffer = await composeViralReelOverlay({
      quoteText: "Play iterated games. All returns come from compounding.",
      author: "Naval Ravikant",
      style: "twitter-dark",
      category: "wealth"
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
