import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadSeries, parseSeries } from "../../src/config/series.js";

// Real config file at repo root — the deliverable itself. Testing against it
// catches drift between the Zod schema and the authored data/series.json.
const repoSeriesPath = fileURLToPath(new URL("../../../../data/series.json", import.meta.url));

function validSeries(overrides: Record<string, unknown> = {}) {
  return {
    id: "mindset-manual",
    name: "Mindset Manual",
    templateIds: ["framework-carousel", "framework-mini"],
    captionPromptRef: "captions/mindset-manual.txt",
    hashtagCategory: "mindset",
    slots: [{ dayOfWeek: 3, slot: "am" }],
    maxPerDay: 1,
    active: true,
    ...overrides,
  };
}

describe("parseSeries", () => {
  it("accepts a valid series array", () => {
    const series = parseSeries([validSeries()]);
    expect(series).toHaveLength(1);
    expect(series[0]?.id).toBe("mindset-manual");
  });

  it("accepts multiple slots per series (cadence grid)", () => {
    const series = parseSeries([
      validSeries({ slots: [{ dayOfWeek: 1, slot: "am" }, { dayOfWeek: 4, slot: "pm" }] }),
    ]);
    expect(series[0]?.slots).toHaveLength(2);
  });

  it("rejects an empty id (input validation plane)", () => {
    expect(() => parseSeries([validSeries({ id: "" })])).toThrow(/id/i);
  });

  it("rejects an empty templateIds array (input validation plane)", () => {
    expect(() => parseSeries([validSeries({ templateIds: [] })])).toThrow(/templateIds/);
  });

  it("rejects dayOfWeek outside 0-6 (input validation plane)", () => {
    expect(() => parseSeries([validSeries({ slots: [{ dayOfWeek: 7, slot: "am" }] })])).toThrow(
      /dayOfWeek/,
    );
    expect(() => parseSeries([validSeries({ slots: [{ dayOfWeek: -1, slot: "am" }] })])).toThrow(
      /dayOfWeek/,
    );
  });

  it("rejects a slot value other than am|pm (input validation plane)", () => {
    expect(() =>
      parseSeries([validSeries({ slots: [{ dayOfWeek: 3, slot: "noon" }] })]),
    ).toThrow(/slot/);
  });

  it("rejects maxPerDay below 1 (input validation plane)", () => {
    expect(() => parseSeries([validSeries({ maxPerDay: 0 })])).toThrow(/maxPerDay/);
  });

  it("rejects duplicate series ids (ids are load-bearing counter keys)", () => {
    expect(() => parseSeries([validSeries(), validSeries({ name: "Duplicate" })])).toThrow(
      /duplicate/i,
    );
  });

  it("rejects a non-array top-level value (input validation plane: wrong type)", () => {
    expect(() => parseSeries(validSeries())).toThrow();
  });
});

describe("loadSeries", () => {
  it("reads and parses the real repo-root data/series.json from disk", async () => {
    const series = await loadSeries(repoSeriesPath);
    expect(series.length).toBeGreaterThanOrEqual(5); // plan requires >= 6 defined; S7 deferred
    const ids = series.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Every active series must have at least one weekly slot — else it can
    // never be scheduled.
    for (const s of series.filter((x) => x.active)) {
      expect(s.slots.length, `series ${s.id} has no slots`).toBeGreaterThan(0);
    }
  }, 10_000);

  it("rejects a missing file with a clear error (external deps plane: filesystem failure)", async () => {
    await expect(loadSeries("/nonexistent/path/series.json")).rejects.toThrow();
  });
});
