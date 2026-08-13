import { writeFile, mkdir, unlink } from "node:fs/promises";
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
} from "../db/repositories/posts.repo.js";
import { recordBackgroundUsage, recordQuoteUsage } from "../db/repositories/usage.repo.js";
import { selectHashtags } from "../hashtags/selector.js";
import { getCandidateBackgrounds } from "../images/background-provider.js";
import type { Darkness } from "../images/darkness-classifier.js";
import { composeImage } from "../images/compositor.js";
import { composeStory } from "../images/story-compositor.js";
import { createReelsVideoMP4 } from "../audio/reels-composer.js";
import { selectStoryAudio } from "../audio/audio-selector.js";
import { matchBestBackground } from "../matching/image-quote-matcher.js";
import { checkDuplicate } from "../matching/duplicate-detector.js";
import { scoreSuitability } from "../images/suitability-scorer.js";
import { findTemplate, selectTemplate, STORY_TEMPLATES } from "../images/templates.js";
import { uploadOrGetPublicImageUrl } from "../images/public-hoster.js";
import {
  recordCaptionTemplateOutcome,
  recordModeOutcome,
  selectCaptionTemplate,
} from "../aesthetics/mode-weighting.js";
import { getNextQuote } from "../quotes/provider.js";
import { publishViaComposio, publishViaComposioStories } from "../instagram/composio-client.js";
import type { IGCredentials } from "../instagram/client.js";
import { publishToFeed } from "../instagram/client.js";
import { publishToReels } from "../instagram/reels-client.js";
import type { ThreadsCredentials } from "../threads/client.js";
import { publishToThreads } from "../threads/client.js";
import { sendDiscordNotification } from "../notify/discord.js";
import { commitBatch } from "../git/commit-batch.js";
import { CAPTION_TEMPLATES, findCaptionTemplate } from "./caption-templates.js";

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

      // Composite 1:1 Feed Post
      console.log(`[Batch] Selected quote: "${quote.text.slice(0, 40)}..." by ${quote.author}`);
      
      let imageBuffer: Buffer;
      let feedScale = 2; // Default to native 4K (2160x2700)
      
      try {
        console.log(`[Batch] Composing ${mode} mode feed image (4K Native)...`);
        imageBuffer = await composeImage({
          backgroundBuffer,
          quoteText: quote.text,
          author: quote.author ?? undefined,
          template: findTemplate(template.id),
          mode,
          suitability,
          scale: 2,
        });
      } catch (e) {
        console.warn(`[Batch] 4K generation failed, falling back to 1080p: ${e}`);
        feedScale = 1;
        console.log(`[Batch] Composing ${mode} mode feed image (1080p Fallback)...`);
        imageBuffer = await composeImage({
          backgroundBuffer,
          quoteText: quote.text,
          author: quote.author ?? undefined,
          template: findTemplate(template.id),
          mode,
          suitability,
          scale: 1,
        });
      }

      // Select matched audio track for Instagram Story
      const audioSelection = selectStoryAudio({
        category,
        mode,
        quoteLength: quote.text.split(" ").length,
        availableTracks: [],
        random,
      });

      // Composite 9:16 Story Image with framed feed post, link sticker target zone & audio badge
      const chosenStoryTemplate = STORY_TEMPLATES[i % STORY_TEMPLATES.length]!;
      console.log(`[Batch] Composing 9:16 story image using template "${chosenStoryTemplate.name}" (${chosenStoryTemplate.id}) with audio: "${audioSelection.track.title}"...`);
      
      let storyResult: any;
      let storyScale = feedScale; // Use whatever scale worked for feed
      
      try {
        if (storyScale === 2) {
          console.log(`[Batch] Composing story image (4K Native)...`);
          storyResult = await composeStory({
            backgroundBuffer,
            quoteText: quote.text,
            author: quote.author ?? undefined,
            template: findTemplate(template.id),
            mode,
            suitability,
            accountHandle: `@${account.id}`,
            feedPostBuffer: imageBuffer,
            storyTemplateId: chosenStoryTemplate.id,
            audioTrack: {
              title: audioSelection.track.title,
              artist: audioSelection.track.displayArtist,
            },
            scale: 2,
          });
        } else {
          throw new Error("feedScale is 1, skipping 4K story render");
        }
      } catch (e) {
        if (storyScale === 2) {
          console.warn(`[Batch] 4K story generation failed, falling back to 1080p: ${e}`);
        }
        storyScale = 1;
        // Need to recreate feedBuffer at 1080p if it was 4K but story failed at 4K.
        let fallbackFeedBuffer = imageBuffer;
        if (feedScale === 2) {
          fallbackFeedBuffer = await composeImage({
            backgroundBuffer,
            quoteText: quote.text,
            author: quote.author ?? undefined,
            template: findTemplate(template.id),
            mode,
            suitability,
            scale: 1,
          });
        }
        
        console.log(`[Batch] Composing story image (1080p Fallback)...`);
        storyResult = await composeStory({
          backgroundBuffer,
          quoteText: quote.text,
          author: quote.author ?? undefined,
          template: findTemplate(template.id),
          mode,
          suitability,
          accountHandle: `@${account.id}`,
          feedPostBuffer: fallbackFeedBuffer,
          storyTemplateId: chosenStoryTemplate.id,
          audioTrack: {
            title: audioSelection.track.title,
            artist: audioSelection.track.displayArtist,
          },
          scale: 1,
        });
      }

      const dateStr = currentTime.toISOString().slice(0, 10);
      const relativePath = `data/posts/${account.id}/${dateStr}-${postId}.jpg`;
      const absolutePath = `${options.repoRoot}/${relativePath}`;
      await mkdir(absolutePath.slice(0, absolutePath.lastIndexOf("/")), { recursive: true });
      await writeFile(absolutePath, imageBuffer);

      let audioBuffer: Buffer | undefined;
      if (audioSelection.track.downloadUrl) {
        try {
          const audioRes = await fetchImpl(audioSelection.track.downloadUrl);
          if (audioRes.ok) {
            audioBuffer = Buffer.from(await audioRes.arrayBuffer());
          }
        } catch {}
      }

      console.log(`[Batch] Assembling MP4 video reels with audio stream (Scale: ${storyScale === 2 ? '4K' : '1080p'})...`);
      
      // Calculate looping duration based on quote word count (approx. 200 WPM + 1s padding)
      const wordCount = quote.text.split(/\s+/).length;
      let calculatedDuration = Math.ceil((wordCount / 200) * 60 + 1.0);
      // Ensure reasonable bounds (e.g. at least 5s, at most 15s for stories compatibility)
      calculatedDuration = Math.max(5, Math.min(calculatedDuration, 15));
      
      const storyVideoResult = await createReelsVideoMP4({
        postImageBuffer: storyResult.imageBuffer,
        audioBuffer,
        startOffsetSeconds: audioSelection.peakStartSecond,
        durationSeconds: calculatedDuration,
        render4K: storyScale === 2,
        ghostVolume: 0.05,
      });

      const storyRelativePath = `data/posts/${account.id}/${dateStr}-${postId}-story.mp4`;
      const storyAbsolutePath = `${options.repoRoot}/${storyRelativePath}`;
      await writeFile(storyAbsolutePath, storyVideoResult.videoBuffer);

      console.log(`[Batch] Feed image saved to ${relativePath}, Story video saved to ${storyRelativePath}`);

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

      const hostedImageUrl = await uploadOrGetPublicImageUrl({
        imageBuffer,
        relativePath,
        githubRepoSlug: options.githubRepoSlug,
        githubBranch,
        webAppUrl: env.WEB_APP_URL,
        fetchImpl,
      });

      const verifiedImageUrl = await verifyPublicImageUrl(
        hostedImageUrl,
        options.githubRepoSlug,
        relativePath,
        fetchImpl,
        sleepImpl,
      );

      const storyHostedVideoUrl = await uploadOrGetPublicImageUrl({
        imageBuffer: storyVideoResult.videoBuffer,
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

      console.log(`[Batch] Publishing to Instagram Feed with image URL ${verifiedImageUrl}...`);
      let feedResult: { mediaId: string; permalink?: string } | undefined;
      
      const tryComposioFeed = async () => {
        console.log(`[Batch] Using Composio API...`);
        const compRes = await publishViaComposio({
          imageUrl: verifiedImageUrl,
          caption: `${caption}\n\n${hashtagComment}`,
          apiKey: env.COMPOSIO_API_KEY!,
          entityId: account.id,
          fetchImpl,
        });
        return { mediaId: compRes.mediaId, permalink: compRes.permalink };
      };

      const tryMetaGraphFeed = async () => {
        console.log(`[Batch] Using Meta Graph API...`);
        return await publishToFeed(verifiedImageUrl, caption, hashtagComment, igCreds!, fetchImpl, sleepImpl);
      };

      const isWeekend = currentTime.getDay() === 0 || currentTime.getDay() === 6;
      // 25% chance on weekends to force Meta Graph API (1 in 4 posts)
      const forceMetaGraph = isWeekend && random() < 0.25;

      if (env.COMPOSIO_API_KEY && !forceMetaGraph) {
        try {
          feedResult = await tryComposioFeed();
        } catch (err) {
          console.warn(`[Batch] Composio API failed for feed:`, err);
          if (igCreds) {
            console.log(`[Batch] Falling back to Meta Graph API...`);
            feedResult = await tryMetaGraphFeed();
          } else {
            throw err;
          }
        }
      } else if (igCreds) {
        feedResult = await tryMetaGraphFeed();
      } else {
        throw new Error("No publishing credentials available");
      }
      let storiesMediaId: string | undefined;
      const tryComposioStory = async () => {
        console.log(`[Batch] Cross-posting dedicated 9:16 Story via Composio...`);
        const compStory = await publishViaComposioStories({
          imageUrl: storyVerifiedVideoUrl,
          caption: "",
          apiKey: env.COMPOSIO_API_KEY!,
          entityId: account.id,
          fetchImpl,
        });
        return compStory.mediaId;
      };

      const tryMetaGraphStory = async () => {
        console.log(`[Batch] Cross-posting dedicated 9:16 Reel via Meta Graph API...`);
        try {
          const storyRes = await publishToReels(storyVerifiedVideoUrl, caption, igCreds!, fetchImpl, sleepImpl);
          console.log(`[Batch] Successfully cross-posted Reel! Media ID: ${storyRes.mediaId}`);
          return storyRes.mediaId;
        } catch (err) {
          console.error(`[Batch] Failed to post Reel:`, err);
          return undefined;
        }
      };

      try {
        if (env.COMPOSIO_API_KEY && !forceMetaGraph) {
          try {
            storiesMediaId = await tryComposioStory();
          } catch (err) {
            console.warn(`[Batch] Composio API failed for stories:`, err);
            if (igCreds) {
              console.log(`[Batch] Falling back to Meta Graph API for stories...`);
              storiesMediaId = await tryMetaGraphStory();
            } else {
              throw err;
            }
          }
        } else if (igCreds) {
          storiesMediaId = await tryMetaGraphStory();
        }
        if (storiesMediaId) {
          console.log(`[Batch] Successfully cross-posted Story! Media ID: ${storiesMediaId}`);
        }
      } catch (err) {
        console.warn(`[Batch] Story cross-post warning:`, err);
      }

      let threadsPostId: string | undefined;
      if (threadsCreds) {
        try {
          console.log(`[Batch] Cross-posting to Threads...`);
          const threads = await publishToThreads(verifiedImageUrl, caption, threadsCreds, fetchImpl, sleepImpl);
          threadsPostId = threads.mediaId;
          console.log(`[Batch] Successfully cross-posted to Threads! Post ID: ${threadsPostId}`);
        } catch (err) {
          console.warn(`[Batch] Threads cross-post warning:`, err);
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
