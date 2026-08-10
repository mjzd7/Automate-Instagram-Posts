import { describe, expect, it } from "vitest";
import { HASHTAG_SET_SIZE, selectHashtags, type HashtagPools } from "../../src/hashtags/selector.js";

const pools: HashtagPools = {
  motivational: Array.from({ length: 20 }, (_, i) => `#motivational${i}`),
  general: Array.from({ length: 20 }, (_, i) => `#general${i}`),
};

describe("selectHashtags", () => {
  it("returns exactly HASHTAG_SET_SIZE tags when the category pool has enough clean tags", () => {
    const result = selectHashtags("motivational", pools);
    expect(result).toHaveLength(HASHTAG_SET_SIZE);
  });

  it("only returns tags from the requested category's pool when it has enough", () => {
    const result = selectHashtags("motivational", pools);
    for (const tag of result) {
      expect(tag.startsWith("#motivational")).toBe(true);
    }
  });

  it("never returns duplicate tags", () => {
    const result = selectHashtags("motivational", pools);
    expect(new Set(result).size).toBe(result.length);
  });

  it("drops a banned tag and does not include it in the result", () => {
    const smallPool: HashtagPools = { cat: ["#clean1", "#banned1", "#clean2"], general: [] };
    const result = selectHashtags("cat", smallPool, 3, (tag) => tag === "#banned1");
    expect(result).not.toContain("#banned1");
    expect(result).toEqual(expect.arrayContaining(["#clean1", "#clean2"]));
  });

  it("tops up from the general pool when the category pool is too small", () => {
    const smallPool: HashtagPools = { cat: ["#only-one"], general: ["#g1", "#g2", "#g3"] };
    const result = selectHashtags("cat", smallPool, 3);
    expect(result).toHaveLength(3);
    expect(result).toContain("#only-one");
  });

  it("returns fewer than the requested size (not an error) when both pools are exhausted", () => {
    const tinyPool: HashtagPools = { cat: ["#a"], general: ["#b"] };
    const result = selectHashtags("cat", tinyPool, 10);
    expect(result).toHaveLength(2);
  });

  it("returns an empty array for an unknown category with an empty general pool (edge case: empty)", () => {
    const result = selectHashtags("nonexistent", { general: [] });
    expect(result).toEqual([]);
  });

  it("never includes a hashtag from the real BANNED_HASHTAGS list when using the default checker", () => {
    const poolWithBanned: HashtagPools = {
      cat: ["#clean1", "#single", "#clean2", "#teens"],
      general: [],
    };
    const result = selectHashtags("cat", poolWithBanned, 10);
    expect(result).not.toContain("#single");
    expect(result).not.toContain("#teens");
  });
});
