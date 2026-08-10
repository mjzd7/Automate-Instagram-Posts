import type { Db } from "../db/client.js";
import { getSetting, setSetting } from "../db/repositories/settings.repo.js";
import type { Darkness } from "../images/darkness-classifier.js";

// Per plan.md §2.8 / §7.13.
export const MODE_WEIGHTING_LOOKBACK_COUNT = 20;
export const MODE_WEIGHTING_FLOOR = 0.2;

const MODE_SETTINGS_KEY = "mode_weighting";
const CAPTION_SETTINGS_KEY = "caption_template_weighting";

type Buckets = Record<string, boolean[]>;

function parseBuckets(raw: string | undefined): Buckets {
  if (!raw) return {};
  return JSON.parse(raw) as Buckets;
}

function appendOutcome(outcomes: boolean[], success: boolean): boolean[] {
  const next = [...outcomes, success];
  return next.length > MODE_WEIGHTING_LOOKBACK_COUNT
    ? next.slice(next.length - MODE_WEIGHTING_LOOKBACK_COUNT)
    : next;
}

function successRate(outcomes: boolean[]): number {
  if (outcomes.length === 0) return 0.5;
  return outcomes.filter(Boolean).length / outcomes.length;
}

/**
 * Weighted-random pick across `candidateIds`, using each id's recent
 * success rate (from `buckets`, default 0.5 if no history) floored at
 * MODE_WEIGHTING_FLOOR so no option is ever fully starved out (plan.md
 * §2.8 MODE_WEIGHTING_ALGORITHM). Ids with no bucket entry are treated as
 * an empty (0.5 default) history, not excluded.
 */
export function weightedSelect(
  candidateIds: string[],
  buckets: Buckets,
  random: () => number = Math.random,
): string {
  if (candidateIds.length === 0) {
    throw new Error("weightedSelect: candidateIds must not be empty");
  }

  const weights = candidateIds.map((id) => Math.max(MODE_WEIGHTING_FLOOR, successRate(buckets[id] ?? [])));
  const total = weights.reduce((sum, w) => sum + w, 0);

  const draw = random() * total;
  let cumulative = 0;
  for (let i = 0; i < candidateIds.length; i++) {
    cumulative += weights[i]!;
    if (draw < cumulative) {
      return candidateIds[i]!;
    }
  }
  // Floating-point edge case: draw landed exactly on/past the total due to
  // rounding -- return the last candidate rather than falling through to
  // undefined.
  return candidateIds[candidateIds.length - 1]!;
}

export async function selectMode(
  db: Db,
  accountId: string,
  random: () => number = Math.random,
): Promise<Darkness> {
  const buckets = parseBuckets(await getSetting(db, accountId, MODE_SETTINGS_KEY));
  return weightedSelect(["dark", "light"], buckets, random) as Darkness;
}

export async function recordModeOutcome(
  db: Db,
  accountId: string,
  mode: Darkness,
  success: boolean,
): Promise<void> {
  const buckets = parseBuckets(await getSetting(db, accountId, MODE_SETTINGS_KEY));
  buckets[mode] = appendOutcome(buckets[mode] ?? [], success);
  await setSetting(db, accountId, MODE_SETTINGS_KEY, JSON.stringify(buckets));
}

export async function selectCaptionTemplate(
  db: Db,
  accountId: string,
  candidateIds: string[],
  random: () => number = Math.random,
): Promise<string> {
  const buckets = parseBuckets(await getSetting(db, accountId, CAPTION_SETTINGS_KEY));
  return weightedSelect(candidateIds, buckets, random);
}

export async function recordCaptionTemplateOutcome(
  db: Db,
  accountId: string,
  templateId: string,
  success: boolean,
): Promise<void> {
  const buckets = parseBuckets(await getSetting(db, accountId, CAPTION_SETTINGS_KEY));
  buckets[templateId] = appendOutcome(buckets[templateId] ?? [], success);
  await setSetting(db, accountId, CAPTION_SETTINGS_KEY, JSON.stringify(buckets));
}
