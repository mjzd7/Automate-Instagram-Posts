import { describe, expect, it } from "vitest";
import {
  SERIES_IDS,
  buildGenerationPrompt,
} from "../../src/multi-series/generation/prompts.js";

describe("buildGenerationPrompt", () => {
  it("supports every active series id", () => {
    expect([...SERIES_IDS].sort()).toEqual([
      "confession-cards",
      "fill-the-blank",
      "hook-lab",
      "mindset-manual",
      "season-reset",
      "villain-roasts",
    ]);
  });

  it.each([
    ["hook-lab", /12 words/i],
    ["confession-cards", /first.person/i],
    ["confession-cards", /90.*160|between 90 and 160/i],
    ["villain-roasts", /100 characters/i],
    ["fill-the-blank", /\{\{BLANK\}\}/],
    ["mindset-manual", /The \d-\d-\d/i],
    ["season-reset", /90.*160|between 90 and 160/i],
  ])("%s prompt embeds its hard constraint (%s)", (seriesId, pattern) => {
    expect(buildGenerationPrompt(seriesId, 0)).toMatch(pattern);
  });

  it("every prompt demands strict JSON output", () => {
    for (const seriesId of SERIES_IDS) {
      expect(buildGenerationPrompt(seriesId, 0)).toMatch(/JSON/i);
    }
  });

  it("rotates creative inputs by index (pain/villain/theme/archetype)", () => {
    const confessionA = buildGenerationPrompt("confession-cards", 0);
    const confessionB = buildGenerationPrompt("confession-cards", 1);
    expect(confessionA).not.toBe(confessionB);

    const hookA = buildGenerationPrompt("hook-lab", 0);
    const hookB = buildGenerationPrompt("hook-lab", 1);
    expect(hookA).not.toBe(hookB);
  });
});
