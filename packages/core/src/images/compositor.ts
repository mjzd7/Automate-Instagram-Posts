import sharp, { type OverlayOptions } from "sharp";
import {
  AUTHOR_LINE_FONT_SIZE_MIN,
  AUTHOR_LINE_FONT_SIZE_RATIO,
  CARD_HORIZONTAL_MARGIN_PX,
  CARD_PADDING_X_PX,
  CARD_VERTICAL_MARGIN_PX,
  GRAIN_TEXTURE_OPACITY,
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  TEXT_SHADOW_BLUR_PX,
  TEXT_SHADOW_COLOR_DARK_MODE,
  TEXT_SHADOW_COLOR_LIGHT_MODE,
  TEXT_SHADOW_OFFSET_Y_PX,
} from "./constants.js";
import type { Darkness } from "./darkness-classifier.js";
import { grainTexturePng } from "./grain.js";
import { renderVignette } from "./scrim.js";
import { renderGlassCard } from "./glass-card.js";
import type { SuitabilityResult } from "./suitability-scorer.js";
import { renderFittedText, renderTextAtSize, QuoteTruncatedError } from "./text-render.js";
import type { Template } from "./templates.js";



export interface ComposeInput {
  backgroundBuffer: Buffer;
  quoteText: string;
  author?: string;
  template: Template;
  mode: Darkness;
  suitability: SuitabilityResult;
  /** Overrides the grain texture's RNG (default Math.random) -- exists so tests can hold grain constant across two composeImage() calls and isolate other differences. */
  grainRandom?: () => number;
  /** Scale factor for native 4K generation (e.g. 2 for 4K). Default is 1 (1080p). */
  scale?: number;
}

const AUTHOR_GAP_PX = 40; // Fix #10: was 24 — more breathing room between quote and author

function textColor(mode: Darkness): string {
  return mode === "dark" ? "#FFFFFF" : "#1A1A1A";
}

/** Muted version of textColor for the author line (fix #9). */
function authorColor(mode: Darkness): string {
  // Dark: slightly translucent white. Light: dark ink at 65% opacity.
  return mode === "dark" ? "#FFFFFFBF" : "#1A1A1AA6";
}

function shadowColor(mode: Darkness): string {
  return mode === "dark" ? TEXT_SHADOW_COLOR_DARK_MODE : TEXT_SHADOW_COLOR_LIGHT_MODE;
}

/**
 * Renders a drop shadow for an already-rendered text layer by re-rendering
 * the same text/size/width in the shadow color, blurring that layer, and
 * returning it to be composited underneath the real (crisp) text layer at
 * a vertical offset -- sharp has no per-composite-layer shadow primitive,
 * so this is the standard way to fake one.
 */
async function renderTextShadow(
  text: string,
  face: Template["quoteFont"],
  fontSize: number,
  maxWidth: number,
  mode: Darkness,
  scale: number = 1,
  shadowBlur: number = TEXT_SHADOW_BLUR_PX
): Promise<Buffer> {
  const { data } = await renderTextAtSize(text, face, fontSize, maxWidth, shadowColor(mode), scale);
  return sharp(data).blur(shadowBlur).png().toBuffer();
}

/**
 * Composites the final post image per plan.md §7.11. Returns a JPEG buffer
 * (quality 85) ready to write to data/posts/.
 */
