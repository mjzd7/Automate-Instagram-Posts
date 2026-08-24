import type { NextConfig } from "next";

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
    // /api/preview renders template samples by execFile'ing tsx against
    // scripts/render-preview.ts -- a child process the import tracer cannot
    // see. Without these the route 500s on Vercel (works locally, where the
    // full repo is on disk): the script, the core TS sources it imports, the
    // bundled font files, and the tsx/esbuild/sharp runtimes must all be
    // traced in. Globs are deliberately file-targeted -- recursive store
    // globs like ".pnpm/esbuild@*/**" make Turbopack panic trying to emit
    // nested package directories as files.
    "/api/preview": [
      "../../packages/core/scripts/render-preview.ts",
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
    ],
  },
  // Next 16 auto-writes its own AGENTS.md/CLAUDE.md into this directory on
  // every `next dev` run. This repo already has a deliberate root-level
  // AGENTS.md/CLAUDE.md (the project's governance contract) -- a second,
  // different, auto-generated one nested here would shadow it for anyone
  // working specifically in apps/web. Disabled.
  agentRules: false,
};

export default nextConfig;
