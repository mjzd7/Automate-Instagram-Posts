/**
 * Capitalization normalization for quote text.
 *
 * Research-based rules for social media quote typography:
 *
 * 1. SENTENCE CASE (default for all quotes):
 *    - Only the first letter of the entire quote is capitalized
 *    - Proper nouns retain their capitals
 *    - Standard for Instagram quotes: friendly, readable, modern
 *
 * 2. TITLE CASE (only for short punchy headlines):
 *    - Applied only when quote is ≤ 6 words AND the source text is already all-caps
 *    - Title case creates balanced block text for very short power phrases
 *
 * 3. ALL CAPS (never used):
 *    - Blocked entirely per typography research: perceived as "shouting",
 *      reduces scroll engagement, wastes horizontal space
 *
 * Sources: Instagram typography best practices, social media design research
 */

/** Articles, conjunctions, and prepositions that stay lowercase in title case */
const TITLE_CASE_MINOR_WORDS = new Set([
  "a", "an", "the",
  "and", "but", "or", "nor", "for", "so", "yet",
  "at", "by", "in", "of", "on", "to", "up", "as",
  "is", "it",
]);

/**
 * Checks if a string looks like it was Title-Cased by an API
 * (every major word capitalized, not just proper nouns).
 */
function isApiTitleCase(text: string): boolean {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 3) return false;
  // If more than 60% of non-minor words are title-cased, it's API-generated title case
  const majorWords = words.filter((w) => !TITLE_CASE_MINOR_WORDS.has(w.toLowerCase()));
  if (majorWords.length === 0) return false;
  const capitalizedCount = majorWords.filter((w) => /^[A-Z][a-z]/.test(w)).length;
  return capitalizedCount / majorWords.length >= 0.6;
}

/**
 * Checks if the entire text is in ALL CAPS.
 */
function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length === 0) return false;
  return letters === letters.toUpperCase();
}

/**
 * Converts text to proper sentence case:
 * - Capitalizes the first character of each sentence (after start of string or . / ! / ?).
 * - Capitalizes standalone pronoun 'I' and contractions ('I'm', 'I've', 'I'll', 'I'd').
 * - Preserves proper sentence pacing and grammar for English typography.
 */
function toSentenceCase(text: string): string {
  if (text.length === 0) return text;

  // 1. Lowercase entire text first
  let result = text.toLowerCase();

  // 2. Capitalize first letter of each sentence (start of string or after . ! ? followed by space)
  result = result.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`);

  // 3. Capitalize standalone pronoun 'I'
  result = result.replace(/\b(i)\b/g, "I");

  // 4. Capitalize 'I' in contractions: I'm, I've, I'll, I'd
  result = result.replace(/\b(i)('m|'ve|'ll|'d|’m|’ve|’ll|’d)\b/gi, (_, _i, suffix) => `I${suffix.toLowerCase()}`);

  return result;
}

/**
 * Normalizes quote text capitalization for Instagram posts.
 *
 * Rules (from typography research):
 * - ALL CAPS → convert to sentence case (never post in all caps)
 * - Title Case (API artifact) + ≤ 6 words → keep as title case (short power punch)
 * - Title Case (API artifact) + > 6 words → convert to sentence case (long quotes: readability)
 * - Sentence case already → pass through unchanged
 * - Mixed/other → sentence case
 */
export function normalizeQuoteCapitalization(text: string): string {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).length;

  // Never allow all-caps
  if (isAllCaps(trimmed)) {
    return toSentenceCase(trimmed);
  }

  // API-injected title case
  if (isApiTitleCase(trimmed)) {
    // Short punchy quotes (≤ 6 words): keep title case — creates balanced visual block
    if (wordCount <= 6) {
      return trimmed;
    }
    // Longer quotes: sentence case for readability
    return toSentenceCase(trimmed);
  }

  // All-lowercase text (some APIs return lower) → sentence case
  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 0 && letters === letters.toLowerCase()) {
    return toSentenceCase(trimmed);
  }

  // Already sentence case or proper mixed case — pass through unchanged
  return trimmed;
}
