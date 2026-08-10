import { afterEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
const getCategoriesMock = vi.fn();
const writeJsonFileMock = vi.fn();

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/db", () => ({ getCategories: getCategoriesMock }));
vi.mock("@/lib/github-content", () => ({ writeJsonFile: writeJsonFileMock }));

const { saveCategory, deleteCategory } = await import("../../../lib/actions/categories");

const existingCategory = { id: "motivational", name: "Motivational", description: "General encouragement", active: true };

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  return fd;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("saveCategory", () => {
  it("appends a new category, converting an empty description to undefined", async () => {
    getCategoriesMock.mockResolvedValue([existingCategory]);

    await saveCategory(formData({ originalId: "", id: "humor", name: "Humor", description: "", active: "on" }));

    const [path, data, message] = writeJsonFileMock.mock.calls[0]!;
    expect(path).toBe("data/categories.json");
    expect(data).toHaveLength(2);
    expect(data[1]).toMatchObject({ id: "humor", name: "Humor" });
    expect(data[1].description).toBeUndefined();
    expect(message).toContain("add category humor");
    expect(redirectMock).toHaveBeenCalledWith("/categories");
  });

  it("replaces the matching category when originalId is set", async () => {
    getCategoriesMock.mockResolvedValue([existingCategory]);

    await saveCategory(
      formData({ originalId: "motivational", id: "motivational", name: "Renamed", description: "", active: "" }),
    );

    const [, data] = writeJsonFileMock.mock.calls[0]!;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: "motivational", name: "Renamed", active: false });
  });

  it("redirects with an error and never writes when the id is empty", async () => {
    getCategoriesMock.mockResolvedValue([]);
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      saveCategory(formData({ originalId: "", id: "", name: "No id", description: "", active: "on" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(writeJsonFileMock).not.toHaveBeenCalled();
    expect(redirectMock.mock.calls[0]?.[0]).toContain("/categories?error=");
  });
});

describe("deleteCategory", () => {
  it("writes the array with the matching id removed", async () => {
    getCategoriesMock.mockResolvedValue([existingCategory, { ...existingCategory, id: "humor", name: "Humor" }]);

    await deleteCategory(formData({ id: "humor" }));

    const [path, data] = writeJsonFileMock.mock.calls[0]!;
    expect(path).toBe("data/categories.json");
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("motivational");
    expect(redirectMock).toHaveBeenCalledWith("/categories");
  });
});
