import { describe, expect, it } from "vitest";
import {
  dueSlots,
  isFormatBoundSeries,
  type SeriesLike,
  type SlotDecision,
} from "../../src/multi-series/pipeline/slot-scheduler.js";

const SERIES: SeriesLike[] = [
  { id: "mindset-manual", slots: [{ dayOfWeek: 3, slot: "am" }, { dayOfWeek: 0, slot: "pm" }] },
  { id: "hook-lab", slots: [{ dayOfWeek: 1, slot: "am" }, { dayOfWeek: 3, slot: "pm" }, { dayOfWeek: 5, slot: "am" }] },
  { id: "confession-cards", slots: [{ dayOfWeek: 1, slot: "pm" }, { dayOfWeek: 2, slot: "am" }, { dayOfWeek: 4, slot: "am" }, { dayOfWeek: 6, slot: "pm" }] },
  { id: "villain-roasts", slots: [{ dayOfWeek: 4, slot: "pm" }] },
  { id: "fill-the-blank", slots: [{ dayOfWeek: 2, slot: "pm" }, { dayOfWeek: 6, slot: "am" }] },
  { id: "season-reset", slots: [{ dayOfWeek: 5, slot: "pm" }, { dayOfWeek: 0, slot: "am" }] },
];

function at(year: number, month: number, day: number, hour: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
}

describe("dueSlots", () => {
  it("returns Saturday AM series for a Saturday morning timestamp", () => {
    const decisions: SlotDecision[] = dueSlots(at(2026, 8, 22, 10), SERIES);
    expect(decisions).toEqual([{ seriesId: "fill-the-blank", slot: "am" }]);
  });

  it("returns Saturday PM series for a Saturday evening timestamp", () => {
    const decisions: SlotDecision[] = dueSlots(at(2026, 8, 22, 20), SERIES);
    expect(decisions).toEqual([{ seriesId: "confession-cards", slot: "pm" }]);
  });

  it("handles two-slot Sundays in their respective halves", () => {
    const morning: SlotDecision[] = dueSlots(at(2026, 8, 23, 9), SERIES);
    const evening: SlotDecision[] = dueSlots(at(2026, 8, 23, 21), SERIES);
    expect(morning).toEqual([{ seriesId: "season-reset", slot: "am" }]);
    expect(evening).toEqual([{ seriesId: "mindset-manual", slot: "pm" }]);
  });

  it("treats exactly-noon as the pm half", () => {
    const decisions: SlotDecision[] = dueSlots(at(2026, 8, 18, 12), SERIES);
    expect(decisions).toEqual([{ seriesId: "fill-the-blank", slot: "pm" }]); // Tuesday
  });
});

describe("isFormatBoundSeries (§4.5 degradation matrix)", () => {
  it.each(["mindset-manual", "villain-roasts", "fill-the-blank"])("%s is format-bound", (id) => {
    expect(isFormatBoundSeries(id)).toBe(true);
  });

  it.each(["hook-lab", "confession-cards", "season-reset"])("%s accepts provider fallback", (id) => {
    expect(isFormatBoundSeries(id)).toBe(false);
  });
});