export async function composeImage(input: ComposeInput): Promise<Buffer> {
  const { backgroundBuffer, quoteText, author, template, mode, suitability, grainRandom, scale = 1 } = input;

  const W = IMAGE_WIDTH * scale;
  const H = IMAGE_HEIGHT * scale;
  const cardHorizMargin = CARD_HORIZONTAL_MARGIN_PX * scale;
  const cardVertMargin = CARD_VERTICAL_MARGIN_PX * scale;
  const cardPaddingX = CARD_PADDING_X_PX * scale;
  const shadowBlur = TEXT_SHADOW_BLUR_PX * scale;
  const shadowOffsetY = TEXT_SHADOW_OFFSET_Y_PX * scale;
  const authorGap = AUTHOR_GAP_PX * scale;
  const authorLineMin = AUTHOR_LINE_FONT_SIZE_MIN * scale;

  // Step 1: resize background to exactly W x H, cover-fit, and apply ambient softening.
  let baseBuffer = await sharp(backgroundBuffer)
    .resize(W, H, { fit: "cover" })
    .blur(1.5)
    .png()
    .toBuffer();

  // Step 2: apply radial vignette to draw focus to the central card.
  const vignette = await renderVignette(W, H, mode);
  baseBuffer = await sharp(baseBuffer)
    .composite([{ input: vignette, left: 0, top: 0 }])
    .png()
    .toBuffer();

  // Step 3: if background text zone is busy, apply extra smooth full-frame ambient blur (no harsh regional patches).
  if (suitability.blurRegion) {
    baseBuffer = await sharp(baseBuffer)
      .blur(2.5)
      .png()
      .toBuffer();
  }

  // Step 4: composite grain texture, overlay blend, low opacity.
  const grain = await grainTexturePng(W, H, grainRandom);
  const grainWithOpacity = await sharp(grain)
    .ensureAlpha(GRAIN_TEXTURE_OPACITY)
    .png()
    .toBuffer();
  baseBuffer = await sharp(baseBuffer)
    .composite([{ input: grainWithOpacity, blend: "overlay" }])
    .png()
    .toBuffer();

  // Steps 5-6: render quote text, auto-fit within the card's available height.
  //
  // KEY FIX — previous bug: quoteMaxHeight was taken from
  // suitability.textZoneRegion.height (~337px), a zone used only for
  // busyness analysis, NOT a layout constraint. At 337px, a 15-word quote
  // at FONT_SIZE_MIN=32px could still overflow, triggering the truncation
  // path and silently clipping the quote.
  //
  // Correct constraint: the maximum text block height is derived from the
  // maximum card height that still leaves CARD_VERTICAL_MARGIN_PX of
  // breathing room above and below the card in the image frame.
  //   maxCardHeight = IMAGE_HEIGHT - 2 * CARD_VERTICAL_MARGIN_PX
  //   quoteMaxHeight = maxCardHeight - cardPaddingTop - cardPaddingBottom
  //                   - estimated author block (AUTHOR_LINE_FONT_SIZE_MIN + AUTHOR_GAP_PX)
  //
  // This gives ~836px vs the former ~337px — quotes will virtually never
  // truncate, and if they somehow still do (single extremely long word), the
  // QuoteTruncatedError guard below prevents a clipped post from being saved.
  const cardMaxWidth = W - 2 * cardHorizMargin;
  const textMaxWidth = cardMaxWidth - 2 * cardPaddingX;
  const color = textColor(mode);
  const cardPaddingTop    = 130 * scale;
  const cardPaddingBottom = 80 * scale;
  const maxCardHeight = H - 2 * cardVertMargin;
  const authorEstimatePx  = authorLineMin + authorGap; // conservative upper bound
  const quoteMaxHeight = maxCardHeight - cardPaddingTop - cardPaddingBottom - authorEstimatePx;

  // Note: renderFittedText is called with 1080p logical dimensions and passes the scale directly 
  // so word-count math and FONT_SIZE_MAX constraints stay in 1080p logical units, but the text 
  // output buffer is rendered in crisp native scaled pixels.
  const quoteRender = await renderFittedText(quoteText, template.quoteFont, textMaxWidth / scale, quoteMaxHeight / scale, color, scale);

  // Truncation guard: if the renderer still had to clip the quote (only
  // possible now for pathologically long single tokens or very unusual
  // font metrics), throw so the pipeline retries with a different quote.
  // A truncated post must never be saved or published.
  if (quoteRender.truncated) {
    throw new QuoteTruncatedError(quoteText, quoteRender.fontSize);
  }

  // Author line, sized relative to the final quote font size.
  // Fix #9: prepend em-dash + space for visual separation from the quote body.
  let authorRender: Awaited<ReturnType<typeof renderFittedText>> | undefined;
  const authorDisplay = author?.trim() ? `— ${author.trim()}` : undefined;
  if (authorDisplay) {
    const logicalAuthorFontSize = Math.max(
      AUTHOR_LINE_FONT_SIZE_MIN,
      Math.round(quoteRender.fontSize * AUTHOR_LINE_FONT_SIZE_RATIO),
    );
    const { data, info } = await renderTextAtSize(authorDisplay, template.authorFont, logicalAuthorFontSize, textMaxWidth / scale, authorColor(mode), scale);
    authorRender = { buffer: data, width: info.width, height: info.height, fontSize: logicalAuthorFontSize, truncated: false };
  }

  const textBlockHeight = quoteRender.height + (authorRender ? authorGap + authorRender.height : 0);

  // Step 7: Mathematically symmetrical glass card & text positioning.
  // Fix #6/#10: increased top/bottom padding for breathing room inside the card.
  // Fix #4: nudge card upward 5% of IMAGE_HEIGHT so visual CoG sits above centre
  //         (standard compositional rule for portrait-format graphics).
  // Fix #5: minimum side margin 80px — card max width IMAGE_WIDTH - 160.
  // Guaranteed minimum horizontal padding of CARD_PADDING_X_PX (64px) between text and card edges.
  const minCardWidth = 760 * scale;
  const cardWidth = Math.max(minCardWidth, Math.min(cardMaxWidth, quoteRender.width + 2 * cardPaddingX));
  const cardHeight = textBlockHeight + cardPaddingTop + cardPaddingBottom;

  const cardLeft = Math.round((W - cardWidth) / 2);
  // Fix #4: shift card up by ~5% of IMAGE_HEIGHT so it sits above the mathematical centre
  const verticalNudgeUp = Math.round(H * 0.05);
  const cardTop  = Math.round((H - cardHeight) / 2) - verticalNudgeUp;
  const textBlockTop = cardTop + cardPaddingTop;

  const glassCard = await renderGlassCard({
    width: cardWidth,
    height: cardHeight,
    mode,
    categoryName: template.categories[0] ?? "daily quote",
    scrimOpacity: suitability.scrimOpacity,
  });

  const quoteLeft = Math.round((W - quoteRender.width) / 2);
  const quoteShadow = await renderTextShadow(quoteText, template.quoteFont, quoteRender.fontSize, textMaxWidth / scale, mode, scale, shadowBlur);

  const compositeLayers: OverlayOptions[] = [
    { input: glassCard, left: cardLeft, top: cardTop },
    {
      input: quoteShadow,
      left: quoteLeft,
      top: textBlockTop + shadowOffsetY,
    },
    { input: quoteRender.buffer, left: quoteLeft, top: textBlockTop },
  ];

  if (authorRender && authorDisplay) {
    const authorLeft = Math.round((W - authorRender.width) / 2);
    const authorTop = textBlockTop + quoteRender.height + authorGap;
    
    const authorShadow = await renderTextShadow(authorDisplay, template.authorFont, authorRender.fontSize, textMaxWidth / scale, mode, scale, shadowBlur);
    compositeLayers.push({
      input: authorShadow,
      left: authorLeft,
      top: authorTop + shadowOffsetY,
    });
    compositeLayers.push({
      input: authorRender.buffer,
      left: authorLeft,
      top: authorTop,
    });
  }

  const composed = sharp(baseBuffer).composite(compositeLayers);

  // Step 10: export as crystal-clear 100% HD JPEG (4:4:4 chroma subsampling for razor-sharp typography).
  return composed.jpeg({ quality: 100, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
}
