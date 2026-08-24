import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  SERIES_TEMPLATES,
  assertSeriesFontsExist,
  findSeriesTemplate,
  layoutZones,
} from "../../src/multi-series/images/registry.js";
import { hasGapToken, replaceGapToken } from "../../src/multi-series/images/gap-token.js";
import { IMAGE_HEIGHT, IMAGE_WIDTH } from "../../src/images/constants.js";

describe("findSeriesTemplate", () => {
  it("resolves every templateId referenced by the real data/series.json", async () => {
    const seriesJsonPath = fileURLToPath(new URL("../../../../data/series.json", import.meta.url));
    const series = JSON.parse(await readFile(seriesJsonPath, "utf-8")) as Array<{
      templateIds: string[];
    }>;
    const referencedIds = new Set(series.flatMap((s) => s.templateIds));
    expect(referencedIds.size).toBeGreaterThan(0);
    for (const id of referencedIds) {
      expect(() => findSeriesTemplate(id)).not.toThrow();
    }
  });

  it("covers the full planned set of 7 layout templates", () => {
    expect(SERIES_TEMPLATES.map((t) => t.id).sort()).toEqual(
      [
        "confession-card",
        "framework-carousel",
        "framework-mini",
        "gap-line",
        "hook-cover",
        "identity-badge",
        "roast-footer",
      ].sort(),
    );
  });

  it("throws on an unknown id, listing known ids (loud failure over silent fallback)", () => {
    expect(() => findSeriesTemplate("nonexistent")).toThrow(/nonexistent.*hook-cover/s);
  });

  it("marks only identity-badge as Story-safe", () => {
    const safe = SERIES_TEMPLATES.filter((t) => t.storySafe).map((t) => t.id);
    expect(safe).toEqual(["identity-badge"]);
  });

  it("every template reuses verified shared-pipeline font faces", () => {
    expect(() => assertSeriesFontsExist()).not.toThrow();
  });
});

describe("layoutZones", () => {
  it("puts hook-cover primary text in the top band (hook-as-cover-text contract)", () => {
    const zones = layoutZones("hook-cover");
    expect(zones.primary.top).toBeLessThan(IMAGE_HEIGHT * 0.2);
    expect(zones.primary.top + zones.primary.height).toBeLessThanOrEqual(IMAGE_HEIGHT * 0.55);
  });

  it("gives roast-footer a distinct CTA band near the bottom", () => {
    const zones = layoutZones("roast-footer");
    expect(zones.footer).toBeDefined();
    expect(zones.footer!.top).toBeGreaterThan(IMAGE_HEIGHT * 0.8);
  });

  it("keeps framework layouts out of a fixed top band (content is structured, not zoned)", () => {
    const carousel = layoutZones("framework-carousel");
    expect(carousel.primary.top).toBeGreaterThanOrEqual(IMAGE_HEIGHT * 0.15);
  });

  it("all zones stay inside the 1080x1350 frame", () => {
    for (const template of SERIES_TEMPLATES) {
      const zones = layoutZones(template.layout);
      expect(zones.primary.left).toBeGreaterThanOrEqual(0);
      expect(zones.primary.width).toBeLessThanOrEqual(IMAGE_WIDTH);
      expect(zones.primary.top + zones.primary.height).toBeLessThanOrEqual(IMAGE_HEIGHT);
      if (zones.footer) {
        expect(zones.footer.top + zones.footer.height).toBeLessThanOrEqual(IMAGE_HEIGHT);
      }
    }
  });
});

describe("gap token handling (fill-the-blank)", () => {
  it("detects the {{BLANK}} token", () => {
    expect(hasGapToken("Success is 10% talent and 90% {{BLANK}}")).toBe(true);
    expect(hasGapToken("No gap here")).toBe(false);
  });

  it("replaces the token with an underscore run sized for rendering", () => {
    const rendered = replaceGapToken("You need more {{BLANK}}.");
    expect(rendered).not.toContain("{{BLANK}}");
    expect(rendered).toMatch(/_{3,}/);
    expect(rendered.endsWith(".")).toBe(true);
  });

  it("leaves gap-free text untouched", () => {
    expect(replaceGapToken("Plain sentence.")).toBe("Plain sentence.");
  });
});
