import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findAccount, loadAccounts, parseAccounts } from "../../src/config/accounts.js";

const fixturePath = fileURLToPath(
  new URL("../fixtures/accounts.sample.json", import.meta.url),
);

function validAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "main",
    igUserId: "17841400000000000",
    fbPageId: "102900000000000",
    threadsUserId: null,
    categoryFocus: ["motivational"],
    timezone: "America/New_York",
    postingHoursLocal: [10, 13, 17, 20],
    active: true,
    ...overrides,
  };
}

describe("parseAccounts", () => {
  it("accepts a valid accounts array", () => {
    const accounts = parseAccounts([validAccount()]);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.id).toBe("main");
  });

  it("accepts a null threadsUserId (configuration plane: Threads not linked)", () => {
    const accounts = parseAccounts([validAccount({ threadsUserId: null })]);
    expect(accounts[0]?.threadsUserId).toBeNull();
  });

  it("rejects an out-of-range posting hour (edge case plane: boundary 0-23)", () => {
    expect(() => parseAccounts([validAccount({ postingHoursLocal: [24] })])).toThrow(
      /postingHoursLocal/,
    );
  });

  it("rejects an empty categoryFocus array (input validation plane: empty)", () => {
    expect(() => parseAccounts([validAccount({ categoryFocus: [] })])).toThrow(
      /categoryFocus/,
    );
  });

  it("rejects a non-array top-level value (input validation plane: wrong type)", () => {
    expect(() => parseAccounts(validAccount())).toThrow();
  });
});

describe("loadAccounts", () => {
  it("reads and parses a real accounts.json fixture from disk", async () => {
    const accounts = await loadAccounts(fixturePath);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.postingHoursLocal).toEqual([10, 13, 17, 20]);
  });

  it("rejects a missing file with a clear error (external deps plane: filesystem failure)", async () => {
    await expect(loadAccounts("/nonexistent/path/accounts.json")).rejects.toThrow();
  });
});

describe("findAccount", () => {
  const accounts = parseAccounts([validAccount({ id: "main" }), validAccount({ id: "second" })]);

  it("returns the matching account", () => {
    expect(findAccount(accounts, "second").id).toBe("second");
  });

  it("throws a clear error when the account id doesn't exist (state transitions plane)", () => {
    expect(() => findAccount(accounts, "missing")).toThrow(/missing/);
  });
});
