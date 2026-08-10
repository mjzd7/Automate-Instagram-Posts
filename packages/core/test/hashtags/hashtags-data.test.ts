import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isBannedHashtag } from "../../src/hashtags/banned-list.js";
import { HASHTAG_SET_SIZE, selectHashtags, type HashtagPools } from "../../src/hashtags/selector.js";

const dataPath = fileURLToPath(new URL("../../../../data/hashtags.json", import.meta.url));
const pools: HashtagPools = JSON.parse(readFileSync(dataPath, "utf-8"));

describe("data/hashtags.json (real committed pool)", () => {
  it("contains a general fallback pool", () => {
    expect(pools.general).toBeDefined();
    expect(pools.general!.length).toBeGreaterThan(0);
  });

  it("contains no banned hashtags in any category (regression guard for the committed data file)", () => {
    for (const [category, tags] of Object.entries(pools)) {
      for (const tag of tags) {
        expect(isBannedHashtag(tag), `${category} contains banned tag ${tag}`).toBe(false);
      }
    }
  });

  it("every category has enough tags (combined with general) to fill a full HASHTAG_SET_SIZE selection", () => {
    for (const category of Object.keys(pools)) {
      if (category === "general") continue;
      const result = selectHashtags(category, pools);
      expect(result.length, `category ${category} produced too few tags`).toBe(HASHTAG_SET_SIZE);
    }
  });

  it("every hashtag starts with # (configuration plane: well-formed data)", () => {
    for (const tags of Object.values(pools)) {
      for (const tag of tags) {
        expect(tag.startsWith("#")).toBe(true);
      }
    }
  });
});
