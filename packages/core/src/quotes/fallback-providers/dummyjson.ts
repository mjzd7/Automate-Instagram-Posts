import type { FetchedQuote } from "./types.js";

/**
 * Replaces Quotable (plan.md's original 1st fallback) -- Quotable's domain
 * no longer resolves at all (verified: DNS failure), confirming the
 * plan's own note about its history of instability. DummyJSON is verified
 * live (200, real quote data). No category/tag filtering support, same
 * documented limitation as ZenQuotes -- category-agnostic result.
 */
export async function fetchFromDummyJson(
  _category: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedQuote> {
  const res = await fetchImpl("https://dummyjson.com/quotes/random");
  if (!res.ok) {
    throw new Error(`DummyJSON request failed: ${res.status}`);
  }
  const body = (await res.json()) as { quote?: string; author?: string };
  if (!body.quote) {
    throw new Error("DummyJSON response missing quote");
  }
  return { text: body.quote, author: body.author, source: "dummyjson" };
}
