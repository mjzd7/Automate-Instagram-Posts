import bcryptjs from "bcryptjs";
import { defineConfig } from "@playwright/test";
import path from "node:path";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;
export const FIXTURES_ROOT = path.resolve(__dirname, "e2e/fixtures");

process.env.DATA_DIR = FIXTURES_ROOT;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  outputDir: path.resolve(__dirname, "test-results"),
  use: {
    baseURL,
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { storageState: undefined },
    },
    {
      name: "e2e",
      dependencies: ["setup"],
      use: { storageState: path.resolve(__dirname, "e2e/.auth/state.json") },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXTAUTH_SECRET: "e2e-only-secret-not-used-in-prod",
      DASHBOARD_PASSWORD_HASH: bcryptjs.hashSync("e2e-passwd", 10),
      DASHBOARD_LOCAL_FS: "1",
      DATA_DIR: FIXTURES_ROOT,
      DATABASE_PATH: path.join(FIXTURES_ROOT, "data", "app.db"),
      GITHUB_BRANCH: "main",
    },
  },
});
