import { describe, expect, it, vi } from "vitest";
import { fetchTrendingHashtags, sanitizeHashtag } from "../../src/hashtags/trending.js";
import googleTrends from "google-trends-api";

// Mock the external dependency
vi.mock("google-trends-api", () => {
  return {
    default: {
      dailyTrends: vi.fn(),
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
  it("fetches, parses, and sanitizes the top 5 trending topics into hashtags", async () => {
    // Simulated JSON response from google-trends-api
    const mockResponse = JSON.stringify({
      default: {
        trendingSearchesDays: [
          {
            date: "2026-08-12",
            trendingSearches: [
              { title: { query: "Stock Market Crash" } },
              { title: { query: "Chandrayaan 4" } },
              { title: { query: "Olympics 2026" } },
              { title: { query: "Tech News" } },
              { title: { query: "AI Developments" } },
              { title: { query: "Should be ignored (6th item)" } },
            ],
          },
        ],
      },
    });

    vi.mocked(googleTrends.dailyTrends).mockResolvedValueOnce(mockResponse);

    const result = await fetchTrendingHashtags("IN");

    // Assert that it called the API with the right region
    expect(googleTrends.dailyTrends).toHaveBeenCalledWith({ geo: "IN" });

    // Assert the output is exactly 5 sanitized hashtags
    expect(result).toHaveLength(5);
    expect(result).toEqual([
      "#stockmarketcrash",
      "#chandrayaan4",
      "#olympics2026",
      "#technews",
      "#aidevelopments",
    ]);
  });

  it("falls back to yesterday's trends if today's trends array is empty", async () => {
    const mockResponse = JSON.stringify({
      default: {
        trendingSearchesDays: [
          {
            date: "2026-08-12",
            trendingSearches: [], // Today is empty (e.g., early morning)
          },
          {
            date: "2026-08-11",
            trendingSearches: [
              { title: { query: "Yesterday Trend 1" } },
              { title: { query: "Yesterday Trend 2" } },
            ],
          },
        ],
      },
    });

    vi.mocked(googleTrends.dailyTrends).mockResolvedValueOnce(mockResponse);

    const result = await fetchTrendingHashtags("IN");
    expect(result).toEqual([
      "#yesterdaytrend1",
      "#yesterdaytrend2",
    ]);
  });
});
