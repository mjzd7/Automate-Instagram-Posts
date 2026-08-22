import { describe, expect, it } from "vitest";
import type { Account } from "../../src/config/accounts.js";
import {
  generateMonth,
  pipelineSeed,
  regenerateMonth,
  selectHours,
  type PipelineEntry,
  type PipelineFile,
} from "../../src/schedule/generator.js";
import { daysInMonth, localDateIso, localHour, resolveWallTime } from "../../src/schedule/wall-time.js";

const FROZEN = () => new Date("2026-08-23T00:00:00Z");
const TEMPLATES = ["bold-modern", "editorial-elegant", "soft-curvy"];

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "a1",
    igUserId: "ig",
    fbPageId: "fb",
    threadsUserId: null,
    categoryFocus: ["motivational", "stoic"],
    timezone: "UTC",
    postingHoursLocal: [9, 13, 18],
    active: true,
    ...overrides,
  };
}

describe("wall-time Intl conversions", () => {
  it("skips spring-forward nonexistent hours (America/New_York 2026-03-08)", () => {
    expect(resolveWallTime("2026-03-08", 2, "America/New_York").exists).toBe(false);
    expect(resolveWallTime("2026-03-08", 1, "America/New_York").exists).toBe(true);
    expect(resolveWallTime("2026-03-08", 3, "America/New_York").exists).toBe(true);
  });

  it("schedules ambiguous fall-back hours once, at the earlier occurrence", () => {
    const r = resolveWallTime("2026-11-01", 1, "America/New_York");
    expect(r.exists).toBe(true);
    // Earlier occurrence is EDT (UTC-4): 06:00Z, not 07:00Z.
    expect(r.instant.toISOString()).toBe("2026-11-01T05:00:00.000Z");
    const aucklandFall = resolveWallTime("2026-04-05", 2, "Pacific/Auckland");
    expect(aucklandFall.exists).toBe(true);
    const aucklandSpring = resolveWallTime("2026-09-27", 2, "Pacific/Auckland");
    expect(aucklandSpring.exists).toBe(false);
  });

  it("round-trips instants through the same zone", () => {
    const r = resolveWallTime("2026-05-14", 17, "Asia/Kolkata");
    expect(localDateIso(r.instant, "Asia/Kolkata")).toBe("2026-05-14");
    expect(localHour(r.instant, "Asia/Kolkata")).toBe(17);
  });

  it("handles half-hour and 45-minute zones", () => {
    for (const tz of ["Australia/Eucla", "Pacific/Chatham", "Asia/Kathmandu"]) {
      const r = resolveWallTime("2026-06-01", 9, tz);
      expect(localHour(r.instant, tz)).toBe(9);
    }
  });

  it("daysInMonth is leap-year correct", () => {
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2026-12")).toBe(31);
  });
});

describe("selectHours greedy max-min-gap", () => {
  it("returns everything when cap covers the set", () => {
    expect(selectHours([9, 13, 18], 3)).toEqual([9, 13, 18]);
  });

  it("spreads deterministically under cap and stays inside the source set", () => {
    const source = [0, 1, 2, 3, 4, 5, 6, 7, 20, 21, 22, 23];
    for (let cap = 1; cap <= 11; cap += 1) {
      const picked = selectHours(source, cap);
      expect(picked).toHaveLength(cap);
      expect(picked.every((h) => source.includes(h))).toBe(true);
      expect([...new Set(picked)]).toEqual(picked);
    }
    expect(selectHours([9, 10, 11, 20, 21], 2)).toEqual([9, 21]);
    expect(selectHours([], 3)).toEqual([]);
    expect(selectHours([5], 0)).toEqual([]);
  });
});

