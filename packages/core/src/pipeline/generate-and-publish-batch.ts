import { writeFile, mkdir, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import type { Account } from "../config/accounts.js";
import type { Env } from "../config/env.js";
import { decryptToken } from "../crypto/token-encryption.js";
import type { Db } from "../db/client.js";
import { getToken } from "../db/repositories/ig-token.repo.js";
import {
  clearComposedImagePath,
  countPublishedSince,
  findPrunableImages,
  findPublishedForAccount,
  insertPendingPost,
  markFailed,
  markPublished,
} from "../db/repositories/posts.repo.js";
import { recordBackgroundUsage, recordQuoteUsage } from "../db/repositories/usage.repo.js";
import { selectHashtags } from "../hashtags/selector.js";
import { getCandidateBackgrounds } from "../images/background-provider.js";
import type { Darkness } from "../images/darkness-classifier.js";
import { composeImage } from "../images/compositor.js";
import { matchBestBackground } from "../matching/image-quote-matcher.js";
import { checkDuplicate } from "../matching/duplicate-detector.js";
import { scoreSuitability } from "../images/suitability-scorer.js";
import { findTemplate, selectTemplate } from "../images/templates.js";
import {
  recordCaptionTemplateOutcome,
  recordModeOutcome,
  selectCaptionTemplate,
} from "../aesthetics/mode-weighting.js";
import { getNextQuote } from "../quotes/provider.js";
import type { IGCredentials } from "../instagram/client.js";
import { publishToFeed } from "../instagram/client.js";
import { publishViaComposio } from "../instagram/composio-client.js";
import { publishToStories } from "../instagram/stories-client.js";
import type { ThreadsCredentials } from "../threads/client.js";
import { publishToThreads } from "../threads/client.js";
import { sendDiscordNotification } from "../notify/discord.js";
import { commitBatch } from "../git/commit-batch.js";
import { CAPTION_TEMPLATES, findCaptionTemplate } from "./caption-templates.js";

// plan.md §2.6/§2.9.
const BATCH_SIZE = 5;
const HARD_STOP_POSTS_PER_DAY = 22;
const IMAGE_RETENTION_DAYS = 3;
const POST_INTERVAL_BASE_SECONDS = 480;
const POST_INTERVAL_JITTER_SECONDS = 180;
const IMAGE_MATCH_CANDIDATE_POOL_SIZE = 5;
const QUOTE_DUPLICATE_RETRY_ATTEMPTS = 3;
const CONSECUTIVE_FAILURE_ABORT_THRESHOLD = 3;
const HASHTAG_CATEGORIES_PATH = "data/hashtags.json";

export interface GenerateAndPublishBatchOptions {
  db: Db;
  account: Account;
  env: Env;
  /** Absolute path to the repo root, for writing data/posts/... and reading data/hashtags.json. */
  repoRoot: string;
  /** "owner/repo", used to build the raw.githubusercontent.com URL the Graph API fetches the image from. */
  githubRepoSlug: string;
  githubBranch?: string;
  hashtagPools: Record<string, string[]>;
  /**
   * plan.md §14 local dry-run: runs selection through image composition
   * (steps 4a-4i) for real -- real quote/background/embedding calls, a real
   * composed JPEG and posts row -- but skips the actual IG/Threads/Stories
   * publish calls (4j-4l) and the rate-cap/posting-hour gates that only
   * matter for real posting cadence, so a template/mode can be visually
   * reviewed without touching any social API or waiting for a posting hour.
   */
  dryRun?: boolean;
  /** When true, bypasses the posting-hour check for manual/on-demand runs. */
  ignorePostingHour?: boolean;
  /** Custom batch size (default: BATCH_SIZE = 5). Set to 1 for single-post tests. */
  batchSize?: number;
  /** When true, disables inter-post jitter sleep delay. */
  noDelay?: boolean;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  randomImpl?: () => number;
  idGenerator?: () => string;
  now?: () => Date;
}

export interface BatchItemResult {
  status: "published" | "failed" | "composed";
  postId: string;
  errorMessage?: string;
  /** Set when status is "composed" (dry run) -- relative path under data/posts/ for visual review. */
  composedImagePath?: string;
}

export interface GenerateAndPublishBatchResult {
  skippedReason?: "rate-cap" | "not-posting-hour";
  items: BatchItemResult[];
}

function getLocalHour(date: Date, timezone: string): number {
  const formatted = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(
    date,
  );
  // Intl can return "24" for midnight with hour12:false depending on locale/implementation -- normalize.
  return parseInt(formatted, 10) % 24;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const defaultIdGenerator = () => crypto.randomUUID();

/**
 * Deletes composited JPEGs for already-published posts older than
 * IMAGE_RETENTION_DAYS (plan.md §2.9/§7.19 step 5) -- Instagram already has
 * the permanent copy via the media permalink, so the git-committed copy is
 * only needed for the brief window between compositing and publish. Missing
 * files (already deleted, or never written) are treated as already-pruned.
 */
async function pruneOldImages(db: Db, accountId: string, repoRoot: string, currentTime: Date): Promise<void> {
  const cutoff = new Date(currentTime.getTime() - IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const prunable = await findPrunableImages(db, accountId, cutoff);
  for (const row of prunable) {
    if (!row.composedImagePath) continue;
    try {
      await unlink(`${repoRoot}/${row.composedImagePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await clearComposedImagePath(db, row.id);
  }
}

async function verifyPublicImageUrl(
  primaryUrl: string,
  githubRepoSlug: string,
  relativePath: string,
  fetchImpl: typeof fetch,
  sleepImpl: (ms: number) => Promise<void>,
): Promise<string> {
  const candidateUrls = [
    primaryUrl,
    `https://raw.githubusercontent.com/${githubRepoSlug}/Alpha/${relativePath}`,
    `https://raw.githubusercontent.com/${githubRepoSlug}/main/${relativePath}`,
  ];

  for (let attempt = 0; attempt < 6; attempt++) {
    for (const url of candidateUrls) {
      try {
        const res = await fetchImpl(url, { method: "HEAD" });
        const contentType = res.headers.get("content-type") ?? "";
        if (res.ok && contentType.startsWith("image/")) {
          console.log(`[Batch] Verified live public image URL: ${url}`);
          return url;
        }
      } catch {}
    }
    if (attempt < 5) {
      await sleepImpl(2500);
    }
  }

  for (const url of candidateUrls) {
    try {
      const res = await fetchImpl(url, { method: "GET" });
      const contentType = res.headers.get("content-type") ?? "";
      if (res.ok && contentType.startsWith("image/")) {
        console.log(`[Batch] Verified live public image URL via GET: ${url}`);
        return url;
      }
    } catch {}
  }

  return primaryUrl;
}

export async function generateAndPublishBatch(
  options: GenerateAndPublishBatchOptions,
): Promise<GenerateAndPublishBatchResult> {
  const { db, account, env } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? defaultSleep;
  const random = options.randomImpl ?? Math.random;
  const idGenerator = options.idGenerator ?? defaultIdGenerator;
  const now = options.now ?? (() => new Date());
  let detectedBranch = options.githubBranch;
  if (!detectedBranch) {
    try {
      const b = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: options.repoRoot, encoding: "utf-8" }).trim();
      if (b && b !== "HEAD") detectedBranch = b;
    } catch {}
  }
  if (!detectedBranch) {
    detectedBranch = process.env.GITHUB_BRANCH;
  }
  const githubBranch = detectedBranch || "main";
  const dryRun = options.dryRun ?? false;

  const currentTime = now();
  const since = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000).toISOString();

  if (!dryRun) {
    // Step: rolling-24h rate-cap check.
    const publishedCount = await countPublishedSince(db, account.id, since);
    if (publishedCount >= HARD_STOP_POSTS_PER_DAY) {
      return { skippedReason: "rate-cap", items: [] };
    }

    // Step: posting-hour check (account-local time).
    const localHour = getLocalHour(currentTime, account.timezone);
    if (!options.ignorePostingHour && !account.postingHoursLocal.includes(localHour)) {
      return { skippedReason: "not-posting-hour", items: [] };
    }
  }

  // Credentials -- not needed in dry run, which never calls the social APIs.
  let igCreds: IGCredentials | undefined;
  let threadsCreds: ThreadsCredentials | undefined;
  if (!dryRun) {
    const tokenRow = await getToken(db, account.id);
    if (tokenRow) {
      igCreds = {
        accessToken: decryptToken(tokenRow.accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY),
        igUserId: account.igUserId,
      };
      threadsCreds =
        account.threadsUserId && tokenRow.threadsAccessTokenEncrypted
          ? {
              accessToken: decryptToken(tokenRow.threadsAccessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY),
              threadsUserId: account.threadsUserId,
            }
          : undefined;
    } else if (!env.COMPOSIO_API_KEY) {
      throw new Error(`generateAndPublishBatch: no ig_token row for account "${account.id}" and no COMPOSIO_API_KEY configured`);
    }
  }

  const embeddingsConfig = {
    db,
    keys: {
      jina: env.JINA_API_KEY,
      cohere: env.COHERE_API_KEY,
      huggingface: env.HUGGINGFACE_API_KEY,
      gemini: env.GEMINI_API_KEY,
    },
    fetchImpl,
  };

  const items: BatchItemResult[] = [];
  let consecutiveFailures = 0;
  let previousTemplateId: string | undefined;

  const recentPublished = await findPublishedForAccount(db, account.id, 1);
  let lastMode: Darkness = (recentPublished[0]?.mode as Darkness) ?? "dark";

  const totalPostsToGenerate = options.batchSize ?? BATCH_SIZE;

  for (let i = 0; i < totalPostsToGenerate; i++) {
    console.log(`[Batch] Starting post item ${i + 1}/${totalPostsToGenerate}...`);
    if (consecutiveFailures >= CONSECUTIVE_FAILURE_ABORT_THRESHOLD) {
      break;
    }
    if (!dryRun) {
      const runningCount = await countPublishedSince(db, account.id, since);
      if (runningCount >= HARD_STOP_POSTS_PER_DAY) {
        break;
      }
    }

    const postId = idGenerator();
    try {
      const category = account.categoryFocus[Math.floor(random() * account.categoryFocus.length)]!;

      const quoteProviderConfig = {
        apiNinjasKey: env.API_NINJAS_KEY,
        theySaidSoKey: env.THEY_SAID_SO_KEY,
        fetchImpl,
      };

      // Quote selection with near-duplicate retry (plan.md §7.19 step 4c).
      let quote = await getNextQuote(db, account.id, category, quoteProviderConfig);
      for (let attempt = 0; attempt < QUOTE_DUPLICATE_RETRY_ATTEMPTS; attempt++) {
        const dup = await checkDuplicate(db, account.id, quote.text, embeddingsConfig);
        if (!dup.isDuplicate) break;
        quote = await getNextQuote(db, account.id, category, quoteProviderConfig);
      }

      // Chessboard pattern: alternate between light and dark modes across consecutive posts
      const targetMode: Darkness = lastMode === "dark" ? "light" : "dark";

      let candidates = await getCandidateBackgrounds(db, account.id, category, IMAGE_MATCH_CANDIDATE_POOL_SIZE, {
        visionApiKey: env.GOOGLE_CLOUD_VISION_API_KEY,
        unsplashAccessKey: env.UNSPLASH_ACCESS_KEY,
        pexelsApiKey: env.PEXELS_API_KEY,
        pixabayApiKey: env.PIXABAY_API_KEY,
        geminiApiKey: env.GEMINI_API_KEY,
        quoteText: quote.text,
        fetchImpl,
        targetDarkness: targetMode,
      });
      if (candidates.length === 0) {
        candidates = await getCandidateBackgrounds(db, account.id, category, IMAGE_MATCH_CANDIDATE_POOL_SIZE, {
          visionApiKey: env.GOOGLE_CLOUD_VISION_API_KEY,
          unsplashAccessKey: env.UNSPLASH_ACCESS_KEY,
          pexelsApiKey: env.PEXELS_API_KEY,
          pixabayApiKey: env.PIXABAY_API_KEY,
          geminiApiKey: env.GEMINI_API_KEY,
          quoteText: quote.text,
          fetchImpl,
        });
      }
      if (candidates.length === 0) {
        throw new Error(`No candidate backgrounds available for category "${category}"`);
      }
      const match = await matchBestBackground(
        quote.text,
        candidates.map((c) => ({ id: c.id, description: c.description })),
        embeddingsConfig,
      );
      const chosen = candidates.find((c) => c.id === match.backgroundId)!;
      lastMode = chosen.darkness;

      const imageRes = await fetchImpl(chosen.sourceUrl);
      const backgroundBuffer = Buffer.from(await imageRes.arrayBuffer());
      const suitability = await scoreSuitability(backgroundBuffer);
      const mode = chosen.darkness;

      // Template + caption template selection.
      const template = selectTemplate(category, previousTemplateId, 0.25, random);
      previousTemplateId = template.id;
      const captionTemplateId = await selectCaptionTemplate(
        db,
        account.id,
        CAPTION_TEMPLATES.map((t) => t.id),
        random,
      );
      const captionTemplate = findCaptionTemplate(captionTemplateId);

      // Hashtags.
      const hashtags = selectHashtags(category, options.hashtagPools);

      // Composite.
      console.log(`[Batch] Selected quote: "${quote.text.slice(0, 40)}..." by ${quote.author}`);
      console.log(`[Batch] Composing ${mode} mode image...`);
      const imageBuffer = await composeImage({
        backgroundBuffer,
        quoteText: quote.text,
        author: quote.author ?? undefined,
        template: findTemplate(template.id),
        mode,
        suitability,
      });
      const dateStr = currentTime.toISOString().slice(0, 10);
      const relativePath = `data/posts/${account.id}/${dateStr}-${postId}.jpg`;
      const absolutePath = `${options.repoRoot}/${relativePath}`;
      await mkdir(absolutePath.slice(0, absolutePath.lastIndexOf("/")), { recursive: true });
      await writeFile(absolutePath, imageBuffer);
      const imageUrl = `https://raw.githubusercontent.com/${options.githubRepoSlug}/${githubBranch}/${relativePath}`;
      console.log(`[Batch] Image saved to ${relativePath}`);

      await insertPendingPost(db, {
        id: postId,
        accountId: account.id,
        quoteId: quote.id,
        backgroundId: chosen.id,
        templateId: template.id,
        captionTemplateId,
        mode,
        scheduledFor: currentTime.toISOString(),
      });

      await recordQuoteUsage(db, account.id, quote.id, postId);
      await recordBackgroundUsage(db, account.id, chosen.id, postId);

      if (dryRun) {
        items.push({ status: "composed", postId, composedImagePath: relativePath });
        consecutiveFailures = 0;
        continue;
      }

      console.log(`[Batch] Committing and pushing image to GitHub...`);
      try {
        await commitBatch({ cwd: options.repoRoot, message: `post: publish image ${postId}` });
        console.log(`[Batch] Image pushed to GitHub raw URL.`);
        await sleepImpl(5000);
      } catch (err) {
        console.warn(`[Batch] Git push warning:`, err);
      }

      const caption = captionTemplate.build(quote.text, quote.author, hashtags);
      const hashtagComment = hashtags.join(" ");

      const verifiedImageUrl = await verifyPublicImageUrl(
        imageUrl,
        options.githubRepoSlug,
        relativePath,
        fetchImpl,
        sleepImpl,
      );

      console.log(`[Batch] Publishing to Instagram with image URL ${verifiedImageUrl}...`);
      let feedResult: { mediaId: string; permalink?: string };
      if (env.COMPOSIO_API_KEY) {
        console.log(`[Batch] Using Composio API...`);
        const compRes = await publishViaComposio({
          imageUrl: verifiedImageUrl,
          caption: `${caption}\n\n${hashtagComment}`,
          apiKey: env.COMPOSIO_API_KEY,
          entityId: account.id,
          fetchImpl,
        });
        feedResult = { mediaId: compRes.mediaId, permalink: compRes.permalink };
      } else {
        console.log(`[Batch] Using Meta Graph API...`);
        feedResult = await publishToFeed(verifiedImageUrl, caption, hashtagComment, igCreds!, fetchImpl, sleepImpl);
      }
      console.log(`[Batch] Successfully published! Media ID: ${feedResult.mediaId}, Permalink: ${feedResult.permalink}`);

      // Best-effort surfaces -- failures here don't fail the item.
      let storiesMediaId: string | undefined;
      try {
        const stories = await publishToStories(imageUrl, igCreds!, fetchImpl, sleepImpl);
        storiesMediaId = stories.mediaId;
      } catch {
        // non-fatal, per plan.md §7.19 step 4k
      }
      let threadsPostId: string | undefined;
      if (threadsCreds) {
        try {
          const threads = await publishToThreads(imageUrl, caption, threadsCreds, fetchImpl, sleepImpl);
          threadsPostId = threads.mediaId;
        } catch {
          // non-fatal, per plan.md §7.19 step 4l
        }
      }

      await markPublished(db, postId, {
        composedImagePath: relativePath,
        igMediaId: feedResult.mediaId,
        igPermalink: feedResult.permalink,
        threadsPostId,
        storiesMediaId,
        publishedAt: currentTime.toISOString(),
      });
      await recordModeOutcome(db, account.id, mode, true);
      await recordCaptionTemplateOutcome(db, account.id, captionTemplateId, true);

      items.push({ status: "published", postId });
      consecutiveFailures = 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Batch] Item ${i + 1} failed:`, message);
      await markFailed(db, postId, message);
      items.push({ status: "failed", postId, errorMessage: message });
      consecutiveFailures++;
      try {
        await sendDiscordNotification(
          env.DISCORD_WEBHOOK_URL,
          { title: `Post failed for ${account.id}`, description: message, level: "failure" },
          fetchImpl,
        );
      } catch {
        // Discord itself being down must not crash the batch.
      }
    }

    if (i < totalPostsToGenerate - 1 && !options.noDelay) {
      const jitterMs = (POST_INTERVAL_BASE_SECONDS + (random() * 2 - 1) * POST_INTERVAL_JITTER_SECONDS) * 1000;
      await sleepImpl(jitterMs);
    }
  }

  // Step 5: prune old published images -- not part of the dry-run's
  // selection-through-composition scope (plan.md §14).
  if (!dryRun) {
    await pruneOldImages(db, account.id, options.repoRoot, currentTime);
  }

  return { items };
}

export { HASHTAG_CATEGORIES_PATH };
