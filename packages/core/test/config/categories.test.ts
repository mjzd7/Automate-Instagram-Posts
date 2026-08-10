import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCategories, parseCategories } from "../../src/config/categories.js";

const fixturePath = fileURLToPath(new URL("../fixtures/categories.sample.json", import.meta.url));

function validCategory(overrides: Record<string, unknown> = {}) {
  return { id: "motivational", name: "Motivational", description: "General encouragement and drive", active: true, ...overrides };
}

describe("parseCategories", () => {
  it("accepts a valid categories array", () => {
    const categories = parseCategories([validCategory()]);
    expect(categories).toHaveLength(1);
    expect(categories[0]?.id).toBe("motivational");
  });

  it("accepts a missing description (optional field)", () => {
    const { description, ...withoutDescription } = validCategory();
    const categories = parseCategories([withoutDescription]);
    expect(categories[0]?.description).toBeUndefined();
  });

  it("rejects an empty id (input validation plane)", () => {
    expect(() => parseCategories([validCategory({ id: "" })])).toThrow(/id/);
  });

  it("rejects a non-array top-level value (input validation plane: wrong type)", () => {
    expect(() => parseCategories(validCategory())).toThrow();
  });
});

describe("loadCategories", () => {
  it("reads and parses a real categories.json fixture from disk", async () => {
    const categories = await loadCategories(fixturePath);
    expect(categories).toHaveLength(1);
    expect(categories[0]?.name).toBe("Motivational");
  });

  it("rejects a missing file with a clear error (external deps plane: filesystem failure)", async () => {
    await expect(loadCategories("/nonexistent/path/categories.json")).rejects.toThrow();
  });
});
