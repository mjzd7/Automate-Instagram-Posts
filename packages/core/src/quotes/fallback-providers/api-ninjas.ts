import type { FetchedQuote } from "./types.js";

/** Verified live (returns "Missing API Key" without one, confirming the endpoint/param shape). Requires API_NINJAS_KEY. Supports category filtering server-side. */
export async function fetchFromApiNinjas(
  category: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedQuote> {
  const res = await fetchImpl(
    `https://api.api-ninjas.com/v1/quotes?category=${encodeURIComponent(category)}`,
    { headers: { "X-Api-Key": apiKey } },
  );
  if (!res.ok) {
    throw new Error(`API Ninjas request failed: ${res.status}`);
  }
  const body = (await res.json()) as Array<{ quote?: string; author?: string }>;
  const entry = body[0];
  if (!entry?.quote) {
    throw new Error("API Ninjas response missing quote");
  }
  return { text: entry.quote, author: entry.author, source: "api_ninjas" };
}
