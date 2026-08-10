function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`apps/web env: missing required var ${name} (see .env.example)`);
  }
  return value;
}

/**
 * Dashboard's own env surface (distinct from packages/core's pipeline env,
 * config/env.ts) -- deliberately not zod-validated like core's, since
 * apps/web doesn't otherwise depend on zod and this is a handful of plain
 * strings, not a provider fallback-chain config.
 */
export function getDashboardEnv() {
  return {
    NEXTAUTH_SECRET: required("NEXTAUTH_SECRET"),
    DASHBOARD_PASSWORD_HASH: required("DASHBOARD_PASSWORD_HASH"),
    DASHBOARD_GITHUB_PAT: required("DASHBOARD_GITHUB_PAT"),
    GITHUB_REPO_SLUG: required("GITHUB_REPO_SLUG"),
    GITHUB_BRANCH: process.env.GITHUB_BRANCH ?? "main",
  };
}
