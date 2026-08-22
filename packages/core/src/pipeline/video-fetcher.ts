import { loadEnv } from "../config/env.js";
import { extractVisualConcepts } from "../matching/visual-concept-extractor.js";

interface VideoResult {
  url: string;
  width: number;
  height: number;
  duration: number; // in seconds
}

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
}

interface PexelsVideo {
  duration: number;
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos?: PexelsVideo[];
}

export async function fetchPexelsVideo(
  category: string,
  mode: "dark" | "light" = "dark",
  quoteText?: string,
  excludeUrls: ReadonlySet<string> = new Set(),
): Promise<VideoResult | null> {
  const env = loadEnv();
  if (!env.PEXELS_API_KEY) {
    console.warn("PEXELS_API_KEY not set. Skipping Pexels video fetch.");
    return null;
  }

  // 1. Semantically extract base visual queries from the quote using Gemini
  const baseQueries = quoteText
    ? await extractVisualConcepts(quoteText, category, env.GEMINI_API_KEY)
    : [category];

  // 2. Append hardcoded fallback queries just in case LLM returns narrow results
  const fallbackQueries = [category, "minimalist nature", "landscape cinematic", "modern architecture", "dark abstract", "cinematic atmosphere"];
  const visualQueries = [...new Set([...baseQueries, ...fallbackQueries])];

  console.log(`Extracted semantic video concepts for "${category}":`, baseQueries);

  // 3. Search Loop
  for (const baseQuery of visualQueries) {
    // Append strict light/dark mode modifiers + the "faceless" constraint
    const modeModifier = mode === "light" 
      ? "bright light white minimal" 
      : "dark moody black night";
      
    // Try combining base query + mode + human-free constraints
    const searchQueries = [
      `${baseQuery} ${modeModifier} no people`,
      `${baseQuery} minimalist landscape`,
      `${modeModifier} abstract loop`
    ];

    for (const query of searchQueries) {
      console.log(`Querying Pexels Videos: "${query}"`);
      const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=large&per_page=15`;
      
      try {
        const response = await fetch(url, {
          headers: { "Authorization": env.PEXELS_API_KEY }
        });
        if (!response.ok) continue;
        
        const data = await response.json() as PexelsSearchResponse;
        if (!data.videos || data.videos.length === 0) continue;

        // Excluded links shrink the pool; an emptied pool falls through to
        // the next query so rejected candidates are never re-drawn.
        const candidates = data.videos.flatMap((video) => {
          const best4KPortrait = [...video.video_files]
            .filter((f) => f.height > f.width && (f.width >= 2160 || f.height >= 3840)) // Enforce 4K only (e.g. 2160x3840 or 2160x4096)
            .sort((a, b) => b.width - a.width)[0];
          return best4KPortrait && !excludeUrls.has(best4KPortrait.link)
            ? [{ url: best4KPortrait.link, width: best4KPortrait.width, height: best4KPortrait.height, duration: video.duration }]
            : [];
        });

        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        if (picked) {
          console.log(`Matched stunning 4K/HD video on query: "${query}"`);
          return picked;
        }
      } catch (error) {
        console.error("Failed to fetch Pexels video:", error);
      }
    }
  }
  
  return null;
}

