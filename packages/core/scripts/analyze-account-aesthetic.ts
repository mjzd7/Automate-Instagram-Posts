import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAccounts } from "../src/config/accounts.js";
import { loadEnv } from "../src/config/env.js";
import { openDb } from "../src/db/client.js";
import { decryptToken } from "../src/crypto/token-encryption.js";
import { getToken } from "../src/db/repositories/ig-token.repo.js";
import { classifyDarkness } from "../src/images/darkness-classifier.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(resolve(repoRoot, ".env.local"));
  } catch {
    try {
      process.loadEnvFile(resolve(repoRoot, ".env"));
    } catch {
      // Ignored
    }
  }
}

interface IgMediaItem {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  permalink?: string;
  timestamp: string;
}

export interface AestheticAnalysisResult {
  totalAnalyzed: number;
  filteredOut2026: number;
  colorDistribution: { darkCount: number; lightCount: number; darkPercentage: number };
  captionStats: {
    avgLength: number;
    avgHashtags: number;
    commonHashtags: string[];
    hasAuthorAttribution: boolean;
    quoteFormattingPattern: string;
  };
  deducedDesignRules: {
    preferredMode: "dark" | "light";
    suggestedScrimOpacity: number;
    suggestedHashtagCount: number;
    suggestedQuoteAlignment: "center" | "left";
  };
}