describe("generateMonth determinism and invariants", () => {
  const accounts = [
    account({ id: "ny", timezone: "America/New_York", postingHoursLocal: [2, 9, 13, 18] }),
    account({ id: "nz", timezone: "Pacific/Auckland", postingHoursLocal: [2, 10] }),
    account({ id: "utc-capped", timezone: "UTC", postingHoursLocal: [0, 3, 6, 9, 12, 15, 18, 21], dailyCap: 3 }),
  ];

  it("is deterministic given frozen now", () => {
    const a = generateMonth("2026-09", accounts, { templateIdsArray: TEMPLATES, now: FROZEN });
    const b = generateMonth("2026-09", accounts, { templateIdsArray: TEMPLATES, now: FROZEN });
    expect(b).toEqual(a);
    expect(a.seed).toBe(pipelineSeed("2026-09", accounts));
  });

  it("never emits DST-gap hours but keeps neighbouring days intact", () => {
    const ny = account({ id: "ny", timezone: "America/New_York", postingHoursLocal: [2, 9, 13, 18] });
    const file = generateMonth("2026-03", [ny], { templateIdsArray: TEMPLATES, now: FROZEN });
    expect(file.entries.some((e) => e.date === "2026-03-08" && e.hour === 2)).toBe(false);
    expect(file.entries.some((e) => e.date === "2026-03-07" && e.hour === 2)).toBe(true);
    expect(file.entries.some((e) => e.date === "2026-03-09" && e.hour === 2)).toBe(true);
  });

  it("emits ambiguous fall-back hours exactly once", () => {
    for (const month of ["2026-11", "2026-04"]) {
      const nzAccount = generateMonth(month, [account({ id: "nz2", timezone: "Pacific/Auckland", postingHoursLocal: [2, 10] })], { templateIdsArray: TEMPLATES, now: FROZEN });
      const counts = new Map<string, number>();
      for (const entry of nzAccount.entries) counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
      expect([...counts.values()].every((n) => n === 1)).toBe(true);
    }
  });

  it("respects dailyCap, blackouts, pause, inactive and category rotation", () => {
    const mixed = [
      account({ id: "cap", postingHoursLocal: [1, 2, 3, 4, 5], dailyCap: 2 }),
      account({ id: "blackout", blackoutDates: ["2026-06-15"] }),
      account({ id: "paused", paused: true }),
      account({ id: "off", active: false }),
    ];
    const file = generateMonth("2026-06", mixed, { templateIdsArray: TEMPLATES, now: FROZEN });
    const perDayCap = file.entries.filter((e) => e.accountId === "cap" && e.date === "2026-06-10");
    expect(perDayCap).toHaveLength(2);
    expect(file.entries.some((e) => e.accountId === "blackout" && e.date === "2026-06-15")).toBe(false);
    expect(file.entries.filter((e) => e.date === "2026-06-16" && e.accountId === "blackout").length).toBeGreaterThan(0);
    expect(file.entries.some((e) => e.accountId === "paused")).toBe(false);
    expect(file.entries.some((e) => e.accountId === "off")).toBe(false);
    const rotator = generateMonth("2026-06", [account({ id: "rot" })], { templateIdsArray: TEMPLATES, now: FROZEN });
    const day1 = rotator.entries.find((e) => e.date === "2026-06-01");
    const day2 = rotator.entries.find((e) => e.date === "2026-06-02");
    expect(day1?.categoryId).toBe("motivational");
    expect(day2?.categoryId).toBe("stoic");
  });

  it("generates every day including leap Februaries", () => {
    const file = generateMonth("2028-02", [account()], { templateIdsArray: TEMPLATES, now: FROZEN });
    expect(new Set(file.entries.map((e) => e.date))).toHaveLength(29);
  });

  it("filters enabledTemplates against known templates", () => {
    const acc = account({ enabledTemplates: ["soft-curvy", "does-not-exist"] });
    const file = generateMonth("2026-07", [acc], { templateIdsArray: TEMPLATES, now: FROZEN });
    expect(file.entries.every((e) => e.templateId === "soft-curvy")).toBe(true);
  });

  it("keeps every entry unique by id across the whole month", () => {
    const file = generateMonth("2026-09", accounts, { templateIdsArray: TEMPLATES, now: FROZEN });
    expect(new Set(file.entries.map((e) => e.id)).size).toBe(file.entries.length);
  });
});

describe("regenerateMonth contract", () => {
  const gen = (): PipelineFile =>
    generateMonth("2026-09", [account({ id: "a1", postingHoursLocal: [9, 17] })], {
      templateIdsArray: TEMPLATES,
      now: FROZEN,
    });

  it("preserves executed rows whose slot vanished, prunes only planned", () => {
    const original = gen();
    const firstEntry = original.entries[0];
    if (!firstEntry) throw new Error("expected entries");
    const published: PipelineEntry = { ...firstEntry, status: "published" };
    const withHistory: PipelineFile = {
      ...original,
      entries: original.entries.map((e): PipelineEntry => (e.id === published.id ? published : e)),
    };
    const shrunk = generateMonth(
      "2026-09",
      [account({ id: "a1", postingHoursLocal: [9] })],
      { templateIdsArray: TEMPLATES, now: FROZEN },
    );
    const merged = regenerateMonth(withHistory, shrunk);
    expect(merged.entries.some((e) => e.id === published.id && e.status === "published")).toBe(true);
    expect(merged.entries.some((e) => e.hour === 17 && e.status === "planned")).toBe(false);
  });

  it("adds genuinely new slots without duplicating surviving ones", () => {
    const original = gen();
    const grown = generateMonth(
      "2026-09",
      [account({ id: "a1", postingHoursLocal: [9, 17, 21] })],
      { templateIdsArray: TEMPLATES, now: FROZEN },
    );
    const merged = regenerateMonth(original, grown);
    const ids = merged.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(grown.entries.length);
  });
});
