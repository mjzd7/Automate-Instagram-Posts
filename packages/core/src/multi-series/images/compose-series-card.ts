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
import {
  QuoteTruncatedError,
  renderFittedText,
  renderTextAtSize,
} from "../../images/text-render.js";
import { AUTHOR_LINE_FONT_SIZE_MIN } from "../../images/constants.js";
import type { FontFace } from "../../images/templates.js";
import type { PackItem } from "../quotes/content-pack.js";
import { replaceGapToken } from "./gap-token.js";
import {
  findSeriesTemplate,
  layoutZones,
  type SeriesTemplate,
  type Zone,
} from "./registry.js";

export interface SeriesCardInput {
  backgroundBuffer: Buffer;
  templateId: string;
  item: PackItem;
  mode?: Darkness;
  /** Overrides grain RNG for deterministic output (tests). */
  grainRandom?: () => number;
}

const PAD_X = 64;
const PAD_TOP = 90;
const PAD_BOTTOM = 90;
const BLOCK_GAP = 40;
const MIN_CARD_WIDTH = 760;

function textColor(mode: Darkness): string {
  return mode === "dark" ? "#FFFFFF" : "#1A1A1A";
}
function mutedColor(mode: Darkness): string {
  return mode === "dark" ? "#FFFFFFBF" : "#1A1A1AA6";
}

async function renderTextShadow(
  text: string,
  face: FontFace,
  fontSize: number,
  maxWidth: number,
  mode: Darkness,
): Promise<Buffer> {
  const shadowColor = mode === "dark" ? "#00000059" : "#00000026";
  const { data } = await renderTextAtSize(text, face, fontSize, maxWidth, shadowColor);
  return sharp(data)
    .blur(8)
    .png()
    .toBuffer();
}

interface RenderedBlock {
  buffer: Buffer;
  width: number;
  height: number;
  fontSize: number;
}

