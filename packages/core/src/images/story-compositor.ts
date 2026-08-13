import sharp, { type OverlayOptions } from "sharp";
import type { Darkness } from "./darkness-classifier.js";
import { grainTexturePng } from "./grain.js";
import { renderScrim, renderVignette } from "./scrim.js";
import type { SuitabilityResult } from "./suitability-scorer.js";
import type { Template, StoryTemplateId } from "./templates.js";
import { findStoryTemplate, selectStoryTemplate } from "./templates.js";
import { composeImage } from "./compositor.js";

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
export const STORY_TOP_SAFE_ZONE = 180;
export const STORY_BOTTOM_SAFE_ZONE = 220;

export interface ComposeStoryInput {
  backgroundBuffer: Buffer;
  quoteText: string;
  author?: string;
  template: Template;
  mode: Darkness;
  suitability: SuitabilityResult;
  accountHandle?: string;
  grainRandom?: () => number;
  feedPostBuffer?: Buffer;
  storyTemplateId?: StoryTemplateId;
  audioTrack?: {
    title: string;
    artist: string;
  };
  scale?: number;
}

export interface ComposeStoryResult {
  imageBuffer: Buffer;
  linkStickerZone: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  templateId: StoryTemplateId;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function createHeaderBadge(text: string, width: number, height: number, mode: Darkness, scale: number = 1): Promise<Buffer> {
  const isDark = mode === "dark";
  const fill = isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(0, 0, 0, 0.08)";
  const stroke = isDark ? "rgba(255, 255, 255, 0.30)" : "rgba(0, 0, 0, 0.20)";
  const textColor = isDark ? "#FFFFFF" : "#1A1A1A";

  const sw = 1.5 * scale;
  const fs = 20 * scale;
  const ls = 2 * scale;

  const svg = `<svg width="${width}" height="${height}">
    <rect x="${1 * scale}" y="${1 * scale}" width="${width - 2 * scale}" height="${height - 2 * scale}" rx="${height / 2}" ry="${height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="${fs}" font-weight="700" letter-spacing="${ls}">${escapeXml(text)}</text>
  </svg>`;

  return Buffer.from(svg);
}

async function createCtaBox(text: string, width: number, height: number, mode: Darkness, style: StoryTemplateId, scale: number = 1): Promise<Buffer> {
  const isDark = mode === "dark";
  let fill = isDark ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.12)";
  let stroke = isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.25)";
  let textColor = isDark ? "#FFFFFF" : "#1A1A1A";
  let radius = height / 2;

  if (style === "story-editorial-newspaper") {
    fill = isDark ? "#1E1E1E" : "#F4F1EA";
    stroke = isDark ? "#FFFFFF" : "#1A1A1A";
    radius = 6 * scale;
  } else if (style === "story-polaroid-teaser") {
    fill = "#FFFFFF";
    stroke = "#E2DDD3";
    textColor = "#1A1A1A";
    radius = 14 * scale;
  } else if (style === "story-split-focus") {
    fill = isDark ? "#FFD700" : "#1A1A1A";
    stroke = isDark ? "#FFD700" : "#1A1A1A";
    textColor = isDark ? "#1A1A1A" : "#FFFFFF";
    radius = 28 * scale;
  }

  const sw = 2 * scale;
  const fs = 22 * scale;
  const ls = 1 * scale;

  const svg = `<svg width="${width}" height="${height}">
    <rect x="${2 * scale}" y="${2 * scale}" width="${width - 4 * scale}" height="${height - 4 * scale}" rx="${radius}" ry="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="${fs}" font-weight="bold" letter-spacing="${ls}">${escapeXml(text)}</text>
  </svg>`;

  return Buffer.from(svg);
}

