import { readFile, writeFile } from "node:fs/promises";
import { Octokit } from "@octokit/rest";

export interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  createdAt: string;
  htmlUrl: string;
}

export interface RunnerApi {
  dispatchPost(): Promise<void>;
  listRecentRuns(): Promise<WorkflowRun[]>;
}

export class RunnerUnavailableError extends Error {}

function githubRunner(): RunnerApi {
  const pat = process.env.DASHBOARD_ACTIONS_PAT;
  if (!pat) {
    throw new RunnerUnavailableError(
      "DASHBOARD_ACTIONS_PAT is not set. Create a fine-grained PAT with Actions: write on this repository and add it to the environment to enable run dispatch.",
    );
  }
  const octokit = new Octokit({ auth: pat });
  const slug = process.env.GITHUB_REPO_SLUG ?? "mjzd7/Automate-Instagram-Posts";
  const [owner, repo] = slug.split("/");
  if (!owner || !repo) throw new RunnerUnavailableError(`GITHUB_REPO_SLUG must be "owner/repo", got "${slug}"`);
  const branch = process.env.GITHUB_BRANCH ?? "main";
  return {
    async dispatchPost() {
      await octokit.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: "post.yml",
        ref: branch,
      });
    },
    async listRecentRuns() {
      const res = await octokit.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: "post.yml",
        per_page: 5,
      });
      return res.data.workflow_runs.map((run) => ({
        id: run.id,
        status: run.status ?? "unknown",
        conclusion: run.conclusion,
        createdAt: run.created_at,
        htmlUrl: run.html_url,
      }));
    },
  };
}

function localRunner(): RunnerApi {
  return {
    async dispatchPost() {
      // e2e seam: record intent locally; prod builds must never get here.
      const base = process.env.DATA_DIR ?? ".";
      await writeFile(
        `${base}/data/.runner-dispatch.json`,
        `${JSON.stringify({ dispatchedAt: new Date().toISOString() })}\n`,
        "utf-8",
      );
    },
    async listRecentRuns() {
      const base = process.env.DATA_DIR ?? ".";
      try {
        const raw = JSON.parse(await readFile(`${base}/data/.runner-dispatch.json`, "utf-8")) as {
          dispatchedAt?: string;
        };
        if (!raw.dispatchedAt) return [];
        return [
          {
            id: 0,
            status: "queued",
            conclusion: null,
            createdAt: raw.dispatchedAt,
            htmlUrl: "#",
          },
        ];
      } catch {
        return [];
      }
    },
  };
}

export function getRunner(): RunnerApi {
  if (process.env.DASHBOARD_LOCAL_FS === "1") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DASHBOARD_LOCAL_FS runner seam is e2e-only");
    }
    return localRunner();
  }
  return githubRunner();
}
