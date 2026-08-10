import { describe, expect, it } from "vitest";
import { BANNED_HASHTAGS, isBannedHashtag } from "../../src/hashtags/banned-list.js";

describe("isBannedHashtag", () => {
  it("flags a known banned hashtag", () => {
    expect(isBannedHashtag("#single")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isBannedHashtag("#SINGLE")).toBe(true);
  });

  it("does not flag a clean hashtag", () => {
    expect(isBannedHashtag("#motivation")).toBe(false);
  });

  it("has at least one entry (configuration plane: not accidentally empty)", () => {
    expect(BANNED_HASHTAGS.length).toBeGreaterThan(0);
  });
});
