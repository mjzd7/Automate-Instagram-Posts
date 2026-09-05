import "./fonts-init.js";
import { existsSync } from "node:fs";
import sharp from "sharp";
import { FONT_SIZE_MAX, FONT_SIZE_MIN, FONT_SIZE_STEP, fontSizeMaxForWordCount } from "./constants.js";
import type { FontFace } from "./templates.js";

export interface TextRenderResult {
  buffer: Buffer;
  width: number;
  height: number;
  fontSize: number;
  truncated: boolean;
}

/**
 * Thrown by renderFittedText when the quote text cannot fit inside the card
 * even at FONT_SIZE_MIN without truncation. The pipeline must treat this as
 * a retryable failure and select a different (shorter) quote rather than
 * posting a visually clipped card.
 */
export class QuoteTruncatedError extends Error {
  constructor(quoteText: string, fontSize: number) {
    super(
      `QuoteTruncatedError: quote could not fit without truncation at FONT_SIZE_MIN=${fontSize}px. ` +
      `Quote (${quoteText.split(/\s+/).length} words): "${quoteText.slice(0, 60)}…"`,
    );
    this.name = "QuoteTruncatedError";
  }
}

/**
 * sharp's text API has no dedicated color option (confirmed against the
 * installed type definitions) -- color is set via Pango markup within the
 * text string itself, e.g. `<span foreground="#FFFFFF">...</span>`, which
 * requires XML-escaping the literal text content first.
 */
function escapePangoMarkup(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function withColor(text: string, color: string): string {
  return `<span foreground="${color}">${escapePangoMarkup(text)}</span>`;
}

/**
 * Exported so callers (compositor.ts's shadow layer) can re-render the same
 * text/size/width combo in a different color without duplicating the sharp
 * call. The fontfile-existence check lives here (not just in
 * renderFittedText) since this is the actual boundary where sharp/Pango
 * would otherwise silently substitute a fallback font for a bad path
 * (docs/LEARNINGS.md FR-003) -- every caller of this function gets the
 * guard, not just the ones that happen to go through renderFittedText.
 */
export async function renderTextAtSize(
  text: string,
  face: FontFace,
  fontSize: number,
  maxWidth: number,
  color: string,
  scale: number = 1,
  align: "left" | "centre" | "right" = "centre",
): Promise<{ data: Buffer; info: { width: number; height: number } }> {
  if (!existsSync(face.file)) {
    throw new Error(`renderTextAtSize: font file does not exist: ${face.file}`);
  }
  return sharp({
    text: {
      text: withColor(text, color),
      fontfile: face.file,
      font: `${face.family} ${fontSize * scale}`,
      width: maxWidth * scale,
      align,
      rgba: true,
      wrap: "word",
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
}

/**
 * Renders `text` at the largest font size (FONT_SIZE_MAX down to
 * FONT_SIZE_MIN, step FONT_SIZE_STEP) that fits within maxWidth x maxHeight,
 * per plan.md §7.11 step 6. If it still doesn't fit at FONT_SIZE_MIN,
 * throws QuoteTruncatedError so the pipeline can retry with a different quote.
 */
export async function renderFittedText(
  text: string,
  face: FontFace,
  maxWidth: number,
  maxHeight: number,
  color: string,
  scale: number = 1,
  align: "left" | "centre" | "right" = "centre",
): Promise<TextRenderResult> {
  if (!text.trim()) {
    throw new Error("renderFittedText: text must not be empty");
  }

  // Cap starting font size based on word count to prevent long quotes from
  // ballooning the card beyond the image frame (fix #3).
  const wordCount = text.trim().split(/\s+/).length;
  const effectiveFontSizeMax = Math.min(FONT_SIZE_MAX, fontSizeMaxForWordCount(wordCount));

  for (let fontSize = effectiveFontSizeMax; fontSize >= FONT_SIZE_MIN; fontSize -= FONT_SIZE_STEP) {
    const { data, info } = await renderTextAtSize(text, face, fontSize, maxWidth, color, scale, align);
    if (info.height <= maxHeight * scale) {
      return { buffer: data, width: info.width, height: info.height, fontSize, truncated: false };
    }
  }

  // If we reach here, the text doesn't fit even at FONT_SIZE_MIN.
  // Throw QuoteTruncatedError so the pipeline can retry with a different quote.
  throw new QuoteTruncatedError(text, FONT_SIZE_MIN);
}
