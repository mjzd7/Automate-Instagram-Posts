import sharp, { type OverlayOptions } from "sharp";
import {
  CARD_HORIZONTAL_MARGIN_PX,
  GRAIN_TEXTURE_OPACITY,
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  SCRIM_PEAK_OPACITY_NORMAL,
} from "../../images/constants.js";
import type { Darkness } from "../../images/darkness-classifier.js";
import { grainTexturePng } from "../../images/grain.js";
import { renderGlassCard } from "../../images/glass-card.js";
import { renderVignette } from "../../images/scrim.js";
import { renderFittedText, renderTextAtSize } from "../../images/text-render.js";
import { findTemplate, type FontFace } from "../../images/templates.js";
import type { PackItem } from "../quotes/content-pack.js";

export interface CarouselDeckInput {
  backgroundBuffer: Buffer;
  item: PackItem;
  mode?: Darkness;
  seriesName?: string;
  grainRandom?: () => number;
}

export interface CarouselSlideData {
  slideNumber: number;
  totalSlides: number;
  badge: string;
  title?: string;
  headline: string;
  bodyItems?: string[];
  footerCue: string;
  isOutro?: boolean;
}

const PAD_X = 64;
const PAD_Y = 80;
const MIN_CARD_WIDTH = 760;

function textColor(mode: Darkness): string {
  return mode === "dark" ? "#FFFFFF" : "#1A1A1A";
}

function mutedColor(mode: Darkness): string {
  return mode === "dark" ? "#FFFFFFBF" : "#1A1A1AA6";
}

function accentColor(mode: Darkness): string {
  return mode === "dark" ? "#E2E8F0" : "#2D3748";
}

/**
 * Builds the structured 5-slide data for a viral carousel from a PackItem.
 */
export function buildCarouselSlides(item: PackItem, seriesName = "MINDSET MANUAL"): CarouselSlideData[] {
  const fw = item.framework;
  const steps = fw?.steps ?? [
    "Identify the single highest-leverage priority",
    "Eliminate all reactive inputs before noon",
    "Execute in uninterrupted 90-minute blocks",
  ];

  const title = fw?.title ?? "The High-Yield Protocol";
  const hookHeadline = item.text.replace(/\.$/, "");
  const utility = item.utilityLine ?? "Apply this rule before your next working session.";

  return [
    // Slide 1: The Paradox Hook (Cover)
    {
      slideNumber: 1,
      totalSlides: 5,
      badge: `${seriesName.toUpperCase()} // VOL. 01`,
      headline: title,
      bodyItems: [`"${hookHeadline}."`],
      footerCue: "Swipe to break it down ➔ [ 01 / 05 ]",
    },
    // Slide 2: The Re-Serve Bridge (Standalone sub-hook for Instagram re-serve engine)
    {
      slideNumber: 2,
      totalSlides: 5,
      badge: `01. THE PROBLEM //`,
      headline: "The 'Productivity Illusion'",
      bodyItems: [
        "Being busy is not the same as moving the needle.",
        "Most people spend 80% of their day reacting to other people's priorities.",
        "Without an explicit daily boundary, low-value tasks expand to fill your entire calendar.",
      ],
      footerCue: "The system ➔ [ 02 / 05 ]",
    },
    // Slide 3: The Framework Breakdown (Part 1)
    {
      slideNumber: 3,
      totalSlides: 5,
      badge: `02. THE FRAMEWORK //`,
      headline: "Core Execution Rules",
      bodyItems: [
        `1. ${steps[0] ?? "Define the non-negotiable target"}`,
        `2. ${steps[1] ?? "Block peak cognitive hours"}`,
      ],
      footerCue: "Action steps ➔ [ 03 / 05 ]",
    },
    // Slide 4: Action Protocol (Part 2)
    {
      slideNumber: 4,
      totalSlides: 5,
      badge: `03. THE PROTOCOL //`,
      headline: "Daily Implementation",
      bodyItems: [
        steps[2] ? `3. ${steps[2]}` : "3. Protect your recovery window",
        steps[3] ? `4. ${steps[3]}` : `Rule: ${utility}`,
      ],
      footerCue: "Save this post ➔ [ 04 / 05 ]",
    },
    // Slide 5: The Save & DM Share Outro
    {
      slideNumber: 5,
      totalSlides: 5,
      badge: `ACTION REQUIRED //`,
      headline: "Save for Weekly Review",
      bodyItems: [
        "🔖 Save this post so you have the framework ready before Monday morning.",
        "🚀 Share this to your story if someone in your circle needs this reminder.",
        "✦ @success.for.sure · Daily Discipline & Mental Models",
      ],
      footerCue: "Tap Save Below 🔖 [ 05 / 05 ]",
      isOutro: true,
    },
  ];
}

/**
 * Composes a single carousel slide into a 4:5 JPEG buffer (1080x1350).
 */
