import { z } from "zod";

// plan.md §7.1 lists JINA_API_KEY as required and the other three embedding
// providers as optional, but also states the invariant "at least one
// embeddings provider key must be present". Making all four individually
// optional and enforcing the "at least one" invariant via refine satisfies
// both: Jina-only (the common case) still works, and any other single
// provider also satisfies the actual rule instead of a hardcoded primary.
const hexKey64 = /^[0-9a-f]{64}$/i;

const envSchema = z
  .object({
    TOKEN_ENCRYPTION_KEY: z
      .string()
      .regex(hexKey64, "TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes) — generate with `openssl rand -hex 32`"),
    GOOGLE_CLOUD_VISION_API_KEY: z.string().min(1),
    UNSPLASH_ACCESS_KEY: z.string().min(1),
    DISCORD_WEBHOOK_URL: z.url(),
    JINA_API_KEY: z.string().min(1).optional(),
    COHERE_API_KEY: z.string().min(1).optional(),
    HUGGINGFACE_API_KEY: z.string().min(1).optional(),
    GEMINI_API_KEY: z.string().min(1).optional(),
    // Both are optional enhancements to the quote fallback chain, not
    // required -- DummyJSON/ZenQuotes/type.fit need no key at all, so the
    // chain still functions with neither configured (see quotes/provider.ts).
    API_NINJAS_KEY: z.string().min(1).optional(),
    THEY_SAID_SO_KEY: z.string().min(1).optional(),
    GH_PAT_FOR_SECRETS: z.string().min(1).optional(),
    COMPOSIO_API_KEY: z.string().min(1).optional(),
    PEXELS_API_KEY: z.string().min(1).optional(),
    PIXABAY_API_KEY: z.string().min(1).optional(),
    WEB_APP_URL: z.string().url().optional(),
  })
  .check((ctx) => {
    const { JINA_API_KEY, COHERE_API_KEY, HUGGINGFACE_API_KEY, GEMINI_API_KEY } = ctx.value;
    if (!JINA_API_KEY && !COHERE_API_KEY && !HUGGINGFACE_API_KEY && !GEMINI_API_KEY) {
      ctx.issues.push({
        code: "custom",
        message:
          "at least one embeddings provider key must be set: JINA_API_KEY, COHERE_API_KEY, HUGGINGFACE_API_KEY, or GEMINI_API_KEY",
        input: ctx.value,
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const sanitized: Record<string, string | undefined> = {};
  for (const [key, val] of Object.entries(source)) {
    if (val !== undefined && val.trim() !== "") {
      sanitized[key] = val.trim();
    }
  }
  const result = envSchema.safeParse(sanitized);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}
