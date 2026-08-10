import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeJsonFile } from "../../lib/github-content";

const baseEnv = {
  DASHBOARD_GITHUB_PAT: "fake-pat",
  GITHUB_REPO_SLUG: "owner/repo",
  NEXTAUTH_SECRET: "secret",
  DASHBOARD_PASSWORD_HASH: "hash",
};

beforeEach(() => {
  Object.assign(process.env, baseEnv);
});

afterEach(() => {
  for (const key of Object.keys(baseEnv)) delete process.env[key];
  delete process.env.GITHUB_BRANCH;
  vi.restoreAllMocks();
});

describe("writeJsonFile", () => {
  it("fetches the current sha and PUTs an update when the file already exists", async () => {
    const getContent = vi.fn().mockResolvedValue({ data: { type: "file", sha: "abc123" } });
    const createOrUpdateFileContents = vi.fn().mockResolvedValue({});

    await writeJsonFile("data/accounts.json", [{ id: "main" }], "update accounts", {
      getContent,
      createOrUpdateFileContents,
    });

    expect(getContent).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      path: "data/accounts.json",
      ref: "main",
    });
    const putCall = createOrUpdateFileContents.mock.calls[0]?.[0];
    expect(putCall.sha).toBe("abc123");
    expect(putCall.message).toBe("update accounts");
    expect(putCall.branch).toBe("main");
    expect(Buffer.from(putCall.content, "base64").toString("utf-8")).toContain('"id": "main"');
  });

  it("creates the file without a sha when getContent 404s", async () => {
    const getContent = vi.fn().mockRejectedValue({ status: 404 });
    const createOrUpdateFileContents = vi.fn().mockResolvedValue({});

    await writeJsonFile("data/categories.json", [], "create categories", {
      getContent,
      createOrUpdateFileContents,
    });

    const putCall = createOrUpdateFileContents.mock.calls[0]?.[0];
    expect(putCall.sha).toBeUndefined();
  });

  it("propagates a non-404 getContent error rather than treating it as create-new", async () => {
    const getContent = vi.fn().mockRejectedValue({ status: 403 });
    const createOrUpdateFileContents = vi.fn();

    await expect(
      writeJsonFile("data/accounts.json", [], "msg", { getContent, createOrUpdateFileContents }),
    ).rejects.toEqual({ status: 403 });
    expect(createOrUpdateFileContents).not.toHaveBeenCalled();
  });

  it("throws a clear error for a malformed GITHUB_REPO_SLUG", async () => {
    process.env.GITHUB_REPO_SLUG = "not-a-slug";
    await expect(
      writeJsonFile("data/accounts.json", [], "msg", {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
      }),
    ).rejects.toThrow(/GITHUB_REPO_SLUG/);
  });

  it("defaults GITHUB_BRANCH to main when unset", async () => {
    const getContent = vi.fn().mockResolvedValue({ data: { type: "file", sha: "s" } });
    const createOrUpdateFileContents = vi.fn().mockResolvedValue({});
    await writeJsonFile("data/accounts.json", [], "msg", { getContent, createOrUpdateFileContents });
    expect(createOrUpdateFileContents.mock.calls[0]?.[0].branch).toBe("main");
  });
});