async function fittedBlock(
  text: string,
  face: FontFace,
  maxWidth: number,
  maxHeight: number,
  mode: Darkness,
): Promise<RenderedBlock> {
  // Height-fit alone can't catch unbreakable single-word overflow (one line
  // always fits vertically) — width must be enforced or the oversized layer
  // corrupts the composite.
  const rendered = await renderFittedText(text, face, maxWidth, maxHeight, textColor(mode));
  if (rendered.width > maxWidth + 1) {
    throw new QuoteTruncatedError(text, rendered.fontSize);
  }
  return rendered;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Composes one 1080x1350 series card using the shared image primitives
 * (vignette, grain, glass card, fitted text) positioned according to the
 * series layout zones. Base-prep steps mirror images/compositor.ts's proven
 * assembly; the divergence is zone-based placement instead of one centred
 * card, plus per-series elements (CTA strip, framework blocks).
 */
export async function composeSeriesCard(input: SeriesCardInput): Promise<Buffer> {
  const template: SeriesTemplate = findSeriesTemplate(input.templateId);
  const item = input.item;
  const mode = input.mode ?? "dark";
  const W = IMAGE_WIDTH;
  const H = IMAGE_HEIGHT;

  let baseBuffer = await sharp(input.backgroundBuffer)
    .resize(W, H, { fit: "cover" })
    .blur(1.5)
    .png()
    .toBuffer();

  baseBuffer = await sharp(baseBuffer)
    .composite([{ input: await renderVignette(W, H, mode), left: 0, top: 0 }])
    .png()
    .toBuffer();

  const grain = await grainTexturePng(W, H, input.grainRandom);
  const grainWithOpacity = await sharp(grain)
    .ensureAlpha(GRAIN_TEXTURE_OPACITY)
    .png()
    .toBuffer();
  baseBuffer = await sharp(baseBuffer)
    .composite([{ input: grainWithOpacity, blend: "overlay" }])
    .png()
    .toBuffer();

  const zones = layoutZones(template.layout);
  const layers: OverlayOptions[] = [];

  if (
    template.layout === "hook-cover" ||
    template.layout === "confession-card" ||
    template.layout === "identity-badge" ||
    template.layout === "roast-footer" ||
    template.layout === "gap-line"
  ) {
    const zone: Zone = zones.primary;
    const textMaxWidth = zone.width - 2 * PAD_X;
    const maxTextHeight = zone.height - PAD_TOP - PAD_BOTTOM;
    const displayText =
      template.layout === "gap-line" ? replaceGapToken(item.text) : item.text;

    const primary = await fittedBlock(displayText, template.quoteFont, textMaxWidth, maxTextHeight, mode);

    let ctaBlock: RenderedBlock | undefined;
    if (template.layout === "roast-footer" && item.ctaTag) {
      const fontSize = AUTHOR_LINE_FONT_SIZE_MIN;
      const { data, info } = await renderTextAtSize(
        item.ctaTag,
        template.authorFont,
        fontSize,
        textMaxWidth,
        mutedColor(mode),
      );
      ctaBlock = { buffer: data, width: info.width, height: info.height, fontSize };
    }

    const cardWidth = Math.max(MIN_CARD_WIDTH, zone.width);
    const innerContentHeight =
      primary.height + (ctaBlock ? BLOCK_GAP + ctaBlock.height : 0);
    const cardHeight = Math.max(460, innerContentHeight + PAD_TOP + PAD_BOTTOM);
    const cardLeft = clamp(zone.left, CARD_HORIZONTAL_MARGIN_PX, W - cardWidth - CARD_HORIZONTAL_MARGIN_PX);
    const cardTop = Math.round((H - cardHeight) / 2);

    layers.push({
      input: await renderGlassCard({
        width: cardWidth,
        height: cardHeight,
        mode,
        categoryName: item.seriesId,
        scrimOpacity: SCRIM_PEAK_OPACITY_NORMAL,
        showQuotes: template.layout === "confession-card" || template.layout === "hook-cover",
      }),
      left: cardLeft,
      top: cardTop,
    });

    const primaryLeft = cardLeft + Math.round((cardWidth - primary.width) / 2);
    const primaryTop = cardTop + Math.round((cardHeight - innerContentHeight) / 2);
    layers.push({
      input: await renderTextShadow(displayText, template.quoteFont, primary.fontSize, textMaxWidth, mode),
      left: primaryLeft,
      top: primaryTop + 2,
    });
    layers.push({ input: primary.buffer, left: primaryLeft, top: primaryTop });

    if (ctaBlock) {
      const ctaLeft = cardLeft + Math.round((cardWidth - ctaBlock.width) / 2);
      const ctaTop = primaryTop + primary.height + BLOCK_GAP;
      layers.push({ input: ctaBlock.buffer, left: ctaLeft, top: ctaTop });
    }
  } else {
    const zone: Zone = zones.primary;
    const textMaxWidth = zone.width - 2 * PAD_X;
    const framework = item.framework;
    if (!framework) {
      throw new Error(
        `composeSeriesCard: template "${template.id}" requires a framework block on the pack item`,
      );
    }

    const titleMaxHeight = Math.round(zone.height * 0.28);
    const title = await fittedBlock(framework.title, template.quoteFont, textMaxWidth, titleMaxHeight, mode);
    const stepsText = framework.steps.map((step, i) => `${i + 1}. ${step}`).join("\n");
    const stepsMaxHeight = zone.height - titleMaxHeight - BLOCK_GAP - PAD_TOP - PAD_BOTTOM;
    const steps = await fittedBlock(stepsText, template.authorFont, textMaxWidth, stepsMaxHeight, mode);

    let utilityBlock: RenderedBlock | undefined;
    if (item.utilityLine) {
      const { data, info } = await renderTextAtSize(
        item.utilityLine,
        template.authorFont,
        AUTHOR_LINE_FONT_SIZE_MIN,
        textMaxWidth,
        mutedColor(mode),
      );
      utilityBlock = { buffer: data, width: info.width, height: info.height, fontSize: AUTHOR_LINE_FONT_SIZE_MIN };
    }

    const contentHeight =
      title.height + BLOCK_GAP + steps.height + (utilityBlock ? BLOCK_GAP + utilityBlock.height : 0);
    const cardWidth = Math.max(MIN_CARD_WIDTH, zone.width);
    const cardHeight = Math.max(680, contentHeight + PAD_TOP + PAD_BOTTOM);
    const cardLeft = clamp(zone.left, CARD_HORIZONTAL_MARGIN_PX, W - cardWidth - CARD_HORIZONTAL_MARGIN_PX);
    const cardTop = Math.round((H - cardHeight) / 2);

    layers.push({
      input: await renderGlassCard({
        width: cardWidth,
        height: cardHeight,
        mode,
        categoryName: item.seriesId,
        scrimOpacity: SCRIM_PEAK_OPACITY_NORMAL,
        showQuotes: false,
      }),
      left: cardLeft,
      top: cardTop,
    });

    const titleLeft = cardLeft + Math.round((cardWidth - title.width) / 2);
    const titleTop = cardTop + PAD_TOP;
    layers.push({ input: title.buffer, left: titleLeft, top: titleTop });

    const stepsLeft = cardLeft + Math.round((cardWidth - steps.width) / 2);
    const stepsTop = titleTop + title.height + BLOCK_GAP;
    layers.push({ input: steps.buffer, left: stepsLeft, top: stepsTop });

    if (utilityBlock) {
      const utilityLeft = cardLeft + Math.round((cardWidth - utilityBlock.width) / 2);
      const utilityTop = stepsTop + steps.height + BLOCK_GAP;
      layers.push({ input: utilityBlock.buffer, left: utilityLeft, top: utilityTop });
    }
  }

  return sharp(baseBuffer)
    .composite(layers)
    .jpeg({ quality: 100, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}

// Re-exported so callers can catch the shared truncation contract without
// importing from the frozen tree's internals directly.
export { QuoteTruncatedError };
