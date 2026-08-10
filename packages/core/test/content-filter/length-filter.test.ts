import { describe, expect, it } from "vitest";
import { isIdealQuoteLength, quoteLengthPassesFilter, wordCount } from "../../src/content-filter/length-filter.js";

describe("wordCount", () => {
  it("counts words separated by single spaces", () => {
    expect(wordCount("The only way out is through.")).toBe(6);
  });

  it("collapses multiple whitespace when counting (edge case)", () => {
    expect(wordCount("one   two\tthree\nfour")).toBe(4);
  });

  it("returns 0 for empty or whitespace-only text (edge case)", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   ")).toBe(0);
  });
});

describe("quoteLengthPassesFilter", () => {
  it("passes a quote at exactly the default 22-word cap (boundary)", () => {
    const quote = Array.from({ length: 22 }, (_, i) => `word${i}`).join(" ");
    expect(quoteLengthPassesFilter(quote)).toBe(true);
  });

  it("rejects a quote one word over the default cap (boundary)", () => {
    const quote = Array.from({ length: 23 }, (_, i) => `word${i}`).join(" ");
    expect(quoteLengthPassesFilter(quote)).toBe(false);
  });

  it("passes a short quote", () => {
    expect(quoteLengthPassesFilter("Discipline beats motivation.")).toBe(true);
  });

  it("respects a custom maxWords override", () => {
    expect(quoteLengthPassesFilter("one two three", 2)).toBe(false);
    expect(quoteLengthPassesFilter("one two", 2)).toBe(true);
  });
});

describe("isIdealQuoteLength", () => {
  it("is true for a quote within the 8-18 word sweet spot", () => {
    const quote = Array.from({ length: 12 }, (_, i) => `word${i}`).join(" ");
    expect(isIdealQuoteLength(quote)).toBe(true);
  });

  it("is false for a quote shorter than the sweet spot", () => {
    expect(isIdealQuoteLength("Stay strong.")).toBe(false);
  });

  it("is false for a quote longer than the sweet spot but still under the hard cap", () => {
    const quote = Array.from({ length: 22 }, (_, i) => `word${i}`).join(" ");
    expect(isIdealQuoteLength(quote)).toBe(false);
    expect(quoteLengthPassesFilter(quote)).toBe(true);
  });
});
