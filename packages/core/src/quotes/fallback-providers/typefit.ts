import type { FetchedQuote } from "./types.js";

/**
 * Replaces Quote Garden (plan.md's original 3rd fallback) -- Quote Garden's
 * Render.com-hosted free instance returns "This service has been
 * suspended" (verified live), exactly the kind of hobby-API instability
 * risk this fallback chain exists to guard against. type.fit serves a
 * static ~1600-quote JSON file (verified live, 200) -- a plain static file
 * is structurally less likely to suffer the same "suspended for
 * inactivity" fate a small dynamic server can. No category filtering (the
 * dataset has no tags) -- category-agnostic result, same limitation as
 * ZenQuotes/DummyJSON.
 */
export async function fetchFromTypeFit(
  _category: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedQuote> {
  const res = await fetchImpl("https://type.fit/api/quotes");
  if (!res.ok) {
    throw new Error(`type.fit request failed: ${res.status}`);
  }
  const body = (await res.json()) as Array<{ text?: string; author?: string | null }>;
  if (body.length === 0) {
    throw new Error("type.fit response was an empty array");
  }
  const entry = body[Math.floor(Math.random() * body.length)];
  if (!entry?.text) {
    throw new Error("type.fit response entry missing text");
  }
  return { text: entry.text, author: entry.author ?? undefined, source: "typefit" };
}
