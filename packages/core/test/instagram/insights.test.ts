import { describe, expect, it, vi } from "vitest";
import { fetchAccountOverview, fetchReachForPosts, summarizePosts } from "../../src/instagram/insights.js";

function jsonFetch(payloads: Array<Record<string, unknown>>): typeof fetch {
  let call = 0;
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => payloads[Math.min(call++, payloads.length - 1)],
  })) as unknown as typeof fetch;
}

describe("fetchAccountOverview", () => {
  it("shapes profile + media into typed rows", async () => {
    const overview = await fetchAccountOverview("tok", "178414", jsonFetch([
      { followers_count: 1234, media_count: 56 },
      { data: [
        { id: "m1", media_type: "IMAGE", timestamp: "2026-08-01T00:00:00Z", like_count: 10, comments_count: 2, permalink: "u" },
        { id: "m2", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-08-02T00:00:00Z" },
      ] },
    ]));
    expect(overview.followersCount).toBe(1234);
    expect(overview.posts).toHaveLength(2);
    expect(overview.posts[1]?.likeCount).toBe(0);
    expect(overview.posts[1]?.mediaProductType).toBe("REELS");
  });

  it("surfaces Graph errors with their message", async () => {
    const failing = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: "(#3) App must have read_insights" } }),
    })) as unknown as typeof fetch;
    await expect(fetchAccountOverview("tok", "id", failing)).rejects.toThrow(/read_insights/);
  });
});

describe("fetchReachForPosts", () => {
  it("maps successful insight rows and nulls out failures", async () => {
    const responses = [
      { data: [{ name: "reach", values: [{ value: 4321 }] }] },
      { error: { message: "(#3) read_insights required" } },
    ];
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      const payload = responses[Math.min(call++, responses.length - 1)];
      return { ok: !("error" in payload), status: payload.error ? 403 : 200, json: async () => payload };
    }) as unknown as typeof fetch;
    const map = await fetchReachForPosts("tok", [{ id: "m1" }, { id: "m2" }], fetchImpl);
    expect(map).toEqual({ m1: 4321, m2: null });
  });

  it("returns an empty map for no posts", async () => {
    expect(await fetchReachForPosts("tok", [])).toEqual({});
  });
});

describe("summarizePosts", () => {
  it("aggregates totals and rounded averages", () => {
    const summary = summarizePosts([
      { likeCount: 10, commentsCount: 5 },
      { likeCount: 21, commentsCount: 1 },
    ]);
    expect(summary).toEqual({ totalLikes: 31, totalComments: 6, avgLikes: 16, avgComments: 3 });
  });

  it("handles empty input", () => {
    expect(summarizePosts([])).toEqual({ totalLikes: 0, totalComments: 0, avgLikes: 0, avgComments: 0 });
  });
});
