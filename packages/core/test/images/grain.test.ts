import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { generateGrainTexture, grainTexturePng } from "../../src/images/grain.js";

describe("generateGrainTexture", () => {
  it("produces a buffer of exactly width*height*3 bytes (raw RGB, no alpha)", () => {
    const buf = generateGrainTexture(10, 10);
    expect(buf.length).toBe(10 * 10 * 3);
  });

  it("produces genuinely varied values, not a flat/uniform buffer (edge case: not degenerate)", () => {
    const buf = generateGrainTexture(50, 50);
    const unique = new Set(buf);
    expect(unique.size).toBeGreaterThan(50);
  });
});

describe("grainTexturePng", () => {
  it("produces a valid decodable PNG at the requested dimensions", async () => {
    const png = await grainTexturePng(100, 80);
    const metadata = await sharp(png).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(80);
  });
});
