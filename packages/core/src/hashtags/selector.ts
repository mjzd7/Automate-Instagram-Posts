import { isBannedHashtag } from "./banned-list.js";

export const HASHTAG_SET_SIZE = 15;

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
 * Picks up to HASHTAG_SET_SIZE hashtags for a category, per plan.md §7.14:
 * shuffle the category pool, drop any banned tag, and top up from the
 * "general" pool if the category pool doesn't have enough clean tags.
 * Never returns a banned tag, even if that means returning fewer than
 * HASHTAG_SET_SIZE (both pools genuinely exhausted is an edge case, not an
 * error -- a shorter-than-usual hashtag set is a fine degradation).
 */
export function selectHashtags(
  category: string,
  pools: HashtagPools,
  size: number = HASHTAG_SET_SIZE,
  isBanned: (tag: string) => boolean = isBannedHashtag,
): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();

  const addFrom = (tags: string[]) => {
    for (const tag of shuffled(tags)) {
      if (selected.length >= size) break;
      const key = tag.toLowerCase();
      if (seen.has(key) || isBanned(tag)) continue;
      seen.add(key);
      selected.push(tag);
    }
  };

  addFrom(pools[category] ?? []);
  if (selected.length < size) {
    addFrom(pools.general ?? []);
  }

  return selected;
}
