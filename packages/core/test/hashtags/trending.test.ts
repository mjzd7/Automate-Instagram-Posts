import { describe, expect, it, vi } from "vitest";
import { fetchTrendingHashtags, sanitizeHashtag } from "../../src/hashtags/trending.js";
import googleTrends from "google-trends-api";

// Mock the external dependency
vi.mock("google-trends-api", () => {
  return {
    default: {
      relatedQueries: vi.fn(),
    },
  };
});

describe("sanitizeHashtag", () => {
  it("removes spaces and special characters and converts to lowercase", () => {
    expect(sanitizeHashtag("Union Budget 2026")).toBe("#unionbudget2026");
    expect(sanitizeHashtag("Spider-Man: No Way Home!")).toBe("#spidermannowayhome");
    expect(sanitizeHashtag("India vs AUS")).toBe("#indiavsaus");
  });
});

describe("fetchTrendingHashtags", () => {
  it("fetches, parses, and sanitizes rising related queries into niche hashtags", async () => {
    vi.useFakeTimers();
    // Simulated JSON response from google-trends-api for relatedQueries
    const mockResponse = JSON.stringify({
      default: {
        rankedList: [
          { // Top queries
            rankedKeyword: [
              { query: "Top Query 1", value: 100 },
            ]
          },
          { // Rising queries
            rankedKeyword: [
              { query: "Rising Query 1", value: 100 },
              { query: "Rising Query 2", value: 50 },
            ]
          }
        ],
      },
    });

    vi.mocked(googleTrends.relatedQueries).mockResolvedValue(mockResponse);

    const promise = fetchTrendingHashtags("IN");
    await vi.runAllTimersAsync();
    const result = await promise;

    // It loops through ["motivation", "success", "business"] so it should have been called 3 times
    expect(googleTrends.relatedQueries).toHaveBeenCalledTimes(3);
    expect(googleTrends.relatedQueries).toHaveBeenCalledWith({ keyword: "motivation", geo: "IN" });

    // 3 keywords * 3 queries each = 9 queries total (actually due to de-duplication and our specific mock, 
    // it will just output duplicates since the mock returns the same array for all 3 calls.
    // The unique set will just be 3 strings.)
    vi.useRealTimers();
    expect(result).toEqual([
      "#risingquery1",
      "#risingquery2",
      "#topquery1",
    ]);
  });
});
