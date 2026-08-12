import { describe, expect, it } from "vitest";
import { HASHTAG_SET_SIZE, selectHashtags, type HashtagPools } from "../../src/hashtags/selector.js";

const pools: HashtagPools = {
  trending: ["#trend1", "#trend2", "#trend3", "#trend4", "#trend5"],
  motivational: Array.from({ length: 20 }, (_, i) => `#motivational${i}`),
  general: Array.from({ length: 20 }, (_, i) => `#general${i}`),
};

describe("selectHashtags", () => {
  it("returns exactly HASHTAG_SET_SIZE tags matching the 1 success, 3 trending, 1 category distribution", () => {
    const result = selectHashtags("motivational", pools);
    expect(result).toHaveLength(HASHTAG_SET_SIZE);
    expect(result).toContain("#successforsure");
    
    const trendingSelected = result.filter(tag => tag.startsWith("#trend"));
    expect(trendingSelected.length).toBe(3);
    
    const categorySelected = result.filter(tag => tag.startsWith("#motivational"));
    expect(categorySelected.length).toBe(1);
  });

  it("never returns duplicate tags", () => {
    const result = selectHashtags("motivational", pools);
    expect(new Set(result).size).toBe(result.length);
  });

  it("drops a banned tag and does not include it in the result", () => {
    const smallPool: HashtagPools = { 
      trending: ["#trend1", "#banned1", "#trend2", "#trend3"],
      cat: ["#clean1"], general: [] 
    };
    const result = selectHashtags("cat", smallPool, 5, (tag) => tag === "#banned1");
    expect(result).not.toContain("#banned1");
    expect(result).toHaveLength(5);
  });

  it("tops up from the category and general pools when trending is too small", () => {
    const smallPool: HashtagPools = { 
      trending: ["#trend1"], 
      cat: ["#only-one", "#second-cat"], 
      general: ["#g1", "#g2", "#g3"] 
    };
    const result = selectHashtags("cat", smallPool, 5);
    expect(result).toHaveLength(5);
    expect(result).toContain("#successforsure");
    expect(result).toContain("#trend1");
    // Should have filled the rest from cat and general
  });

  it("returns fewer than the requested size (not an error) when all pools are exhausted", () => {
    const tinyPool: HashtagPools = { cat: ["#a"], general: ["#b"] };
    const result = selectHashtags("cat", tinyPool, 10);
    // 1 success + 1 from cat + 1 from general = 3
    expect(result).toHaveLength(3);
  });

  it("never includes a hashtag from the real BANNED_HASHTAGS list when using the default checker", () => {
    const poolWithBanned: HashtagPools = {
      trending: ["#teens"],
      cat: ["#clean1", "#single", "#clean2"],
      general: [],
    };
    const result = selectHashtags("cat", poolWithBanned, 10);
    expect(result).not.toContain("#single");
    expect(result).not.toContain("#teens");
  });
});
