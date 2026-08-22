import { loadEnv } from "../config/env.js";
import { extractVisualConcepts } from "../matching/visual-concept-extractor.js";

interface VideoResult {
  url: string;
  width: number;
  height: number;
  duration: number; // in seconds
}

export async function fetchPexelsVideo(category: string, mode: "dark" | "light" = "dark", quoteText?: string): Promise<VideoResult | null> {
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
        
        const data = await response.json() as any;
        if (!data.videos || data.videos.length === 0) continue;
        
        // Pick a random video from the top results for variety
        const video = data.videos[Math.floor(Math.random() * data.videos.length)];
        
        // Sort files by width descending to get the absolute highest 4K/HD resolution source
        const sortedFiles = [...video.video_files]
          .filter((f: any) => f.height > f.width && (f.width >= 2160 || f.height >= 3840)) // Enforce 4K only (e.g. 2160x3840 or 2160x4096)
          .sort((a: any, b: any) => b.width - a.width);
          
        const file = sortedFiles[0];
                     
        if (file) {
          console.log(`Matched stunning 4K/HD video on query: "${query}"`);
          return {
            url: file.link,
            width: file.width,
            height: file.height,
            duration: video.duration
          };
        }
      } catch (error) {
        console.error("Failed to fetch Pexels video:", error);
      }
    }
  }
  
  return null;
}

