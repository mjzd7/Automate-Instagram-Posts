import { isBannedHashtag } from "./banned-list.js";

export const HASHTAG_SET_SIZE = 5;

export interface HashtagPools {
  [category: string]: string[];
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Picks exactly HASHTAG_SET_SIZE (5) hashtags per plan:
 * 1. #successforsure
 * 2. 3 trending hashtags (from pools.trending)
 * 3. 1 category specific hashtag
 * 
 * Falls back to category/general pools if trending pool is missing or short.
 * Never returns a banned tag.
 */
export function selectHashtags(
  category: string,
  pools: HashtagPools,
  size: number = HASHTAG_SET_SIZE,
  isBanned: (tag: string) => boolean = isBannedHashtag,
): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();

  const pushTag = (tag: string): boolean => {
    if (selected.length >= size) return false;
    const key = tag.toLowerCase();
    if (seen.has(key) || isBanned(tag)) return false;
    seen.add(key);
    selected.push(tag);
    return true;
  };

  // 1. Fixed success tag
  pushTag("#successforsure");

  // 2. Up to 3 trending tags
  let trendingCount = 0;
  for (const tag of shuffled(pools.trending ?? [])) {
    if (trendingCount >= 3) break;
    if (pushTag(tag)) {
      trendingCount++;
    }
  }

  // 3. 1 Category-specific tag
  const categoryTags = shuffled(pools[category] ?? []);
  let categoryCount = 0;
  for (const tag of categoryTags) {
    if (categoryCount >= 1) break;
    if (pushTag(tag)) {
      categoryCount++;
    }
  }

  // 4. Fallbacks if trending pool was short or empty
  if (selected.length < size) {
    for (const tag of categoryTags) {
      if (selected.length >= size) break;
      pushTag(tag);
    }
  }
  if (selected.length < size) {
    for (const tag of shuffled(pools.general ?? [])) {
      if (selected.length >= size) break;
      pushTag(tag);
    }
  }

  return selected;
}
