import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitRunner = (args: string[], cwd: string) => Promise<{ stdout: string; stderr: string }>;

const defaultRunner: GitRunner = (args, cwd) => execFileAsync("git", args, { cwd });

export interface CommitBatchOptions {
  cwd: string;
  message: string;
  runner?: GitRunner;
}

export interface CommitBatchResult {
  committed: boolean;
}

/**
 * Stages data/, commits (if there's anything to commit), and pushes, per
 * plan.md §7.21/§2.9. Uses execFile with an args array (not a raw shell
 * string) to avoid any command-injection surface from the commit message.
 * On a push rejection (e.g. another account's batch pushed in between this
 * job's add and push), retries exactly once via pull --rebase + push
 * (GIT_PUSH_CONFLICT_RETRY_COUNT=1) before failing loudly -- never a
 * force-push.
 */
export async function commitBatch(options: CommitBatchOptions): Promise<CommitBatchResult> {
  const { cwd, message } = options;
  const run = options.runner ?? defaultRunner;

  await run(["add", "data/"], cwd);

  const status = await run(["status", "--porcelain"], cwd);
  if (status.stdout.trim() === "") {
    return { committed: false };
  }

  await run(["config", "user.name", "github-actions[bot]"], cwd);
  await run(["config", "user.email", "github-actions[bot]@users.noreply.github.com"], cwd);
  await run(["commit", "-m", message], cwd);

  let branch = "main";
  try {
    const branchRes = await run(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
    if (branchRes.stdout.trim() && branchRes.stdout.trim() !== "HEAD") {
      branch = branchRes.stdout.trim();
    }
  } catch {}

  try {
    await run(["push", "origin", branch], cwd);
  } catch {
    try {
      await run(["pull", "--rebase", "--autostash", "origin", branch], cwd);
    } catch {
      try {
        await run(["checkout", "--theirs", "data/app.db"], cwd);
        await run(["add", "data/app.db"], cwd);
        await run(["rebase", "--continue"], cwd);
      } catch {
        try {
          await run(["rebase", "--abort"], cwd);
        } catch {}
        throw new Error("commitBatch: git pull --rebase failed");
      }
    }
    await run(["push", "origin", branch], cwd);
  }

  return { committed: true };
}
