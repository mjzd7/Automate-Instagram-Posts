import googleTrends from "google-trends-api";
import { type RelatedQueriesObject } from "./../types/google-trends-api.js";

export function sanitizeHashtag(query: string): string {
  const clean = query.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `#${clean}`;
}

export async function fetchTrendingHashtags(geo: string = "IN"): Promise<string[]> {
  // Use niche-relevant keywords to find related rising trends, rather than random general news.
  const keywords = ["motivation", "success", "business"];
  
  const allQueries: string[] = [];
  
  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    
    let agent;
    if (process.env.PROXY_URL) {
      const { HttpsProxyAgent } = await import("https-proxy-agent");
      agent = new HttpsProxyAgent(process.env.PROXY_URL);
    }
    
    const resString = await googleTrends.relatedQueries({ keyword, geo, agent });
    const res = JSON.parse(resString) as RelatedQueriesObject;
    
    // rankedList[0] contains "Top" queries, rankedList[1] contains "Rising" queries
    const risingQueries = res.default.rankedList[1]?.rankedKeyword ?? [];
    const topQueries = res.default.rankedList[0]?.rankedKeyword ?? [];
    
    // Prefer rising queries (fastest growing), fallback to top queries
    const combined = [...risingQueries, ...topQueries].map(k => k.query);
    allQueries.push(...combined);
    
    if (i < keywords.length - 1) {
      // 5-10 second random delay to avoid rate limiting
      const delay = Math.floor(5000 + Math.random() * 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  if (allQueries.length === 0) {
    throw new Error("No related trending searches found from Google Trends.");
  }
  
  // Deduplicate and take top 10 to feed into the generic trending pool
  const uniqueQueries = [...new Set(allQueries)];
  const queries = uniqueQueries.slice(0, 10);
  return queries.map(sanitizeHashtag);
}
