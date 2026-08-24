export interface PixabayPhoto {
  id: string;
  url: string;
  description: string;
}

/**
 * Fetches a single portrait photo from Pixabay API matching query.
 */
export async function fetchPixabayPhoto(
  query: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PixabayPhoto> {
  const page = 1 + Math.floor(Math.random() * 3);
  const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=vertical&per_page=15&page=${page}`;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });

  if (!response.ok) {
    throw new Error(`Pixabay API error: HTTP ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    hits?: Array<{
      id: number;
      tags?: string;
      largeImageURL?: string;
      webformatURL?: string;
    }>;
  };

  const hits = json.hits ?? [];
  if (hits.length === 0) {
    throw new Error(`Pixabay API returned 0 photos for query: ${query}`);
  }

  const randomIndex = Math.floor(Math.random() * hits.length);
  const item = hits[randomIndex];
  if (!item) {
    throw new Error("Pixabay API candidate item undefined");
  }

  const imgUrl = item.largeImageURL ?? item.webformatURL;
  if (!imgUrl) {
    throw new Error("Pixabay API item missing image URL");
  }

  return {
    id: `pixabay-${item.id}`,
    url: imgUrl,
    description: item.tags ?? query,
  };
}
