import path from "node:path";
import { defineConfig } from "vitest/config";

// Root-level config so `pnpm test` (run from repo root) discovers both
// packages/core/test/**/*.test.ts and apps/web/test/**/*.test.ts with no
// per-package config needed for the latter -- packages/core/vitest.config.ts
// still applies on its own when someone runs vitest with cwd=packages/core
// directly (unaffected by this file). The "@/*" alias mirrors
// apps/web/tsconfig.json's paths so apps/web's own test files can import
// "@/lib/..." the same way its app code does.
export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "apps/web"),
    },
  },
});
