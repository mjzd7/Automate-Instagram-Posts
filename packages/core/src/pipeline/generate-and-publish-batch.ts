import { writeFile, mkdir, unlink, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
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
  findViralAudioIdsForReuse,
} from "../db/repositories/posts.repo.js";
import { recordBackgroundUsage, recordQuoteUsage } from "../db/repositories/usage.repo.js";
import { selectHashtags } from "../hashtags/selector.js";
import { getCandidateBackgrounds } from "../images/background-provider.js";
import type { Darkness } from "../images/darkness-classifier.js";
import { composeImage } from "../images/compositor.js";
import { composeViralReelImage, composeViralReelOverlay, selectViralStyle } from "../images/viral-compositor.js";
import { createReelFromFeedImage } from "../images/reel-video-composer.js";
import { composeVideoReel } from "./video-compositor.js";
import { fetchPexelsVideo } from "../images/pexels-video-provider.js";
import { selectStoryAudio } from "../audio/audio-selector.js";
import { searchMetaAudioTracks, type MetaAudioTrack } from "../audio/meta-audio-client.js";
import { matchBestBackground } from "../matching/image-quote-matcher.js";
import { checkDuplicate } from "../matching/duplicate-detector.js";
import { scoreSuitability } from "../images/suitability-scorer.js";
import { findTemplate, selectTemplate } from "../images/templates.js";
import { uploadOrGetPublicImageUrl } from "../images/public-hoster.js";
import {
  recordCaptionTemplateOutcome,
  recordModeOutcome,
  selectCaptionTemplate,
} from "../aesthetics/mode-weighting.js";
import { getNextQuote } from "../quotes/provider.js";
import { publishViaComposioReels } from "../instagram/composio-client.js";
import type { IGCredentials } from "../instagram/client.js";
import { publishToReels } from "../instagram/reels-client.js";
import type { ThreadsCredentials } from "../threads/client.js";
import { publishToThreads } from "../threads/client.js";
import { sendDiscordNotification } from "../notify/discord.js";
import { commitBatch } from "../git/commit-batch.js";
import { CAPTION_TEMPLATES, findCaptionTemplate } from "./caption-templates.js";
import { generateReelHook } from "./hooks.js";

