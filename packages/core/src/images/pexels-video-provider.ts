export interface PexelsVideo {
  id: string;
  url: string;
  duration: number;
  width: number;
  height: number;
}

const CATEGORY_BROLL_KEYWORDS: Record<string, string[]> = {
  business: ["cinematic city night drive", "modern architecture interior", "luxury skyscraper night", "minimalist desk aesthetic"],
  wealth: ["luxury aesthetic dark", "city skyline night drone", "minimalist brutalist architecture", "dark abstract luxury"],
  stoic: ["moody rain on window", "foggy forest dark cinematic", "ocean waves dark storm", "calm mountain mist"],
  discipline: ["early morning dark run", "boxing heavy bag dark", "heavy rain dark street", "minimalist dark road"],
  mindset: ["calm ocean drone", "deep starry night timelapse", "neon tokyo night street", "rainy car window bokeh"],
  motivational: ["epic mountain drone", "city timelapse night lights", "cinematic sunrise road", "dark moody ocean"],
  wisdom: ["calm fireplace dark room", "ancient library dark aesthetic", "rainy window coffee", "misty forest walking"],
  leadership: ["skyscraper penthouse view", "executive boardroom dark", "modern architectural bridge", "sunrise city skyline"],
  resilience: ["raging ocean waves drone", "storm clouds timelapse", "dark misty forest", "rainy street headlights"],
};

/**
 * Fetches a vertical portrait (9:16) video clip from Pexels Video API.
 */
export async function fetchPexelsVideo(
  category: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<PexelsVideo> {
  const catKeywords = CATEGORY_BROLL_KEYWORDS[category.toLowerCase()] ?? [
    "moody rain dark aesthetic",
    "cinematic city night drive",
    "calm ocean waves drone aerial",
    "brutalist architecture interior minimalist",
  ];
  const query = catKeywords[Math.floor(Math.random() * catKeywords.length)] ?? "moody rain aesthetic";

  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=15`;
  const response = await fetchImpl(url, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Pexels Video API error: HTTP ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    videos?: Array<{
      id: number;
      duration: number;
      width: number;
      height: number;
      video_files?: Array<{
        id: number;
        quality: string;
        file_type: string;
        width: number;
        height: number;
        link: string;
      }>;
    }>;
  };

  const videos = json.videos ?? [];
  if (videos.length === 0) {
    throw new Error(`Pexels Video API returned 0 videos for query: ${query}`);
  }

  // Pick random candidate from top results for variety
  const randomIndex = Math.floor(Math.random() * videos.length);
  const item = videos[randomIndex]!;

  const files = item.video_files ?? [];
  // Prioritize 1080x1920 or 720x1280 portrait MP4
  const chosenFile =
    files.find((f) => f.file_type === "video/mp4" && f.height >= 1280 && f.height > f.width) ??
    files.find((f) => f.file_type === "video/mp4") ??
    files[0];

  if (!chosenFile?.link) {
    throw new Error("Pexels Video API candidate item missing video file link");
  }

  return {
    id: `pexels-vid-${item.id}`,
    url: chosenFile.link,
    duration: item.duration,
    width: chosenFile.width,
    height: chosenFile.height,
  };
}
