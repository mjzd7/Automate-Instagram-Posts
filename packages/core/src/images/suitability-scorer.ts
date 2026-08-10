import sharp from "sharp";
import {
  BUSYNESS_HIGH_THRESHOLD,
  BUSY_BLUR_RADIUS_PX,
  SCRIM_PEAK_OPACITY_BUSY,
  SCRIM_PEAK_OPACITY_NORMAL,
  SUITABILITY_ANALYSIS_MAX_DIMENSION,
  TEXT_ZONE_HORIZONTAL_CROP,
  TEXT_ZONE_VERTICAL_CROP_END,
  TEXT_ZONE_VERTICAL_CROP_START,
} from "./constants.js";
import { computeLuminances, standardDeviation } from "./luminance.js";

export interface SuitabilityResult {
  busy: boolean;
  busynessScore: number;
  scrimOpacity: number;
  blurRegion: boolean;
  /** Pixel region (in the original image's coordinate space) the score was computed over, and that compositor.ts should blur if blurRegion is true. */
  textZoneRegion: { left: number; top: number; width: number; height: number };
}

/**
 * Scores the text-placement region of a background image for visual
 * "busyness" (plan.md §7.10 / §2.4): crop the center text zone, compute the
 * standard deviation of per-pixel luminance, and use that to decide scrim
 * intensity and whether to pre-blur the region before compositing text.
 */
export async function scoreSuitability(imageBuffer: Buffer): Promise<SuitabilityResult> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) {
    throw new Error("scoreSuitability: source image has no readable width/height");
  }

  const cropWidth = Math.round(width * TEXT_ZONE_HORIZONTAL_CROP);
  const cropLeft = Math.round((width - cropWidth) / 2);
  const cropTop = Math.round(height * TEXT_ZONE_VERTICAL_CROP_START);
  const cropHeight = Math.round(height * (TEXT_ZONE_VERTICAL_CROP_END - TEXT_ZONE_VERTICAL_CROP_START));
  const textZoneRegion = { left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight };

  // Bound computation cost on very large source images by capping the
  // longest edge, but with nearest-neighbor sampling (not the default
  // averaging kernel) so local contrast/detail survives the downsample --
  // an averaging kernel would wash out exactly the high-frequency signal
  // this metric is trying to measure.
  const { data, info } = await sharp(imageBuffer)
    .extract(textZoneRegion)
    .resize(SUITABILITY_ANALYSIS_MAX_DIMENSION, SUITABILITY_ANALYSIS_MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: "nearest",
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 3) {
    throw new Error(`Expected 3-channel RGB after removeAlpha(), got ${info.channels} channels`);
  }

  const busynessScore = standardDeviation(computeLuminances(data));
  const busy = busynessScore > BUSYNESS_HIGH_THRESHOLD;

  return {
    busy,
    busynessScore,
    scrimOpacity: busy ? SCRIM_PEAK_OPACITY_BUSY : SCRIM_PEAK_OPACITY_NORMAL,
    blurRegion: busy,
    textZoneRegion,
  };
}

export { BUSY_BLUR_RADIUS_PX };
