import { Octokit } from "@octokit/rest";
import { getDashboardEnv } from "./env";

// Deliberately a minimal hand-written shape (not `Pick<Octokit["rest"]["repos"], ...>`)
// covering only what this module actually calls -- Octokit's real method types are
// heavily overloaded/branded per-endpoint, which would make test fakes need
// unsafe casts to satisfy; this interface is what both the real client and a
// test fake can genuinely implement.
export interface ContentsApi {
  getContent: (params: {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
  }) => Promise<{ data: { type: string; sha: string } | unknown[] }>;
  createOrUpdateFileContents: (params: {
    owner: string;
    repo: string;
    path: string;
    message: string;
    content: string;
    sha?: string;
    branch?: string;
  }) => Promise<unknown>;
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && (error as { status: unknown }).status === 404;
}

/**
 * Writes a JSON file to the repo via GitHub's Contents API (verified live
 * against docs.github.com/en/rest/repos/contents): GET the current file for
 * its `sha` (omit `sha` entirely if the file doesn't exist yet -- a 404 here
 * means "create", not an error), then PUT the new base64-encoded content.
 * Every call is a real commit to the target repo/branch.
 */
export async function writeJsonFile(
  path: string,
  data: unknown,
  message: string,
  client?: ContentsApi,
): Promise<void> {
  const { DASHBOARD_GITHUB_PAT, GITHUB_REPO_SLUG, GITHUB_BRANCH } = getDashboardEnv();
  if (!DASHBOARD_GITHUB_PAT || !GITHUB_REPO_SLUG) {
    throw new Error(
      "writeJsonFile: DASHBOARD_GITHUB_PAT and GITHUB_REPO_SLUG are required for GitHub write-back (set them, or use the DASHBOARD_LOCAL_FS e2e writer)",
    );
  }
  const [owner, repo] = GITHUB_REPO_SLUG.split("/");
  if (!owner || !repo) {
    throw new Error(`writeJsonFile: GITHUB_REPO_SLUG must be "owner/repo", got "${GITHUB_REPO_SLUG}"`);
  }

  const repos = client ?? new Octokit({ auth: DASHBOARD_GITHUB_PAT }).rest.repos;

  let sha: string | undefined;
  try {
    const existing = await repos.getContent({ owner, repo, path, ref: GITHUB_BRANCH });
    if (!Array.isArray(existing.data) && existing.data.type === "file") {
      sha = existing.data.sha;
    }
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  const content = Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf-8").toString("base64");
  await repos.createOrUpdateFileContents({ owner, repo, path, message, content, sha, branch: GITHUB_BRANCH });
}
