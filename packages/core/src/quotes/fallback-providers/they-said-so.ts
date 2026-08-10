import type { FetchedQuote } from "./types.js";

/**
 * Verified live (returns {"message":"Not authenticated"} without a key,
 * confirming the endpoint exists and requires auth). The auth header name
 * below (X-TheySaidSo-Api-Secret) is per their commonly documented
 * convention -- NOT independently verified against a real key here since
 * that requires an actual registered account. Confirm this against the
 * user's API dashboard at setup time (docs/SETUP.md) before relying on it;
 * this provider is last in the fallback chain specifically because it's
 * the least-verified of the five.
 */
export async function fetchFromTheySaidSo(
  category: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedQuote> {
  const res = await fetchImpl(`https://quotes.rest/qod?category=${encodeURIComponent(category)}`, {
    headers: { "X-TheySaidSo-Api-Secret": apiKey },
  });
  if (!res.ok) {
    throw new Error(`They Said So request failed: ${res.status}`);
  }
  const body = (await res.json()) as {
    contents?: { quotes?: Array<{ quote?: string; author?: string }> };
  };
  const entry = body.contents?.quotes?.[0];
  if (!entry?.quote) {
    throw new Error("They Said So response missing contents.quotes[0].quote");
  }
  return { text: entry.quote, author: entry.author, source: "they_said_so" };
}
