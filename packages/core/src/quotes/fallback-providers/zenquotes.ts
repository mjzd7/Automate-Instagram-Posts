import type { FetchedQuote } from "./types.js";

/**
 * ZenQuotes has no category/tag filtering on its free tier (verified live,
 * no key required as of implementation time). `category` is accepted for
 * interface consistency with the other providers but not sent -- the
 * caller (provider.ts) is responsible for treating this provider's results
 * as category-agnostic, same limitation the plan documents for this
 * provider.
 */
export async function fetchFromZenQuotes(
  _category: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedQuote> {
  const res = await fetchImpl("https://zenquotes.io/api/random");
  if (!res.ok) {
    throw new Error(`ZenQuotes request failed: ${res.status}`);
  }
  const body = (await res.json()) as Array<{ q?: string; a?: string }>;
  const entry = body[0];
  if (!entry?.q) {
    throw new Error("ZenQuotes response missing quote text");
  }
  return { text: entry.q, author: entry.a, source: "zenquotes" };
}
