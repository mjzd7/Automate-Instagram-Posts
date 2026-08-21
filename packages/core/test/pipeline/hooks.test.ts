import { describe, expect, it } from "vitest";
import { generateReelHook } from "../../src/pipeline/hooks.js";

describe("generateReelHook", () => {
  it("generates an author-specific hook when known author matches", () => {
    const hook = generateReelHook("stoic", "Marcus Aurelius");
    expect(typeof hook).toBe("string");
    expect(hook.length).toBeGreaterThan(10);
    expect(hook.endsWith(":")).toBe(true);
  });

  it("generates category-specific hook when author is generic or null", () => {
    const hook = generateReelHook("wealth", null);
    expect(typeof hook).toBe("string");
    expect(hook.length).toBeGreaterThan(10);
  });

  it("falls back to general hook for unknown category and null author", () => {
    const hook = generateReelHook("unknown-cat-xyz", null);
    expect(typeof hook).toBe("string");
    expect(hook.length).toBeGreaterThan(5);
  });
});
