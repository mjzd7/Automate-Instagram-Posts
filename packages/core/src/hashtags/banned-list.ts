/**
 * Maintained list of hashtags Instagram has historically flagged/restricted
 * (shadowbanning risk) per plan.md §2.7 (BANNED_HASHTAG_ACTION). This is a
 * static array, not fetched or auto-updated -- per the decision ladder this
 * is a periodically-reviewable reference list, not something worth
 * building live-freshness tooling around. Spot-check occasionally; not
 * automated.
 */
export const BANNED_HASHTAGS: readonly string[] = [
  "#like4like",
  "#follow4follow",
  "#followforfollow",
  "#likeforlike",
  "#tagsforlikes",
  "#instalike",
  "#instafollow",
  "#alone",
  "#adulting",
  "#brain",
  "#costumes",
  "#curvygirls",
  "#eggplant",
  "#kansas",
  "#master",
  "#petite",
  "#pushups",
  "#single",
  "#skype",
  "#snap",
  "#snapchat",
  "#swimwear",
  "#teens",
  "#thighs",
  "#test",
  "#girls",
  "#hot",
];

const normalized = new Set(BANNED_HASHTAGS.map((tag) => tag.toLowerCase()));

export function isBannedHashtag(tag: string): boolean {
  return normalized.has(tag.toLowerCase());
}
