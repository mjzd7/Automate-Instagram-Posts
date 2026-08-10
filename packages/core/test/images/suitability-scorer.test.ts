import { describe, expect, it } from "vitest";
import { scoreSuitability } from "../../src/images/suitability-scorer.js";
import { checkerboardImage, solidColorImage } from "./fixtures.js";

describe("scoreSuitability", () => {
  it("scores a uniform-color image as not busy (low stdev)", async () => {
    const img = await solidColorImage(1080, 1350, { r: 100, g: 100, b: 100 });
    const result = await scoreSuitability(img);
    expect(result.busy).toBe(false);
    expect(result.busynessScore).toBeLessThan(1);
    expect(result.blurRegion).toBe(false);
  });

  it("scores a high-contrast checkerboard as busy (high stdev)", async () => {
    const img = await checkerboardImage(1080, 1350, 4);
    const result = await scoreSuitability(img);
    expect(result.busy).toBe(true);
    expect(result.busynessScore).toBeGreaterThan(45);
    expect(result.blurRegion).toBe(true);
  });

  it("returns SCRIM_PEAK_OPACITY_NORMAL for a calm image and SCRIM_PEAK_OPACITY_BUSY for a busy one", async () => {
    const calm = await scoreSuitability(await solidColorImage(1080, 1350, { r: 50, g: 50, b: 50 }));
    const busy = await scoreSuitability(await checkerboardImage(1080, 1350, 4));
    expect(calm.scrimOpacity).toBe(0.45);
    expect(busy.scrimOpacity).toBe(0.6);
  });

  it("computes the text zone region as center 80% width, 45%-70% height band", async () => {
    const img = await solidColorImage(1000, 1000, { r: 1, g: 1, b: 1 });
    const result = await scoreSuitability(img);
    expect(result.textZoneRegion).toEqual({ left: 100, top: 450, width: 800, height: 250 });
  });

  it("throws a clear error for an image with unreadable metadata (error path plane)", async () => {
    await expect(scoreSuitability(Buffer.from("not an image"))).rejects.toThrow();
  });
});
