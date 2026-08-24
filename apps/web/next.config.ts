import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/core is a workspace TS-source package (no build step) -- Next
  // only transpiles its own app code by default, so external workspace deps
  // need to be listed explicitly to get processed through the same pipeline.
  transpilePackages: ["core"],
  // Runtime fs reads of the runner-committed data files must ship inside
  // every serverless bundle -- import tracing cannot see them.
  outputFileTracingIncludes: {
    "/**": ["../../data/**"],
  },
  // Next 16 auto-writes its own AGENTS.md/CLAUDE.md into this directory on
  // every `next dev` run. This repo already has a deliberate root-level
  // AGENTS.md/CLAUDE.md (the project's governance contract) -- a second,
  // different, auto-generated one nested here would shadow it for anyone
  // working specifically in apps/web. Disabled.
  agentRules: false,
};

export default nextConfig;
