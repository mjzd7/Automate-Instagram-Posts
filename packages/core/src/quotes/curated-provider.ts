import { quoteLengthPassesFilter } from "../content-filter/length-filter.js";
import { textPassesFilter } from "../content-filter/text-filter.js";
import type { Db } from "../db/client.js";
import { findUnusedForAccount } from "../db/repositories/quotes.repo.js";

export interface CuratedQuote {
  id: string;
  text: string;
  author: string | null;
  categoryId: string;
}

/**
 * Curated-pool quote selection with content + length filtering (plan.md
 * §7.19 step 4b, extended per explicit user directive to also filter by
 * length rather than truncate at render time -- see images/constants.ts
 * MAX_QUOTE_WORDS). Fetches a batch of unused candidates from the DB
 * anti-join and returns the first that passes both filters; a candidate
 * that fails either is simply skipped in favor of the next, not retried --
 * this *is* the "find another smaller/cleaner one in the same category"
 * mechanism the user asked for. Returns undefined (not a throw) if no
 * candidate in the batch passes, signaling the caller to fall through to
 * the external fallback chain.
 */
export async function getCuratedQuote(
  db: Db,
  accountId: string,
  categoryId: string,
  maxCandidates = 5,
): Promise<CuratedQuote | undefined> {
  const candidates = await findUnusedForAccount(db, accountId, categoryId, maxCandidates);
  for (const candidate of candidates) {
    const fullText = candidate.author ? `${candidate.text} ${candidate.author}` : candidate.text;
    if (!textPassesFilter(fullText)) continue;
    if (!quoteLengthPassesFilter(candidate.text)) continue;
    return { id: candidate.id, text: candidate.text, author: candidate.author, categoryId: candidate.categoryId };
  }
  return undefined;
}
