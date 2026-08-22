import { loadEnv } from "../config/env.js";
import { extractVisualConcepts } from "../matching/visual-concept-extractor.js";
import type { VideoResult } from "./video-fetcher.js";

interface PixabayFormat {
  url: string;
  width: number;
  height: number;
}

interface PixabayHit {
  duration: number;
  videos?: Record<string, PixabayFormat | undefined>;
}

interface PixabaySearchResponse {
  hits?: PixabayHit[];
}

// Pixabay caps portrait files well below 4K; prefer quality in this order.
const FORMAT_PREFERENCE = ["large", "medium", "small", "tiny"] as const;

/**
 * Free fallback video source (Pixabay Videos API) with the same contract as
 * fetchPexelsVideo: rejection-aware candidate pool and query-ladder
 * fall-through when a pool empties.
 */
export async function fetchPixabayVideo(
  category: string,
  mode: "dark" | "light" = "dark",
  quoteText?: string,
  excludeUrls: ReadonlySet<string> = new Set(),
): Promise<VideoResult | null> {
  const env = loadEnv();
  if (!env.PIXABAY_API_KEY) {
    console.warn("PIXABAY_API_KEY not set. Skipping Pixabay video fetch.");
    return null;
  }

  const baseQueries = quoteText
    ? await extractVisualConcepts(quoteText, category, env.GEMINI_API_KEY)
    : [category];
  const fallbackQueries = [category, "minimalist nature", "landscape cinematic", "modern architecture", "dark abstract", "cinematic atmosphere"];
  const visualQueries = [...new Set([...baseQueries, ...fallbackQueries])];

  for (const baseQuery of visualQueries) {
    const modeModifier = mode === "light" ? "bright light white minimal" : "dark moody black night";
    const searchQueries = [
      `${baseQuery} ${modeModifier} no people`,
      `${baseQuery} minimalist landscape`,
      `${modeModifier} abstract loop`,
    ];

    for (const query of searchQueries) {
      console.log(`Querying Pixabay Videos: "${query}"`);
      const url = new URL("https://pixabay.com/api/videos/");
      url.searchParams.set("key", env.PIXABAY_API_KEY);
      url.searchParams.set("q", query);
      url.searchParams.set("orientation", "vertical");
      url.searchParams.set("safesearch", "true");
      url.searchParams.set("per_page", "15");

      try {
        const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
        if (!response.ok) continue;

        const data = await response.json() as PixabaySearchResponse;
        if (!data.hits || data.hits.length === 0) continue;

        // Excluded links shrink the pool; an emptied pool falls through to
        // the next query so rejected candidates are never re-drawn.
        const candidates = data.hits.flatMap((hit) => {
          for (const size of FORMAT_PREFERENCE) {
            const format = hit.videos?.[size];
            if (format?.url && !excludeUrls.has(format.url)) {
              return [{ url: format.url, width: format.width, height: format.height, duration: hit.duration }];
            }
          }
          return [];
        });

        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        if (picked) {
          console.log(`Matched Pixabay HD video on query: "${query}"`);
          return picked;
        }
      } catch (error) {
        console.error("Failed to fetch Pixabay video:", error);
      }
    }
  }

  return null;
}
