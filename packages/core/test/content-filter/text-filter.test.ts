import { describe, expect, it } from "vitest";
import { textPassesFilter } from "../../src/content-filter/text-filter.js";

describe("textPassesFilter", () => {
  it("passes clean text", () => {
    expect(textPassesFilter("The only way out is through.")).toBe(true);
  });

  it("rejects text containing a flagged term", () => {
    expect(textPassesFilter("This is such bullshit, but I don't care", ["bullshit"])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(textPassesFilter("BULLSHIT everywhere", ["bullshit"])).toBe(false);
  });

  it("does not false-positive on a word that merely contains a flagged substring (word-boundary plane)", () => {
    // "class" contains "ass" but must not be flagged when matching a
    // shorter flagged term as a whole word.
    expect(textPassesFilter("Take the class seriously.", ["ass"])).toBe(true);
  });

  it("does flag the flagged term when it appears as its own word", () => {
    expect(textPassesFilter("You are an ass.", ["ass"])).toBe(false);
  });

  it("treats an empty wordlist as always-passing (edge case: empty)", () => {
    expect(textPassesFilter("literally anything", [])).toBe(true);
  });

  it("handles empty input text without throwing (edge case: empty)", () => {
    expect(textPassesFilter("")).toBe(true);
  });

  it("escapes regex special characters in wordlist entries safely (security plane: no ReDoS/injection via config)", () => {
    expect(() => textPassesFilter("price is $5 (on sale)", ["$5 (on"])).not.toThrow();
  });

  it("uses the bundled default wordlist when none is passed", () => {
    expect(textPassesFilter("this text contains the word shit in it")).toBe(false);
  });

  it("rejects religious honorifics like (R.A), (R.A.), (PBUH), and (S.A.W)", () => {
    expect(textPassesFilter("The days of life pass away like clouds — Ali ibn Abi Talib (R.A)")).toBe(false);
    expect(textPassesFilter("When knowledge is limited it leads to folly — Abu Bakr (R.A)")).toBe(false);
    expect(textPassesFilter("Wisdom is the lost property of the believer (PBUH)")).toBe(false);
  });
});