async function createFramedFeedPost(
  feedBuffer: Buffer,
  targetWidth: number,
  targetHeight: number,
  options: {
    borderRadius?: number;
    borderStrokeColor?: string;
    polaroid?: boolean;
    polaroidCaption?: string;
    scale?: number;
  },
): Promise<Buffer> {
  const { borderRadius = 24, borderStrokeColor, polaroid = false, polaroidCaption, scale = 1 } = options;

  if (polaroid) {
    const frameW = targetWidth;
    const frameH = targetHeight;
    const imageMargin = 40 * scale;
    const imgSize = frameW - imageMargin * 2;
    const rx = 16 * scale;

    const resizedImg = await sharp(feedBuffer)
      .resize(imgSize, imgSize, { fit: "cover" })
      .toBuffer();

    const polaroidBgSvg = `<svg width="${frameW}" height="${frameH}">
      <rect x="0" y="0" width="${frameW}" height="${frameH}" rx="${rx}" ry="${rx}" fill="#FDFBF7" />
      <rect x="${imageMargin - 2 * scale}" y="${imageMargin - 2 * scale}" width="${imgSize + 4 * scale}" height="${imgSize + 4 * scale}" fill="#EAE5D9" />
    </svg>`;

    let basePolaroid = await sharp(Buffer.from(polaroidBgSvg))
      .composite([{ input: resizedImg, left: imageMargin, top: imageMargin }])
      .png()
      .toBuffer();

    if (polaroidCaption) {
      const fs = 24 * scale;
      const topOff = imageMargin + imgSize + 10 * scale;
      const captionSvg = `<svg width="${frameW}" height="${frameH - imgSize - imageMargin * 2}">
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#2B2B2B" font-family="sans-serif" font-size="${fs}" font-weight="600">${escapeXml(polaroidCaption)}</text>
      </svg>`;
      basePolaroid = await sharp(basePolaroid)
        .composite([{ input: Buffer.from(captionSvg), left: 0, top: topOff }])
        .png()
        .toBuffer();
    }

    return basePolaroid;
  }

  const resized = await sharp(feedBuffer)
    .resize(targetWidth, targetHeight, { fit: "cover" })
    .toBuffer();

  const maskSvg = `<svg width="${targetWidth}" height="${targetHeight}">
    <rect x="0" y="0" width="${targetWidth}" height="${targetHeight}" rx="${borderRadius}" ry="${borderRadius}" fill="#FFFFFF"/>
  </svg>`;

  let framed = await sharp(resized)
    .composite([{ input: Buffer.from(maskSvg), blend: "dest-in" }])
    .png()
    .toBuffer();

  if (borderStrokeColor) {
    const sw = 3 * scale;
    const strokeSvg = `<svg width="${targetWidth}" height="${targetHeight}">
      <rect x="${1 * scale}" y="${1 * scale}" width="${targetWidth - 2 * scale}" height="${targetHeight - 2 * scale}" rx="${borderRadius}" ry="${borderRadius}" fill="none" stroke="${borderStrokeColor}" stroke-width="${sw}"/>
    </svg>`;
    framed = await sharp(framed)
      .composite([{ input: Buffer.from(strokeSvg) }])
      .png()
      .toBuffer();
  }

  return framed;
}

async function createDropShadow(width: number, height: number, borderRadius = 24, scale = 1): Promise<Buffer> {
  const pad = 40 * scale;
  const off = 20 * scale;
  const blur = 16 * scale;
  const shadowSvg = `<svg width="${width + pad}" height="${height + pad}">
    <rect x="${off}" y="${off}" width="${width}" height="${height}" rx="${borderRadius}" ry="${borderRadius}" fill="rgba(0, 0, 0, 0.5)"/>
  </svg>`;
  return sharp(Buffer.from(shadowSvg)).blur(blur).toBuffer();
}

