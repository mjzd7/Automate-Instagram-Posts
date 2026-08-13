import { normalizeQuoteCapitalization } from "../content-filter/capitalization-normalizer.js";
import { quoteLengthPassesFilter } from "../content-filter/length-filter.js";
import { textPassesFilter } from "../content-filter/text-filter.js";
import type { Db } from "../db/client.js";
import { insertQuote } from "../db/repositories/quotes.repo.js";
import { getCuratedQuote, type CuratedQuote } from "./curated-provider.js";
import { fetchFromApiNinjas } from "./fallback-providers/api-ninjas.js";
import { fetchFromDummyJson } from "./fallback-providers/dummyjson.js";
import { fetchFromTheySaidSo } from "./fallback-providers/they-said-so.js";
import { fetchFromTypeFit } from "./fallback-providers/typefit.js";
import { fetchFromZenQuotes } from "./fallback-providers/zenquotes.js";
import type { FetchedQuote } from "./fallback-providers/types.js";

export interface QuoteProviderConfig {
  apiNinjasKey?: string;
  theySaidSoKey?: string;
  fetchImpl?: typeof fetch;
  idGenerator?: () => string;
}

/**
 * Fallback chain order and providers per plan.md §7.15, with two
 * substitutions made after live verification at implementation time (both
 * documented in docs/LEARNINGS.md): Quotable is replaced by DummyJSON
 * (Quotable's domain no longer resolves at all) and Quote Garden is
 * replaced by type.fit (Quote Garden's hosted instance returns "This
 * service has been suspended"). API Ninjas, ZenQuotes, and They Said So
 * were verified live and kept in their original positions.
 */
import { isQuoteTextUsedForAccount } from "../db/repositories/quotes.repo.js";

async function runFallbackChain(
  db: Db,
  accountId: string,
  category: string,
  config: QuoteProviderConfig,
): Promise<FetchedQuote> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const errors: string[] = [];

  const attempts: Array<() => Promise<FetchedQuote>> = [
    () => fetchFromDummyJson(category, fetchImpl),
    ...(config.apiNinjasKey
      ? [() => fetchFromApiNinjas(category, config.apiNinjasKey!, fetchImpl)]
      : []),
    () => fetchFromTypeFit(category, fetchImpl),
    () => fetchFromZenQuotes(category, fetchImpl),
    ...(config.theySaidSoKey
      ? [() => fetchFromTheySaidSo(category, config.theySaidSoKey!, fetchImpl)]
      : []),
  ];

  for (const attempt of attempts) {
    try {
      const raw = await attempt();
      const quote = { ...raw, text: normalizeQuoteCapitalization(raw.text) };
      const fullText = raw.author ? `${quote.text} ${raw.author}` : quote.text;
      if (!textPassesFilter(fullText)) {
        errors.push(`${raw.source}: quote failed content filter`);
        continue;
      }
      if (!quoteLengthPassesFilter(quote.text)) {
        errors.push(`${raw.source}: quote failed length filter`);
        continue;
      }
      if (await isQuoteTextUsedForAccount(db, accountId, quote.text)) {
        errors.push(`${raw.source}: quote text already used for account`);
        continue;
      }
      return quote;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`All quote fallback providers failed or were unconfigured:\n${errors.join("\n")}`);
}

const defaultIdGenerator = () => crypto.randomUUID();

/**
 * Full quote-selection flow: curated pool first (plan.md §7.19 step 4b),
 * falling through to the external provider chain only if the curated
 * batch had no candidate that passed content/length filtering. A quote
 * fetched from an external provider is inserted into the curated pool
 * (source set to the provider name) so it becomes part of the durable,
 * dedup-tracked pool for future selections, per plan.md §7.15.
 */
export async function getNextQuote(
  db: Db,
  accountId: string,
  categoryId: string,
  config: QuoteProviderConfig = {},
): Promise<CuratedQuote> {
  const curated = await getCuratedQuote(db, accountId, categoryId);
  if (curated) return curated;

  // Cascading fallback to other high-quality curated categories before external APIs
  const curatedCategories = [
    "success",
    "business",
    "entrepreneurship",
    "stoic",
    "discipline",
    "leadership",
    "wealth",
    "mindset",
    "resilience",
    "wisdom",
    "motivational",
  ];

  for (const cat of curatedCategories) {
    if (cat === categoryId) continue;
    const altCurated = await getCuratedQuote(db, accountId, cat);
    if (altCurated) return altCurated;
  }

  let fetched: FetchedQuote;
  try {
    fetched = await runFallbackChain(db, accountId, categoryId, config);
  } catch (error) {
    console.warn(`[Quotes] All APIs failed, recycling a random quote from the database fallback: ${error instanceof Error ? error.message : String(error)}`);
    const fallbackDbQuote = await import("../db/repositories/quotes.repo.js").then(m => m.getRandomFallbackQuote(db));
    if (!fallbackDbQuote) throw new Error("CRITICAL: Database has 0 active quotes.");
    return { id: fallbackDbQuote.id, text: fallbackDbQuote.text, author: fallbackDbQuote.author, categoryId: fallbackDbQuote.categoryId };
  }

  const normalizedText = normalizeQuoteCapitalization(fetched.text);
  const id = (config.idGenerator ?? defaultIdGenerator)();
  await insertQuote(db, {
    id,
    text: normalizedText,
    author: fetched.author ?? null,
    categoryId,
    source: fetched.source,
  });
  return { id, text: normalizedText, author: fetched.author ?? null, categoryId };
}
