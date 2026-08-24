import type { SeriesSlot } from "../../config/series.js";

// Slot-scheduling brain for the series batch runner
// (docs/PLAN-multi-series.md §3 cadence grid + §4.5 degradation matrix).
// Pure functions only — the runner supplies clock and content.

export interface SeriesLike {
  id: string;
  slots: SeriesSlot[];
}

export interface SlotDecision {
  seriesId: string;
  slot: "am" | "pm";
}

/**
 * Series whose card format cannot survive a random substitute quote
 * (§4.5): an empty approved pool must SKIP the slot, never fall back to
 * the provider chain. Generic-compatible series may degrade gracefully.
 */
const FORMAT_BOUND_SERIES = new Set(["mindset-manual", "villain-roasts", "fill-the-blank"]);

export function isFormatBoundSeries(seriesId: string): boolean {
  return FORMAT_BOUND_SERIES.has(seriesId);
}

export function dueSlots(now: Date, series: SeriesLike[]): SlotDecision[] {
  const dayOfWeek = now.getUTCDay();
  const halfOfDay: "am" | "pm" = now.getUTCHours() < 12 ? "am" : "pm";
  const decisions: SlotDecision[] = [];
  for (const s of series) {
    for (const slot of s.slots) {
      if (slot.dayOfWeek === dayOfWeek && slot.slot === halfOfDay) {
        decisions.push({ seriesId: s.id, slot: slot.slot });
      }
    }
  }
  return decisions;
}

export type SlotContentDecision =
  | { kind: "item"; item: PackItemRef }
  | { kind: "skip"; reason: string }
  | { kind: "fallback" };

interface PackItemRef {
  id: string;
}

/**
 * §4.5 matrix: consume the oldest approved item; skip format-bound slots on
 * empty pools (never substitute into a fixed format); allow generic series
 * to fall back to the legacy quote-provider chain.
 */
export function selectSlotContent(
  seriesId: string,
  approvedItems: PackItemRef[],
): SlotContentDecision {
  const oldest = approvedItems[0];
  if (oldest) {
    return { kind: "item", item: oldest };
  }
  if (isFormatBoundSeries(seriesId)) {
    return { kind: "skip", reason: `no approved items in pack for format-bound series ${seriesId}` };
  }
  return { kind: "fallback" };
}
