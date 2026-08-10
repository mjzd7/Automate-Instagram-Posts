// Single source of truth for the image-pipeline numeric constants, mirroring
// plan.md §2 exactly. Every module under src/images and src/matching should
// import from here rather than re-declaring a magic number.

export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;
export const SAFE_MARGIN_PX = 80;
export const FONT_SIZE_MAX = 72;
export const FONT_SIZE_MIN = 32;
export const FONT_SIZE_STEP = 4;

/**
 * Word-count-aware font size ceiling.
 * Prevents long quotes from rendering at a size that blows out the card.
 * Short punchy quotes (≤ 8 words) get the full 72px max; longer quotes scale
 * down progressively so the card stays within the frame.
 *
 * Thresholds derived from visual testing across 5-post batches:
 *   ≤ 8 words  → 72px  (short power phrase, large display treatment)
 *   ≤ 14 words → 56px  (medium quote, comfortable two–three line block)
 *   ≤ 18 words → 48px  (long-ish quote, four line block at most)
 *   > 18 words → 40px  (near MAX_QUOTE_WORDS=25, wall-of-text prevention)
 */
export function fontSizeMaxForWordCount(wordCount: number): number {
  if (wordCount <= 8) return 72;
  if (wordCount <= 14) return 56;
  if (wordCount <= 18) return 48;
  return 40;
}
export const LINE_HEIGHT_RATIO = 1.3;
export const TARGET_MAX_CHARS_PER_LINE = 32;
export const AUTHOR_LINE_FONT_SIZE_RATIO = 0.4;
export const AUTHOR_LINE_FONT_SIZE_MIN = 24;
// Not part of the original plan.md constant list -- added per explicit user
// request for visual consistency across the feed. Research (WebSearch,
// quote-graphic design sources): the most shareable quote-graphic length is
// 8-18 words, with 25 words as the threshold past which a quote reads as a
// paragraph rather than a single complete thought, not a specific word-count
// study. MAX_QUOTE_WORDS is a hard selection-time cap: quotes.repo.ts /
// the curated provider must reject a candidate over this limit and retry
// with a different, shorter quote from the same category -- NOT truncate
// at render time (explicit user directive; text-render.ts's truncation path
// stays only as a last-resort defensive fallback for pathological cases
// that slip past this filter, e.g. one absurdly long unbroken word).
export const MAX_QUOTE_WORDS = 22;
export const IDEAL_QUOTE_WORDS_MIN = 8;
export const IDEAL_QUOTE_WORDS_MAX = 18;

export const SCRIM_BAND_PADDING_PX = 60;
/**
 * Minimum vertical space (px) preserved above and below the glass card in
 * the final image frame. Used to compute the maximum card height and,
 * from that, the true quoteMaxHeight passed to renderFittedText().
 *
 * Previous bug: compositor.ts used suitability.textZoneRegion.height (~337px)
 * as quoteMaxHeight — a zone defined for busyness analysis, not layout.
 * With CARD_VERTICAL_MARGIN_PX = 120 the correct quoteMaxHeight is:
 *   (IMAGE_HEIGHT - 2×120) - cardPaddingTop - cardPaddingBottom - authorEstimate
 *   = (1350 - 240) - 130 - 80 - 64 = 836px   (vs the former 337px)
 */
export const CARD_VERTICAL_MARGIN_PX = 120;
/** Minimum horizontal margin (px) between the card and the image edges. */
export const CARD_HORIZONTAL_MARGIN_PX = 80;
/** Guaranteed horizontal inner padding (px) between text and the card edge. */
export const CARD_PADDING_X_PX = 64;
export const SCRIM_PEAK_OPACITY_NORMAL = 0.45;
export const SCRIM_PEAK_OPACITY_BUSY = 0.6;
export const SCRIM_COLOR_DARK_MODE = "#000000";
export const SCRIM_COLOR_LIGHT_MODE = "#FFFFFF";
export const GRAIN_TEXTURE_OPACITY = 0.08;
export const TEXT_SHADOW_BLUR_PX = 8;
export const TEXT_SHADOW_OFFSET_Y_PX = 2;
// Pango markup's <span foreground="..."> attribute requires Pango's own
// color syntax (#RRGGBB / #RRGGBBAA / named colors) -- CSS rgba() functional
// notation is not accepted and causes a hard "invalid markup" parse error
// (found via a failing compositor test, not assumed). #RRGGBBAA below is
// the hex-with-alpha equivalent of rgba(0,0,0,0.35) and rgba(0,0,0,0.15).
export const TEXT_SHADOW_COLOR_DARK_MODE = "#00000059";
export const TEXT_SHADOW_COLOR_LIGHT_MODE = "#00000026";

export const ANALYSIS_THUMBNAIL_SIZE = 64;
export const DARK_PIXEL_LUMINANCE_CUTOFF = 90;
export const DARK_FRACTION_THRESHOLD = 0.6;

export const TEXT_ZONE_HORIZONTAL_CROP = 0.8;
export const TEXT_ZONE_VERTICAL_CROP_START = 0.45;
export const TEXT_ZONE_VERTICAL_CROP_END = 0.7;
export const BUSYNESS_HIGH_THRESHOLD = 45;
// Not part of plan.md's original constant list -- added after the RED test
// in suitability-scorer.test.ts proved that downsampling the crop all the
// way to ANALYSIS_THUMBNAIL_SIZE (64px) with an averaging resize kernel
// erases the exact high-frequency detail the busyness metric needs to
// detect. This bounds computation cost on very large source images while
// using nearest-neighbor sampling (not averaging) to preserve local
// contrast. See docs/LEARNINGS.md FR-002.
export const SUITABILITY_ANALYSIS_MAX_DIMENSION = 400;
export const BUSY_BLUR_RADIUS_PX = 6;
