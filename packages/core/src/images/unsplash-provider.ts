export interface UnsplashPhoto {
  id: string;
  url: string;
  description: string;
  attribution: string;
}

/**
 * Verified live (GET .../photos/random returns 401 without a key, not a
 * DNS/connection failure, confirming the endpoint and param shape).
 * Uses the Authorization: Client-ID header (Unsplash's recommended
 * approach) rather than passing the access key as a query param.
 */
export async function fetchUnsplashPhoto(
  query: string,
  accessKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UnsplashPhoto> {
  const res = await fetchImpl(`https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Client-ID ${accessKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Unsplash request failed: ${res.status}`);
  }
  const body = (await res.json()) as {
    id?: string;
    urls?: { regular?: string };
    description?: string | null;
    alt_description?: string | null;
    user?: { name?: string };
  };
  if (!body.id || !body.urls?.regular) {
    throw new Error("Unsplash response missing id/urls.regular");
  }
  return {
    id: body.id,
    url: body.urls.regular,
    description: body.description ?? body.alt_description ?? "",
    attribution: body.user?.name ? `Photo by ${body.user.name} on Unsplash` : "Photo via Unsplash",
  };
}