// plan.md §2.6/§2.9.
const BATCH_SIZE = 5;
const HARD_STOP_POSTS_PER_DAY = 22;
const IMAGE_RETENTION_DAYS = 3;
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
  /** When true, bypasses the 24h rate-cap check for manual/on-demand runs. */
  ignoreRateCap?: boolean;
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
        const isMedia = contentType.startsWith("image/") || contentType.startsWith("video/");
        if (res.ok && isMedia) {
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
      const isMedia = contentType.startsWith("image/") || contentType.startsWith("video/");
      if (res.ok && isMedia) {
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
    if (!options.ignoreRateCap && publishedCount >= HARD_STOP_POSTS_PER_DAY) {
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
  const recentPublished = await findPublishedForAccount(db, account.id, 4);
  const recentTemplateIds: string[] = recentPublished.map((p) => p.templateId);
  let lastMode: Darkness = (recentPublished[0]?.mode as Darkness) ?? "dark";
  const usedAudioIds: string[] = [];

  const totalPostsToGenerate = options.batchSize ?? BATCH_SIZE;

  for (let i = 0; i < totalPostsToGenerate; i++) {
    console.log(`[Batch] Starting post item ${i + 1}/${totalPostsToGenerate}...`);
    if (consecutiveFailures >= CONSECUTIVE_FAILURE_ABORT_THRESHOLD) {
      break;
    }
    if (!dryRun) {
      const runningCount = await countPublishedSince(db, account.id, since);
      if (!options.ignoreRateCap && runningCount >= HARD_STOP_POSTS_PER_DAY) {
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
      let chosen = candidates.find((c) => c.id === match.backgroundId)!;
      let backgroundBuffer: Buffer | undefined;
      const sortedCandidates = [chosen, ...candidates.filter((c) => c.id !== chosen.id)];

      for (const cand of sortedCandidates) {
        try {
          const imageRes = await fetchImpl(cand.sourceUrl);
          if (!imageRes.ok) continue;
          const rawBuffer = Buffer.from(await imageRes.arrayBuffer());
          backgroundBuffer = await sharp(rawBuffer).toFormat("jpeg").toBuffer();
          lastMode = cand.darkness;
          chosen = cand;
          break;
        } catch {}
      }

      if (!backgroundBuffer) {
        const color = targetMode === "dark" ? { r: 25, g: 30, b: 45 } : { r: 240, g: 237, b: 230 };
        backgroundBuffer = await sharp({
          create: { width: 1080, height: 1350, channels: 3, background: color },
        })
          .jpeg()
          .toBuffer();
      }

      const suitability = await scoreSuitability(backgroundBuffer);
      const mode = chosen.darkness;

      // Template + caption template selection.
      const template = selectTemplate(category, recentTemplateIds, 0.25, random);
      recentTemplateIds.unshift(template.id);
      const captionTemplateId = await selectCaptionTemplate(
        db,
        account.id,
        CAPTION_TEMPLATES.map((t) => t.id),
        random,
      );
      const captionTemplate = findCaptionTemplate(captionTemplateId);

      // Hashtags.
      const hashtags = selectHashtags(category, options.hashtagPools);

      console.log(`[Batch] Selected quote: "${quote.text.slice(0, 40)}..." by ${quote.author}`);

      let availableTracks: MetaAudioTrack[] = [];
      if (igCreds?.igUserId && igCreds?.accessToken) {
        try {
          availableTracks = await searchMetaAudioTracks({
            igUserId: igCreds.igUserId,
            accessToken: igCreds.accessToken,
            fetchImpl,
          });
        } catch {
          availableTracks = [];
        }
      }

      // 15% probability roll to reuse a high-performing (viral) sound from past posts
      let viralAudioIds: string[] = [];
      if (random() < 0.15) {
        console.log(`[Batch] Audio reuse roll succeeded! Checking for viral audio candidates...`);
        try {
          // Dynamic threshold: top 15% views, 5 days cooldown
          viralAudioIds = await findViralAudioIdsForReuse(db, account.id, 0.15, 5);
          if (viralAudioIds.length > 0) {
            console.log(`[Batch] Found ${viralAudioIds.length} viral audio candidates eligible for reuse.`);
          } else {
            console.log(`[Batch] No eligible viral audio candidates found.`);
          }
        } catch (err) {
          console.error(`[Batch] Failed to query viral audio candidates:`, err);
        }
      }

      // Select matched audio track with anti-fatigue rotation across the batch
      const audioSelection = selectStoryAudio({
        category,
        mode,
        quoteLength: quote.text.split(" ").length,
        recentAudioIds: usedAudioIds,
        availableTracks,
        random,
        viralAudioIds,
      });
      usedAudioIds.push(audioSelection.track.audioId);

      const dateStr = currentTime.toISOString().slice(0, 10);
      const storyRelativePath = `data/posts/${account.id}/${dateStr}-${postId}-story.mp4`;
      const storyAbsolutePath = `${options.repoRoot}/${storyRelativePath}`;
      
      console.log(`[Batch] Composing dedicated 9:16 Typewriter Reel...`);
      const reelResult_composed = await composeVideoReel(
        quote.text,
        category,
        storyAbsolutePath,
        availableTracks,
        false, // Voiceovers off by default
        mode,
        quote.author ?? undefined
      );

      const coverRelativePath = storyRelativePath.replace(/\.mp4$/, "-cover.jpg");
      const coverAbsolutePath = reelResult_composed.coverImagePath;
      console.log(`[Batch] Reel video saved to ${storyRelativePath}`);

      await insertPendingPost(db, {
        id: postId,
        accountId: account.id,
        quoteId: quote.id,
        backgroundId: chosen.id,
        audioId: audioSelection.track.audioId,
        templateId: template.id,
        captionTemplateId,
        mode,
        scheduledFor: currentTime.toISOString(),
      });

      await recordQuoteUsage(db, account.id, quote.id, postId);
      await recordBackgroundUsage(db, account.id, chosen.id, postId);

      if (dryRun) {
        items.push({ status: "composed", postId, composedImagePath: storyRelativePath });
        consecutiveFailures = 0;
        continue;
      }

      console.log(`[Batch] Committing and pushing images to GitHub...`);
      try {
        await commitBatch({ cwd: options.repoRoot, message: `post: publish image ${postId}` });
        console.log(`[Batch] Images pushed to GitHub raw URL.`);
        await sleepImpl(5000);
      } catch (err) {
        console.warn(`[Batch] Git push warning:`, err);
      }

      const caption = captionTemplate.build(quote.text, quote.author, hashtags);
      const hashtagComment = hashtags.join(" ");

      const storyVideoBuffer = await readFile(storyAbsolutePath);

      const storyHostedVideoUrl = await uploadOrGetPublicImageUrl({
        imageBuffer: storyVideoBuffer,
        relativePath: storyRelativePath,
        githubRepoSlug: options.githubRepoSlug,
        githubBranch,
        webAppUrl: env.WEB_APP_URL,
        fetchImpl,
      });

      const storyVerifiedVideoUrl = await verifyPublicImageUrl(
        storyHostedVideoUrl,
        options.githubRepoSlug,
        storyRelativePath,
        fetchImpl,
        sleepImpl,
      );

      console.log(`[Batch] Publishing dedicated 9:16 Reel to Instagram with video URL ${storyVerifiedVideoUrl}...`);

      // Upload cover image (complete quote frame) for the Reel grid thumbnail
      let verifiedCoverUrl: string | undefined;
      if (existsSync(coverAbsolutePath)) {
        try {
          const coverBuffer = await readFile(coverAbsolutePath);
          const coverHostedUrl = await uploadOrGetPublicImageUrl({
            imageBuffer: coverBuffer,
            relativePath: coverRelativePath,
            githubRepoSlug: options.githubRepoSlug,
            githubBranch,
            webAppUrl: env.WEB_APP_URL,
            fetchImpl,
          });
          verifiedCoverUrl = await verifyPublicImageUrl(
            coverHostedUrl,
            options.githubRepoSlug,
            coverRelativePath,
            fetchImpl,
            sleepImpl,
          );
          console.log(`[Batch] Cover image uploaded: ${verifiedCoverUrl}`);
        } catch (err) {
          console.warn(`[Batch] Cover image upload failed, Instagram will auto-select:`, err);
        }
      }

      let reelResult: { mediaId: string; permalink?: string } | undefined;
      
      const tryComposioReel = async () => {
        console.log(`[Batch] Publishing Reel via Composio API...`);
        const compRes = await publishViaComposioReels({
          imageUrl: storyVerifiedVideoUrl,
          coverUrl: verifiedCoverUrl,
          caption: `${caption}\n\n${hashtagComment}`,
          apiKey: env.COMPOSIO_API_KEY!,
          entityId: account.id,
          fetchImpl,
        });
        return { mediaId: compRes.mediaId, permalink: compRes.permalink };
      };

      const tryMetaGraphReel = async () => {
        console.log(`[Batch] Publishing Reel via Meta Graph API...`);
        const reelRes = await publishToReels(storyVerifiedVideoUrl, `${caption}\n\n${hashtagComment}`, igCreds!, fetchImpl, sleepImpl, {
          coverUrl: verifiedCoverUrl,
        });
        return { mediaId: reelRes.mediaId };
      };

      if (igCreds) {
        reelResult = await tryMetaGraphReel();
      } else if (env.COMPOSIO_API_KEY) {
        try {
          reelResult = await tryComposioReel();
        } catch (err) {
          console.warn(`[Batch] Composio API failed for Reel:`, err);
          throw err;
        }
      } else {
        throw new Error("No publishing credentials available");
      }

      if (reelResult?.mediaId) {
        console.log(`[Batch] Successfully published Reel! Media ID: ${reelResult.mediaId}`);
      }

      await markPublished(db, postId, {
        composedImagePath: storyRelativePath,
        igMediaId: reelResult.mediaId,
        igPermalink: reelResult.permalink,
        storiesMediaId: reelResult.mediaId,
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
      const gapSeconds = Math.floor(360 + random() * 540);
      console.log(`[Batch] Organic anti-bot gap: waiting ${Math.round(gapSeconds / 60)}m ${gapSeconds % 60}s before post ${i + 2}/${totalPostsToGenerate}...`);
      await sleepImpl(gapSeconds * 1000);
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