async function createAudioBadgeOverlay(title: string, artist: string, mode: Darkness, scale: number = 1): Promise<Buffer> {
  const isDark = mode === "dark";
  const bg = isDark ? "rgba(0, 0, 0, 0.45)" : "rgba(255, 255, 255, 0.55)";
  const stroke = isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.15)";
  const textColor = isDark ? "#FFFFFF" : "#1A1A1A";
  const barColor = isDark ? "#A5F3FC" : "#2563EB";

  const textDisplay = escapeXml(`${title} — ${artist}`.slice(0, 32));
  
  const w = 420 * scale;
  const h = 48 * scale;
  const sw = 1.5 * scale;
  const rx = 23 * scale;
  const fs = 16 * scale;
  
  const tx = 18 * scale;
  const ty = 14 * scale;

  const svg = `<svg width="${w}" height="${h}">
    <rect x="${1 * scale}" y="${1 * scale}" width="${w - 2 * scale}" height="${h - 2 * scale}" rx="${rx}" ry="${rx}" fill="${bg}" stroke="${stroke}" stroke-width="${sw}"/>
    <g transform="translate(${tx}, ${ty})">
      <rect x="0" y="${4 * scale}" width="${3 * scale}" height="${12 * scale}" fill="${barColor}" rx="${scale}"/>
      <rect x="${6 * scale}" y="0" width="${3 * scale}" height="${18 * scale}" fill="${barColor}" rx="${scale}"/>
      <rect x="${12 * scale}" y="${7 * scale}" width="${3 * scale}" height="${10 * scale}" fill="${barColor}" rx="${scale}"/>
      <rect x="${18 * scale}" y="${2 * scale}" width="${3 * scale}" height="${15 * scale}" fill="${barColor}" rx="${scale}"/>
    </g>
    <text x="${46 * scale}" y="52%" dominant-baseline="middle" fill="${textColor}" font-family="sans-serif" font-size="${fs}" font-weight="600">${textDisplay}</text>
  </svg>`;

  return Buffer.from(svg);
}

/**
 * Composes a full 9:16 (1080x1920) Instagram Story with safe zones, framed 1:1 post,
 * engagement hook headers, and dedicated link sticker target zones.
 */