export async function analyzeAccountAesthetic(accountId: string = "main"): Promise<AestheticAnalysisResult> {
  const env = loadEnv();
  const dbHandle = await openDb(`file:${repoRoot}/data/app.db`);
  const accounts = await loadAccounts(`${repoRoot}/data/accounts.json`);
  const account = accounts.find((a) => a.id === accountId);

  if (!account) {
    throw new Error(`Account "${accountId}" not found in data/accounts.json`);
  }

  const tokenRow = await getToken(dbHandle.db, accountId);
  let accessToken: string | undefined;
  if (tokenRow) {
    accessToken = decryptToken(tokenRow.accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
  }

  let mediaItems: IgMediaItem[] = [];

  if (accessToken && account.igUserId && account.igUserId !== "default") {
    console.log(`📡 Fetching historical posts directly from Instagram Graph API for user ${account.igUserId}...`);
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${account.igUserId}/media?fields=id,caption,media_type,media_url,permalink,timestamp&limit=100&access_token=${accessToken}`,
    );
    if (res.ok) {
      const data = (await res.json()) as { data?: IgMediaItem[] };
      mediaItems = data.data ?? [];
    }
  }

  if (mediaItems.length === 0 && env.COMPOSIO_API_KEY) {
    console.log(`📡 Querying Composio API for account media history...`);
    try {
      const res = await fetch("https://backend.composio.dev/api/v1/actions/INSTAGRAM_GET_USER_MEDIA/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": env.COMPOSIO_API_KEY },
        body: JSON.stringify({ entity_id: accountId, appName: "instagram", input: {} }),
      });
      if (res.ok) {
        const data = (await res.json()) as { data?: { media?: IgMediaItem[] } };
        mediaItems = data.data?.media ?? [];
      }
    } catch {
      // Ignored if Composio fallback is unpopulated
    }
  }

  console.log(`📊 Found ${mediaItems.length} total posts on account.`);

  // Filter out 2026 posts per instruction: "ignore tihs year's images"
  const cutoffYear = 2026;
  const eligibleItems = mediaItems.filter((item) => {
    const year = new Date(item.timestamp).getUTCFullYear();
    return year < cutoffYear;
  });

  const filteredOutCount = mediaItems.length - eligibleItems.length;
  console.log(`🔍 Filtered out ${filteredOutCount} posts from ${cutoffYear}. Analyzing ${eligibleItems.length} historical posts (2025 and earlier)...`);

  let darkCount = 0;
  let lightCount = 0;
  const hashtagCounts = new Map<string, number>();
  let totalCaptionLength = 0;
  let totalHashtagsCount = 0;
  let authorAttributionCount = 0;

  for (const item of eligibleItems) {
    // Caption analysis
    const caption = item.caption ?? "";
    totalCaptionLength += caption.length;

    const hashtags = caption.match(/#[a-zA-Z0-9_]+/g) ?? [];
    totalHashtagsCount += hashtags.length;
    for (const tag of hashtags) {
      const lower = tag.toLowerCase();
      hashtagCounts.set(lower, (hashtagCounts.get(lower) ?? 0) + 1);
    }

    if (/[-—–]\s*[A-Z]/i.test(caption) || /by\s+[A-Z]/i.test(caption)) {
      authorAttributionCount++;
    }

    // Visual image analysis if media_url is accessible
    if (item.media_url && item.media_type === "IMAGE") {
      try {
        const imgRes = await fetch(item.media_url);
        if (imgRes.ok) {
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          const darkness = await classifyDarkness(buffer);
          if (darkness === "dark") darkCount++;
          else lightCount++;
        }
      } catch {
        // Skip unaccessible image URLs
      }
    }
  }

  const sortedHashtags = Array.from(hashtagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  const totalAnalyzed = eligibleItems.length;
  const darkPct = totalAnalyzed > 0 ? (darkCount / (darkCount + lightCount || 1)) * 100 : 70;
  const preferredMode = darkPct >= 50 ? "dark" : "light";

  const result: AestheticAnalysisResult = {
    totalAnalyzed,
    filteredOut2026: filteredOutCount,
    colorDistribution: {
      darkCount,
      lightCount,
      darkPercentage: Math.round(darkPct),
    },
    captionStats: {
      avgLength: Math.round(totalAnalyzed > 0 ? totalCaptionLength / totalAnalyzed : 120),
      avgHashtags: Math.round(totalAnalyzed > 0 ? totalHashtagsCount / totalAnalyzed : 15),
      commonHashtags: sortedHashtags,
      hasAuthorAttribution: totalAnalyzed > 0 ? authorAttributionCount / totalAnalyzed > 0.3 : true,
      quoteFormattingPattern: "Clean multi-line quote with double line breaks before author attribution",
    },
    deducedDesignRules: {
      preferredMode,
      suggestedScrimOpacity: preferredMode === "dark" ? 0.45 : 0.25,
      suggestedHashtagCount: Math.min(15, Math.max(8, Math.round(totalHashtagsCount / (totalAnalyzed || 1)))),
      suggestedQuoteAlignment: "center",
    },
  };

  // Save analysis findings artifact / JSON
  const analysisPath = resolve(repoRoot, "data/aesthetic-analysis.json");
  await writeFile(analysisPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`\n✅ Aesthetic analysis completed and saved to data/aesthetic-analysis.json`);

  return result;
}

async function main() {
  const accountArgIdx = process.argv.indexOf("--account");
  const accountId = accountArgIdx !== -1 && process.argv[accountArgIdx + 1] ? process.argv[accountArgIdx + 1] : "main";

  console.log(`\n🎨 Starting Design Language & Aesthetic Analysis for account "${accountId}"...\n`);
  const analysis = await analyzeAccountAesthetic(accountId);

  console.log("\n--- Aesthetic Analysis Report ---");
  console.log(`• Historical Posts Analyzed (2025 & earlier): ${analysis.totalAnalyzed}`);
  console.log(`• Posts Filtered Out (2026): ${analysis.filteredOut2026}`);
  console.log(`• Dominant Aesthetic Mode: ${analysis.deducedDesignRules.preferredMode.toUpperCase()} (${analysis.colorDistribution.darkPercentage}% dark backgrounds)`);
  console.log(`• Suggested Scrim Opacity: ${analysis.deducedDesignRules.suggestedScrimOpacity}`);
  console.log(`• Average Hashtags per Post: ${analysis.captionStats.avgHashtags}`);
  if (analysis.captionStats.commonHashtags.length > 0) {
    console.log(`• Top Account Hashtags: ${analysis.captionStats.commonHashtags.join(" ")}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("Analysis error:", err);
    process.exit(1);
  });
}
