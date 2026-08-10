import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderScrim } from "../../src/images/scrim.js";

describe("renderScrim", () => {
  it("produces a valid PNG at the requested dimensions", async () => {
    const png = await renderScrim(200, 100, "dark", 0.45);
    const metadata = await sharp(png).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(100);
  });

  it("has zero alpha at the top and bottom edges and peak alpha near the middle (gradient shape)", async () => {
    const png = await renderScrim(100, 200, "dark", 0.45);
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (y: number) => {
      const x = Math.floor(info.width / 2);
      const idx = (y * info.width + x) * info.channels + 3;
      return data[idx] ?? 0;
    };
    expect(alphaAt(0)).toBeLessThan(10);
    expect(alphaAt(info.height - 1)).toBeLessThan(10);
    expect(alphaAt(Math.floor(info.height / 2))).toBeGreaterThan(alphaAt(0));
  });

  it("renders a higher peak alpha for a higher peakOpacity input", async () => {
    const normal = await renderScrim(100, 200, "dark", 0.45);
    const busy = await renderScrim(100, 200, "dark", 0.6);
    const midAlpha = async (buf: Buffer) => {
      const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
      const x = Math.floor(info.width / 2);
      const y = Math.floor(info.height / 2);
      return data[(y * info.width + x) * info.channels + 3] ?? 0;
    };
    expect(await midAlpha(busy)).toBeGreaterThan(await midAlpha(normal));
  });

  it("uses white for light mode and black for dark mode", async () => {
    const dark = await renderScrim(50, 100, "dark", 0.6);
    const light = await renderScrim(50, 100, "light", 0.6);
    const midColor = async (buf: Buffer) => {
      const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
      const x = Math.floor(info.width / 2);
      const y = Math.floor(info.height / 2);
      const idx = (y * info.width + x) * info.channels;
      return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
    };
    const darkColor = await midColor(dark);
    const lightColor = await midColor(light);
    expect(darkColor.r).toBeLessThan(50);
    expect(lightColor.r).toBeGreaterThan(200);
  });
});
