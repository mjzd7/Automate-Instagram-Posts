import sharp from "sharp";
import { SCRIM_COLOR_DARK_MODE, SCRIM_COLOR_LIGHT_MODE } from "./constants.js";
import type { Darkness } from "./darkness-classifier.js";

/**
 * Renders the scrim band as a PNG buffer: a 3-stop vertical linear gradient
 * (0% -> opacity 0, 50% -> peakOpacity, 100% -> opacity 0) per plan.md §2.2
 * SCRIM_GRADIENT_STOPS, colored black in dark mode / white in light mode.
 */
export async function renderScrim(
  width: number,
  height: number,
  mode: Darkness,
  peakOpacity: number,
): Promise<Buffer> {
  const color = mode === "dark" ? SCRIM_COLOR_DARK_MODE : SCRIM_COLOR_LIGHT_MODE;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0" />
          <stop offset="50%" stop-color="${color}" stop-opacity="${peakOpacity}" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#scrim)" />
    </svg>
  `.trim();

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Renders a soft radial vignette overlay to gently darken frame edges
 * and draw the viewer's eyes to the central quote card.
 */
export async function renderVignette(width: number, height: number, mode: Darkness): Promise<Buffer> {
  const isDark = mode === "dark";
  const edgeOpacity = isDark ? 0.50 : 0.20;
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
          <stop offset="35%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="${edgeOpacity}" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#vignette)" />
    </svg>
  `.trim();

  return sharp(Buffer.from(svg)).png().toBuffer();
}
