import type { NextConfig } from "next";

// Child-process runtime pieces (tsx CLI, esbuild, sharp natives, core TS
// sources + fonts) shared by every route that shells into packages/core.
// File-targeted globs only -- recursive store globs like ".pnpm/esbuild@*/**"
// make Turbopack panic trying to emit nested package directories as files.
const CHILD_PROCESS_TRACING = [
  "../../packages/core/scripts/render-preview.ts",
  "../../packages/core/scripts/explain-background.ts",
  "../../packages/core/src/**",
  "../../node_modules/.pnpm/tsx@*/node_modules/tsx/dist/**",
  "../../node_modules/.pnpm/tsx@*/node_modules/tsx/package.json",
  "../../node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild",
  "../../node_modules/.pnpm/esbuild@*/node_modules/esbuild/lib/**",
  "../../node_modules/.pnpm/esbuild@*/node_modules/esbuild/package.json",
  "../../node_modules/.pnpm/@esbuild+*/node_modules/@esbuild/*/bin/esbuild",
  "../../node_modules/.pnpm/@esbuild+*/node_modules/@esbuild/*/package.json",
  "../../node_modules/.pnpm/sharp@*/node_modules/sharp/lib/**",
  "../../node_modules/.pnpm/sharp@*/node_modules/sharp/src/**",
  "../../node_modules/.pnpm/sharp@*/node_modules/sharp/vendor/**",
  "../../node_modules/.pnpm/sharp@*/node_modules/sharp/package.json",
  "../../node_modules/.pnpm/@img+*/node_modules/@img/*/lib/*.node",
  "../../node_modules/.pnpm/@img+*/node_modules/@img/*/package.json",
];

const nextConfig: NextConfig = {
  // packages/core is a workspace TS-source package (no build step) -- Next
  // only transpiles its own app code by default, so external workspace deps
  // need to be listed explicitly to get processed through the same pipeline.
  transpilePackages: ["core"],
  // Runtime fs reads of the runner-committed data files must ship inside
  // every serverless bundle -- import tracing cannot see them.
  outputFileTracingIncludes: {
    "/**": [
      "../../data/app.db",
      "../../data/*.json",
      "../../data/pipeline/**",
    ],
    // /api/preview + /preview (background explainer) shell out to core
    // scripts -- a child process the import tracer cannot see.
    "/api/preview": CHILD_PROCESS_TRACING,
    "/preview": CHILD_PROCESS_TRACING,
  },
  // Next 16 auto-writes its own AGENTS.md/CLAUDE.md into this directory on
  // every `next dev` run. This repo already has a deliberate root-level
  // AGENTS.md/CLAUDE.md (the project's governance contract) -- a second,
  // different, auto-generated one nested here would shadow it for anyone
  // working specifically in apps/web. Disabled.
  agentRules: false,
};

export default nextConfig;
