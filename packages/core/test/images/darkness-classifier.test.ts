import { describe, expect, it } from "vitest";
import { classifyDarkness } from "../../src/images/darkness-classifier.js";
import { checkerboardImage, solidColorImage, verticalSplitImage } from "./fixtures.js";

const nearBlack = { r: 5, g: 5, b: 5 };
const nearWhite = { r: 250, g: 250, b: 250 };

describe("classifyDarkness", () => {
  it("classifies a solid black image as dark (edge case: uniform extreme)", async () => {
    const img = await solidColorImage(200, 200, { r: 0, g: 0, b: 0 });
    await expect(classifyDarkness(img)).resolves.toBe("dark");
  });

  it("classifies a solid white image as light (edge case: uniform extreme)", async () => {
    const img = await solidColorImage(200, 200, { r: 255, g: 255, b: 255 });
    await expect(classifyDarkness(img)).resolves.toBe("light");
  });

  it("classifies a 70% dark / 30% light image as dark -- above the 60% threshold", async () => {
    const img = await verticalSplitImage(200, 200, nearBlack, nearWhite, 0.7);
    await expect(classifyDarkness(img)).resolves.toBe("dark");
  });

  it("classifies a 30% dark / 70% light image as light -- below the 60% threshold", async () => {
    const img = await verticalSplitImage(200, 200, nearBlack, nearWhite, 0.3);
    await expect(classifyDarkness(img)).resolves.toBe("light");
  });

  it("handles a high-frequency checkerboard without throwing (resources plane: extraction on non-uniform input)", async () => {
    const img = await checkerboardImage(200, 200, 4);
    const result = await classifyDarkness(img);
    expect(["dark", "light"]).toContain(result);
  });
});
