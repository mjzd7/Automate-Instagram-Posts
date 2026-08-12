import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { composeImage } from "../../src/images/compositor.js";
import { IMAGE_HEIGHT, IMAGE_WIDTH } from "../../src/images/constants.js";
import { findTemplate, TEMPLATES } from "../../src/images/templates.js";
import { solidColorImage } from "./fixtures.js";

const calmSuitability = {
  busy: false,
  busynessScore: 5,
  scrimOpacity: 0.45,
  blurRegion: false,
  textZoneRegion: { left: 108, top: 607, width: 864, height: 337 },
};

const busySuitability = { ...calmSuitability, busy: true, scrimOpacity: 0.6, blurRegion: true };

/** Constant "random" so two composeImage() calls generate identical grain noise, isolating whatever else the test is actually comparing. */
const fixedRandom = () => 0.5;

describe("composeImage", () => {
  it("produces a valid JPEG at exactly IMAGE_WIDTH x IMAGE_HEIGHT", async () => {
    const background = await solidColorImage(600, 800, { r: 20, g: 20, b: 20 });
    const buffer = await composeImage({
      backgroundBuffer: background,
      quoteText: "The only way out is through.",
      author: "Robert Frost",
      template: findTemplate("bold-modern"),
      mode: "dark",
      suitability: calmSuitability,
    });
    const metadata = await sharp(buffer).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(IMAGE_WIDTH);
    expect(metadata.height).toBe(IMAGE_HEIGHT);
  });

  it("succeeds without an author (author line is optional)", async () => {
    const background = await solidColorImage(600, 800, { r: 200, g: 200, b: 200 });
    const buffer = await composeImage({
      backgroundBuffer: background,
      quoteText: "Discipline beats motivation.",
      template: findTemplate("editorial-elegant"),
      mode: "light",
      suitability: calmSuitability,
    });
    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(IMAGE_WIDTH);
  });

  it("handles the busy/blurRegion path (suitability.blurRegion=true) without throwing", async () => {
    const background = await solidColorImage(600, 800, { r: 100, g: 50, b: 150 });
    const buffer = await composeImage({
      backgroundBuffer: background,
      quoteText: "Stay the course.",
      author: "Anon",
      template: findTemplate("soft-curvy"),
      mode: "dark",
      suitability: busySuitability,
    });
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("produces different output for dark mode vs light mode on the same input (mode actually changes the render)", async () => {
    // grainRandom is held constant so this isolates the mode difference --
    // without it, any two composeImage() calls differ from grain noise
    // alone regardless of mode, which would make this test pass for the
    // wrong reason.
    const background = await solidColorImage(600, 800, { r: 128, g: 128, b: 128 });
    const dark = await composeImage({
      backgroundBuffer: background,
      quoteText: "Same quote, different mode.",
      template: findTemplate("bold-modern"),
      mode: "dark",
      suitability: calmSuitability,
      grainRandom: fixedRandom,
    });
    const light = await composeImage({
      backgroundBuffer: background,
      quoteText: "Same quote, different mode.",
      template: findTemplate("bold-modern"),
      mode: "light",
      suitability: calmSuitability,
      grainRandom: fixedRandom,
    });
    expect(dark.equals(light)).toBe(false);
  });

  it("smoke-tests all 10 templates: each composes without throwing, at the correct dimensions", async () => {
    // NOT asserting the 10 outputs are pixel-distinct from each other here.
    // Font-family selection in sharp/Pango's text renderer is a known,
    // documented open issue in this local dev environment (unrelated to
    // this codebase -- docs/LEARNINGS.md FR-003): different fontfile paths
    // currently render byte-identical glyph output locally, so an
    // all-different-bytes assertion would either be trivially satisfied by
    // grain-noise randomness (a false-positive test, which is worse than no
    // test) or fail for a reason this codebase can't control from here.
    // Genuine per-template visual distinctness is verified by the plan's
    // visual dry-run review step instead. This test still confirms every
    // template's specific font files load and every code path executes.
    const background = await solidColorImage(600, 800, { r: 90, g: 90, b: 90 });
    for (const template of TEMPLATES) {
      const buffer = await composeImage({
        backgroundBuffer: background,
        quoteText: "Consistency compounds.",
        author: "Someone",
        template,
        mode: "dark",
        suitability: calmSuitability,
      });
      const metadata = await sharp(buffer).metadata();
      expect(metadata.width, template.id).toBe(IMAGE_WIDTH);
      expect(metadata.height, template.id).toBe(IMAGE_HEIGHT);
    }
  }, 15000);

  it("handles a very long quote by auto-shrinking/truncating rather than throwing", async () => {
    const background = await solidColorImage(600, 800, { r: 10, g: 10, b: 10 });
    const longQuote =
      "This is a deliberately very long quote meant to exercise the auto-fit and truncation path of the text renderer so that we can confirm the compositor degrades gracefully instead of crashing when a quote is far too long for the available space in the card.";
    const buffer = await composeImage({
      backgroundBuffer: background,
      quoteText: longQuote,
      author: "Test Author",
      template: findTemplate("authentic-personal"),
      mode: "light",
      suitability: calmSuitability,
    });
    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(IMAGE_WIDTH);
  });
});
