import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderFittedText, renderTextAtSize, QuoteTruncatedError } from "../../src/images/text-render.js";
import { findTemplate } from "../../src/images/templates.js";

const face = findTemplate("bold-modern").quoteFont;

describe("renderTextAtSize", () => {
  it("renders non-blank output for real text with a real font file", async () => {
    const { data, info } = await renderTextAtSize("Hello", face, 400, 48, "#FFFFFF");
    const stats = await sharp(data).stats();
    expect(info.width).toBeGreaterThan(0);
    expect(stats.channels[3]?.max).toBeGreaterThan(0);
  });

  it("throws when the requested font file does not exist (safety net for FR-003's silent-fallback risk)", async () => {
    await expect(
      renderTextAtSize("x", { family: "Nonexistent", file: "/no/such/file.ttf" }, 200, 24, "#FFFFFF"),
    ).rejects.toThrow();
  });
});

describe("renderFittedText", () => {
  it("fits short text at the maximum font size without truncating", async () => {
    const result = await renderFittedText("Be bold.", face, 900, 500, "#FFFFFF");
    expect(result.truncated).toBe(false);
    expect(result.fontSize).toBe(72);
  });

  it("steps down the font size for longer text that doesn't fit within a constrained height", async () => {
    const longQuote =
      "The only way to do great work is to love what you do, and if you have not found it yet, keep looking, do not settle.";
    const result = await renderFittedText(longQuote, face, 900, 150, "#FFFFFF");
    expect(result.fontSize).toBeLessThan(72);
    expect(result.height).toBeLessThanOrEqual(150);
  });

    it("throws QuoteTruncatedError when even the minimum font size doesn't fit a very long quote in a small box", async () => {
      const veryLong =
        "This is an extremely long quote that goes on and on and on and simply cannot fit inside a very small box no matter how small the font gets rendered to try to accommodate it all";
      await expect(renderFittedText(veryLong, face, 300, 60, "#FFFFFF")).rejects.toThrow(
        QuoteTruncatedError
      );
    });

  it("throws on empty text (input validation plane)", async () => {
    await expect(renderFittedText("   ", face, 400, 200, "#FFFFFF")).rejects.toThrow(/empty/);
  });

  it("throws when the font file is missing rather than silently rendering a fallback font", async () => {
    await expect(
      renderFittedText("x", { family: "Nope", file: "/no/such/file.ttf" }, 400, 200, "#FFFFFF"),
    ).rejects.toThrow(/font file does not exist/);
  });
});
