import { IDEAL_QUOTE_WORDS_MAX, IDEAL_QUOTE_WORDS_MIN, MAX_QUOTE_WORDS } from "../images/constants.js";

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Per MAX_QUOTE_WORDS (images/constants.ts): a hard selection-time cap on
 * quote length for visual consistency across the feed. Callers (the
 * curated quote provider / pipeline) must reject a candidate that fails
 * this and re-pick a different, shorter quote from the same category --
 * never truncate at render time (explicit user directive).
 */
export function quoteLengthPassesFilter(text: string, maxWords: number = MAX_QUOTE_WORDS): boolean {
  return wordCount(text) <= maxWords;
}

/** true if the quote falls in the empirically most-shareable 8-18 word range (informational -- not a rejection filter, useful for provider ranking/preference). */
export function isIdealQuoteLength(text: string): boolean {
  const count = wordCount(text);
  return count >= IDEAL_QUOTE_WORDS_MIN && count <= IDEAL_QUOTE_WORDS_MAX;
}
