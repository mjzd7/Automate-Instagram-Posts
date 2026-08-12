import googleTrends from "google-trends-api";
import { type DailyTrendsObject } from "./../types/google-trends-api.js";

export function sanitizeHashtag(query: string): string {
  const clean = query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `#${clean}`;
}

export async function fetchTrendingHashtags(geo: string = "IN"): Promise<string[]> {
  const resString = await googleTrends.dailyTrends({ geo });
  const res = JSON.parse(resString) as DailyTrendsObject;
  
  // Google Trends might not have data for the exact current day early in the morning.
  // We fall back to the previous day's data if today is empty.
  const todayTrends = res.default.trendingSearchesDays[0]?.trendingSearches ?? [];
  const yesterdayTrends = res.default.trendingSearchesDays[1]?.trendingSearches ?? [];
  
  const allTrends = [...todayTrends, ...yesterdayTrends];
  
  if (allTrends.length === 0) {
    throw new Error("No trending searches found from Google Trends.");
  }
  
  const queries = allTrends.slice(0, 5).map(t => t.title.query);
  return queries.map(sanitizeHashtag);
}
