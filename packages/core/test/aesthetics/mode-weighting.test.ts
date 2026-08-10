import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type DbHandle } from "../../src/db/client.js";
import { getSetting } from "../../src/db/repositories/settings.repo.js";
import {
  MODE_WEIGHTING_FLOOR,
  MODE_WEIGHTING_LOOKBACK_COUNT,
  recordCaptionTemplateOutcome,
  recordModeOutcome,
  selectCaptionTemplate,
  selectMode,
  weightedSelect,
} from "../../src/aesthetics/mode-weighting.js";

let handle: DbHandle;

beforeEach(async () => {
  handle = await openDb(":memory:");
});

afterEach(() => {
  handle.close();
});

describe("weightedSelect", () => {
  it("with no history for either candidate, both get equal 0.5 weight (50/50 split over many draws)", () => {
    let darkCount = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      const pick = weightedSelect(["dark", "light"], {}, Math.random);
      if (pick === "dark") darkCount++;
    }
    expect(darkCount / trials).toBeGreaterThan(0.4);
    expect(darkCount / trials).toBeLessThan(0.6);
  });

  it("favors the candidate with a higher recorded success rate", () => {
    const buckets = {
      dark: Array(20).fill(true), // 100% success
      light: Array(20).fill(false), // 0% success -> floored to MODE_WEIGHTING_FLOOR
    };
    let darkCount = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      if (weightedSelect(["dark", "light"], buckets, Math.random) === "dark") darkCount++;
    }
    // dark weight=1.0, light weight=floor=0.2 -> dark should win ~1/1.2 = 83% of the time
    expect(darkCount / trials).toBeGreaterThan(0.75);
  });

  it("never drops a candidate to zero probability even at 0% success (the floor)", () => {
    const buckets = { dark: Array(20).fill(true), light: Array(20).fill(false) };
    let lightPicked = false;
    for (let i = 0; i < 500; i++) {
      // deterministic draw very close to 1 (end of the cumulative range) should still be reachable by light due to the floor
      if (weightedSelect(["dark", "light"], buckets, () => 0.99999) === "light") {
        lightPicked = true;
        break;
      }
    }
    expect(lightPicked).toBe(true);
  });

  it("is deterministic given a fixed random() function", () => {
    const buckets = { a: [true, true], b: [false, false] };
    const a1 = weightedSelect(["a", "b"], buckets, () => 0.1);
    const a2 = weightedSelect(["a", "b"], buckets, () => 0.1);
    expect(a1).toBe(a2);
  });

  it("throws on an empty candidate list (input validation plane)", () => {
    expect(() => weightedSelect([], {}, Math.random)).toThrow(/must not be empty/);
  });

  it("MODE_WEIGHTING_FLOOR is exactly 0.2 per plan.md §2.8", () => {
    expect(MODE_WEIGHTING_FLOOR).toBe(0.2);
  });
});

describe("selectMode / recordModeOutcome (DB-integrated)", () => {
  it("selectMode returns 'dark' or 'light' with no prior history", async () => {
    const mode = await selectMode(handle.db, "acct1");
    expect(["dark", "light"]).toContain(mode);
  });

  it("persists outcomes across calls and shifts weighting toward the more successful mode", async () => {
    for (let i = 0; i < 15; i++) {
      await recordModeOutcome(handle.db, "acct1", "dark", true);
      await recordModeOutcome(handle.db, "acct1", "light", false);
    }
    let darkCount = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      if ((await selectMode(handle.db, "acct1", Math.random)) === "dark") darkCount++;
    }
    expect(darkCount / trials).toBeGreaterThan(0.7);
  });

  it("caps the ring buffer at MODE_WEIGHTING_LOOKBACK_COUNT, letting old outcomes roll off", async () => {
    // Record 20 failures, then enough successes to fully displace them.
    // Inspect the stored bucket directly rather than inferring via
    // selectMode's randomness -- precise and not statistical.
    for (let i = 0; i < MODE_WEIGHTING_LOOKBACK_COUNT; i++) {
      await recordModeOutcome(handle.db, "acct1", "dark", false);
    }
    for (let i = 0; i < MODE_WEIGHTING_LOOKBACK_COUNT; i++) {
      await recordModeOutcome(handle.db, "acct1", "dark", true);
    }
    const raw = await getSetting(handle.db, "acct1", "mode_weighting");
    const buckets = JSON.parse(raw!) as Record<string, boolean[]>;
    expect(buckets.dark).toHaveLength(MODE_WEIGHTING_LOOKBACK_COUNT);
    expect(buckets.dark!.every(Boolean)).toBe(true);
  });

  it("scopes weighting per account (state transitions plane)", async () => {
    for (let i = 0; i < 15; i++) {
      await recordModeOutcome(handle.db, "acct-a", "dark", true);
      await recordModeOutcome(handle.db, "acct-a", "light", false);
    }
    // acct-b has no history at all -- should still be ~50/50, unaffected by acct-a's data.
    let darkCount = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      if ((await selectMode(handle.db, "acct-b", Math.random)) === "dark") darkCount++;
    }
    expect(darkCount / trials).toBeGreaterThan(0.35);
    expect(darkCount / trials).toBeLessThan(0.65);
  });
});

describe("selectCaptionTemplate / recordCaptionTemplateOutcome (DB-integrated)", () => {
  it("selects among the given candidate template ids", async () => {
    const picked = await selectCaptionTemplate(handle.db, "acct1", ["a", "b", "c"]);
    expect(["a", "b", "c"]).toContain(picked);
  });

  it("shifts weighting toward the more successful caption template", async () => {
    for (let i = 0; i < 15; i++) {
      await recordCaptionTemplateOutcome(handle.db, "acct1", "good", true);
      await recordCaptionTemplateOutcome(handle.db, "acct1", "bad", false);
    }
    let goodCount = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      if ((await selectCaptionTemplate(handle.db, "acct1", ["good", "bad"], Math.random)) === "good") {
        goodCount++;
      }
    }
    expect(goodCount / trials).toBeGreaterThan(0.7);
  });
});
