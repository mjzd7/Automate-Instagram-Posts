import { Octokit } from "@octokit/rest";

export const RESTORABLE_PATHS = ["data/accounts.json", "data/categories.json"] as const;
export type RestorablePath = (typeof RESTORABLE_PATHS)[number];

export interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  date: string;
}

export interface ConfigHistoryApi {
  listCommits(path: RestorablePath): Promise<CommitInfo[]>;
  getContentAt(path: RestorablePath, sha: string): Promise<unknown>;
}

export function isRestorablePath(value: string): value is RestorablePath {
  return (RESTORABLE_PATHS as readonly string[]).includes(value);
}

function slug(): { owner: string; repo: string } {
  const [owner = "mjzd7", repo = "Automate-Instagram-Posts"] = (
    process.env.GITHUB_REPO_SLUG ?? "mjzd7/Automate-Instagram-Posts"
  ).split("/");
  return { owner, repo };
}

function githubHistory(pat: string | undefined): ConfigHistoryApi {
  if (!pat) {
    // Mirrors the writer: read-only history still needs repo access.
    throw new Error("config history requires DASHBOARD_GITHUB_PAT");
  }
  const octokit = new Octokit({ auth: pat });
  const { owner, repo } = slug();
  return {
    async listCommits(path) {
      const res = await octokit.rest.repos.listCommits({ owner, repo, path, per_page: 10 });
      return res.data.map((c) => ({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: c.commit.message.split("\n")[0] ?? "",
        date: c.commit.author?.date ?? new Date(0).toISOString(),
      }));
    },
    async getContentAt(path, sha) {
      const res = await octokit.rest.repos.getContent({ owner, repo, path, ref: sha });
      if (Array.isArray(res.data) || res.data.type !== "file") {
        throw new Error(`${path}@${sha} is not a file`);
      }
      return JSON.parse(Buffer.from(res.data.content, "base64").toString("utf-8"));
    },
  };
}

function localHistory(): ConfigHistoryApi {
  // e2e twin: a single synthetic revision representing current local state.
  const SYNTHETIC_SHA = "locall0c";
  return {
    async listCommits() {
      return [
        {
          sha: SYNTHETIC_SHA,
          shortSha: SYNTHETIC_SHA,
          message: "current local fixture state",
          date: new Date().toISOString(),
        },
      ];
    },
    async getContentAt(path) {
      const { readFile } = await import("node:fs/promises");
      const base = process.env.DATA_DIR ?? ".";
      return JSON.parse(await readFile(`${base}/${path}`, "utf-8"));
    },
  };
}

export function getConfigHistory(): ConfigHistoryApi {
  if (process.env.DASHBOARD_LOCAL_FS === "1") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DASHBOARD_LOCAL_FS config-history seam is e2e-only");
    }
    return localHistory();
  }
  return githubHistory(process.env.DASHBOARD_GITHUB_PAT);
}
