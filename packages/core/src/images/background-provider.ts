import { imagePassesFilter } from "../content-filter/image-filter.js";
import type { Db } from "../db/client.js";
import { findUnusedForAccount, insertBackground, updateDarkness } from "../db/repositories/backgrounds.repo.js";
import { extractVisualConcepts } from "../matching/visual-concept-extractor.js";
import { classifyDarkness, type Darkness } from "./darkness-classifier.js";
import { fetchPexelsPhoto } from "./pexels-provider.js";
import { fetchPixabayPhoto } from "./pixabay-provider.js";
import { fetchUnsplashPhoto } from "./unsplash-provider.js";

export interface BackgroundCandidate {
  id: string;
  sourceUrl: string;
  description: string;
  darkness: Darkness;
  /** Where the candidate came from: "curated", "unsplash", "pexels", or "pixabay". */
  source?: string;
}

export interface BackgroundProviderConfig {
  visionApiKey: string;
  unsplashAccessKey?: string;
  pexelsApiKey?: string;
  pixabayApiKey?: string;
  geminiApiKey?: string;
  quoteText?: string;
  fetchImpl?: typeof fetch;
  idGenerator?: () => string;
  targetDarkness?: Darkness;
  /**
   * When false, candidates are gathered and scored without writing to the
   * backgrounds table -- lets read-only environments (Vercel's FS) run the
   * same selection flow for preview/explain surfaces.
   */
  persist?: boolean;
}

const defaultIdGenerator = () => crypto.randomUUID();

/**
 * Gathers up to `poolSize` candidate backgrounds for image-quote-matcher to
 * rank (plan.md §7.19 step 4d): curated pool first, topped up from
 * Unsplash/Pexels/Pixabay if short. Every candidate (curated or freshly fetched) is
 * checked against Google Vision SafeSearch before being returned.
 */
export async function getCandidateBackgrounds(
  db: Db,
  accountId: string,
  categoryId: string,
  poolSize: number,
  config: BackgroundProviderConfig,
): Promise<BackgroundCandidate[]> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const idGenerator = config.idGenerator ?? defaultIdGenerator;
  const results: BackgroundCandidate[] = [];
  const seenUrls = new Set<string>();
  const seenIds = new Set<string>();

  // 1. Curated Pool Candidates
  const curated = await findUnusedForAccount(db, accountId, poolSize, categoryId, config.targetDarkness);
  for (const bg of curated) {
    if (seenUrls.has(bg.sourceUrl) || seenIds.has(bg.id)) continue;
    const passes = await safeSearchPasses(bg.sourceUrl, config.visionApiKey, fetchImpl);
    if (!passes) continue;
    let darkness = bg.darkness as Darkness | null;
    if (!darkness) {
      const imageRes = await fetchImpl(bg.sourceUrl);
      const buffer = Buffer.from(await imageRes.arrayBuffer());
      darkness = await classifyDarkness(buffer);
      if (config.persist !== false) await updateDarkness(db, bg.id, darkness);
    }
    if (config.targetDarkness && darkness !== config.targetDarkness) continue;
    seenUrls.add(bg.sourceUrl);
    seenIds.add(bg.id);
    results.push({ id: bg.id, sourceUrl: bg.sourceUrl, description: bg.description ?? "", darkness, source: "curated" });
  }

  // 2. Extract LLM Visual Search Queries if quote text is provided
  const baseQueries = config.quoteText
    ? await extractVisualConcepts(config.quoteText, categoryId, config.geminiApiKey, fetchImpl)
    : [categoryId];

  // Rotate a broad subject pool per call -- without it, every post in a niche
  // (e.g. motivational) clusters onto the same dark-nature aesthetic.
  const SUBJECT_POOL = [
    "ocean waves",
    "desert dunes",
    "city nights",
    "modern architecture",
    "space and stars",
    "minimal interior",
    "fire and embers",
    "ice and frost",
    "misty mountains",
    "rain on glass",
    "golden fields",
    "neon streets",
  ];
  const rotatedSubjects = [...SUBJECT_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  const fallbackQueries = [...rotatedSubjects, categoryId];
  const visualQueries = [...new Set([...baseQueries, ...fallbackQueries])];

  let attempts = 0;
  const maxAttempts = poolSize * 10;

  // 3. Multi-Source Fetching Loop (Unsplash -> Pexels -> Pixabay)
  for (const baseQuery of visualQueries) {
    if (results.length >= poolSize || attempts >= maxAttempts) break;

    const queryVariations = config.targetDarkness
      ? [
          config.targetDarkness === "light"
            ? `${baseQuery} bright light white minimal`
            : `${baseQuery} dark moody black night`,
          baseQuery,
        ]
      : [baseQuery];

    for (const searchQuery of queryVariations) {
      if (results.length >= poolSize || attempts >= maxAttempts) break;

      // A. Unsplash Provider
      if (config.unsplashAccessKey && results.length < poolSize) {
        attempts++;
        try {
          const photo = await fetchUnsplashPhoto(searchQuery, config.unsplashAccessKey, fetchImpl);
          await processAndAddPhoto(photo, "unsplash", searchQuery);
        } catch {}
      }

      // B. Pexels Provider
      if (config.pexelsApiKey && results.length < poolSize) {
        attempts++;
        try {
          const photo = await fetchPexelsPhoto(searchQuery, config.pexelsApiKey, fetchImpl);
          await processAndAddPhoto(photo, "pexels", searchQuery);
        } catch {}
      }

      // C. Pixabay Provider
      if (config.pixabayApiKey && results.length < poolSize) {
        attempts++;
        try {
          const photo = await fetchPixabayPhoto(searchQuery, config.pixabayApiKey, fetchImpl);
          await processAndAddPhoto(photo, "pixabay", searchQuery);
        } catch {}
      }
    }
  }

  async function processAndAddPhoto(
    photo: { id: string; url: string; description: string; attribution?: string },
    source: string,
    query: string,
  ): Promise<void> {
    if (seenUrls.has(photo.url) || seenIds.has(photo.id)) return;

    const passes = await safeSearchPasses(photo.url, config.visionApiKey, fetchImpl);
    if (!passes) return;

    const imageRes = await fetchImpl(photo.url, { signal: AbortSignal.timeout(10000) });
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const darkness = await classifyDarkness(buffer);
    if (config.targetDarkness && darkness !== config.targetDarkness) return;

    const id = idGenerator();
    if (config.persist !== false) {
      await insertBackground(db, {
        id,
        source,
        externalId: photo.id,
        sourceUrl: photo.url,
        description: photo.description || query,
        attribution: photo.attribution ?? source,
        categoryId,
      });
      await updateDarkness(db, id, darkness);
    }

    seenUrls.add(photo.url);
    seenIds.add(photo.id);
    results.push({ id, sourceUrl: photo.url, description: photo.description || query, darkness, source });
  }

  return results;
}

async function safeSearchPasses(url: string, visionApiKey: string, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const result = await imagePassesFilter(url, visionApiKey, fetchImpl);
    return result.passes;
  } catch {
    return false;
  }
}
