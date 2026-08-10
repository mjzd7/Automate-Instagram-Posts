import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
const getAccountsMock = vi.fn();
const writeJsonFileMock = vi.fn();

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/db", () => ({ getAccounts: getAccountsMock }));
vi.mock("@/lib/github-content", () => ({ writeJsonFile: writeJsonFileMock }));

const { saveAccount, deleteAccount } = await import("../../../lib/actions/accounts");

const existingAccount = {
  id: "main",
  igUserId: "1",
  fbPageId: "2",
  threadsUserId: null,
  categoryFocus: ["motivational"],
  timezone: "UTC",
  postingHoursLocal: [10],
  active: true,
};

function formData(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("saveAccount", () => {
  it("appends a new account and writes the full updated array", async () => {
    getAccountsMock.mockResolvedValue([existingAccount]);

    await saveAccount(
      formData({
        originalId: "",
        id: "second",
        igUserId: "3",
        fbPageId: "4",
        threadsUserId: "",
        timezone: "America/New_York",
        postingHoursLocal: "10, 13, 17",
        categoryFocus: ["stoic"],
        active: "on",
      }),
    );

    expect(writeJsonFileMock).toHaveBeenCalledTimes(1);
    const [path, data, message] = writeJsonFileMock.mock.calls[0]!;
    expect(path).toBe("data/accounts.json");
    expect(data).toHaveLength(2);
    expect(data[1]).toMatchObject({ id: "second", postingHoursLocal: [10, 13, 17], threadsUserId: null });
    expect(message).toContain("add account second");
    expect(redirectMock).toHaveBeenCalledWith("/accounts");
  });

  it("replaces the matching account (by originalId), not appends, when editing", async () => {
    getAccountsMock.mockResolvedValue([existingAccount]);

    await saveAccount(
      formData({
        originalId: "main",
        id: "main",
        igUserId: "1",
        fbPageId: "2",
        threadsUserId: "",
        timezone: "UTC",
        postingHoursLocal: "9",
        categoryFocus: ["wisdom"],
        active: "on",
      }),
    );

    const [, data] = writeJsonFileMock.mock.calls[0]!;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: "main", postingHoursLocal: [9], categoryFocus: ["wisdom"] });
  });

  it("redirects with an error and never writes when validation fails", async () => {
    getAccountsMock.mockResolvedValue([]);
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      saveAccount(
        formData({
          originalId: "",
          id: "", // invalid: empty id
          igUserId: "1",
          fbPageId: "2",
          threadsUserId: "",
          timezone: "UTC",
          postingHoursLocal: "10",
          active: "on",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(writeJsonFileMock).not.toHaveBeenCalled();
    expect(redirectMock.mock.calls[0]?.[0]).toContain("/accounts?error=");
  });

  it("maps an out-of-range posting hour to a validation error, not a silent write", async () => {
    getAccountsMock.mockResolvedValue([]);
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      saveAccount(
        formData({
          originalId: "",
          id: "x",
          igUserId: "1",
          fbPageId: "2",
          threadsUserId: "",
          timezone: "UTC",
          postingHoursLocal: "25", // invalid: out of 0-23 range
          active: "on",
        }),
      ),
    ).rejects.toThrow();

    expect(writeJsonFileMock).not.toHaveBeenCalled();
  });
});

describe("deleteAccount", () => {
  it("writes the array with the matching id removed", async () => {
    getAccountsMock.mockResolvedValue([existingAccount, { ...existingAccount, id: "second" }]);

    await deleteAccount(formData({ id: "second" }));

    const [path, data] = writeJsonFileMock.mock.calls[0]!;
    expect(path).toBe("data/accounts.json");
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("main");
    expect(redirectMock).toHaveBeenCalledWith("/accounts");
  });
});
