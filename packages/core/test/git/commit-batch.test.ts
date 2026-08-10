import { describe, expect, it } from "vitest";
import { commitBatch, type GitRunner } from "../../src/git/commit-batch.js";

function fakeRunner(overrides: Partial<Record<string, (args: string[]) => { stdout: string; stderr: string }>> = {}) {
  const calls: string[][] = [];
  const runner: GitRunner = async (args) => {
    calls.push(args);
    const command = args[0] ?? "";
    const handler = overrides[command];
    if (handler) return handler(args);
    return { stdout: "", stderr: "" };
  };
  return { runner, calls };
}

describe("commitBatch", () => {
  it("returns committed:false and does not commit/push when there's nothing to commit", async () => {
    const { runner, calls } = fakeRunner({
      status: () => ({ stdout: "", stderr: "" }),
    });
    const result = await commitBatch({ cwd: "/repo", message: "msg", runner });
    expect(result).toEqual({ committed: false });
    expect(calls.some((c) => c[0] === "commit")).toBe(false);
    expect(calls.some((c) => c[0] === "push")).toBe(false);
  });

  it("stages, commits, and pushes when there are changes", async () => {
    const { runner, calls } = fakeRunner({
      status: () => ({ stdout: " M data/app.db\n", stderr: "" }),
    });
    const result = await commitBatch({ cwd: "/repo", message: "post-batch: acct1 2026-08-07", runner });
    expect(result).toEqual({ committed: true });
    expect(calls[0]).toEqual(["add", "data/"]);
    expect(calls.some((c) => c[0] === "commit" && c.includes("post-batch: acct1 2026-08-07"))).toBe(true);
    expect(calls.some((c) => c[0] === "push")).toBe(true);
  });

  it("sets the github-actions[bot] committer identity before committing", async () => {
    const { runner, calls } = fakeRunner({ status: () => ({ stdout: " M x", stderr: "" }) });
    await commitBatch({ cwd: "/repo", message: "m", runner });
    expect(calls).toContainEqual(["config", "user.name", "github-actions[bot]"]);
    expect(calls).toContainEqual(["config", "user.email", "github-actions[bot]@users.noreply.github.com"]);
  });

  it("retries once via pull --rebase + push on a push failure, and succeeds if the retry works", async () => {
    let pushAttempts = 0;
    const { runner, calls } = fakeRunner({
      status: () => ({ stdout: " M x", stderr: "" }),
      push: () => {
        pushAttempts++;
        if (pushAttempts === 1) throw new Error("rejected: non-fast-forward");
        return { stdout: "", stderr: "" };
      },
    });
    const result = await commitBatch({ cwd: "/repo", message: "m", runner });
    expect(result).toEqual({ committed: true });
    expect(pushAttempts).toBe(2);
    expect(calls.some((c) => c[0] === "pull" && c.includes("--rebase"))).toBe(true);
  });

  it("fails loudly (does not retry a second time) if the retried push also fails", async () => {
    const { runner } = fakeRunner({
      status: () => ({ stdout: " M x", stderr: "" }),
      push: () => {
        throw new Error("rejected: non-fast-forward");
      },
    });
    await expect(commitBatch({ cwd: "/repo", message: "m", runner })).rejects.toThrow(/non-fast-forward/);
  });

  it("never force-pushes (no --force flag in any push call)", async () => {
    const { runner, calls } = fakeRunner({ status: () => ({ stdout: " M x", stderr: "" }) });
    await commitBatch({ cwd: "/repo", message: "m", runner });
    const pushCalls = calls.filter((c) => c[0] === "push");
    for (const call of pushCalls) {
      expect(call).not.toContain("--force");
      expect(call).not.toContain("-f");
    }
  });
});
