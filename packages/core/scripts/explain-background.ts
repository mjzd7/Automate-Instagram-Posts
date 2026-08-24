import { fileURLToPath } from "node:url";
import { openDb } from "../src/db/client.js";
import { getCandidateBackgrounds } from "../src/images/background-provider.js";
import { matchBestBackground } from "../src/matching/image-quote-matcher.js";
import { loadEnv } from "../src/config/env.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function argAll(name: string): string[] {
  const values: string[] = [];
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}`) {
      const value = argv[i + 1];
      if (value !== undefined) values.push(value);
    }
  }
  return values;
}

async function main() {
  const quote = arg("quote") ?? "";
  const mode = arg("mode") === "light" ? "light" : "dark";
  const category = arg("category") ?? "general";
  const accountId = arg("account") ?? "main";
  const excludeUrls = argAll("exclude-url");
  const env = loadEnv();

  const dbHandle = await openDb(`file:${repoRoot}/data/app.db`);
  try {
    const gathered = await getCandidateBackgrounds(dbHandle.db, accountId, category, 8, {
      visionApiKey: env.GOOGLE_CLOUD_VISION_API_KEY,
      unsplashAccessKey: env.UNSPLASH_ACCESS_KEY,
      pexelsApiKey: env.PEXELS_API_KEY,
      pixabayApiKey: env.PIXABAY_API_KEY,
      geminiApiKey: env.GEMINI_API_KEY,
      quoteText: quote,
      targetDarkness: mode,
      persist: false,
    });

    // Shuffle support: drop already-seen backgrounds so a re-roll shows new imagery
    const candidates = excludeUrls.length > 0
      ? gathered.filter((c) => !excludeUrls.includes(c.sourceUrl))
      : gathered;

    if (candidates.length === 0) {
      console.log(JSON.stringify({ matched: false, candidateCount: gathered.length, chosen: null, runnersUp: [], error: "all candidates excluded — use Render to reset the shuffle" }));
      return;
    }

    const match = await matchBestBackground(
      quote,
      candidates.map((c) => ({ id: c.id, description: c.description })),
      {
        db: dbHandle.db,
        keys: {
          jina: env.JINA_API_KEY,
          cohere: env.COHERE_API_KEY,
          huggingface: env.HUGGINGFACE_API_KEY,
          gemini: env.GEMINI_API_KEY,
        },
      },
    );

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const chosen = byId.get(match.backgroundId) ?? null;
    const runnersUp = (match.scores ?? [])
      .filter((s) => s.id !== match.backgroundId)
      .slice(0, 3)
      .map((s) => ({
        description: byId.get(s.id)?.description ?? "",
        similarity: s.similarity,
        source: byId.get(s.id)?.source,
      }));

    console.log(
      JSON.stringify({
        matched: match.matched,
        similarity: match.similarity,
        embeddingProvider: match.provider,
        candidateCount: candidates.length,
        chosen: chosen
          ? { sourceUrl: chosen.sourceUrl, description: chosen.description, darkness: chosen.darkness, source: chosen.source }
          : null,
        runnersUp,
      }),
    );
  } finally {
    dbHandle.close();
  }
}

main().catch((err) => {
  console.error("[explain-background]", err);
  process.exitCode = 1;
});
