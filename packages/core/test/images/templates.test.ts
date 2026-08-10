import { describe, expect, it } from "vitest";
import { assertFontFilesExist, findTemplate, selectTemplate, TEMPLATES } from "../../src/images/templates.js";

describe("TEMPLATES", () => {
  it("defines exactly 10 templates", () => {
    expect(TEMPLATES).toHaveLength(10);
  });

  it("gives every template a distinct quote font family", () => {
    const families = TEMPLATES.map((t) => t.quoteFont.family);
    expect(new Set(families).size).toBe(10);
  });

  it("gives every template a distinct id", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(10);
  });

  it("covers all 8 established categories with exactly one primary template each", () => {
    const categories = [
      "motivational",
      "stoic",
      "humor",
      "love",
      "business",
      "wisdom",
      "mindfulness",
      "resilience",
    ];
    for (const category of categories) {
      const matches = TEMPLATES.filter((t) => t.categories.includes(category));
      expect(matches, `category "${category}"`).toHaveLength(1);
    }
  });

  it("has exactly 2 general-purpose templates (no category tags)", () => {
    const general = TEMPLATES.filter((t) => t.categories.length === 0);
    expect(general).toHaveLength(2);
  });
});

describe("findTemplate", () => {
  it("finds a template by id", () => {
    expect(findTemplate("bold-modern").name).toBe("Bold / Modern");
  });

  it("throws a clear error listing known ids for an unknown template", () => {
    expect(() => findTemplate("nonexistent")).toThrow(/bold-modern/);
  });
});

describe("selectTemplate", () => {
  it("picks the category's primary template when the random draw is below generalRatio's complement", () => {
    // random() always returns 0.9 -> useGeneral check (0.9 < 0.25) is false, so it stays in the category pool.
    const result = selectTemplate("motivational", undefined, 0.25, () => 0.9);
    expect(result.id).toBe("bold-modern");
  });

  it("picks a general template when the random draw falls under generalRatio", () => {
    // First call: random()=0.1 triggers useGeneral (0.1 < 0.25); second random() call picks the index.
    const result = selectTemplate("motivational", undefined, 0.25, () => 0.1);
    expect(["general-poppins", "general-cormorant"]).toContain(result.id);
  });

  it("never repeats the immediately-previous template back-to-back for a category with only one primary match", () => {
    // Force useGeneral=true so we're choosing among the 2 general templates, previous=general-poppins.
    const result = selectTemplate("motivational", "general-poppins", 1, () => 0);
    expect(result.id).not.toBe("general-poppins");
  });

  it("falls back to the general pool for a category with no primary template match", () => {
    const result = selectTemplate("nonexistent-category", undefined, 0, () => 0);
    expect(["general-poppins", "general-cormorant"]).toContain(result.id);
  });

  it("is deterministic given a fixed random function (no hidden state)", () => {
    const a = selectTemplate("stoic", undefined, 0.25, () => 0.9);
    const b = selectTemplate("stoic", undefined, 0.25, () => 0.9);
    expect(a.id).toBe(b.id);
  });
});

describe("assertFontFilesExist", () => {
  it("does not throw when all 10 templates' real font files are present (regression guard for the committed assets)", () => {
    expect(() => assertFontFilesExist()).not.toThrow();
  });
});
