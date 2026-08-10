import sharp from "sharp";
import {
  ANALYSIS_THUMBNAIL_SIZE,
  DARK_PIXEL_LUMINANCE_CUTOFF,
} from "./constants.js";
import { computeLuminances } from "./luminance.js";

export type Darkness = "dark" | "light";

/**
 * Robustly classifies a background image as dark|light:
 * Combines mean overall luminance with dark pixel fraction to prevent bright
 * images with high-contrast text/objects (e.g. open book pages or sunlit ground)
 * from being misclassified as dark mode.
 */
export async function classifyDarkness(imageBuffer: Buffer): Promise<Darkness> {
  const { data, info } = await sharp(imageBuffer)
    .resize(ANALYSIS_THUMBNAIL_SIZE, ANALYSIS_THUMBNAIL_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 3) {
    throw new Error(`Expected 3-channel RGB after removeAlpha(), got ${info.channels} channels`);
  }

  const luminances = computeLuminances(data);
  const sumLuminance = luminances.reduce((acc, l) => acc + l, 0);
  const meanLuminance = sumLuminance / luminances.length;

  const darkCount = luminances.filter((l) => l < DARK_PIXEL_LUMINANCE_CUTOFF).length;
  const darkFraction = darkCount / luminances.length;

  // High mean brightness (>115) is unambiguously light mode
  if (meanLuminance >= 115) {
    return "light";
  }

  // Low mean brightness (<85) is unambiguously dark mode
  if (meanLuminance <= 85) {
    return "dark";
  }

  // Borderline cases (85 - 115): classify as dark if majority of pixels are below cutoff
  return darkFraction >= 0.55 ? "dark" : "light";
}
