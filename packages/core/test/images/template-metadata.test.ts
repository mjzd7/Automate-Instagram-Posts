import { describe, expect, it } from "vitest";
import { TEMPLATE_METADATA } from "../../src/images/template-metadata.js";
import { TEMPLATES } from "../../src/images/templates.js";

// template-metadata.ts is a standalone hand-maintained duplicate of
// TEMPLATES' id/name/categories (see its own header comment / FR-006 for
// why it can't just import from templates.ts). This test is the guard
// against the two silently drifting apart.
describe("TEMPLATE_METADATA stays in sync with TEMPLATES", () => {
  it("has the same length as TEMPLATES", () => {
    expect(TEMPLATE_METADATA).toHaveLength(TEMPLATES.length);
  });

  it("matches id/name/categories for every template, in the same order", () => {
    const expected = TEMPLATES.map(({ id, name, categories }) => ({ id, name, categories }));
    expect(TEMPLATE_METADATA).toEqual(expected);
  });
});
