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

async function createHeaderBadge(text: string, width: number, height: number, mode: Darkness): Promise<Buffer> {
  const isDark = mode === "dark";
  const fill = isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(0, 0, 0, 0.08)";
  const stroke = isDark ? "rgba(255, 255, 255, 0.30)" : "rgba(0, 0, 0, 0.20)";
  const textColor = isDark ? "#FFFFFF" : "#1A1A1A";

  const svg = `<svg width="${width}" height="${height}">
    <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${height / 2}" ry="${height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="20" font-weight="700" letter-spacing="2">${escapeXml(text)}</text>
  </svg>`;

  return Buffer.from(svg);
}

async function createCtaBox(text: string, width: number, height: number, mode: Darkness, style: StoryTemplateId): Promise<Buffer> {
  const isDark = mode === "dark";
  let fill = isDark ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.12)";
  let stroke = isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.25)";
  let textColor = isDark ? "#FFFFFF" : "#1A1A1A";
  let radius = height / 2;

  if (style === "story-editorial-newspaper") {
    fill = isDark ? "#1E1E1E" : "#F4F1EA";
    stroke = isDark ? "#FFFFFF" : "#1A1A1A";
    radius = 6;
  } else if (style === "story-polaroid-teaser") {
    fill = "#FFFFFF";
    stroke = "#E2DDD3";
    textColor = "#1A1A1A";
    radius = 14;
  } else if (style === "story-split-focus") {
    fill = isDark ? "#FFD700" : "#1A1A1A";
    stroke = isDark ? "#FFD700" : "#1A1A1A";
    textColor = isDark ? "#1A1A1A" : "#FFFFFF";
    radius = 28;
  }

  const svg = `<svg width="${width}" height="${height}">
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="${radius}" ry="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="22" font-weight="bold" letter-spacing="1">${escapeXml(text)}</text>
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
  },
): Promise<Buffer> {
  const { borderRadius = 24, borderStrokeColor, polaroid = false, polaroidCaption } = options;

  if (polaroid) {
    const frameW = targetWidth;
    const frameH = targetHeight;
    const imageMargin = 40;
    const imgSize = frameW - imageMargin * 2;

    const resizedImg = await sharp(feedBuffer)
      .resize(imgSize, imgSize, { fit: "cover" })
      .toBuffer();

    const polaroidBgSvg = `<svg width="${frameW}" height="${frameH}">
      <rect x="0" y="0" width="${frameW}" height="${frameH}" rx="16" ry="16" fill="#FDFBF7" />
      <rect x="${imageMargin - 2}" y="${imageMargin - 2}" width="${imgSize + 4}" height="${imgSize + 4}" fill="#EAE5D9" />
    </svg>`;

    let basePolaroid = await sharp(Buffer.from(polaroidBgSvg))
      .composite([{ input: resizedImg, left: imageMargin, top: imageMargin }])
      .png()
      .toBuffer();

    if (polaroidCaption) {
      const captionSvg = `<svg width="${frameW}" height="${frameH - imgSize - imageMargin * 2}">
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#2B2B2B" font-family="sans-serif" font-size="24" font-weight="600">${escapeXml(polaroidCaption)}</text>
      </svg>`;
      basePolaroid = await sharp(basePolaroid)
        .composite([{ input: Buffer.from(captionSvg), left: 0, top: imageMargin + imgSize + 10 }])
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
    const strokeSvg = `<svg width="${targetWidth}" height="${targetHeight}">
      <rect x="1" y="1" width="${targetWidth - 2}" height="${targetHeight - 2}" rx="${borderRadius}" ry="${borderRadius}" fill="none" stroke="${borderStrokeColor}" stroke-width="3"/>
    </svg>`;
    framed = await sharp(framed)
      .composite([{ input: Buffer.from(strokeSvg) }])
      .png()
      .toBuffer();
  }

  return framed;
}

async function createDropShadow(width: number, height: number, borderRadius = 24): Promise<Buffer> {
  const shadowSvg = `<svg width="${width + 40}" height="${height + 40}">
    <rect x="20" y="20" width="${width}" height="${height}" rx="${borderRadius}" ry="${borderRadius}" fill="rgba(0, 0, 0, 0.5)"/>
  </svg>`;
  return sharp(Buffer.from(shadowSvg)).blur(16).toBuffer();
}

async function createAudioBadgeOverlay(title: string, artist: string, mode: Darkness): Promise<Buffer> {
  const isDark = mode === "dark";
  const bg = isDark ? "rgba(0, 0, 0, 0.45)" : "rgba(255, 255, 255, 0.55)";
  const stroke = isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.15)";
  const textColor = isDark ? "#FFFFFF" : "#1A1A1A";
  const barColor = isDark ? "#A5F3FC" : "#2563EB";

  const textDisplay = escapeXml(`${title} — ${artist}`.slice(0, 32));

  const svg = `<svg width="420" height="48">
    <rect x="1" y="1" width="418" height="46" rx="23" ry="23" fill="${bg}" stroke="${stroke}" stroke-width="1.5"/>
    <g transform="translate(18, 14)">
      <rect x="0" y="4" width="3" height="12" fill="${barColor}" rx="1"/>
      <rect x="6" y="0" width="3" height="18" fill="${barColor}" rx="1"/>
      <rect x="12" y="7" width="3" height="10" fill="${barColor}" rx="1"/>
      <rect x="18" y="2" width="3" height="15" fill="${barColor}" rx="1"/>
    </g>
    <text x="46" y="52%" dominant-baseline="middle" fill="${textColor}" font-family="sans-serif" font-size="16" font-weight="600">${textDisplay}</text>
  </svg>`;

  return Buffer.from(svg);
}

/**
 * Composes a full 9:16 (1080x1920) Instagram Story with safe zones, framed 1:1 post,
 * engagement hook headers, and dedicated link sticker target zones.
 */
export async function composeStory(input: ComposeStoryInput): Promise<ComposeStoryResult> {
  const { backgroundBuffer, quoteText, author, template, mode, suitability, accountHandle, grainRandom } = input;

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
    }));

  // Step 1: Create ambient blurred full-bleed background
  let baseBuffer = await sharp(backgroundBuffer)
    .resize(STORY_WIDTH, STORY_HEIGHT, { fit: "cover", position: "center" })
    .blur(30)
    .toBuffer();

  // Step 2: Apply vignette & scrim
  const vignettePng = await renderVignette(STORY_WIDTH, STORY_HEIGHT, mode);
  const scrimPng = await renderScrim(STORY_WIDTH, STORY_HEIGHT, mode, suitability.scrimOpacity);

  baseBuffer = await sharp(baseBuffer)
    .composite([
      { input: vignettePng, left: 0, top: 0 },
      { input: scrimPng, left: 0, top: 0 },
    ])
    .toBuffer();

  // Step 3: Grain texture
  const grainPng = await grainTexturePng(STORY_WIDTH, STORY_HEIGHT, grainRandom);
  baseBuffer = await sharp(baseBuffer)
    .composite([{ input: grainPng, left: 0, top: 0 }])
    .toBuffer();

  const compositeLayers: OverlayOptions[] = [];
  const handleDisplay = accountHandle ?? "@success.for.sure";

  // Step 4: Render Header Badge (Y = 210px)
  const headerText = chosenStoryTemplate.headerText || `NEW POST ✦ ${handleDisplay}`;
  const headerBadge = await createHeaderBadge(headerText, 480, 56, mode);
  compositeLayers.push({
    input: headerBadge,
    left: Math.round((STORY_WIDTH - 480) / 2),
    top: STORY_TOP_SAFE_ZONE + 30,
  });

  // Step 5: Render Framed Post based on Template Style
  let postW = 800;
  let postH = 800;
  let postTop = 310;
  let isPolaroid = false;
  let borderRadius = 24;
  let strokeColor: string | undefined = undefined;

  switch (chosenStoryTemplate.id) {
    case "story-polaroid-teaser":
      postW = 820;
      postH = 940;
      postTop = 300;
      isPolaroid = true;
      break;
    case "story-editorial-newspaper":
      postW = 780;
      postH = 780;
      postTop = 320;
      borderRadius = 4;
      strokeColor = mode === "dark" ? "#FFFFFF" : "#1A1A1A";
      break;
    case "story-split-focus":
      postW = 740;
      postH = 740;
      postTop = 340;
      borderRadius = 28;
      strokeColor = mode === "dark" ? "rgba(255,215,0,0.6)" : "rgba(0,0,0,0.4)";
      break;
    case "story-minimalist-quote-frame":
      postW = 820;
      postH = 820;
      postTop = 300;
      borderRadius = 12;
      strokeColor = mode === "dark" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
      break;
    case "story-interactive-spotlight":
      postW = 760;
      postH = 760;
      postTop = 330;
      borderRadius = 20;
      break;
    case "story-floating-card":
    default:
      postW = 800;
      postH = 800;
      postTop = 310;
      borderRadius = 24;
      break;
  }

  const postLeft = Math.round((STORY_WIDTH - postW) / 2);

  // Drop Shadow
  const shadowBuf = await createDropShadow(postW, postH, borderRadius);
  compositeLayers.push({
    input: shadowBuf,
    left: postLeft - 20,
    top: postTop - 10,
  });

  // Framed Post
  const framedPost = await createFramedFeedPost(feedPostBuffer, postW, postH, {
    borderRadius,
    borderStrokeColor: strokeColor,
    polaroid: isPolaroid,
    polaroidCaption: author ? `— ${author.toUpperCase()} —` : quoteText.slice(0, 30) + "...",
  });

  compositeLayers.push({
    input: framedPost,
    left: postLeft,
    top: postTop,
  });

  // Step 6: Render CTA Link Sticker Zone (Y = 1320px)
  const zone = chosenStoryTemplate.linkStickerZone;
  const ctaBox = await createCtaBox(chosenStoryTemplate.ctaText, zone.width, zone.height, mode, chosenStoryTemplate.id);
  compositeLayers.push({
    input: ctaBox,
    left: zone.x,
    top: zone.y,
  });

  // Step 7: Audio Badge Overlay removed (User requested no music name tag in stories)

  const composed = sharp(baseBuffer).composite(compositeLayers);
  const imageBuffer = await composed.jpeg({ quality: 100, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();

  return {
    imageBuffer,
    linkStickerZone: zone,
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