export async function composeStory(input: ComposeStoryInput): Promise<ComposeStoryResult> {
  const { backgroundBuffer, quoteText, author, template, mode, suitability, accountHandle, grainRandom, scale = 1 } = input;
  
  const W = STORY_WIDTH * scale;
  const H = STORY_HEIGHT * scale;
  const topSafe = STORY_TOP_SAFE_ZONE * scale;
  const bottomSafe = STORY_BOTTOM_SAFE_ZONE * scale;

  const chosenStoryTemplate = input.storyTemplateId
    ? findStoryTemplate(input.storyTemplateId)
    : selectStoryTemplate(template.categories[0], undefined);

  // Obtain or render the 1:1 Feed Post image buffer
  const feedPostBuffer =
    input.feedPostBuffer ??
    (await composeImage({
      backgroundBuffer,
      quoteText,
      author,
      template,
      mode,
      suitability,
      grainRandom,
      scale,
    }));

  // Step 1: Create ambient blurred full-bleed background
  let baseBuffer = await sharp(backgroundBuffer)
    .resize(W, H, { fit: "cover", position: "center" })
    .blur(30)
    .toBuffer();

  // Step 2: Apply vignette & scrim
  const vignettePng = await renderVignette(W, H, mode);
  const scrimPng = await renderScrim(W, H, mode, suitability.scrimOpacity);

  baseBuffer = await sharp(baseBuffer)
    .composite([
      { input: vignettePng, left: 0, top: 0 },
      { input: scrimPng, left: 0, top: 0 },
    ])
    .toBuffer();

  // Step 3: Grain texture
  const grainPng = await grainTexturePng(W, H, grainRandom);
  baseBuffer = await sharp(baseBuffer)
    .composite([{ input: grainPng, left: 0, top: 0 }])
    .toBuffer();

  const compositeLayers: OverlayOptions[] = [];
  const handleDisplay = accountHandle ?? "@success.for.sure";

  // Step 4: Render Header Badge (Y = 210px)
  const headerText = chosenStoryTemplate.headerText || `NEW POST ✦ ${handleDisplay}`;
  const headerW = 480 * scale;
  const headerH = 56 * scale;
  const headerBadge = await createHeaderBadge(headerText, headerW, headerH, mode, scale);
  compositeLayers.push({
    input: headerBadge,
    left: Math.round((W - headerW) / 2),
    top: topSafe + 30 * scale,
  });

  // Step 5: Render Framed Post based on Template Style
  let postW = 800 * scale;
  let postH = 800 * scale;
  let postTop = 310 * scale;
  let isPolaroid = false;
  let borderRadius = 24 * scale;
  let strokeColor: string | undefined = undefined;

  switch (chosenStoryTemplate.id) {
    case "story-polaroid-teaser":
      postW = 820 * scale;
      postH = 940 * scale;
      postTop = 300 * scale;
      isPolaroid = true;
      break;
    case "story-editorial-newspaper":
      postW = 780 * scale;
      postH = 780 * scale;
      postTop = 320 * scale;
      borderRadius = 4 * scale;
      strokeColor = mode === "dark" ? "#FFFFFF" : "#1A1A1A";
      break;
    case "story-split-focus":
      postW = 740 * scale;
      postH = 740 * scale;
      postTop = 340 * scale;
      borderRadius = 28 * scale;
      strokeColor = mode === "dark" ? "rgba(255,215,0,0.6)" : "rgba(0,0,0,0.4)";
      break;
    case "story-minimalist-quote-frame":
      postW = 820 * scale;
      postH = 820 * scale;
      postTop = 300 * scale;
      borderRadius = 12 * scale;
      strokeColor = mode === "dark" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
      break;
    case "story-interactive-spotlight":
      postW = 760 * scale;
      postH = 760 * scale;
      postTop = 330 * scale;
      borderRadius = 20 * scale;
      break;
    case "story-floating-card":
    default:
      postW = 800 * scale;
      postH = 800 * scale;
      postTop = 310 * scale;
      borderRadius = 24 * scale;
      break;
  }

  // Framed Post
  const framedPost = await createFramedFeedPost(feedPostBuffer, postW, postH, {
    borderRadius,
    borderStrokeColor: strokeColor,
    polaroid: isPolaroid,
    polaroidCaption: author ? `— ${author.toUpperCase()} —` : quoteText.slice(0, 30) + "...",
    scale,
  });

  const postShadow = await createDropShadow(postW, postH, borderRadius, scale);
  const postLeft = Math.round((W - postW) / 2);
  const shadowOff = 20 * scale;

  compositeLayers.push(
    { input: postShadow, left: postLeft - shadowOff, top: postTop - shadowOff },
    { input: framedPost, left: postLeft, top: postTop },
  );

  // Step 6: Render Audio Badge (Y = 1220px depending on post height)
  if (input.audioTrack) {
    const audioBadge = await createAudioBadgeOverlay(input.audioTrack.title, input.audioTrack.artist, mode, scale);
    const audioY = postTop + postH + 60 * scale;
    const badgeW = 420 * scale;
    compositeLayers.push({
      input: audioBadge,
      left: Math.round((W - badgeW) / 2),
      top: audioY,
    });
  }

  // Step 7: Render CTA / Link Sticker Target (Bottom Safe Zone)
  const zone = chosenStoryTemplate.linkStickerZone;
  const ctaText = chosenStoryTemplate.ctaText || "READ THE FULL POST";
  const ctaW = zone.width * scale;
  const ctaH = zone.height * scale;
  const ctaBox = await createCtaBox(ctaText, ctaW, ctaH, mode, chosenStoryTemplate.id, scale);
  const ctaY = zone.y * scale;
  const ctaX = zone.x * scale;
  
  compositeLayers.push({
    input: ctaBox,
    left: ctaX,
    top: ctaY,
  });

  // Calculate Link Sticker Zone relative to 1080p equivalent API targets
  const linkStickerZone = zone;

  const composed = sharp(baseBuffer).composite(compositeLayers);
  const imageBuffer = await composed.jpeg({ quality: 100, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();

  return {
    imageBuffer,
    linkStickerZone,
    templateId: chosenStoryTemplate.id,
  };
}

/**
 * Backward-compatible helper returning JPEG Buffer for Story post generation.
 */
export async function composeStoryImage(input: ComposeStoryInput): Promise<Buffer> {
  const result = await composeStory(input);
  return result.imageBuffer;
}
