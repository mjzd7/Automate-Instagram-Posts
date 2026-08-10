export interface PexelsPhoto {
  id: string;
  url: string;
  description: string;
}

/**
 * Fetches a single random/top portrait photo from Pexels API matching query.
 */
export async function fetchPexelsPhoto(
  query: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PexelsPhoto> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=portrait`;
  const response = await fetchImpl(url, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Pexels API error: HTTP ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    photos?: Array<{
      id: number;
      alt?: string;
      src?: { large2x?: string; original?: string; portrait?: string };
    }>;
  };

  const photos = json.photos ?? [];
  if (photos.length === 0) {
    throw new Error(`Pexels API returned 0 photos for query: ${query}`);
  }

  // Pick random candidate from top results for variety
  const randomIndex = Math.floor(Math.random() * photos.length);
  const item = photos[randomIndex];
  if (!item) {
    throw new Error("Pexels API candidate item undefined");
  }

  const imgUrl = item.src?.portrait ?? item.src?.large2x ?? item.src?.original;
  if (!imgUrl) {
    throw new Error("Pexels API item missing image src URL");
  }

  return {
    id: `pexels-${item.id}`,
    url: imgUrl,
    description: item.alt ?? query,
  };
}