export async function composeCarouselSlide(
  backgroundBuffer: Buffer,
  slide: CarouselSlideData,
  mode: Darkness = "dark",
  grainRandom: () => number = Math.random,
): Promise<Buffer> {
  const displayTemplate = findTemplate(mode === "dark" ? "bold-modern" : "general-cormorant");
  const headerFont = displayTemplate.authorFont;
  const quoteFont = displayTemplate.quoteFont;

  // Step 1: Base background resize + subtle ambient softening
  let baseBuffer = await sharp(backgroundBuffer)
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: "cover" })
    .blur(1.5)
    .png()
    .toBuffer();

  // Step 2: Radial vignette
  const vignette = await renderVignette(IMAGE_WIDTH, IMAGE_HEIGHT, mode);
  baseBuffer = await sharp(baseBuffer)
    .composite([{ input: vignette, left: 0, top: 0 }])
    .png()
    .toBuffer();

  // Step 3: Grain texture overlay
  const grain = await grainTexturePng(IMAGE_WIDTH, IMAGE_HEIGHT, grainRandom);
  const grainWithOpacity = await sharp(grain)
    .ensureAlpha(GRAIN_TEXTURE_OPACITY)
    .png()
    .toBuffer();
  baseBuffer = await sharp(baseBuffer)
    .composite([{ input: grainWithOpacity, blend: "overlay" }])
    .png()
    .toBuffer();

  const layers: OverlayOptions[] = [];

  // Compute Card bounds & measure elements
  const cardWidth = Math.max(MIN_CARD_WIDTH, IMAGE_WIDTH - 2 * CARD_HORIZONTAL_MARGIN_PX);
  const innerWidth = cardWidth - 2 * PAD_X;

  // 1. Badge (Series or Step Tag)
  const badgeRender = await renderTextAtSize(slide.badge, headerFont, 20, innerWidth, mutedColor(mode), 1, "left");

  // 2. Headline
  const headlineRender = await renderFittedText(
    slide.headline,
    quoteFont,
    innerWidth,
    180,
    textColor(mode),
    1,
    "left",
  );

  // 3. Body items / bullet rules
  const bodyRenders: { buffer: Buffer; height: number; gap: number }[] = [];
  if (slide.bodyItems && slide.bodyItems.length > 0) {
    for (const itemText of slide.bodyItems) {
      const isQuoteStyle = slide.slideNumber === 1;
      const fontSize = isQuoteStyle ? 34 : 26;
      const fontFace = isQuoteStyle ? quoteFont : headerFont;
      const col = isQuoteStyle ? textColor(mode) : accentColor(mode);

      const itemRender = await renderTextAtSize(itemText, fontFace, fontSize, innerWidth, col, 1, "left");
      bodyRenders.push({
        buffer: itemRender.data,
        height: itemRender.info.height,
        gap: isQuoteStyle ? 24 : 18,
      });
    }
  }

  // 4. Footer Swipe Cue / Slide Counter
  const footerRender = await renderTextAtSize(slide.footerCue, headerFont, 18, innerWidth, mutedColor(mode), 1, "left");

  // Compute total content height
  const bodyHeightTotal = bodyRenders.reduce((acc, r) => acc + r.height + r.gap, 0);
  const innerContentHeight =
    badgeRender.info.height +
    24 +
    headlineRender.height +
    32 +
    bodyHeightTotal +
    40 +
    footerRender.info.height;

  const cardHeight = Math.max(580, innerContentHeight + PAD_Y * 2);
  const cardLeft = Math.round((IMAGE_WIDTH - cardWidth) / 2);
  const cardTop = Math.round((IMAGE_HEIGHT - cardHeight) / 2);

  // Step 4: Render Glass Card
  const glassCard = await renderGlassCard({
    width: cardWidth,
    height: cardHeight,
    mode,
    categoryName: "mindset",
    scrimOpacity: SCRIM_PEAK_OPACITY_NORMAL,
    showQuotes: false,
  });
  layers.push({ input: glassCard, top: cardTop, left: cardLeft });

  // Inside Card Content Placement (vertically centered inside card)
  let currentY = cardTop + Math.round((cardHeight - innerContentHeight) / 2);

  // Place Badge
  layers.push({ input: badgeRender.data, top: Math.round(currentY), left: cardLeft + PAD_X });
  currentY += badgeRender.info.height + 24;

  // Place Headline
  layers.push({ input: headlineRender.buffer, top: Math.round(currentY), left: cardLeft + PAD_X });
  currentY += headlineRender.height + 32;

  // Place Body Items
  for (const item of bodyRenders) {
    layers.push({ input: item.buffer, top: Math.round(currentY), left: cardLeft + PAD_X });
    currentY += item.height + item.gap;
  }

  // Place Footer Swipe Cue
  currentY += 24;
  layers.push({ input: footerRender.data, top: Math.round(currentY), left: cardLeft + PAD_X });

  return sharp(baseBuffer)
    .composite(layers)
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}

/**
 * Composes all 5 slides of a viral carousel deck.
 */
export async function composeCarouselDeck(input: CarouselDeckInput): Promise<Buffer[]> {
  const { backgroundBuffer, item, mode = "dark", seriesName, grainRandom } = input;
  const slides = buildCarouselSlides(item, seriesName);

  const buffers: Buffer[] = [];
  for (const slide of slides) {
    const slideBuffer = await composeCarouselSlide(backgroundBuffer, slide, mode, grainRandom);
    buffers.push(slideBuffer);
  }
  return buffers;
}
