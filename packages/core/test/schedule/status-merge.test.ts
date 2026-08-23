import { describe, expect, it } from "vitest";
import { mergeStatuses, parseStatuses, statusKey, zipStatuses } from "../../src/schedule/status-merge.js";

const due = [{ id: "a:2026-12-01:9" }, { id: "a:2026-12-01:13" }, { id: "a:2026-12-01:18" }];

describe("zipStatuses", () => {
  it("records terminal statuses by index", () => {
    expect(zipStatuses(due, [{ status: "published" }, { status: "failed" }, { status: "skipped" }])).toEqual({
      "a:2026-12-01:9": "published",
      "a:2026-12-01:13": "failed",
      "a:2026-12-01:18": "skipped",
    });
  });

  it("leaves never-attempted entries unrecorded on early abort", () => {
    expect(zipStatuses(due, [{ status: "published" }])).toEqual({ "a:2026-12-01:9": "published" });
    expect(zipStatuses(due, [])).toEqual({});
  });

  it("ignores non-terminal statuses like composed-only dry runs", () => {
    expect(zipStatuses(due.slice(0, 1), [{ status: "composed" }])).toEqual({});
  });
});

describe("merge + parse round trip", () => {
  it("accumulates across runs without losing history", () => {
    const first = zipStatuses(due.slice(0, 2), [{ status: "published" }, { status: "failed" }]);
    const second = zipStatuses(due.slice(2), [{ status: "published" }]);
    const merged = mergeStatuses(first, second);
    expect(Object.keys(merged)).toHaveLength(3);
  });

  it("tolerates corrupt or empty stored values", () => {
    expect(parseStatuses(undefined)).toEqual({});
    expect(parseStatuses("not json")).toEqual({});
    expect(parseStatuses('{"x":"published"}')).toEqual({ x: "published" });
  });

  it("keys by month", () => {
    expect(statusKey("2026-12")).toBe("statuses:2026-12");
  });
});
